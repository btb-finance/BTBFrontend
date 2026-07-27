import type { Metadata } from 'next';
import { Providers } from '@/components/Providers';
import { MiniApp } from '@/components/MiniApp';
import { buildMetadata } from '@/lib/seo/metadata';

// Every tab/overlay of the app shell is deep-linkable. The shell (MiniApp)
// reads the path on load to open the right view; navigation inside the app
// updates the URL via pushState without re-rendering this route.
const TAB_META: Record<string, { title: string; description: string }> = {
  dashboard: { title: 'Dashboard', description: 'Your balances, positions, and daily check-in at a glance.' },
  discover:  { title: 'Discover Pools', description: 'Find the best performing liquidity pools with live APR, TVL, and fee data.' },
  token:     { title: 'Earn BTB', description: 'BTB pays the people who make it worth using. Earn XP for posts, articles, videos, bug reports and app usage — the week’s revenue is split between contributors every Friday.' },
  simulate:  { title: 'Simulate LP Earnings', description: 'Compare fee tiers across Uniswap V3, V4, and PancakeSwap and estimate LP earnings.' },
  swap:      { title: 'Swap', description: 'Trade tokens instantly at the best available price.' },
  portfolio: { title: 'Portfolio', description: 'Track your tokens, LP positions, and Earn balances in one place.' },
  nft:       { title: 'BTB Bear NFT', description: 'Mint and stake BTB Bears to earn BTBB rewards.' },
  agent:     { title: 'Agent', description: 'Your personal AI agent that reads your portfolio and flags risks.' },
  studio:    { title: 'Agent Studio', description: 'Create a smart account, compose a strategy across any protocols, set your rules once, and hand the work to an agent that can never break them.' },
  earn:      { title: 'Earn', description: 'Yearn vaults and staking on Ethereum. Deposit once, yield compounds itself.' },
  docs:      { title: 'Docs', description: 'Guides and documentation for the BTB Finance app.' },
};

export function generateStaticParams() {
  return Object.keys(TAB_META).map(tab => ({ tab }));
}
// Unknown slugs 404 instead of silently rendering the dashboard.
export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ tab: string }> }): Promise<Metadata> {
  const { tab } = await params;
  const meta = TAB_META[tab];
  return buildMetadata({ title: meta.title, description: meta.description, path: `/${tab}` });
}

export default function TabPage() {
  return (
    <Providers>
      <MiniApp/>
    </Providers>
  );
}
