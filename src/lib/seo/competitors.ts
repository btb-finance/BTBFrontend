/**
 * Paid LP tools we position against. Every price and limit here is copied
 * from the vendor's own public pricing page on the date noted, so the
 * comparison pages only make claims a reader can verify. Update the row and
 * the date together when a vendor changes plans.
 */
export interface Competitor {
  slug: string;
  name: string;
  url: string;
  /** What they charge, in the vendor's own terms. */
  pricing: { plan: string; price: string; note?: string }[];
  /** Cheapest way to get the full product for a year, in USD. */
  yearlyUsd: number;
  /** One line on what the product is. */
  what: string;
  /** What the free tier holds back, from their pricing page. */
  freeLimits: string[];
  checkedOn: string;
  /** Feature rows: [feature, them, us]. */
  rows: [string, string, string][];
}

const BTB_ROWS_COMMON: [string, string][] = [
  ['LP simulator with fees, impermanent loss and range analysis', 'Free, unlimited'],
  ['Pool discovery across Ethereum, Base, BNB and Robinhood Chain', 'Free'],
  ['Add, rebalance, unstake and remove positions in the app', 'Free'],
  ['Uniswap V3 and V4, PancakeSwap, SushiSwap, Aerodrome, Giga, Ramses, UP', 'Included'],
  ['Wallets', 'Unlimited'],
  ['Revenue share', 'Every Friday, in BTB, to everyone who used the app that week'],
];

export const COMPETITORS: Competitor[] = [
  {
    slug: 'metrix-finance',
    name: 'Metrix Finance',
    url: 'https://metrix.finance',
    what: 'LP simulator and position tracker for Uniswap V3 and V4 and other concentrated liquidity DEXes.',
    pricing: [
      { plan: 'Free', price: '$0', note: 'one wallet, open positions only' },
      { plan: 'Pro', price: '$50 per month or $500 per year' },
      { plan: 'Elite', price: '$800 per year', note: 'multiple wallets, larger notional' },
    ],
    yearlyUsd: 500,
    freeLimits: ['One wallet', 'Open positions only', 'Simulation and discovery depth gated to Pro'],
    checkedOn: '2026-09-13',
    rows: [
      ['LP simulator', 'Full depth on Pro ($500 per year)', 'Free, unlimited'],
      ['Pool discovery', 'Pro', 'Free'],
      ['Manage positions from the app', 'Tracking only, you transact elsewhere', 'Add, rebalance, stake, remove in one place'],
      ['Wallets', 'One on Free, more on Elite ($800 per year)', 'Unlimited'],
      ['Revenue share', 'None', 'Every Friday'],
    ],
  },
  {
    slug: 'drippy-finance',
    name: 'Drippy Finance',
    url: 'https://drippy.finance',
    what: 'A membership bundling an LP terminal with a course, community and coaching.',
    pricing: [
      { plan: 'Monthly', price: '$79 per month plus tax', note: 'founding rate, listed at $99' },
      { plan: 'Annual', price: '$799 per year plus tax' },
    ],
    yearlyUsd: 799,
    freeLimits: ['The terminal is part of the paid membership', 'A limited free start is offered'],
    checkedOn: '2026-09-13',
    rows: [
      ['LP terminal', 'Paid membership ($799 per year)', 'Free, unlimited'],
      ['Pool discovery', 'Membership', 'Free'],
      ['Manage positions from the app', 'Analytics, you transact elsewhere', 'Add, rebalance, stake, remove in one place'],
      ['Education', 'Course and coaching bundled into the price', 'Docs and the simulator itself, free'],
      ['Revenue share', 'None', 'Every Friday'],
    ],
  },
  {
    slug: 'revert-finance',
    name: 'Revert Finance',
    url: 'https://revert.finance',
    what: 'LP analytics with paid automation (auto-range, auto-exit, auto-compound) that takes a cut of your position.',
    pricing: [
      { plan: 'Analytics', price: '$0' },
      { plan: 'Auto-Range and Auto-Exit', price: '0.15% of position value or 2% of uncollected fees per execution', note: 'plus a gas budget' },
    ],
    yearlyUsd: 0,
    freeLimits: ['Automation charges a protocol fee on every execution'],
    checkedOn: '2026-09-13',
    rows: [
      ['LP analytics', 'Free', 'Free'],
      ['Rebalance', '0.15% of the position or 2% of fees, every time', 'You sign it, no cut taken'],
      ['Simulator with fee and range analysis', 'Backtests', 'Simulator plus discovery'],
      ['Manage positions from the app', 'Yes', 'Yes, plus gauge and MasterChef staking'],
      ['Revenue share', 'None', 'Every Friday'],
    ],
  },
];

/** Other free tools a reader comparing options will meet, with the honest gap each leaves. */
export const OTHER_FREE_TOOLS: { name: string; url: string; good: string; gap: string }[] = [
  { name: 'Revert Finance', url: 'https://revert.finance', good: 'Solid position analytics and backtests for Uniswap V3 and forks.', gap: 'Automation (auto-range, auto-exit) takes 0.15% of the position or 2% of fees per run, and there is no pool discovery across DEX registries.' },
  { name: 'DefiLlama', url: 'https://defillama.com/yields', good: 'The widest free yield table in DeFi.', gap: 'APR is quoted for the whole pool, not a range, and you cannot simulate a range or add a position from it.' },
  { name: 'CoinGecko impermanent loss calculator', url: 'https://www.coingecko.com/en/impermanent-loss-calculator', good: 'Quick two-token IL check.', gap: 'No fees, no concentrated ranges, no real pool data.' },
  { name: 'Poolfish', url: 'https://poolfish.xyz', good: 'Was the free Uniswap V3 calculator most people started with.', gap: 'Acquired by Metrix Finance in August 2026; users are being moved to Metrix plans.' },
];

export function competitorBySlug(slug: string): Competitor | undefined {
  return COMPETITORS.find((c) => c.slug === slug);
}

export { BTB_ROWS_COMMON };
