import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Web3Provider } from './context/Web3Context';
import Link from 'next/link';

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "BTB Token Sale",
  description: "Buy BTB tokens with instant purchase or vesting options",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Web3Provider>
          <nav className="bg-white shadow-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between h-16">
                <div className="flex">
                  <Link href="/" className="flex items-center px-3 py-2 text-gray-900 hover:text-gray-600">
                    Token Sale
                  </Link>
                 
                </div>
              </div>
            </div>
          </nav>
          {children}
        </Web3Provider>
      </body>
    </html>
  );
}
