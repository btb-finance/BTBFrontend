import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import { styles as vs } from '../vs/shell';

/**
 * Server-rendered shell for the agent pages (/agents/*): the same dark marketing look as /vs, with its own section
 * nav. Real HTML for crawlers and developers, no app bundle.
 */
const SECTIONS = [
  { href: '/agents', label: 'Overview' },
  { href: '/agents/protocols', label: 'Protocols' },
  { href: '/agents/playground', label: 'Playground' },
  { href: '/agents/docs', label: 'Docs' },
];

export function AgentsShell({ active, children, wide = false }: { active: string; children: ReactNode; wide?: boolean }) {
  return (
    <div style={{ minHeight: '100vh', background: '#0A0A0F', color: '#F2F2F5', fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif' }}>
      <header style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between', padding: '16px clamp(16px, 4vw, 40px)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <Link href="/agents" style={{ display: 'flex', alignItems: 'center', gap: 9, color: '#F2F2F5', textDecoration: 'none', fontWeight: 800, fontSize: 17 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/btblogo.jpg" alt="" width={28} height={28} style={{ borderRadius: 999 }} />
          BTB Finance <span style={{ color: '#52E3A4', fontWeight: 700 }}>for agents</span>
        </Link>
        <nav aria-label="Agents" style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 13.5, alignItems: 'center' }}>
          {SECTIONS.map((s) => (
            <Link key={s.href} href={s.href} aria-current={active === s.href ? 'page' : undefined}
              style={{ ...vs.navLink, color: active === s.href ? '#F2F2F5' : vs.navLink.color, fontWeight: active === s.href ? 700 : 400 }}>
              {s.label}
            </Link>
          ))}
          <Link href="/" style={{ ...vs.navLink, padding: '6px 12px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.14)' }}>Open the app</Link>
        </nav>
      </header>
      <main style={{ maxWidth: wide ? 1100 : 900, margin: '0 auto', padding: '40px clamp(16px, 4vw, 40px) 80px' }}>
        {children}
      </main>
      <footer style={{ ...vs.footnote, textAlign: 'center', padding: '0 16px 40px' }}>
        BTB never signs or sends for you: it builds unsigned transactions that your own wallet or agent signs. Not financial advice.{' '}
        <Link href="/risk" style={vs.link}>Risks</Link> · <Link href="/terms" style={vs.link}>Terms</Link>
      </footer>
    </div>
  );
}

export const styles: Record<string, CSSProperties> = {
  ...vs,
  code: { display: 'block', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 12, padding: '14px 16px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13, lineHeight: 1.55, color: '#E6E6EA', margin: '0 0 14px' },
  inlineCode: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.92em', background: 'rgba(255,255,255,0.07)', borderRadius: 6, padding: '1px 6px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12, margin: '0 0 12px' },
  card: { border: '1px solid rgba(255,255,255,0.09)', borderRadius: 16, background: 'rgba(255,255,255,0.03)', padding: '16px 18px' },
  pill: { display: 'inline-block', fontSize: 11.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: 'rgba(82,227,164,0.12)', color: '#52E3A4', marginRight: 6 },
  pillMuted: { display: 'inline-block', fontSize: 11.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: 'rgba(255,255,255,0.07)', color: 'rgba(242,242,245,0.7)', marginRight: 6 },
  mono: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12.5, overflowWrap: 'anywhere' },
};
