import { Hook, HookStats } from '../types/hooks';

export const mockHooks: Hook[] = [
  {
    id: '1',
    name: 'Flaunch',
    protocol: 'Uniswap V4',
    description: 'Fair Launch platform with programmable liquidity hooks for token launches and initial liquidity bootstrapping',
    tvl: '$4.2M',
    volume24h: '$850K',
    apy: '15.2%',
    verified: true,
    socialLinks: {
      twitter: 'https://twitter.com/flaunchgg',
      discord: 'https://discord.gg/flaunch'
    },
    deployedOn: ['Base'],
    category: 'Token Launch',
    riskLevel: 'Medium',
    auditStatus: 'In Progress',
    lastUpdated: '2025-02-02'
  },
  {
    id: '2',
    name: 'Bunni',
    protocol: 'Uniswap V4',
    description: 'Shapeshifting DEX with programmable liquidity behavior and advanced routing for maximizing LP profits',
    tvl: '$6.8M',
    volume24h: '$1.2M',
    apy: '18.5%',
    verified: true,
    socialLinks: {
      website: 'https://bunni.xyz',
      twitter: 'https://twitter.com/bunni_xyz',
      discord: 'https://discord.gg/bunni'
    },
    deployedOn: ['Ethereum', 'Base'],
    category: 'Liquidity Management',
    riskLevel: 'Medium',
    auditStatus: 'Audited',
    lastUpdated: '2025-02-02'
  },
  {
    id: '3',
    name: 'Arrakis Finance',
    protocol: 'Uniswap V4',
    description: 'MEV-aware market maker with Diamond Hook for minimizing LVR (Liquidity Variable Risk) and modular liquidity management',
    tvl: '$12.5M',
    volume24h: '$2.1M',
    apy: '16.8%',
    verified: true,
    socialLinks: {
      website: 'https://arrakis.finance',
      twitter: 'https://twitter.com/ArrakisFinance',
      discord: 'https://discord.gg/arrakis'
    },
    deployedOn: ['Ethereum', 'Base', 'Optimism'],
    category: 'MEV Protection',
    riskLevel: 'Low',
    auditStatus: 'Audited',
    lastUpdated: '2025-02-02'
  },
  {
    id: '4',
    name: 'Cork Protocol',
    protocol: 'Uniswap V4',
    description: 'Dynamic liquidity management system with customizable hooks for gas optimization and MEV protection',
    tvl: '$5.2M',
    volume24h: '$780K',
    apy: '14.5%',
    verified: true,
    socialLinks: {
      twitter: 'https://twitter.com/Corkprotocol',
      discord: 'https://discord.gg/cork'
    },
    deployedOn: ['Base'],
    category: 'Gas Optimization',
    riskLevel: 'Medium',
    auditStatus: 'In Progress',
    lastUpdated: '2025-02-02'
  },
  {
    id: '5',
    name: 'TWAMM by FWB',
    protocol: 'Uniswap V4',
    description: 'Time-Weighted Average Market Maker hook for large orders with minimal price impact and MEV protection',
    tvl: '$7.8M',
    volume24h: '$1.5M',
    apy: '15.8%',
    verified: true,
    socialLinks: {
      twitter: 'https://twitter.com/FWBtweets',
      discord: 'https://discord.gg/fwb'
    },
    deployedOn: ['Ethereum', 'Base'],
    category: 'Large Orders',
    riskLevel: 'Low',
    auditStatus: 'Audited',
    lastUpdated: '2025-02-02'
  },
  {
    id: '6',
    name: 'Angstrom by Sorella',
    protocol: 'Uniswap V4',
    description: 'Advanced MEV protection hook using batch auctions to maximize LP and trader welfare while minimizing LVR',
    tvl: '$6.5M',
    volume24h: '$980K',
    apy: '16.2%',
    verified: true,
    socialLinks: {
      website: 'https://sorellalabs.xyz',
      twitter: 'https://twitter.com/SorellaLabs',
      discord: 'https://discord.gg/sorella'
    },
    deployedOn: ['Ethereum'],
    category: 'MEV Protection',
    riskLevel: 'Low',
    auditStatus: 'Audited',
    lastUpdated: '2025-02-02'
  },
  {
    id: '7',
    name: 'Doppler by Whetstone',
    protocol: 'Uniswap V4',
    description: 'Hyper-efficient price discovery and liquidity bootstrapping protocol with customizable AMM hooks',
    tvl: '$5.8M',
    volume24h: '$920K',
    apy: '15.5%',
    verified: true,
    socialLinks: {
      website: 'https://whetstone.cc/doppler',
      twitter: 'https://twitter.com/whetstonedotcc',
      discord: 'https://discord.gg/whetstone'
    },
    deployedOn: ['Base'],
    category: 'Price Discovery',
    riskLevel: 'Medium',
    auditStatus: 'In Progress',
    lastUpdated: '2025-02-02'
  },
  {
    id: '8',
    name: 'Predicate',
    protocol: 'Uniswap V4',
    description: 'Conditional order execution system with programmable hooks for advanced trading strategies',
    tvl: '$4.2M',
    volume24h: '$680K',
    apy: '14.8%',
    verified: true,
    socialLinks: {
      twitter: 'https://twitter.com/0xPredicate',
      discord: 'https://discord.gg/predicate'
    },
    deployedOn: ['Base'],
    category: 'Trading',
    riskLevel: 'Medium',
    auditStatus: 'In Progress',
    lastUpdated: '2025-02-02'
  },
  {
    id: '9',
    name: 'Semantic Layer',
    protocol: 'Uniswap V4',
    description: 'Advanced data indexing and analytics layer for Uniswap V4 hooks with real-time insights',
    tvl: '$3.8M',
    volume24h: '$520K',
    apy: '13.8%',
    verified: true,
    socialLinks: {
      twitter: 'https://twitter.com/SemanticLayer',
      discord: 'https://discord.gg/semantic'
    },
    deployedOn: ['Base'],
    category: 'Analytics',
    riskLevel: 'Low',
    auditStatus: 'In Progress',
    lastUpdated: '2025-02-02'
  },
  {
    id: '10',
    name: 'Tenor Finance',
    protocol: 'Uniswap V4',
    description: 'Fixed-rate lending markets built on top of existing money markets using custom AMM hooks',
    tvl: '$8.2M',
    volume24h: '$1.4M',
    apy: '17.2%',
    verified: true,
    socialLinks: {
      website: 'https://tenor.finance',
      twitter: 'https://twitter.com/TenorFinance',
      discord: 'https://discord.gg/tenor'
    },
    deployedOn: ['Ethereum', 'Base'],
    category: 'Lending',
    riskLevel: 'Medium',
    auditStatus: 'Audited',
    lastUpdated: '2025-02-02'
  },
  {
    id: '11',
    name: 'Collar Protocol',
    protocol: 'Uniswap V4',
    description: 'Options-like structured products with customizable risk parameters using hooks',
    tvl: '$4.5M',
    volume24h: '$680K',
    apy: '16.5%',
    verified: true,
    socialLinks: {
      twitter: 'https://twitter.com/CollarProtocol',
      discord: 'https://discord.gg/collar'
    },
    deployedOn: ['Base'],
    category: 'Options',
    riskLevel: 'High',
    auditStatus: 'In Progress',
    lastUpdated: '2025-02-02'
  },
  {
    id: '12',
    name: 'Lumis Finance',
    protocol: 'Uniswap V4',
    description: 'Concentrated liquidity management protocol with dynamic fee optimization and MEV protection',
    tvl: '$5.8M',
    volume24h: '$920K',
    apy: '16.2%',
    verified: true,
    socialLinks: {
      twitter: 'https://twitter.com/lumisfi_',
      discord: 'https://discord.gg/lumis'
    },
    deployedOn: ['Ethereum', 'Base'],
    category: 'Liquidity Management',
    riskLevel: 'Medium',
    auditStatus: 'In Progress',
    lastUpdated: '2025-02-02'
  },
  {
    id: '13',
    name: 'Area51 Finance',
    protocol: 'Uniswap V4',
    description: 'AMM with built-in intents for automated liquidity strategies and carbon-efficient trading',
    tvl: '$3.5M',
    volume24h: '$580K',
    apy: '18.8%',
    verified: true,
    socialLinks: {
      website: 'https://a51.finance',
      twitter: 'https://twitter.com/A51_Fi',
      discord: 'https://discord.gg/area51'
    },
    deployedOn: ['Arbitrum', 'Base', 'Mode'],
    category: 'Strategy Automation',
    riskLevel: 'Medium',
    auditStatus: 'In Progress',
    lastUpdated: '2025-02-02'
  },
  {
    id: '14',
    name: 'Likwid Finance',
    protocol: 'Uniswap V4',
    description: 'Real-yield focused liquidity management with advanced position strategies',
    tvl: '$6.2M',
    volume24h: '$950K',
    apy: '15.5%',
    verified: true,
    socialLinks: {
      twitter: 'https://twitter.com/likwid_fi',
      discord: 'https://discord.gg/likwid'
    },
    deployedOn: ['Base'],
    category: 'Yield Generation',
    riskLevel: 'Medium',
    auditStatus: 'In Progress',
    lastUpdated: '2025-02-02'
  },
  {
    id: '15',
    name: 'Paladin',
    protocol: 'Uniswap V4',
    description: 'Governance-focused hooks for voting power optimization and delegation',
    tvl: '$4.8M',
    volume24h: '$720K',
    apy: '14.2%',
    verified: true,
    socialLinks: {
      website: 'https://paladin.vote',
      twitter: 'https://twitter.com/Paladin_vote',
      discord: 'https://discord.gg/paladin'
    },
    deployedOn: ['Ethereum'],
    category: 'Governance',
    riskLevel: 'Low',
    auditStatus: 'Audited',
    lastUpdated: '2025-02-02'
  },
  {
    id: '16',
    name: 'Gamma Strategies',
    protocol: 'Uniswap V4',
    description: 'Professional-grade liquidity management with advanced ALM strategies',
    tvl: '$8.5M',
    volume24h: '$1.4M',
    apy: '17.5%',
    verified: true,
    socialLinks: {
      website: 'https://gamma.xyz',
      twitter: 'https://twitter.com/GammaStrategies',
      discord: 'https://discord.gg/gamma'
    },
    deployedOn: ['Ethereum', 'Optimism', 'Base'],
    category: 'Professional Trading',
    riskLevel: 'Medium',
    auditStatus: 'Audited',
    lastUpdated: '2025-02-02'
  },
  {
    id: '17',
    name: 'Steer Protocol',
    protocol: 'Uniswap V4',
    description: 'Multi-position vault architecture for optimized stablecoin and pegged asset liquidity',
    tvl: '$5.5M',
    volume24h: '$850K',
    apy: '15.8%',
    verified: true,
    socialLinks: {
      website: 'https://steer.finance',
      twitter: 'https://twitter.com/steerprotocol',
      discord: 'https://discord.gg/steer'
    },
    deployedOn: ['Ethereum', 'Base'],
    category: 'Stablecoin Optimization',
    riskLevel: 'Low',
    auditStatus: 'Audited',
    lastUpdated: '2025-02-02'
  },
  {
    id: '18',
    name: 'BTB Finance',
    protocol: 'Uniswap V4',
    description: 'Comprehensive DeFi toolkit with advanced analytics, IL protection, and yield optimization',
    tvl: '$7.2M',
    volume24h: '$1.1M',
    apy: '16.5%',
    verified: true,
    socialLinks: {
      website: 'https://btb.finance',
      twitter: 'https://twitter.com/btb_finance',
      discord: 'https://discord.gg/btb'
    },
    deployedOn: ['Ethereum', 'Base', 'Arbitrum'],
    category: 'DeFi Tools',
    riskLevel: 'Low',
    auditStatus: 'Audited',
    lastUpdated: '2025-02-02'
  },
  {
    id: '19',
    name: 'Levery',
    protocol: 'Uniswap V4',
    description: 'Leveraged liquidity positions with automated risk management and liquidation protection',
    tvl: '$4.2M',
    volume24h: '$680K',
    apy: '19.2%',
    verified: true,
    socialLinks: {
      twitter: 'https://twitter.com/leveryorg',
      discord: 'https://discord.gg/levery'
    },
    deployedOn: ['Base'],
    category: 'Leverage',
    riskLevel: 'High',
    auditStatus: 'In Progress',
    lastUpdated: '2025-02-02'
  },
  {
    id: '20',
    name: 'Clanker',
    protocol: 'Uniswap V4',
    description: 'Base-native concentrated liquidity automation with MEV-protected rebalancing',
    tvl: '$3.8M',
    volume24h: '$520K',
    apy: '14.8%',
    verified: true,
    socialLinks: {
      twitter: 'https://twitter.com/clankeronbase',
      discord: 'https://discord.gg/clanker'
    },
    deployedOn: ['Base'],
    category: 'Automation',
    riskLevel: 'Medium',
    auditStatus: 'In Progress',
    lastUpdated: '2025-02-02'
  }
];

export const hookStats: HookStats = {
  totalTvl: '$98.5M',
  volume24h: '$16.52M',
  activeHooks: 20,
  totalTransactions: '425.8K',
  changes: {
    tvl: '+18.5%',
    volume: '+12.2%',
    hooks: '+9',
    transactions: '+15.8%'
  }
};
