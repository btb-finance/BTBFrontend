// Pieces of Home's hero card shared by TokenPanel and the server-rendered Home preview (../previews/HomePreview).
// No hooks: the phone/desktop choice comes in as a prop.
import type { CSSProperties } from 'react';
import { btb } from '../design-tokens';
import { orSkeleton } from '../Skeleton';

export const LABEL_STYLE = { color: btb.textDim, fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: 0.5 };
export const CARD_STYLE = { background: 'rgba(var(--fg-rgb), 0.05)', border: btb.borderSoft, borderRadius: 14, padding: '11px 13px', minWidth: 0 };

/** Small stat tile used across the hero and proof grids. `row`: label left, value right, for a phone, where three
 * tiles side by side leave each about 70px and the labels ran into each other. */
export function StatTile({ label, value: raw, sub, color, row = false }: { label: string; value: string; sub?: string; color?: string; row?: boolean }) {
  const value = orSkeleton(raw);
  if (row) return (
    <div style={{ ...CARD_STYLE, padding: '10px 13px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <div style={LABEL_STYLE}>{label}</div>
      <div style={{ textAlign: 'right', minWidth: 0 }}>
        <div style={{ color: color ?? btb.text, fontSize: 16, fontWeight: 800, letterSpacing: -0.3, whiteSpace: 'nowrap' }}>{value}</div>
        {sub && <div style={{ color: btb.textDim, fontSize: 11, marginTop: 1 }}>{sub}</div>}
      </div>
    </div>
  );
  return (
    <div style={CARD_STYLE}>
      <div style={{ ...LABEL_STYLE, lineHeight: 1.3 }}>{label}</div>
      <div style={{ color: color ?? btb.text, fontSize: 17, fontWeight: 800, marginTop: 3, letterSpacing: -0.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
      {sub && <div style={{ color: btb.textDim, fontSize: 11, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export function heroCardStyle(mobile: boolean): CSSProperties {
  return {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 22,
    padding: mobile ? 16 : 20,
    border: '1px solid rgba(var(--green-rgb), 0.3)',
    background: 'radial-gradient(120% 150% at 88% -30%, rgba(var(--green-rgb), 0.22), transparent 55%), radial-gradient(90% 120% at 0% 115%, rgba(125,211,252,0.10), transparent 55%), linear-gradient(165deg, rgba(var(--fg-rgb), 0.06), rgba(var(--fg-rgb), 0.015))',
    display: 'flex', flexDirection: 'column', gap: 14,
  };
}

/** The hero's big APR figure; a loading bar while it is '...'. */
export function BigApr({ text, mobile }: { text: string; mobile: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
      <span style={{ color: btb.green, fontSize: mobile ? 40 : 52, fontWeight: 800, letterSpacing: -1.6, lineHeight: 1 }}>{orSkeleton(text, '2.4em')}</span>
      <span style={{ color: btb.text, fontSize: mobile ? 17 : 20, fontWeight: 800 }}>APR</span>
    </div>
  );
}
