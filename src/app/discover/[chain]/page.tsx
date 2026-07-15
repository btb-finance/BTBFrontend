import type { Metadata } from 'next';
import { Providers } from '@/components/Providers';
import { MiniApp } from '@/components/MiniApp';
import { buildMetadata } from '@/lib/seo/metadata';

// Chain-scoped Discover, e.g. /discover/robinhoodchain — opens Discover filtered
// to that chain. The pair-level route /discover/<chain>/<pair> opens a pool.
export async function generateMetadata({ params }: { params: Promise<{ chain: string }> }): Promise<Metadata> {
  const { chain } = await params;
  const chainName = decodeURIComponent(chain).replace(/(^|\s)\S/g, (c) => c.toUpperCase());
  return buildMetadata({
    title: `${chainName} liquidity pools`,
    description: `Discover and add liquidity to ${chainName} pools with BTB Finance — automated, non-custodial LP management.`,
    path: `/discover/${chain}`,
  });
}

export default function DiscoverChainPage() {
  return (
    <Providers>
      <MiniApp/>
    </Providers>
  );
}
