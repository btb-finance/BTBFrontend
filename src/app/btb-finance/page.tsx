'use client';

import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Sparkles, Rocket, Lock, TrendingUp, ExternalLink, ArrowUpRight, Coins } from 'lucide-react';

export default function BTBFinanceComingSoon() {
  const BTB_CONTRACT = '0x888e85C95c84CA41eEf3E4C8C89e8dcE03e41488';
  const TOTAL_SUPPLY = '88,888,888,888';
  const AERODROME_LINK = 'https://aerodrome.finance/swap?from=eth&to=0x888e85c95c84ca41eef3e4c8c89e8dce03e41488&chain0=8453&chain1=8453';
  const BASESCAN_LINK = 'https://basescan.org/token/0x888e85C95c84CA41eEf3E4C8C89e8dcE03e41488';

  return (
    <div className="container mx-auto px-4 py-8 min-h-screen">
      <div className="max-w-6xl mx-auto w-full">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 mb-6 animate-pulse">
            <Sparkles className="w-10 h-10 text-white" />
          </div>

          <h1 className="text-4xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-purple-600 via-blue-600 to-cyan-600 bg-clip-text text-transparent">
            BTB Token
          </h1>

          <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-400 mb-6">
            Now Live on Base Network
          </p>

          <p className="text-lg text-gray-500 dark:text-gray-500 max-w-2xl mx-auto mb-8">
            Trade BTB on Aerodrome Finance and discover the future of DeFi
          </p>

          {/* Contract and Supply Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto mb-8">
            <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 border-2 border-blue-200 dark:border-blue-800/50">
              <CardContent className="p-6">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Coins className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <h3 className="text-sm font-semibold text-blue-600 dark:text-blue-400 uppercase">Total Supply</h3>
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{TOTAL_SUPPLY}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">BTB Tokens</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 border-2 border-purple-200 dark:border-purple-800/50">
              <CardContent className="p-6">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <ExternalLink className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  <h3 className="text-sm font-semibold text-purple-600 dark:text-purple-400 uppercase">Contract Address</h3>
                </div>
                <p className="text-sm font-mono font-bold text-gray-900 dark:text-gray-100 break-all">{BTB_CONTRACT}</p>
                <a
                  href={BASESCAN_LINK}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-purple-600 dark:text-purple-400 hover:underline mt-1 inline-flex items-center gap-1"
                >
                  View on Basescan <ArrowUpRight className="w-3 h-3" />
                </a>
              </CardContent>
            </Card>
          </div>

          {/* Trade Button */}
          <div className="mb-12">
            <a href={AERODROME_LINK} target="_blank" rel="noopener noreferrer">
              <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-6 text-lg font-bold rounded-xl shadow-lg hover:shadow-xl transition-all">
                <TrendingUp className="w-5 h-5 mr-2" />
                Trade BTB on Aerodrome
                <ExternalLink className="w-5 h-5 ml-2" />
              </Button>
            </a>
          </div>
        </div>

        {/* Feature Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <Card className="border-2 border-purple-200 dark:border-purple-900/50 hover:shadow-xl transition-all">
            <CardContent className="p-6 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 mb-4">
                <Rocket className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Live on Base</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                BTB token is now live and tradable on Base network via Aerodrome Finance
              </p>
            </CardContent>
          </Card>

          <Card className="border-2 border-blue-200 dark:border-blue-900/50 hover:shadow-xl transition-all">
            <CardContent className="p-6 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 mb-4">
                <Lock className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Verified Contract</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Fully verified and transparent smart contract on Basescan
              </p>
            </CardContent>
          </Card>

          <Card className="border-2 border-cyan-200 dark:border-cyan-900/50 hover:shadow-xl transition-all">
            <CardContent className="p-6 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-cyan-100 dark:bg-cyan-900/30 mb-4">
                <TrendingUp className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Growing Ecosystem</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                New use cases and features being developed for the BTB ecosystem
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Status Banner */}
        <Card className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 border-2 border-purple-200 dark:border-purple-800/50">
          <CardContent className="p-8 text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="relative">
                <div className="w-3 h-3 bg-purple-500 rounded-full animate-ping absolute"></div>
                <div className="w-3 h-3 bg-purple-600 rounded-full"></div>
              </div>
              <p className="text-sm font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wide">
                More Use Cases Coming Soon
              </p>
            </div>

            <h2 className="text-2xl font-bold mb-3 text-gray-900 dark:text-gray-100">
              Expanding the BTB Ecosystem
            </h2>

            <p className="text-gray-600 dark:text-gray-400 max-w-xl mx-auto">
              We're building innovative DeFi features and use cases for BTB token.
              Stay tuned for exciting new utilities and opportunities to maximize your BTB holdings.
            </p>
          </CardContent>
        </Card>

        {/* Footer Note */}
        <div className="text-center mt-12">
          <p className="text-sm text-gray-500 dark:text-gray-600">
            Questions or feedback? Stay connected with our community for updates.
          </p>
        </div>
      </div>
    </div>
  );
}
