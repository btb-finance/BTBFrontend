'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Glass } from '../Glass';
import { Icon } from '../Icon';
import { Screen } from '../Screen';
import { btb } from '../design-tokens';
import { useSidebar } from '../../lib/SidebarContext';
import { DOCS, FAQS, LINKS, type DocBlock, type DocSection } from './docsContent';

const ALL_SECTIONS: DocSection[] = DOCS.flatMap(g => g.sections);

export function DocsScreen({ onBack }: { onBack: () => void }) {
  const { isMobile } = useSidebar();
  const [search, setSearch] = useState('');
  const [active, setActive] = useState<string>(() => (typeof window !== 'undefined' && window.location.hash.slice(1)) || ALL_SECTIONS[0].id);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  // The side navigation scrolls on its own and never hands wheel motion to
  // the page, so reading the index does not move the section beside it.
  const navRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const atTop = el.scrollTop <= 0 && e.deltaY < 0;
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1 && e.deltaY > 0;
      if (atTop || atBottom || el.scrollHeight <= el.clientHeight) e.preventDefault();
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [isMobile]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onHash = () => { const id = window.location.hash.slice(1); if (ALL_SECTIONS.some(s => s.id === id)) setActive(id); };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const q = search.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!q) return null;
    const hit = (s: DocSection) => [s.title, s.summary, ...s.blocks.flatMap(b => [b.text ?? '', ...(b.items ?? []), ...(b.rows?.flat() ?? [])])].some(t => t.toLowerCase().includes(q));
    return ALL_SECTIONS.filter(hit);
  }, [q]);
  const faqs = q ? FAQS.filter(f => f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q)) : FAQS;

  const goto = (id: string) => { setActive(id); setSearch(''); if (typeof window !== 'undefined') history.replaceState(null, '', `#${id}`); };
  const section = ALL_SECTIONS.find(s => s.id === active) ?? ALL_SECTIONS[0];
  const idx = ALL_SECTIONS.indexOf(section);

  const nav = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {DOCS.map(g => (
        <div key={g.title}>
          <div style={{ color: btb.textDim, fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .5, padding: '0 10px 6px' }}>{g.title}</div>
          {g.sections.map(s => {
            const on = s.id === active && !q;
            return (
              <div key={s.id} onClick={() => goto(s.id)} style={{ padding: '8px 10px', borderRadius: 10, cursor: 'pointer', background: on ? btb.surfaceStrong : 'transparent', color: on ? btb.text : btb.textMuted, fontSize: 13, fontWeight: on ? 700 : 500 }}>{s.title}</div>
            );
          })}
        </div>
      ))}
    </div>
  );

  return (
    <Screen gap={18} style={{ width: '100%', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div onClick={onBack} style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(var(--fg-rgb), 0.08)', border: btb.borderSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <Icon name="back" size={18}/>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: btb.text, fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>Docs</div>
          <div style={{ color: btb.textMuted, fontSize: 12.5 }}>The BTB manual: find, simulate, add, manage, earn.</div>
        </div>
      </div>

      <Glass padding={0} radius={18}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px' }}>
          <Icon name="search" size={18} color={btb.textMuted}/>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search the docs" style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: btb.text, fontSize: 14, fontFamily: 'inherit' }}/>
          {search && <div onClick={() => setSearch('')} style={{ cursor: 'pointer' }}><Icon name="close" size={14} color={btb.textMuted}/></div>}
        </div>
      </Glass>

      {matches ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {matches.length === 0 && faqs.length === 0 && <div style={{ color: btb.textMuted, fontSize: 13 }}>Nothing matches "{search}".</div>}
          {matches.map(s => (
            <Glass key={s.id} padding={16} radius={16} onClick={() => goto(s.id)}>
              <div style={{ color: btb.text, fontSize: 14.5, fontWeight: 750 }}>{s.title}</div>
              <div style={{ color: btb.textMuted, fontSize: 12.5, marginTop: 3 }}>{s.summary}</div>
            </Glass>
          ))}
          {faqs.map((f, i) => (
            <Glass key={f.q} padding={16} radius={16}>
              <div style={{ color: btb.text, fontSize: 14, fontWeight: 700 }}>{f.q}</div>
              <div style={{ color: btb.textMuted, fontSize: 13, lineHeight: 1.55, marginTop: 6 }}>{f.a}</div>
            </Glass>
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : '230px minmax(0, 1fr)', gap: 18, alignItems: 'start' }}>
          {isMobile ? (
            <select className="btb-select" value={active} onChange={e => goto(e.target.value)} style={{ width: '100%', height: 44, borderRadius: 12, border: btb.border, background: btb.surfaceSoft, color: btb.text, padding: '0 12px', fontFamily: 'inherit', fontSize: 14 }}>
              {DOCS.map(g => <optgroup key={g.title} label={g.title}>{g.sections.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</optgroup>)}
            </select>
          ) : (
            <div ref={navRef} style={{ position: 'sticky', top: 76, maxHeight: 'calc(100vh - 92px)', overflowY: 'auto', overscrollBehavior: 'contain', paddingRight: 4 }}>{nav}</div>
          )}

          <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Glass padding={isMobile ? 18 : 26} radius={22} strong>
              <div style={{ color: btb.green, fontSize: 11, fontWeight: 800, letterSpacing: .5, textTransform: 'uppercase' }}>{DOCS.find(g => g.sections.includes(section))?.title}</div>
              <h1 style={{ color: btb.text, fontSize: isMobile ? 22 : 26, fontWeight: 800, letterSpacing: -0.5, margin: '6px 0 6px' }}>{section.title}</h1>
              <div style={{ color: btb.textMuted, fontSize: 14, lineHeight: 1.5, marginBottom: 16 }}>{section.summary}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {section.blocks.map((b, i) => <Block key={i} b={b}/>)}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 24, paddingTop: 16, borderTop: btb.borderSoft }}>
                {idx > 0 ? <NavLink onClick={() => goto(ALL_SECTIONS[idx - 1].id)} label={ALL_SECTIONS[idx - 1].title} dir="prev"/> : <span/>}
                {idx < ALL_SECTIONS.length - 1 ? <NavLink onClick={() => goto(ALL_SECTIONS[idx + 1].id)} label={ALL_SECTIONS[idx + 1].title} dir="next"/> : <span/>}
              </div>
            </Glass>

            {section.id === 'fees-security' && (
              <>
                <div style={{ color: btb.text, fontSize: 16, fontWeight: 800, marginTop: 6 }}>Questions</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {FAQS.map((f, i) => (
                    <Glass key={f.q} padding={0} radius={16}>
                      <div onClick={() => setOpenFaq(openFaq === i ? null : i)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '14px 16px', cursor: 'pointer' }}>
                        <div style={{ color: btb.text, fontSize: 14, fontWeight: 700 }}>{f.q}</div>
                        <span style={{ display: 'inline-flex', transform: openFaq === i ? 'rotate(90deg)' : 'rotate(-90deg)', transition: 'transform 120ms ease' }}><Icon name="chevrons" size={14} color={btb.textMuted}/></span>
                      </div>
                      {openFaq === i && <div style={{ color: btb.textMuted, fontSize: 13, lineHeight: 1.55, padding: '0 16px 14px' }}>{f.a}</div>}
                    </Glass>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 8 }}>
                  {LINKS.map(l => (
                    <a key={l.href} href={l.href} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                      <Glass padding={14} radius={16}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <Icon name={l.icon} size={18} color={btb.textMuted}/>
                          <div><div style={{ color: btb.text, fontSize: 13.5, fontWeight: 700 }}>{l.label}</div><div style={{ color: btb.textMuted, fontSize: 12 }}>{l.sub}</div></div>
                        </div>
                      </Glass>
                    </a>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </Screen>
  );
}

function NavLink({ onClick, label, dir }: { onClick: () => void; label: string; dir: 'prev' | 'next' }) {
  return (
    <div onClick={onClick} style={{ cursor: 'pointer', color: btb.textMuted, fontSize: 12.5, display: 'flex', flexDirection: 'column', alignItems: dir === 'next' ? 'flex-end' : 'flex-start', gap: 2 }}>
      <span style={{ color: btb.textDim, fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .4 }}>{dir === 'prev' ? 'Previous' : 'Next'}</span>
      <span style={{ color: btb.text, fontWeight: 700 }}>{label}</span>
    </div>
  );
}

function Block({ b }: { b: DocBlock }) {
  const p: React.CSSProperties = { color: btb.textMuted, fontSize: 14, lineHeight: 1.6, margin: 0 };
  if (b.type === 'p') return <p style={p}>{b.text}</p>;
  if (b.type === 'note') return <div style={{ ...p, background: 'rgba(var(--green-rgb), 0.07)', border: '1px solid rgba(var(--green-rgb), 0.25)', borderRadius: 12, padding: '10px 14px', color: btb.text, fontSize: 13.5 }}>{b.text}</div>;
  if (b.type === 'list') return <ul style={{ ...p, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>{b.items!.map((t, i) => <li key={i}>{t}</li>)}</ul>;
  if (b.type === 'steps') return (
    <ol style={{ ...p, listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {b.items!.map((t, i) => (
        <li key={i} style={{ display: 'flex', gap: 12 }}>
          <span style={{ width: 24, height: 24, borderRadius: 8, flexShrink: 0, background: 'rgba(var(--green-rgb), 0.16)', color: btb.green, fontSize: 12, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
          <span style={{ paddingTop: 2 }}>{t}</span>
        </li>
      ))}
    </ol>
  );
  return (
    <div style={{ overflowX: 'auto', border: btb.borderSoft, borderRadius: 12 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
        {b.head && <thead><tr>{b.head.map(h => <th key={h} style={{ textAlign: 'left', padding: '10px 12px', color: btb.textDim, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .4, borderBottom: btb.borderSoft }}>{h}</th>)}</tr></thead>}
        <tbody>
          {b.rows!.map((r, i) => (
            <tr key={i}>{r.map((c, j) => <td key={j} style={{ padding: '10px 12px', verticalAlign: 'top', color: j === 0 ? btb.text : btb.textMuted, fontWeight: j === 0 ? 700 : 500, borderBottom: i < b.rows!.length - 1 ? '1px solid rgba(var(--fg-rgb), 0.05)' : undefined, lineHeight: 1.5 }}>{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
