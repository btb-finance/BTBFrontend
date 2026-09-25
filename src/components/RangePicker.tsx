'use client';
import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { btb } from './design-tokens';
import { Icon } from './Icon';

export type RangePreset = { label: string; pct: number | null };

/**
 * The one range picker every LP screen shares: live price with a flip, a depth
 * chart with a draggable band, zoom, time in range, presets and min/max cards.
 * All prices are in display space (whatever direction the caller quotes in);
 * the caller turns them into ticks.
 */
export function RangePicker({
  current, low, high, isFull, activePreset, presets, onPreset, onRange,
  minStr, maxStr, onMinStr, onMaxStr, onNudge, depth, inRangePct, inRangeDays, priceLabel, onFlip,
}: {
  current: number;
  low: number;
  high: number;
  isFull: boolean;
  /** Label of the lit preset, or 'Custom'. */
  activePreset: string;
  presets: RangePreset[];
  onPreset: (pct: number | null) => void;
  /** A drag or Custom: the new bounds in display prices. */
  onRange: (low: number, high: number) => void;
  minStr: string;
  maxStr: string;
  onMinStr: (s: string) => void;
  onMaxStr: (s: string) => void;
  /** One tick spacing up or down. */
  onNudge: (which: 'min' | 'max', dir: 1 | -1) => void;
  /** Liquidity by price (display space), for the histogram. */
  depth?: { price: number; liquidity: number }[] | null;
  /** Share of recent days the price sat inside this range, 0 to 100. */
  inRangePct?: number | null;
  inRangeDays?: number;
  priceLabel: string;
  onFlip: () => void;
}) {
  const [zoom, setZoom] = useState(1);
  const drag = useRef<{ id: number; target: 'low' | 'high' | 'band'; startX: number; dLow: number; dHigh: number; low: number; high: number } | null>(null);

  if (!(current > 0)) {
    return <div style={{ color: btb.textDim, fontSize: 12, padding: '24px 0' }}>Loading current price…</div>;
  }

  const safeLow = isFull ? current / 100 : low > 0 ? low : current / 100;
  const safeHigh = isFull ? current * 100 : high > safeLow ? high : current * 100;
  // Frame the range and the price with room on both sides; a tight range still fills about a third of the chart.
  const cLow = Math.log(Math.min(safeLow, current)), cHigh = Math.log(Math.max(safeHigh, current));
  const width = cHigh - cLow;
  const pad = Math.max(width * 0.6, Math.log(1.02));
  const mid = (cLow + cHigh) / 2;
  const half = ((width / 2) + pad) * zoom;
  const dLow = Math.exp(mid - half), dHigh = Math.exp(mid + half);
  const span = Math.log(dHigh / dLow) || 1;
  const pct = (v: number) => Math.max(0, Math.min(100, (Math.log(v / dLow) / span) * 100));
  const left = pct(safeLow), right = pct(safeHigh), now = pct(current);
  const inRange = isFull || (current >= safeLow && current <= safeHigh);
  const tone = inRange ? btb.green : btb.amber;
  const toneRgb = inRange ? 'var(--green-rgb)' : 'var(--amber-rgb)';
  const dist = (v: number) => { const d = (v / current - 1) * 100; return `${d >= 0 ? '+' : '-'}${Math.abs(d).toFixed(Math.abs(d) < 1 ? 2 : 1)}%`; };

  // Histogram: bucket the depth into 60 columns across the visible window.
  const COLS = 60;
  const cols = new Array<number>(COLS).fill(0);
  for (const d of depth ?? []) {
    if (!(d.price > dLow && d.price < dHigh)) continue;
    const i = Math.min(COLS - 1, Math.floor((Math.log(d.price / dLow) / span) * COLS));
    cols[i] = Math.max(cols[i], d.liquidity);
  }
  const maxCol = Math.max(1, ...cols);

  const begin = (e: ReactPointerEvent<HTMLDivElement>, target: 'low' | 'high' | 'band') => {
    if (isFull && target !== 'band') return;
    e.preventDefault(); e.stopPropagation();
    drag.current = { id: e.pointerId, target, startX: e.clientX, dLow, dHigh, low: safeLow, high: safeHigh };
    (e.currentTarget.parentElement ?? e.currentTarget).setPointerCapture(e.pointerId);
  };
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const s = Math.log(d.dHigh / d.dLow);
    const at = Math.exp(Math.log(d.dLow) + Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * s);
    if (d.target === 'low') onRange(Math.min(at, d.high / 1.001), d.high);
    else if (d.target === 'high') onRange(d.low, Math.max(at, d.low * 1.001));
    else { const k = Math.exp(((e.clientX - d.startX) / rect.width) * s); onRange(d.low * k, d.high * k); }
  };
  const end = (e: ReactPointerEvent<HTMLDivElement>) => { if (drag.current?.id === e.pointerId) drag.current = null; };

  const smallBtn = { width: 26, height: 26, borderRadius: 8, border: '1px solid rgba(var(--fg-rgb), 0.12)', background: 'rgba(var(--fg-rgb), 0.06)', color: btb.textMuted, fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 } as const;
  const handle = (at: number, which: 'low' | 'high') => (
    <div onPointerDown={(e) => begin(e, which)} aria-label={which === 'low' ? 'Lower price bound' : 'Upper price bound'}
      style={{ position: 'absolute', top: 0, bottom: 0, left: `calc(${at}% - 14px)`, width: 28, cursor: 'ew-resize', touchAction: 'none', display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: 2, height: '100%', background: tone }}/>
      <div style={{ position: 'absolute', bottom: 6, width: 18, height: 28, borderRadius: 7, background: tone, boxShadow: '0 2px 8px rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
        <span style={{ width: 1.5, height: 12, background: 'rgba(0,0,0,0.45)', borderRadius: 1 }}/>
        <span style={{ width: 1.5, height: 12, background: 'rgba(0,0,0,0.45)', borderRadius: 1 }}/>
      </div>
    </div>
  );
  const card = (which: 'min' | 'max') => {
    const v = which === 'min' ? safeLow : safeHigh;
    return (
      <div style={{ flex: 1, minWidth: 0, padding: '10px 12px', borderRadius: 14, background: 'rgba(var(--fg-rgb), 0.05)', border: '1px solid rgba(var(--fg-rgb), 0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, fontSize: 11 }}>
          <span style={{ color: btb.textDim, fontWeight: 700 }}>{which === 'min' ? 'Min price' : 'Max price'}</span>
          {!isFull && <span style={{ color: tone, fontWeight: 800 }}>{dist(v)}</span>}
        </div>
        <input value={isFull ? (which === 'min' ? '0' : '∞') : which === 'min' ? minStr : maxStr} inputMode="decimal" readOnly={isFull}
          onChange={(e) => (which === 'min' ? onMinStr : onMaxStr)(e.target.value)}
          style={{ width: '100%', boxSizing: 'border-box', marginTop: 4, padding: 0, border: 'none', outline: 'none', background: 'transparent', color: btb.text, fontSize: 17, fontWeight: 800, fontFamily: 'inherit' }}/>
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          <button type="button" disabled={isFull} onClick={() => onNudge(which, -1)} style={{ ...smallBtn, flex: 1, height: 28 }} aria-label="Lower">-</button>
          <button type="button" disabled={isFull} onClick={() => onNudge(which, 1)} style={{ ...smallBtn, flex: 1, height: 28 }} aria-label="Higher">+</button>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <button type="button" onClick={onFlip} title="Flip which token prices are quoted in" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0, padding: 0, border: 'none', background: 'transparent', color: btb.text, fontSize: 13, fontWeight: 750, cursor: 'pointer', fontFamily: 'inherit' }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{priceLabel}</span>
          <Icon name="swap" size={13} color={btb.textMuted}/>
        </button>
        <span style={{ flexShrink: 0, color: tone, fontSize: 11.5, fontWeight: 800, padding: '3px 8px', borderRadius: 999, background: `rgba(${toneRgb}, 0.12)` }}>
          {isFull ? 'Full range' : inRange ? 'In range' : 'Out of range'}
        </span>
      </div>

      {/* Chart: depth histogram, the band with its two handles, the live price. */}
      <div style={{ position: 'relative', borderRadius: 14, background: 'rgba(var(--fg-rgb), 0.035)', border: '1px solid rgba(var(--fg-rgb), 0.07)', overflow: 'hidden' }}>
        <div onPointerMove={move} onPointerUp={end} onPointerCancel={end} style={{ position: 'relative', height: 112, touchAction: 'none' }}>
          <svg viewBox={`0 0 ${COLS} 100`} preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
            {cols.map((c, i) => c > 0 && (
              <rect key={i} x={i + 0.12} y={100 - (c / maxCol) * 78} width={0.76} height={(c / maxCol) * 78}
                fill={(i + 0.5) / COLS * 100 >= left && (i + 0.5) / COLS * 100 <= right ? `rgba(${toneRgb}, 0.45)` : 'rgba(var(--fg-rgb), 0.16)'}/>
            ))}
          </svg>
          <div onPointerDown={(e) => begin(e, 'band')} title="Drag to move the range"
            style={{ position: 'absolute', top: 0, bottom: 0, left: `${left}%`, width: `${Math.max(0.5, right - left)}%`, background: `rgba(${toneRgb}, 0.12)`, cursor: 'grab', touchAction: 'none' }}/>
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: `calc(${now}% - 1px)`, width: 2, background: btb.text, opacity: 0.85, pointerEvents: 'none' }}/>
          {!isFull && handle(left, 'low')}
          {!isFull && handle(right, 'high')}
        </div>
        <div style={{ position: 'absolute', top: 6, right: 6, display: 'flex', gap: 4 }}>
          <button type="button" onClick={() => setZoom((z) => Math.min(8, z * 1.6))} style={smallBtn} aria-label="Zoom out">-</button>
          <button type="button" onClick={() => setZoom((z) => Math.max(0.25, z / 1.6))} style={smallBtn} aria-label="Zoom in">+</button>
          {zoom !== 1 && <button type="button" onClick={() => setZoom(1)} style={{ ...smallBtn, width: 'auto', padding: '0 8px', fontSize: 11 }}>Reset</button>}
        </div>
      </div>

      {inRangePct != null && !isFull && (
        <div style={{ color: btb.textMuted, fontSize: 12 }}>
          In range <b style={{ color: inRangePct >= 70 ? btb.green : inRangePct >= 40 ? btb.amber : btb.loss }}>{Math.round(inRangePct)}%</b> of the last {inRangeDays ?? 30} days
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${presets.length + 1}, minmax(0, 1fr))`, gap: 4, padding: 3, borderRadius: 12, background: 'rgba(var(--fg-rgb), 0.05)' }}>
        {[...presets.map((p) => ({ label: p.label, go: () => onPreset(p.pct) })), { label: 'Custom', go: () => onRange(safeLow, safeHigh) }].map((p) => {
          const on = activePreset === p.label;
          return (
            <button key={p.label} type="button" onClick={p.go} style={{ height: 32, borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 800, whiteSpace: 'nowrap', background: on ? `rgba(${toneRgb}, 0.18)` : 'transparent', color: on ? tone : btb.textMuted }}>{p.label}</button>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        {card('min')}
        {card('max')}
      </div>
    </div>
  );
}
