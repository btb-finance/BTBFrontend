'use client';
import { btb } from './design-tokens';

/**
 * Price-history chart with the selected LP range drawn as a band — the
 * Metrix-style "where does my range sit vs where price has been" view.
 *
 * `points` is the daily price series (ascending). `min`/`max` are the range
 * bounds in the same units (null = open-ended), `current` the live price.
 */
export function RangeChart({ points, min, max, current }: {
  points: number[];
  min: number | null;
  max: number | null;
  current: number;
}) {
  const W = 320, H = 130, PAD = 6;
  if (points.length < 2 || !(current > 0)) return null;

  // y-domain covers the series, current price, and (finite) band edges.
  const candidates = [...points, current];
  if (min !== null && min > 0) candidates.push(min);
  if (max !== null && isFinite(max)) candidates.push(max);
  let loY = Math.min(...candidates), hiY = Math.max(...candidates);
  const padY = (hiY - loY || hiY * 0.1 || 1) * 0.1;
  loY -= padY; hiY += padY;
  if (loY < 0) loY = 0;

  const x = (i: number) => PAD + (i / (points.length - 1)) * (W - PAD * 2);
  const y = (p: number) => H - PAD - ((p - loY) / (hiY - loY)) * (H - PAD * 2);

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p).toFixed(1)}`).join(' ');

  // Band rectangle — open-ended sides extend to the chart edge.
  const bandTop = max !== null && isFinite(max) ? y(max) : PAD;
  const bandBot = min !== null && min > 0 ? y(min) : H - PAD;
  const inBand = (min === null || current >= min) && (max === null || !isFinite(max) || current <= max);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} preserveAspectRatio="none">
      {/* selected range */}
      {bandBot > bandTop && (
        <rect x={PAD} y={bandTop} width={W - PAD * 2} height={bandBot - bandTop}
          fill={inBand ? 'rgba(82,227,164,0.12)' : 'rgba(255,179,107,0.10)'}
          stroke={inBand ? 'rgba(82,227,164,0.45)' : 'rgba(255,179,107,0.4)'} strokeWidth={1} rx={4}/>
      )}
      {/* price history */}
      <path d={path} fill="none" stroke="rgba(125,211,252,0.9)" strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round"/>
      {/* current price */}
      <line x1={PAD} x2={W - PAD} y1={y(current)} y2={y(current)} stroke={btb.text} strokeWidth={1} strokeDasharray="4 4" opacity={0.7}/>
      <circle cx={W - PAD} cy={y(current)} r={3} fill={inBand ? '#52E3A4' : '#FFB36B'}/>
    </svg>
  );
}
