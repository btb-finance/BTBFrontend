'use client';

import React, { useState, useEffect } from 'react';
import { useWalletConnection } from '../hooks/useWalletConnection';
import { Alert } from '../components/ui/alert';
import { Card } from '../components/ui/card';
import { ChartBarIcon, LockIcon, CoinsIcon, ArrowRightLeftIcon, TrendingUpIcon, ShieldIcon } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import LarryStatusPanel from './components/LarryStatusPanel';
import TradingInterface from './components/TradingInterface';
import LeverageInterface from './components/LeverageInterface';
import LoansManagement from './components/LoansManagement';
import StabilityDiagram from './components/StabilityDiagram';
import PriceDisplay from './components/PriceDisplay';

export default function LarryEcosystemPage() {
  const { isConnected } = useWalletConnection();
  const [isCorrectNetwork, setIsCorrectNetwork] = useState(true);

  // Check if we're on Base network (chainId 8453)
  useEffect(() => {
    const checkNetwork = async () => {
      if (typeof window !== 'undefined' && (window as any).ethereum) {
        try {
          const chainId = await (window as any).ethereum.request({ method: 'eth_chainId' });
          setIsCorrectNetwork(chainId === '0x2105'); // 0x2105 is Base network
        } catch (error) {
          console.error('Error checking network:', error);
        }
      }
    };
    
    checkNetwork();

    // Listen for network changes
    if ((window as any).ethereum) {
      (window as any).ethereum.on('chainChanged', checkNetwork);
    }

    return () => {
      if ((window as any).ethereum) {
        (window as any).ethereum.removeListener('chainChanged', checkNetwork);
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-block px-4 py-1 mb-4 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <p className="text-sm font-medium text-emerald-600 flex items-center">
                <ChartBarIcon className="h-4 w-4 mr-2" /> Live on Base Network
              </p>
            </div>
            <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-emerald-600 to-emerald-400 bg-clip-text text-transparent">
              Larry Ecosystem
            </h1>
            <p className="text-lg mb-6 text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Welcome to Larry - The rebase-less stability token. Trade, leverage, and borrow against LARRY with our innovative stability mechanism.
            </p>
            
            {/* Network Check Alert */}
            {isConnected && !isCorrectNetwork && (
              <Alert className="mb-6 bg-yellow-100 border-yellow-400 text-yellow-700">Please switch to Base Network to use the Larry Ecosystem.</Alert>
            )}
            
            {/* Price Display */}
            <div className="max-w-2xl mx-auto mb-8">
              <PriceDisplay />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
              <Card className="p-6 bg-white dark:bg-gray-800 border-t-4 border-t-emerald-500 transform hover:scale-105 transition-transform duration-300">
                <div className="flex items-center gap-3 mb-2">
                  <TrendingUpIcon className="h-6 w-6 text-emerald-500" />
                  <h3 className="font-semibold text-emerald-600">Trade</h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300">Buy and sell LARRY with ETH</p>
              </Card>
              <Card className="p-6 bg-white dark:bg-gray-800 border-t-4 border-t-emerald-500 transform hover:scale-105 transition-transform duration-300">
                <div className="flex items-center gap-3 mb-2">
                  <ArrowRightLeftIcon className="h-6 w-6 text-emerald-500" />
                  <h3 className="font-semibold text-emerald-600">Leverage</h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300">Open leveraged positions up to 100x</p>
              </Card>
              <Card className="p-6 bg-white dark:bg-gray-800 border-t-4 border-t-emerald-500 transform hover:scale-105 transition-transform duration-300">
                <div className="flex items-center gap-3 mb-2">
                  <LockIcon className="h-6 w-6 text-emerald-500" />
                  <h3 className="font-semibold text-emerald-600">Borrow</h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300">Borrow ETH against LARRY collateral</p>
              </Card>
              <Card className="p-6 bg-white dark:bg-gray-800 border-t-4 border-t-emerald-500 transform hover:scale-105 transition-transform duration-300">
                <div className="flex items-center gap-3 mb-2">
                  <ShieldIcon className="h-6 w-6 text-emerald-500" />
                  <h3 className="font-semibold text-emerald-600">Stable Price</h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300">Price can only go up, never down</p>
              </Card>
            </div>
          </div>

          {/* Main Content */}
          {isConnected ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div>
                <LarryStatusPanel />
                <LoansManagement />
              </div>
              <div className="lg:sticky lg:top-6 h-fit">
                <Tabs defaultValue="trade" className="w-full">
                  <TabsList className="w-full mb-4">
                    <TabsTrigger value="trade" className="w-1/3">Trade</TabsTrigger>
                    <TabsTrigger value="leverage" className="w-1/3">Leverage</TabsTrigger>
                    <TabsTrigger value="borrow" className="w-1/3">Borrow</TabsTrigger>
                  </TabsList>
                  <TabsContent value="trade">
                    <TradingInterface />
                  </TabsContent>
                  <TabsContent value="leverage">
                    <LeverageInterface />
                  </TabsContent>
                  <TabsContent value="borrow">
                    <TradingInterface mode="borrow" />
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto mb-12 text-center">
              <Card className="p-8 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                <h3 className="text-2xl font-bold mb-4 text-emerald-600">Ready to Start Trading?</h3>
                <p className="text-gray-600 dark:text-gray-300">
                  Connect your wallet using the button in the navigation bar to access the Larry Ecosystem.
                  You'll be able to trade LARRY tokens, open leveraged positions, and manage loans.
                </p>
              </Card>
            </div>
          )}

          {/* Stability Mechanism Section */}
          <div className="mt-16">
            <StabilityDiagram />
          </div>
        </div>
      </div>
    </div>
  );
}