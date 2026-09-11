import { SITE } from './config';

/**
 * JSON-LD structured data: makes a search for an LP simulator or concentrated
 * liquidity manager surface BTB as the headline result and unlocks rich
 * results (organization knowledge panel, app listing, FAQ accordions).
 *
 * Returns an array of schema.org graphs; rendered by <JsonLd/>.
 */

const LOGO = `${SITE.url}/apple-icon.png`;   // square branded logo (static)
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
      'Free LP simulator: fees, impermanent loss, range coverage, historical replay',
      'Discover the best pools by APR, TVL and volume across chains',
      'Add, withdraw, collect and rebalance concentrated liquidity on Uniswap V3 and V4, PancakeSwap V3 and Aerodrome',
      'Cross-chain LP research for one pair across every supported chain',
      'Weekly BTB revenue share for swaps, positions, simulations and daily check-ins',
      'Best-price swaps on every major chain',
      'Self-custody: MetaMask, Coinbase, WalletConnect, Safe',
    ],
    publisher: { '@id': `${SITE.url}/#organization` },
  };

  // The headline product: the LP simulator.
  const simulator = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    '@id': `${SITE.url}/#simulator`,
    name: 'BTB LP Simulator',
    image: OG,
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Web',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    description:
      'Free concentrated liquidity simulator. Pick any pool on Uniswap V3 or V4, ' +
      'PancakeSwap or Aerodrome, set a range and deposit, and see projected fees, ' +
      'impermanent loss, probability of staying in range, LP versus holding and a ' +
      'historical replay before you deposit. Deploy the position from the same screen.',
    url: `${SITE.url}/simulate`,
  };

  const faq = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${SITE.url}/#faq`,
    mainEntity: [
      {
        '@type': 'Question',
        name: 'What is BTB Finance?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'BTB Finance is an app for liquidity providers. Simulate a position before you deposit, find the best pools across chains, then add, rebalance and manage concentrated liquidity on Uniswap V3 and V4, PancakeSwap V3 and Aerodrome from one place. Using it earns points, and BTB shares its revenue with users every Friday.',
        },
      },
      {
        '@type': 'Question',
        name: 'Is the LP simulator free?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes, and no wallet is needed. Pick a pool, set a range and a deposit, and see projected fees, impermanent loss for your exact range, probability of staying in range, LP versus holding, and a historical replay. Simulating with a connected wallet also earns points toward the weekly BTB split.',
        },
      },
      {
        '@type': 'Question',
        name: 'Which DEXes and chains can I manage LP positions on?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Uniswap V3 and V4 and PancakeSwap V3 on Ethereum, Uniswap V3 and V4 on Robinhood Chain, and Aerodrome Slipstream on Base, including gauge staking. Positions on other chains show read-only analytics. Swaps route through every major chain.',
        },
      },
      {
        '@type': 'Question',
        name: 'How does the weekly BTB revenue share work?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Swaps, LP positions, simulations and a daily check-in earn points during the week. Enter the split before Friday, and the week\'s revenue is shared out in BTB in proportion to points. Claim lands in your wallet with no gas and no signature.',
        },
      },
      {
        '@type': 'Question',
        name: 'Can I rebalance an out-of-range position?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. Rebalance withdraws the position (unstaking from an Aerodrome gauge first if needed) and opens the Add liquidity sheet for the same pool, where you choose any new range, use a one-token smart fit, or split ranges, and restake.',
        },
      },
    ],
  };

  return [organization, website, webApp, simulator, faq];
}
