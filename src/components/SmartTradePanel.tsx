'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAction, useQuery } from 'convex/react';
import { useConfig } from 'wagmi';
import { getPublicClient } from 'wagmi/actions';
import { erc20Abi, formatUnits, isAddress, keccak256, parseUnits, toHex, type Hex } from 'viem';
import { api } from '../../convex/_generated/api';
import { Button } from './Button';
import { Glass } from './Glass';
import { ManagedFundsSheet } from './ManagedFundsSheet';
import { btb } from './design-tokens';
import { useTx } from '../lib/TxTracker';
import { runCalls } from '../lib/txRunner';
import { fetchAccountAssets, type AccountAsset } from '../lib/accountAssets';
import {
  BTB_AGENT_REGISTRY_ABI, configureAgentCall, configureTradePolicyCall, createAccountCall,
  getSmartAccountDeployment, readSmartAccount,
  type TradePolicy,
} from '../lib/smartAccount';

type TokenMeta = { address: `0x${string}`; symbol: string; decimals: number; balance: bigint };
type SmartState = {
  account: `0x${string}`;
  deployed: boolean;
  roles: number;
  policy: TradePolicy | null;
  nativeBalance: bigint;
  wethBalance: bigint;
};

export type TradePreset = {
  id: string;
  side: 'buy' | 'sell';
  address: `0x${string}`;
  symbol: string;
  imageUrl?: string;
};

const CHAIN_ID = 4663 as const;
const WETH = '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73' as const;
const USDG = '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168' as const;
const storageKey = (account: string) => `btb:instant-trade:${CHAIN_ID}:${account.toLowerCase()}`;
const sizeKey = (account: string) => `btb:instant-trade-size:${CHAIN_ID}:${account.toLowerCase()}`;

function compact(raw: bigint, decimals: number) {
  const value = Number(formatUnits(raw, decimals));
  if (value === 0) return '0';
  if (value < 0.0001) return value.toExponential(2);
  return value.toLocaleString('en-US', { maximumFractionDigits: 6 });
}

export function SmartTradePanel({ owner, onConnect, presets = [] }: { owner?: string; onConnect?: () => void; presets?: TradePreset[] }) {
  const config = useConfig();
  const { track } = useTx();
  const enqueueTrade = useAction(api.spotTrade.enqueue);
  const deployment = getSmartAccountDeployment(CHAIN_ID);
  const validOwner = owner && isAddress(owner) ? owner as `0x${string}` : null;
  const [state, setState] = useState<SmartState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'setup' | 'trade' | null>(null);
  const [mode, setMode] = useState<'buy' | 'sell'>('buy');
  const [tokenIn, setTokenIn] = useState<string>(WETH);
  const [tokenOut, setTokenOut] = useState('');
  const [inputMeta, setInputMeta] = useState<TokenMeta | null>(null);
  const [outputMeta, setOutputMeta] = useState<TokenMeta | null>(null);
  const [amount, setAmount] = useState('0.001');
  const [buySize, setBuySize] = useState('0.001');
  const [buyToken, setBuyToken] = useState<string>(WETH);
  const [sellToken, setSellToken] = useState<string>(WETH);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ orderId: string } | null>(null);
  const [funding, setFunding] = useState<'deposit' | 'withdraw' | null>(null);
  const [addressCopied, setAddressCopied] = useState(false);
  const [balanceRefresh, setBalanceRefresh] = useState(0);
  const [walletAssets, setWalletAssets] = useState<AccountAsset[]>([]);
  const [smartAssets, setSmartAssets] = useState<AccountAsset[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const executedPreset = useRef<string | null>(null);
  const handledPresets = useRef(new Set<string>());
  const lastConfirmedOrder = useRef<string | null>(null);
  const [pendingPresets, setPendingPresets] = useState<TradePreset[]>([]);
  const [preset, setPreset] = useState<TradePreset | null>(null);
  const [noticePreset, setNoticePreset] = useState<TradePreset | null>(null);

  const load = useCallback(async () => {
    if (!validOwner || !deployment?.agentRegistry) { setState(null); setLoading(false); return; }
    setLoading(true);
    try {
      const client = getPublicClient(config, { chainId: CHAIN_ID });
      if (!client) throw new Error('Robinhood RPC is unavailable');
      const smart = await readSmartAccount(client, validOwner, deployment);
      if (!smart.deployed) {
        setState({ account: smart.account, deployed: false, roles: 0, policy: null, nativeBalance: 0n, wethBalance: 0n });
        return;
      }
      const [roles, rawPolicy, nativeBalance, wethBalance] = await Promise.all([
        client.readContract({ address: deployment.agentRegistry, abi: BTB_AGENT_REGISTRY_ABI, functionName: 'agentRoles', args: [smart.account, deployment.agent] }).catch(() => 0),
        client.readContract({ address: deployment.agentRegistry, abi: BTB_AGENT_REGISTRY_ABI, functionName: 'tradePolicies', args: [smart.account] }).catch(() => null),
        client.getBalance({ address: smart.account }).catch(() => 0n),
        client.readContract({ address: WETH, abi: erc20Abi, functionName: 'balanceOf', args: [smart.account] }).catch(() => 0n),
      ]);
      const policy: TradePolicy | null = rawPolicy ? {
        enabled: rawPolicy[0], agent: rawPolicy[1], requestKeyHash: rawPolicy[2],
        maximumBalanceBpsPerTrade: Number(rawPolicy[3]), maximumSlippageBps: Number(rawPolicy[4]),
        maximumSpotTwapDeviationBps: Number(rawPolicy[5]), minimumTwapSeconds: Number(rawPolicy[6]),
        expiresAt: rawPolicy[7],
      } : null;
      setState({ account: smart.account, deployed: true, roles: Number(roles), policy, nativeBalance, wethBalance });
    } catch (reason) {
      setError((reason as Error).message || 'Could not load the smart trading account');
    } finally { setLoading(false); }
  }, [config, deployment, validOwner]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const incoming = presets.filter(item => !handledPresets.current.has(item.id));
    if (!incoming.length) return;
    for (const item of incoming) handledPresets.current.add(item.id);
    setPendingPresets(current => [...current, ...incoming]);
  }, [presets]);

  useEffect(() => {
    if (preset || pendingPresets.length === 0) return;
    setPreset(pendingPresets[0]);
    setNoticePreset(pendingPresets[0]);
    setPendingPresets(current => current.slice(1));
  }, [pendingPresets, preset]);

  useEffect(() => {
    if (!validOwner) { setWalletAssets([]); setSmartAssets([]); return; }
    const controller = new AbortController();
    setAssetsLoading(true);
    void Promise.all([
      fetchAccountAssets(validOwner, controller.signal, balanceRefresh),
      state?.deployed ? fetchAccountAssets(state.account, controller.signal, balanceRefresh) : Promise.resolve([]),
    ]).then(([wallet, smart]) => { setWalletAssets(wallet); setSmartAssets(smart); }).catch(() => undefined).finally(() => { if (!controller.signal.aborted) setAssetsLoading(false); });
    return () => controller.abort();
  }, [balanceRefresh, state?.account, state?.deployed, validOwner]);

  useEffect(() => {
    if (!state?.account) return;
    const saved = localStorage.getItem(sizeKey(state.account));
    if (saved && Number(saved) > 0) { setBuySize(saved); setAmount(saved); }
  }, [state?.account]);

  useEffect(() => {
    if (!preset) return;
    setMode(preset.side);
    setTokenIn(preset.side === 'buy' ? buyToken : preset.address);
    setTokenOut(preset.side === 'buy' ? preset.address : sellToken);
    if (preset.side === 'buy') {
      const saved = state?.account ? localStorage.getItem(sizeKey(state.account)) : null;
      const next = saved && Number(saved) > 0 ? saved : buySize;
      setBuySize(next);
      setAmount(next);
    } else setAmount('');
    setError(null);
    setSuccess(null);
  }, [buySize, buyToken, preset, sellToken, state?.account]);

  useEffect(() => {
    let cancelled = false;
    const readMeta = async (value: string, set: (meta: TokenMeta | null) => void) => {
      set(null);
      if (!state?.deployed || !isAddress(value)) return;
      const client = getPublicClient(config, { chainId: CHAIN_ID });
      if (!client) return;
      try {
        const address = value as `0x${string}`;
        const [symbol, decimals, balance] = await Promise.all([
          client.readContract({ address, abi: erc20Abi, functionName: 'symbol' }),
          client.readContract({ address, abi: erc20Abi, functionName: 'decimals' }),
          client.readContract({ address, abi: erc20Abi, functionName: 'balanceOf', args: [state.account] }),
        ]);
        if (!cancelled) set({ address, symbol, decimals, balance });
      } catch { if (!cancelled) set(null); }
    };
    void readMeta(tokenIn.trim(), setInputMeta);
    void readMeta(tokenOut.trim(), setOutputMeta);
    return () => { cancelled = true; };
  }, [balanceRefresh, config, state?.account, state?.deployed, tokenIn, tokenOut]);

  useEffect(() => {
    if (preset?.side === 'sell' && inputMeta && inputMeta.address.toLowerCase() === preset.address.toLowerCase() && !amount) {
      setAmount(formatUnits(inputMeta.balance, inputMeta.decimals));
    }
  }, [amount, inputMeta, preset]);

  const parsedAmount = useMemo(() => {
    try { return inputMeta && amount && Number(amount) > 0 ? parseUnits(amount, inputMeta.decimals) : 0n; }
    catch { return 0n; }
  }, [amount, inputMeta]);

  const localKey = state ? globalThis.localStorage?.getItem(storageKey(state.account)) : null;
  const policyActive = !!state?.policy?.enabled && Number(state.policy.expiresAt) > Date.now() / 1000;
  const deviceAuthorized = !!localKey && /^0x[0-9a-fA-F]{64}$/.test(localKey)
    && !!state?.policy && keccak256(localKey as Hex).toLowerCase() === state.policy.requestKeyHash.toLowerCase();
  const instantReady = policyActive && deviceAuthorized && !!(state.roles & 16);
  const orders = useQuery(api.spotTradeQueue.listForAccount, state?.account ? { account: state.account } : 'skip');
  const pendingOrderCount = orders?.filter(order => ['queued', 'preparing', 'submitted'].includes(order.state)).length ?? 0;
  const latestOrder = success ? orders?.find(order => String(order._id) === success.orderId) : undefined;
  const spendableAssets = smartAssets.filter(asset => !asset.native && asset.address && asset.balance > 0);
  const selectedBuyAsset = spendableAssets.find(asset => asset.address?.toLowerCase() === buyToken.toLowerCase());
  const buySymbol = selectedBuyAsset?.symbol || (buyToken.toLowerCase() === WETH.toLowerCase() ? 'WETH' : inputMeta?.symbol || 'TOKEN');
  const minimumBuyAmount = selectedBuyAsset?.priceUsd ? 5.1 / selectedBuyAsset.priceUsd : null;
  const minimumBuyText = minimumBuyAmount ? (Math.ceil(minimumBuyAmount * 1e8) / 1e8).toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 8 }) : null;
  const belowMinimum = minimumBuyAmount != null && Number(buySize || 0) < minimumBuyAmount;
  const sellAllAssets = smartAssets.filter(asset => !asset.native && asset.address && asset.balance > 0 && asset.address.toLowerCase() !== sellToken.toLowerCase() && asset.usdValue >= 5);

  useEffect(() => {
    if (!minimumBuyText || Number(buySize || 0) >= Number(minimumBuyText)) return;
    setBuySize(minimumBuyText);
    if (mode === 'buy') setAmount(minimumBuyText);
    if (state?.account) localStorage.setItem(sizeKey(state.account), minimumBuyText);
  }, [buyToken, minimumBuyText]);

  useEffect(() => {
    const confirmed = orders?.find(order => order.state === 'confirmed');
    if (!confirmed || String(confirmed._id) === lastConfirmedOrder.current) return;
    lastConfirmedOrder.current = String(confirmed._id);
    setBalanceRefresh(value => value + 1);
    const retries = [2_000, 5_000, 10_000, 20_000].map(delay => window.setTimeout(() => setBalanceRefresh(value => value + 1), delay));
    return () => retries.forEach(window.clearTimeout);
  }, [orders]);

  async function enableInstantTrading() {
    if (!validOwner || !deployment?.agentRegistry || !state) { onConnect?.(); return; }
    setBusy('setup'); setError(null); setSuccess(null);
    const requestKey = toHex(crypto.getRandomValues(new Uint8Array(32)));
    const expiresAt = BigInt(Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60);
    const policy: TradePolicy = {
      enabled: true,
      agent: deployment.agent,
      requestKeyHash: keccak256(requestKey),
      maximumBalanceBpsPerTrade: 10_000,
      maximumSlippageBps: 500,
      maximumSpotTwapDeviationBps: 500,
      minimumTwapSeconds: 60,
      expiresAt,
    };
    try {
      await runCalls(config, {
        account: validOwner,
        chainId: CHAIN_ID,
        track,
        label: 'Enable BTB instant trading',
        calls: [
          ...(state.deployed ? [] : [createAccountCall(deployment, validOwner)]),
          configureAgentCall(deployment, state.account, deployment.agent, state.roles | 16),
          configureTradePolicyCall(deployment, state.account, policy),
        ],
      });
      localStorage.setItem(storageKey(state.account), requestKey);
      await load();
    } catch (reason) {
      setError((reason as { shortMessage?: string }).shortMessage || (reason as Error).message || 'Instant trading setup failed');
    } finally { setBusy(null); }
  }

  async function trade() {
    if (!preset || !state || !inputMeta || !outputMeta || !localKey || parsedAmount <= 0n || parsedAmount > inputMeta.balance) return;
    setBusy('trade'); setError(null); setSuccess(null);
    try {
      const result = await enqueueTrade({
        orderKey: `spot:${state.account.toLowerCase()}:${preset.id}`,
        chainId: CHAIN_ID,
        account: state.account,
        tokenIn: inputMeta.address,
        tokenOut: outputMeta.address,
        amountIn: parsedAmount.toString(),
        requestKey: localKey,
      });
      setSuccess({ orderId: String(result.id) });
      setAmount('');
    } catch (reason) { setError((reason as Error).message || 'The BTB agent could not queue this trade'); }
    finally { setBusy(null); setPreset(null); }
  }

  function sellAll() {
    if (!instantReady || sellAllAssets.length === 0) return;
    const stamp = Date.now();
    setPendingPresets(current => [...current, ...sellAllAssets.map((asset, index) => ({
      id: `sell-all:${stamp}:${index}:${asset.address!.toLowerCase()}`,
      side: 'sell' as const,
      address: asset.address as `0x${string}`,
      symbol: asset.symbol,
      imageUrl: asset.imageUrl,
    }))]);
  }

  function dismissTradeNotice() {
    setError(null);
    setSuccess(null);
    setNoticePreset(null);
    setAddressCopied(false);
  }

  useEffect(() => {
    if (!preset || !instantReady || busy !== null || executedPreset.current === preset.id) return;
    const expectedInput = preset.side === 'buy' ? buyToken : preset.address;
    const expectedOutput = preset.side === 'buy' ? preset.address : sellToken;
    if (!inputMeta || !outputMeta || inputMeta.address.toLowerCase() !== expectedInput.toLowerCase() || outputMeta.address.toLowerCase() !== expectedOutput.toLowerCase()) return;
    if (expectedInput.toLowerCase() === expectedOutput.toLowerCase()) {
      executedPreset.current = preset.id;
      setError(`${inputMeta.symbol} is already selected as the receive token.`);
      setPreset(null);
      return;
    }
    if (preset.side === 'buy' && belowMinimum) {
      executedPreset.current = preset.id;
      setError(`Minimum buy is ${minimumBuyText} ${buySymbol} (about $10). Update the amount above and tap Buy again.`);
      setPreset(null);
      return;
    }
    const sellAsset = preset.side === 'sell' ? smartAssets.find(asset => asset.address?.toLowerCase() === preset.address.toLowerCase()) : null;
    if (sellAsset?.priceUsd && sellAsset.usdValue < 5) {
      executedPreset.current = preset.id;
      setError(`${sellAsset.symbol} balance is worth ${sellAsset.usdValue.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}. Instant trades require at least $5.`);
      setPreset(null);
      return;
    }
    if (parsedAmount <= 0n || parsedAmount > inputMeta.balance) {
      executedPreset.current = preset.id;
      setError(parsedAmount > inputMeta.balance ? `Not enough ${inputMeta.symbol}. Smart account balance: ${compact(inputMeta.balance, inputMeta.decimals)} ${inputMeta.symbol}.` : preset.side === 'sell' ? `No available ${inputMeta.symbol} to dump.` : 'Set a buy amount first.');
      setPreset(null);
      return;
    }
    executedPreset.current = preset.id;
    void trade();
  }, [belowMinimum, busy, buySymbol, buyToken, inputMeta, instantReady, minimumBuyText, outputMeta, parsedAmount, preset, sellToken, smartAssets]);

  if (!deployment?.agentRegistry) return null;
  const walletUsd = walletAssets.reduce((sum, asset) => sum + asset.usdValue, 0);
  const smartUsd = smartAssets.reduce((sum, asset) => sum + asset.usdValue, 0);
  const insufficientBalance = Boolean(error?.startsWith('Not enough '));
  const accountLabel = state ? `${state.account.slice(0, 6)}…${state.account.slice(-4)}` : '';
  const usd = (value: number) => value > 0 ? `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : '$0.00';
  return (
    <>
      <Glass padding={13} radius={16} strong style={{ overflow: 'hidden' }}>
        {!validOwner ? <Button variant="success" size="sm" onClick={onConnect}>Connect wallet</Button>
          : loading ? <div style={{ color: btb.textMuted, fontSize: 11, marginTop: 13 }}>Loading smart account…</div>
          : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '9px 12px', borderRadius: 12, border: '1px solid rgba(82,227,164,.22)', background: 'rgba(82,227,164,.055)' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: btb.green, fontSize: 9.5, fontWeight: 850, textTransform: 'uppercase', letterSpacing: .3 }}>Smart account</span>
                    <span style={{ color: btb.textDim, fontSize: 9, fontWeight: 700 }}>{accountLabel}</span>
                  </div>
                  <div style={{ color: btb.text, fontSize: 13.5, fontWeight: 850, marginTop: 2, whiteSpace: 'nowrap' }}>
                    {assetsLoading && walletAssets.length === 0 && smartAssets.length === 0
                      ? <span style={{ color: btb.textMuted, fontSize: 10.5, fontWeight: 600 }}>Loading balances…</span>
                      : <>{usd(smartUsd)}<span style={{ color: btb.textDim, fontSize: 9.5, fontWeight: 700 }}> · wallet {usd(walletUsd)}{assetsLoading ? ' · refreshing' : ''}</span></>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => setFunding('deposit')} style={{ height: 32, padding: '0 13px', borderRadius: 9, border: '1px solid rgba(82,227,164,.34)', background: 'rgba(82,227,164,.12)', color: btb.green, fontFamily: 'inherit', fontSize: 10.5, fontWeight: 850, cursor: 'pointer' }}>Deposit</button>
                  <button onClick={() => setFunding('withdraw')} style={{ height: 32, padding: '0 13px', borderRadius: 9, border: btb.borderSoft, background: 'rgba(255,255,255,.04)', color: btb.text, fontFamily: 'inherit', fontSize: 10.5, fontWeight: 800, cursor: 'pointer' }}>Withdraw</button>
                </div>
              </div>
              {!instantReady ? (
                <div style={{ marginTop: 7, padding: 12, borderRadius: 13, background: 'rgba(255,255,255,.03)', border: btb.borderSoft }}>
                  {policyActive && <div style={{ color: btb.text, fontSize: 12, fontWeight: 800 }}>This link is not authorized</div>}
                  <div style={{ color: btb.textMuted, fontSize: 10.5, lineHeight: 1.5, marginTop: policyActive ? 4 : 0 }}>{policyActive ? 'Your smart account and funds are available above. Instant-trade authorization is stored separately by each website link, so this link needs its own approval.' : 'Let the BTB agent buy and sell for you in one click, with no wallet pop-up per trade. It can only swap tokens already in this account, and can never withdraw, change where funds go, or touch balances reserved for LP. Gas is on us: the agent pays the network fee.'}</div>
                  {policyActive && <div style={{ color: btb.amber, fontSize: 9, lineHeight: 1.4, marginTop: 5 }}>Authorizing this link replaces the instant-trade key saved by another link. It does not change account ownership or move funds.</div>}
                  <Button variant="success" onClick={enableInstantTrading} disabled={busy !== null} style={{ marginTop: 10, height: 36, boxShadow: 'none' }}>{busy === 'setup' ? 'Confirming setup…' : policyActive ? 'Authorize this link' : 'Enable instant trading'}</Button>
                </div>
              ) : (
            <div style={{ marginTop: 7 }}>
              {pendingOrderCount > 0 && <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 7 }}><span style={{ color: btb.amber, fontSize: 9.5, fontWeight: 800 }}>{pendingOrderCount} trade{pendingOrderCount === 1 ? '' : 's'} queued</span></div>}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 7 }}>
                <div style={{ minHeight: 72, padding: '8px 9px', boxSizing: 'border-box', borderRadius: 11, border: belowMinimum ? '1px solid rgba(255,179,107,.4)' : btb.borderSoft, background: 'rgba(255,255,255,.027)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span aria-hidden style={{ width: 6, height: 6, borderRadius: 999, background: btb.green, flexShrink: 0 }}/>
                    <span style={{ color: btb.textDim, fontSize: 8.5, fontWeight: 850, textTransform: 'uppercase', letterSpacing: .4 }}>Buy with</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(90px,.72fr)', gap: 7, marginTop: 4 }}>
                    <select aria-label="Buy with" value={buyToken} onChange={event => { setBuyToken(event.target.value); if (mode === 'buy') setTokenIn(event.target.value); }} style={{ minWidth: 0, width: '100%', height: 29, padding: '0 6px', borderRadius: 7, border: btb.borderSoft, background: 'rgba(255,255,255,.035)', color: btb.text, outline: 'none', fontFamily: 'inherit', fontSize: 10.5, fontWeight: 800, cursor: 'pointer' }}>
                      {!spendableAssets.some(asset => asset.address?.toLowerCase() === WETH.toLowerCase()) && <option value={WETH}>WETH · 0</option>}
                      {spendableAssets.map(asset => <option key={asset.address!} value={asset.address!}>{asset.symbol} · {asset.balance.toLocaleString('en-US', { maximumFractionDigits: 5 })}</option>)}
                    </select>
                    <div style={{ display: 'flex', alignItems: 'center', height: 29, padding: '0 7px', borderRadius: 7, border: btb.borderSoft, background: 'rgba(255,255,255,.035)' }}><input aria-label="Buy amount" value={buySize} onChange={event => { const next = event.target.value.replace(/[^0-9.]/g, ''); setBuySize(next); if (mode === 'buy') setAmount(next); if (Number(next) > 0) localStorage.setItem(sizeKey(state!.account), next); }} inputMode="decimal" style={{ minWidth: 0, flex: 1, height: '100%', border: 0, background: 'transparent', color: btb.text, padding: 0, outline: 'none', fontSize: 11.5, fontWeight: 800 }}/><span style={{ color: btb.textDim, fontSize: 8.5 }}>{buySymbol}</span></div>
                  </div>
                  <button disabled={!minimumBuyText} onClick={() => { if (!minimumBuyText) return; setBuySize(minimumBuyText); if (mode === 'buy') setAmount(minimumBuyText); localStorage.setItem(sizeKey(state!.account), minimumBuyText); }} style={{ border: 0, background: 'transparent', color: belowMinimum ? btb.amber : btb.textDim, padding: '4px 0 0', fontFamily: 'inherit', fontSize: 8.5, fontWeight: 750, cursor: minimumBuyText ? 'pointer' : 'default' }}>{minimumBuyText ? `Minimum ${minimumBuyText} ${buySymbol} · use` : 'Minimum shown when priced'}</button>
                </div>
                <div style={{ minHeight: 72, padding: '8px 9px', boxSizing: 'border-box', borderRadius: 11, border: sellAllAssets.length ? '1px solid rgba(255,107,122,.2)' : btb.borderSoft, background: 'rgba(255,255,255,.027)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span aria-hidden style={{ width: 6, height: 6, borderRadius: 999, background: btb.loss, flexShrink: 0 }}/>
                    <span style={{ color: btb.textDim, fontSize: 8.5, fontWeight: 850, textTransform: 'uppercase', letterSpacing: .4 }}>Sell for</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 7, marginTop: 4 }}>
                    <select aria-label="Sell into" value={sellToken} onChange={event => { setSellToken(event.target.value); if (mode === 'sell') setTokenOut(event.target.value); }} style={{ minWidth: 0, width: '100%', height: 29, padding: '0 6px', borderRadius: 7, border: btb.borderSoft, background: 'rgba(255,255,255,.035)', color: btb.text, outline: 'none', fontFamily: 'inherit', fontSize: 10.5, fontWeight: 800, cursor: 'pointer' }}>
                      <option value={WETH}>Receive WETH</option>
                      <option value={USDG}>Receive USDG</option>
                    </select>
                    <button onClick={sellAll} disabled={sellAllAssets.length === 0 || busy !== null} style={{ height: 29, padding: '0 11px', borderRadius: 7, border: sellAllAssets.length ? '1px solid rgba(255,107,122,.32)' : btb.borderSoft, background: sellAllAssets.length ? 'rgba(255,107,122,.09)' : 'rgba(255,255,255,.02)', color: sellAllAssets.length ? btb.loss : btb.textDim, fontFamily: 'inherit', fontSize: 9.5, fontWeight: 850, cursor: sellAllAssets.length ? 'pointer' : 'default', opacity: busy ? .6 : 1 }}>Sell all</button>
                  </div>
                  <div style={{ color: btb.textMuted, fontSize: 8.5, marginTop: 5 }}>{sellAllAssets.length ? `${sellAllAssets.length} eligible asset${sellAllAssets.length === 1 ? '' : 's'} · minimum $5 each` : 'No assets worth $5+'}</div>
                </div>
              </div>
            </div>
              )}
            </div>
          )}
      </Glass>
      {noticePreset && (busy === 'trade' || error || success) && <div role="status" style={{ position: 'fixed', zIndex: 1400, left: '50%', bottom: 22, transform: 'translateX(-50%)', width: 'min(440px,calc(100vw - 28px))', padding: '12px 42px 12px 14px', boxSizing: 'border-box', borderRadius: 13, border: error || latestOrder?.state === 'failed' ? '1px solid rgba(255,107,122,.35)' : '1px solid rgba(82,227,164,.3)', background: 'rgba(18,18,25,.96)', boxShadow: '0 16px 50px rgba(0,0,0,.5)', backdropFilter: 'blur(18px)', color: error || latestOrder?.state === 'failed' ? btb.loss : latestOrder?.state === 'confirmed' ? btb.green : btb.amber, fontSize: 11, fontWeight: 750, textAlign: 'center' }}>
        {busy !== 'trade' && <button aria-label="Dismiss message" onClick={dismissTradeNotice} style={{ position: 'absolute', top: 8, right: 8, width: 28, height: 28, padding: 0, borderRadius: 8, border: btb.borderSoft, background: 'rgba(255,255,255,.045)', color: btb.textMuted, fontFamily: 'inherit', fontSize: 17, lineHeight: 1, cursor: 'pointer' }}>×</button>}
        {busy === 'trade' ? `Adding ${noticePreset.symbol} trade to the queue…` : error ? <div>
          <div>{error}</div>
          {insufficientBalance && state?.deployed && <div style={{ marginTop: 9, paddingTop: 9, borderTop: btb.borderSoft }}>
            <div style={{ color: btb.textMuted, fontSize: 9.5, lineHeight: 1.45, fontWeight: 600 }}>
              Deposit below or send supported assets on Robinhood Chain to <span style={{ color: btb.text, fontWeight: 800 }}>{accountLabel}</span>. Funds remain in your smart account and only its owner can withdraw them.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginTop: 9 }}>
              <button onClick={() => { dismissTradeNotice(); setFunding('deposit'); }} style={{ height: 34, borderRadius: 9, border: '1px solid rgba(82,227,164,.32)', background: 'rgba(82,227,164,.12)', color: btb.green, fontFamily: 'inherit', fontSize: 10, fontWeight: 850, cursor: 'pointer' }}>Deposit funds</button>
              <button onClick={() => { void navigator.clipboard.writeText(state.account); setAddressCopied(true); window.setTimeout(() => setAddressCopied(false), 1600); }} style={{ height: 34, borderRadius: 9, border: btb.borderSoft, background: 'rgba(255,255,255,.04)', color: btb.text, fontFamily: 'inherit', fontSize: 10, fontWeight: 800, cursor: 'pointer' }}>{addressCopied ? 'Address copied' : 'Copy address'}</button>
            </div>
          </div>}
        </div> : latestOrder?.state === 'confirmed' ? <>Trade confirmed · <a href={`https://robinhoodchain.blockscout.com/tx/${latestOrder.txHash}`} target="_blank" rel="noopener noreferrer" style={{ color: btb.green }}>View transaction ↗</a></> : latestOrder?.state === 'failed' ? latestOrder.error || 'Trade failed' : latestOrder?.state === 'submitted' ? <>Submitted on-chain · <a href={`https://robinhoodchain.blockscout.com/tx/${latestOrder.txHash}`} target="_blank" rel="noopener noreferrer" style={{ color: btb.amber }}>View ↗</a></> : latestOrder?.state === 'preparing' ? 'Building a fresh protected route…' : `Queued · ${pendingOrderCount} pending`}
      </div>}
      {funding && state?.deployed && validOwner && (
        <ManagedFundsSheet chainId={CHAIN_ID} chainName="Robinhood Chain" owner={validOwner} account={state.account} deployment={deployment} initialMode={funding} initialWalletAssets={walletAssets} initialAccountAssets={smartAssets} onClose={() => setFunding(null)} onDone={async () => { setBalanceRefresh(value => value + 1); await load(); }}/>
      )}
    </>
  );
}
