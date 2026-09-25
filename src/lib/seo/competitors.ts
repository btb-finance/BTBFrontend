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
  /**
   * LP automation products (they manage the position for you and take a cut). The page then compares automation
   * with BTB's flat-fee auto-rebalance instead of calling BTB free.
   */
  automation?: {
    /** What they take, for the headline, e.g. "15% of your LP earnings". */
    cut: string;
    /** Their cost for the worked example (see AUTOMATION_EXAMPLE), in USD a year, and how it adds up. */
    exampleUsd: number;
    exampleMath: string;
  };
}

/**
 * The worked example every automation page uses, so the numbers compare like for like: a $10,000 position on
 * Base in a 0.05% pool, earning 30% a year in fees ($3,000), rebalanced 100 times and compounded weekly.
 */
export const AUTOMATION_EXAMPLE = {
  position: 10_000,
  feesPerYear: 3_000,
  rebalances: 100,
  compounds: 52,
  /** BTB: $0.10 per rebalance or compound on Base, plus hourly checks at 1 BTB ($0.00003) each. */
  btbUsd: 100 * 0.1 + 52 * 0.1 + 8_760 * 0.00003,
  btbMath: '100 rebalances and 52 compounds at $0.10 each, plus hourly checks at 1 BTB each (about $0.26 a year); rebalances swap nothing',
  /** A swapping rebalance of an out-of-range position trades about half of it; the pool's own 0.05% fee on that. */
  swapFeePerRebalance: 0.0005 * 5_000,
};

const SWAP_ROW_SWAPS: [string, string, string] = ['Swaps when rebalancing', 'Yes, about half the position each time through an aggregator: pool fee, slippage and price impact on top', 'No swap: the range is re-placed one-sided next to the price, so no swap fee, slippage or MEV'];
const SWAP_ROW_SWAPLESS: [string, string, string] = ['Swaps when rebalancing', 'No, swapless rebalancing', 'No swap either'];

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
  {
    slug: 'vfat',
    name: 'vfat',
    url: 'https://vfat.io',
    what: 'A multi-chain yield app whose Sickle smart wallet automates concentrated liquidity: rebalance, harvest, compound and exit.',
    pricing: [
      { plan: 'Rebalance (manual or automatic)', price: '0.01% to 0.05% of the position, every time', note: '0.01% in pools up to 0.05% fee, 0.03% up to 0.3%, 0.05% above' },
      { plan: 'Auto-compound', price: '1.8% of rewards', note: 'manual compound 0.9%' },
      { plan: 'Auto-harvest', price: '1.2% of rewards', note: 'manual harvest 0.9%' },
      { plan: 'Deposit or withdraw with a swap', price: '0.09%', note: 'without a swap: 0%' },
    ],
    yearlyUsd: 0,
    freeLimits: ['Every rebalance takes a percentage of the whole position', 'Compounding takes a percentage of rewards'],
    checkedOn: '2026-09-25',
    rows: [
      ['Auto-rebalance', '0.01% to 0.05% of the position per rebalance', '$0.10 on Base, $0.50 on Robinhood Chain, flat'],
      ['Auto-compound', '1.8% of rewards', 'Same flat fee as a rebalance'],
      SWAP_ROW_SWAPS,
      ['Custody', 'Your own Sickle smart wallet', 'Your own auto wallet, only you can withdraw'],
      ['Stays staked through rebalances', 'Yes', 'Yes (Aerodrome, UP, Giga)'],
      ['LP simulator and pool discovery', 'Not the focus', 'Free'],
      ['Revenue share', 'None', 'Every Friday'],
    ],
    automation: {
      cut: 'a percentage of your position on every rebalance',
      exampleUsd: 100 * 1 + 0.018 * 3_000 + 100 * 2.5,
      exampleMath: '100 rebalances at 0.01% of $10,000 ($1 each), 1.8% of $3,000 in compounded fees, and the 0.05% pool fee on about $5,000 swapped each rebalance ($2.50 each); slippage and price impact extra',
    },
  },
  {
    slug: 'krystal',
    name: 'Krystal',
    url: 'https://krystal.app',
    what: 'An LP management app with automation tools and managed vaults across many EVM chains and Solana.',
    pricing: [
      { plan: 'Auto-rebalance', price: '0.01% to 0.05% of the position, every time', note: 'by pool fee tier, like auto-exit' },
      { plan: 'Manual rebalance', price: '0.05% to 0.25% of the position', note: 'by pool fee tier' },
      { plan: 'Auto-compound', price: '2% of LP fees', note: 'auto-harvest also 2%' },
      { plan: 'Vaults', price: '10% of rewards', note: 'no extra automation fee inside a vault' },
      { plan: 'Zap', price: '0.05% to 0.25% of the amount', note: 'swaps 0.1%' },
    ],
    yearlyUsd: 0,
    freeLimits: ['Every rebalance takes a percentage of the whole position', 'Compounding takes 2% of fees; vaults take 10%'],
    checkedOn: '2026-09-25',
    rows: [
      ['Auto-rebalance', '0.01% to 0.05% of the position per rebalance', '$0.10 on Base, $0.50 on Robinhood Chain, flat'],
      ['Auto-compound', '2% of LP fees', 'Same flat fee as a rebalance'],
      SWAP_ROW_SWAPS,
      ['Managed vaults', '10% of rewards', 'No vault: your own wallet, no cut'],
      ['Robinhood Chain (UP, Giga, Uniswap V3)', 'Not listed', 'Yes'],
      ['LP simulator and pool discovery', 'Analytics', 'Free simulator and discovery'],
      ['Revenue share', 'None', 'Every Friday'],
    ],
    automation: {
      cut: 'a percentage of your position on every rebalance and 2% of your fees',
      exampleUsd: 100 * 1 + 0.02 * 3_000 + 100 * 2.5,
      exampleMath: '100 auto-rebalances at 0.01% of $10,000 ($1 each), 2% of $3,000 in compounded fees, and the 0.05% pool fee on about $5,000 swapped each rebalance ($2.50 each); slippage and price impact extra',
    },
  },
  {
    slug: 'snuggle',
    name: 'Snuggle',
    url: 'https://www.snuggle.fi',
    what: 'An automated concentrated liquidity vault on Base and Arbitrum that rebalances without swapping.',
    pricing: [
      { plan: 'Performance fee', price: '15% of earnings', note: 'taken from trading fees and staking rewards' },
      { plan: 'Deposit, withdraw, rebalance, compound', price: '$0' },
    ],
    yearlyUsd: 0,
    freeLimits: ['15% of everything the position earns, for as long as it earns', 'Funds sit in their vault contract'],
    checkedOn: '2026-09-25',
    rows: [
      ['What you pay', '15% of all fees and rewards earned', 'A flat fee per rebalance, no share of earnings'],
      SWAP_ROW_SWAPLESS,
      ['Custody', 'Snuggle vault contract', 'Your own auto wallet, only you can withdraw'],
      ['Chains', 'Base, Arbitrum', 'Base, Robinhood Chain (auto), plus Ethereum and BNB to manage'],
      ['Choose your own range and interval', 'Vault strategy, delay setting', 'Your range, checks from every 5 minutes to daily'],
      ['LP simulator and pool discovery', 'No', 'Free'],
      ['Revenue share', 'None', 'Every Friday'],
    ],
    automation: {
      cut: '15% of your LP earnings',
      exampleUsd: 0.15 * 3_000,
      exampleMath: '15% of $3,000 in earned fees',
    },
  },
  {
    slug: 'maxfi',
    name: 'MaxFi',
    url: 'https://www.maxfi.tech',
    what: 'An automated LP vault built on Snuggle, running on Robinhood Chain, Base and Arbitrum.',
    pricing: [
      { plan: 'Performance fee', price: '15% of earnings', note: 'on LP fees and rewards' },
      { plan: 'Deposit, withdraw, rebalance, compound', price: '$0' },
    ],
    yearlyUsd: 0,
    freeLimits: ['15% of everything the position earns', 'Funds sit in their vault contract'],
    checkedOn: '2026-09-25',
    rows: [
      ['What you pay', '15% of all fees and rewards earned', 'A flat fee per rebalance, no share of earnings'],
      SWAP_ROW_SWAPLESS,
      ['Custody', 'MaxFi vault contract', 'Your own auto wallet, only you can withdraw'],
      ['Robinhood Chain', 'Uniswap stock pools against USDG', 'UP, Giga and Uniswap V3, staked where rewarded'],
      ['Choose your own range and interval', 'Vault strategy, delay setting', 'Your range, checks from every 5 minutes to daily'],
      ['LP simulator and pool discovery', 'No', 'Free'],
      ['Revenue share', 'None', 'Every Friday'],
    ],
    automation: {
      cut: '15% of your LP earnings',
      exampleUsd: 0.15 * 3_000,
      exampleMath: '15% of $3,000 in earned fees',
    },
  },
  {
    slug: 'hawkfi',
    name: 'HawkFi',
    url: 'https://hawkfi.gitbook.io/whitepaper',
    what: 'LP automation built for Solana (Meteora), formerly Hawksight, now also on Robinhood Chain.',
    pricing: [
      { plan: 'Solana', price: '8% of yield', note: 'no deposit, withdrawal or automation fee' },
      { plan: 'Robinhood Chain', price: '4% of fees', note: 'for continuous automations; no deposit, withdrawal or rebalance fee' },
    ],
    yearlyUsd: 0,
    freeLimits: ['A share of everything the position earns', 'Funds sit in a program-controlled wallet'],
    checkedOn: '2026-09-25',
    rows: [
      ['What you pay', '4% of fees on Robinhood Chain, 8% of yield on Solana', 'A flat fee per rebalance, no share of earnings'],
      ['Swaps when rebalancing', 'Not stated', 'No swap: re-placed one-sided next to the price'],
      ['Custody', 'HawkFi program wallet', 'Your own auto wallet, only you can withdraw'],
      ['EVM chains', 'Robinhood Chain', 'Base and Robinhood Chain (auto), plus Ethereum and BNB to manage'],
      ['Stays staked through rebalances', 'Not stated', 'Yes (Aerodrome, UP, Giga)'],
      ['LP simulator and pool discovery', 'Analytics', 'Free'],
      ['Revenue share', 'None', 'Every Friday'],
    ],
    automation: {
      cut: 'a share of your LP earnings',
      exampleUsd: 0.04 * 3_000,
      exampleMath: '4% of $3,000 in fees (Robinhood Chain rate; 8% on Solana would be $240)',
    },
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
