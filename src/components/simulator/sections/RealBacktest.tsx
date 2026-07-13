'use client';
/** Real data panel — sits directly under the range bar. Everything else on the
 * page is a projection; this is what the range you just dragged to would have
 * ACTUALLY earned over the pool's real last 30 days: real daily prices, real
 * daily fees, fees credited only on days the price was genuinely in range. */
import { btb } from '../../design-tokens';
import { Section, Stat, fmtUsd, fmtSignedUsd, fmtSignedPct, fmtPrice, chart } from '../ui';
import type { Sim } from '../simState';

const W = 640, H = 150, PAD = 10, AXIS = 16;

export function RealBacktest({ sim, isMobile }: { sim: Sim; isMobile: boolean }) {
  const b = sim.backtest;
  const days = sim.backtestDays;

  if (!b || days.length < 2) {
    return (
      <Section
        kicker="Real data"
        title="What this range would have actually earned"
        subtitle="Day by day price and fee history is not indexed for this pool, so the panels below are projections only. The pool state, price, and TVL above are still live on chain reads."
      >
        <div style={{ color: btb.textDim, fontSize: 12 }}>No historical backtest available for this pool.</div>
      </Section>
    );
  }

  // Real price path with the band overlaid; days in range are marked.
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

  return (
    <Section
      kicker="Real data"
      title={`What this range would have actually earned · last ${b.days} days`}
      subtitle="Not a model. This replays the pool's real daily prices and real daily fees through the exact range above: fees credited only on the days the price was truly in range, netted against the impermanent loss from the move that really happened."
      right={
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: b.netApr >= 0 ? btb.green : btb.loss, fontSize: 20, fontWeight: 800, letterSpacing: -0.4 }}>
            {fmtSignedPct(b.netApr)}
          </div>
          <div style={{ color: btb.textDim, fontSize: 10 }}>realised net APR</div>
        </div>
      }
    >
      <div style={{ background: 'rgba(255,255,255,0.03)', border: btb.borderSoft, borderRadius: 14, padding: '10px 8px 2px' }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
          {/* your range band */}
          {bandBot > bandTop && (
            <rect x={PAD} y={bandTop} width={W - PAD * 2} height={bandBot - bandTop} rx={4}
              fill="rgba(82,227,164,0.12)" stroke="rgba(82,227,164,0.4)" strokeWidth={1} />
          )}
          {/* real price path */}
          <path d={path} fill="none" stroke={chart.net} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {/* in / out of range day markers */}
          {days.map((d, i) => (
            <circle key={i} cx={x(i)} cy={y(d.disp)} r={2.2}
              fill={d.inRange ? chart.fees : chart.il}
              opacity={d.inRange ? 0.95 : 0.9} />
          ))}
          {/* band edge labels */}
          <text x={W - PAD - 2} y={Math.max(bandTop - 4, 10)} textAnchor="end" fontSize={9.5} fill={btb.textMuted} fontFamily="inherit">{fmtPrice(sim.dispUpper)}</text>
          <text x={W - PAD - 2} y={Math.min(bandBot + 11, plotH - 2)} textAnchor="end" fontSize={9.5} fill={btb.textMuted} fontFamily="inherit">{fmtPrice(sim.dispLower)}</text>
          <text x={PAD} y={H - 3} fontSize={9.5} fill={chart.axis} fontFamily="inherit">{b.days} days ago</text>
          <text x={W - PAD} y={H - 3} textAnchor="end" fontSize={9.5} fill={chart.axis} fontFamily="inherit">today</text>
        </svg>
      </div>

      <div style={{ display: 'flex', gap: 14, marginTop: 8, flexWrap: 'wrap' }}>
        {[[chart.fees, 'day in range (earning)'], [chart.il, 'day out of range (idle)']].map(([c, l]) => (
          <span key={l} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: btb.textMuted, fontSize: 11 }}>
            <span style={{ width: 7, height: 7, borderRadius: 999, background: c }} /> {l}
          </span>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(5, 1fr)', gap: 8, marginTop: 12 }}>
        <Stat label="Days in range" value={`${b.daysInRange} / ${b.days}`} color={inRangePct >= 60 ? btb.green : btb.amber} sub={`${inRangePct}% of the time`} />
        <Stat label="Fees earned" value={fmtUsd(b.feesUsd)} color={chart.fees} sub="your real share" />
        <Stat label="Impermanent loss" value={fmtSignedUsd(b.ilUsd)} color={b.ilUsd < 0 ? chart.il : btb.text} sub={`price moved ${fmtSignedPct(dispMovePct, 0)}`} />
        <Stat label="Net result" value={fmtSignedUsd(b.netUsd)} color={b.netUsd >= 0 ? btb.green : btb.loss} sub={`on ${fmtUsd(sim.depositUsd)}`} />
        <Stat label="Fee only APR" value={fmtSignedPct(b.feeApr)} color={chart.fees} sub="before IL" />
      </div>

      <div style={{ color: btb.textDim, fontSize: 10.5, marginTop: 10, lineHeight: 1.5 }}>
        Past performance, not a forecast. Fee share uses the pool&apos;s current in range liquidity as the denominator for every day (day level history does not carry a per day figure), so treat fees as indicative and the impermanent loss as exact for the price path that happened.
      </div>
    </Section>
  );
}
