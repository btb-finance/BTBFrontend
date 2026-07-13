'use client';
/** Section 10 — Scenario Cards. Bear / Sideways / Bull as large cards with
 * honest probabilities from the same model as everything else. Clicking a
 * card sets the sensitivity slider to that scenario's price. */
import { btb } from '../../design-tokens';
import { Section, fmtUsd, fmtSignedPct, fmtPrice } from '../ui';
import type { Sim } from '../simState';

export function ScenarioCards({ sim, setMovePct, isMobile }: {
  sim: Sim;
  setMovePct: (m: number) => void;
  isMobile: boolean;
}) {
  return (
    <Section
      kicker="Section 10"
      title="Scenarios"
      subtitle={`Three futures for the next ${sim.horizonDays} days, weighted by this pair's volatility and recent trend. Probabilities sum to 100%. Tap a card to load it into the sensitivity slider.`}
    >
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 10 }}>
        {sim.scenarios.map((sc) => {
          const movePct = Math.round((sc.endPrice / sim.dispPrice - 1) * 100);
          const selected = sim.movePct === movePct && sim.movePct !== 0;
          return (
            <button key={sc.key} onClick={() => setMovePct(movePct)} style={{
              cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
              background: selected ? 'rgba(82,227,164,0.1)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${selected ? 'rgba(82,227,164,0.5)' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 18, padding: '15px 16px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 22 }}>{sc.emoji}</span>
                <span style={{ color: btb.text, fontSize: 15, fontWeight: 800, flex: 1 }}>{sc.label}</span>
                <span style={{
                  fontSize: 11.5, fontWeight: 800, color: btb.textMuted,
                  background: 'rgba(255,255,255,0.07)', borderRadius: 999, padding: '3px 9px',
                }}>{Math.round(sc.probability * 100)}% chance</span>
              </div>
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <Row label={`${sim.dispBase} price`} value={`${fmtPrice(sc.endPrice)} ${sim.dispQuote}`} sub={fmtSignedPct((sc.endPrice / sim.dispPrice - 1) * 100, 0)} />
                <Row label="ROI" value={fmtSignedPct(sc.roiPct)} color={sc.roiPct >= 0 ? btb.green : btb.loss} strong />
                <Row label="Fees" value={fmtUsd(sc.feesUsd)} color={btb.green} />
                <Row label="IL" value={fmtSignedPct(sc.ilPct, 2)} color={sc.ilPct < -0.05 ? btb.amber : btb.text} />
              </div>
            </button>
          );
        })}
      </div>
    </Section>
  );
}

function Row({ label, value, sub, color, strong }: {
  label: string; value: string; sub?: string; color?: string; strong?: boolean;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: strong ? 14 : 12.5 }}>
      <span style={{ color: btb.textMuted }}>{label}</span>
      <span style={{ color: color ?? btb.text, fontWeight: 800 }}>
        {value}{sub && <span style={{ color: btb.textDim, fontWeight: 600, fontSize: 11, marginLeft: 5 }}>{sub}</span>}
      </span>
    </div>
  );
}
