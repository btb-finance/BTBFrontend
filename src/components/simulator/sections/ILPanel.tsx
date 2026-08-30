'use client';
/** Section 5 — Impermanent Loss. The concentrated-range IL curve across price
 * moves, drawn against expected fee income so the crossover (where LPing beats
 * holding) is the visible story. Hover anywhere for the full breakdown. */
import { useState } from 'react';
import { btb } from '../../design-tokens';
import { Section, Stat, fmtSignedPct, chart } from '../ui';
import type { Sim } from '../simState';

const W = 640, H = 230, PADX = 34, PADY = 14, AXIS = 20;
const MOVES = { min: -60, max: 60 };

export function ILPanel({ sim, isMobile }: { sim: Sim; isMobile?: boolean }) {
  const [hoverMove, setHoverMove] = useState<number | null>(null);

  // All three series as % of the deposit, per display-space move.
  const at = (movePct: number) => {
    const dispEnd = sim.dispPrice * (1 + movePct / 100);
    const p1 = sim.flip ? (dispEnd > 0 ? 1 / dispEnd : sim.price) : dispEnd;
    const ilPct = sim.ilFraction(p1) * 100;
    const feesPct = (sim.feesTo(p1) / sim.depositUsd) * 100;
    return { ilPct, feesPct, netPct: ilPct + feesPct };
  };

  const N = 96;
  const samples: { m: number; il: number; fees: number; net: number }[] = [];
  let yMin = 0, yMax = 0;
  for (let k = 0; k <= N; k++) {
    const m = MOVES.min + ((MOVES.max - MOVES.min) * k) / N;
    const v = at(m);
    samples.push({ m, il: v.ilPct, fees: v.feesPct, net: v.netPct });
    yMin = Math.min(yMin, v.ilPct, v.netPct);
    yMax = Math.max(yMax, v.feesPct, v.netPct);
  }
  yMin = Math.min(yMin, -1) * 1.15;
  yMax = Math.max(yMax, 1) * 1.15;

  const plotH = H - AXIS;
  const x = (m: number) => PADX + ((m - MOVES.min) / (MOVES.max - MOVES.min)) * (W - PADX - PADY);
  const y = (v: number) => PADY + (1 - (v - yMin) / (yMax - yMin)) * (plotH - PADY * 2);
  const path = (get: (s: typeof samples[number]) => number) =>
    samples.map((s, i) => `${i === 0 ? 'M' : 'L'}${x(s.m).toFixed(1)},${y(get(s)).toFixed(1)}`).join(' ');

  const hv = hoverMove !== null ? at(hoverMove) : null;
  const xTicks = [-60, -40, -20, 0, 20, 40, 60];

  return (
    <Section
      kicker="Section 5"
      title="Impermanent Loss"
      subtitle={`IL for YOUR range, not the generic curve: a concentrated range loses faster inside the band, then flattens once the price exits (the position becomes 100% one token). Fees assume a steady move over ${sim.horizonDays} days.`}
    >
      <div style={{ background: 'rgba(255,255,255,0.03)', border: btb.borderSoft, borderRadius: 14, padding: '10px 8px 2px', position: 'relative' }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none' }}
          onPointerMove={(e) => {
            const r = (e.target as SVGElement).closest('svg')!.getBoundingClientRect();
            const m = (((e.clientX - r.left) / r.width) * W - PADX) / (W - PADX - PADY) * (MOVES.max - MOVES.min) + MOVES.min;
            setHoverMove(Math.max(MOVES.min, Math.min(MOVES.max, m)));
          }}
          onPointerLeave={() => setHoverMove(null)}
        >
          {/* zero line + grid */}
          <line x1={PADX} x2={W - PADY} y1={y(0)} y2={y(0)} stroke="rgba(255,255,255,0.22)" strokeWidth={1} />
          {xTicks.map((m) => (
            <g key={m}>
              <line x1={x(m)} x2={x(m)} y1={PADY} y2={plotH - PADY} stroke={chart.grid} strokeWidth={1} />
              <text x={x(m)} y={H - 5} textAnchor="middle" fontSize={9.5} fill={chart.axis} fontFamily="inherit">
                {m > 0 ? `+${m}%` : `${m}%`}
              </text>
            </g>
          ))}
          {/* range edges in move space */}
          {[sim.dispLower, sim.dispUpper].map((p, i) => {
            const m = (p / sim.dispPrice - 1) * 100;
            if (m < MOVES.min || m > MOVES.max) return null;
            return <line key={i} x1={x(m)} x2={x(m)} y1={PADY} y2={plotH - PADY} stroke="rgba(82,227,164,0.35)" strokeWidth={1} strokeDasharray="3 3" />;
          })}
          {/* series */}
          <path d={path((s) => s.fees)} fill="none" stroke={chart.fees} strokeWidth={2} strokeLinejoin="round" />
          <path d={path((s) => s.il)} fill="none" stroke={chart.il} strokeWidth={2} strokeLinejoin="round" />
          <path d={path((s) => s.net)} fill="none" stroke={chart.net} strokeWidth={2.4} strokeLinejoin="round" />
          {/* direct labels at the right edge */}
          <text x={W - PADY - 2} y={y(samples[N].fees) - 5} textAnchor="end" fontSize={10} fontWeight={700} fill={chart.fees} fontFamily="inherit">Fees</text>
          <text x={W - PADY - 2} y={y(samples[N].il) + 12} textAnchor="end" fontSize={10} fontWeight={700} fill={chart.il} fontFamily="inherit">IL</text>
          <text x={W - PADY - 2} y={y(samples[N].net) - 5} textAnchor="end" fontSize={10} fontWeight={700} fill={chart.net} fontFamily="inherit">Net</text>
          {/* hover crosshair */}
          {hoverMove !== null && hv && (
            <g>
              <line x1={x(hoverMove)} x2={x(hoverMove)} y1={PADY} y2={plotH - PADY} stroke="rgba(255,255,255,0.4)" strokeWidth={1} />
              {[[hv.feesPct, chart.fees], [hv.ilPct, chart.il], [hv.netPct, chart.net]].map(([v, c], i) => (
                <circle key={i} cx={x(hoverMove)} cy={y(v as number)} r={4} fill={c as string} stroke="#0A0A0F" strokeWidth={2} />
              ))}
            </g>
          )}
        </svg>
        {hoverMove !== null && hv && (
          <div style={{
            position: 'absolute', top: 8, left: hoverMove > 0 ? 12 : undefined, right: hoverMove > 0 ? undefined : 12,
            background: 'rgba(12,12,18,0.95)', border: btb.borderSoft, borderRadius: 10, padding: '8px 11px',
            fontSize: 11.5, pointerEvents: 'none', minWidth: 138,
          }}>
            <div style={{ color: btb.text, fontWeight: 800, marginBottom: 4 }}>Price {fmtSignedPct(hoverMove, 0)}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span style={{ color: chart.il }}>IL</span><b style={{ color: btb.text }}>{fmtSignedPct(hv.ilPct, 2)}</b></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span style={{ color: chart.fees }}>Fees Earned</span><b style={{ color: btb.text }}>{fmtSignedPct(hv.feesPct, 2)}</b></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 2, paddingTop: 3, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <span style={{ color: chart.net }}>Net vs holding</span><b style={{ color: hv.netPct >= 0 ? btb.green : btb.loss }}>{fmtSignedPct(hv.netPct, 2)}</b>
            </div>
          </div>
        )}
      </div>
      {/* Active management: what happens after the first exit — the part of
          LPing passive simulations skip. Median first-passage to the nearer
          edge under the fitted volatility, and the IL waiting there. */}
      {sim.timeToEdgeDays != null && sim.ilAtEdge != null && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 8, marginTop: 12 }}>
          <Stat
            label="Typical time to edge"
            value={sim.timeToEdgeDays < 1 ? `${Math.max(1, Math.round(sim.timeToEdgeDays * 24))}h` : sim.timeToEdgeDays < 45 ? `${sim.timeToEdgeDays.toFixed(1)}d` : `${(sim.timeToEdgeDays / 30).toFixed(1)}mo`}
            sub="median, at current volatility"
          />
          <Stat
            label="Rebalances / month"
            value={sim.rebalancesPerMonth != null ? (sim.rebalancesPerMonth >= 99 ? '99+' : sim.rebalancesPerMonth.toFixed(1)) : '—'}
            sub="if you re-center after each exit"
          />
          <Stat label="IL at range edge" value={fmtSignedPct(sim.ilAtEdge * 100)} sub="loss vs holding at a boundary" />
        </div>
      )}
      {/* Adverse selection benchmark: the modern academic yardstick for LP
          performance — can fees beat simply rebalancing the same capital? */}
      {sim.lvrDailyPct != null && sim.feeDailyPct != null && (
        <div style={{ marginTop: 10, color: btb.textMuted, fontSize: 11.5, lineHeight: 1.5 }}>
          Adverse-selection benchmark (LVR): while in range, arbitrage against this position costs about{' '}
          <b style={{ color: btb.loss }}>−{sim.lvrDailyPct.toFixed(2)}%/day</b> against fee income of{' '}
          <b style={{ color: sim.feeDailyPct > sim.lvrDailyPct ? btb.green : btb.loss }}>+{sim.feeDailyPct.toFixed(2)}%/day</b> —{' '}
          {sim.feeDailyPct > sim.lvrDailyPct ? 'fees currently beat the benchmark.' : 'the benchmark currently beats these fees.'}
        </div>
      )}
      {/* legend (three series, also direct-labeled on chart) */}
      <div style={{ display: 'flex', gap: 14, marginTop: 10, flexWrap: 'wrap' }}>
        {[[chart.fees, 'Fees earned'], [chart.il, 'Impermanent loss'], [chart.net, 'Net vs just holding']].map(([c, l]) => (
          <span key={l} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: btb.textMuted, fontSize: 11 }}>
            <span style={{ width: 14, height: 3, borderRadius: 2, background: c }} /> {l}
          </span>
        ))}
      </div>
    </Section>
  );
}
