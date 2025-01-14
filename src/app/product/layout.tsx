import { Metadata } from 'next';
import { generatePageMetadata } from '@/components/shared/PageSeo';

export const metadata: Metadata = generatePageMetadata({
  title: 'Liquid Staking System - BTB Finance',
  description: 'BTB Finance\'s Liquid Staking System revolutionizes Velodrome staking with flexible liquidity and optimized rewards.',
  path: '/product',
  keywords: [
    'Liquid Staking System',
    'VELO Staking',
    'Liquid btbVELO Tokens',
    'Perpetual Lock System',
    'Rewards Distribution',
    'Strategic Voting',
  ],
});

export default function ProductLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
