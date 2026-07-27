'use client';

import { useCallback, useEffect, useState } from 'react';
import { useConfig } from 'wagmi';
import { getPublicClient } from 'wagmi/actions';
import { encodeFunctionData } from 'viem';
import { Glass } from './Glass';
import { Badge } from './Badge';
import { Button } from './Button';
import { TokenIcon } from './TokenIcon';
import { ChainLogo } from './ChainLogo';
import { AutomatePositionSheet } from './AutomatePositionSheet';
import { btb } from './design-tokens';
import { useSidebar } from '../lib/SidebarContext';
import { useTx } from '../lib/TxTracker';
import { runCalls } from '../lib/txRunner';
import {
  createUniversalWalletCall, getUniversalWalletDeployment, readUniversalWallet, UNIVERSAL_WALLET_ABI,
  type UniversalWalletDeployment,
} from '../lib/universalWallet';
import { readUniversalLpPolicy, UNIVERSAL_LP_WALLET_ABI, withdrawUniversalLpCall, type UniversalLpPolicy } from '../lib/universalLp';
import {
  fetchV3Positions, fmtFeeTier, tickToPrice, ROBINHOOD_UNISWAP_V3_DEPLOYMENT, type LiquidityPosition,
} from '@/protocols/dexs/uniswap';
import { readableError } from '../lib/errorText';

type WalletState = Awaited<ReturnType<typeof readUniversalWallet>> & { deployment: UniversalWalletDeployment };
type ManagedItem = { pos: LiquidityPosition; policy: UniversalLpPolicy | null };

const CHAIN_ID = 4663 as const;
const EXPLORER = 'https://robinhoodchain.blockscout.com/address/';

async function retryLpRead<T>(read: () => Promise<T>): Promise<T> {
  try {
    return await read();
  } catch {
    await new Promise(resolve => setTimeout(resolve, 700));
    return read();
  }
}

function shortAddress(value: string) { return `${value.slice(0, 6)}…${value.slice(-4)}`; }
function fmtAmt(raw: bigint, decimals: number) {
  const n = Number(raw) / 10 ** decimals;
  if (n === 0) return '0';
  if (n < 0.0001) return '<0.0001';
  return n.toLocaleString('en-US', { maximumFractionDigits: 5 });
}
function fmtPrice(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '—';
  if (value >= 10_000) return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (value >= 100) return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (value >= 1) return value.toLocaleString('en-US', { maximumFractionDigits: 4 });
  if (value >= 0.0001) return value.toLocaleString('en-US', { maximumFractionDigits: 6 });
  return value.toExponential(3);
}
function signedPct(value: number) { return `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(Math.abs(value) < 10 ? 1 : 0)}%`; }

function RangeBar({ p, isMobile }: { p: LiquidityPosition; isMobile: boolean }) {
  const lower = tickToPrice(p.tickLower, p.decimals0, p.decimals1);
  const upper = tickToPrice(p.tickUpper, p.decimals0, p.decimals1);
  const live = tickToPrice(p.currentTick, p.decimals0, p.decimals1);
  const min = Math.min(lower, upper), max = Math.max(lower, upper);
  const marker = max > min ? Math.max(0, Math.min(100, ((live - min) / (max - min)) * 100)) : 50;
  const pct = (value: number) => live ? (value / live - 1) * 100 : 0;
  const color = p.inRange ? btb.green : btb.amber;
  return <div style={{ padding: isMobile ? 12 : 14, borderRadius: 14, background: 'rgba(255,255,255,.025)', border: btb.borderSoft }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><span style={{ color: btb.text, fontSize: 11, fontWeight: 800 }}>Active range</span><span style={{ color: btb.textMuted, fontSize: 10 }}>{p.symbol1} per {p.symbol0}</span></div>
    <div style={{ position: 'relative', height: 26, margin: '12px 5px 5px' }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 10, height: 6, borderRadius: 999, background: p.inRange ? 'linear-gradient(90deg,rgba(82,227,164,.2),#52E3A4,rgba(82,227,164,.2))' : 'rgba(255,179,107,.22)' }}/>
      <div style={{ position: 'absolute', left: `${marker}%`, top: 1, transform: 'translateX(-50%)', width: 14, height: 14, borderRadius: '50%', background: color, border: '3px solid #15151c', boxShadow: `0 0 0 2px ${color}55` }}/>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
      <div><div style={{ color: btb.textDim, fontSize: 9 }}>MIN</div><div style={{ color: btb.text, fontSize: 11.5, fontWeight: 750 }}>{fmtPrice(min)}</div><div style={{ color: btb.textMuted, fontSize: 9.5 }}>{signedPct(pct(min))}</div></div>
      <div style={{ textAlign: 'center' }}><div style={{ color, fontSize: 9 }}>LIVE</div><div style={{ color: btb.text, fontSize: 11.5, fontWeight: 800 }}>{fmtPrice(live)}</div><div style={{ color, fontSize: 9.5 }}>{p.inRange ? 'earning fees' : 'outside range'}</div></div>
      <div style={{ textAlign: 'right' }}><div style={{ color: btb.textDim, fontSize: 9 }}>MAX</div><div style={{ color: btb.text, fontSize: 11.5, fontWeight: 750 }}>{fmtPrice(max)}</div><div style={{ color: btb.textMuted, fontSize: 9.5 }}>{signedPct(pct(max))}</div></div>
    </div>
  </div>;
}

export function SmartAccountPositions({ address, canTransact, refreshNonce = 0 }: { address: `0x${string}`; canTransact: boolean; refreshNonce?: number }) {
  const config = useConfig();
  const { track } = useTx();
  const { isMobile } = useSidebar();
  const [wallet, setWallet] = useState<WalletState | null>(null);
  const [positions, setPositions] = useState<ManagedItem[]>([]);
  const [editing, setEditing] = useState<LiquidityPosition | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const deployment = getUniversalWalletDeployment();
      const client = getPublicClient(config, { chainId: CHAIN_ID });
      if (!deployment || !client) { setWallet(null); setPositions([]); return; }
      const state = await readUniversalWallet(client, address, deployment);
      setWallet({ ...state, deployment });
      if (!state.deployed) { setPositions([]); return; }
      const owned = await retryLpRead(() => fetchV3Positions(client, state.account, ROBINHOOD_UNISWAP_V3_DEPLOYMENT));
      const next = await Promise.all(owned.map(async pos => ({
        pos: { ...pos, chainId: CHAIN_ID, chainName: 'Robinhood Chain' },
        policy: await readUniversalLpPolicy(client, state.account, pos.token0, pos.token1, pos.fee).catch(() => null),
      })));
      setPositions(next);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load universal LP positions'); }
    finally { setLoading(false); }
  }, [address, config, refreshNonce]);

  useEffect(() => { void load(); }, [load]);

  async function createWallet() {
    if (!wallet) return;
    setBusy('wallet'); setError(null);
    try {
      await runCalls(config, { account: address, chainId: CHAIN_ID, label: 'Create my universal BTB account', track, calls: [createUniversalWalletCall(wallet.deployment, address)] });
      await load();
    } catch (cause) { setError(readableError(cause, 'That position action could not be completed')); }
    finally { setBusy(null); }
  }

  async function togglePause() {
    if (!wallet?.deployed) return;
    setBusy('wallet'); setError(null);
    try {
      await runCalls(config, { account: address, chainId: CHAIN_ID, label: wallet.paused ? 'Resume account automation' : 'Pause account automation', track, calls: [{ to: wallet.account, data: encodeFunctionData({ abi: UNIVERSAL_WALLET_ABI, functionName: 'setPaused', args: [!wallet.paused] }) }] });
      await load();
    } catch (cause) { setError(readableError(cause, 'That position action could not be completed')); }
    finally { setBusy(null); }
  }

  async function returnNft(item: ManagedItem) {
    if (!wallet?.deployed) return;
    const key = item.pos.id.toString(); setBusy(key); setError(null);
    try {
      await runCalls(config, { account: address, chainId: CHAIN_ID, label: `Return ${item.pos.symbol0}/${item.pos.symbol1} NFT`, track, calls: [withdrawUniversalLpCall(wallet.account, ROBINHOOD_UNISWAP_V3_DEPLOYMENT.positionManager, item.pos.id)] });
      await load();
    } catch (cause) { setError(readableError(cause, 'That position action could not be completed')); }
    finally { setBusy(null); }
  }

  if (!wallet && !loading) return null;
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
    <Glass padding={isMobile ? 12 : 15} radius={16} soft>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <div style={{ color: btb.text, fontSize: 13.5, fontWeight: 850 }}>Universal LP account</div>
          <div style={{ color: btb.textMuted, fontSize: 10.5, marginTop: 3 }}>The same owner-only smart account used for trading now holds and automates your LP NFTs.</div>
        </div>
        {wallet && <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <ChainLogo chainId={CHAIN_ID} size={18}/>
          <a href={`${EXPLORER}${wallet.account}`} target="_blank" rel="noopener noreferrer" style={{ color: btb.textMuted, fontSize: 10.5, textDecoration: 'none' }}>{shortAddress(wallet.account)} ↗</a>
          <Badge size="sm" border="none" bg={wallet.deployed ? wallet.paused ? 'rgba(255,179,107,.13)' : 'rgba(82,227,164,.13)' : 'rgba(255,255,255,.06)'} color={wallet.deployed ? wallet.paused ? btb.amber : btb.green : btb.textDim}>{wallet.deployed ? wallet.paused ? 'Paused' : 'Active' : 'Not created'}</Badge>
        </div>}
      </div>
      {wallet && <div style={{ display: 'flex', gap: 7, marginTop: 10 }}>
        {!wallet.deployed ? <Button variant="success" size="sm" onClick={createWallet} disabled={!canTransact || busy === 'wallet'}>{busy === 'wallet' ? 'Creating…' : 'Create account'}</Button>
          : <Button variant="ghost" size="sm" onClick={togglePause} disabled={!canTransact || busy === 'wallet'}>{busy === 'wallet' ? 'Confirming…' : wallet.paused ? 'Resume automation' : 'Pause automation'}</Button>}
      </div>}
      {error && <div style={{ color: btb.loss, fontSize: 11, marginTop: 9, lineHeight: 1.4 }}>{error}</div>}
      {loading && <div style={{ color: btb.textDim, fontSize: 10.5, marginTop: 9 }}>Refreshing account and NFT state…</div>}
    </Glass>

    {positions.map(item => {
      const p = item.pos, policy = item.policy;
      const active = !!policy?.enabled && !wallet?.paused && Number(policy.expiresAt) > Date.now() / 1000;
      const hasFees = p.fees0 > 0n || p.fees1 > 0n;
      return <Glass key={p.id.toString()} padding={isMobile ? 12 : 16} radius={18}>
        <div style={{ display: 'flex', gap: 11, alignItems: 'center' }}>
          <div style={{ display: 'flex' }}><TokenIcon symbol={p.symbol0} size={30}/><div style={{ marginLeft: -9 }}><TokenIcon symbol={p.symbol1} size={30}/></div></div>
          <div style={{ flex: 1, minWidth: 0 }}><div style={{ color: btb.text, fontSize: 16, fontWeight: 850 }}>{p.symbol0} / {p.symbol1}</div><div style={{ display: 'flex', gap: 5, alignItems: 'center', marginTop: 4 }}><Badge size="sm" border="none" bg={btb.surfaceSoft} color={btb.textMuted}>{fmtFeeTier(p.fee)}</Badge><span style={{ color: btb.textDim, fontSize: 9.5 }}>NFT #{p.id.toString()}</span></div></div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end' }}><Badge size="sm" border="none" bg={p.inRange ? 'rgba(82,227,164,.13)' : 'rgba(255,179,107,.13)'} color={p.inRange ? btb.green : btb.amber}>{p.inRange ? 'In range' : 'Out of range'}</Badge><Badge size="sm" border="none" bg={active ? 'rgba(82,227,164,.13)' : 'rgba(255,255,255,.06)'} color={active ? btb.green : btb.textDim}>{active ? 'Automated' : policy ? 'Stopped' : 'Manual'}</Badge></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr minmax(280px,1.4fr)', gap: 8, marginTop: 13 }}>
          <div style={{ padding: 12, borderRadius: 14, background: 'rgba(255,255,255,.025)', border: btb.borderSoft }}><div style={{ color: btb.textDim, fontSize: 9.5 }}>POSITION</div><div style={{ color: btb.text, fontSize: 12, fontWeight: 750, marginTop: 7 }}>{fmtAmt(p.amount0, p.decimals0)} <span style={{ color: btb.textMuted }}>{p.symbol0}</span></div><div style={{ color: btb.text, fontSize: 12, fontWeight: 750, marginTop: 4 }}>{fmtAmt(p.amount1, p.decimals1)} <span style={{ color: btb.textMuted }}>{p.symbol1}</span></div></div>
          <div style={{ padding: 12, borderRadius: 14, background: hasFees ? 'rgba(82,227,164,.035)' : 'rgba(255,255,255,.025)', border: btb.borderSoft }}><div style={{ color: btb.textDim, fontSize: 9.5 }}>UNCLAIMED FEES</div><div style={{ color: hasFees ? btb.green : btb.textDim, fontSize: 12, fontWeight: 750, marginTop: 7 }}>{fmtAmt(p.fees0, p.decimals0)} <span style={{ color: btb.textMuted }}>{p.symbol0}</span></div><div style={{ color: hasFees ? btb.green : btb.textDim, fontSize: 12, fontWeight: 750, marginTop: 4 }}>{fmtAmt(p.fees1, p.decimals1)} <span style={{ color: btb.textMuted }}>{p.symbol1}</span></div></div>
          <div style={{ gridColumn: isMobile ? '1 / -1' : undefined }}><RangeBar p={p} isMobile={isMobile}/></div>
        </div>
        {policy && <div style={{ marginTop: 8, padding: '9px 11px', borderRadius: 12, display: 'flex', flexWrap: 'wrap', gap: '6px 12px', background: active ? 'rgba(82,227,164,.035)' : 'rgba(255,255,255,.025)', border: btb.borderSoft }}><span style={{ color: active ? btb.green : btb.textDim, fontSize: 10.5, fontWeight: 800 }}>{active ? '● Guarded automation' : '○ Automation stopped'}</span><span style={{ color: btb.textMuted, fontSize: 10.5 }}>Slippage ≤ {policy.maximumSlippageBps / 100}%</span><span style={{ color: btb.textMuted, fontSize: 10.5 }}>Target {policy.targetTickWidth.toLocaleString()} ticks</span><span style={{ color: btb.textMuted, fontSize: 10.5 }}>Allowed {policy.minimumTick.toLocaleString()} → {policy.maximumTick.toLocaleString()}</span></div>}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3,minmax(130px,1fr))', gap: 7, marginTop: 10 }}>
          <Button fullWidth variant="success" size="sm" onClick={() => setEditing(p)} disabled={!canTransact || busy === p.id.toString()} style={{ height: 36 }}>{policy ? 'Change range rules' : 'Enable automation'}</Button>
          <Button fullWidth variant="ghost" size="sm" disabled style={{ height: 36 }} title="The universal guarded add/compound workflow is next">Add / compound</Button>
          <Button fullWidth variant="ghost" size="sm" onClick={() => returnNft(item)} disabled={!canTransact || busy === p.id.toString()} style={{ height: 36, color: btb.amber, border: '1px solid rgba(255,179,107,.25)' }}>{busy === p.id.toString() ? 'Confirming…' : 'Return NFT'}</Button>
        </div>
      </Glass>;
    })}
    {wallet?.deployed && positions.length === 0 && !loading && !error && <Glass padding={14} radius={16} soft><div style={{ color: btb.text, fontSize: 12.5, fontWeight: 800 }}>No LP NFTs in this account</div><div style={{ color: btb.textMuted, fontSize: 10.5, marginTop: 3 }}>Enable automation from any Robinhood Uniswap V3 position in your portfolio. It will move into {shortAddress(wallet.account)}.</div></Glass>}
    {editing && <AutomatePositionSheet
      pos={editing}
      account={address}
      onClose={() => setEditing(null)}
      onDone={async () => { setEditing(null); await load(); }}
    />}
  </div>;
}
