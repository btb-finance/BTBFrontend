import { SITE } from './config';

/**
 * JSON-LD structured data — what makes a search for "nft" surface the BTB Bears
 * as the headline result ("the first NFTs that pay you forever") and unlocks
 * rich results (organization knowledge panel, app listing, FAQ accordions).
 *
 * Returns an array of schema.org graphs; rendered by <JsonLd/>.
 */

const LOGO = `${SITE.url}/apple-icon`;       // square branded icon route
const OG = `${SITE.url}/opengraph-image`;    // 1200×630 social image route

export function structuredData(): Record<string, unknown>[] {
  const organization = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE.url}/#organization`,
    name: SITE.name,
    url: SITE.url,
    logo: LOGO,
    description: SITE.description,
    sameAs: [SITE.socials.twitter, SITE.socials.discord, SITE.socials.github],
  };

  const website = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE.url}/#website`,
    name: SITE.name,
    url: SITE.url,
    description: SITE.description,
    inLanguage: 'en',
    publisher: { '@id': `${SITE.url}/#organization` },
  };

  const webApp = {
    '@context': 'https://schema.org',
    '@type': ['WebApplication', 'FinanceApplication'],
    '@id': `${SITE.url}/#app`,
    name: SITE.name,
    url: SITE.url,
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Web, iOS, Android',
    description: SITE.description,
    image: OG,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    featureList: [
      'Mint BTB Bear NFTs',
      'Stake NFTs to earn BTBB rewards forever',
      'Best-price token swaps',
      'Track your portfolio',
      'Self-custody wallet — connect MetaMask, Coinbase, WalletConnect',
    ],
    publisher: { '@id': `${SITE.url}/#organization` },
  };

  // The headline product — a search for "nft that pays you" should land here.
  const bearsNft = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${SITE.url}/#btb-bears`,
    name: 'BTB Bear NFT',
    image: OG,
    brand: { '@type': 'Brand', name: SITE.name },
    category: 'NFT',
    description:
      'BTB Bears are the first NFTs that pay you forever. Mint a Bear, stake it, ' +
      'and earn BTBB rewards from a 1% tax on every BTBB transfer — passive, ' +
      'on-chain income that never stops.',
    url: `${SITE.url}/#nft`,
  };

  const faq = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${SITE.url}/#faq`,
    mainEntity: [
      {
        '@type': 'Question',
        name: 'What are BTB Bears?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'BTB Bears are the first NFTs that pay you forever. They are Ethereum NFTs you mint on BTB Finance, then stake to earn ongoing BTBB rewards.',
        },
      },
      {
        '@type': 'Question',
        name: 'How do NFTs that pay you forever work?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Every BTBB transfer carries a 1% tax that is distributed to staked BTB Bears. As long as your Bear is staked, it keeps earning a share of that flow — passive income that never expires.',
        },
      },
      {
        '@type': 'Question',
        name: 'How do I earn from staking a BTB Bear?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Mint a BTB Bear, open the Stake & Earn tab, approve and stake it, then claim your accrued BTBB rewards anytime. Rewards accrue continuously while staked.',
        },
      },
      {
        '@type': 'Question',
        name: 'Can I swap tokens on BTB Finance?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. BTB Finance routes swaps for best execution on Ethereum mainnet, so you get competitive pricing directly from the same wallet you use to mint and stake.',
        },
      },
    ],
  };

  return [organization, website, webApp, bearsNft, faq];
}
