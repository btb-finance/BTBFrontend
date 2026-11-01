'use client';
import { useEffect, useMemo, useState } from 'react';
import { useConfig } from 'wagmi';
import { getPublicClient } from 'wagmi/actions';
import { btb } from './design-tokens';
import { tickToPrice } from '@/protocols/dexs/uniswap/shared';
import type { LiquidityPosition } from '@/protocols/types';
import { deploymentOfPosition, v4DeploymentOfPosition } from '@/protocols/lpChains';
import { POOL_ABI } from '@/protocols/dexs/uniswap/v3/abis';
import { poolAddressOf } from '@/protocols/dexs/uniswap/v3/pool';
import { fetchTickLiquidityDistribution, type TickLiquidityPoint } from '@/protocols/dexs/uniswap/v3/ticks';
import { fetchV4TickLiquidityDistribution } from '@/protocols/dexs/uniswap/v4/ticks';
import { poolIdOf } from '@/protocols/dexs/uniswap';
import { STATE_VIEW_ABI } from '@/protocols/dexs/uniswap/v4/abis';

/**
 * One position on one strip: the pool's liquidity depth as a faint histogram,
 * your range as a band, and the live price as a marker. Depth is read lazily
 * per card.
 */
/** The two sides of a range: what it holds below the price (quote token) and above it (base token). */
const QUOTE_RGB = '59, 130, 246';
const BASE_RGB = '139, 92, 246';

/** The colour each token of a position gets on its range strip, so the card's token boxes can wear the same one. */
export function rangeSideRgb(p: LiquidityPosition): { rgb0: string; rgb1: string } {
  const v = tickToPrice(p.currentTick, p.decimals0, p.decimals1);
  const flip = v > 0 && v < 1;
  // Unflipped, token0 is the base (above the price) and token1 the quote (below it); flipped, the other way round.
  return flip ? { rgb0: QUOTE_RGB, rgb1: BASE_RGB } : { rgb0: BASE_RGB, rgb1: QUOTE_RGB };
}

/** Five significant digits: 137.09, 0.0041523, 2,214.5. */
const fmtSig = (v: number) => (v >= 1000 ? v.toLocaleString('en-US', { maximumFractionDigits: 1 }) : Number(v.toPrecision(5)).toString());

export function RangeStrip({ p }: { p: LiquidityPosition }) {
  const config = useConfig();
  const [depth, setDepth] = useState<TickLiquidityPoint[] | null>(null);
  const chainId = p.chainId ?? 1;
  const fullRange = p.tickLower <= -887200 && p.tickUpper >= 887200;
  const isV4 = p.protocol === 'uniswap-v4';

  useEffect(() => {
    let live = true;
    const client = getPublicClient(config, { chainId });
    if (!client) return;
    void (async () => {
      try {
        const spacing = p.tickSpacing ?? deploymentOfPosition(p).tickSpacings[p.fee] ?? 60;
        if (isV4) {
          const d = v4DeploymentOfPosition(p);
          const key = { currency0: p.token0, currency1: p.token1, fee: p.fee, tickSpacing: spacing, hooks: p.hooks ?? '0x0000000000000000000000000000000000000000' as `0x${string}` };
          const id = poolIdOf(key);
          const liq = await client.readContract({ address: d.stateView, abi: STATE_VIEW_ABI, functionName: 'getLiquidity', args: [id] }) as bigint;
          const dist = await fetchV4TickLiquidityDistribution(client, id, p.currentTick, liq, spacing, d.stateView).catch(() => []);
          if (live) setDepth(dist);
          return;
        }
        const d = deploymentOfPosition(p);
        const pool = await poolAddressOf(client, d, p.token0, p.token1, d.slipstream ? spacing : p.fee);
        if (!pool || /^0x0{40}$/.test(pool)) throw new Error('no pool');
        // Algebra keeps its ticks in a different structure; the band and price still draw without depth.
        if (d.algebra) return;
        const liq = await client.readContract({ address: pool, abi: POOL_ABI, functionName: 'liquidity' }) as bigint;
        const dist = await fetchTickLiquidityDistribution(client, pool, p.currentTick, liq, spacing).catch(() => []);
        if (live) setDepth(dist);
      } catch { /* no depth: the band and price still draw */ }
    })();
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.id.toString(), chainId]);

  // Window: the range plus a quarter each side (full range: a wide band around price).
  const span = fullRange ? 20_000 : Math.max(1, p.tickUpper - p.tickLower);
  // A margin either side of the range wide enough for the min and max labels inside the bar, even on a phone.
  const winLo = fullRange ? p.currentTick - span / 2 : p.tickLower - span * 0.45;
  const winHi = fullRange ? p.currentTick + span / 2 : p.tickUpper + span * 0.45;
  const raw = (tick: number) => Math.max(0, Math.min(100, ((tick - winLo) / (winHi - winLo)) * 100));
  const tone = p.inRange ? btb.green : btb.amber;
  const rawNow = tickToPrice(p.currentTick, p.decimals0, p.decimals1);
  // Quote the price the way people read it, at 1 or more: "1 AMZNc = 241 USDC", not "1 USDC = 0.00415 AMZNc". Flipped,
  // the strip is mirrored too, so a higher price is always to the right.
  const flip = rawNow > 0 && rawNow < 1;
  const pct = (tick: number) => (flip ? 100 - raw(tick) : raw(tick));
  const base = flip ? p.symbol1 : p.symbol0, quote = flip ? p.symbol0 : p.symbol1;
  const priceAt = (tick: number) => { const v = tickToPrice(tick, p.decimals0, p.decimals1); return flip ? (v > 0 ? 1 / v : 0) : v; };
  const pNow = priceAt(p.currentTick);
  const [pLow, pHigh] = flip ? [priceAt(p.tickUpper), priceAt(p.tickLower)] : [priceAt(p.tickLower), priceAt(p.tickUpper)];
  const bandL = fullRange ? 0 : Math.min(pct(p.tickLower), pct(p.tickUpper)), bandR = fullRange ? 100 : Math.max(pct(p.tickLower), pct(p.tickUpper)), mark = pct(p.currentTick);
  // Out of range, the position holds only one token: below the range (in pool terms) token0, above it token1.
  const below = p.currentTick < p.tickLower, above = p.currentTick >= p.tickUpper;
  const heldSymbol = below ? p.symbol0 : above ? p.symbol1 : null;
  const priceAbove = pNow > pHigh, priceBelow = pNow < pLow;
  const awayPct = priceAbove ? (pNow / pHigh - 1) * 100 : priceBelow ? (1 - pNow / pLow) * 100 : 0;
  const away = awayPct >= 10 ? awayPct.toFixed(0) : awayPct >= 0.1 ? awayPct.toFixed(1) : awayPct.toFixed(2);
  const pctText = (v: number) => (Math.abs(v) >= 10 ? v.toFixed(0) : Math.abs(v) >= 0.1 ? v.toFixed(1) : v.toFixed(2));
  // Each end's distance from the price now, signed: how far the price can move before it leaves the range.
  const fromNow = (end: number) => (pNow > 0 ? (end / pNow - 1) * 100 : 0);
  const signed = (v: number) => `${v > 0 ? '+' : ''}${pctText(v)}%`;

  // Depth bars inside the window, normalised to the tallest.
  const bars = useMemo(() => {
    if (!depth || depth.length === 0) return [];
    const tickOf = (price: number) => Math.log(price * 10 ** (p.decimals1 - p.decimals0)) / Math.log(1.0001);
    const inWin = depth.map((d) => ({ tick: tickOf(d.price), liq: d.liquidity })).filter((d) => Number.isFinite(d.tick) && d.tick >= winLo && d.tick <= winHi);
    const max = Math.max(1, ...inWin.map((d) => d.liq));
    return inWin.map((d) => ({ x: pct(d.tick), h: d.liq / max }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depth, winLo, winHi]);

  const edge = (label: string, price: number, right: boolean) => (
    <span style={{ position: 'absolute', [right ? 'right' : 'left']: 7, top: '50%', transform: 'translateY(-50%)', textAlign: right ? 'right' : 'left', lineHeight: 1.2, whiteSpace: 'nowrap', pointerEvents: 'none' }}>
      <span style={{ display: 'block', color: btb.textDim, fontSize: 9.5, fontWeight: 600 }}>{label}</span>
      <span style={{ color: btb.textMuted, fontSize: 11, fontWeight: 700 }}>{fmtSig(price)}</span>
    </span>
  );
  return (
    <div>
      {/* The price; how far each end of the range is from it is written at the ends of the bar. */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span title={`Prices in ${quote} per ${base}`} style={{ color: tone, fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
          1 {base} = {fmtSig(pNow)} {quote}
        </span>
        {fullRange && <span style={{ flexShrink: 0, color: btb.textMuted, fontSize: 11, fontWeight: 800 }}>Full range</span>}
      </div>
      <div style={{ position: 'relative', height: 32, marginTop: 8, borderRadius: 8, overflow: 'hidden', background: 'rgba(var(--fg-rgb), 0.04)' }}>
        {/* liquidity depth: where the other LPs sit */}
        <svg viewBox="0 0 100 44" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
          {bars.map((b, i) => <rect key={i} x={b.x - 0.6} y={44 - b.h * 40} width={1.2} height={b.h * 40} fill="rgba(var(--fg-rgb), 0.14)" />)}
        </svg>
        {/* Your range in two colours, the same as the token boxes above: below the price it holds the quote token, above
            it the base token. Out of range it is all one of them. */}
        {[
          { from: bandL, to: Math.min(bandR, Math.max(bandL, mark)), rgb: QUOTE_RGB, k: 'q' },
          { from: Math.max(bandL, Math.min(bandR, mark)), to: bandR, rgb: BASE_RGB, k: 'b' },
        ].filter((seg) => seg.to - seg.from > 0.2).map((seg) => (
          <div key={seg.k} style={{ position: 'absolute', top: 0, bottom: 0, left: `${seg.from}%`, width: `${seg.to - seg.from}%`, background: `rgba(${seg.rgb}, 0.2)` }}/>
        ))}
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: `calc(${mark}% - 1px)`, width: 2, background: tone }} />
        {!fullRange && edge(`min ${signed(fromNow(pLow))}`, pLow, false)}
        {!fullRange && edge(`max ${signed(fromNow(pHigh))}`, pHigh, true)}
      </div>
      {/* Out of range, what that means; in range the green badge already says it. */}
      {!fullRange && !p.inRange && (
        <div style={{ color: btb.amber, fontSize: 11.5, marginTop: 6, lineHeight: 1.4 }}>
          The price is {priceAbove ? 'above' : 'below'} your range by {away}%: it is all {heldSymbol} and earns no fees until the price comes back.
        </div>
      )}
    </div>
  );
}
