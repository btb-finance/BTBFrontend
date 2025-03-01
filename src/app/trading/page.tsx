'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRightIcon, ArrowsRightLeftIcon, CurrencyDollarIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useWalletConnection } from '../hooks/useWalletConnection';

export default function TradingPage() {
  const { isConnected } = useWalletConnection();
  const [activeTab, setActiveTab] = useState('buy');
  const [amount, setAmount] = useState('');
  const [estimatedReturn, setEstimatedReturn] = useState('0');
  const [slippage, setSlippage] = useState('0.5');
  
  // Mock data for trading pairs
  const tradingPairs = [
    { name: 'BTB/ETH', price: '0.00042', change: '+5.2%', volume: '$1.2M', yield: '12.4%' },
    { name: 'BTBY/USDC', price: '1.25', change: '+2.8%', volume: '$890K', yield: '8.7%' },
    { name: 'BTB/USDC', price: '0.52', change: '-0.5%', volume: '$650K', yield: '6.2%' },
  ];

  // Mock function to calculate estimated return
  const calculateEstimate = (value: string) => {
    if (!value || isNaN(Number(value))) return '0';
    const numValue = parseFloat(value);
    
    // Different calculation based on active tab
    if (activeTab === 'buy') {
      return (numValue * 1.92).toFixed(2);
    } else if (activeTab === 'sell') {
      return (numValue * 0.96).toFixed(2);
    } else { // yield
      return (numValue * 0.087 * 365 / 12).toFixed(2);
    }
  };

  // Handle amount change
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setAmount(value);
    setEstimatedReturn(calculateEstimate(value));
  };

  // Wallet connection section
  const WalletSection = () => {
    if (!isConnected) {
      return (
        <div className="mb-8 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md text-center">
          <h3 className="text-xl font-bold mb-4 text-btb-primary">Connect Your Wallet</h3>
          <p className="mb-6 text-gray-600 dark:text-gray-300">
            Connect your wallet using the button in the navigation bar to access trading features and view your portfolio.
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gradient mb-4">
            BTB Trading Platform
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Buy, sell, and earn yield with BTB tokens on our revolutionary trading platform.
          </p>
        </div>

        {/* Wallet Connection */}
        <WalletSection />

        {/* Trading Interface */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          {/* Trading Pairs */}
          <div className="lg:col-span-1">
            <Card className="p-6">
              <h2 className="text-2xl font-bold text-btb-primary mb-6">Trading Pairs</h2>
              <div className="space-y-4">
                {tradingPairs.map((pair, index) => (
                  <div 
                    key={index} 
                    className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 hover:border-btb-primary transition-all duration-300"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-gray-900 dark:text-white">{pair.name}</span>
                      <span className={`text-sm ${pair.change.startsWith('+') ? 'text-green-500' : 'text-red-500'}`}>
                        {pair.change}
                      </span>
                    </div>
                    <div className="mt-2 flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-300">Price: {pair.price}</span>
                      <span className="text-gray-600 dark:text-gray-300">Vol: {pair.volume}</span>
                    </div>
                    <div className="mt-2 text-sm">
                      <span className="text-btb-primary">Yield: {pair.yield}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Trading Interface */}
          <div className="lg:col-span-2">
            <Card className="p-6">
              <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
                <button
                  className={`px-4 py-2 font-medium ${activeTab === 'buy' ? 'text-btb-primary border-b-2 border-btb-primary' : 'text-gray-500 dark:text-gray-400'}`}
                  onClick={() => setActiveTab('buy')}
                >
                  Buy
                </button>
                <button
                  className={`px-4 py-2 font-medium ${activeTab === 'sell' ? 'text-btb-primary border-b-2 border-btb-primary' : 'text-gray-500 dark:text-gray-400'}`}
                  onClick={() => setActiveTab('sell')}
                >
                  Sell
                </button>
                <button
                  className={`px-4 py-2 font-medium ${activeTab === 'yield' ? 'text-btb-primary border-b-2 border-btb-primary' : 'text-gray-500 dark:text-gray-400'}`}
                  onClick={() => setActiveTab('yield')}
                >
                  Yield
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <Label htmlFor="tradingPair">Trading Pair</Label>
                  <select 
                    id="tradingPair"
                    className="w-full mt-1 p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  >
                    {tradingPairs.map((pair, index) => (
                      <option key={index} value={pair.name}>{pair.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label htmlFor="amount">{activeTab === 'buy' ? 'Amount to Buy' : activeTab === 'sell' ? 'Amount to Sell' : 'Amount to Stake'}</Label>
                  <div className="relative mt-1">
                    <Input
                      id="amount"
                      type="number"
                      placeholder="0.00"
                      value={amount}
                      onChange={handleAmountChange}
                      className="pr-16"
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <span className="text-gray-500 dark:text-gray-400">
                        {activeTab === 'yield' ? 'BTB' : activeTab === 'buy' ? 'USDC' : 'BTB'}
                      </span>
                    </div>
                  </div>
                </div>

                {activeTab !== 'yield' && (
                  <div>
                    <Label htmlFor="slippage">Slippage Tolerance</Label>
                    <div className="flex items-center space-x-2 mt-1">
                      <Input
                        id="slippage"
                        type="number"
                        value={slippage}
                        onChange={(e) => setSlippage(e.target.value)}
                        className="w-24"
                      />
                      <span className="text-gray-500 dark:text-gray-400">%</span>
                    </div>
                  </div>
                )}

                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-600 dark:text-gray-300">
                      {activeTab === 'buy' ? 'Estimated BTB' : activeTab === 'sell' ? 'Estimated USDC' : 'Monthly Yield'}
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {estimatedReturn} {activeTab === 'buy' ? 'BTB' : activeTab === 'sell' ? 'USDC' : 'BTB'}
                    </span>
                  </div>
                  {activeTab === 'yield' && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-300">APY</span>
                      <span className="font-semibold text-green-500">8.7%</span>
                    </div>
                  )}
                </div>

                <Button 
                  className="w-full bg-btb-primary hover:bg-btb-primary-dark text-white"
                  disabled={!isConnected || !amount || parseFloat(amount) <= 0}
                >
                  {activeTab === 'buy' ? 'Buy BTB' : activeTab === 'sell' ? 'Sell BTB' : 'Stake for Yield'}
                </Button>
              </div>
            </Card>
          </div>
        </div>

        {/* Features Section */}
        <div className="mb-16">
          <div className="card">
            <h2 className="text-2xl font-bold text-btb-primary mb-6">Trading Features</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
                <div className="flex items-center mb-4">
                  <ArrowsRightLeftIcon className="h-6 w-6 text-btb-primary mr-2" />
                  <h3 className="text-lg font-semibold">Instant Swaps</h3>
                </div>
                <p className="text-gray-600 dark:text-gray-300">
                  Instantly swap between BTB tokens and other cryptocurrencies with minimal slippage.
                </p>
              </div>
              <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
                <div className="flex items-center mb-4">
                  <CurrencyDollarIcon className="h-6 w-6 text-btb-primary mr-2" />
                  <h3 className="text-lg font-semibold">Yield Farming</h3>
                </div>
                <p className="text-gray-600 dark:text-gray-300">
                  Stake your BTB tokens to earn passive income with competitive APY rates.
                </p>
              </div>
              <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
                <div className="flex items-center mb-4">
                  <ChartBarIcon className="h-6 w-6 text-btb-primary mr-2" />
                  <h3 className="text-lg font-semibold">Price Analytics</h3>
                </div>
                <p className="text-gray-600 dark:text-gray-300">
                  Access real-time price charts and market analytics to make informed trading decisions.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Get Started Section */}
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-6">Ready to Start Trading?</h2>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/btb-exchange"
              className="btn-primary"
            >
              Go to Exchange
            </Link>
            <Link
              href="/calculator"
              className="btn-secondary"
            >
              Try IL Calculator
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}