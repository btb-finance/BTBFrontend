'use client';

import React, { useState } from 'react';
import { useWalletConnection } from '../hooks/useWalletConnection';
import { Alert } from '../components/ui/alert';
import { Card } from '../components/ui/card';
import { InfoIcon, ChartBarIcon, LockIcon, CoinsIcon, ArrowRightLeftIcon } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import BTBStatusPanel from '../components/btb-exchange/BTBStatusPanel';
import TradingInterface from '../components/btb-exchange/TradingInterface';
import KyberSwapExchange from '../components/btb-exchange/KyberSwapExchange';
import BTBManagement from '../components/btb-exchange/BTBManagement';
import FlywheelDiagram from '../components/btb-exchange/FlywheelDiagram';
import TokenPriceDisplay from '../components/btb-exchange/TokenPriceDisplay';

export default function BTBExchangePage() {
  const { isConnected, isCorrectNetwork } = useWalletConnection();

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-block px-4 py-1 mb-4 rounded-full bg-btb-primary/10 border border-btb-primary/20">
              <p className="text-sm font-medium text-btb-primary flex items-center">
                <ChartBarIcon className="h-4 w-4 mr-2" /> Live on Base Network
              </p>
            </div>
            <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-btb-primary to-btb-primary-light bg-clip-text text-transparent">
              BTB Exchange
            </h1>
            <p className="text-lg mb-6 text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Welcome to the BTB Exchange - your gateway to trading BTB tokens on the Base network. Our exchange provides a secure and efficient platform for buying and selling BTB tokens using USDC.
            </p>
            
            {/* Network Check Alert */}
            {isConnected && !isCorrectNetwork && (
              <Alert className="mb-6 bg-yellow-100 border-yellow-400 text-yellow-700">Please switch to the Base network to use the exchange.</Alert>
            )}
            
            {/* Token Price Display */}
            <div className="max-w-2xl mx-auto mb-8">
              <TokenPriceDisplay />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
              <Card className="p-6 bg-white dark:bg-gray-800 border-t-4 border-t-btb-primary transform hover:scale-105 transition-transform duration-300">
                <div className="flex items-center gap-3 mb-2">
                  <ChartBarIcon className="h-6 w-6 text-btb-primary" />
                  <h3 className="font-semibold text-btb-primary">BTB Exchange</h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300">Buy and sell BTB tokens with competitive pricing and low fees</p>
              </Card>
              <Card className="p-6 bg-white dark:bg-gray-800 border-t-4 border-t-btb-primary transform hover:scale-105 transition-transform duration-300">
                <div className="flex items-center gap-3 mb-2">
                  <ArrowRightLeftIcon className="h-6 w-6 text-btb-primary" />
                  <h3 className="font-semibold text-btb-primary">KyberSwap Exchange</h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300">Swap tokens with best price routing from private markets</p>
              </Card>
              <Card className="p-6 bg-white dark:bg-gray-800 border-t-4 border-t-btb-primary transform hover:scale-105 transition-transform duration-300">
                <div className="flex items-center gap-3 mb-2">
                  <LockIcon className="h-6 w-6 text-btb-primary" />
                  <h3 className="font-semibold text-btb-primary">Manage Holdings</h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300">Manage your BTB token holdings and view your balance</p>
              </Card>
            </div>
          </div>

          {/* Main Content */}
          {isConnected ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div>
                <BTBStatusPanel />
                <BTBManagement />
              </div>
              <div className="lg:sticky lg:top-6 h-fit">
                <Tabs defaultValue="btb-exchange" className="w-full">
                  <TabsList className="w-full mb-4">
                    <TabsTrigger value="btb-exchange" className="w-1/2">BTB Exchange</TabsTrigger>
                    <TabsTrigger value="kyberswap" className="w-1/2">KyberSwap</TabsTrigger>
                  </TabsList>
                  <TabsContent value="btb-exchange">
                    <TradingInterface />
                  </TabsContent>
                  <TabsContent value="kyberswap">
                    <KyberSwapExchange />
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto mb-12 text-center">
              <Card className="p-8 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                <h3 className="text-2xl font-bold mb-4 text-btb-primary">Ready to Start Trading?</h3>
                <p className="text-gray-600 dark:text-gray-300">
                  Connect your wallet using the button in the navigation bar to access the BTB Exchange trading interface.
                  You'll be able to trade BTB tokens, manage your holdings, and view real-time market data.
                </p>
              </Card>
            </div>
          )}

          {/* BTB Exchange Flywheel Section */}
          <div className="mt-16">
            <FlywheelDiagram />
          </div>
        </div>
      </div>
    </div>
  );
}
