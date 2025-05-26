import { Hook, HookStats } from '../types/hooks';

export const mockHooks: Hook[] = [
  {
    id: '1',
    name: 'BTB Finance',
    protocol: 'BTB Protocol',
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
    id: '2',
    name: 'Larry Ecosystem',
    protocol: 'BTB Protocol',
    description: 'Stability-focused lending and leverage protocol with automated risk management',
    tvl: '$5.8M',
    volume24h: '$920K',
    apy: '15.5%',
    verified: true,
    socialLinks: {
      twitter: 'https://twitter.com/btb_finance',
      discord: 'https://discord.gg/btb'
    },
    deployedOn: ['Base'],
    category: 'Lending',
    riskLevel: 'Medium',
    auditStatus: 'In Progress',
    lastUpdated: '2025-02-02'
  },
  {
    id: '3',
    name: 'CHICKS Protocol',
    protocol: 'BTB Protocol',
    description: 'NFT-based gaming and reward system with yield generation mechanisms',
    tvl: '$3.2M',
    volume24h: '$480K',
    apy: '18.2%',
    verified: true,
    socialLinks: {
      twitter: 'https://twitter.com/btb_finance',
      discord: 'https://discord.gg/btb'
    },
    deployedOn: ['Base'],
    category: 'Gaming & NFT',
    riskLevel: 'Medium',
    auditStatus: 'In Progress',
    lastUpdated: '2025-02-02'
  }
];

export const hookStats: HookStats = {
  totalTvl: '$16.2M',
  volume24h: '$2.5M',
  activeHooks: 3,
  totalTransactions: '85.2K',
  changes: {
    tvl: '+12.8%',
    volume: '+8.5%',
    hooks: '+1',
    transactions: '+15.2%'
  }
};
