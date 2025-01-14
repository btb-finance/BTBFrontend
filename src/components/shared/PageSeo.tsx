import { Metadata } from 'next';

interface PageSeoProps {
  title: string;
  description: string;
  path: string;
  keywords?: string[];
}

export function generatePageMetadata({
  title,
  description,
  path,
  keywords = [],
}: PageSeoProps): Metadata {
  const url = `https://btb.finance${path}`;

  return {
    title,
    description,
    keywords: [
      'BTB Finance',
      'DeFi',
      'Liquidity Protection',
      'Impermanent Loss',
      ...keywords,
    ],
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      url,
      siteName: 'BTB Finance',
      locale: 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      creator: '@BTBFinance',
    },
  };
}
