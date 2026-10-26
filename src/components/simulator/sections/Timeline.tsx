'use client';
/** The forward model by period, in plain columns: the fees the position should earn, what a typical price move
 * costs it against just holding, the net of the two, and the chance it is still in range. Shown inside the price
 * risk section; tapping a period sets the page's horizon. */
import { btb } from '../../design-tokens';
import { fmtUsd, fmtSignedPct } from '../ui';
import type { Sim } from '../simState';

export function TimelineRows({ sim, setHorizonDays, isMobile }: {
  sim: Sim;
  setHorizonDays: (d: number) => void;
  isMobile: boolean;
}) {
  const steps = sim.timeline.filter((s) => s.days > 0);
  const th = { textAlign: 'right' as const, padding: '8px 10px', color: btb.textDim, fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: 0.4, borderBottom: btb.borderSoft, whiteSpace: 'nowrap' as const };
  const td = { textAlign: 'right' as const, padding: '9px 10px', fontSize: isMobile ? 12 : 12.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums' as const, whiteSpace: 'nowrap' as const };
  return (
    <>
      <div style={{ overflowX: 'auto', border: btb.borderSoft, borderRadius: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: 'left' }}>After</th>
              <th style={th}>Fees</th>
              <th style={th}>Price-move loss</th>
              <th style={th}>Net</th>
              <th style={th}>Still in range</th>
            </tr>
          </thead>
          <tbody>
            {steps.map((step) => {
              const on = step.days === sim.horizonDays;
              const feesPct = sim.depositUsd > 0 ? (step.feesUsd / sim.depositUsd) * 100 : 0;
              // A typical move either way over the period; the worse of the two directions.
              const lossPct = Math.min(step.ilAtMinus1s, step.ilAtPlus1s) * 100;
              const netPct = feesPct + lossPct;
              return (
                <tr key={step.label} onClick={() => setHorizonDays(step.days)} style={{ cursor: 'pointer', background: on ? 'rgba(var(--green-rgb), 0.09)' : 'transparent' }}>
                  <td style={{ ...td, textAlign: 'left', color: on ? btb.green : btb.text, fontWeight: 800 }}>{step.label}</td>
                  <td style={{ ...td, color: btb.green }}>{fmtUsd(step.feesUsd)}</td>
                  <td style={{ ...td, color: lossPct < -0.05 ? btb.amber : btb.textMuted }}>{fmtSignedPct(lossPct, 1)}</td>
                  <td style={{ ...td, color: netPct >= 0 ? btb.green : btb.loss }}>{fmtSignedPct(netPct, 1)}</td>
                  <td style={{ ...td, color: btb.textMuted }}>{Math.round(step.inRangeProb * 100)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ color: btb.textDim, fontSize: 11, marginTop: 8, lineHeight: 1.5 }}>
        Fees: what your {fmtUsd(sim.depositUsd)} should earn, counting only the time it stays in range. Price-move loss: how far behind just holding the
        tokens you would be after a typical price move for that period, up or down. Net: fees plus that loss as a share of your deposit. Still in range:
        the chance the price is inside your range at the end. Estimates from recent fees and volatility, not forecasts.
      </div>
    </>
  );
}
