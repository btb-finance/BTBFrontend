'use client';
/** Section 11 — Timeline. How the position is expected to evolve from today
 * to six months out. Each step doubles as a horizon picker for the whole page. */
import { btb } from '../../design-tokens';
import { Section, fmtUsd, fmtSignedPct, chart } from '../ui';
import type { Sim } from '../simState';

export function Timeline({ sim, setHorizonDays, isMobile }: {
  sim: Sim;
  setHorizonDays: (d: number) => void;
  isMobile: boolean;
}) {
  return (
    <Section
      kicker="Section 11"
      title="Timeline"
      subtitle="Expected fees, the impermanent loss band (a typical up or down move), and the odds of still being in range at each point. Tap a step to set the horizon for the whole page."
    >
      <div style={{ position: 'relative', paddingLeft: 22 }}>
        {/* spine */}
        <div style={{ position: 'absolute', left: 7, top: 8, bottom: 8, width: 2, borderRadius: 2, background: 'rgba(255,255,255,0.1)' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sim.timeline.map((step) => {
            const selected = step.days === sim.horizonDays;
            const clickable = step.days > 0;
            const netUsd = step.expectedValueUsd - sim.depositUsd;
            return (
              <div key={step.label} onClick={clickable ? () => setHorizonDays(step.days) : undefined} style={{
                position: 'relative', borderRadius: 14, padding: '10px 13px',
                cursor: clickable ? 'pointer' : 'default',
                background: selected ? 'rgba(82,227,164,0.09)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${selected ? 'rgba(82,227,164,0.45)' : 'rgba(255,255,255,0.07)'}`,
              }}>
                {/* node on the spine */}
                <div style={{
                  position: 'absolute', left: -19.5, top: 16, width: 9, height: 9, borderRadius: 999,
                  background: selected ? '#52E3A4' : 'rgba(255,255,255,0.3)',
                  boxShadow: selected ? '0 0 8px rgba(82,227,164,0.7)' : 'none',
                }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ color: selected ? '#52E3A4' : btb.text, fontSize: 13, fontWeight: 800, width: 68, flexShrink: 0 }}>
                    {step.label}
                  </span>
                  {step.days === 0 ? (
                    <span style={{ color: btb.textMuted, fontSize: 12 }}>Deposit {fmtUsd(sim.depositUsd)} · position opens</span>
                  ) : (
                    <div style={{ display: 'flex', gap: isMobile ? 10 : 18, flexWrap: 'wrap', flex: 1, fontSize: 11.5 }}>
                      <span style={{ color: chart.fees, fontWeight: 700 }}>fees {fmtUsd(step.feesUsd)}</span>
                      <span style={{ color: chart.il, fontWeight: 700 }}>
                        IL {fmtSignedPct(step.ilAtMinus1s * 100, 1)} to {fmtSignedPct(step.ilAtPlus1s * 100, 1)}
                      </span>
                      <span style={{ color: btb.textMuted, fontWeight: 700 }}>in range {Math.round(step.inRangeProb * 100)}%</span>
                      <span style={{ marginLeft: 'auto', fontWeight: 800, color: netUsd >= 0 ? btb.green : btb.loss }}>
                        {fmtUsd(step.expectedValueUsd)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ color: btb.textDim, fontSize: 10.5, marginTop: 10, lineHeight: 1.45 }}>
        Expected value is fees plus probability weighted impermanent loss minus gas, at the model median price. The IL band shows a one standard deviation move each way.
      </div>
    </Section>
  );
}
