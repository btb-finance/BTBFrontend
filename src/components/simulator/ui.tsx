'use client';
/** Shared primitives for the simulator sections — one place for the section
 * shell and number formatting so all twelve panels read as one system. */
import type { CSSProperties, ReactNode } from 'react';
import { Glass } from '../Glass';
import { btb } from '../design-tokens';

export const fmtUsd = (v: number): string => {
  const a = Math.abs(v);
  const s = a >= 1000 ? a.toLocaleString('en-US', { maximumFractionDigits: 0 })
    : a >= 10 ? a.toFixed(2).replace(/\.00$/, '')
    : a.toFixed(2);
  return `${v < 0 ? '−' : ''}$${s}`;
};

export const fmtSignedUsd = (v: number): string => (v >= 0 ? `+${fmtUsd(v)}` : fmtUsd(v));

export const fmtPct = (v: number, dp = 1): string => `${v < 0 ? '−' : ''}${Math.abs(v).toFixed(dp)}%`;

export const fmtSignedPct = (v: number, dp = 1): string => (v >= 0 ? `+${fmtPct(v, dp)}` : fmtPct(v, dp));

export const fmtPrice = (p: number): string => {
  if (!isFinite(p)) return '∞';
  if (p === 0) return '0';
  return p >= 1000
    ? p.toLocaleString('en-US', { maximumFractionDigits: 0 })
    : parseFloat(p.toPrecision(5)).toLocaleString('en-US', { maximumFractionDigits: 8 });
};

/** Consistent section shell: numbered kicker, title, one-line explanation. */
export function Section({ kicker, title, subtitle, right, children, id }: {
  kicker?: string;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  id?: string;
}) {
  return (
    <Glass padding={0} radius={22} style={{ overflow: 'visible' }}>
      <div id={id} style={{ padding: '18px 20px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {kicker && (
              <div style={{ color: btb.textDim, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 3 }}>{kicker}</div>
            )}
            <div style={{ color: btb.text, fontSize: 15.5, fontWeight: 800, letterSpacing: -0.2 }}>{title}</div>
            {subtitle && <div style={{ color: btb.textMuted, fontSize: 11.5, marginTop: 3, lineHeight: 1.5 }}>{subtitle}</div>}
          </div>
          {right}
        </div>
        <div style={{ marginTop: 14 }}>{children}</div>
      </div>
    </Glass>
  );
}

/** Small stat cell used across panels. */
export function Stat({ label, value, color, sub, style }: {
  label: string; value: string; color?: string; sub?: string; style?: CSSProperties;
}) {
  return (
    <div style={{ flex: 1, minWidth: 0, background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '9px 11px', ...style }}>
      <div style={{ color: btb.textDim, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
      <div style={{ color: color ?? btb.text, fontSize: 15, fontWeight: 800, marginTop: 2, letterSpacing: -0.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
      {sub && <div style={{ color: btb.textDim, fontSize: 10, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

/** Selectable option card (fee tier, strategy, amounts). */
export function OptionCard({ selected, onClick, title, sub, badge, flex = 1 }: {
  selected: boolean; onClick: () => void; title: string; sub?: string; badge?: string; flex?: number;
}) {
  return (
    <button onClick={onClick} style={{
      flex, minWidth: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
      background: selected ? 'rgba(82,227,164,0.12)' : 'rgba(255,255,255,0.04)',
      border: `1px solid ${selected ? 'rgba(82,227,164,0.5)' : 'rgba(255,255,255,0.1)'}`,
      borderRadius: 14, padding: '11px 13px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: selected ? '#52E3A4' : btb.text, fontSize: 14, fontWeight: 800, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
        {badge && <span style={{ color: btb.textDim, fontSize: 9.5, fontWeight: 700, flexShrink: 0 }}>{badge}</span>}
      </div>
      {sub && <div style={{ color: btb.textMuted, fontSize: 10.5, marginTop: 3, lineHeight: 1.4 }}>{sub}</div>}
    </button>
  );
}

/** The "+" connector between strategy builder steps. */
export function PlusDivider() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0' }}>
      <div style={{
        width: 26, height: 26, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(255,255,255,0.05)', border: btb.borderSoft, color: btb.textMuted, fontSize: 14, fontWeight: 800,
      }}>+</div>
    </div>
  );
}

/** Chart color assignments — fixed, never cycled (dataviz rule). All series
 * are also direct-labeled so identity never rides on color alone. */
export const chart = {
  fees: '#52E3A4',      // fee income and positive outcomes
  il: '#FFB36B',        // impermanent loss and warnings
  net: '#7DD3FC',       // net and price lines
  alt: '#5B8DEF',       // secondary comparison series
  neg: '#FF6B7A',       // losses
  grid: 'rgba(255,255,255,0.07)',
  axis: 'rgba(255,255,255,0.35)',
} as const;
