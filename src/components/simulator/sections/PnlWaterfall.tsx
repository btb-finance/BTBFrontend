'use client';
/** Section 6 — PnL Waterfall. Where every dollar of the projected outcome
 * comes from: start, price move, fees, IL, gas, final. */
import { useState } from 'react';
import { btb } from '../../design-tokens';
import { Section, fmtUsd, fmtSignedUsd, fmtSignedPct, chart } from '../ui';
import type { Sim } from '../simState';

const W = 640, H = 240, PAD = 12, AXIS = 34;

export function PnlWaterfall({ sim }: { sim: Sim }) {
  const [hover, setHover] = useState<number | null>(null);
  const legs = sim.waterfall;

  // Running levels: absolute bars for start/final, floating deltas between.
  let running = 0;
  const bars = legs.map((leg) => {
    if (leg.kind === 'start') { running = leg.usd; return { ...leg, from: 0, to: leg.usd }; }
    if (leg.kind === 'final') return { ...leg, from: 0, to: leg.usd };
    const from = running;
    running += leg.usd;
    return { ...leg, from, to: running };
  });

  const maxV = Math.max(...bars.map((b) => Math.max(b.from, b.to)), sim.depositUsd) * 1.06;
  const minV = Math.min(...bars.map((b) => Math.min(b.from, b.to)), 0);
  const plotH = H - AXIS;
  const y = (v: number) => PAD + (1 - (v - minV) / (maxV - minV)) * (plotH - PAD * 2);
  const bw = (W - PAD * 2) / bars.length;

  const color = (leg: typeof bars[number]) =>
    leg.kind !== 'delta' ? chart.net : leg.usd >= 0 ? chart.fees : chart.neg;

  const final = legs[legs.length - 1].usd;
  const roiPct = ((final - sim.depositUsd) / sim.depositUsd) * 100;

  return (
    <Section
      kicker="Section 6"
      title="PnL Waterfall"
      subtitle={`Every dollar of the projected ${sim.horizonDays} day outcome, accounted for.${sim.movePct !== 0 ? ` Shown at your ${fmtSignedPct(sim.movePct, 0)} price move from the sensitivity slider.` : ' Shown at the model median price (no net move).'}`}
      right={
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: roiPct >= 0 ? btb.green : btb.loss, fontSize: 20, fontWeight: 800, letterSpacing: -0.4 }}>{fmtSignedPct(roiPct)}</div>
          <div style={{ color: btb.textDim, fontSize: 10 }}>projected return</div>
        </div>
      }
    >
      <div style={{ background: 'rgba(255,255,255,0.03)', border: btb.borderSoft, borderRadius: 14, padding: '10px 8px 2px', position: 'relative' }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} onPointerLeave={() => setHover(null)}>
          {/* baseline at the deposit level */}
          <line x1={PAD} x2={W - PAD} y1={y(sim.depositUsd)} y2={y(sim.depositUsd)} stroke="rgba(255,255,255,0.16)" strokeWidth={1} strokeDasharray="4 4" />
          {bars.map((b, i) => {
            const top = Math.min(y(b.from), y(b.to));
            const h = Math.max(Math.abs(y(b.from) - y(b.to)), 2);
            const cx = PAD + i * bw + bw / 2;
            return (
              <g key={b.label} onPointerEnter={() => setHover(i)}>
                {/* connector to the previous leg */}
                {i > 0 && b.kind === 'delta' && (
                  <line x1={PAD + (i - 1) * bw + bw * 0.82} x2={PAD + i * bw + bw * 0.18} y1={y(b.from)} y2={y(b.from)} stroke="rgba(255,255,255,0.25)" strokeWidth={1} />
                )}
                {b.kind === 'final' && (
                  <line x1={PAD + (i - 1) * bw + bw * 0.82} x2={PAD + i * bw + bw * 0.18} y1={y(b.to)} y2={y(b.to)} stroke="rgba(255,255,255,0.25)" strokeWidth={1} />
                )}
                <rect
                  x={PAD + i * bw + bw * 0.18} y={top} width={bw * 0.64} height={h} rx={4}
                  fill={color(b)} opacity={hover === i ? 1 : 0.85}
                />
                {/* value label */}
                <text x={cx} y={top - 5} textAnchor="middle" fontSize={10.5} fontWeight={800} fill={btb.text} fontFamily="inherit">
                  {b.kind === 'delta' ? fmtSignedUsd(b.usd) : fmtUsd(b.usd)}
                </text>
                <text x={cx} y={H - 18} textAnchor="middle" fontSize={10} fill={chart.axis} fontFamily="inherit">{b.label}</text>
                <rect x={PAD + i * bw} y={0} width={bw} height={H} fill="transparent" />
              </g>
            );
          })}
        </svg>
        {hover !== null && (
          <div style={{
            position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(12,12,18,0.95)', border: btb.borderSoft, borderRadius: 10, padding: '7px 11px',
            fontSize: 11, color: btb.textMuted, pointerEvents: 'none', maxWidth: '92%', lineHeight: 1.45, textAlign: 'center',
          }}>
            <b style={{ color: btb.text }}>{bars[hover].label}:</b> {bars[hover].note}
          </div>
        )}
      </div>
    </Section>
  );
}
