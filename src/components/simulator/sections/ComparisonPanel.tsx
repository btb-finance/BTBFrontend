'use client';
/** Section 7 — Comparison. Should you even LP? Your position vs holding
 * either token or a 50/50 mix, at the same end price and horizon. */
import { btb } from '../../design-tokens';
import { Section, fmtUsd, fmtSignedPct, chart } from '../ui';
import type { Sim } from '../simState';

export function ComparisonPanel({ sim }: { sim: Sim }) {
  const rows = sim.comparison;
  const maxV = Math.max(...rows.map((r) => r.valueUsd), sim.depositUsd);
  const best = Math.max(...rows.map((r) => r.valueUsd));

  return (
    <Section
      kicker="Section 7"
      title="LP vs Just Holding"
      subtitle={`Final value of ${fmtUsd(sim.depositUsd)} after ${sim.horizonDays} days at the same end price, four ways. The question almost every simulator skips.`}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.map((r) => {
          const pct = (r.valueUsd / maxV) * 100;
          const roi = ((r.valueUsd - sim.depositUsd) / sim.depositUsd) * 100;
          const isBest = r.valueUsd === best;
          return (
            <div key={r.label}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                <span style={{ color: r.isYou ? btb.text : btb.textMuted, fontSize: 12.5, fontWeight: r.isYou ? 800 : 600 }}>
                  {r.label}{r.isYou ? ' (this position)' : ''}{isBest ? ' · best outcome' : ''}
                </span>
                <span style={{ fontSize: 12.5, fontWeight: 800, color: roi >= 0 ? btb.green : btb.loss }}>
                  {fmtUsd(r.valueUsd)} <span style={{ color: btb.textDim, fontWeight: 600 }}>({fmtSignedPct(roi)})</span>
                </span>
              </div>
              <div style={{ height: r.isYou ? 18 : 12, borderRadius: 999, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                <div style={{
                  width: `${Math.max(pct, 1)}%`, height: '100%', borderRadius: 999,
                  background: r.isYou ? chart.fees : chart.alt,
                  opacity: r.isYou ? 1 : 0.55,
                  boxShadow: r.isYou ? '0 0 12px rgba(82,227,164,0.35)' : 'none',
                }} />
              </div>
            </div>
          );
        })}
      </div>
      {/* deposit reference */}
      <div style={{ color: btb.textDim, fontSize: 10.5, marginTop: 10 }}>
        All four start from the same {fmtUsd(sim.depositUsd)}. The LP bar includes fees and impermanent loss; holding bars are pure price exposure.
      </div>
    </Section>
  );
}
