export interface HookSocialLinks {
  website?: string;
  twitter?: string;
  discord?: string;
  telegram?: string;
  github?: string;
}

export interface Hook {
  id: string;
  name: string;
  protocol: string;
  description: string;
  tvl: string;
  volume24h: string;
  apy: string;
  verified: boolean;
  socialLinks: HookSocialLinks;
  deployedOn: string[];
  category: string;
  riskLevel: 'Low' | 'Medium' | 'High';
  auditStatus: 'Audited' | 'In Progress' | 'Not Audited';
  lastUpdated: string;
}

export interface HookStats {
  totalTvl: string;
  volume24h: string;
  activeHooks: number;
  totalTransactions: string;
  changes: {
    tvl: string;
    volume: string;
    hooks: string;
    transactions: string;
  };
}
