'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useConnection, useConfig, usePublicClient } from 'wagmi';
import { erc20Abi, formatUnits, parseUnits, type PublicClient } from 'viem';
import { Portal } from './Portal';
import { Button } from './Button';
import { Glass } from './Glass';
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
  METRIC_CHAIN_NAMES, fetchMetricPools, metricDepositCalls, newMetricSalt, planMetricDeposit, rangeOf, readMetricLayout,
  type MetricChainId, type MetricDepositPlan, type MetricPoolInfo, type MetricPoolLayout,
} from '@/protocols/dexs/metric';

/** Native coin kept back for gas when paying the wrapped side in the chain's coin. */
const GAS_RESERVE: Record<MetricChainId, bigint> = { 1: 3n * 10n ** 15n, 56: 2n * 10n ** 15n, 4663: 5n * 10n ** 14n };

/** "+0.12%" style, with a third decimal for the narrow bins Metric pools use. */
export function fmtOffset(x: number): string {
  const pct = x * 100;
  return `${pct > 0 ? '+' : ''}${pct.toFixed(Math.abs(pct) < 0.1 ? 3 : 2)}%`;
}

function fmtAmt(raw: bigint, decimals: number): string {
  const n = Number(formatUnits(raw, decimals));
  if (n === 0) return '0';
  if (n < 0.0001) return '<0.0001';
  return n.toLocaleString('en-US', { maximumFractionDigits: n < 1 ? 6 : 4 });
}

const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: n < 100 ? 2 : 0, maximumFractionDigits: n < 100 ? 2 : 0 })}`;

/** Ranges offered for a pool, from its own bins: next to the price, half the pool, all of it. */
function presets(layout: MetricPoolLayout): { key: string; label: string; bins: number[] }[] {
  const idxs = layout.bins.map((b) => b.idx);
  const lo = idxs[0], hi = idxs[idxs.length - 1];
  const around = (k: number) => idxs.filter((i) => i >= Math.max(lo, layout.curBin - k) && i <= Math.min(hi, layout.curBin + k));
  const out = [
    { key: 'near', label: 'Narrow', bins: around(2) },
    { key: 'half', label: 'Balanced', bins: around(Math.max(3, Math.round(idxs.length / 4))) },
    { key: 'full', label: 'Full', bins: idxs },
  ];
  return out.filter((p, i) => p.bins.length > 0 && out.findIndex((q) => q.bins.length === p.bins.length) === i);
}

/**
 * Add liquidity to a Metric pool, as a new position or into an existing one (`salt`), laid out like the other DEXes'
 * sheets: a range, the two token amounts (type either, the other follows the range), and the earnings at the pool's
 * 7 day APR. `simulate` opens it to try amounts without a wallet.
 */
export function MetricDepositSheet({ chainId, pool, salt: existingSalt, simulate = false, onClose, onDone }: {
  chainId: MetricChainId; pool: `0x${string}`; salt?: bigint; simulate?: boolean; onClose: () => void; onDone: () => void | Promise<void>;
}) {
  useScrollLock(true);
  const { width: sidebarWidth } = useSidebar();
  const { address } = useConnection();
  const config = useConfig();
  const { track } = useTx();
  const client = usePublicClient({ chainId: chainId as SupportedChainId }) as PublicClient | undefined;
  // One id for this sheet's new position, so a retry after a failure adds to the same one.
  const salt = useRef(existingSalt ?? newMetricSalt()).current;
  const [simMode, setSimMode] = useState(simulate);

  const [info, setInfo] = useState<MetricPoolInfo | null>(null);
  const [layout, setLayout] = useState<MetricPoolLayout | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    if (!client) return;
    Promise.all([fetchMetricPools(chainId, [pool]), readMetricLayout(client, chainId, pool)])
      .then(([m, l]) => { if (live) { setInfo(m.get(pool.toLowerCase()) ?? null); setLayout(l); } })
      .catch((e) => { if (live) setLoadErr(readableError(e, 'Could not load this pool.')); });
    return () => { live = false; };
  }, [client, chainId, pool]);

  const ranges = useMemo(() => (layout ? presets(layout) : []), [layout]);
  const [rangeKey, setRangeKey] = useState('half');
  const range = ranges.find((r) => r.key === rangeKey) ?? ranges[0];

  // The wrapped native side can be paid in the chain's coin, as on the other DEXes.
  const wrapped = wrappedNativeFor(chainId).toLowerCase();
  const wethSide: 0 | 1 | null = info ? (info.token0.toLowerCase() === wrapped ? 0 : info.token1.toLowerCase() === wrapped ? 1 : null) : null;
  const nativeSym = chainId === 56 ? 'BNB' : 'ETH';
  const [useNative, setUseNative] = useState(true);
  const native = wethSide != null && useNative ? wethSide : undefined;

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
  const spendable = (k: 0 | 1) => {
    if (!bal) return 0n;
    if (native === k) return bal.native > GAS_RESERVE[chainId] ? bal.native - GAS_RESERVE[chainId] : 0n;
    return k === 0 ? bal.token0 : bal.token1;
  };

  // The range's token mix, from a probe deposit worth about $1,000: typing one amount fills in the other from it.
  const [mix, setMix] = useState<{ key: string; ref: bigint; need0: bigint; need1: bigint } | null>(null);
  useEffect(() => {
    let live = true;
    if (!client || !info || !range) return;
    const price1 = info.price1 > 0 ? info.price1 : 1;
    const ref = parseUnits(String(Math.round(1_000 / price1) || 1), info.decimals1);
    planMetricDeposit(client, chainId, pool, range.bins, ref, false)
      .then((p) => { if (live) setMix({ key: range.key, ref, need0: p.need0, need1: p.need1 }); })
      .catch((e) => { if (live) setLoadErr(readableError(e, 'Could not read this range.')); });
    return () => { live = false; };
  }, [client, info, range, chainId, pool]);
  const mixNow = mix && range && mix.key === range.key ? mix : null;
  const onlySide: 0 | 1 | null = mixNow ? (mixNow.need1 === 0n ? 0 : mixNow.need0 === 0n ? 1 : null) : null;

  // Which box the user typed in; the other follows the range's mix.
  const [edited, setEdited] = useState<0 | 1>(1);
  const [amtStr, setAmtStr] = useState('');
  const inputSide: 0 | 1 = onlySide ?? edited;
  const decOf = (k: 0 | 1) => (info ? (k === 0 ? info.decimals0 : info.decimals1) : 18);
  const typed = useMemo(() => { try { return amtStr ? parseUnits(amtStr, decOf(inputSide)) : 0n; } catch { return 0n; } },
    // decOf reads info, listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [amtStr, inputSide, info]);
  const amounts: [bigint, bigint] = useMemo(() => {
    if (!mixNow || typed === 0n) return [0n, 0n];
    const typedNeed = inputSide === 0 ? mixNow.need0 : mixNow.need1;
    if (typedNeed === 0n) return [0n, 0n];
    return [(mixNow.need0 * typed) / typedNeed, (mixNow.need1 * typed) / typedNeed];
  }, [mixNow, typed, inputSide]);
  const usdOf = (k: 0 | 1, raw: bigint) => (info ? Number(formatUnits(raw, decOf(k))) * (k === 0 ? info.price0 : info.price1) : 0);
  const depositUsd = usdOf(0, amounts[0]) + usdOf(1, amounts[1]);
  // Within half a percent of the balance still fits: the deposit scales down to what the wallet holds.
  const over = (k: 0 | 1) => !!address && !simMode && !!bal && amounts[k] > spendable(k) + spendable(k) / 200n;
  const short: [boolean, boolean] = [over(0), over(1)];

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function deposit() {
    if (!client || !info || !address || !mixNow || !range) return;
    setBusy(true); setErr(null);
    try {
      // Scale the probe to the typed amount and size the real deposit at the current state.
      const typedNeed = inputSide === 0 ? mixNow.need0 : mixNow.need1;
      const total = (mixNow.ref * typed) / typedNeed;
      const plan: MetricDepositPlan = await planMetricDeposit(client, chainId, pool, range.bins, total, false, { token0: spendable(0), token1: spendable(1) });
      if (plan.short0 || plan.short1) throw new Error(`Not enough ${plan.short0 ? sym(0) : sym(1)}.`);
      await runCalls(config, {
        account: address,
        calls: metricDepositCalls({ chainId, pool, token0: info.token0, token1: info.token1, salt, plan, native }),
        label: `${existingSalt != null ? 'Add to' : 'Add liquidity'} ${info.symbol0}/${info.symbol1} on Metric`,
        track, chainId,
      });
      await onDone();
    } catch (e) {
      setErr(readableError(e, 'Liquidity was not added.'));
      setBalNonce((n) => n + 1);
    } finally { setBusy(false); }
  }

  const sym = (k: 0 | 1) => (!info ? '' : native === k ? nativeSym : k === 0 ? info.symbol0 : info.symbol1);
  const blocked = info?.paused ? 'This pool is paused right now.' : info?.allowlisted ? 'Only approved wallets can add to this pool.' : null;
  const hasAmount = amounts[0] > 0n || amounts[1] > 0n;
  const daily = info && depositUsd > 0 ? (depositUsd * info.apr7d) / 100 / 365 : 0;

  return (
    <Portal>
    <div onClick={busy ? undefined : onClose} style={{ position: 'fixed', top: 0, left: sidebarWidth, right: 0, bottom: 0, zIndex: 320, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 16px', overflowY: 'auto' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 460, background: 'rgba(var(--bg-rgb), 0.98)', border: '1px solid rgba(var(--fg-rgb), 0.1)', borderRadius: 28, padding: '12px 20px calc(24px + env(safe-area-inset-bottom, 0px))' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, paddingTop: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            {info && (
              <div style={{ display: 'flex', flexShrink: 0 }}>
                <TokenIcon symbol={info.symbol0} size={26} logoUrl={info.logo0}/>
                <div style={{ marginLeft: -8 }}><TokenIcon symbol={info.symbol1} size={26} logoUrl={info.logo1}/></div>
              </div>
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ color: btb.text, fontSize: 18, fontWeight: 800, letterSpacing: -0.4 }}>
                {simMode ? 'Simulate' : existingSalt != null ? 'Increase liquidity' : 'Add liquidity'}{info ? ` ${info.symbol0}/${info.symbol1}` : ''}
              </div>
              <div style={{ color: btb.textMuted, fontSize: 12 }}>Metric · {METRIC_CHAIN_NAMES[chainId]}{info ? ` · ${info.apr7d.toFixed(2)}% APR` : ''}</div>
            </div>
          </div>
          {!busy && <div onClick={onClose} style={{ cursor: 'pointer', padding: 4 }}><Icon name="close" size={16} color={btb.textMuted}/></div>}
        </div>

        {loadErr && <div style={{ color: btb.loss, fontSize: 13, padding: '8px 0 16px' }}>{loadErr}</div>}
        {!loadErr && (!info || !layout) && <div style={{ color: btb.textDim, fontSize: 13, padding: '24px 0', textAlign: 'center' }}>Loading the pool…</div>}

        {info && layout && (
          <>
            <div style={{ display: 'flex', background: 'rgba(var(--fg-rgb), 0.06)', borderRadius: 999, padding: 3, marginBottom: 6 }}>
              {ranges.map((r) => {
                const on = r.key === range?.key;
                return (
                  <button key={r.key} type="button" onClick={() => setRangeKey(r.key)} style={{ flex: 1, height: 32, borderRadius: 999, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 800, background: on ? btb.text : 'transparent', color: on ? 'rgba(var(--bg-rgb), 1)' : btb.textMuted }}>{r.label}</button>
                );
              })}
            </div>
            {range && (() => { const s = rangeOf(layout, range.bins); return s ? (
              <div style={{ color: btb.textDim, fontSize: 11.5, marginBottom: 12, textAlign: 'center' }}>{fmtOffset(s.lower)} to {fmtOffset(s.upper)} around the price, follows it automatically</div>
            ) : null; })()}

            {([0, 1] as const).filter((k) => onlySide == null || onlySide === k).map((k) => {
              const amt = amounts[k];
              const shown = inputSide === k ? amtStr : amt > 0n ? String(Number(Number(formatUnits(amt, decOf(k))).toPrecision(6))) : '';
              return (
                <div key={k} style={{ background: 'rgba(var(--fg-rgb), 0.05)', border: `1px solid ${short[k] ? 'rgba(var(--loss-rgb, 239,68,68), 0.6)' : 'rgba(var(--fg-rgb), 0.1)'}`, borderRadius: 14, padding: '10px 12px', marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, fontSize: 11.5 }}>
                    <span style={{ color: btb.textMuted, fontWeight: 700 }}>You deposit</span>
                    {address && <span style={{ color: short[k] ? btb.loss : btb.textDim }}>Bal: {bal ? fmtAmt(spendable(k), decOf(k)) : '…'}</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input value={shown} onChange={(e) => { setEdited(k); setAmtStr(e.target.value.replace(/[^0-9.]/g, '')); }} inputMode="decimal" placeholder="0" disabled={!mixNow}
                      style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', color: btb.text, fontSize: 24, fontWeight: 700, fontFamily: 'inherit', outline: 'none', padding: 0 }}/>
                    {wethSide === k ? (
                      <div style={{ display: 'flex', background: 'rgba(var(--fg-rgb), 0.08)', borderRadius: 999, padding: 2 }}>
                        {([nativeSym, k === 0 ? info.symbol0 : info.symbol1] as const).map((t, i) => {
                          const on = (i === 0) === useNative;
                          return <button key={t} type="button" onClick={() => setUseNative(i === 0)} style={{ height: 28, padding: '0 10px', borderRadius: 999, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 800, background: on ? btb.text : 'transparent', color: on ? 'rgba(var(--bg-rgb), 1)' : btb.textMuted }}>{t}</button>;
                        })}
                      </div>
                    ) : (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px 4px 5px', borderRadius: 10, background: 'rgba(var(--fg-rgb), 0.08)' }}>
                        <TokenIcon symbol={sym(k)} size={20} logoUrl={k === 0 ? info.logo0 : info.logo1}/>
                        <span style={{ color: btb.text, fontSize: 14, fontWeight: 800 }}>{sym(k)}</span>
                      </span>
                    )}
                  </div>
                  <div style={{ color: btb.textDim, fontSize: 11, marginTop: 3, minHeight: 15 }}>{amt > 0n && usdOf(k, amt) > 0 ? money(usdOf(k, amt)) : ''}</div>
                  {address && spendable(k) > 0n && (
                    <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                      {[25, 50, 75, 100].map((pct) => (
                        <button key={pct} type="button" onClick={() => { setEdited(k); setAmtStr(formatUnits((spendable(k) * BigInt(pct)) / 100n, decOf(k))); }} style={{
                          flex: 1, height: 24, borderRadius: 7, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 10.5, fontWeight: 800,
                          background: 'rgba(var(--fg-rgb), 0.05)', color: pct === 100 ? btb.green : btb.textMuted,
                        }}>{pct === 100 ? 'MAX' : `${pct}%`}</button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            <div style={{ color: btb.textMuted, fontSize: 12, marginTop: 2 }}>
              {onlySide != null ? `Only ${sym(onlySide)} goes in for this range.` : 'Type in either one; the other follows the range.'}
            </div>

            {hasAmount && (
              <Glass padding={12} radius={12} soft style={{ marginTop: 12 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[['Deposit', money(depositUsd), btb.text], ['Earnings a day', money(daily), 'var(--btb-green)'], ['A month', money(daily * 30), 'var(--btb-green)']].map(([label, value, color]) => (
                    <div key={label} style={{ flex: 1, background: 'rgba(var(--fg-rgb), 0.04)', borderRadius: 10, padding: '8px 10px' }}>
                      <div style={{ color: btb.textDim, fontSize: 10 }}>{label}</div>
                      <div style={{ color, fontSize: 14, fontWeight: 800 }}>{value}</div>
                    </div>
                  ))}
                </div>
                <div style={{ color: btb.textDim, fontSize: 10.5, marginTop: 8 }}>At the pool&apos;s {info.apr7d.toFixed(2)}% APR over the last 7 days. Not a promise: price moves are not included.</div>
              </Glass>
            )}

            {blocked && <div style={{ color: btb.amber, fontSize: 12, marginTop: 10 }}>{blocked}</div>}
            {err && <div style={{ color: btb.loss, fontSize: 12, marginTop: 10 }}>{err}</div>}

            {simMode ? (
              <Button variant="success" size="md" onClick={() => setSimMode(false)} disabled={!!blocked} style={{ marginTop: 16, minHeight: 48, borderRadius: 14, fontWeight: 800, fontSize: 15, width: '100%' }}>
                Add liquidity
              </Button>
            ) : (
              <Button variant="success" size="md" onClick={() => { if (!busy && hasAmount && !short[0] && !short[1] && !blocked && address) void deposit(); }}
                disabled={busy || !hasAmount || short[0] || short[1] || !!blocked || !address} style={{ marginTop: 16, minHeight: 48, borderRadius: 14, fontWeight: 800, fontSize: 15, width: '100%' }}>
                {busy ? 'Confirm in your wallet' : !address ? 'Connect a wallet' : short[0] || short[1] ? `Not enough ${short[0] ? sym(0) : sym(1)}` : hasAmount ? (existingSalt != null ? 'Increase liquidity' : 'Add liquidity') : 'Enter an amount'}
              </Button>
            )}
            {!simMode && <div style={{ color: btb.textDim, fontSize: 11, textAlign: 'center', marginTop: 10 }}>Token approvals are included automatically.</div>}
          </>
        )}
      </div>
    </div>
    </Portal>
  );
}
