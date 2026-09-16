import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { buildMetadata } from '@/lib/seo/metadata';
import { SITE } from '@/lib/seo/config';
import { COMPETITORS, OTHER_FREE_TOOLS, competitorBySlug } from '@/lib/seo/competitors';
import { VsShell, styles } from '../shell';

export function generateStaticParams() {
  return COMPETITORS.map((c) => ({ slug: c.slug }));
}
export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const c = competitorBySlug(slug);
  if (!c) return {};
  const title = `${c.name} alternative: free LP simulator that pays you`;
  const description = `${c.name} charges ${c.pricing.find((p) => p.price !== '$0')?.price ?? 'for its tools'}. BTB Finance gives you the LP simulator, pool discovery and full position management free, and shares its revenue with users every Friday.`;
  return buildMetadata({
    title, description, path: `/${c.slug}-alternative`,
    keywords: [`${c.name} alternative`, `${c.name} pricing`, `${c.name} free`, `${c.name} vs BTB Finance`, `free ${c.name}`],
  });
}

export default async function VsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = competitorBySlug(slug);
  if (!c) notFound();
  const paid = c.pricing.filter((p) => p.price !== '$0');
  const faq = [
    { q: `Is BTB Finance a free alternative to ${c.name}?`, a: `Yes. The LP simulator, pool discovery and position management (add, rebalance, stake, remove) are free with no plan, no wallet limit and no feature gate. BTB earns on swaps routed through the app and pays that revenue back to users every Friday.` },
    { q: `How much does ${c.name} cost?`, a: `${c.name} lists ${paid.map((p) => `${p.plan} at ${p.price}`).join(' and ')} (checked ${c.checkedOn}).` },
    { q: `Which DEXes does BTB Finance support for LP management?`, a: `Uniswap V3 and V4, PancakeSwap V3, SushiSwap V3, Aerodrome Slipstream, Giga, Ramses and UP, across Ethereum, Base, BNB Chain and Robinhood Chain, including gauge and MasterChef staking where the DEX offers it.` },
    { q: `What is the best free alternative to ${c.name}?`, a: `For simulating a concentrated range and then opening it, BTB Finance: it is free, covers Uniswap V3 and V4, PancakeSwap, SushiSwap, Aerodrome and the Robinhood Chain DEXes, and adds the position from the same screen. Revert Finance is a good free choice for analytics on existing Uniswap V3 positions; DefiLlama is the widest free yield table but does not simulate ranges.` },
    { q: `How does the revenue share work?`, a: `Every simulation, check-in, swap and position earns points during the week. On Friday the week's revenue is split across everyone's points and paid out in BTB. There is nothing to buy and nothing to stake.` },
  ];
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'FAQPage', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
      { '@type': 'SoftwareApplication', name: 'BTB Finance', applicationCategory: 'FinanceApplication', operatingSystem: 'Web', url: SITE.url,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD', description: 'LP simulator, pool discovery and position management, free' } },
      { '@type': 'WebPage', name: `${c.name} alternative: free LP simulator that pays you`, url: `${SITE.url}/${c.slug}-alternative`, dateModified: c.checkedOn, isPartOf: { '@type': 'WebSite', name: SITE.name, url: SITE.url } },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'BTB Finance', item: SITE.url },
        { '@type': 'ListItem', position: 2, name: 'Compare', item: `${SITE.url}/vs` },
        { '@type': 'ListItem', position: 3, name: `${c.name} alternative`, item: `${SITE.url}/${c.slug}-alternative` },
      ] },
    ],
  };

  return (
    <VsShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <p style={styles.eyebrow}>{c.name} alternative</p>
      <h1 style={styles.h1}>Why pay {c.name} {c.yearlyUsd > 0 ? `$${c.yearlyUsd} a year` : 'a cut of your position'} for LP tools? BTB is free and pays you.</h1>
      <p style={styles.lead}>
        {c.name} is {c.what.charAt(0).toLowerCase() + c.what.slice(1)} BTB Finance does the same job, adds one-tap position management on every supported DEX, charges nothing for any of it, and pays its revenue back to the people who use it every Friday.
      </p>
      <div style={styles.ctaRow}>
        <Link href="/simulate" style={styles.ctaPrimary}>Open the free simulator</Link>
        <Link href="/discover" style={styles.ctaGhost}>Browse pools</Link>
      </div>

      <h2 style={styles.h2}>What {c.name} charges</h2>
      <p style={styles.muted}>From {c.name}&apos;s pricing page, checked {c.checkedOn}.</p>
      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead><tr><th style={styles.th}>Plan</th><th style={styles.th}>Price</th><th style={styles.th}>Notes</th></tr></thead>
          <tbody>
            {c.pricing.map((p) => (
              <tr key={p.plan}><td style={styles.td}>{p.plan}</td><td style={styles.td}>{p.price}</td><td style={styles.tdMuted}>{p.note ?? ''}</td></tr>
            ))}
            <tr><td style={styles.tdStrong}>BTB Finance</td><td style={styles.tdStrong}>$0, forever</td><td style={styles.tdMuted}>and a share of revenue every Friday</td></tr>
          </tbody>
        </table>
      </div>

      <h2 style={styles.h2}>Side by side</h2>
      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead><tr><th style={styles.th}></th><th style={styles.th}>{c.name}</th><th style={styles.th}>BTB Finance</th></tr></thead>
          <tbody>
            {c.rows.map(([f, them, us]) => (
              <tr key={f}><td style={styles.td}>{f}</td><td style={styles.tdMuted}>{them}</td><td style={styles.tdStrong}>{us}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      {c.yearlyUsd > 0 && (
        <>
          <h2 style={styles.h2}>What the subscription costs you as an LP</h2>
          <p style={styles.body}>
            ${c.yearlyUsd} a year is the entire fee income of a $10,000 position earning 5% APR. On {c.name} that income goes to the subscription. On BTB you keep it, and the app sends you a slice of its own revenue on top.
          </p>
        </>
      )}

      <h2 style={styles.h2}>Other free alternatives to {c.name}, and what each leaves out</h2>
      <p style={styles.body}>You will meet these in the same search. They are good tools; here is where each stops, so you can pick the right one.</p>
      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead><tr><th style={styles.th}>Tool</th><th style={styles.th}>Good for</th><th style={styles.th}>Where it stops</th></tr></thead>
          <tbody>
            {OTHER_FREE_TOOLS.filter((t) => t.name !== c.name).map((t) => (
              <tr key={t.name}><td style={styles.td}><a href={t.url} rel="nofollow noopener" target="_blank" style={{ ...styles.link, fontWeight: 700 }}>{t.name}</a></td><td style={styles.tdMuted}>{t.good}</td><td style={styles.tdMuted}>{t.gap}</td></tr>
            ))}
            <tr><td style={styles.tdStrong}>BTB Finance</td><td style={styles.tdMuted}>Simulate any range on any supported DEX, then add and manage the position in place.</td><td style={styles.tdMuted}>LP management covers Ethereum, Base, BNB and Robinhood Chain; other chains are simulate only.</td></tr>
          </tbody>
        </table>
      </div>

      <h2 style={styles.h2}>How BTB makes money without charging you</h2>
      <p style={styles.body}>
        Swaps routed through BTB carry a 1% fee, shown before you confirm. That is the revenue. Every week it is split across everyone who checked in, simulated, swapped or held a position through the app, in proportion to the points they earned, and paid out in BTB on Friday. Simulating, discovering pools and managing positions never cost anything.
      </p>

      <h2 style={styles.h2}>Questions</h2>
      {faq.map((f) => (
        <div key={f.q} style={{ marginBottom: 18 }}>
          <h3 style={styles.h3}>{f.q}</h3>
          <p style={styles.body}>{f.a}</p>
        </div>
      ))}

      <div style={styles.ctaRow}>
        <Link href="/simulate" style={styles.ctaPrimary}>Simulate a position, free</Link>
        <Link href="/vs" style={styles.ctaGhost}>Compare other tools</Link>
      </div>
      <p style={styles.footnote}>
        Prices are quoted from {c.name}&apos;s public pricing at <a href={c.url} rel="nofollow noopener" target="_blank" style={styles.link}>{c.url.replace('https://', '')}</a> on {c.checkedOn}. {c.name} is a trademark of its owner and is not affiliated with BTB Finance.
      </p>
    </VsShell>
  );
}
