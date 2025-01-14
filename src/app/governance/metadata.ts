import { Metadata, Viewport } from 'next';
import { generatePageMetadata } from '@/components/shared/PageSeo';

export const metadata: Metadata = generatePageMetadata({
  title: 'Governance - BTB Finance',
  description: 'Shape the future of BTB Finance by participating in governance. Stake BTB tokens to vote on protocol decisions and earn rewards from fees.',
  path: '/governance',
  keywords: [
    'DeFi Governance',
    'BTB Staking',
    'Protocol Decisions',
    'Community Voting',
    'Staking Rewards',
  ],
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#000000',
};
