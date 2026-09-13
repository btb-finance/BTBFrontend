'use client';
import { btb } from './design-tokens';
import { Icon } from './Icon';
import { tickToPrice } from '@/protocols/dexs/uniswap';

/** Pool price for LP cards: plain decimals at every magnitude, no exponents. */
export function fmtPrice(v: number) {
  if (!Number.isFinite(v) || v <= 0) return '0';
  if (v >= 1e12) return '∞';
  if (v >= 1000) return v.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (v >= 1) return v.toLocaleString('en-US', { maximumFractionDigits: 4 });
  return v.toLocaleString('en-US', { maximumSignificantDigits: 4, maximumFractionDigits: 10 });
}

/** Shared stat box used by every LP card so the three lists on the
 * portfolio read as one design. */
export const lpBox = (isMobile: boolean) => ({
  padding: isMobile ? '10px 12px' : '12px 14px', borderRadius: 14,
  background: 'rgba(var(--fg-rgb), 0.035)', border: '1px solid rgba(var(--fg-rgb), 0.05)', minWidth: 0,
});
export const lpBoxLabel = { color: btb.textMuted, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 } as const;
export const lpBoxValue = (isMobile: boolean) => ({
  color: btb.text, fontSize: isMobile ? 15 : 17, fontWeight: 800, marginTop: 5,
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
});

/** Price range panel: pair label and current price on top, a track with the
 * position's band and a marker for the current price, distance to each edge
 * below. Full range positions show a full band. */
export interface RangeBarProps {
  symbol0: string; symbol1: string; decimals0: number; decimals1: number;
  tickLower: number; tickUpper: number; currentTick: number; inRange: boolean;
}

export function RangeBar({ p }: { p: RangeBarProps }) {
  const fullRange = p.tickLower <= -887200 && p.tickUpper >= 887200;
  const pLow = tickToPrice(p.tickLower, p.decimals0, p.decimals1);
  const pHigh = tickToPrice(p.tickUpper, p.decimals0, p.decimals1);
  const pNow = tickToPrice(p.currentTick, p.decimals0, p.decimals1);
  // Window is the range plus a quarter of its width each side; the marker
  // clamps to the track so a far-out price still shows which side it is on.
  const span = Math.max(1, p.tickUpper - p.tickLower);
  const winLo = p.tickLower - span * 0.25;
  const winHi = p.tickUpper + span * 0.25;
  const pct = (tick: number) => Math.max(1, Math.min(99, ((tick - winLo) / (winHi - winLo)) * 100));
  const bandL = fullRange ? 0 : pct(p.tickLower);
  const bandR = fullRange ? 100 : pct(p.tickUpper);
  const mark = fullRange ? 50 : pct(p.currentTick);
  const dist = (target: number) => (pNow > 0 && Number.isFinite(target) ? ((target / pNow) - 1) * 100 : 0);
  const tone = p.inRange ? btb.green : btb.amber;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
        <span style={{ color: btb.textDim, fontSize: 11.5 }}>{p.symbol1}/{p.symbol0}{fullRange ? ' · full range' : ''}</span>
        <span style={{ color: tone, fontSize: 14, fontWeight: 800 }}>{fmtPrice(pNow)}</span>
      </div>
      <div style={{ position: 'relative', height: 30, marginTop: 8 }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: 10, background: 'rgba(var(--fg-rgb), 0.05)' }}/>
        <div style={{
          position: 'absolute', top: 0, bottom: 0, left: `${bandL}%`, width: `${bandR - bandL}%`, borderRadius: 10,
          background: p.inRange ? 'rgba(82,227,164,0.16)' : 'rgba(255,179,107,0.14)',
          border: `1px solid ${p.inRange ? 'rgba(82,227,164,0.3)' : 'rgba(255,179,107,0.3)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px', boxSizing: 'border-box', overflow: 'hidden',
        }}>
          <span style={{ color: btb.textMuted, fontSize: 11, whiteSpace: 'nowrap' }}>{fullRange ? '0' : fmtPrice(pLow)}</span>
          <span style={{ color: btb.textMuted, fontSize: 11, whiteSpace: 'nowrap' }}>{fullRange ? '∞' : fmtPrice(pHigh)}</span>
        </div>
        <div style={{ position: 'absolute', top: -3, bottom: -3, left: `calc(${mark}% - 1px)`, width: 2, background: tone, borderRadius: 2 }}/>
        <div style={{ position: 'absolute', top: '50%', left: `calc(${mark}% - 5px)`, width: 10, height: 10, marginTop: -5, borderRadius: 999, background: tone, boxShadow: `0 0 0 3px ${p.inRange ? 'rgba(82,227,164,0.25)' : 'rgba(255,179,107,0.25)'}` }}/>
      </div>
      {!fullRange && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: btb.textDim }}>
          <span>{dist(pLow) >= 0 ? '+' : ''}{dist(pLow).toFixed(1)}%</span>
          <span>{dist(pHigh) >= 0 ? '+' : ''}{dist(pHigh).toFixed(1)}%</span>
        </div>
      )}
    </div>
  );
}

export type LpTone = 'neutral' | 'green' | 'amber' | 'danger';

const LP_TONES: Record<LpTone, { color: string; bg: string; border: string }> = {
  neutral: { color: btb.text,  bg: 'rgba(var(--fg-rgb), 0.07)',  border: 'rgba(var(--fg-rgb), 0.13)' },
  green:   { color: btb.green, bg: 'rgba(82,227,164,0.12)',   border: 'rgba(82,227,164,0.35)' },
  amber:   { color: btb.amber, bg: 'rgba(255,179,107,0.14)',  border: 'rgba(255,179,107,0.4)' },
  danger:  { color: btb.loss,  bg: 'rgba(255,107,122,0.10)',  border: 'rgba(255,107,122,0.3)' },
};

/** The one LP action button. Tone says what kind of move it is (green
 * collects money, amber needs attention, red removes), `solid` makes it the
 * primary call to action, `full` lets it share a grid row on phones. */
export function LpButton({ icon, label, onClick, disabled, tone = 'neutral', solid, full }: {
  icon?: string; label: string; onClick: () => void; disabled?: boolean; tone?: LpTone; solid?: boolean; full?: boolean;
}) {
  const t = LP_TONES[tone];
  const color = disabled ? btb.textDim : solid ? '#fff' : t.color;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        height: full ? 40 : 36, padding: '0 14px', borderRadius: 11, fontFamily: 'inherit', whiteSpace: 'nowrap',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontSize: 12.5, fontWeight: 700,
        minWidth: full ? 0 : undefined, overflow: 'hidden', textOverflow: 'ellipsis',
        cursor: disabled ? 'default' : 'pointer', color,
        background: disabled ? 'rgba(var(--fg-rgb), 0.05)' : solid && tone === 'green' ? btb.gradGreen : t.bg,
        border: `1px solid ${disabled ? 'rgba(var(--fg-rgb), 0.07)' : solid ? 'transparent' : t.border}`,
        boxShadow: !disabled && solid ? '0 6px 16px rgba(82,227,164,0.25)' : 'none',
        transition: 'opacity 0.15s, transform 0.1s',
      }}
    >
      {icon && <Icon name={icon} size={14} color={color}/>}
      {label}
    </button>
  );
}

