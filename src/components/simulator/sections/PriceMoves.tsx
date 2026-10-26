'use client';
/** What if the price moves: one section where there were four (sensitivity, scenarios, the outcome breakdown and
 * LP vs holding), since they all answered the same question. Three model bands to tap, one slider, then what the
 * position ends up worth and how that compares with simply holding, all at the same end price. */
import { btb } from '../../design-tokens';
import { Section, Stat, fmtUsd, fmtSignedUsd, fmtSignedPct, fmtPrice, chart } from '../ui';
import type { Sim } from '../simState';

export function PriceMoves({ sim, movePct, setMovePct, isMobile }: {
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

  const legs = sim.waterfall;
  const rows = sim.comparison;
  const maxV = Math.max(...rows.map((r) => r.valueUsd), sim.depositUsd);
  const best = Math.max(...rows.map((r) => r.valueUsd));
  const sub = { color: btb.textMuted, fontSize: 12, fontWeight: 700, margin: '18px 0 8px' } as const;

  return (
    <Section
      title="What if the price moves"
      subtitle={`Tap a band or drag the price. Everything below, and the page above, recalculates for that price at ${sim.horizonDays} days.`}
      right={movePct !== 0 ? (
        <button onClick={() => setMovePct(0)} style={{
          height: 30, padding: '0 12px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
          fontSize: 11.5, fontWeight: 700, background: 'rgba(var(--fg-rgb), 0.07)', border: btb.border, color: btb.text,
        }}>Reset to 0%</button>
      ) : undefined}
    >
      {/* The three model bands, one standard deviation each way, from this pair's realised volatility. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 14 }}>
        {sim.scenarios.map((sc) => {
          const m = Math.round((sc.endPrice / sim.dispPrice - 1) * 100);
          const on = sim.movePct === m && sim.movePct !== 0;
          return (
            <button key={sc.key} onClick={() => setMovePct(m)} title={`${Math.round(sc.probability * 100)}% model band. Not a forecast.`} style={{
              cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', borderRadius: 12, padding: '9px 11px',
              background: on ? 'rgba(var(--green-rgb), 0.1)' : 'rgba(var(--fg-rgb), 0.04)',
              border: `1px solid ${on ? 'rgba(var(--green-rgb), 0.5)' : 'rgba(var(--fg-rgb), 0.1)'}`,
            }}>
              <div style={{ color: btb.text, fontSize: 12.5, fontWeight: 800 }}>{sc.label}</div>
              <div style={{ color: btb.textDim, fontSize: 11, marginTop: 1 }}>price {fmtSignedPct(m, 0)}</div>
              <div style={{ color: sc.roiPct >= 0 ? btb.green : btb.loss, fontSize: 14, fontWeight: 800, marginTop: 4 }}>{fmtSignedPct(sc.roiPct)}</div>
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ color: btb.textMuted, fontSize: 12, fontWeight: 700 }}>Price</span>
        <span style={{ fontSize: 16, fontWeight: 800, color: movePct === 0 ? btb.text : movePct > 0 ? btb.green : btb.loss }}>
          {fmtSignedPct(movePct, 0)}
          <span style={{ color: btb.textDim, fontSize: 11.5, fontWeight: 600, marginLeft: 8 }}>
            {sim.dispBase} at {fmtPrice(sim.dispEndPrice)} {sim.dispQuote}
          </span>
        </span>
      </div>
      <input type="range" min={-60} max={60} step={1} value={movePct} onChange={(e) => setMovePct(parseInt(e.target.value, 10))}
        style={{ width: '100%', accentColor: 'var(--btb-green)', cursor: 'pointer' }}/>
      <div style={{ display: 'flex', justifyContent: 'space-between', color: btb.textDim, fontSize: 10, marginTop: 2 }}>
        <span>−60%</span><span>0</span><span>+60%</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 8, marginTop: 14 }}>
        <Stat label="Fees" value={fmtSignedUsd(fees)} color={chart.fees} sub={endInRange ? 'earning while in range' : 'stops once out of range'} />
        <Stat label="IL" value={fmtSignedPct(ilPct, 2)} color={ilPct < -0.05 ? btb.amber : btb.text} sub="vs holding" />
        <Stat label="ROI" value={fmtSignedPct(roiPct)} color={roiPct >= 0 ? btb.green : btb.loss} sub={`over ${sim.horizonDays} days`} />
        <Stat label="APR" value={fmtSignedPct(aprPct)} color={aprPct >= 0 ? btb.green : btb.loss} sub="net, annualised" />
      </div>
      {!endInRange && (
        <div style={{ color: btb.amber, fontSize: 11.5, marginTop: 10, lineHeight: 1.5 }}>
          At this price the position is out of range: it stops earning and sits 100% in {sim.endPrice < sim.priceLower ? sim.sym0 : sim.sym1}.
        </div>
      )}

      {/* The result as one sum: start, each change that is not zero, the end value. The longer notes are tooltips. */}
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px 8px', marginTop: 16, padding: '10px 12px', borderRadius: 12, background: 'rgba(var(--fg-rgb), 0.035)', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
        {legs.filter((leg) => leg.kind === 'start' || leg.kind === 'final' || Math.abs(leg.usd) >= 0.005).map((leg, i) => {
          const isFinal = leg.kind === 'final';
          const isStart = leg.kind === 'start';
          const color = isFinal ? (roiPct >= 0 ? btb.green : btb.loss) : isStart ? btb.text : leg.usd >= 0 ? chart.fees : chart.neg;
          return (
            <span key={leg.label} title={leg.note} style={{ display: 'inline-flex', alignItems: 'baseline', gap: 5 }}>
              {i > 0 && <span style={{ color: btb.textDim, fontWeight: 700 }}>{isFinal ? '=' : leg.usd >= 0 ? '+' : '−'}</span>}
              <span style={{ color, fontWeight: 800, fontSize: isFinal ? 15 : 13 }}>{isStart || isFinal ? fmtUsd(leg.usd) : fmtUsd(Math.abs(leg.usd))}</span>
              <span style={{ color: btb.textDim, fontSize: 11.5 }}>{isStart ? 'start' : isFinal ? `after ${sim.horizonDays}d` : leg.label.toLowerCase()}</span>
            </span>
          );
        })}
      </div>

      <div style={sub}>Against just holding, at the same price</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {rows.map((r) => {
          const pct = (r.valueUsd / maxV) * 100;
          const roi = ((r.valueUsd - sim.depositUsd) / sim.depositUsd) * 100;
          return (
            <div key={r.label}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                <span style={{ color: r.isYou ? btb.text : btb.textMuted, fontSize: 12.5, fontWeight: r.isYou ? 800 : 600 }}>
                  {r.label}{r.isYou ? ' (this position)' : ''}{r.valueUsd === best ? ' · best' : ''}
                </span>
                <span style={{ fontSize: 12.5, fontWeight: 800, color: roi >= 0 ? btb.green : btb.loss }}>
                  {fmtUsd(r.valueUsd)} <span style={{ color: btb.textDim, fontWeight: 600 }}>({fmtSignedPct(roi)})</span>
                </span>
              </div>
              <div style={{ height: r.isYou ? 14 : 10, borderRadius: 999, background: 'rgba(var(--fg-rgb), 0.05)', overflow: 'hidden' }}>
                <div style={{ width: `${Math.max(pct, 1)}%`, height: '100%', borderRadius: 999, background: r.isYou ? chart.fees : chart.alt, opacity: r.isYou ? 1 : 0.55 }} />
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ color: btb.textDim, fontSize: 10.5, marginTop: 10, lineHeight: 1.45 }}>
        All start from the same {fmtUsd(sim.depositUsd)}. The LP bar includes fees and impermanent loss; the holding bars are price only. Bands come from this pair&apos;s realised volatility and are not forecasts.
      </div>
    </Section>
  );
}
