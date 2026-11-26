import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { SignEntry } from './entry';
import '../ask/ask.css';

const inter = Inter({ subsets: ['latin'], display: 'swap' });

export const metadata: Metadata = {
  title: 'Sign with BTB',
  description: 'Review and sign transactions an assistant built for you with BTB, in your own wallet.',
  robots: { index: false, follow: false },
};

export default function SignPage() {
  return <div className={inter.className}><SignEntry/></div>;
}
