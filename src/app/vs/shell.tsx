import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';

/**
 * Server-rendered marketing shell for the comparison pages: real HTML for
 * crawlers, no app bundle, dark theme matched to the app.
 */
export function VsShell({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: '#0A0A0F', color: '#F2F2F5', fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px clamp(16px, 4vw, 40px)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 9, color: '#F2F2F5', textDecoration: 'none', fontWeight: 800, fontSize: 17 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/btblogo.jpg" alt="" width={28} height={28} style={{ borderRadius: 999 }} />
          BTB Finance
        </Link>
        <nav style={{ display: 'flex', gap: 18, fontSize: 13.5 }}>
          <Link href="/simulate" style={styles.navLink}>Simulate</Link>
          <Link href="/discover" style={styles.navLink}>Discover</Link>
          <Link href="/portfolio" style={styles.navLink}>Portfolio</Link>
        </nav>
      </header>
      <main style={{ maxWidth: 860, margin: '0 auto', padding: '40px clamp(16px, 4vw, 40px) 80px' }}>
        {children}
      </main>
    </div>
  );
}

export const styles: Record<string, CSSProperties> = {
  navLink: { color: 'rgba(242,242,245,0.7)', textDecoration: 'none' },
  eyebrow: { color: '#52E3A4', fontSize: 12, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', margin: '0 0 10px' },
  h1: { fontSize: 'clamp(28px, 4.5vw, 44px)', lineHeight: 1.1, letterSpacing: -0.8, fontWeight: 800, margin: '0 0 18px' },
  h2: { fontSize: 22, fontWeight: 800, letterSpacing: -0.3, margin: '40px 0 10px' },
  h3: { fontSize: 15.5, fontWeight: 700, margin: '0 0 6px' },
  lead: { fontSize: 17, lineHeight: 1.55, color: 'rgba(242,242,245,0.8)', margin: '0 0 22px' },
  body: { fontSize: 15, lineHeight: 1.6, color: 'rgba(242,242,245,0.8)', margin: '0 0 12px' },
  muted: { fontSize: 13, color: 'rgba(242,242,245,0.5)', margin: '0 0 10px' },
  footnote: { fontSize: 12, lineHeight: 1.5, color: 'rgba(242,242,245,0.45)', marginTop: 28 },
  link: { color: 'rgba(242,242,245,0.7)' },
  ctaRow: { display: 'flex', flexWrap: 'wrap', gap: 10, margin: '8px 0 10px' },
  ctaPrimary: { display: 'inline-flex', alignItems: 'center', height: 44, padding: '0 20px', borderRadius: 12, background: 'linear-gradient(135deg,#52E3A4,#1aad77)', color: '#fff', fontWeight: 700, fontSize: 14, textDecoration: 'none' },
  ctaGhost: { display: 'inline-flex', alignItems: 'center', height: 44, padding: '0 20px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.05)', color: '#F2F2F5', fontWeight: 700, fontSize: 14, textDecoration: 'none' },
  tableWrap: { overflowX: 'auto', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 16, background: 'rgba(255,255,255,0.03)' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
  th: { textAlign: 'left', padding: '12px 14px', color: 'rgba(242,242,245,0.55)', fontSize: 12, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.09)' },
  td: { padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', verticalAlign: 'top' },
  tdMuted: { padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', color: 'rgba(242,242,245,0.6)', verticalAlign: 'top' },
  tdStrong: { padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', color: '#52E3A4', fontWeight: 700, verticalAlign: 'top' },
};
