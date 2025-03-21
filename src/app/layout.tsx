import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { ThemeScript } from './theme-script';
import Navbar from './components/layout/Navbar';
import Logo from './components/common/Logo';
import BackgroundWrapper from './components/layout/BackgroundWrapper';
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
              <main className="pt-20 text-gray-900 dark:text-white">
                {children}
              </main>
              <footer className="bg-white dark:bg-gray-900 bg-opacity-90 dark:bg-opacity-90 backdrop-blur-md border-t border-gray-200 dark:border-gray-800">
                <div className="mx-auto max-w-7xl px-6 py-10">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Column 1: Quick Links */}
                    <div>
                      <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">BTB Finance</h3>
                      <ul className="space-y-3">
                        <li><a href="/" className="text-gray-600 dark:text-gray-400 hover:text-btb-primary dark:hover:text-btb-primary transition-colors">Home</a></li>
                        <li><a href="/dashboard" className="text-gray-600 dark:text-gray-400 hover:text-btb-primary dark:hover:text-btb-primary transition-colors">Dashboard</a></li>
                        <li><a href="/pools" className="text-gray-600 dark:text-gray-400 hover:text-btb-primary dark:hover:text-btb-primary transition-colors">Pools</a></li>
                        <li><a href="/education" className="text-gray-600 dark:text-gray-400 hover:text-btb-primary dark:hover:text-btb-primary transition-colors">Education</a></li>
                      </ul>
                    </div>
                    
                    {/* Column 2: Resources */}
                    <div>
                      <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Resources</h3>
                      <ul className="space-y-3">
                        <li><a href="/docs" className="text-gray-600 dark:text-gray-400 hover:text-btb-primary dark:hover:text-btb-primary transition-colors">Documentation</a></li>
                        <li><a href="/community" className="text-gray-600 dark:text-gray-400 hover:text-btb-primary dark:hover:text-btb-primary transition-colors">Community</a></li>
                        <li><a href="/trading" className="text-gray-600 dark:text-gray-400 hover:text-btb-primary dark:hover:text-btb-primary transition-colors">Trading</a></li>
                        <li><a href="/yield-trading" className="text-gray-600 dark:text-gray-400 hover:text-btb-primary dark:hover:text-btb-primary transition-colors">Yield Trading</a></li>
                      </ul>
                    </div>
                    
                    {/* Column 3: Connect */}
                    <div>
                      <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Connect</h3>
                      <div className="flex space-x-4 mb-6">
                        <a href="https://x.com/BTB_Finance" target="_blank" rel="noopener noreferrer" className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-btb-primary hover:text-white dark:hover:bg-btb-primary dark:hover:text-white transition-colors" aria-label="X (Twitter)">
                          <FaXTwitter className="w-5 h-5" />
                        </a>
                        <a href="https://t.me/BTBFinance" target="_blank" rel="noopener noreferrer" className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-btb-primary hover:text-white dark:hover:bg-btb-primary dark:hover:text-white transition-colors" aria-label="Telegram">
                          <FaTelegram className="w-5 h-5" />
                        </a>
                        <a href="https://discord.gg/bqFEPA56Tc" target="_blank" rel="noopener noreferrer" className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-btb-primary hover:text-white dark:hover:bg-btb-primary dark:hover:text-white transition-colors" aria-label="Discord">
                          <FaDiscord className="w-5 h-5" />
                        </a>
                        <a href="https://github.com/btb-finance" target="_blank" rel="noopener noreferrer" className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-btb-primary hover:text-white dark:hover:bg-btb-primary dark:hover:text-white transition-colors" aria-label="GitHub">
                          <FaGithub className="w-5 h-5" />
                        </a>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Stay updated with the latest news and announcements from BTB Finance.
                      </p>
                    </div>
                  </div>
                  
                  {/* Copyright */}
                  <div className="border-t border-gray-200 dark:border-gray-800 mt-8 pt-6 flex flex-col md:flex-row justify-between items-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      &copy; {new Date().getFullYear()} BTB Finance. All rights reserved.
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 md:mt-0">
                      Built on <span className="text-btb-primary">Base</span>
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
