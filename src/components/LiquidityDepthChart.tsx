'use client';
import { useEffect, useRef, useState } from 'react';
import { btb } from './design-tokens';
import type { TickLiquidityPoint } from '@/protocols/dexs/uniswap/v3/ticks';

/**
 * Liquidity-depth-by-price histogram — x-axis is price (ascending), vertical
 * bars show where existing LPs concentrated liquidity, and two vertical
 * draggable lines set the min/max range directly on top of the shape (the
 * Meteora/Orca-style "position range" control). Same freeze-while-dragging
 * geometry rule as RangeChart: the px→price mapping is locked for a gesture
 * and only re-fits on release, so dragging doesn't fight itself.
 */
export function LiquidityDepthChart({ points, min, max, current, onChange }: {
  points: TickLiquidityPoint[]; // ascending by tick/price
  min: number | null;
  max: number | null;
  current: number;
  onChange?: (min: number, max: number) => void;
}) {
  const W = 320, H = 130, PAD = 6, BOT = 16, BARS = 48;
  const svgRef = useRef<SVGSVGElement | null>(null);
  const frozen = useRef<{ lo: number; hi: number } | null>(null);
  const [drag, setDrag] = useState<'min' | 'max' | null>(null);
  const [zoom, setZoom] = useState(1);

  // Ticks are fetched over a wide bitmap window (many multiples of the visible
  // range) so raw tick prices can span orders of magnitude — basing the
  // display domain on their min/max would blow the chart apart. Instead
  // center on the live price with a fixed default window, widened only by an
  // explicit finite min/max or the zoom control.
  const cands = [current];
  if (min !== null && min > 0) cands.push(min);
  if (max !== null && isFinite(max) && max > 0) cands.push(max);
  const dLo0 = Math.min(...cands);
  const dHi0 = Math.max(...cands);
  const mid = (dLo0 + dHi0) / 2;
  const half = Math.max((dHi0 - dLo0) / 2, mid * 0.3 || 1) * 1.2 * zoom;
  const live = { lo: Math.max(0, mid - half), hi: mid + half };
  const dom = drag && frozen.current ? frozen.current : live;

  const plotW = W - PAD * 2;
  const chartH = H - BOT;
  const x = (p: number) => PAD + ((p - dom.lo) / (dom.hi - dom.lo)) * plotW;
  const clampX = (v: number) => Math.min(W - PAD, Math.max(PAD, v));

  const effMin = min !== null && min > 0 ? min : dom.lo;
  const effMax = max !== null && isFinite(max) && max > 0 ? max : dom.hi;

  // bucket points into BARS vertical bins across the visible domain
  const bins = new Array(BARS).fill(0);
  const binW = (dom.hi - dom.lo) / BARS;
  if (binW > 0) {
    for (const p of points) {
      const idx = Math.floor((p.price - dom.lo) / binW);
      if (idx >= 0 && idx < BARS) bins[idx] = Math.max(bins[idx], p.liquidity);
    }
  }
  const maxBin = Math.max(...bins, 1);

  useEffect(() => {
    if (!drag || !onChange) return;
    const move = (e: PointerEvent) => {
      const d = frozen.current;
      const rect = svgRef.current?.getBoundingClientRect();
      if (!d || !rect || rect.width === 0) return;
      const svgX = ((e.clientX - rect.left) / rect.width) * W;
      let p = d.lo + ((svgX - PAD) / plotW) * (d.hi - d.lo);
      p = Math.min(d.hi, Math.max(d.lo, p));
      if (drag === 'min') onChange(Math.min(p, effMax * 0.999), effMax);
      else onChange(effMin, Math.max(p, effMin * 1.001));
    };
    const up = () => { frozen.current = null; setDrag(null); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag, onChange, effMin, effMax]);

  if (!(current > 0)) return null;

  const startDrag = (kind: 'min' | 'max') => {
    frozen.current = { ...dom };
    setDrag(kind);
  };

  const lineMin = clampX(x(effMin));
  const lineMax = clampX(x(effMax));
  const inBand = current >= effMin && current <= effMax;
  const accent = inBand ? '#52E3A4' : '#FFB36B';
  const barW = Math.max(1, plotW / BARS - 1);

  const fmtTick = (p: number) => (p >= 1000 ? p.toLocaleString('en-US', { maximumFractionDigits: 0 }) : parseFloat(p.toPrecision(4)).toString());

  const handle = (kind: 'min' | 'max', cx: number) => (
    <g key={kind}>
      <line x1={cx} x2={cx} y1={PAD} y2={chartH} stroke={accent} strokeWidth={2}/>
      <rect x={cx - 10} y={PAD - 4} width={20} height={40} fill="transparent"
        style={{ cursor: 'ew-resize', touchAction: 'none' }}
        onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); startDrag(kind); }}/>
    </g>
  );

  return (
    <div style={{ position: 'relative' }}>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', userSelect: 'none' }}>
        {lineMax > lineMin && (
          <rect x={lineMin} y={PAD} width={lineMax - lineMin} height={chartH - PAD}
            fill={inBand ? 'rgba(82,227,164,0.12)' : 'rgba(255,179,107,0.10)'} />
        )}
        {/* liquidity-depth bars, growing upward from the baseline */}
        {bins.map((v, i) => {
          if (v <= 0) return null;
          const binLo = dom.lo + i * binW, binHi = binLo + binW;
          const barInBand = binHi >= effMin && binLo <= effMax;
          const h = (v / maxBin) * (chartH - PAD - 4);
          const bx = PAD + i * (plotW / BARS);
          return (
            <rect key={i} x={bx} y={chartH - h} width={barW} height={Math.max(1, h)}
              fill={barInBand ? 'rgba(82,227,164,0.55)' : 'rgba(125,211,252,0.35)'} />
          );
        })}
        <line x1={PAD} x2={W - PAD} y1={chartH} y2={chartH} stroke="rgba(255,255,255,0.12)" strokeWidth={1}/>
        {/* current price */}
        <line x1={clampX(x(current))} x2={clampX(x(current))} y1={PAD} y2={chartH} stroke={btb.text} strokeWidth={1} strokeDasharray="3 3" opacity={0.6}/>
        {handle('min', lineMin)}
        {handle('max', lineMax)}
        <text x={lineMin} y={H - 3} textAnchor="middle" fontSize={9} fill={btb.textMuted} fontFamily="inherit">{fmtTick(effMin)}</text>
        <text x={lineMax} y={H - 3} textAnchor="middle" fontSize={9} fill={btb.textMuted} fontFamily="inherit">{fmtTick(effMax)}</text>
      </svg>
      {onChange && (
        <div style={{ position: 'absolute', top: 0, right: 0, display: 'flex', gap: 6 }}>
          {([['+', 1 / 1.4], ['−', 1.4]] as const).map(([label, factor]) => (
            <button key={label}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); setZoom((z) => Math.min(12, Math.max(0.3, z * factor))); }}
              style={{
                width: 24, height: 24, borderRadius: 8, border: '1px solid rgba(255,255,255,0.16)', cursor: 'pointer',
                background: 'rgba(20,20,28,0.85)', color: btb.text, fontSize: 13, lineHeight: 1, fontFamily: 'inherit', padding: 0,
              }}>{label}</button>
          ))}
        </div>
      )}
    </div>
  );
}
