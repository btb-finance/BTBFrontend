import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { ThemeScript } from './theme-script';
import Navbar from './components/layout/Navbar';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'BTB Finance',
  description: 'Navigate the complex world of yield farming with confidence and precision.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} bg-white dark:bg-gray-900`}>
        <Providers>
          <ThemeScript />
          <div className="min-h-screen">
            <Navbar />
            <main className="pt-16 text-gray-900 dark:text-white">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
