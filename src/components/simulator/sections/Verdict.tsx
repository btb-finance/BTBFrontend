'use client';
/** The answer first: will this position's fees likely cover its price risk? Research on concentrated liquidity
 * (loss-versus-rebalancing, Orca's LP-vs-hold) says that is the question that decides an LP, so it leads the page,
 * with where the APR comes from and whether the pool's volume looks real. */
import { btb } from '../../design-tokens';
import { Section, Stat, fmtUsd, fmtSignedUsd, fmtPct } from '../ui';
import type { Sim } from '../simState';
import type { SimPoolChoice } from '../SimulatorPage';

export function Verdict({ sim, selected, isMobile }: { sim: Sim; selected: SimPoolChoice; isMobile: boolean }) {
  const H = sim.horizonDays;
  const feesUsd = sim.expectedFeesUsd;
  const ilUsd = Math.abs(sim.expectedIlFraction) * sim.depositUsd;
  const netUsd = feesUsd - ilUsd - sim.gasUsd;
  // The daily benchmark when we have it (fees against arbitrage losses while in range), else the horizon totals.
  const benchmark = sim.feeDailyPct != null && sim.lvrDailyPct != null;
  const covers = benchmark ? sim.feeDailyPct! > sim.lvrDailyPct! : netUsd > 0;
  const tone = covers ? btb.green : btb.loss;
  const toneRgb = covers ? 'var(--green-rgb)' : 'var(--loss-rgb, 239,68,68)';

  // Daily turnover: volume over TVL. Low means thin fees; very high can mean bots or volume that is not organic.
  const turnover = sim.volumeToTvl7d != null ? sim.volumeToTvl7d / 7 : null;
  const turnoverNote = turnover == null ? null
    : turnover < 0.05 ? { text: 'Low: little trading for its size, so fees stay thin.', color: btb.amber }
    : turnover > 1 ? { text: 'Very high: bots compete for the largest swaps, and some volume may not be organic.', color: btb.amber }
    : { text: 'Healthy for its size.', color: btb.textMuted };

  const gauge = selected.aprKind === 'gauge' && (selected.apy ?? 0) > 0 ? selected.apy! : null;

  return (
    <Section
      title={covers ? 'Fees should cover the price risk' : 'Fees likely will not cover the price risk'}
      subtitle={`Over ${H} days at today's volume and volatility: about ${fmtUsd(feesUsd)} in fees against about ${fmtUsd(ilUsd)} of expected impermanent loss. An estimate from recent data, not a forecast.`}
      right={(
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ color: tone, fontSize: 20, fontWeight: 800 }}>{fmtSignedUsd(netUsd)}</div>
          <div style={{ color: btb.textDim, fontSize: 10 }}>net vs holding · {H}d</div>
        </div>
      )}
    >
      <div style={{ height: 6, borderRadius: 999, background: `rgba(${toneRgb}, 0.15)`, overflow: 'hidden', marginBottom: 14 }}>
        {/* How much of the expected loss the fees cover, up to twice over. */}
        <div style={{ width: `${Math.min(100, ilUsd > 0 ? (feesUsd / ilUsd) * 50 : 100)}%`, height: '100%', borderRadius: 999, background: tone }}/>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 8 }}>
        <Stat label="Expected fees" value={fmtUsd(feesUsd)} color={btb.green} sub={`next ${H} days`} />
        <Stat label="Expected IL" value={fmtUsd(ilUsd)} color={ilUsd > 0 ? btb.amber : btb.text} sub="vs just holding" />
        <Stat label="Time in range" value={`${Math.round(sim.timeInRange * 100)}%`} sub="no fees outside" />
        <Stat label="Profit chance" value={`${Math.round(sim.probPositive * 100)}%`} sub="after IL, model" />
      </div>

      {benchmark && (
        <div style={{ color: btb.textMuted, fontSize: 12, lineHeight: 1.55, marginTop: 12 }}>
          Each day in range, fees add <b style={{ color: btb.text }}>{dailyPct(sim.feeDailyPct!)}</b> to the position, and price moves cost it about{' '}
          <b style={{ color: btb.text }}>{dailyPct(sim.lvrDailyPct!)}</b>: traders buy from it below the market price and sell to it above.{' '}
          {covers ? 'Fees are ahead.' : 'Price moves are ahead: the fees do not make up for them.'}
        </div>
      )}

      {/* Where the APR comes from: swap fees last; incentives end when the campaign does and pay in reward tokens. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(var(--fg-rgb), 0.07)' }}>
        <Line label="Fee APR, your range" value={sim.feeAprPct != null ? fmtPct(sim.feeAprPct, 2) : 'n/a'} note="from trading, lasts while volume does" />
        <Line label="Incentives" value={gauge != null ? `${gauge.toFixed(2)}%` : 'none listed'} note={gauge != null ? `${selected.aprLabel ?? 'gauge rewards'}: needs staking, paid in reward tokens, ends with the campaign` : 'only trading fees here'} />
        {turnover != null && turnoverNote && (
          <Line label="Daily volume / TVL" value={`${turnover < 0.1 ? turnover.toFixed(2) : turnover.toFixed(1)}×`} note={turnoverNote.text} noteColor={turnoverNote.color} />
        )}
      </div>
    </Section>
  );
}

/** A daily percentage that never rounds a real number to 0.00%: two significant digits when it is small. */
function dailyPct(v: number): string {
  if (v === 0) return '0%';
  return Math.abs(v) >= 0.01 ? `${v.toFixed(2)}%` : `${Number(v.toPrecision(2))}%`;
}

function Line({ label, value, note, noteColor }: { label: string; value: string; note: string; noteColor?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
      <span style={{ color: btb.textMuted, fontSize: 12.5, minWidth: 150 }}>{label}</span>
      <span style={{ color: btb.text, fontSize: 13.5, fontWeight: 800 }}>{value}</span>
      <span style={{ color: noteColor ?? btb.textDim, fontSize: 11.5 }}>{note}</span>
    </div>
  );
}
