'use client';
/** Historical daily-snapshot replay. Pool data is historical; a hypothetical
 * new position's fee share remains an estimate. */
import { btb } from '../../design-tokens';
import { Section, Stat, fmtUsd, fmtSignedPct, fmtPrice, chart } from '../ui';
import type { Sim } from '../simState';

const W = 640, H = 150, PAD = 10, AXIS = 16;

export function RealBacktest({ sim, isMobile }: { sim: Sim; isMobile: boolean }) {
  const b = sim.backtest;
  const days = sim.backtestDays;

  if (!b || days.length < 2) {
    return (
      <Section
        kicker="Historical replay"
        title="Historical pool data unavailable"
        subtitle="This pool has no indexed daily price and fee history. The forward model below uses the live pool state and clearly labelled assumptions instead."
      >
        <div style={{ color: btb.textDim, fontSize: 12 }}>No historical replay is available for this pool.</div>
      </Section>
    );
  }

  const vals = days.map((d) => d.disp);
  const lo = Math.min(...vals, sim.dispLower);
  const hi = Math.max(...vals, sim.dispUpper);
  const pad = (hi - lo) * 0.12 || hi * 0.05;
  const dLo = lo - pad, dHi = hi + pad;
  const plotH = H - AXIS;
  const x = (i: number) => PAD + (i / (days.length - 1)) * (W - PAD * 2);
  const y = (p: number) => PAD + (1 - (p - dLo) / (dHi - dLo)) * (plotH - PAD * 2);
  const path = days.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(d.disp).toFixed(1)}`).join(' ');
  const bandTop = y(sim.dispUpper), bandBot = y(sim.dispLower);
  const movePct = b.entryPrice > 0 ? ((b.endPrice / b.entryPrice) - 1) * 100 : 0;
  const dispMovePct = sim.flip ? ((b.entryPrice / b.endPrice) - 1) * 100 : movePct;
  const inRangePct = Math.round((b.daysInRange / b.days) * 100);
  const liquidityNote = b.historicalLiquidityDays > 0
    ? `${b.historicalLiquidityDays} of ${b.daysInRange} in-range close days use indexed end-of-day liquidity${b.fallbackLiquidityDays ? `; ${b.fallbackLiquidityDays} use live liquidity because the historical snapshot was missing` : ''}.`
    : 'This index did not return historical liquidity snapshots, so fee share uses the live in-range liquidity.';

  return (
    <Section
      kicker="Historical replay"
      title={`Historical range replay · last ${b.days} daily snapshots`}
      subtitle="Pool price, fee totals, and liquidity are historical. Your fee share is estimated from each day’s recorded liquidity; daily snapshots cannot measure intraday time in range or exact tick-level fee growth."
    >
      <div style={{ background: 'rgba(255,255,255,0.03)', border: btb.borderSoft, borderRadius: 14, padding: '10px 8px 2px' }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
          {bandBot > bandTop && <rect x={PAD} y={bandTop} width={W - PAD * 2} height={bandBot - bandTop} rx={4} fill="rgba(82,227,164,0.12)" stroke="rgba(82,227,164,0.4)" strokeWidth={1} />}
          <path d={path} fill="none" stroke={chart.net} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {days.map((d, i) => <circle key={i} cx={x(i)} cy={y(d.disp)} r={2.2} fill={d.inRange ? chart.fees : chart.il} opacity={d.inRange ? 0.95 : 0.9} />)}
          <text x={W - PAD - 2} y={Math.max(bandTop - 4, 10)} textAnchor="end" fontSize={9.5} fill={btb.textMuted} fontFamily="inherit">{fmtPrice(sim.dispUpper)}</text>
          <text x={W - PAD - 2} y={Math.min(bandBot + 11, plotH - 2)} textAnchor="end" fontSize={9.5} fill={btb.textMuted} fontFamily="inherit">{fmtPrice(sim.dispLower)}</text>
          <text x={PAD} y={H - 3} fontSize={9.5} fill={chart.axis} fontFamily="inherit">{b.days} days ago</text>
          <text x={W - PAD} y={H - 3} textAnchor="end" fontSize={9.5} fill={chart.axis} fontFamily="inherit">today</text>
        </svg>
      </div>

      <div style={{ display: 'flex', gap: 14, marginTop: 8, flexWrap: 'wrap' }}>
        {[[chart.fees, 'close inside range'], [chart.il, 'close outside range']].map(([c, l]) => (
          <span key={l} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: btb.textMuted, fontSize: 11 }}>
            <span style={{ width: 7, height: 7, borderRadius: 999, background: c }} /> {l}
          </span>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 8, marginTop: 12 }}>
        <Stat label="Closes in range" value={`${b.daysInRange} / ${b.days}`} color={inRangePct >= 60 ? btb.green : btb.amber} sub={`${inRangePct}% of daily closes`} />
        <Stat label="Estimated fees" value={fmtUsd(b.feesUsd)} color={chart.fees} sub="from historical pool fees" />
        <Stat label="LP vs holding" value={fmtSignedPct(b.ilFraction)} color={b.ilFraction < 0 ? chart.il : btb.text} sub={`price moved ${fmtSignedPct(dispMovePct, 0)}`} />
        <Stat label="Period fee return" value={fmtSignedPct((b.feesUsd / sim.depositUsd) * 100)} color={chart.fees} sub={`${b.days} days · not annualised`} />
      </div>

      <div style={{ color: btb.textDim, fontSize: 10.5, marginTop: 10, lineHeight: 1.5 }}>
        {liquidityNote} “LP vs holding” is the exact price-only difference for a fixed range entered on the first snapshot and compared with holding the same entry tokens to the last. It is not a realised wallet loss. Fees are estimated, and are deliberately shown as a period return rather than APR. Past performance is not a forecast.
      </div>
    </Section>
  );
}
