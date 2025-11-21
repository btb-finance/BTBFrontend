'use client';

import { useState } from 'react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Rocket, Lock, TrendingUp, ExternalLink } from 'lucide-react';
import { BondingCurveInterface } from './components/BondingCurveInterface';
import { BTBMiningInterface } from './components/BTBMiningInterface';
import { BTBTMintingInterface } from './components/BTBTMintingInterface';
import { HowItWorksModal } from './components/HowItWorksModal';

export default function BTBFinanceComingSoon() {
  const BTB_CONTRACT = '0x888e85C95c84CA41eEf3E4C8C89e8dcE03e41488';
  const TOTAL_SUPPLY = '88,888,888,888';
  const AERODROME_LINK = 'https://aerodrome.finance/swap?from=eth&to=0x888e85c95c84ca41eef3e4c8c89e8dce03e41488&chain0=8453&chain1=8453';
  const BASESCAN_LINK = 'https://basescan.org/token/0x888e85C95c84CA41eEf3E4C8C89e8dcE03e41488';

  return (
    <div className="container mx-auto px-2 sm:px-4 py-8 min-h-screen">
      <div className="max-w-7xl mx-auto w-full">
        {/* Hero Section */}
        <div className="text-center mb-12">
          {/* BTB Mining Interface */}
          <div className="mb-12">
            <BTBMiningInterface />
          </div>

          {/* Bonding Curve Trading Interface */}
          <div className="mb-12">
            <BondingCurveInterface />
          </div>

          {/* BTBT Minting Interface */}
          <div className="mb-12">
            <BTBTMintingInterface />
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

        {/* How to Mine BTB Section */}
        <div className="mb-12">
          <div className="text-center">
            <HowItWorksModal />
          </div>
        </div>

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
