'use client';
import { useEffect, useRef, useState } from 'react';
import { btb } from './design-tokens';

/**
 * Interactive price-history chart with a draggable LP range — the Uniswap-web
 * "set your range on the chart" control, sized for the mobile sheet.
 *
 * `points` is the daily price series (ascending), `min`/`max` the range bounds
 * in the same units (null = open-ended), `current` the live price. Dragging
 * the right-rail handles calls `onChange(min, max)` with finite values.
 *
 * Geometry rules that make dragging actually work:
 *  - the y-domain includes the BAND, not just price history — otherwise a
 *    range above the 30-day high pins the handle to the chart edge and
 *    upward drags are no-ops;
 *  - the domain is FROZEN while dragging, so the px→price mapping doesn't
 *    shift under the pointer; it re-fits on release.
 */
export function RangeChart({ points, min, max, current, onChange }: {
  points: number[];
  min: number | null;
  max: number | null;
  current: number;
  onChange?: (min: number, max: number) => void;
}) {
  const W = 320, H = 150, PAD = 8, RAIL = 30; // right rail hosts the drag handles
  const svgRef = useRef<SVGSVGElement | null>(null);
  const frozen = useRef<{ lo: number; hi: number } | null>(null);
  const [drag, setDrag] = useState<'min' | 'max' | null>(null);
  const [zoom, setZoom] = useState(1); // y-domain width multiplier (1 = fit)

  // Live domain: data + current price + finite band edges, padded; zoom widens.
  const cands = [...points, current];
  if (min !== null && min > 0) cands.push(min);
  if (max !== null && isFinite(max) && max > 0) cands.push(max);
  const dLo = Math.min(...cands);
  const dHi = Math.max(...cands);
  const mid = (dLo + dHi) / 2;
  const half = ((dHi - dLo) / 2 || dHi * 0.05 || 1) * 1.2 * zoom;
  const live = { lo: Math.max(0, mid - half), hi: mid + half };
  const dom = drag && frozen.current ? frozen.current : live;

  const plotW = W - RAIL;
  const x = (i: number) => PAD + (i / (points.length - 1)) * (plotW - PAD * 2);
  const y = (p: number) => H - PAD - ((p - dom.lo) / (dom.hi - dom.lo)) * (H - PAD * 2);
  const clampY = (v: number) => Math.min(H - PAD, Math.max(PAD, v));

  // effective bounds for display/drag — open-ended sides sit at the domain edge
  const effMin = min !== null && min > 0 ? min : dom.lo;
  const effMax = max !== null && isFinite(max) && max > 0 ? max : dom.hi;

  useEffect(() => {
    if (!drag || !onChange) return;
    const move = (e: PointerEvent) => {
      const d = frozen.current;
      const rect = svgRef.current?.getBoundingClientRect();
      if (!d || !rect || rect.height === 0) return;
      const svgY = ((e.clientY - rect.top) / rect.height) * H;
      let p = d.lo + ((H - PAD - svgY) / (H - PAD * 2)) * (d.hi - d.lo);
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
  }, [drag, onChange, effMin, effMax]);

  if (points.length < 2 || !(current > 0)) return null;

  const startDrag = (kind: 'min' | 'max') => {
    frozen.current = { ...dom }; // lock the px→price mapping for this gesture
    setDrag(kind);
  };

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${clampY(y(p)).toFixed(1)}`).join(' ');
  const bandTop = clampY(y(effMax));
  const bandBot = clampY(y(effMin));
  const inBand = current >= effMin && current <= effMax;
  const accent = inBand ? '#52E3A4' : '#FFB36B';

  const fmtTick = (p: number) => (p >= 1000 ? p.toLocaleString('en-US', { maximumFractionDigits: 0 }) : parseFloat(p.toPrecision(4)).toString());

  const handle = (kind: 'min' | 'max', cy: number) => (
    <g key={kind}>
      <circle cx={W - RAIL / 2} cy={cy} r={7} fill="#fff" stroke={accent} strokeWidth={2}/>
      <line x1={W - RAIL / 2 - 3} x2={W - RAIL / 2 + 3} y1={cy - 1.5} y2={cy - 1.5} stroke="#666" strokeWidth={1}/>
      <line x1={W - RAIL / 2 - 3} x2={W - RAIL / 2 + 3} y1={cy + 1.5} y2={cy + 1.5} stroke="#666" strokeWidth={1}/>
      {/* generous invisible hit area for touch */}
      <rect x={W - RAIL} y={cy - 16} width={RAIL} height={32} fill="transparent"
        style={{ cursor: 'ns-resize', touchAction: 'none' }}
        onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); startDrag(kind); }}/>
    </g>
  );

  return (
    <div style={{ position: 'relative' }}>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', userSelect: 'none' }}>
        {/* selected range band */}
        {bandBot > bandTop && (
          <rect x={PAD} y={bandTop} width={W - PAD * 2} height={bandBot - bandTop}
            fill={inBand ? 'rgba(82,227,164,0.10)' : 'rgba(255,179,107,0.09)'}
            stroke={inBand ? 'rgba(82,227,164,0.45)' : 'rgba(255,179,107,0.4)'} strokeWidth={1} rx={4}/>
        )}
        {/* price history */}
        <path d={path} fill="none" stroke="rgba(125,211,252,0.9)" strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round"/>
        {/* current price */}
        <line x1={PAD} x2={plotW - PAD} y1={clampY(y(current))} y2={clampY(y(current))} stroke={btb.text} strokeWidth={1} strokeDasharray="4 4" opacity={0.7}/>
        <circle cx={plotW - PAD} cy={clampY(y(current))} r={3} fill={accent}/>
        {/* handle price labels */}
        <text x={W - RAIL - 5} y={Math.max(bandTop - 4, 10)} textAnchor="end" fontSize={9} fill={btb.textMuted} fontFamily="inherit">{fmtTick(effMax)}</text>
        <text x={W - RAIL - 5} y={Math.min(bandBot + 11, H - 3)} textAnchor="end" fontSize={9} fill={btb.textMuted} fontFamily="inherit">{fmtTick(effMin)}</text>
        {/* drag handles on the rail */}
        {handle('max', bandTop)}
        {handle('min', bandBot)}
      </svg>
      {/* y-zoom — '−' widens the price scale to place ranges far from recent history */}
      {onChange && (
        <div style={{ position: 'absolute', top: 0, right: 0, display: 'flex', gap: 6 }}>
          {([['+', 1 / 1.4], ['−', 1.4]] as const).map(([label, factor]) => (
            <button key={label}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); setZoom((z) => Math.min(12, Math.max(0.3, z * factor))); }}
              style={{
                width: 28, height: 28, borderRadius: 9, border: '1px solid rgba(255,255,255,0.16)', cursor: 'pointer',
                background: 'rgba(20,20,28,0.85)', color: btb.text, fontSize: 15, lineHeight: 1, fontFamily: 'inherit', padding: 0,
              }}>{label}</button>
          ))}
        </div>
      )}
    </div>
  );
}
