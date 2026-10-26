'use client';
import { useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { btb } from './design-tokens';
import { Icon } from './Icon';

export type RangePreset = { label: string; pct: number | null };

/**
 * The one range picker every LP screen shares: live price with a flip, a depth
 * strip and slider (Wind Swap style) with draggable handles and band, time in range, presets and min/max cards.
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
  const half = (width / 2) + pad;
  const dLow = Math.exp(mid - half), dHigh = Math.exp(mid + half);
  const span = Math.log(dHigh / dLow) || 1;
  const pct = (v: number) => Math.max(0, Math.min(100, (Math.log(v / dLow) / span) * 100));
  const left = pct(safeLow), right = pct(safeHigh), now = pct(current);
  const inRange = isFull || (current >= safeLow && current <= safeHigh);
  const tone = inRange ? btb.green : btb.amber;
  const toneRgb = inRange ? 'var(--green-rgb)' : 'var(--amber-rgb)';
  const dist = (v: number) => { const d = (v / current - 1) * 100; return `${d >= 0 ? '+' : '-'}${Math.abs(d).toFixed(Math.abs(d) < 1 ? 2 : 1)}%`; };

  // Histogram: bucket the depth into 60 columns across the visible window.
  const COLS = 36;
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
  // A round slider thumb, as on Wind Swap: white with the range colour as its rim, a wide invisible grab area.
  const thumb = (at: number, which: 'low' | 'high') => (
    <div onPointerDown={(e) => begin(e, which)} aria-label={which === 'low' ? 'Lower price bound' : 'Upper price bound'}
      style={{ position: 'absolute', top: 0, left: `calc(${at}% - 16px)`, width: 32, height: 32, cursor: 'ew-resize', touchAction: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', border: `3px solid ${tone}`, boxShadow: '0 2px 8px rgba(0,0,0,0.3)', boxSizing: 'border-box' }}/>
    </div>
  );
  // Min and max, laid out like Wind Swap's: a coloured label with the distance from the price, then minus, the price, plus.
  const card = (which: 'min' | 'max') => {
    const v = which === 'min' ? safeLow : safeHigh;
    const color = which === 'min' ? btb.loss : btb.green;
    const rgb = which === 'min' ? 'var(--loss-rgb, 239,68,68)' : 'var(--green-rgb)';
    return (
      <div style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 6, fontSize: 11.5 }}>
          <span style={{ color, fontWeight: 700 }}>{which === 'min' ? 'Min price' : 'Max price'}</span>
          {!isFull && <span style={{ color, fontSize: 10.5, fontWeight: 800, padding: '1px 6px', borderRadius: 6, background: `rgba(${rgb}, 0.16)` }}>{dist(v)}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button type="button" disabled={isFull} onClick={() => onNudge(which, -1)} style={stepBtn} aria-label={`${which === 'min' ? 'Min' : 'Max'} price down`}>-</button>
          <input value={isFull ? (which === 'min' ? '0' : '∞') : which === 'min' ? minStr : maxStr} inputMode="decimal" readOnly={isFull}
            onChange={(e) => (which === 'min' ? onMinStr : onMaxStr)(e.target.value)}
            style={{ flex: 1, minWidth: 0, boxSizing: 'border-box', height: 34, padding: '0 4px', textAlign: 'center', borderRadius: 10, border: '1px solid rgba(var(--fg-rgb), 0.1)', outline: 'none', background: 'transparent', color: btb.text, fontSize: 16, fontWeight: 800, fontFamily: 'inherit' }}/>
          <button type="button" disabled={isFull} onClick={() => onNudge(which, 1)} style={stepBtn} aria-label={`${which === 'min' ? 'Min' : 'Max'} price up`}>+</button>
        </div>
      </div>
    );
  };
  const stepBtn = { ...smallBtn, width: 32, height: 32, borderRadius: 10, fontSize: 17, flexShrink: 0, background: 'rgba(var(--fg-rgb), 0.1)', border: 'none', color: btb.text } as const;
  // No Custom chip: dragging the band or typing a price already makes the range custom.
  const allPresets = presets.map((p) => ({ label: p.label, go: () => onPreset(p.pct) }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
      {/* Your range: price, depth chart with the draggable band, then min and max. */}
      <div style={{ padding: 14, borderRadius: 16, background: 'rgba(var(--fg-rgb), 0.04)', border: '1px solid rgba(var(--fg-rgb), 0.1)', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ color: btb.textMuted, fontSize: 12, fontWeight: 700 }}>Your range</span>
          <span style={{ flexShrink: 0, color: tone, fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 7, background: `linear-gradient(90deg, rgba(${toneRgb}, 0.22), rgba(${toneRgb}, 0.1))`, border: `1px solid rgba(${toneRgb}, 0.3)` }}>
            {isFull ? 'Full range' : inRange ? 'In range' : 'Out of range'}
          </span>
        </div>
        <button type="button" onClick={onFlip} title="Flip which token prices are quoted in" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0, padding: 0, border: 'none', background: 'transparent', color: btb.text, fontSize: 12.5, fontWeight: 750, cursor: 'pointer', fontFamily: 'inherit', alignSelf: 'flex-start', maxWidth: '100%' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: btb.green, flexShrink: 0 }}/>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{priceLabel}</span>
          <Icon name="swap" size={12} color={btb.textMuted}/>
        </button>

        {/* Wind Swap style: a short strip of liquidity bars (yours in colour, the current price in white), then a
            slider under it whose round handles and filled band set the range. Both share one drag surface. */}
        <div onPointerMove={move} onPointerUp={end} onPointerCancel={end} style={{ position: 'relative', touchAction: 'none', userSelect: 'none' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', gap: 2, height: 46, padding: '0 1px' }}>
            {cols.map((c, i) => {
              const mid = ((i + 0.5) / COLS) * 100;
              const isNow = Math.abs(mid - now) <= 50 / COLS;
              const inBand = mid >= left && mid <= right;
              return (
                <div key={i} style={{
                  flex: 1, height: `${c > 0 ? Math.max(8, (c / maxCol) * 100) : 4}%`, borderRadius: 2,
                  background: isNow ? btb.text : inBand ? `rgba(${toneRgb}, 0.75)` : 'rgba(var(--fg-rgb), 0.14)',
                }}/>
              );
            })}
            <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${now}%`, width: 1, background: 'rgba(var(--fg-rgb), 0.5)', pointerEvents: 'none' }}/>
          </div>

          <div style={{ position: 'relative', height: 44, marginTop: 6 }}>
            <div style={{ position: 'absolute', left: 0, right: 0, top: 12, height: 8, borderRadius: 999, background: 'rgba(var(--fg-rgb), 0.1)' }}/>
            <div onPointerDown={(e) => begin(e, 'band')} title="Drag to move the range" style={{
              position: 'absolute', top: 12, height: 8, borderRadius: 999, cursor: 'grab', touchAction: 'none',
              left: `${left}%`, width: `${Math.max(1, right - left)}%`,
              background: inRange ? 'linear-gradient(90deg, var(--btb-green), var(--chain-accent, var(--btb-green)))' : btb.amber,
            }}/>
            <div style={{ position: 'absolute', left: `${now}%`, top: 7, width: 3, height: 18, marginLeft: -1.5, borderRadius: 2, background: btb.text, pointerEvents: 'none' }}>
              <span style={{ position: 'absolute', top: 22, left: '50%', transform: 'translateX(-50%)', color: btb.textDim, fontSize: 9.5, fontWeight: 700, whiteSpace: 'nowrap' }}>Current</span>
            </div>
            {!isFull && thumb(left, 'low')}
            {!isFull && thumb(right, 'high')}
          </div>
        </div>

        {inRangePct != null && !isFull && (
          <div style={{ color: btb.textMuted, fontSize: 11.5 }}>
            In range <b style={{ color: inRangePct >= 70 ? btb.green : inRangePct >= 40 ? btb.amber : btb.loss }}>{Math.round(inRangePct)}%</b> of the last {inRangeDays ?? 30} days
          </div>
        )}

        {/* Side by side when there is room, stacked on a narrow phone so the steppers never run off the card. */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginTop: 2 }}>
          {card('min')}
          {card('max')}
        </div>
      </div>

      {/* Presets under the range card, one compact row; the lit one gets the green gradient. Scrolls sideways if six do not fit. */}
      <div>
        <div style={{ color: btb.textMuted, fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Range</div>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {allPresets.map((p) => {
            const on = activePreset === p.label;
            return (
              <button key={p.label} type="button" onClick={p.go} style={{
                flex: '1 0 auto', minWidth: 52, padding: '0 10px', height: 34, borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 800, whiteSpace: 'nowrap',
                background: on ? 'linear-gradient(135deg, rgba(var(--green-rgb), 0.28), rgba(var(--green-rgb), 0.08))' : 'rgba(var(--fg-rgb), 0.05)',
                border: on ? '1px solid rgba(var(--green-rgb), 0.5)' : '1px solid rgba(var(--fg-rgb), 0.1)',
                color: on ? btb.text : btb.textMuted,
              }}>{p.label}</button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
