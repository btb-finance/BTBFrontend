import type { Metadata } from 'next';
import Link from 'next/link';
import { buildMetadata } from '@/lib/seo/metadata';
import { COMPETITORS } from '@/lib/seo/competitors';
import { VsShell, styles } from './shell';

export const metadata: Metadata = buildMetadata({
  title: 'Free alternative to paid LP tools: Metrix, Drippy, Revert',
  description: 'Metrix Finance, Drippy Finance and Revert charge subscriptions or a cut of your position for LP analytics. BTB Finance gives you the simulator, pool discovery and full position management free, and shares its revenue with users every Friday.',
  path: '/vs',
  keywords: ['LP tools comparison', 'free LP simulator', 'Metrix Finance alternative', 'Drippy Finance alternative', 'Revert Finance alternative'],
});

export default function VsIndex() {
  return (
    <VsShell>
      <p style={styles.eyebrow}>Compare</p>
      <h1 style={styles.h1}>Every LP tool that charges you, next to the one that pays you.</h1>
      <p style={styles.lead}>
        The going rate for an LP simulator and position tracker is $500 to $800 a year, or a percentage of your position on every rebalance. BTB Finance ships the same tools free, adds one-tap management on eight DEXes, and pays out its revenue to users every Friday.
      </p>
      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead><tr><th style={styles.th}>Tool</th><th style={styles.th}>What it costs</th><th style={styles.th}></th></tr></thead>
          <tbody>
            {COMPETITORS.map((c) => (
              <tr key={c.slug}>
                <td style={styles.td}>{c.name}</td>
                <td style={styles.tdMuted}>{c.pricing.filter((p) => p.price !== '$0').map((p) => `${p.plan}: ${p.price}`).join('; ')}</td>
                <td style={styles.td}><Link href={`/vs/${c.slug}`} style={{ color: '#FFA24A', fontWeight: 700, textDecoration: 'none' }}>Compare</Link></td>
              </tr>
            ))}
            <tr><td style={styles.tdStrong}>BTB Finance</td><td style={styles.tdStrong}>$0, plus a revenue share every Friday</td><td style={styles.td}><Link href="/simulate" style={{ color: '#FFA24A', fontWeight: 700, textDecoration: 'none' }}>Open</Link></td></tr>
          </tbody>
        </table>
      </div>
      <div style={{ ...styles.ctaRow, marginTop: 28 }}>
        <Link href="/simulate" style={styles.ctaPrimary}>Open the free simulator</Link>
        <Link href="/discover" style={styles.ctaGhost}>Browse pools</Link>
      </div>
    </VsShell>
  );
}
