'use client';

import React, { useState } from 'react';
import { ArrowRightIcon, ArrowsRightLeftIcon, CurrencyDollarIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import { Button } from '../components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import Link from 'next/link';

export default function YieldTradingPage() {
  const [activeTab, setActiveTab] = useState('buy');
  const [amount, setAmount] = useState('');
  const [estimatedReturn, setEstimatedReturn] = useState('0');

  // Calculate estimated return based on amount and active tab
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setAmount(value);
    
    if (!value || isNaN(Number(value))) {
      setEstimatedReturn('0');
      return;
    }

    const numValue = parseFloat(value);
    if (activeTab === 'buy') {
      setEstimatedReturn((numValue * 0.875).toFixed(2));
    } else {
      setEstimatedReturn((numValue * 1.125).toFixed(2));
    }
  };
  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gradient mb-4">
            Understanding Yield Trading
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            A revolutionary platform for trading future liquidity provider (LP) rewards
          </p>
        </div>

        {/* Core Concept Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>How It Works</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-btb-primary">For Yield Sellers</h3>
                <ul className="space-y-2">
                  <li className="flex items-start">
                    <span className="text-btb-primary mr-2">•</span>
                    <span>Deposit assets into liquidity pools</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-btb-primary mr-2">•</span>
                    <span>Sell future yield rights for immediate capital</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-btb-primary mr-2">•</span>
                    <span>Maintain ownership of principal investment</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-btb-primary mr-2">•</span>
                    <span>Reclaim position when contract expires</span>
                  </li>
                </ul>
              </div>
              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-btb-primary">For Yield Buyers</h3>
                <ul className="space-y-2">
                  <li className="flex items-start">
                    <span className="text-btb-primary mr-2">•</span>
                    <span>Purchase future yield at a discount</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-btb-primary mr-2">•</span>
                    <span>Collect all generated fees during contract period</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-btb-primary mr-2">•</span>
                    <span>Potential for higher returns through yield optimization</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-btb-primary mr-2">•</span>
                    <span>No principal lock-up required</span>
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Example Transaction */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Example Transaction</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <h3 className="text-lg font-semibold mb-4">Initial Setup</h3>
                <ul className="space-y-2">
                  <li>User deposits $1,000 worth of assets into ETH/USDC pool</li>
                  <li>Expected annual yield: $1,000 (100% APY)</li>
                  <li>Yield buyer offers $500 for 1-year yield rights</li>
                </ul>
              </div>
              
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <h3 className="text-lg font-semibold mb-4">Outcome</h3>
                <ul className="space-y-2">
                  <li>Seller receives $500 immediately</li>
                  <li>Buyer collects all yield during contract period</li>
                  <li>After one year, seller reclaims principal position</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Key Features */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-center mb-8">Platform Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center mb-4">
                  <ArrowsRightLeftIcon className="h-6 w-6 text-btb-primary mr-2" />
                  <h3 className="text-lg font-semibold">Auto-Rebalancing</h3>
                </div>
                <p className="text-gray-600 dark:text-gray-300">
                  Smart contracts automatically maintain optimal position ratios and manage risk.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center mb-4">
                  <CurrencyDollarIcon className="h-6 w-6 text-btb-primary mr-2" />
                  <h3 className="text-lg font-semibold">Dynamic Pricing</h3>
                </div>
                <p className="text-gray-600 dark:text-gray-300">
                  Market-driven yield valuations based on current conditions and risk factors.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center mb-4">
                  <ChartBarIcon className="h-6 w-6 text-btb-primary mr-2" />
                  <h3 className="text-lg font-semibold">Analytics Dashboard</h3>
                </div>
                <p className="text-gray-600 dark:text-gray-300">
                  Comprehensive tools for tracking positions, yields, and market trends.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Call to Action */}
        <div className="text-center bg-btb-primary/5 rounded-xl p-8 mb-12">
          <h2 className="text-2xl font-bold mb-4">Ready to Start Trading Yield?</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            Join our platform to start buying and selling LP rewards.
          </p>
          
          {/* Trading Interface */}
          <Card className="max-w-2xl mx-auto mb-8">
            <CardContent className="p-6">
              <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
                <button
                  className={`px-4 py-2 font-medium ${activeTab === 'buy' ? 'text-btb-primary border-b-2 border-btb-primary' : 'text-gray-500 dark:text-gray-400'}`}
                  onClick={() => setActiveTab('buy')}
                >
                  Buy Yield
                </button>
                <button
                  className={`px-4 py-2 font-medium ${activeTab === 'sell' ? 'text-btb-primary border-b-2 border-btb-primary' : 'text-gray-500 dark:text-gray-400'}`}
                  onClick={() => setActiveTab('sell')}
                >
                  Sell Yield
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <Label htmlFor="pool">Select Pool</Label>
                  <select 
                    id="pool"
                    className="w-full mt-1 p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  >
                    <option value="eth-usdc">ETH/USDC</option>
                    <option value="btb-eth">BTB/ETH</option>
                    <option value="btb-usdc">BTB/USDC</option>
                  </select>
                </div>

                <div>
                  <Label htmlFor="amount">{activeTab === 'buy' ? 'Amount to Buy' : 'Amount to Sell'}</Label>
                  <div className="relative mt-1">
                    <Input
                      id="amount"
                      type="number"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="pr-16"
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <span className="text-gray-500 dark:text-gray-400">USDC</span>
                    </div>
                  </div>
                </div>

                <div>
                  <Label htmlFor="duration">Lock Duration</Label>
                  <select 
                    id="duration"
                    className="w-full mt-1 p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  >
                    <option value="30">30 Days</option>
                    <option value="90">90 Days</option>
                    <option value="180">180 Days</option>
                    <option value="365">1 Year</option>
                  </select>
                </div>

                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-600 dark:text-gray-300">
                      {activeTab === 'buy' ? 'Estimated Cost' : 'You Receive'}
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {estimatedReturn} USDC
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">Expected APY</span>
                    <span className="font-semibold text-green-500">87.5%</span>
                  </div>
                </div>

                <Button 
                  className="w-full bg-btb-primary hover:bg-btb-primary-dark text-white"
                  disabled={!amount || parseFloat(amount) <= 0}
                >
                  {activeTab === 'buy' ? 'Buy Yield Position' : 'Sell Yield Position'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/trading">
              <Button className="bg-btb-primary hover:bg-btb-primary-dark text-white">
                View All Markets <ArrowRightIcon className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/calculator">
              <Button variant="outline">
                Try Yield Calculator
              </Button>
            </Link>
          </div>
        </div>

        {/* Risk Disclosure */}
        <div className="text-sm text-gray-500 dark:text-gray-400 text-center">
          <p>Trading yield involves risks. Please read our documentation and terms carefully before trading.</p>
          <Link href="/docs" className="text-btb-primary hover:underline">
            Learn more about risks and rewards
          </Link>
        </div>
      </div>
    </div>
  );
}