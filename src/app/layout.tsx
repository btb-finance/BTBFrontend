import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { ThemeScript } from './theme-script';
import Navbar from './components/layout/Navbar';
import Logo from './components/common/Logo';
import BackgroundWrapper from './components/layout/BackgroundWrapper';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'BTB Finance - Revolutionary DeFi Ecosystem',
  description: 'Experience the future of decentralized finance with BTB Finance. Explore our comprehensive ecosystem of digital assets and yield farming solutions.',
  icons: {
    icon: '/favicon.ico',
    apple: '/images/btblogo.jpg',
  },
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
          <BackgroundWrapper>
            <div className="min-h-screen">
              <Navbar />
              <main className="pt-16 text-gray-900 dark:text-white">
                {children}
              </main>
              <footer className="bg-white dark:bg-gray-900 bg-opacity-80 dark:bg-opacity-80 backdrop-blur-sm border-t border-gray-200 dark:border-gray-800">
              <div className="mx-auto max-w-7xl px-6 py-12 md:flex md:items-center md:justify-between lg:px-8">
                <div className="flex justify-center md:justify-start mb-6 md:mb-0">
                  <Logo size={40} showText={true} />
                </div>
                <div className="flex justify-center space-x-6 md:order-2">
                  <a href="#" className="text-btb-primary hover:text-opacity-80">
                    Twitter
                  </a>
                  <a href="#" className="text-btb-primary hover:text-opacity-80">
                    Discord
                  </a>
                  <a href="#" className="text-btb-primary hover:text-opacity-80">
                    GitHub
                  </a>
                </div>
                <div className="mt-8 md:order-1 md:mt-0">
                  <p className="text-center text-sm leading-5 text-gray-500">
                    &copy; {new Date().getFullYear()} BTB Finance. All rights reserved.
                  </p>
                </div>
              </div>
              </footer>
            </div>
          </BackgroundWrapper>
        </Providers>
      </body>
    </html>
  );
}
