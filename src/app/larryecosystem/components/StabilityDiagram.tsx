'use client';

import React from 'react';
import { Card } from '../../components/ui/card';
import { ArrowRightIcon, ShieldIcon, TrendingUpIcon, CoinsIcon } from 'lucide-react';

export default function StabilityDiagram() {
  return (
    <div className="max-w-6xl mx-auto">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold text-emerald-600 mb-4">Larry Stability Mechanism</h2>
        <p className="text-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
          Larry's innovative design ensures the price can only increase, never decrease. 
          Here's how the ecosystem maintains stability while enabling leverage and borrowing.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
        <Card className="p-6 bg-gradient-to-b from-emerald-50 to-white dark:from-emerald-900/20 dark:to-gray-800">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-emerald-500 rounded-lg">
              <TrendingUpIcon className="h-6 w-6 text-white" />
            </div>
            <h3 className="text-xl font-bold text-emerald-700">Buy & Sell</h3>
          </div>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            Every buy and sell transaction includes a small fee that increases the backing per token, 
            ensuring the price can only go up over time.
          </p>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <ArrowRightIcon className="h-4 w-4 text-emerald-500" />
              <span>Buy fee: 0.1%</span>
            </div>
            <div className="flex items-center gap-2">
              <ArrowRightIcon className="h-4 w-4 text-emerald-500" />
              <span>Sell fee: 0.1%</span>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-gradient-to-b from-emerald-50 to-white dark:from-emerald-900/20 dark:to-gray-800">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-emerald-500 rounded-lg">
              <CoinsIcon className="h-6 w-6 text-white" />
            </div>
            <h3 className="text-xl font-bold text-emerald-700">Leverage & Borrow</h3>
          </div>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            Users can leverage up to 100x or borrow ETH against LARRY collateral. 
            Interest fees add to the protocol's backing.
          </p>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <ArrowRightIcon className="h-4 w-4 text-emerald-500" />
              <span>Leverage fee: 1%</span>
            </div>
            <div className="flex items-center gap-2">
              <ArrowRightIcon className="h-4 w-4 text-emerald-500" />
              <span>Interest: 3.9% APR</span>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-gradient-to-b from-emerald-50 to-white dark:from-emerald-900/20 dark:to-gray-800">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-emerald-500 rounded-lg">
              <ShieldIcon className="h-6 w-6 text-white" />
            </div>
            <h3 className="text-xl font-bold text-emerald-700">Liquidations</h3>
          </div>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            Expired loans are automatically liquidated, burning the collateral LARRY and 
            adding the borrowed ETH back to the protocol's backing.
          </p>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <ArrowRightIcon className="h-4 w-4 text-emerald-500" />
              <span>Collateral burned</span>
            </div>
            <div className="flex items-center gap-2">
              <ArrowRightIcon className="h-4 w-4 text-emerald-500" />
              <span>ETH retained</span>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-8 bg-gradient-to-r from-emerald-500/5 to-emerald-600/5">
        <div className="text-center">
          <h3 className="text-2xl font-bold text-emerald-700 mb-4">The Result: Ever-Increasing Price</h3>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto mb-6">
            Through fees, interest, and liquidations, the ETH backing per LARRY token continuously increases. 
            Combined with a capped supply, this creates a unique stability mechanism where the price can only go up.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-4 bg-white dark:bg-gray-800 rounded-lg">
              <p className="text-3xl font-bold text-emerald-600 mb-2">$0</p>
              <p className="text-sm text-gray-600">Minimum Price</p>
            </div>
            <div className="p-4 bg-white dark:bg-gray-800 rounded-lg">
              <p className="text-3xl font-bold text-emerald-600 mb-2">1B</p>
              <p className="text-sm text-gray-600">Max Supply</p>
            </div>
            <div className="p-4 bg-white dark:bg-gray-800 rounded-lg">
              <p className="text-3xl font-bold text-emerald-600 mb-2">∞</p>
              <p className="text-sm text-gray-600">Max Price</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}