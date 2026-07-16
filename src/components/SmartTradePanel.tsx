'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAction } from 'convex/react';
import { useConfig } from 'wagmi';
import { getPublicClient } from 'wagmi/actions';
import { erc20Abi, formatUnits, isAddress, keccak256, parseUnits, toHex, zeroAddress, type Hex } from 'viem';
import { api } from '../../convex/_generated/api';
import { Badge } from './Badge';
import { Button } from './Button';
import { Glass } from './Glass';
import { ManagedFundsSheet } from './ManagedFundsSheet';
import { TokenIcon } from './TokenIcon';
import { btb } from './design-tokens';
import { useTx } from '../lib/TxTracker';
import { runCalls } from '../lib/txRunner';
import {
  BTB_AGENT_REGISTRY_ABI, configureAgentCall, configureTradePolicyCall, createAccountCall,
  getSmartAccountDeployment, readSmartAccount, revokeTradePolicyCall, shortAddress,
  type TradePolicy,
} from '../lib/smartAccount';

type TokenMeta = { address: `0x${string}`; symbol: string; decimals: number; balance: bigint };
type SmartState = {
  account: `0x${string}`;
  deployed: boolean;
  roles: number;
  policy: TradePolicy | null;
};

const CHAIN_ID = 4663 as const;
const storageKey = (account: string) => `btb:instant-trade:${CHAIN_ID}:${account.toLowerCase()}`;

function compact(raw: bigint, decimals: number) {
  const value = Number(formatUnits(raw, decimals));
  if (value === 0) return '0';
  if (value < 0.0001) return value.toExponential(2);
  return value.toLocaleString('en-US', { maximumFractionDigits: 6 });
}

export function SmartTradePanel({ owner, onConnect }: { owner?: string; onConnect?: () => void }) {
  const config = useConfig();
  const { track } = useTx();
  const executeTrade = useAction(api.spotTrade.execute);
  const deployment = getSmartAccountDeployment(CHAIN_ID);
  const validOwner = owner && isAddress(owner) ? owner as `0x${string}` : null;
  const [state, setState] = useState<SmartState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'setup' | 'trade' | 'revoke' | null>(null);
  const [mode, setMode] = useState<'buy' | 'sell'>('buy');
  const [tokenIn, setTokenIn] = useState('');
  const [tokenOut, setTokenOut] = useState('');
  const [inputMeta, setInputMeta] = useState<TokenMeta | null>(null);
  const [outputMeta, setOutputMeta] = useState<TokenMeta | null>(null);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ hash: string; net: string } | null>(null);
  const [funding, setFunding] = useState(false);
  const [balanceRefresh, setBalanceRefresh] = useState(0);

  const load = useCallback(async () => {
    if (!validOwner || !deployment?.agentRegistry) { setState(null); setLoading(false); return; }
    setLoading(true);
    try {
      const client = getPublicClient(config, { chainId: CHAIN_ID });
      if (!client) throw new Error('Robinhood RPC is unavailable');
      const smart = await readSmartAccount(client, validOwner, deployment);
      if (!smart.deployed) {
        setState({ account: smart.account, deployed: false, roles: 0, policy: null });
        return;
      }
      const [roles, rawPolicy] = await Promise.all([
        client.readContract({ address: deployment.agentRegistry, abi: BTB_AGENT_REGISTRY_ABI, functionName: 'agentRoles', args: [smart.account, deployment.agent] }).catch(() => 0),
        client.readContract({ address: deployment.agentRegistry, abi: BTB_AGENT_REGISTRY_ABI, functionName: 'tradePolicies', args: [smart.account] }).catch(() => null),
      ]);
      const policy: TradePolicy | null = rawPolicy ? {
        enabled: rawPolicy[0], agent: rawPolicy[1], requestKeyHash: rawPolicy[2],
        maximumBalanceBpsPerTrade: Number(rawPolicy[3]), maximumSlippageBps: Number(rawPolicy[4]),
        maximumSpotTwapDeviationBps: Number(rawPolicy[5]), minimumTwapSeconds: Number(rawPolicy[6]),
        expiresAt: rawPolicy[7],
      } : null;
      setState({ account: smart.account, deployed: true, roles: Number(roles), policy });
    } catch (reason) {
      setError((reason as Error).message || 'Could not load the smart trading account');
    } finally { setLoading(false); }
  }, [config, deployment, validOwner]);

  useEffect(() => { void load(); }, [load]);

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

  const parsedAmount = useMemo(() => {
    try { return inputMeta && amount && Number(amount) > 0 ? parseUnits(amount, inputMeta.decimals) : 0n; }
    catch { return 0n; }
  }, [amount, inputMeta]);

  const localKey = state ? globalThis.localStorage?.getItem(storageKey(state.account)) : null;
  const policyActive = !!state?.policy?.enabled && Number(state.policy.expiresAt) > Date.now() / 1000;
  const deviceAuthorized = !!localKey && /^0x[0-9a-fA-F]{64}$/.test(localKey)
    && !!state?.policy && keccak256(localKey as Hex).toLowerCase() === state.policy.requestKeyHash.toLowerCase();
  const instantReady = policyActive && deviceAuthorized && !!(state.roles & 16);

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

  async function revokeInstantTrading() {
    if (!validOwner || !deployment || !state?.deployed) return;
    setBusy('revoke'); setError(null);
    try {
      await runCalls(config, { account: validOwner, chainId: CHAIN_ID, track, label: 'Disable BTB instant trading', calls: [revokeTradePolicyCall(deployment, state.account)] });
      localStorage.removeItem(storageKey(state.account));
      await load();
    } catch (reason) { setError((reason as { shortMessage?: string }).shortMessage || (reason as Error).message || 'Could not disable instant trading'); }
    finally { setBusy(null); }
  }

  async function trade() {
    if (!state || !inputMeta || !outputMeta || !localKey || parsedAmount <= 0n || parsedAmount > inputMeta.balance) return;
    setBusy('trade'); setError(null); setSuccess(null);
    try {
      const result = await executeTrade({
        chainId: CHAIN_ID,
        account: state.account,
        tokenIn: inputMeta.address,
        tokenOut: outputMeta.address,
        amountIn: parsedAmount.toString(),
        requestKey: localKey,
      });
      setSuccess({ hash: result.hash, net: compact(BigInt(result.netAmountOut), outputMeta.decimals) });
      setAmount('');
      setBalanceRefresh(value => value + 1);
      await load();
    } catch (reason) { setError((reason as Error).message || 'The BTB agent could not execute this trade'); }
    finally { setBusy(null); }
  }

  if (!deployment?.agentRegistry) return null;
  return (
    <>
      <Glass padding={16} radius={18} strong style={{ overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ color: btb.text, fontSize: 16, fontWeight: 850 }}>Instant smart-account trades</div>
            <div style={{ color: btb.textMuted, fontSize: 11, marginTop: 3 }}>Fund once. Buy or sell through the BTB agent without another wallet popup.</div>
          </div>
          {state && <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <Badge size="sm" border="none" bg={instantReady ? 'rgba(82,227,164,.13)' : 'rgba(255,255,255,.06)'} color={instantReady ? btb.green : btb.textMuted}>{instantReady ? 'Instant on' : state.deployed ? 'Setup needed' : 'Not created'}</Badge>
            <a href={`https://robinhoodchain.blockscout.com/address/${state.account}`} target="_blank" rel="noopener noreferrer" style={{ color: btb.textDim, fontSize: 10, textDecoration: 'none' }}>{shortAddress(state.account)} ↗</a>
          </div>}
        </div>

        {!validOwner ? <Button variant="success" onClick={onConnect} style={{ marginTop: 13 }}>Connect wallet</Button>
          : loading ? <div style={{ color: btb.textMuted, fontSize: 11, marginTop: 13 }}>Loading smart account…</div>
          : !instantReady ? (
            <div style={{ marginTop: 13, padding: 12, borderRadius: 13, background: 'rgba(255,255,255,.03)', border: btb.borderSoft }}>
              <div style={{ color: btb.text, fontSize: 12, fontWeight: 800 }}>One-time permission</div>
              <div style={{ color: btb.textMuted, fontSize: 10.5, lineHeight: 1.5, marginTop: 4 }}>The agent may swap available tokens inside this account. It cannot withdraw, change the receiver or spend funds reserved for LP instructions. Every received token pays a fixed 10% BTB fee.</div>
              <Button variant="success" onClick={enableInstantTrading} disabled={busy !== null} style={{ marginTop: 10, height: 36, boxShadow: 'none' }}>{busy === 'setup' ? 'Confirming setup…' : policyActive ? 'Authorize this device' : 'Enable instant trading'}</Button>
            </div>
          ) : (
            <div style={{ marginTop: 13 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, maxWidth: 260 }}>
                {(['buy', 'sell'] as const).map(value => <button key={value} onClick={() => setMode(value)} style={{ height: 34, borderRadius: 10, border: mode === value ? '1px solid rgba(82,227,164,.45)' : btb.borderSoft, background: mode === value ? 'rgba(82,227,164,.1)' : 'rgba(255,255,255,.025)', color: mode === value ? btb.green : btb.textMuted, fontFamily: 'inherit', fontSize: 11, fontWeight: 800, textTransform: 'capitalize', cursor: 'pointer' }}>{value}</button>)}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 8, marginTop: 9 }}>
                <div style={{ padding: 10, borderRadius: 12, background: 'rgba(255,255,255,.03)', border: btb.borderSoft }}>
                  <div style={{ color: btb.textDim, fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .45 }}>Pay token contract</div>
                  <input value={tokenIn} onChange={event => { setTokenIn(event.target.value); setAmount(''); }} placeholder="0x…" spellCheck={false} style={{ width: '100%', boxSizing: 'border-box', height: 34, marginTop: 5, padding: '0 8px', borderRadius: 8, border: btb.borderSoft, background: 'rgba(255,255,255,.035)', color: btb.text, outline: 'none', fontFamily: 'monospace', fontSize: 10.5 }}/>
                  {inputMeta && <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 8 }}><TokenIcon symbol={inputMeta.symbol} size={22}/><span style={{ color: btb.text, fontSize: 11, fontWeight: 800 }}>{inputMeta.symbol}</span><button onClick={() => setAmount(formatUnits(inputMeta.balance, inputMeta.decimals))} style={{ marginLeft: 'auto', border: 0, background: 'transparent', color: btb.green, fontSize: 10, fontWeight: 750, cursor: 'pointer' }}>Available {compact(inputMeta.balance, inputMeta.decimals)} · MAX</button></div>}
                </div>
                <div style={{ padding: 10, borderRadius: 12, background: 'rgba(255,255,255,.03)', border: btb.borderSoft }}>
                  <div style={{ color: btb.textDim, fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .45 }}>{mode === 'buy' ? 'Buy token contract' : 'Receive token contract'}</div>
                  <input value={tokenOut} onChange={event => setTokenOut(event.target.value)} placeholder="0x…" spellCheck={false} style={{ width: '100%', boxSizing: 'border-box', height: 34, marginTop: 5, padding: '0 8px', borderRadius: 8, border: btb.borderSoft, background: 'rgba(255,255,255,.035)', color: btb.text, outline: 'none', fontFamily: 'monospace', fontSize: 10.5 }}/>
                  {outputMeta && <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 8 }}><TokenIcon symbol={outputMeta.symbol} size={22}/><span style={{ color: btb.text, fontSize: 11, fontWeight: 800 }}>{outputMeta.symbol}</span><span style={{ marginLeft: 'auto', color: btb.textDim, fontSize: 10 }}>stays in smart account</span></div>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <input value={amount} onChange={event => setAmount(event.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" placeholder={inputMeta ? `${inputMeta.symbol} amount` : 'Amount'} style={{ flex: 1, minWidth: 0, height: 42, borderRadius: 11, border: btb.borderSoft, background: 'rgba(255,255,255,.035)', color: btb.text, padding: '0 11px', outline: 'none', fontSize: 15 }}/>
                <Button variant="success" onClick={trade} disabled={busy !== null || !inputMeta || !outputMeta || parsedAmount <= 0n || parsedAmount > inputMeta.balance} style={{ minWidth: 118, height: 42, boxShadow: 'none' }}>{busy === 'trade' ? 'Agent buying…' : mode === 'buy' ? 'Ape now' : 'Sell now'}</Button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
                <span style={{ color: btb.textDim, fontSize: 9.5 }}>Minimum $10 · protected route · 5% maximum slippage · 10% of received tokens goes to BTB</span>
                <div style={{ display: 'flex', gap: 10 }}><button onClick={() => setFunding(true)} style={{ border: 0, background: 'transparent', color: btb.green, padding: 0, fontFamily: 'inherit', fontSize: 9.5, fontWeight: 750, cursor: 'pointer' }}>Fund / withdraw</button><button onClick={revokeInstantTrading} disabled={busy !== null} style={{ border: 0, background: 'transparent', color: btb.textDim, padding: 0, fontFamily: 'inherit', fontSize: 9.5, fontWeight: 750, cursor: 'pointer' }}>{busy === 'revoke' ? 'Disabling…' : 'Disable'}</button></div>
              </div>
            </div>
          )}
        {error && <div style={{ color: btb.loss, fontSize: 10.5, lineHeight: 1.45, marginTop: 9 }}>{error}</div>}
        {success && <div style={{ color: btb.green, fontSize: 10.5, marginTop: 9 }}>Trade confirmed · {success.net} {outputMeta?.symbol || ''} received after fee · <a href={`https://robinhoodchain.blockscout.com/tx/${success.hash}`} target="_blank" rel="noopener noreferrer" style={{ color: btb.green }}>View ↗</a></div>}
      </Glass>
      {funding && state?.deployed && validOwner && (
        <ManagedFundsSheet chainId={CHAIN_ID} chainName="Robinhood Chain" owner={validOwner} account={state.account} onClose={() => setFunding(false)} onDone={async () => { setBalanceRefresh(value => value + 1); await load(); }}/>
      )}
    </>
  );
}
