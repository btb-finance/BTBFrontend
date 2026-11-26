import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { buildMetadata } from '@/lib/seo/metadata';
import { AskEntry } from './entry';
import './ask.css';

const inter = Inter({ subsets: ['latin'], display: 'swap' });

export const metadata: Metadata = buildMetadata({
  title: 'Ask BTB',
  description: 'Tell BTB what you want in plain English: find pools, check tokens, read your positions and set up swaps. You confirm in your own wallet.',
  path: '/ask',
});

export default function AskPage() {
  return <div className={inter.className}><AskEntry/></div>;
}
