import type { Metadata } from 'next';
import { Providers } from '@/components/Providers';
import { MiniApp } from '@/components/MiniApp';
import { buildMetadata } from '@/lib/seo/metadata';

// Shareable deep link to a pool's Add-liquidity flow, e.g.
// /discover/robinhoodchain/cashcat-eth. Renders the same shell; DiscoverScreen
// reads the path and opens the pool.
export async function generateMetadata({ params }: { params: Promise<{ chain: string; pair: string }> }): Promise<Metadata> {
  const { chain, pair } = await params;
  const pretty = decodeURIComponent(pair).replace(/-/g, '/').toUpperCase();
  const chainName = decodeURIComponent(chain).replace(/(^|\s)\S/g, (c) => c.toUpperCase());
  return buildMetadata({
    title: `Add liquidity to ${pretty}`,
    description: `Open a managed ${pretty} liquidity position on ${chainName} with BTB Finance — automated rebalancing, non-custodial.`,
    path: `/discover/${chain}/${pair}`,
  });
}

export default function PoolDeepLinkPage() {
  return (
    <Providers>
      <MiniApp/>
    </Providers>
  );
}
