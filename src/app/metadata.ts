import { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'BTB Finance',
  description: 'Protect your liquidity with BTB Finance - The first protocol to provide impermanent loss protection on Uniswap V3.',
  metadataBase: new URL('https://btb.finance'),
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#000000',
};
