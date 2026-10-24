'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useConnection, useConfig } from 'wagmi';
import { getPublicClient } from 'wagmi/actions';
import { erc20Abi, formatUnits, parseUnits, type PublicClient } from 'viem';
import { Portal } from './Portal';
import { Button } from './Button';
import { Icon } from './Icon';
import { TokenIcon } from './TokenIcon';
import { btb } from './design-tokens';
import { useScrollLock } from '../lib/useScrollLock';
import { useSidebar } from '../lib/SidebarContext';
import { useTx } from '../lib/TxTracker';
import { runCalls } from '../lib/txRunner';
import { readableError } from '../lib/errorText';
import type { SupportedChainId } from '../lib/wagmi';
import { wrappedNativeFor } from '@/protocols/lpChains';
import {
  METRIC_CHAIN_NAMES, fetchMetricPools, metricDepositCalls, metricPoolUrl, newMetricSalt, planMetricDeposit, rangeOf,
  readMetricLayout, type MetricChainId, type MetricDepositPlan, type MetricPoolInfo, type MetricPoolLayout,
} from '@/protocols/dexs/metric';

/** Native coin kept back for gas when paying the wrapped leg in the chain's coin. */
const GAS_RESERVE: Record<MetricChainId, bigint> = { 1: 3n * 10n ** 15n, 56: 2n * 10n ** 15n, 4663: 5n * 10n ** 14n };

const TIER_LABEL: Record<string, string> = { green: 'Best practices', yellow: 'Standard', red: 'High risk' };

/** "+0.12%" style, to two significant decimals for the narrow bins Metric pools use. */
export function fmtOffset(x: number): string {
  const pct = x * 100;
  const digits = Math.abs(pct) < 0.1 ? 3 : 2;
  return `${pct > 0 ? '+' : ''}${pct.toFixed(digits)}%`;
}

function fmtAmt(raw: bigint, decimals: number): string {
  const n = Number(formatUnits(raw, decimals));
  if (n === 0) return '0';
  if (n < 0.0001) return '<0.0001';
  return n.toLocaleString('en-US', { maximumFractionDigits: n < 1 ? 6 : 4 });
}

const money = (n: number) => `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

/** Ranges offered for a pool, from its own bins: next to the price, half the pool, all of it. */
function presets(layout: MetricPoolLayout): { key: string; label: string; bins: number[] }[] {
  const idxs = layout.bins.map((b) => b.idx);
  const lo = idxs[0], hi = idxs[idxs.length - 1];
  const around = (k: number) => idxs.filter((i) => i >= Math.max(lo, layout.curBin - k) && i <= Math.min(hi, layout.curBin + k));
  const quarter = Math.max(3, Math.round(idxs.length / 4));
  const out = [
    { key: 'near', label: 'Near price', bins: around(2) },
    { key: 'half', label: 'Balanced', bins: around(quarter) },
    { key: 'full', label: 'Full range', bins: idxs },
  ];
  return out.filter((p, i) => p.bins.length > 0 && out.findIndex((q) => q.bins.length === p.bins.length) === i);
}

/**
 * Deposit into a Metric pool, as a new position or into an existing one (`salt`). The amount is typed in one token;
 * the chosen bins decide how much of each token goes in, spread at equal value across them.
 */
export function MetricDepositSheet({ chainId, pool, salt: existingSalt, onClose, onDone }: {
  chainId: MetricChainId; pool: `0x${string}`; salt?: bigint; onClose: () => void; onDone: () => void | Promise<void>;
}) {
  useScrollLock(true);
  const { width: sidebarWidth } = useSidebar();
  const { address } = useConnection();
  const config = useConfig();
  const { track } = useTx();
  const client = getPublicClient(config, { chainId: chainId as SupportedChainId }) as PublicClient | undefined;
  // One id for this sheet's new position, so a retry after a failure adds to the same one.
  const salt = useRef(existingSalt ?? newMetricSalt()).current;

  const [info, setInfo] = useState<MetricPoolInfo | null>(null);
  const [layout, setLayout] = useState<MetricPoolLayout | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    if (!client) { setLoadErr('This network is not available in your wallet setup.'); return; }
    Promise.all([fetchMetricPools(chainId, [pool]), readMetricLayout(client, chainId, pool)])
      .then(([m, l]) => { if (!live) return; setInfo(m.get(pool.toLowerCase()) ?? null); setLayout(l); })
      .catch((e) => { if (live) setLoadErr(readableError(e, 'Could not load this pool.')); });
    return () => { live = false; };
  }, [client, chainId, pool]);

  const ranges = useMemo(() => (layout ? presets(layout) : []), [layout]);
  const [rangeKey, setRangeKey] = useState('half');
  const range = ranges.find((r) => r.key === rangeKey) ?? ranges[0];
  const span = layout && range ? rangeOf(layout, range.bins) : null;

  // Which token the amount is typed in, and whether the wrapped native leg is paid in the chain's coin.
  const wrapped = wrappedNativeFor(chainId).toLowerCase();
  const nativeSide: 0 | 1 | null = info ? (info.token0.toLowerCase() === wrapped ? 0 : info.token1.toLowerCase() === wrapped ? 1 : null) : null;
  const nativeSym = chainId === 56 ? 'BNB' : 'ETH';
  const [useNative, setUseNative] = useState(true);
  const native = nativeSide != null && useNative ? nativeSide : undefined;
  const [inToken0, setInToken0] = useState(false);
  const [amtStr, setAmtStr] = useState('');

  const [bal, setBal] = useState<{ token0: bigint; token1: bigint; native: bigint } | null>(null);
  const [balNonce, setBalNonce] = useState(0);
  useEffect(() => {
    let live = true;
    if (!client || !info || !address) return;
    const of = (t: `0x${string}`) => client.readContract({ address: t, abi: erc20Abi, functionName: 'balanceOf', args: [address] });
    Promise.all([of(info.token0), of(info.token1), client.getBalance({ address })])
      .then(([a, b, n]) => { if (live) setBal({ token0: a, token1: b, native: n }); })
      .catch(() => {});
    return () => { live = false; };
  }, [client, info, address, balNonce]);
  const nativeSpendable = bal ? (bal.native > GAS_RESERVE[chainId] ? bal.native - GAS_RESERVE[chainId] : 0n) : 0n;
  const spendable = (k: 0 | 1) => (!bal ? 0n : native === k ? nativeSpendable : k === 0 ? bal.token0 : bal.token1);

  const dec = info ? (inToken0 ? info.decimals0 : info.decimals1) : 18;
  const amount = useMemo(() => { try { return amtStr ? parseUnits(amtStr, dec) : 0n; } catch { return 0n; } }, [amtStr, dec]);

  const [plan, setPlan] = useState<MetricDepositPlan | null>(null);
  const [planErr, setPlanErr] = useState<string | null>(null);
  const [planning, setPlanning] = useState(false);
  useEffect(() => {
    let live = true;
    setPlan(null); setPlanErr(null);
    if (!client || !info || !range || amount <= 0n) return;
    setPlanning(true);
    const t = setTimeout(() => {
      planMetricDeposit(client, chainId, pool, range.bins, amount, inToken0, bal ? { token0: spendable(0), token1: spendable(1) } : undefined)
        .then((p) => { if (live) setPlan(p); })
        .catch((e) => { if (live) setPlanErr(readableError(e, 'Could not size this deposit.')); })
        .finally(() => { if (live) setPlanning(false); });
    }, 400);
    return () => { live = false; clearTimeout(t); };
    // spendable is derived from bal and native, both listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, info, range, amount, inToken0, chainId, pool, bal, native]);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function deposit() {
    if (!plan || !info || !address) return;
    setBusy(true); setErr(null);
    try {
      await runCalls(config, {
        account: address,
        calls: metricDepositCalls({ chainId, pool, token0: info.token0, token1: info.token1, salt, plan, native }),
        label: `${existingSalt != null ? 'Add to' : 'Deposit into'} Metric ${info.symbol0}/${info.symbol1}`,
        track, chainId,
      });
      await onDone();
    } catch (e) {
      setErr(readableError(e, 'The deposit did not go through. Nothing was taken.'));
      setBalNonce((n) => n + 1);
    } finally { setBusy(false); }
  }

  const sym = (k: 0 | 1) => (!info ? '' : native === k ? nativeSym : k === 0 ? info.symbol0 : info.symbol1);
  const usd = plan && info
    ? Number(formatUnits(plan.need0, info.decimals0)) * info.price0 + Number(formatUnits(plan.need1, info.decimals1)) * info.price1
    : 0;
  const short = plan && (plan.short0 || plan.short1);
  const blocked = info?.paused ? 'This pool is paused.' : info?.allowlisted ? 'Only approved wallets can deposit in this pool.' : null;
  const canRun = !!plan && !short && !busy && !blocked && !!address;

  return (
    <Portal>
    <div onClick={busy ? undefined : onClose} style={{ position: 'fixed', top: 0, left: sidebarWidth, right: 0, bottom: 0, zIndex: 320, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 16px', overflowY: 'auto' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, background: 'rgba(var(--bg-rgb), 0.98)', border: '1px solid rgba(var(--fg-rgb), 0.1)', borderRadius: 28, padding: '12px 20px calc(28px + env(safe-area-inset-bottom, 0px))' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, paddingTop: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            {info && (
              <div style={{ display: 'flex', flexShrink: 0 }}>
                <TokenIcon symbol={info.symbol0} size={26} logoUrl={info.logo0}/>
                <div style={{ marginLeft: -8 }}><TokenIcon symbol={info.symbol1} size={26} logoUrl={info.logo1}/></div>
              </div>
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ color: btb.text, fontSize: 18, fontWeight: 800, letterSpacing: -0.4 }}>{existingSalt != null ? 'Add to position' : 'Add liquidity'}{info ? ` ${info.symbol0}/${info.symbol1}` : ''}</div>
              <div style={{ color: btb.textMuted, fontSize: 12 }}>Metric on {METRIC_CHAIN_NAMES[chainId]}{info ? ` · ${info.apr7d.toFixed(2)}% APR (7d)` : ''}</div>
            </div>
          </div>
          {!busy && <div onClick={onClose} style={{ cursor: 'pointer', padding: 4 }}><Icon name="close" size={16} color={btb.textMuted}/></div>}
        </div>

        {loadErr && <div style={{ color: btb.loss, fontSize: 13, padding: '16px 0' }}>{loadErr}</div>}
        {!loadErr && (!info || !layout) && <div style={{ color: btb.textDim, fontSize: 13, padding: '24px 0', textAlign: 'center' }}>Loading the pool…</div>}

        {info && layout && (
          <>
            {info.tier && (
              <div style={{ color: info.tier === 'red' ? btb.loss : btb.textMuted, fontSize: 11.5, marginBottom: 12 }}>
                {TIER_LABEL[info.tier] ?? 'Unrated'} tier on Metric{info.curator ? ` · ${info.verifiedCurator ? 'curated' : 'operated'} by ${info.curator}` : ''}
              </div>
            )}

            <div style={{ color: btb.textMuted, fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Range around the oracle price</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              {ranges.map((r) => {
                const on = r.key === range?.key;
                const s = rangeOf(layout, r.bins);
                return (
                  <button key={r.key} type="button" onClick={() => setRangeKey(r.key)} style={{ flex: 1, minWidth: 0, padding: '8px 6px', borderRadius: 12, border: on ? '1px solid rgba(var(--green-rgb), 0.5)' : '1px solid rgba(var(--fg-rgb), 0.1)', background: on ? 'rgba(var(--green-rgb), 0.08)' : 'transparent', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center' }}>
                    <div style={{ color: on ? btb.text : btb.textMuted, fontSize: 12.5, fontWeight: 800 }}>{r.label}</div>
                    <div style={{ color: btb.textDim, fontSize: 10.5, marginTop: 2 }}>{s ? `${fmtOffset(s.lower)} to ${fmtOffset(s.upper)}` : ''}</div>
                  </button>
                );
              })}
            </div>
            <div style={{ color: btb.textDim, fontSize: 11, marginBottom: 14 }}>
              {range?.bins.length ?? 0} bin{range?.bins.length === 1 ? '' : 's'}{span ? `, ${fmtOffset(span.lower)} to ${fmtOffset(span.upper)}` : ''}. The range moves with the oracle price, so there is nothing to rebalance. It earns only when trades reach these bins.
            </div>

            <div style={{ background: 'rgba(var(--fg-rgb), 0.05)', border: `1px solid ${short ? 'rgba(var(--loss-rgb, 239,68,68), 0.6)' : 'rgba(var(--fg-rgb), 0.1)'}`, borderRadius: 16, padding: '12px 14px', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input value={amtStr} onChange={(e) => setAmtStr(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" placeholder="0"
                  style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', color: btb.text, fontSize: 24, fontWeight: 700, fontFamily: 'inherit', outline: 'none', padding: 0 }}/>
                <div style={{ display: 'flex', background: 'rgba(var(--fg-rgb), 0.08)', borderRadius: 999, padding: 2 }}>
                  {([true, false] as const).map((t0) => {
                    const on = t0 === inToken0;
                    return <button key={String(t0)} type="button" onClick={() => { setInToken0(t0); setAmtStr(''); }} style={{ height: 28, padding: '0 10px', borderRadius: 999, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 800, background: on ? btb.text : 'transparent', color: on ? 'rgba(var(--bg-rgb), 1)' : btb.textMuted }}>{sym(t0 ? 0 : 1)}</button>;
                  })}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 12 }}>
                <span style={{ color: btb.textDim }}>Total worth, in {sym(inToken0 ? 0 : 1)}</span>
                <span style={{ color: btb.textMuted }}>
                  Balance {bal ? fmtAmt(spendable(inToken0 ? 0 : 1), dec) : '…'}
                  <span onClick={() => { const v = spendable(inToken0 ? 0 : 1); if (v > 0n) setAmtStr(formatUnits(v, dec)); }} style={{ color: btb.green, fontWeight: 800, marginLeft: 8, cursor: 'pointer' }}>MAX</span>
                </span>
              </div>
            </div>
            {nativeSide != null && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: btb.textMuted, fontSize: 12, marginBottom: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={useNative} onChange={(e) => setUseNative(e.target.checked)}/>
                Pay the {nativeSide === 0 ? info.symbol0 : info.symbol1} side with {nativeSym}
              </label>
            )}

            {planning && !plan && <div style={{ color: btb.textDim, fontSize: 12, marginTop: 4 }}>Working out the split…</div>}
            {planErr && <div style={{ color: btb.amber, fontSize: 12, marginTop: 4 }}>{planErr}</div>}
            {plan && (
              <div style={{ marginTop: 6, padding: '10px 14px', borderRadius: 14, background: 'rgba(var(--green-rgb), 0.07)', border: '1px solid rgba(var(--green-rgb), 0.2)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {([0, 1] as const).filter((k) => (k === 0 ? plan.need0 : plan.need1) > 0n).map((k) => {
                  const need = k === 0 ? plan.need0 : plan.need1;
                  const d = k === 0 ? info.decimals0 : info.decimals1;
                  const isShort = k === 0 ? plan.short0 : plan.short1;
                  return (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12.5 }}>
                      <span style={{ color: isShort ? btb.loss : btb.textMuted }}>{isShort ? `Not enough ${sym(k)}` : 'Puts in'}</span>
                      <span style={{ color: btb.text, fontWeight: 700 }}>{fmtAmt(need, d)} {sym(k)}</span>
                    </div>
                  );
                })}
                {usd > 0 && <div style={{ color: btb.textDim, fontSize: 11.5 }}>About {money(usd)}. Bins above the price hold {info.symbol0}, bins below hold {info.symbol1}.</div>}
              </div>
            )}

            {blocked && <div style={{ color: btb.amber, fontSize: 12, marginTop: 10 }}>{blocked}</div>}
            {err && <div style={{ color: btb.loss, fontSize: 12, marginTop: 10 }}>{err}</div>}

            <Button variant="success" size="md" onClick={() => { if (canRun) void deposit(); }} disabled={!canRun} style={{ marginTop: 16, fontWeight: 800, width: '100%' }}>
              {busy ? 'Confirm in your wallet' : !address ? 'Connect a wallet' : blocked ? 'Deposits closed' : short ? 'Not enough balance' : plan ? (existingSalt != null ? 'Add to position' : 'Deposit') : 'Enter an amount'}
            </Button>
            <div style={{ color: btb.textDim, fontSize: 11, textAlign: 'center', marginTop: 10, lineHeight: 1.45 }}>
              Token approvals are included. The deposit will not go through if the pool price moves more than 0.5% before it lands.
              Positive APR is not profit: price moves can outweigh what the bins earn, and you can lose money.{' '}
              <a href={metricPoolUrl(chainId, pool)} target="_blank" rel="noopener noreferrer" style={{ color: btb.textMuted }}>Pool on Metric</a>
            </div>
          </>
        )}
      </div>
    </div>
    </Portal>
  );
}
