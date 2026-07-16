import type { Metadata } from 'next';
import { AppClientOnly } from '@/components/AppClientOnly';
import { buildMetadata } from '@/lib/seo/metadata';

const CHAIN_NAMES: Record<string, string> = { robinhoodchain: 'Robinhood Chain', ethereum: 'Ethereum' };

export async function generateMetadata({ params }: { params: Promise<{ chain: string; pair: string }> }): Promise<Metadata> {
  const { chain, pair } = await params;
  const pretty = decodeURIComponent(pair).split('-').join('/').toUpperCase();
  const chainName = CHAIN_NAMES[chain.toLowerCase()] ?? decodeURIComponent(chain).replace(/(^|\s)\S/g, (c) => c.toUpperCase());
  return buildMetadata({
    title: `Add liquidity to ${pretty}`,
    description: `Open a managed ${pretty} liquidity position on ${chainName} with BTB Finance — automated rebalancing, non-custodial.`,
    path: `/discover/${chain}/${pair}`,
  });
}

export default function Page() {
  return <AppClientOnly/>;
}
