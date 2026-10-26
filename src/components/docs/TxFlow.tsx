'use client';
import { useState } from 'react';
import { btb } from '../design-tokens';
import { useSidebar } from '../../lib/SidebarContext';
import { ASSET, type Asset } from './palette';
import type { DocFlow, FlowCard } from '../screens/docsContent';

/**
 * One transaction drawn in the docs' map style: where tokens come from on the left, what BTB builds for you to sign
 * as a numbered timeline in the middle, where they end up on the right. Each card is joined to the middle by a line
 * in the colour of what it carries (palette.ts), with a legend of what moves. A Flow / Table switch shows the same
 * steps as rows; on a phone the columns stack and the lines run down.
 */

const assetOf = (c: FlowCard): Asset => c.lines.find((l) => l.asset)?.asset ?? 'token';
const mono = 'ui-monospace, SFMono-Regular, Menlo, monospace';
/** Labels up to this many characters sit beside their amount; longer text goes under it. */
const SHORT_LABEL = 22;

/** Curved lines from each of `n` cards (stacked evenly) to the middle of the other side, in each card's colour. */
function Fan({ colors, toward }: { colors: string[]; toward: 'in' | 'out' }) {
  const n = Math.max(1, colors.length);
  return (
    <div aria-hidden="true" style={{ position: 'relative', alignSelf: 'stretch' }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>
        {colors.map((color, i) => {
          const y = ((i + 0.5) / n) * 100;
          const d = toward === 'in' ? `M0 ${y} C55 ${y} 45 50 100 50` : `M0 50 C55 50 45 ${y} 100 ${y}`;
          return <path key={i} d={d} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke"/>;
        })}
      </svg>
      {/* Heads and tails as plain shapes, so the stretched canvas does not squash them. */}
      {colors.map((color, i) => {
        const y = toward === 'in' ? ((i + 0.5) / n) * 100 : 50;
        return <span key={`t${i}`} style={{ position: 'absolute', left: -4, top: `calc(${y}% - 4px)`, width: 8, height: 8, borderRadius: '50%', background: color }}/>;
      })}
      {(toward === 'in' ? [colors[0] ?? ASSET.token.color] : colors).map((color, i) => {
        const y = toward === 'in' ? 50 : ((i + 0.5) / n) * 100;
        return <span key={`h${i}`} style={{ position: 'absolute', right: -1, top: `calc(${y}% - 6px)`, width: 0, height: 0, borderTop: '6px solid transparent', borderBottom: '6px solid transparent', borderLeft: `9px solid ${color}` }}/>;
      })}
    </div>
  );
}

function Card({ c }: { c: FlowCard }) {
  const accent = ASSET[assetOf(c)].color;
  return (
    <div style={{ position: 'relative', padding: '14px 16px 14px 18px', borderRadius: 16, background: 'rgba(var(--bg-rgb), 0.92)', border: '1px solid rgba(var(--fg-rgb), 0.14)', overflow: 'hidden' }}>
      <span style={{ position: 'absolute', left: 0, top: 12, bottom: 12, width: 3, borderRadius: 3, background: accent }}/>
      <div style={{ color: btb.textMuted, fontSize: 11, fontFamily: mono, letterSpacing: 0.4 }}>{c.where}</div>
      <div style={{ color: btb.text, fontSize: 15.5, fontWeight: 800, marginTop: 3 }}>{c.action}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
        {c.lines.map((l, i) => (
          <div key={i}>
            {l.amount ? (
              // A short label (a token, "BTB per check") rides on the number's line; a sentence gets the card's full
              // width under it, so it never squeezes into a thin column beside the number.
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: ASSET[l.asset ?? 'token'].color }}/>
                  <span style={{ color: l.tone === 'out' ? btb.loss : l.tone === 'in' ? btb.green : btb.text, fontSize: 18, fontWeight: 800, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{l.amount}</span>
                  {l.text.length <= SHORT_LABEL && <span style={{ color: btb.textMuted, fontSize: 13.5 }}>{l.text}</span>}
                </div>
                {l.text.length > SHORT_LABEL && <div style={{ color: btb.textMuted, fontSize: 13.5, lineHeight: 1.5, marginTop: 2, paddingLeft: 16 }}>{l.text}</div>}
              </>
            ) : <div style={{ color: btb.textDim, fontSize: 12.5, lineHeight: 1.5 }}>{l.text}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

export function TxFlow({ f }: { f: DocFlow }) {
  const { isMobile } = useSidebar();
  const [view, setView] = useState<'flow' | 'table'>('flow');
  const fromColors = f.from.map((c) => ASSET[assetOf(c)].color);
  const toColors = f.to.map((c) => ASSET[assetOf(c)].color);
  const used = [...new Set([...f.from, ...f.to].flatMap((c) => c.lines.filter((l) => l.amount).map((l) => l.asset ?? 'token')))] as Asset[];

  const via = (
    <div style={{ padding: '16px 18px', borderRadius: 18, background: 'linear-gradient(180deg, rgba(240,180,60,0.10), rgba(240,180,60,0.04))', border: `1.5px solid ${ASSET.btb.color}` }}>
      <div style={{ color: ASSET.btb.color, fontSize: 11, fontFamily: mono, letterSpacing: 0.4 }}>{f.via.where}</div>
      {/* A numbered timeline: the circles are joined by a line, in the order you sign. */}
      <div style={{ position: 'relative', marginTop: 10 }}>
        {f.via.steps.length > 1 && <span aria-hidden="true" style={{ position: 'absolute', left: 13, top: 16, bottom: 16, width: 1.5, background: 'rgba(240,180,60,0.35)' }}/>}
        {f.via.steps.map((s, i) => (
          <div key={i} style={{ position: 'relative', display: 'flex', gap: 12, paddingBottom: i < f.via.steps.length - 1 ? 12 : 0 }}>
            <span style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: 'rgba(var(--bg-rgb), 1)', border: `1.5px solid ${ASSET.btb.color}`, color: ASSET.btb.color, fontSize: 12.5, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
            <div style={{ minWidth: 0, paddingTop: 3 }}>
              <div style={{ color: btb.text, fontSize: 14.5, fontWeight: 800 }}>{s.action}</div>
              <div style={{ color: btb.textMuted, fontSize: 13, lineHeight: 1.5, marginTop: 2 }}>{s.text}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // On a phone: a short line down between the blocks, in the colour of what moves there.
  const down = (color: string) => (
    <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4px 0' }}>
      <span style={{ width: 2, height: 18, background: color }}/>
      <span style={{ width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: `9px solid ${color}` }}/>
    </div>
  );

  const rows: [string, string, string][] = [
    ...f.from.flatMap((c) => c.lines.map((l) => [c.where, c.action, `${l.amount ? `${l.amount} ` : ''}${l.text}`] as [string, string, string])),
    ...f.via.steps.map((s) => [f.via.where, s.action, s.text] as [string, string, string]),
    ...f.to.flatMap((c) => c.lines.map((l) => [c.where, c.action, `${l.amount ? `${l.amount} ` : ''}${l.text}`] as [string, string, string])),
  ];
  const tab = (v: 'flow' | 'table', text: string) => (
    <button type="button" onClick={() => setView(v)} style={{
      height: 30, padding: '0 14px', borderRadius: 999, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 800,
      background: view === v ? ASSET.lp.color : 'transparent', color: view === v ? '#04130D' : btb.textMuted,
    }}>{text}</button>
  );

  return (
    <div style={{ borderRadius: 20, border: '1px solid rgba(var(--fg-rgb), 0.1)', background: 'rgba(var(--fg-rgb), 0.025)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: isMobile ? '12px 14px' : '14px 20px', borderBottom: '1px solid rgba(var(--fg-rgb), 0.08)' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: btb.text, fontSize: 16, fontWeight: 800 }}>{f.title}</div>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 6 }}>
            {used.map((a) => (
              <span key={a} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: btb.textMuted, fontSize: 12 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: ASSET[a].color }}/>{ASSET[a].label}
              </span>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 2, padding: 3, borderRadius: 999, border: '1px solid rgba(var(--fg-rgb), 0.1)', background: 'rgba(var(--bg-rgb), 0.6)' }}>
          {tab('flow', 'Flow')}
          {tab('table', 'Table')}
        </div>
      </div>

      <div style={{ padding: isMobile ? 14 : 20 }}>
        {view === 'flow' ? (
          isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{f.from.map((c, i) => <Card key={i} c={c}/>)}</div>
              {down(fromColors[0] ?? ASSET.token.color)}
              {via}
              {down(toColors[0] ?? ASSET.token.color)}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{f.to.map((c, i) => <Card key={i} c={c}/>)}</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 48px minmax(0, 1.1fr) 48px minmax(0, 1fr)', alignItems: 'stretch' }}>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 12 }}>{f.from.map((c, i) => <Card key={i} c={c}/>)}</div>
              <Fan colors={fromColors} toward="in"/>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>{via}</div>
              <Fan colors={toColors} toward="out"/>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 12 }}>{f.to.map((c, i) => <Card key={i} c={c}/>)}</div>
            </div>
          )
        ) : (
          <div style={{ overflowX: 'auto', border: btb.borderSoft, borderRadius: 12 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
              <thead><tr>{['#', 'Where', 'Step', 'Detail'].map((h) => <th key={h} style={{ textAlign: 'left', padding: '10px 12px', color: btb.textDim, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .4, borderBottom: btb.borderSoft }}>{h}</th>)}</tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td style={{ padding: '10px 12px', color: btb.textDim, fontWeight: 700, borderBottom: i < rows.length - 1 ? '1px solid rgba(var(--fg-rgb), 0.05)' : undefined }}>{i + 1}</td>
                    {r.map((c, j) => <td key={j} style={{ padding: '10px 12px', verticalAlign: 'top', color: j === 1 ? btb.text : btb.textMuted, fontWeight: j === 1 ? 700 : 500, lineHeight: 1.5, borderBottom: i < rows.length - 1 ? '1px solid rgba(var(--fg-rgb), 0.05)' : undefined }}>{c}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {f.impact && (
          <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 14, background: 'rgba(var(--bg-rgb), 0.6)', border: '1px solid rgba(var(--fg-rgb), 0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <span style={{ color: btb.text, fontSize: 14, fontWeight: 800 }}>{f.impact.title}</span>
              <span style={{ color: btb.textDim, fontSize: 11, fontFamily: mono }}>before / after</span>
            </div>
            {f.impact.rows.map(([name, before, after]) => (
              <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderTop: '1px solid rgba(var(--fg-rgb), 0.05)', fontSize: 13.5 }}>
                <span style={{ flex: 1, color: btb.textMuted }}>{name}</span>
                <span style={{ color: btb.textDim, fontVariantNumeric: 'tabular-nums' }}>{before}</span>
                <span style={{ color: btb.textDim }}>to</span>
                <span style={{ color: btb.text, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{after}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      {f.note && <div style={{ padding: isMobile ? '0 14px 14px' : '0 20px 16px', color: btb.textDim, fontSize: 12, lineHeight: 1.5 }}>{f.note}</div>}
    </div>
  );
}
