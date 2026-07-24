'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAction, useMutation, useQuery } from 'convex/react';
import { useConfig } from 'wagmi';
import { getPublicClient } from 'wagmi/actions';
import { erc20Abi, formatUnits, isAddress, parseUnits } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { Button } from './Button';
import { Glass } from './Glass';
import { ManagedFundsSheet } from './ManagedFundsSheet';
import { btb } from './design-tokens';
import { useTx } from '../lib/TxTracker';
import { runCalls } from '../lib/txRunner';
import { useAccountAssets, useRefreshAssets } from '../lib/appData';
import {
  configureUniversalTradeCalls, createUniversalWalletCall, getUniversalWalletDeployment,
  readUniversalWallet, SPOT_TRADE_TYPES, spotTradeDomain, type SpotTradePolicy,
} from '../lib/universalWallet';

type TokenMeta = { address: `0x${string}`; symbol: string; decimals: number; balance: bigint };
type SmartState = {
  account: `0x${string}`;
  deployed: boolean;
  upgraded: boolean;
  policy: SpotTradePolicy | null;
};

export type TradePreset = {
  id: string;
  side: 'buy' | 'sell';
  address: `0x${string}`;
  symbol: string;
  imageUrl?: string;
  /** Sell only this fraction (0-1) of the holding. Omitted/1 means the full balance. */
  sellFraction?: number;
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

export type TradeStatus = { id: string; phase: 'working' | 'confirmed' | 'failed' };
export type MarketOption = { address: string; symbol: string; imageUrl?: string };

const DCA_INTERVALS: { label: string; ms: number }[] = [
  { label: 'Every 5 minutes', ms: 5 * 60_000 },
  { label: 'Every 15 minutes', ms: 15 * 60_000 },
  { label: 'Every hour', ms: 60 * 60_000 },
  { label: 'Every 6 hours', ms: 6 * 60 * 60_000 },
  { label: 'Every day', ms: 24 * 60 * 60_000 },
  { label: 'Every week', ms: 7 * 24 * 60 * 60_000 },
];
const intervalLabel = (ms: number) => DCA_INTERVALS.find(option => option.ms === ms)?.label ?? `Every ${Math.round(ms / 60_000)} min`;
function nextRunLabel(at: number): string {
  const delta = at - Date.now();
  if (delta <= 0) return 'due now';
  const minutes = Math.round(delta / 60_000);
  if (minutes < 60) return `in ${minutes} min`;
  if (minutes < 1440) return `in ${Math.round(minutes / 60)} h`;
  return `in ${Math.round(minutes / 1440)} d`;
}

export function SmartTradePanel({ owner, onConnect, presets = [], onStatus, markets = [] }: { owner?: string; onConnect?: () => void; presets?: TradePreset[]; onStatus?: (status: TradeStatus | null) => void; markets?: MarketOption[] }) {
  const config = useConfig();
  const { track } = useTx();
  const prepareTrade = useAction(api.spotTrade.prepare);
  const enqueueTrade = useAction(api.spotTrade.enqueue);
  const cancelQueued = useMutation(api.spotTradeQueue.cancelForAccount);
  const createSchedule = useAction(api.dcaActions.createSchedule);
  const setScheduleEnabled = useMutation(api.dca.setEnabled);
  const removeSchedule = useMutation(api.dca.remove);
  const deployment = getUniversalWalletDeployment();
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
  const [sellFromToken, setSellFromToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ orderId: string } | null>(null);
  const [funding, setFunding] = useState<'deposit' | 'withdraw' | null>(null);
  const [addressCopied, setAddressCopied] = useState(false);
  const [balanceRefresh, setBalanceRefresh] = useState(0);
  const executedPreset = useRef<string | null>(null);
  const handledPresets = useRef(new Set<string>());
  const lastConfirmedOrder = useRef<string | null>(null);
  const [pendingPresets, setPendingPresets] = useState<TradePreset[]>([]);
  const [preset, setPreset] = useState<TradePreset | null>(null);
  const [noticePreset, setNoticePreset] = useState<TradePreset | null>(null);
  const [tradeLabel, setTradeLabel] = useState('');
  const lastStatus = useRef('');
  const [showDca, setShowDca] = useState(false);
  const [dcaTarget, setDcaTarget] = useState('');
  const [dcaUsd, setDcaUsd] = useState('5');
  const [dcaIntervalMs, setDcaIntervalMs] = useState(24 * 60 * 60_000);
  const [dcaBusy, setDcaBusy] = useState(false);
  const [dcaError, setDcaError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!validOwner || !deployment) { setState(null); setLoading(false); return; }
    setLoading(true);
    try {
      const client = getPublicClient(config, { chainId: CHAIN_ID });
      if (!client) throw new Error('Robinhood RPC is unavailable');
      const smart = await readUniversalWallet(client, validOwner, deployment);
      if (!smart.deployed) {
        setState({ account: smart.account, deployed: false, upgraded: false, policy: null });
        return;
      }
      setState({ account: smart.account, deployed: true, upgraded: smart.upgraded, policy: smart.policy });
    } catch (reason) {
      setError((reason as Error).message || 'Could not load the smart trading account');
    } finally { setLoading(false); }
  }, [config, deployment, validOwner]);

  useEffect(() => { void load(); }, [load]);

  // Shared balances: the same cache Home, sheets, and portfolio read.
  const refreshAssets = useRefreshAssets();
  const { data: walletAssetsData, isFetching: walletAssetsFetching } = useAccountAssets(validOwner);
  const { data: smartAssetsData, isFetching: smartAssetsFetching } = useAccountAssets(state?.deployed ? state.account : undefined);
  const walletAssets = walletAssetsData ?? [];
  const smartAssets = smartAssetsData ?? [];
  const assetsLoading = walletAssetsFetching || smartAssetsFetching;
  const bumpBalances = useCallback(() => {
    setBalanceRefresh(value => value + 1);
    refreshAssets(validOwner, state?.account);
  }, [refreshAssets, state?.account, validOwner]);

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
      const fraction = preset.sellFraction && preset.sellFraction > 0 && preset.sellFraction < 1 ? preset.sellFraction : 1;
      const raw = fraction >= 1 ? inputMeta.balance : (inputMeta.balance * BigInt(Math.round(fraction * 10_000))) / 10_000n;
      setAmount(formatUnits(raw, inputMeta.decimals));
    }
  }, [amount, inputMeta, preset]);

  const parsedAmount = useMemo(() => {
    try { return inputMeta && amount && Number(amount) > 0 ? parseUnits(amount, inputMeta.decimals) : 0n; }
    catch { return 0n; }
  }, [amount, inputMeta]);

  const localKey = state ? globalThis.localStorage?.getItem(storageKey(state.account)) : null;
  const policyActive = !!state?.policy?.enabled && Number(state.policy.expiresAt) > Date.now() / 1000;
  const deviceAuthorized = !!localKey && /^0x[0-9a-fA-F]{64}$/.test(localKey)
    && !!state?.policy && privateKeyToAccount(localKey as `0x${string}`).address.toLowerCase() === state.policy.sessionSigner.toLowerCase();
  const instantReady = policyActive && deviceAuthorized
    && !!state?.policy && state.policy.agent.toLowerCase() === deployment?.agent.toLowerCase();
  const orders = useQuery(api.spotTradeQueue.listForAccount, state?.account ? { account: state.account } : 'skip');
  const schedules = useQuery(api.dca.listForAccount, state?.account ? { account: state.account } : 'skip');
  const pendingOrderCount = orders?.filter(order => ['queued', 'preparing', 'submitted'].includes(order.state)).length ?? 0;
  const queuedCount = orders?.filter(order => order.state === 'queued').length ?? 0;
  const activeScheduleCount = schedules?.filter(schedule => schedule.enabled).length ?? 0;
  const latestOrder = success ? orders?.find(order => String(order._id) === success.orderId) : undefined;
  const spendableAssets = smartAssets.filter(asset => !asset.native && asset.address && asset.balance > 0);
  const selectedBuyAsset = spendableAssets.find(asset => asset.address?.toLowerCase() === buyToken.toLowerCase());
  const buySymbol = selectedBuyAsset?.symbol || (buyToken.toLowerCase() === WETH.toLowerCase() ? 'WETH' : inputMeta?.symbol || 'TOKEN');
  const minimumBuyAmount = selectedBuyAsset?.priceUsd ? 5.1 / selectedBuyAsset.priceUsd : null;
  const minimumBuyText = minimumBuyAmount ? (Math.ceil(minimumBuyAmount * 1e8) / 1e8).toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 8 }) : null;
  // Human-readable form of the minimum — the precise minimumBuyText can be a
  // 15-digit number for cheap tokens, which looks broken in a button.
  const minimumBuyDisplay = minimumBuyAmount ? minimumBuyAmount.toLocaleString('en-US', { maximumFractionDigits: minimumBuyAmount >= 1000 ? 0 : minimumBuyAmount >= 1 ? 2 : 6 }) : null;
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
    bumpBalances();
    const retries = [2_000, 5_000, 10_000, 20_000].map(delay => window.setTimeout(bumpBalances, delay));
    return () => retries.forEach(window.clearTimeout);
  }, [orders]);

  // Report the active trade's progress up to the market list so the button the
  // user tapped can show "Buying…" and stop them from firing duplicate orders.
  useEffect(() => {
    let next: TradeStatus | null = null;
    if (noticePreset) {
      const state = latestOrder?.state;
      const phase = error || state === 'failed' ? 'failed' : state === 'confirmed' ? 'confirmed' : 'working';
      next = { id: noticePreset.id, phase };
    }
    const key = next ? `${next.id}:${next.phase}` : '';
    if (key === lastStatus.current) return;
    lastStatus.current = key;
    onStatus?.(next);
  }, [noticePreset, latestOrder, error, onStatus]);

  async function enableInstantTrading() {
    if (!validOwner || !deployment || !state) { onConnect?.(); return; }
    setBusy('setup'); setError(null); setSuccess(null);
    const requestKey = generatePrivateKey();
    const sessionSigner = privateKeyToAccount(requestKey).address;
    const expiresAt = BigInt(Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60);
    try {
      await runCalls(config, {
        account: validOwner,
        chainId: CHAIN_ID,
        track,
        label: 'Enable BTB instant trading',
        calls: [
          ...(state.deployed ? [] : [createUniversalWalletCall(deployment, validOwner)]),
          ...configureUniversalTradeCalls({
            account: state.account,
            deployment,
            sessionSigner,
            expiresAt,
            needsUpgrade: !state.upgraded,
          }),
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
    const spent = compact(parsedAmount, inputMeta.decimals);
    setTradeLabel(preset.side === 'buy'
      ? `Buying ${outputMeta.symbol} with ${spent} ${inputMeta.symbol}`
      : `Selling ${spent} ${inputMeta.symbol} for ${outputMeta.symbol}`);
    setBusy('trade'); setError(null); setSuccess(null);
    try {
      const prepared = await prepareTrade({
        chainId: CHAIN_ID,
        account: state.account,
        tokenIn: inputMeta.address,
        tokenOut: outputMeta.address,
        amountIn: parsedAmount.toString(),
        sessionSigner: privateKeyToAccount(localKey as `0x${string}`).address,
      });
      const session = privateKeyToAccount(localKey as `0x${string}`);
      const signature = await session.signTypedData({
        domain: spotTradeDomain(state.account),
        types: SPOT_TRADE_TYPES,
        primaryType: 'SpotTrade',
        message: {
          tokenIn: inputMeta.address,
          tokenOut: outputMeta.address,
          amountIn: parsedAmount,
          minimumGrossOutput: BigInt(prepared.minimumGrossOutput),
          nonce: BigInt(prepared.nonce),
          deadline: BigInt(prepared.deadline),
        },
      });
      const result = await enqueueTrade({
        orderKey: `spot:${state.account.toLowerCase()}:${preset.id}`,
        chainId: CHAIN_ID,
        account: state.account,
        tokenIn: inputMeta.address,
        tokenOut: outputMeta.address,
        amountIn: parsedAmount.toString(),
        minimumGrossOutput: prepared.minimumGrossOutput,
        nonce: prepared.nonce,
        deadline: prepared.deadline,
        sessionSignature: signature,
      });
      setSuccess({ orderId: String(result.id) });
      setAmount('');
    } catch (reason) { setError((reason as Error).message || 'The BTB agent could not queue this trade'); }
    finally { setBusy(null); setPreset(null); }
  }

  // Sell a chosen fraction (0-1) of one held token into the receive token.
  function sellPartial(fraction: number) {
    if (!instantReady) return;
    const asset = spendableAssets.find(item => item.address?.toLowerCase() === sellFromToken.toLowerCase()) ?? spendableAssets[0];
    if (!asset?.address) return;
    setPendingPresets(current => [...current, {
      id: `sell:${Date.now()}:${fraction}:${asset.address!.toLowerCase()}`,
      side: 'sell' as const,
      address: asset.address as `0x${string}`,
      symbol: asset.symbol,
      imageUrl: asset.imageUrl,
      sellFraction: fraction,
    }]);
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

  async function startSchedule() {
    if (!state?.deployed || !validOwner || !localKey) { setDcaError('This device is not authorized yet'); return; }
    const target = markets.find(market => market.address.toLowerCase() === dcaTarget.toLowerCase());
    const usd = Number(dcaUsd);
    if (!target) { setDcaError('Pick a token to buy'); return; }
    if (!(usd >= 5)) { setDcaError('Each buy must be at least $5'); return; }
    setDcaBusy(true); setDcaError(null);
    try {
      await createSchedule({
        account: state.account, owner: validOwner, chainId: CHAIN_ID,
        tokenIn: buyToken, tokenOut: target.address,
        tokenInSymbol: buySymbol, tokenOutSymbol: target.symbol, tokenOutImage: target.imageUrl,
        amountUsd: usd, intervalMs: dcaIntervalMs, requestKey: localKey,
      });
      setDcaTarget('');
    } catch (reason) { setDcaError((reason as Error).message || 'Could not start the recurring buy'); }
    finally { setDcaBusy(false); }
  }

  async function toggleSchedule(scheduleId: Id<'spotTradeSchedules'>, enabled: boolean) {
    if (!localKey) return;
    try { await setScheduleEnabled({ scheduleId, requestKey: localKey, enabled }); } catch { /* reactive list reflects the truth */ }
  }

  async function deleteSchedule(scheduleId: Id<'spotTradeSchedules'>) {
    if (!localKey) return;
    try { await removeSchedule({ scheduleId, requestKey: localKey }); } catch { /* reactive list reflects the truth */ }
  }

  // Re-run the trade the user just confirmed, reusing the same token, side and
  // amount — the deliberate "buy again", separate from an accidental re-tap.
  function repeatTrade() {
    if (!noticePreset || busy !== null) return;
    const again = { ...noticePreset, id: `${noticePreset.side}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}` };
    dismissTradeNotice();
    setPendingPresets(current => [...current, again]);
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
      setError(`Minimum buy is ${minimumBuyText} ${buySymbol} (about $5). Update the amount above and tap Buy again.`);
      setPreset(null);
      return;
    }
    const sellAsset = preset.side === 'sell' ? smartAssets.find(asset => asset.address?.toLowerCase() === preset.address.toLowerCase()) : null;
    const sellFraction = preset.sellFraction && preset.sellFraction > 0 && preset.sellFraction < 1 ? preset.sellFraction : 1;
    const sellValueUsd = sellAsset ? sellAsset.usdValue * sellFraction : 0;
    if (sellAsset?.priceUsd && sellValueUsd < 5) {
      executedPreset.current = preset.id;
      setError(`${sellFraction < 1 ? `Selling ${Math.round(sellFraction * 100)}% of ${sellAsset.symbol}` : `${sellAsset.symbol} balance`} is worth ${sellValueUsd.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}. Instant trades require at least $5${sellFraction < 1 ? ' — sell a larger share' : ''}.`);
      setPreset(null);
      return;
    }
    if (parsedAmount > inputMeta.balance) {
      executedPreset.current = preset.id;
      setError(`Not enough ${inputMeta.symbol}. Smart account balance: ${compact(inputMeta.balance, inputMeta.decimals)} ${inputMeta.symbol}.`);
      setPreset(null);
      return;
    }
    if (parsedAmount <= 0n) {
      // A sell auto-fills its amount from the balance a tick after the token
      // resolves — don't mistake that gap for an empty account. Only bail when
      // the balance itself is genuinely zero; otherwise wait for the fill.
      if (preset.side === 'sell' && inputMeta.balance > 0n) return;
      executedPreset.current = preset.id;
      setError(preset.side === 'sell' ? `No available ${inputMeta.symbol} to dump.` : 'Set a buy amount first.');
      setPreset(null);
      return;
    }
    executedPreset.current = preset.id;
    void trade();
  }, [belowMinimum, busy, buySymbol, buyToken, inputMeta, instantReady, minimumBuyText, outputMeta, parsedAmount, preset, sellToken, smartAssets]);

  if (!deployment) return null;
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                    <span style={{ color: btb.green, fontSize: 9.5, fontWeight: 850, textTransform: 'uppercase', letterSpacing: .3 }}>Smart account</span>
                    <span style={{ color: btb.textDim, fontSize: 9, fontWeight: 700 }}>{accountLabel}</span>
                  </div>
                  {assetsLoading && walletAssets.length === 0 && smartAssets.length === 0
                    ? <span style={{ color: btb.textMuted, fontSize: 10.5, fontWeight: 600 }}>Loading balances…</span>
                    : <div style={{ display: 'flex', gap: 16 }}>
                        <div>
                          <div style={{ color: btb.textDim, fontSize: 8, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .4 }}>Account</div>
                          <div style={{ color: btb.text, fontSize: 13, fontWeight: 850, marginTop: 1 }}>{usd(smartUsd)}</div>
                        </div>
                        <div>
                          <div style={{ color: btb.textDim, fontSize: 8, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .4 }}>Wallet</div>
                          <div style={{ color: btb.text, fontSize: 13, fontWeight: 850, marginTop: 1 }}>{usd(walletUsd)}</div>
                        </div>
                        {assetsLoading && <span style={{ alignSelf: 'flex-end', color: btb.textDim, fontSize: 8.5 }}>refreshing…</span>}
                      </div>}
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => setFunding('deposit')} style={{ height: 32, padding: '0 13px', borderRadius: 9, border: '1px solid rgba(82,227,164,.34)', background: 'rgba(82,227,164,.12)', color: btb.green, fontFamily: 'inherit', fontSize: 10.5, fontWeight: 850, cursor: 'pointer' }}>Deposit</button>
                  <button onClick={() => setFunding('withdraw')} style={{ height: 32, padding: '0 13px', borderRadius: 9, border: btb.borderSoft, background: 'rgba(255,255,255,.04)', color: btb.text, fontFamily: 'inherit', fontSize: 10.5, fontWeight: 800, cursor: 'pointer' }}>Withdraw</button>
                </div>
              </div>
              {!instantReady ? (
                <div style={{ marginTop: 7, padding: 12, borderRadius: 13, background: 'rgba(255,255,255,.03)', border: btb.borderSoft }}>
                  {policyActive && <div style={{ color: btb.text, fontSize: 12, fontWeight: 800 }}>This link is not authorized</div>}
                  <div style={{ color: btb.textMuted, fontSize: 10.5, lineHeight: 1.5, marginTop: policyActive ? 4 : 0 }}>{policyActive ? 'Your smart account and funds are available above. Instant-trade authorization is stored separately by each website link, so this link needs its own approval.' : 'Let the BTB agent buy and sell for you in one click, with no wallet pop-up per trade. Every click signs the exact tokens and protected minimum locally; the agent cannot withdraw your funds. A fixed 10% of received tokens goes to BTB.'}</div>
                  {policyActive && <div style={{ color: btb.amber, fontSize: 9, lineHeight: 1.4, marginTop: 5 }}>Authorizing this link replaces the instant-trade key saved by another link. It does not change account ownership or move funds.</div>}
                  <Button variant="success" onClick={enableInstantTrading} disabled={busy !== null} style={{ marginTop: 10, height: 36, boxShadow: 'none' }}>{busy === 'setup' ? 'Confirming setup…' : policyActive ? 'Authorize this link' : 'Enable instant trading'}</Button>
                </div>
              ) : (
            <div style={{ marginTop: 7 }}>
              <div style={{ marginBottom: 7, color: btb.textDim, fontSize: 9, fontWeight: 700 }}>KyberSwap best route · 5% price protection · 10% of received tokens to BTB · agent pays gas</div>
              {pendingOrderCount > 0 && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 7, padding: '7px 9px', borderRadius: 9, border: '1px solid rgba(255,179,107,.28)', background: 'rgba(255,179,107,.09)' }}>
                <span style={{ color: btb.amber, fontSize: 9.5, fontWeight: 750, lineHeight: 1.4 }}>{pendingOrderCount} trade{pendingOrderCount === 1 ? '' : 's'} waiting{queuedCount > 0 ? ' · fund the account or they auto-cancel in 5 min' : ''}</span>
                {queuedCount > 0 && state?.account && <button onClick={async () => { try { await cancelQueued({ account: state.account }); } catch { /* reactive list will reflect the real state */ } }} style={{ flexShrink: 0, height: 26, padding: '0 10px', borderRadius: 7, border: '1px solid rgba(255,107,122,.32)', background: 'rgba(255,107,122,.1)', color: btb.loss, fontFamily: 'inherit', fontSize: 9, fontWeight: 850, cursor: 'pointer' }}>Cancel all</button>}
              </div>}
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
                  <button disabled={!minimumBuyText} onClick={() => { if (!minimumBuyText) return; setBuySize(minimumBuyText); if (mode === 'buy') setAmount(minimumBuyText); localStorage.setItem(sizeKey(state!.account), minimumBuyText); }} style={{ alignSelf: 'flex-start', marginTop: 6, height: 26, padding: '0 10px', borderRadius: 7, border: belowMinimum ? '1px solid rgba(255,179,107,.45)' : btb.borderSoft, background: belowMinimum ? 'rgba(255,179,107,.13)' : 'rgba(255,255,255,.04)', color: belowMinimum ? btb.amber : btb.textMuted, fontFamily: 'inherit', fontSize: 9, fontWeight: 800, cursor: minimumBuyText ? 'pointer' : 'default', opacity: minimumBuyText ? 1 : .55 }}>{minimumBuyText ? `Use minimum · ${minimumBuyDisplay} ${buySymbol}` : 'Minimum shown when priced'}</button>
                </div>
                <div style={{ minHeight: 72, padding: '8px 9px', boxSizing: 'border-box', borderRadius: 11, border: sellAllAssets.length ? '1px solid rgba(255,107,122,.2)' : btb.borderSoft, background: 'rgba(255,255,255,.027)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span aria-hidden style={{ width: 6, height: 6, borderRadius: 999, background: btb.loss, flexShrink: 0 }}/>
                    <span style={{ color: btb.textDim, fontSize: 8.5, fontWeight: 850, textTransform: 'uppercase', letterSpacing: .4 }}>Sell</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,.82fr)', gap: 7, marginTop: 4 }}>
                    <select aria-label="Sell which token" value={sellFromToken || spendableAssets[0]?.address || ''} onChange={event => setSellFromToken(event.target.value)} disabled={spendableAssets.length === 0} style={{ minWidth: 0, width: '100%', height: 29, padding: '0 6px', borderRadius: 7, border: btb.borderSoft, background: 'rgba(255,255,255,.035)', color: btb.text, outline: 'none', fontFamily: 'inherit', fontSize: 10.5, fontWeight: 800, cursor: 'pointer' }}>
                      {spendableAssets.length === 0 && <option value="">No tokens held</option>}
                      {spendableAssets.map(asset => <option key={asset.address!} value={asset.address!}>{asset.symbol} · {asset.balance.toLocaleString('en-US', { maximumFractionDigits: 5 })}</option>)}
                    </select>
                    <select aria-label="Sell into" value={sellToken} onChange={event => { setSellToken(event.target.value); if (mode === 'sell') setTokenOut(event.target.value); }} style={{ minWidth: 0, width: '100%', height: 29, padding: '0 6px', borderRadius: 7, border: btb.borderSoft, background: 'rgba(255,255,255,.035)', color: btb.text, outline: 'none', fontFamily: 'inherit', fontSize: 10.5, fontWeight: 800, cursor: 'pointer' }}>
                      <option value={WETH}>for WETH</option>
                      <option value={USDG}>for USDG</option>
                    </select>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5, marginTop: 6 }}>
                    {[25, 50, 100].map(pct => (
                      <button key={pct} onClick={() => sellPartial(pct / 100)} disabled={spendableAssets.length === 0 || busy !== null} style={{ height: 28, borderRadius: 7, border: '1px solid rgba(255,107,122,.28)', background: spendableAssets.length ? 'rgba(255,107,122,.08)' : 'rgba(255,255,255,.02)', color: spendableAssets.length ? btb.loss : btb.textDim, fontFamily: 'inherit', fontSize: 10, fontWeight: 850, cursor: spendableAssets.length ? 'pointer' : 'default', opacity: busy ? .6 : 1 }}>{pct === 100 ? 'Max' : `${pct}%`}</button>
                    ))}
                  </div>
                  <button onClick={sellAll} disabled={sellAllAssets.length === 0 || busy !== null} style={{ width: '100%', marginTop: 6, height: 28, borderRadius: 7, border: sellAllAssets.length ? '1px solid rgba(255,107,122,.3)' : btb.borderSoft, background: sellAllAssets.length ? 'rgba(255,107,122,.09)' : 'rgba(255,255,255,.03)', color: sellAllAssets.length ? btb.loss : btb.textDim, fontFamily: 'inherit', fontSize: 9.5, fontWeight: 800, cursor: sellAllAssets.length ? 'pointer' : 'default', opacity: busy ? .6 : 1 }}>{sellAllAssets.length ? `Sell all ${sellAllAssets.length} tokens · min $5 each` : 'No assets worth $5+'}</button>
                </div>
              </div>

              {false && <div style={{ marginTop: 8, padding: '9px 10px', boxSizing: 'border-box', borderRadius: 11, border: btb.borderSoft, background: 'rgba(255,255,255,.02)' }}>
                <button onClick={() => setShowDca(value => !value)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, border: 0, background: 'transparent', padding: 0, color: btb.text, fontFamily: 'inherit', cursor: 'pointer' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span aria-hidden style={{ width: 6, height: 6, borderRadius: 999, background: btb.amber, flexShrink: 0 }}/>
                    <span style={{ fontSize: 10.5, fontWeight: 850 }}>Recurring buy{activeScheduleCount > 0 ? ` · ${activeScheduleCount} active` : ''}</span>
                  </span>
                  <span style={{ color: btb.textDim, fontSize: 9, fontWeight: 800 }}>{showDca ? 'Hide' : 'Set up'}</span>
                </button>

                {showDca && <div style={{ marginTop: 9 }}>
                  <div style={{ color: btb.textMuted, fontSize: 9.5, lineHeight: 1.45, marginBottom: 8 }}>Auto-buy a token on a schedule from funds in this account. The agent sizes each buy to your dollar amount and pays the gas. Keep the account funded, or a run fails and retries next time.</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 6 }}>
                    <select aria-label="Token to buy" value={dcaTarget} onChange={event => setDcaTarget(event.target.value)} style={{ minWidth: 0, height: 30, padding: '0 7px', borderRadius: 7, border: btb.borderSoft, background: 'rgba(255,255,255,.035)', color: btb.text, outline: 'none', fontFamily: 'inherit', fontSize: 10.5, fontWeight: 800, cursor: 'pointer' }}>
                      <option value="">Buy which token…</option>
                      {markets.map(market => <option key={market.address} value={market.address}>{market.symbol}</option>)}
                    </select>
                    <select aria-label="Fund with" value={buyToken} onChange={event => { setBuyToken(event.target.value); if (mode === 'buy') setTokenIn(event.target.value); }} style={{ minWidth: 0, height: 30, padding: '0 7px', borderRadius: 7, border: btb.borderSoft, background: 'rgba(255,255,255,.035)', color: btb.text, outline: 'none', fontFamily: 'inherit', fontSize: 10.5, fontWeight: 800, cursor: 'pointer' }}>
                      {!spendableAssets.some(asset => asset.address?.toLowerCase() === WETH.toLowerCase()) && <option value={WETH}>with WETH</option>}
                      {spendableAssets.map(asset => <option key={asset.address!} value={asset.address!}>with {asset.symbol}</option>)}
                    </select>
                    <div style={{ display: 'flex', alignItems: 'center', height: 30, padding: '0 8px', borderRadius: 7, border: btb.borderSoft, background: 'rgba(255,255,255,.035)' }}>
                      <span style={{ color: btb.textDim, fontSize: 11, fontWeight: 800 }}>$</span>
                      <input aria-label="Dollar amount per buy" value={dcaUsd} onChange={event => setDcaUsd(event.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" style={{ minWidth: 0, flex: 1, height: '100%', border: 0, background: 'transparent', color: btb.text, padding: '0 0 0 3px', outline: 'none', fontSize: 11.5, fontWeight: 800 }}/>
                      <span style={{ color: btb.textDim, fontSize: 8.5 }}>each</span>
                    </div>
                    <select aria-label="How often" value={dcaIntervalMs} onChange={event => setDcaIntervalMs(Number(event.target.value))} style={{ minWidth: 0, height: 30, padding: '0 7px', borderRadius: 7, border: btb.borderSoft, background: 'rgba(255,255,255,.035)', color: btb.text, outline: 'none', fontFamily: 'inherit', fontSize: 10.5, fontWeight: 800, cursor: 'pointer' }}>
                      {DCA_INTERVALS.map(option => <option key={option.ms} value={option.ms}>{option.label}</option>)}
                    </select>
                  </div>
                  <button onClick={startSchedule} disabled={dcaBusy || !dcaTarget} style={{ width: '100%', marginTop: 8, height: 32, borderRadius: 8, border: '1px solid rgba(255,179,107,.4)', background: dcaTarget ? 'rgba(255,179,107,.14)' : 'rgba(255,255,255,.03)', color: dcaTarget ? btb.amber : btb.textDim, fontFamily: 'inherit', fontSize: 10.5, fontWeight: 850, cursor: dcaBusy || !dcaTarget ? 'default' : 'pointer', opacity: dcaBusy ? .6 : 1 }}>{dcaBusy ? 'Starting…' : 'Start recurring buy'}</button>
                  {dcaError && <div style={{ marginTop: 7, color: btb.loss, fontSize: 9.5, fontWeight: 700, lineHeight: 1.4 }}>{dcaError}</div>}
                </div>}

                {!!schedules?.length && <div style={{ marginTop: 9, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {schedules?.map(schedule => <div key={schedule._id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px', borderRadius: 8, border: btb.borderSoft, background: 'rgba(255,255,255,.025)' }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ color: btb.text, fontSize: 10, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>${schedule.amountUsd.toLocaleString('en-US')} {schedule.tokenOutSymbol} · {intervalLabel(schedule.intervalMs)}</div>
                      <div style={{ color: schedule.lastError ? btb.loss : btb.textDim, fontSize: 8.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{schedule.enabled ? `next ${nextRunLabel(schedule.nextRunAt)}` : 'paused'} · {schedule.runsCompleted} done{schedule.lastError ? ` · ${schedule.lastError}` : ''}</div>
                    </div>
                    <button onClick={() => toggleSchedule(schedule._id, !schedule.enabled)} style={{ flexShrink: 0, height: 25, padding: '0 9px', borderRadius: 7, border: btb.borderSoft, background: 'rgba(255,255,255,.04)', color: btb.textMuted, fontFamily: 'inherit', fontSize: 9, fontWeight: 800, cursor: 'pointer' }}>{schedule.enabled ? 'Pause' : 'Resume'}</button>
                    <button onClick={() => deleteSchedule(schedule._id)} aria-label="Delete recurring buy" style={{ flexShrink: 0, height: 25, padding: '0 9px', borderRadius: 7, border: '1px solid rgba(255,107,122,.28)', background: 'rgba(255,107,122,.08)', color: btb.loss, fontFamily: 'inherit', fontSize: 9, fontWeight: 800, cursor: 'pointer' }}>Delete</button>
                  </div>)}
                </div>}
              </div>}
            </div>
              )}
            </div>
          )}
      </Glass>
      {noticePreset && (busy === 'trade' || error || success) && <div role="status" style={{ position: 'fixed', zIndex: 1400, left: '50%', bottom: 22, transform: 'translateX(-50%)', width: 'min(440px,calc(100vw - 28px))', padding: '12px 42px 12px 14px', boxSizing: 'border-box', borderRadius: 13, border: error || latestOrder?.state === 'failed' ? '1px solid rgba(255,107,122,.35)' : '1px solid rgba(82,227,164,.3)', background: 'rgba(18,18,25,.96)', boxShadow: '0 16px 50px rgba(0,0,0,.5)', backdropFilter: 'blur(18px)', color: error || latestOrder?.state === 'failed' ? btb.loss : latestOrder?.state === 'confirmed' ? btb.green : btb.amber, fontSize: 11, fontWeight: 750, textAlign: 'center' }}>
        {busy !== 'trade' && <button aria-label="Dismiss message" onClick={dismissTradeNotice} style={{ position: 'absolute', top: 8, right: 8, width: 28, height: 28, padding: 0, borderRadius: 8, border: btb.borderSoft, background: 'rgba(255,255,255,.045)', color: btb.textMuted, fontFamily: 'inherit', fontSize: 17, lineHeight: 1, cursor: 'pointer' }}>×</button>}
        {busy === 'trade' ? `${tradeLabel || `Buying ${noticePreset.symbol}`}…` : error ? <div>
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
        </div> : latestOrder?.state === 'confirmed' ? <div>
          <div>Trade confirmed · <a href={`https://robinhoodchain.blockscout.com/tx/${latestOrder.txHash}`} target="_blank" rel="noopener noreferrer" style={{ color: btb.green }}>View transaction ↗</a></div>
          <button onClick={repeatTrade} disabled={busy !== null} style={{ marginTop: 9, height: 32, padding: '0 14px', borderRadius: 9, border: '1px solid rgba(82,227,164,.32)', background: 'rgba(82,227,164,.12)', color: btb.green, fontFamily: 'inherit', fontSize: 10.5, fontWeight: 850, cursor: busy ? 'default' : 'pointer' }}>{noticePreset.side === 'buy' ? `Buy ${noticePreset.symbol} again` : `Sell more ${noticePreset.symbol}`}</button>
        </div> : latestOrder?.state === 'failed' ? latestOrder.error || 'Trade failed' : latestOrder?.state === 'submitted' ? <>Submitted on-chain · <a href={`https://robinhoodchain.blockscout.com/tx/${latestOrder.txHash}`} target="_blank" rel="noopener noreferrer" style={{ color: btb.amber }}>View ↗</a></> : latestOrder?.state === 'preparing' ? 'Building a fresh protected route…' : `Queued · ${pendingOrderCount} pending`}
      </div>}
      {funding && state?.deployed && validOwner && (
        <ManagedFundsSheet chainId={CHAIN_ID} chainName="Robinhood Chain" owner={validOwner} account={state.account} deployment={{}} universal initialMode={funding} initialWalletAssets={walletAssets} initialAccountAssets={smartAssets} onClose={() => setFunding(null)} onDone={async () => { bumpBalances(); await load(); }}/>
      )}
    </>
  );
}
