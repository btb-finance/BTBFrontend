'use client';
/** A plain-language outcome breakdown. Replaces the hard-to-read waterfall. */
import { btb } from '../../design-tokens';
import { Section, fmtUsd, fmtSignedUsd, fmtSignedPct, chart } from '../ui';
import type { Sim } from '../simState';

export function PnlWaterfall({ sim }: { sim: Sim }) {
  const legs = sim.waterfall;
  const final = legs[legs.length - 1].usd;
  const roiPct = sim.depositUsd > 0 ? ((final - sim.depositUsd) / sim.depositUsd) * 100 : 0;
  const priceScenario = sim.movePct === 0 ? 'price unchanged (0.0%)' : `your ${fmtSignedPct(sim.movePct, 0)} price scenario`;

  return (
    <Section
      kicker="Selected scenario"
      title={`Outcome if ${priceScenario}`}
      subtitle={`The ${fmtSignedPct(roiPct)} on the right is estimated net return over ${sim.horizonDays} days (fees less gas). It is not your range width or a price forecast.`}
      right={<div style={{ textAlign: 'right' }}><div style={{ color: roiPct >= 0 ? btb.green : btb.loss, fontSize: 20, fontWeight: 800 }}>{fmtSignedPct(roiPct)}</div><div style={{ color: btb.textDim, fontSize: 10 }}>net estimate · {sim.horizonDays}d</div></div>}
    >
      <div style={{ border: btb.borderSoft, borderRadius: 16, overflow: 'hidden' }}>
        {legs.map((leg, i) => {
          const isFinal = leg.kind === 'final';
          const isStart = leg.kind === 'start';
          const color = isFinal ? (roiPct >= 0 ? btb.green : btb.loss) : isStart ? btb.text : leg.usd >= 0 ? chart.fees : chart.neg;
          return (
            <div key={leg.label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: isFinal ? '14px 14px' : '11px 14px', background: isFinal ? 'rgba(82,227,164,0.08)' : i % 2 ? 'rgba(255,255,255,0.025)' : 'transparent', borderTop: i ? '1px solid rgba(255,255,255,0.07)' : 'none' }}>
              <span style={{ width: 7, height: 7, borderRadius: 999, background: color, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: btb.text, fontSize: isFinal ? 14 : 13, fontWeight: isFinal ? 800 : 700 }}>{leg.label}</div>
                <div style={{ color: btb.textDim, fontSize: 10.5, lineHeight: 1.35, marginTop: 2 }}>{leg.note}</div>
              </div>
              <span style={{ color, fontSize: isFinal ? 18 : 14, fontWeight: 800, whiteSpace: 'nowrap' }}>{isStart || isFinal ? fmtUsd(leg.usd) : fmtSignedUsd(leg.usd)}</span>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
