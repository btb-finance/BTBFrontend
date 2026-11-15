import type { ReactNode } from 'react';
import Link from 'next/link';
import { VsShell, styles } from './vs/shell';

export const LEGAL_UPDATED = '15 November 2026';
export const CONTACT = 'hello@btb.finance';

/** Shared layout for the Terms, Risks and Privacy pages: the marketing shell plus a title and cross links. */
export function LegalPage({ eyebrow, title, lead, children }: { eyebrow: string; title: string; lead: string; children: ReactNode }) {
  return (
    <VsShell>
      <p style={styles.eyebrow}>{eyebrow}</p>
      <h1 style={styles.h1}>{title}</h1>
      <p style={styles.lead}>{lead}</p>
      <p style={styles.muted}>Last updated {LEGAL_UPDATED}</p>
      {children}
      <p style={styles.footnote}>
        <Link href="/terms" style={styles.link}>Terms of use</Link>{' · '}
        <Link href="/risk" style={styles.link}>Risks</Link>{' · '}
        <Link href="/privacy" style={styles.link}>Privacy</Link>{' · '}
        Questions: <a href={`mailto:${CONTACT}`} style={styles.link}>{CONTACT}</a>
      </p>
    </VsShell>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 style={styles.h2}>{title}</h2>
      {children}
    </section>
  );
}

export function P({ children }: { children: ReactNode }) {
  return <p style={styles.body}>{children}</p>;
}

export function List({ items }: { items: ReactNode[] }) {
  return (
    <ul style={{ ...styles.body, paddingLeft: 20 }}>
      {items.map((item, i) => <li key={i} style={{ marginBottom: 8 }}>{item}</li>)}
    </ul>
  );
}
