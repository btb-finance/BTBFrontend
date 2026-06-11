'use client';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useConnection, useConfig } from 'wagmi';
import { getPublicClient } from 'wagmi/actions';
import { formatUnits, parseUnits, erc20Abi } from 'viem';
import { Glass } from './Glass';
import { Portal } from './Portal';
import { RangeChart } from './RangeChart';
import { btb } from './design-tokens';
import { useTx } from '../lib/TxTracker';
import { runCalls } from '../lib/txRunner';
import { getTokenPricesUsd } from '../lib/defillama';
import {
  fetchPoolsForMint, buildMint, rangeTicks, addAmounts, addSide, nearestUsableTick,
  liquidityForAmounts, getPoolHistory, hasGraphKey, V3_SUBGRAPH_ID,
  TICK_SPACINGS, MIN_TICK, MAX_TICK, FEE_TIERS, isWeth, type MintPool, type PoolDay,
} from '@/protocols/dexs/uniswap';

const SLIPPAGE_BPS = 50; // 0.5%
const FEE_LABEL: Record<number, string> = { 100: '0.01%', 500: '0.05%', 3000: '0.3%', 10000: '1%' };
const RANGE_PRESETS: { label: string; pct: number | null }[] = [
  { label: '±5%', pct: 5 }, { label: '±10%', pct: 10 }, { label: '±25%', pct: 25 }, { label: 'Full', pct: null },
];
type RangeMode = number | null | 'custom';

function fmtAmt(raw: bigint, decimals: number): string {
  const n = parseFloat(formatUnits(raw, decimals));
  if (n === 0) return '0';
  if (n < 0.0001) return '<0.0001';
  return n.toLocaleString('en-US', { maximumFractionDigits: 6 });
}

/** price of token0 in token1 (human units) at a tick. */
function tickToPrice(tick: number, d0: number, d1: number): number {
  return 1.0001 ** tick * 10 ** (d0 - d1);
}

/** Plain re-parseable price string for the min/max inputs. */
function fmtPrice(p: number): string {
  if (!isFinite(p)) return '∞';
  if (p <= 1e-30) return '0';
  return parseFloat(p.toPrecision(6)).toString();
}

/** Min/max price strings -> snapped usable ticks. '0'/'∞'/empty = open-ended. */
function ticksFromPrices(minStr: string, maxStr: string, pool: MintPool, spacing: number) {
  const ln = Math.log(1.0001);
  const toTick = (p: number) => Math.round(Math.log(p * 10 ** (pool.decimals1 - pool.decimals0)) / ln);
  const lo = parseFloat(minStr);
  const hi = parseFloat(maxStr);
  const tickLower = isFinite(lo) && lo > 0 ? nearestUsableTick(toTick(lo), spacing) : nearestUsableTick(MIN_TICK, spacing);
  let tickUpper = isFinite(hi) && hi > 0 ? nearestUsableTick(toTick(hi), spacing) : nearestUsableTick(MAX_TICK, spacing);
  if (tickUpper <= tickLower) tickUpper = tickLower + spacing;
  return { tickLower, tickUpper };
}

/**
 * Create a brand-new Uniswap V3 position (Ethereum mainnet) for a token pair.
 * Pick a fee tier + range (presets or custom min/max price, snapped to ticks),
 * enter either token's amount (the other side is auto-paired at the current
 * price), and mint with slippage protection (approvals batched in).
 */
export function CreateV3Position({ tokenA, tokenB, initialFee, fees24hUsd, onClose, onDone }: {
  tokenA: `0x${string}`; tokenB: `0x${string}`;
  /** Fee tier of the pool the user clicked — preselected when valid. */
  initialFee?: number;
  /** Pool's recent daily LP fees (USD) — earnings fallback when no Graph key. */
  fees24hUsd?: number;
  onClose: () => void; onDone?: () => void;
}) {
  const { address } = useConnection();
  const config = useConfig();
  const { track } = useTx();

  const [fee, setFee] = useState(
    initialFee !== undefined && (FEE_TIERS as readonly number[]).includes(initialFee) ? initialFee : 3000,
  );
  // All fee tiers are fetched in one batch up front — switching tiers is instant.
  const [pools, setPools] = useState<Record<number, MintPool> | null>(null);
  const [loadingPool, setLoadingPool] = useState(true);
  const [poolErr, setPoolErr] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const [rangeMode, setRangeMode] = useState<RangeMode>(10);
  const [minStr, setMinStr] = useState('');
  const [maxStr, setMaxStr] = useState('');
  const [amt, setAmt] = useState<{ side: 0 | 1; str: string }>({ side: 0, str: '' });
  const [useEth, setUseEth] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [bal0, setBal0] = useState(0n);
  const [bal1, setBal1] = useState(0n);
  const [ethBal, setEthBal] = useState(0n);
  const [history, setHistory] = useState<PoolDay[] | null>(null);
  const [usd, setUsd] = useState<Record<string, number>>({});

  const pool = pools?.[fee] ?? null;

  // Which sorted token (if any) is WETH — lets the user deposit native ETH.
  const wethSide: 0 | 1 | null = pool ? (isWeth(pool.token0) ? 0 : isWeth(pool.token1) ? 1 : null) : null;
  const ethMode = wethSide !== null && useEth;
  const sym0 = pool ? (ethMode && wethSide === 0 ? 'ETH' : pool.symbol0) : '';
  const sym1 = pool ? (ethMode && wethSide === 1 ? 'ETH' : pool.symbol1) : '';

  useEffect(() => {
    let live = true;
    setLoadingPool(true); setPools(null); setPoolErr(null);
    const client = getPublicClient(config);
    if (!client) { setLoadingPool(false); setPoolErr('No RPC client'); return; }
    fetchPoolsForMint(client, tokenA, tokenB)
      .then((record) => {
        if (!live) return;
        setPools(record);
        // If the preselected tier has no pool, jump to the deepest existing one.
        setFee((f) => {
          if (record[f]?.exists) return f;
          const best = FEE_TIERS.filter((t) => record[t]?.exists)
            .sort((a, b) => (record[b].liquidity > record[a].liquidity ? 1 : -1))[0];
          return best ?? f;
        });
      })
      .catch((e: Error) => { if (live) setPoolErr(e?.message ?? 'network error'); })
      .finally(() => { if (live) setLoadingPool(false); });
    return () => { live = false; };
  }, [config, tokenA, tokenB, retryNonce]);

  // 30-day price/fee history (chart + earnings sim) and token USD prices.
  useEffect(() => {
    let live = true;
    setHistory(null);
    if (!pool || !pool.exists) return;
    if (hasGraphKey) {
      getPoolHistory(V3_SUBGRAPH_ID, pool.address)
        .then((h) => { if (live) setHistory(h); })
        .catch(() => {}); // chart/sim are progressive extras — never block minting
    }
    getTokenPricesUsd([pool.token0, pool.token1])
      .then((p) => { if (live) setUsd(p); })
      .catch(() => {});
    return () => { live = false; };
  }, [pool]);

  const spacing = TICK_SPACINGS[fee];
  const ticks = useMemo(() => {
    if (!pool || !pool.exists) return null;
    if (rangeMode !== 'custom') return rangeTicks(pool.tick, spacing, rangeMode);
    return ticksFromPrices(minStr, maxStr, pool, spacing);
  }, [pool, spacing, rangeMode, minStr, maxStr]);

  // Keep the min/max price inputs in sync with the selected preset.
  useEffect(() => {
    if (!pool || !pool.exists || rangeMode === 'custom') return;
    const t = rangeTicks(pool.tick, spacing, rangeMode);
    setMinStr(fmtPrice(tickToPrice(t.tickLower, pool.decimals0, pool.decimals1)));
    setMaxStr(fmtPrice(tickToPrice(t.tickUpper, pool.decimals0, pool.decimals1)));
  }, [pool, spacing, rangeMode]);

  // price of token0 in token1 (human units)
  const price = useMemo(() => {
    if (!pool || !pool.exists) return 0;
    const p = (Number(pool.sqrtPriceX96) / 2 ** 96) ** 2;
    return p * 10 ** (pool.decimals0 - pool.decimals1);
  }, [pool]);

  // Which side(s) the range needs at the current price.
  const need = useMemo(
    () => (pool && pool.exists && ticks ? addSide(pool.sqrtPriceX96, ticks.tickLower, ticks.tickUpper) : 'both'),
    [pool, ticks],
  );

  // user inputs EITHER token amount; pair the other side at the current price
  const { add0, add1 } = useMemo(() => {
    if (!pool || !pool.exists || !ticks || !amt.str || parseFloat(amt.str) <= 0) return { add0: 0n, add1: 0n };
    try {
      const raw = parseUnits(amt.str, amt.side === 0 ? pool.decimals0 : pool.decimals1);
      const r = addAmounts(pool.sqrtPriceX96, ticks.tickLower, ticks.tickUpper, amt.side, raw);
      return { add0: r.amount0, add1: r.amount1 };
    } catch { return { add0: 0n, add1: 0n }; }
  }, [pool, ticks, amt]);

  // ── Earnings simulation (Metrix-style) ─────────────────────────────────────
  // est. daily fees = pool's avg daily LP fees × your share of in-range
  // liquidity. Your liquidity comes from LiquidityAmounts math; the pool's
  // current in-range liquidity is read on-chain. Holds while price stays in
  // range and volume stays at recent levels.
  const sim = useMemo(() => {
    if (!pool || !pool.exists || !ticks || (add0 === 0n && add1 === 0n)) return null;
    // avg daily fees over the last complete 7 days (subgraph), else the list's 24h figure
    const todayBucket = Math.floor(Date.now() / 1000 / 86400) * 86400;
    const days = (history ?? []).filter((d) => d.date < todayBucket).slice(-7);
    const avgFees = days.length > 0 ? days.reduce((s, d) => s + d.feesUsd, 0) / days.length : fees24hUsd ?? 0;
    if (avgFees <= 0) return null;

    const inRange = addSide(pool.sqrtPriceX96, ticks.tickLower, ticks.tickUpper) === 'both';
    const L = liquidityForAmounts(pool.sqrtPriceX96, ticks.tickLower, ticks.tickUpper, add0, add1);
    const share = inRange && pool.liquidity + L > 0n ? Number(L) / Number(pool.liquidity + L) : 0;
    const daily = avgFees * share;

    // deposit value in USD — derive a missing token price from the pool price
    let p0 = usd[pool.token0.toLowerCase()];
    let p1 = usd[pool.token1.toLowerCase()];
    if (!p0 && p1 && price > 0) p0 = price * p1;
    if (!p1 && p0 && price > 0) p1 = p0 / price;
    const depositUsd = (p0 && p1)
      ? parseFloat(formatUnits(add0, pool.decimals0)) * p0 + parseFloat(formatUnits(add1, pool.decimals1)) * p1
      : 0;

    return {
      daily, monthly: daily * 30, yearly: daily * 365,
      apr: depositUsd > 0 ? (daily * 365 / depositUsd) * 100 : null,
      depositUsd, sharePct: share * 100, inRange,
    };
  }, [pool, ticks, add0, add1, history, usd, fees24hUsd, price]);

  // wallet balances of both tokens (+ native ETH)
  useEffect(() => {
    let live = true;
    const client = getPublicClient(config);
    if (!client || !address || !pool) return;
    (async () => {
      try {
        const [b0, b1] = await client.multicall({
          contracts: [
            { address: pool.token0, abi: erc20Abi, functionName: 'balanceOf', args: [address as `0x${string}`] },
            { address: pool.token1, abi: erc20Abi, functionName: 'balanceOf', args: [address as `0x${string}`] },
          ],
          allowFailure: true,
        });
        const eb = await client.getBalance({ address: address as `0x${string}` });
        if (live) {
          setBal0(b0.status === 'success' ? (b0.result as bigint) : 0n);
          setBal1(b1.status === 'success' ? (b1.result as bigint) : 0n);
          setEthBal(eb);
        }
      } catch { /* read failure — treat as unknown */ }
    })();
    return () => { live = false; };
  }, [config, address, pool]);

  const effBal0 = ethMode && wethSide === 0 ? ethBal : bal0;
  const effBal1 = ethMode && wethSide === 1 ? ethBal : bal1;
  const short0 = add0 > effBal0;
  const short1 = add1 > effBal1;

  async function mint() {
    if (!address || !pool || !ticks) return;
    setBusy(true); setErr(null);
    try {
      const calls = buildMint({
        token0: pool.token0, token1: pool.token1, fee,
        tickLower: ticks.tickLower, tickUpper: ticks.tickUpper,
        amount0Desired: add0, amount1Desired: add1,
        slippageBps: SLIPPAGE_BPS, recipient: address as `0x${string}`,
        nativeEthSide: ethMode ? wethSide : null,
      });
      await runCalls(config, { account: address as `0x${string}`, calls, label: `Add ${pool.symbol0}/${pool.symbol1} liquidity`, track });
      onDone?.();
      onClose();
    } catch (e) {
      setErr((e as { shortMessage?: string })?.shortMessage ?? (e as Error)?.message ?? 'Failed');
    } finally { setBusy(false); }
  }

  const canMint = !!pool?.exists && !!ticks && (add0 > 0n || add1 > 0n) && !short0 && !short1 && !busy;

  const inputStyle = (disabled: boolean): CSSProperties => ({
    width: '100%', height: 48, background: disabled ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, padding: '0 14px',
    color: disabled ? btb.textDim : btb.text, fontSize: 18, fontWeight: 700, fontFamily: 'inherit',
    outline: 'none', boxSizing: 'border-box',
  });

  // Plain render helper (NOT a nested component — a nested component type would
  // remount the <input> on every keystroke and drop focus).
  function renderAmountInput(side: 0 | 1) {
    if (!pool) return null;
    const sym = side === 0 ? sym0 : sym1;
    const dec = side === 0 ? pool.decimals0 : pool.decimals1;
    const bal = side === 0 ? effBal0 : effBal1;
    const computed = side === 0 ? add0 : add1;
    // The range may only take one token — the other side stays at 0.
    const disabled = need === (side === 0 ? 'token1' : 'token0');
    const value = disabled ? '0' : amt.side === side ? amt.str : computed > 0n ? formatUnits(computed, dec) : '';
    return (
      <div key={side} style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ color: btb.textMuted, fontSize: 12 }}>{sym}{disabled ? ' (not needed in this range)' : ''}</span>
          <span style={{ color: btb.textMuted, fontSize: 12 }}>
            Balance: {fmtAmt(bal, dec)}
            {!disabled && (
              <span onClick={() => setAmt({ side, str: formatUnits(bal, dec) })} style={{ color: btb.red, fontWeight: 700, marginLeft: 6, cursor: 'pointer' }}>MAX</span>
            )}
          </span>
        </div>
        <input
          value={value}
          disabled={disabled}
          onChange={(e) => setAmt({ side, str: e.target.value.replace(/[^0-9.]/g, '') })}
          inputMode="decimal" placeholder="0"
          style={inputStyle(disabled)}/>
      </div>
    );
  }

  return (
    <Portal>
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 340, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, background: 'rgba(10,10,15,0.98)', borderTop: '1px solid rgba(255,255,255,0.1)', borderRadius: '28px 28px 0 0', padding: '12px 20px calc(32px + env(safe-area-inset-bottom, 0px))', maxHeight: '88vh', overflowY: 'auto' }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.18)', margin: '0 auto 16px' }}/>
        <div style={{ color: btb.text, fontSize: 19, fontWeight: 800, letterSpacing: -0.4 }}>Add liquidity</div>
        <div style={{ color: btb.textMuted, fontSize: 13, marginTop: 2, marginBottom: 16 }}>
          {pool ? `${pool.symbol0} / ${pool.symbol1}` : 'Uniswap V3 · Ethereum'}
        </div>

        {/* Fee tier */}
        <div style={{ color: btb.textMuted, fontSize: 12, marginBottom: 6 }}>Fee tier</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {FEE_TIERS.map((f) => {
            const missing = !!pools && !pools[f]?.exists;
            return (
              <button key={f} onClick={() => setFee(f)} disabled={missing} style={{
                flex: 1, height: 38, borderRadius: 12, cursor: missing ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                background: fee === f ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${fee === f ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.1)'}`,
                color: fee === f ? '#fff' : btb.textMuted,
                opacity: missing ? 0.35 : 1,
              }} title={missing ? 'No pool at this fee tier' : undefined}>{FEE_LABEL[f]}</button>
            );
          })}
        </div>

        {loadingPool ? (
          <div style={{ color: btb.textDim, fontSize: 13, padding: '8px 0' }}>Checking pool…</div>
        ) : poolErr ? (
          <div style={{ padding: '8px 0' }}>
            <div style={{ color: btb.loss, fontSize: 13 }}>Couldn&apos;t load the pool — {poolErr}</div>
            <button onClick={() => setRetryNonce((n) => n + 1)} style={{
              marginTop: 10, height: 36, padding: '0 18px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 13, fontWeight: 700, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.16)', color: btb.text,
            }}>Retry</button>
          </div>
        ) : !pool?.exists ? (
          <div style={{ color: '#FFB36B', fontSize: 13, padding: '8px 0' }}>No pool at this fee tier — try another.</div>
        ) : (
          <>
            <div style={{ color: btb.textMuted, fontSize: 12, marginBottom: 12 }}>
              Current price: 1 {pool.symbol0} = {price.toLocaleString('en-US', { maximumSignificantDigits: 6 })} {pool.symbol1}
            </div>

            {wethSide !== null && (
              <div onClick={() => setUseEth((v) => !v)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: 16, background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '10px 14px' }}>
                <span style={{ color: btb.text, fontSize: 13, fontWeight: 600 }}>Pay with ETH <span style={{ color: btb.textDim, fontWeight: 400 }}>(instead of WETH)</span></span>
                <div style={{ width: 42, height: 24, borderRadius: 999, background: useEth ? '#52E3A4' : 'rgba(255,255,255,0.18)', position: 'relative', transition: 'background 0.2s' }}>
                  <div style={{ position: 'absolute', top: 2, left: useEth ? 20 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }}/>
                </div>
              </div>
            )}

            {/* Range — presets or custom min/max price */}
            <div style={{ color: btb.textMuted, fontSize: 12, marginBottom: 6 }}>Price range</div>
            {history && history.length > 1 && (
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '10px 8px 4px', marginBottom: 10 }}>
                <RangeChart
                  points={history.map((d) => d.price0)}
                  min={rangeMode === null ? null : parseFloat(minStr) > 0 ? parseFloat(minStr) : null}
                  max={rangeMode === null ? null : isFinite(parseFloat(maxStr)) && parseFloat(maxStr) > 0 ? parseFloat(maxStr) : null}
                  current={price}
                  onChange={(lo, hi) => {
                    setRangeMode('custom');
                    setMinStr(fmtPrice(lo));
                    setMaxStr(fmtPrice(hi));
                  }}/>
                <div style={{ color: btb.textDim, fontSize: 10, textAlign: 'center', padding: '4px 0 6px' }}>
                  30-day price · {pool.symbol1} per {pool.symbol0} · drag the handles to set your range
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              {RANGE_PRESETS.map((r) => (
                <button key={r.label} onClick={() => setRangeMode(r.pct)} style={{
                  flex: 1, height: 38, borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                  background: rangeMode === r.pct ? 'rgba(82,227,164,0.18)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${rangeMode === r.pct ? 'rgba(82,227,164,0.5)' : 'rgba(255,255,255,0.1)'}`,
                  color: rangeMode === r.pct ? '#52E3A4' : btb.textMuted,
                }}>{r.label}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 6 }}>
              <div style={{ flex: 1 }}>
                <div style={{ color: btb.textDim, fontSize: 11, marginBottom: 4 }}>Min price ({pool.symbol1} per {pool.symbol0})</div>
                <input value={minStr} inputMode="decimal" placeholder="0"
                  onChange={(e) => { setMinStr(e.target.value); setRangeMode('custom'); }}
                  style={{ ...inputStyle(false), height: 44, fontSize: 15 }}/>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: btb.textDim, fontSize: 11, marginBottom: 4 }}>Max price ({pool.symbol1} per {pool.symbol0})</div>
                <input value={maxStr} inputMode="decimal" placeholder="∞"
                  onChange={(e) => { setMaxStr(e.target.value); setRangeMode('custom'); }}
                  style={{ ...inputStyle(false), height: 44, fontSize: 15 }}/>
              </div>
            </div>
            {ticks && (
              <div style={{ color: btb.textDim, fontSize: 11, marginBottom: 16 }}>
                Ticks {ticks.tickLower} → {ticks.tickUpper} · spacing {spacing} · current tick {pool.tick}
                {rangeMode === 'custom' ? ' · snapped to nearest usable tick' : ''}
              </div>
            )}

            {/* Amounts — enter either side, the other is paired automatically */}
            {renderAmountInput(0)}
            {renderAmountInput(1)}

            {need !== 'both' && (
              <div style={{ color: '#FFB36B', fontSize: 12, marginBottom: 10 }}>
                Current price is outside this range — the position takes {need === 'token0' ? sym0 : sym1} only and won&apos;t earn fees until price enters the range.
              </div>
            )}
            {(short0 || short1) && (
              <div style={{ color: btb.loss, fontSize: 12, marginBottom: 10 }}>
                Insufficient {short0 ? sym0 : sym1} balance
              </div>
            )}
            {(add0 > 0n || add1 > 0n) && (
              <Glass padding={12} radius={12} soft>
                <div style={{ color: btb.textMuted, fontSize: 12, marginBottom: 4 }}>You deposit</div>
                <div style={{ color: btb.text, fontSize: 14, fontWeight: 700 }}>
                  {fmtAmt(add0, pool.decimals0)} {sym0} + {fmtAmt(add1, pool.decimals1)} {sym1}
                  {sim && sim.depositUsd > 0 && <span style={{ color: btb.textMuted, fontWeight: 600 }}> (≈${sim.depositUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })})</span>}
                </div>
              </Glass>
            )}

            {/* Estimated earnings — fees × your share of in-range liquidity */}
            {sim && sim.inRange && sim.daily > 0 && (
              <Glass padding={12} radius={12} soft style={{ marginTop: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ color: btb.textMuted, fontSize: 12 }}>Estimated earnings · current volume</span>
                  {sim.apr !== null && (
                    <span style={{ color: '#52E3A4', fontSize: 13, fontWeight: 800 }}>~{sim.apr.toFixed(1)}% APR</span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {([['Daily', sim.daily], ['Monthly', sim.monthly], ['Yearly', sim.yearly]] as const).map(([label, v]) => (
                    <div key={label} style={{ flex: 1, background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '8px 10px' }}>
                      <div style={{ color: btb.textDim, fontSize: 10 }}>{label}</div>
                      <div style={{ color: btb.text, fontSize: 14, fontWeight: 800 }}>
                        ${v >= 100 ? v.toLocaleString('en-US', { maximumFractionDigits: 0 }) : v.toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ color: btb.textDim, fontSize: 10, marginTop: 8, lineHeight: 1.4 }}>
                  {history ? '7-day avg' : 'Latest 24h'} pool fees × your {sim.sharePct < 0.01 ? '<0.01' : sim.sharePct.toFixed(2)}% share of in-range liquidity. Assumes price stays in range and volume holds — not a guarantee.
                </div>
              </Glass>
            )}
          </>
        )}

        {err && <div style={{ color: btb.loss, fontSize: 12, marginTop: 12 }}>{err}</div>}

        <button onClick={mint} disabled={!canMint} style={{
          width: '100%', height: 56, borderRadius: 18, border: 'none', marginTop: 18, fontFamily: 'inherit', fontSize: 16, fontWeight: 800,
          cursor: canMint ? 'pointer' : 'default',
          background: canMint ? 'linear-gradient(135deg,#52E3A4,#1aad77)' : 'rgba(255,255,255,0.07)',
          color: canMint ? '#fff' : btb.textDim,
        }}>{busy ? 'Confirming…' : (short0 || short1) ? 'Insufficient balance' : 'Add liquidity'}</button>
        <div style={{ color: btb.textDim, fontSize: 11, textAlign: 'center', marginTop: 10, lineHeight: 1.5 }}>
          Slippage-protected ({SLIPPAGE_BPS / 100}%). Approvals included.{wethSide !== null ? ' Pay with ETH or WETH.' : ''}
        </div>
      </div>
    </div>
    </Portal>
  );
}
