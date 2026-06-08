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

  // Primary positioning. Keyword-led so a search for "nft that pays you" or
  // "stake nft earn" surfaces the BTB Bears.
  title: 'BTB Finance — Mint NFTs That Pay You Forever',
  titleTemplate: '%s · BTB Finance',
  tagline: 'The first NFTs that pay you forever.',
  description:
    'BTB Bears are the first NFTs that pay you forever. Mint a Bear, stake it, ' +
    'and earn BTBB rewards from a 1% tax on every BTBB transfer — passive, ' +
    'on-chain income on Ethereum. Plus best-price token swaps and a frosted ' +
    'all-in-one wallet.',

  keywords: [
    // Brand
    'BTB Finance', 'BTB', 'BTB Bears', 'BTB Bear NFT', 'BTBB',
    // The hook — NFTs that pay you
    'NFT that pays you', 'NFTs that pay you forever', 'first NFT that pays you',
    'NFT passive income', 'NFT that earns money', 'income generating NFT',
    // Staking / yield
    'stake NFT earn', 'NFT staking rewards', 'stake NFT for passive income',
    'earn crypto from NFT', 'NFT yield', 'NFT rewards Ethereum',
    // Mint
    'mint NFT', 'mint NFT Ethereum', 'new NFT mint',
    // Swap / DeFi
    'crypto swap', 'best price token swap', 'DeFi swap', 'Ethereum DeFi',
    'swap stake mint', 'crypto wallet app',
  ],

  twitter: '@BTB_Finance',
  socials: {
    twitter: 'https://x.com/BTB_Finance',
    discord: 'https://discord.gg/MYJz6KAFv',
    github: 'https://github.com/btb-finance',
  },

  ogImageAlt: 'BTB Bears — the first NFTs that pay you forever',
} as const;

/** App "sections" (tabs today, deep-linkable later) — drives the sitemap. */
export const SECTIONS = [
  { path: '/',          title: SITE.title,                                       priority: 1.0, changeFrequency: 'daily'   as const },
  { path: '/#nft',      title: 'BTB Bears — NFTs That Pay You Forever',          priority: 0.9, changeFrequency: 'daily'   as const },
  { path: '/#stake',    title: 'Stake BTB Bears — Earn BTBB Rewards',            priority: 0.9, changeFrequency: 'daily'   as const },
  { path: '/#swap',     title: 'Swap — Best-Price Token Swaps',                  priority: 0.8, changeFrequency: 'daily'   as const },
  { path: '/#portfolio',title: 'Portfolio — Track Your Holdings',                priority: 0.6, changeFrequency: 'weekly'  as const },
] as const;
