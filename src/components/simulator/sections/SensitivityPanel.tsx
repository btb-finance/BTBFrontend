'use client';
/** Section 9 — Sensitivity Analysis. One master slider moves the price; the
 * headline numbers here AND every price-dependent section above and below
 * re-derive live, because they all read the same derived state. */
import { btb } from '../../design-tokens';
import { Section, Stat, fmtSignedUsd, fmtSignedPct, fmtPrice, chart } from '../ui';
import type { Sim } from '../simState';

export function SensitivityPanel({ sim, movePct, setMovePct, isMobile }: {
  sim: Sim;
  movePct: number;
  setMovePct: (m: number) => void;
  isMobile: boolean;
}) {
  const fees = sim.movePct === 0 ? sim.expectedFeesUsd : sim.feesTo(sim.endPrice);
  const ilPct = sim.ilFraction(sim.endPrice) * 100;
  const net = sim.lpUsd(sim.endPrice) + fees - sim.gasUsd - sim.depositUsd;
  const roiPct = (net / sim.depositUsd) * 100;
  const aprPct = roiPct * (365 / sim.horizonDays);
  const endInRange = sim.endPrice >= sim.priceLower && sim.endPrice <= sim.priceUpper;

  return (
    <Section
      kicker="Section 9"
      title="Sensitivity"
      subtitle="Drag the price and watch the whole page recalculate: the waterfall, the comparison, the footer, everything."
      right={movePct !== 0 ? (
        <button onClick={() => setMovePct(0)} style={{
          height: 30, padding: '0 12px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
          fontSize: 11.5, fontWeight: 700, background: 'rgba(255,255,255,0.07)', border: btb.border, color: btb.text,
        }}>Reset to 0%</button>
      ) : undefined}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ color: btb.textMuted, fontSize: 12, fontWeight: 700 }}>Move Price</span>
        <span style={{ fontSize: 16, fontWeight: 800, color: movePct === 0 ? btb.text : movePct > 0 ? btb.green : btb.loss }}>
          {fmtSignedPct(movePct, 0)}
          <span style={{ color: btb.textDim, fontSize: 11.5, fontWeight: 600, marginLeft: 8 }}>
            {sim.dispBase} at {fmtPrice(sim.dispEndPrice)} {sim.dispQuote}
          </span>
        </span>
      </div>
      <input
        type="range" min={-60} max={60} step={1} value={movePct}
        onChange={(e) => setMovePct(parseInt(e.target.value, 10))}
        style={{ width: '100%', accentColor: '#52E3A4', cursor: 'pointer' }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', color: btb.textDim, fontSize: 10, marginTop: 2 }}>
        <span>−60%</span><span>0</span><span>+60%</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 8, marginTop: 14 }}>
        <Stat label="Fees" value={fmtSignedUsd(fees)} color={chart.fees} sub={endInRange ? 'earning while in range' : 'stops once out of range'} />
        <Stat label="APR" value={fmtSignedPct(aprPct)} color={aprPct >= 0 ? btb.green : btb.loss} sub="net, annualised" />
        <Stat label="IL" value={fmtSignedPct(ilPct, 2)} color={ilPct < -0.05 ? btb.amber : btb.text} sub="vs holding" />
        <Stat label="ROI" value={fmtSignedPct(roiPct)} color={roiPct >= 0 ? btb.green : btb.loss} sub={`over ${sim.horizonDays} days`} />
      </div>
      {!endInRange && (
        <div style={{ color: btb.amber, fontSize: 11.5, marginTop: 10, lineHeight: 1.5 }}>
          At this price the position is out of range: it stops earning and sits 100% in {sim.endPrice < sim.priceLower ? sim.sym0 : sim.sym1}.
        </div>
      )}
    </Section>
  );
}
