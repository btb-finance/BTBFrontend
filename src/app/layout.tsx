import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ClientLayout } from '@/components/layout/ClientLayout';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: {
    template: '%s | BTB Finance',
    default: 'BTB Finance - Your Safety Net in DeFi',
  },
  description: 'BTB Finance provides impermanent loss protection for liquidity providers on Uniswap V3 through our innovative Liquidity Refund System.',
  keywords: [
    'DeFi',
    'Liquidity Protection',
    'Impermanent Loss',
    'Uniswap V3',
    'BTB Finance',
    'Staking',
    'Governance',
  ],
  metadataBase: new URL('https://btb.finance'),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} antialiased`}>
      <body className="min-h-screen bg-background-dark text-text-primary">
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
