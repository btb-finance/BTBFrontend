import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { ThemeScript } from './theme-script';
import Navbar from './components/layout/Navbar';
import Logo from './components/common/Logo';
import BackgroundWrapper from './components/layout/BackgroundWrapper';
import QuickAccess from './components/layout/QuickAccess';
import NetworkChangeAlert from './components/layout/NetworkChangeAlert';
import { FaXTwitter, FaTelegram, FaGithub, FaDiscord } from 'react-icons/fa6';

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
      <body className={`${inter.className} bg-white dark:bg-gray-900`} suppressHydrationWarning>
        <Providers>
          <ThemeScript />
          <BackgroundWrapper>
            <div className="min-h-screen">
              <Navbar />
              <NetworkChangeAlert />
              <main className="pt-14 text-gray-900 dark:text-white">
                {children}
                <QuickAccess />
              </main>
              <footer className="bg-white dark:bg-gray-900 bg-opacity-90 dark:bg-opacity-90 backdrop-blur-md border-t border-gray-200 dark:border-gray-800">
                <div className="mx-auto max-w-7xl px-4 py-4">
                  <div className="flex flex-col md:flex-row justify-between items-center">
                    <div className="flex items-center space-x-4 mb-3 md:mb-0">
                      <a href="https://x.com/BTB_Finance" target="_blank" rel="noopener noreferrer" className="p-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-btb-primary hover:text-white transition-colors" aria-label="X (Twitter)">
                        <FaXTwitter className="w-4 h-4" />
                      </a>
                      <a href="https://t.me/BTBFinance" target="_blank" rel="noopener noreferrer" className="p-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-btb-primary hover:text-white transition-colors" aria-label="Telegram">
                        <FaTelegram className="w-4 h-4" />
                      </a>
                      <a href="https://discord.gg/bqFEPA56Tc" target="_blank" rel="noopener noreferrer" className="p-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-btb-primary hover:text-white transition-colors" aria-label="Discord">
                        <FaDiscord className="w-4 h-4" />
                      </a>
                      <a href="https://github.com/btb-finance" target="_blank" rel="noopener noreferrer" className="p-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-btb-primary hover:text-white transition-colors" aria-label="GitHub">
                        <FaGithub className="w-4 h-4" />
                      </a>
                    </div>
                    <div className="flex space-x-4 text-xs">
                      <a href="/" className="text-gray-600 dark:text-gray-400 hover:text-btb-primary transition-colors">Home</a>
                      <a href="/dashboard" className="text-gray-600 dark:text-gray-400 hover:text-btb-primary transition-colors">Dashboard</a>
                      <a href="/docs" className="text-gray-600 dark:text-gray-400 hover:text-btb-primary transition-colors">Docs</a>
                      <a href="/community" className="text-gray-600 dark:text-gray-400 hover:text-btb-primary transition-colors">Community</a>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 md:mt-0">
                      &copy; {new Date().getFullYear()} BTB Finance
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
