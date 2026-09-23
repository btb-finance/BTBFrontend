'use client';
import { useEffect, useMemo, useState } from 'react';
import { useConfig } from 'wagmi';
import { getPublicClient } from 'wagmi/actions';
import { btb } from './design-tokens';
import { fmtPrice } from './LpCardParts';
import { tickToPrice } from '@/protocols/dexs/uniswap/shared';
import type { LiquidityPosition } from '@/protocols/types';
import { deploymentOfPosition, v4DeploymentOfPosition } from '@/protocols/lpChains';
import { FACTORY_ABI, SLIPSTREAM_FACTORY_ABI, POOL_ABI } from '@/protocols/dexs/uniswap/v3/abis';
import { fetchTickLiquidityDistribution, type TickLiquidityPoint } from '@/protocols/dexs/uniswap/v3/ticks';
import { fetchV4TickLiquidityDistribution } from '@/protocols/dexs/uniswap/v4/ticks';
import { poolIdOf } from '@/protocols/dexs/uniswap';
import { STATE_VIEW_ABI } from '@/protocols/dexs/uniswap/v4/abis';

/**
 * One position on one strip: the pool's liquidity depth as a faint histogram,
 * your range as a band, and the live price as a marker. Depth is read lazily
 * per card.
 */
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
    (async () => {
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
        const pool = d.slipstream
          ? await client.readContract({ address: d.factory, abi: SLIPSTREAM_FACTORY_ABI, functionName: 'getPool', args: [p.token0, p.token1, spacing] }) as `0x${string}`
          : await client.readContract({ address: d.factory, abi: FACTORY_ABI, functionName: 'getPool', args: [p.token0, p.token1, p.fee] }) as `0x${string}`;
        if (!pool || /^0x0{40}$/.test(pool)) throw new Error('no pool');
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
  const winLo = fullRange ? p.currentTick - span / 2 : p.tickLower - span * 0.25;
  const winHi = fullRange ? p.currentTick + span / 2 : p.tickUpper + span * 0.25;
  const pct = (tick: number) => Math.max(0, Math.min(100, ((tick - winLo) / (winHi - winLo)) * 100));
  const bandL = fullRange ? 0 : pct(p.tickLower), bandR = fullRange ? 100 : pct(p.tickUpper), mark = pct(p.currentTick);
  const tone = p.inRange ? btb.green : btb.amber;
  const pNow = tickToPrice(p.currentTick, p.decimals0, p.decimals1);
  const pLow = tickToPrice(p.tickLower, p.decimals0, p.decimals1), pHigh = tickToPrice(p.tickUpper, p.decimals0, p.decimals1);

  // Depth bars inside the window, normalised to the tallest.
  const bars = useMemo(() => {
    if (!depth || depth.length === 0) return [];
    const tickOf = (price: number) => Math.log(price * 10 ** (p.decimals1 - p.decimals0)) / Math.log(1.0001);
    const inWin = depth.map((d) => ({ tick: tickOf(d.price), liq: d.liquidity })).filter((d) => Number.isFinite(d.tick) && d.tick >= winLo && d.tick <= winHi);
    const max = Math.max(1, ...inWin.map((d) => d.liq));
    return inWin.map((d) => ({ x: pct(d.tick), h: d.liq / max }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depth, winLo, winHi]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
        <span style={{ color: btb.textDim, fontSize: 11.5 }}>{p.symbol1}/{p.symbol0}{fullRange ? ' · full range' : ''}</span>
        <span style={{ color: tone, fontSize: 14, fontWeight: 800 }}>{fmtPrice(pNow)}</span>
      </div>
      <div style={{ position: 'relative', height: 44, marginTop: 8, borderRadius: 10, overflow: 'hidden', background: 'rgba(var(--fg-rgb), 0.04)' }}>
        {/* liquidity depth: where the other LPs sit */}
        <svg viewBox="0 0 100 44" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
          {bars.map((b, i) => <rect key={i} x={b.x - 0.6} y={44 - b.h * 40} width={1.2} height={b.h * 40} fill="rgba(var(--fg-rgb), 0.16)" />)}
        </svg>
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${bandL}%`, width: `${bandR - bandL}%`, background: p.inRange ? 'rgba(var(--green-rgb), 0.16)' : 'rgba(var(--amber-rgb), 0.14)', borderLeft: `1px solid ${p.inRange ? 'rgba(var(--green-rgb), 0.45)' : 'rgba(var(--amber-rgb), 0.45)'}`, borderRight: `1px solid ${p.inRange ? 'rgba(var(--green-rgb), 0.45)' : 'rgba(var(--amber-rgb), 0.45)'}` }} />
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: `calc(${mark}% - 1px)`, width: 2, background: tone }} />
        <div style={{ position: 'absolute', top: 4, left: `calc(${mark}% - 5px)`, width: 10, height: 10, borderRadius: 999, background: tone, boxShadow: `0 0 0 3px ${p.inRange ? 'rgba(var(--green-rgb), 0.25)' : 'rgba(var(--amber-rgb), 0.25)'}` }} />
        {!fullRange && (
          <>
            <span style={{ position: 'absolute', left: `calc(${bandL}% + 6px)`, bottom: 3, color: btb.textMuted, fontSize: 10.5 }}>{fmtPrice(pLow)}</span>
            <span style={{ position: 'absolute', right: `calc(${100 - bandR}% + 6px)`, bottom: 3, color: btb.textMuted, fontSize: 10.5 }}>{fmtPrice(pHigh)}</span>
          </>
        )}
      </div>
    </div>
  );
}
