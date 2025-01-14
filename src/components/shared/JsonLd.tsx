import { type ReactNode } from 'react';

interface JsonLdProps {
  data: Record<string, unknown>;
}

export function JsonLd({ data }: JsonLdProps): ReactNode {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

interface FAQItem {
  question: string;
  answer: string;
}

export function generateFAQSchema(faqs: FAQItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

export function generateOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'BTB Finance',
    url: 'https://btb.finance',
    logo: 'https://btb.finance/logo.png',
    sameAs: [
      'https://twitter.com/btb_finance',
      'https://discord.gg/bqFEPA56Tc',
      'https://t.me/BTBFinance',
    ],
    description:
      'BTB Finance provides impermanent loss protection for liquidity providers on Uniswap V3 through our innovative Liquidity Refund System.',
  };
}

export function generateProductSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'BTB Finance Liquidity Refund System',
    applicationCategory: 'DeFi Protocol',
    operatingSystem: 'Web-based',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    description:
      'Protect your liquidity from impermanent loss with our innovative Liquidity Refund System on Uniswap V3.',
  };
}
