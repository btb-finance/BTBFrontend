import type { Metadata } from 'next';
import { AppClientOnly } from '@/components/AppClientOnly';
import { buildMetadata } from '@/lib/seo/metadata';

const CHAIN_NAMES: Record<string, string> = { robinhoodchain: 'Robinhood Chain', ethereum: 'Ethereum' };

export async function generateMetadata({ params }: { params: Promise<{ chain: string }> }): Promise<Metadata> {
  const { chain } = await params;
  const chainName = CHAIN_NAMES[chain.toLowerCase()] ?? decodeURIComponent(chain).replace(/(^|\s)\S/g, (c) => c.toUpperCase());
  return buildMetadata({
    title: `${chainName} liquidity pools`,
    description: `Discover and add liquidity to ${chainName} pools with BTB Finance — automated, non-custodial LP management.`,
    path: `/discover/${chain}`,
  });
}

export default function Page() {
  return <AppClientOnly/>;
}
