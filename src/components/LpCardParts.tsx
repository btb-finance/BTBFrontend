'use client';
import { btb } from './design-tokens';
import { Icon } from './Icon';

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

export type LpTone = 'neutral' | 'green' | 'amber' | 'danger';

const LP_TONES: Record<LpTone, { color: string; bg: string; border: string }> = {
  neutral: { color: btb.text,  bg: 'rgba(var(--fg-rgb), 0.07)',  border: 'rgba(var(--fg-rgb), 0.13)' },
  green:   { color: btb.green, bg: 'rgba(var(--green-rgb), 0.12)',   border: 'rgba(var(--green-rgb), 0.35)' },
  amber:   { color: btb.amber, bg: 'rgba(var(--amber-rgb), 0.14)',  border: 'rgba(var(--amber-rgb), 0.4)' },
  danger:  { color: btb.loss,  bg: 'rgba(var(--loss-rgb), 0.10)',  border: 'rgba(var(--loss-rgb), 0.3)' },
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
        boxShadow: !disabled && solid ? '0 6px 16px rgba(var(--green-rgb), 0.25)' : 'none',
        transition: 'opacity 0.15s, transform 0.1s',
      }}
    >
      {icon && <Icon name={icon} size={14} color={color}/>}
      {label}
    </button>
  );
}

