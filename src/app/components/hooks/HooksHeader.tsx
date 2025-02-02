'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export default function HooksHeader() {
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="w-full bg-gradient-to-r from-blue-900 to-purple-900 py-16 px-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold mb-4 font-montserrat">Discover UniV4 Hooks</h1>
        <p className="text-xl text-gray-300 font-roboto mb-4">
          Explore and analyze the most innovative Uniswap V4 hooks across different protocols
        </p>
        <div className="flex items-center gap-2 mb-8">
          <span className="text-yellow-400">⚠️</span>
          <p className="text-sm text-gray-300">
            Note: TVL and volume data might not be accurate. If you find any mistakes, please email us at{' '}
            <a href="mailto:hello@btb.finance" className="text-primary hover:text-primary-light">
              hello@btb.finance
            </a>
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <div className="relative">
            <input
              type="search"
              placeholder="Search hooks by name, category, or network..."
              className="w-full px-4 py-3 rounded-lg bg-gray-800/50 border border-gray-700 focus:border-primary focus:ring-1 focus:ring-primary"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex gap-4">
            <select className="w-full px-4 py-3 rounded-lg bg-gray-800/50 border border-gray-700 focus:border-primary focus:ring-1 focus:ring-primary">
              <option value="">All Categories</option>
              <option value="market-making">Market Making</option>
              <option value="liquidity">Liquidity Management</option>
              <option value="trading">Trading</option>
              <option value="options">Options</option>
              <option value="lending">Lending</option>
              <option value="governance">Governance</option>
              <option value="analytics">Analytics</option>
              <option value="mev">MEV Protection</option>
            </select>
          </div>

          <div className="flex gap-4">
            <select className="w-full px-4 py-3 rounded-lg bg-gray-800/50 border border-gray-700 focus:border-primary focus:ring-1 focus:ring-primary">
              <option value="">All Networks</option>
              <option value="ethereum">Ethereum</option>
              <option value="base">Base</option>
              <option value="optimism">Optimism</option>
              <option value="arbitrum">Arbitrum</option>
            </select>
          </div>
        </div>

        <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold mb-1">Want to list your hook?</h3>
              <p className="text-gray-400">
                DM us on{' '}
                <Link 
                  href="https://x.com/btb_finance" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:text-primary-light"
                >
                  X @btb_finance
                </Link>
              </p>
            </div>
            <Link 
              href="https://x.com/btb_finance" 
              target="_blank" 
              rel="noopener noreferrer"
              className="px-4 py-2 bg-primary hover:bg-primary-dark rounded-lg transition-colors"
            >
              List Your Hook
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
