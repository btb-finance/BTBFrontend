'use client';
/** Section 4 — Fee Generation. Your share of the pool's REAL daily fees as
 * bars (or cumulative), with the summary stats that make the income stream
 * judgeable: average, median, best, worst, and the volume needed to sustain it. */
import { useMemo, useState } from 'react';
import { btb } from '../../design-tokens';
import { fmtCompactUsd } from '../../../lib/pools';
import { Section, Stat, fmtUsd, chart } from '../ui';
import type { Sim } from '../simState';

const W = 640, H = 180, PAD = 12, AXIS = 18;

export function FeePanel({ sim, isMobile }: { sim: Sim; isMobile: boolean }) {
  const [mode, setMode] = useState<'daily' | 'cumulative'>('daily');
  const [hover, setHover] = useState<number | null>(null);

  const series = sim.dailyFeeSeries;
  const stats = useMemo(() => {
    const vals = series.map((d) => d.feesUsd);
    if (vals.length === 0) return null;
    const sorted = [...vals].sort((a, b) => a - b);
    return {
      avg: vals.reduce((s, v) => s + v, 0) / vals.length,
      median: sorted[Math.floor(sorted.length / 2)],
      max: sorted[sorted.length - 1],
      min: sorted[0],
    };
  }, [series]);

  // Daily pool volume required to sustain the current fee estimate at this tier.
  const volumeNeeded = sim.feeTier > 0 && sim.liquidityShare > 0 && sim.dailyFeeUsd > 0
    ? sim.dailyFeeUsd / ((sim.feeTier / 1_000_000) * sim.liquidityShare)
    : null;

  const dayLabel = (date: number) => new Date(date * 1000).toLocaleDateString('en-US', { weekday: isMobile ? 'narrow' : 'short' });

  const renderChart = () => {
    if (series.length === 0) return null;
    const shown = series.slice(-14);
    const cum: number[] = [];
    shown.reduce((s, d) => { cum.push(s + d.feesUsd); return s + d.feesUsd; }, 0);
    const values = mode === 'daily' ? shown.map((d) => d.feesUsd) : cum;
    const maxV = Math.max(...values, 1e-9);
    const plotH = H - AXIS;
    const bw = (W - PAD * 2) / shown.length;
    const y = (v: number) => plotH - PAD - (v / maxV) * (plotH - PAD * 2);

    return (
      <div style={{ background: 'rgba(255,255,255,0.03)', border: btb.borderSoft, borderRadius: 14, padding: '10px 8px 2px', position: 'relative' }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} onPointerLeave={() => setHover(null)}>
          <line x1={PAD} x2={W - PAD} y1={H - AXIS - PAD} y2={H - AXIS - PAD} stroke={chart.grid} strokeWidth={1} />
          {shown.map((d, i) => {
            const v = values[i];
            const barH = Math.max(H - AXIS - PAD - y(v), 1.5);
            return (
              <g key={d.date}>
                <rect
                  x={PAD + i * bw + 2} y={y(v)} width={Math.max(bw - 4, 2)} height={barH} rx={3}
                  fill={hover === i ? '#7BEDC0' : chart.fees} opacity={hover === i ? 1 : 0.85}
                  onPointerEnter={() => setHover(i)}
                />
                <text x={PAD + i * bw + bw / 2} y={H - 5} textAnchor="middle" fontSize={8.5} fill={chart.axis} fontFamily="inherit">
                  {dayLabel(d.date)}
                </text>
              </g>
            );
          })}
        </svg>
        {hover !== null && shown[hover] && (
          <div style={{
            position: 'absolute', top: 8, right: 10, background: 'rgba(12,12,18,0.95)', border: btb.borderSoft,
            borderRadius: 10, padding: '7px 10px', fontSize: 11, pointerEvents: 'none',
          }}>
            <div style={{ color: btb.textDim }}>{new Date(shown[hover].date * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
            <div style={{ color: chart.fees, fontWeight: 800, marginTop: 2 }}>{fmtUsd(values[hover])}{mode === 'cumulative' ? ' total' : ''}</div>
          </div>
        )}
      </div>
    );
  };

  return (
    <Section
      kicker="Section 4"
      title="Fee Generation"
      subtitle={series.length > 0
        ? 'Your share of the fees this pool actually earned each day, at your deposit and range.'
        : 'Fee estimate for your deposit and range. Day by day history needs subgraph data, which is not available for this pool.'}
      right={mode && series.length > 0 ? (
        <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: 3 }}>
          {(['daily', 'cumulative'] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} style={{
              height: 26, padding: '0 10px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 11, fontWeight: 700, textTransform: 'capitalize',
              background: mode === m ? 'rgba(82,227,164,0.2)' : 'transparent',
              color: mode === m ? '#52E3A4' : btb.textMuted,
            }}>{m}</button>
          ))}
        </div>
      ) : undefined}
    >
      {renderChart()}

      {!sim.hasFeeData && (
        <div style={{ color: btb.amber, fontSize: 12, background: 'rgba(255,179,107,0.08)', border: '1px solid rgba(255,179,107,0.3)', borderRadius: 12, padding: '10px 12px' }}>
          No recent fee data found for this pool, so fee projections show as zero. The IL and price sections below still work.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(5, 1fr)', gap: 8, marginTop: 12 }}>
        <Stat label="Average Daily Fee" value={stats ? fmtUsd(stats.avg) : fmtUsd(sim.dailyFeeUsd)} color={chart.fees} />
        <Stat label="Median Fee" value={stats ? fmtUsd(stats.median) : '—'} />
        <Stat label="Highest Fee" value={stats ? fmtUsd(stats.max) : '—'} />
        <Stat label="Lowest Fee" value={stats ? fmtUsd(stats.min) : '—'} />
        <Stat
          label="Volume Needed"
          value={volumeNeeded != null ? `${fmtCompactUsd(volumeNeeded)}/day` : '—'}
          sub="pool volume to sustain this"
        />
      </div>
    </Section>
  );
}
