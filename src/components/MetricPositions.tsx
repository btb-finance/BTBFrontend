'use client';
import { useEffect, useState } from 'react';
import { useConnection, useConfig, usePublicClient } from 'wagmi';
import { formatUnits, type PublicClient } from 'viem';
import { Glass } from './Glass';
import { Portal } from './Portal';
import { Button } from './Button';
import { Icon } from './Icon';
import { TokenIcon } from './TokenIcon';
import { LpButton } from './LpCardParts';
import { ChainLogo } from './ChainLogo';
import { btb } from './design-tokens';
import { useScrollLock } from '../lib/useScrollLock';
import { useSidebar } from '../lib/SidebarContext';
import { useTx } from '../lib/TxTracker';
import { runCalls } from '../lib/txRunner';
import { readableError } from '../lib/errorText';
import type { SupportedChainId } from '../lib/wagmi';
import { MetricDepositSheet, fmtOffset } from './MetricDepositSheet';
import {
  METRIC_CHAIN_NAMES, fetchMetricPools, fetchMetricPositions, metricPoolUrl, metricWithdrawCall, planMetricWithdraw,
  type MetricChainId, type MetricPoolInfo, type MetricPosition, type MetricWithdrawPlan,
} from '@/protocols/dexs/metric';

const money = (n: number) => `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
function fmtAmt(raw: bigint, decimals: number): string {
  const n = Number(formatUnits(raw, decimals));
  if (n === 0) return '0';
  if (n < 0.0001) return '<0.0001';
  return n.toLocaleString('en-US', { maximumFractionDigits: n < 1 ? 6 : 4 });
}
const keyOf = (p: MetricPosition) => `${p.chainId}:${p.pool}:${p.salt}`;

/**
 * The viewed wallet's Metric positions, read from Metric's positions API, with value, earnings and range, and
 * Add / Withdraw for the wallet's own view. Hidden when there are none.
 */
export function MetricPositions({ address }: { address?: string }) {
  const { address: connected } = useConnection();
  const canTransact = !!connected && !!address && connected.toLowerCase() === address.toLowerCase();
  const [loaded, setLoaded] = useState<{ address: string; positions: MetricPosition[] } | null>(null);
  // Only the viewed wallet's list counts: switching wallets shows nothing until its own list lands.
  const positions = loaded && address && loaded.address === address ? loaded.positions : [];
  const [pools, setPools] = useState<Map<string, MetricPoolInfo>>(new Map());
  const [nonce, setNonce] = useState(0);
  const [adding, setAdding] = useState<MetricPosition | null>(null);
  const [withdrawing, setWithdrawing] = useState<MetricPosition | null>(null);

  useEffect(() => {
    let live = true;
    if (!address) return;
    fetchMetricPositions(address).then(async ({ positions: list }) => {
      if (!live) return;
      setLoaded({ address, positions: list });
      // Symbols, decimals and logos for each pool, one call per chain.
      const byChain = new Map<MetricChainId, string[]>();
      for (const p of list) byChain.set(p.chainId, [...new Set([...(byChain.get(p.chainId) ?? []), p.pool])]);
      const maps = await Promise.all([...byChain].map(([c, ps]) => fetchMetricPools(c, ps).catch(() => new Map<string, MetricPoolInfo>())));
      if (live) setPools(new Map(maps.flatMap((m) => [...m])));
    }).catch(() => {});
    return () => { live = false; };
  }, [address, nonce]);

  // The positions API trails a confirmed transaction by a few seconds, so read again shortly after.
  const refresh = () => { setNonce((n) => n + 1); setTimeout(() => setNonce((n) => n + 1), 8_000); };

  if (positions.length === 0) return null;
  const total = positions.reduce((s, p) => s + (p.valueUsd ?? 0), 0);

  return (
    <Glass padding={14} radius={16} soft>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={{ color: btb.text, fontSize: 12.5, fontWeight: 800 }}>Metric positions{total > 0 ? ` · ${money(total)}` : ''}</span>
        <span style={{ color: btb.textDim, fontSize: 10.5 }}>Oracle priced bins: the range follows the price, earnings compound in the position</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {positions.map((p) => {
          const info = pools.get(p.pool.toLowerCase());
          const s0 = info?.symbol0 ?? 'Token0', s1 = info?.symbol1 ?? 'Token1';
          return (
            <div key={keyOf(p)} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '10px 10px', borderRadius: 12, background: 'rgba(var(--fg-rgb), 0.035)' }}>
              <div style={{ display: 'flex', flexShrink: 0, position: 'relative' }}>
                <TokenIcon symbol={s0} size={28} logoUrl={info?.logo0}/>
                <div style={{ marginLeft: -9 }}><TokenIcon symbol={s1} size={28} logoUrl={info?.logo1}/></div>
                <span style={{ position: 'absolute', right: -4, bottom: -3 }}><ChainLogo chainId={p.chainId} size={14}/></span>
              </div>
              <div style={{ flex: 1, minWidth: 190 }}>
                <div style={{ color: btb.text, fontSize: 13, fontWeight: 800 }}>
                  {s0}/{s1}
                  <span style={{ color: btb.textMuted, fontWeight: 600, fontSize: 11.5 }}> · Metric · {METRIC_CHAIN_NAMES[p.chainId]}</span>
                </div>
                <div style={{ color: btb.textMuted, fontSize: 11.5, marginTop: 3 }}>
                  {info ? `${fmtAmt(p.amount0, info.decimals0)} ${s0} + ${fmtAmt(p.amount1, info.decimals1)} ${s1}` : `${p.bins.length} bin${p.bins.length === 1 ? '' : 's'}`}
                  {p.lowerOffset != null && p.upperOffset != null ? ` · range ${fmtOffset(p.lowerOffset)} to ${fmtOffset(p.upperOffset)}` : ''}
                </div>
                <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: 11.5, flexWrap: 'wrap' }}>
                  {p.valueUsd != null && <span style={{ color: btb.text, fontWeight: 700 }}>{money(p.valueUsd)}</span>}
                  {p.feesEarnedUsd != null && <span style={{ color: btb.green }}>Earned {money(p.feesEarnedUsd)}</span>}
                  {p.apr7d != null && <span style={{ color: btb.textMuted }} title="Your share of the spread over 7 days, annualised. It leaves out price moves.">{p.apr7d.toFixed(2)}% APR (7d)</span>}
                  {p.pnlApr7d != null && <span style={{ color: p.pnlApr7d < 0 ? btb.loss : btb.textMuted }} title="Compared with holding the tokens, over 7 days, annualised. Includes price moves.">{p.pnlApr7d.toFixed(2)}% vs holding</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <LpButton tone="green" label="Add" onClick={() => setAdding(p)} disabled={!canTransact}/>
                <LpButton label="Withdraw" onClick={() => setWithdrawing(p)} disabled={!canTransact}/>
                <LpButton label="On Metric" onClick={() => window.open(metricPoolUrl(p.chainId, p.pool), '_blank', 'noopener,noreferrer')}/>
              </div>
            </div>
          );
        })}
      </div>
      {!canTransact && connected && <div style={{ color: btb.textDim, fontSize: 11, marginTop: 8 }}>Connect this wallet to add or withdraw.</div>}
      {adding && (
        <MetricDepositSheet chainId={adding.chainId} pool={adding.pool} salt={adding.salt} onClose={() => setAdding(null)} onDone={() => { setAdding(null); refresh(); }}/>
      )}
      {withdrawing && connected && (
        <MetricWithdrawSheet pos={withdrawing} info={pools.get(withdrawing.pool.toLowerCase())} owner={connected} onClose={() => setWithdrawing(null)} onDone={() => { setWithdrawing(null); refresh(); }}/>
      )}
    </Glass>
  );
}

/** Take part or all of a Metric position out. Amounts come from the shares on chain, not the API. */
function MetricWithdrawSheet({ pos, info, owner, onClose, onDone }: {
  pos: MetricPosition; info?: MetricPoolInfo; owner: `0x${string}`; onClose: () => void; onDone: () => void;
}) {
  useScrollLock(true);
  const { width: sidebarWidth } = useSidebar();
  const config = useConfig();
  const { track } = useTx();
  const client = usePublicClient({ chainId: pos.chainId as SupportedChainId }) as PublicClient | undefined;
  const [pct, setPct] = useState(100);
  // The preview for the percentage it was read for; another choice shows nothing until its own lands.
  const [read, setRead] = useState<{ pct: number; plan?: MetricWithdrawPlan; err?: string } | null>(null);
  const plan = read?.pct === pct ? read.plan ?? null : null;
  const planErr = read?.pct === pct ? read.err ?? null : null;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    if (!client) return;
    planMetricWithdraw(client, pos.chainId, pos.pool, owner, pos.salt, pos.bins.map((b) => b.binIdx), pct)
      .then((p) => { if (live) setRead({ pct, plan: p }); })
      .catch((e) => { if (live) setRead({ pct, err: readableError(e, 'Could not read the position.') }); });
    return () => { live = false; };
  }, [client, pos, owner, pct]);

  async function run() {
    if (!plan) return;
    setBusy(true); setErr(null);
    try {
      await runCalls(config, {
        account: owner,
        calls: [metricWithdrawCall(pos.pool, owner, pos.salt, plan)],
        label: `Withdraw from Metric ${info ? `${info.symbol0}/${info.symbol1}` : ''}`.trim(),
        track, chainId: pos.chainId,
      });
      onDone();
    } catch (e) {
      setErr(readableError(e, 'The withdrawal did not go through. Nothing was taken out.'));
    } finally { setBusy(false); }
  }

  const s0 = info?.symbol0 ?? 'Token0', s1 = info?.symbol1 ?? 'Token1';
  const d0 = info?.decimals0 ?? 18, d1 = info?.decimals1 ?? 18;
  const usd = plan ? Number(formatUnits(plan.out0, d0)) * pos.token0Usd + Number(formatUnits(plan.out1, d1)) * pos.token1Usd : 0;

  return (
    <Portal>
    <div onClick={busy ? undefined : onClose} style={{ position: 'fixed', top: 0, left: sidebarWidth, right: 0, bottom: 0, zIndex: 320, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 16px', overflowY: 'auto' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 440, background: 'rgba(var(--bg-rgb), 0.98)', border: '1px solid rgba(var(--fg-rgb), 0.1)', borderRadius: 28, padding: '12px 20px calc(28px + env(safe-area-inset-bottom, 0px))' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, paddingTop: 6 }}>
          <div style={{ color: btb.text, fontSize: 18, fontWeight: 800, letterSpacing: -0.4 }}>Withdraw {s0}/{s1}</div>
          {!busy && <div onClick={onClose} style={{ cursor: 'pointer', padding: 4 }}><Icon name="close" size={16} color={btb.textMuted}/></div>}
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          {[25, 50, 75, 100].map((v) => (
            <button key={v} type="button" onClick={() => setPct(v)} style={{ flex: 1, height: 36, borderRadius: 12, border: v === pct ? '1px solid rgba(var(--green-rgb), 0.5)' : '1px solid rgba(var(--fg-rgb), 0.1)', background: v === pct ? 'rgba(var(--green-rgb), 0.08)' : 'transparent', color: v === pct ? btb.text : btb.textMuted, fontFamily: 'inherit', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>{v === 100 ? 'All' : `${v}%`}</button>
          ))}
        </div>
        <Glass padding={14} radius={16} soft>
          <div style={{ color: btb.textMuted, fontSize: 12, fontWeight: 700, marginBottom: 6 }}>You receive</div>
          {!plan && !planErr && <div style={{ color: btb.textDim, fontSize: 12.5 }}>Reading the position…</div>}
          {planErr && <div style={{ color: btb.amber, fontSize: 12.5 }}>{planErr}</div>}
          {plan && (
            <>
              <div style={{ color: btb.text, fontSize: 14, fontWeight: 700 }}>{fmtAmt(plan.out0, d0)} {s0}</div>
              <div style={{ color: btb.text, fontSize: 14, fontWeight: 700, marginTop: 2 }}>{fmtAmt(plan.out1, d1)} {s1}</div>
              {usd > 0 && <div style={{ color: btb.textMuted, fontSize: 12, marginTop: 4 }}>About {money(usd)}, earnings included</div>}
              {pct < 100 && plan.all && <div style={{ color: btb.textDim, fontSize: 11.5, marginTop: 6 }}>The rest would be below the pool&apos;s minimum, so this takes everything.</div>}
            </>
          )}
        </Glass>
        {err && <div style={{ color: btb.loss, fontSize: 12, marginTop: 12 }}>{err}</div>}
        <Button variant="success" size="md" onClick={() => { if (plan && !busy) void run(); }} disabled={!plan || busy} style={{ marginTop: 16, fontWeight: 800, width: '100%' }}>
          {busy ? 'Confirm in your wallet' : pct === 100 || plan?.all ? 'Withdraw all' : `Withdraw ${pct}%`}
        </Button>
        <div style={{ color: btb.textDim, fontSize: 11, textAlign: 'center', marginTop: 10 }}>
          Goes straight to your wallet. There is nothing to claim: earnings are already in the position.
        </div>
      </div>
    </div>
    </Portal>
  );
}

