/**
 * Single source of truth for everything SEO — site identity, keywords, social
 * profiles, and the messaging used across <meta> tags, Open Graph, Twitter
 * cards, JSON-LD structured data, the sitemap, robots, and the web manifest.
 *
 * Edit copy/keywords HERE — every SEO surface reads from this file.
 */

export const SITE = {
  name: 'BTB Finance',
  shortName: 'BTB',
  url: 'https://btb.finance',
  locale: 'en_US',
  themeColor: '#0A0A0F',
  backgroundColor: '#0A0A0F',

  // Primary positioning: the LP app that pays its users. Keyword-led so a
  // search for "LP simulator", "concentrated liquidity", "Uniswap V3
  // impermanent loss calculator" or "DeFi revenue share" lands here.
  title: 'BTB Finance: Simulate, Add and Manage LP Positions. Get Paid Every Friday.',
  titleTemplate: '%s · BTB Finance',
  tagline: 'The LP app that pays you back.',
  description:
    'Simulate LP earnings before you deposit, then add, rebalance and manage ' +
    'concentrated liquidity positions on Uniswap V3 and V4, PancakeSwap and ' +
    'Aerodrome from one place. Free LP simulator with impermanent loss, fee ' +
    'and range analysis across chains. Every swap, position, simulation and ' +
    'daily check-in earns points, and BTB shares its revenue with users every Friday.',

  keywords: [
    // Brand
    'BTB Finance', 'BTB', 'BTB token',
    // LP tooling
    'LP simulator', 'liquidity pool simulator', 'Uniswap V3 simulator', 'Uniswap V4 LP',
    'concentrated liquidity', 'concentrated liquidity manager', 'LP position manager',
    'impermanent loss calculator', 'LP fee calculator', 'LP range calculator',
    'rebalance LP position', 'Aerodrome Slipstream', 'PancakeSwap V3 liquidity',
    // Discovery
    'best liquidity pools', 'highest APR pools', 'find LP pools', 'pool APR TVL',
    'cross chain LP research', 'DeFi yield Base', 'DeFi yield Ethereum',
    // Rewards
    'DeFi revenue share', 'earn crypto for providing liquidity', 'LP rewards',
    'daily check-in crypto', 'get paid to LP',
    // Versus paid tools
    'Metrix Finance alternative', 'Drippy Finance alternative', 'Revert Finance alternative', 'free LP tools',
    // Swap
    'best price token swap', 'DeFi swap', 'multichain swap',
  ],

  twitter: '@BTB_Finance',
  socials: {
    twitter: 'https://x.com/BTB_Finance',
    discord: 'https://discord.gg/bqFEPA56Tc',
    github: 'https://github.com/btb-finance',
  },

  ogImageAlt: 'BTB Finance: simulate, add and manage LP positions, get paid every Friday',
} as const;

/** App sections — every tab is a real deep-linkable path; drives the sitemap. */
export const SECTIONS = [
  { path: '/',          title: SITE.title,                                       priority: 1.0, changeFrequency: 'daily'   as const },
  { path: '/simulate',  title: 'LP Simulator: Fees, Impermanent Loss and Range Analysis', priority: 0.9, changeFrequency: 'daily'   as const },
  { path: '/discover',  title: 'Discover Pools: Best APR and TVL Across Chains',  priority: 0.9, changeFrequency: 'daily'   as const },
  { path: '/portfolio', title: 'Portfolio: Manage and Rebalance LP Positions',    priority: 0.8, changeFrequency: 'weekly'  as const },
  { path: '/swap',      title: 'Swap: Best Price Across Every Chain',              priority: 0.7, changeFrequency: 'daily'   as const },
  { path: '/nft',       title: 'BTB Bears NFT',                                   priority: 0.5, changeFrequency: 'weekly'  as const },
  { path: '/agent',     title: 'Agent: Your Portfolio AI',                        priority: 0.5, changeFrequency: 'weekly'  as const },
  { path: '/docs',      title: 'Docs: Guides and Documentation',                  priority: 0.5, changeFrequency: 'weekly'  as const },
] as const;
