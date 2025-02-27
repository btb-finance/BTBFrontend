'use client';

import React from 'react';
import { useWalletConnection } from '../hooks/useWalletConnection';
import { Button } from '../components/ui/button';
import { Alert } from '../components/ui/alert';
import BTBStatusPanel from '../components/btb-exchange/BTBStatusPanel';
import TradingInterface from '../components/btb-exchange/TradingInterface';
import BTBManagement from '../components/btb-exchange/BTBManagement';
import FlywheelDiagram from '../components/btb-exchange/FlywheelDiagram';

export default function BTBExchangePage() {
  const { isConnected, isCorrectNetwork, connectWallet } = useWalletConnection();

  if (!isConnected) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-3xl font-bold mb-6 text-btb-primary">BTB Exchange</h1>
          <Alert className="mb-6">
            Please connect your wallet to access the BTB Exchange
          </Alert>
          <Button 
            onClick={connectWallet}
            className="bg-btb-primary hover:bg-btb-primary-dark text-white"
          >
            Connect Wallet
          </Button>
        </div>
      </div>
    );
  }

  if (!isCorrectNetwork) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-3xl font-bold mb-6 text-btb-primary">BTB Exchange</h1>
          <Alert className="mb-6">
            Please switch to the Base network to use BTB Exchange
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto mb-12 text-center">
        <h1 className="text-3xl font-bold mb-4 text-btb-primary">BTB Exchange</h1>
        <p className="text-lg mb-6 text-gray-600 dark:text-gray-300">
          Welcome to the BTB Exchange - your gateway to trading BTB tokens on the Base network. Our exchange provides a secure and efficient platform for buying and selling BTB tokens using USDC.
        </p>

        {/* BTB Exchange Flywheel Section */}
        <div className="mt-8 mb-12 text-left p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
          <h2 className="text-2xl font-bold mb-4 text-btb-primary text-center">The BTB Exchange Flywheel: A Complete Ecosystem</h2>
          <p className="mb-6 text-gray-600 dark:text-gray-300">
            Our ecosystem creates a powerful economic flywheel that benefits everyone involved through a unique win-win mechanism:
          </p>

          <div className="space-y-8">
            <div>
              <h3 className="text-xl font-semibold text-btb-primary mb-3">The Core Mechanics</h3>
              
              <div className="space-y-4 pl-4">
                <div>
                  <h4 className="font-bold text-btb-primary-dark">1. Token-Gated Trading Access</h4>
                  <ul className="list-disc pl-5 text-gray-600 dark:text-gray-300">
                    <li><span className="font-semibold text-btb-primary">First step: Users must lock BTB tokens</span> in our contract to trade BTBY/USDC</li>
                    <li>More frequent trading requires more BTB tokens locked</li>
                    <li>This creates exclusive access and steady demand for BTB</li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-bold text-btb-primary-dark">2. BTBY Token & Bonding Curve</h4>
                  <ul className="list-disc pl-5 text-gray-600 dark:text-gray-300">
                    <li>Our exchange trades BTBY tokens using a unique bonding curve mechanism</li>
                    <li><span className="font-semibold">BTBY price always increases</span> regardless of whether users buy OR sell</li>
                    <li>Every purchase <span className="font-semibold">AND every sale</span> increases the price slightly</li>
                    <li>This revolutionary price mechanism ensures continuous upward price trends and protects against volatility</li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-bold text-btb-primary-dark">3. Fee Distribution to Liquidity Providers</h4>
                  <ul className="list-disc pl-5 text-gray-600 dark:text-gray-300">
                    <li><span className="font-semibold">0.1% fee from each trade</span> goes to admin, which is then directed to BTBY/ETH pair on Uniswap</li>
                    <li>LP providers earn significant passive income from exchange activity</li>
                    <li>The more trading volume, the more rewards LP providers earn</li>
                    <li>This incentivizes more people to provide liquidity to BTBY/ETH pair</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-bold text-btb-primary-dark">4. Arbitrage Opportunity</h4>
                  <ul className="list-disc pl-5 text-gray-600 dark:text-gray-300">
                    <li>Traders <span className="font-semibold">keep 100% of their arbitrage profits</span> between our exchange and Uniswap</li>
                    <li>No hidden fees on arbitrage trades</li>
                    <li>BTB token holders receive benefits from all arbitrage activity</li>
                    <li>This creates a unique win-win scenario for all participants</li>
                  </ul>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-xl font-semibold text-btb-primary mb-3">How The Flywheel Spins</h3>
              <p className="mb-3 text-gray-600 dark:text-gray-300">
                This creates a powerful self-reinforcing cycle where everyone benefits:
              </p>
              <ol className="list-decimal pl-5 space-y-1 text-gray-600 dark:text-gray-300">
                <li><span className="font-semibold">Lock BTB Tokens</span> → FIRST STEP: Users must lock BTB tokens to access BTBY/USDC trading</li>
                <li><span className="font-semibold">Trade BTBY/USDC</span> → Trading generates 0.1% fees with our unique bonding curve</li>
                <li><span className="font-semibold">Fees to LP</span> → All trading fees fund BTBY/ETH liquidity providers on Uniswap</li>
                <li><span className="font-semibold">Price Always Rises</span> → BTBY price increases with BOTH buys AND sells</li>
                <li><span className="font-semibold">Arbitrage Profit</span> → Traders keep 100% of arbitrage profits between platforms</li>
                <li><span className="font-semibold">LP Growth</span> → Increased trading fees attract more LP providers to BTBY/ETH</li>
                <li><span className="font-semibold">BTB Holder Rewards</span> → BTB token holders benefit from all arbitrage activity</li>
                <li><span className="font-semibold">Growing Ecosystem</span> → Win-win system drives sustainable growth for all participants</li>
              </ol>
            </div>

            <div>
              <h3 className="text-xl font-semibold text-btb-primary mb-3">Who Wins in This Model?</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <h4 className="font-bold text-btb-primary-dark mb-2">BTB Token Holders Win</h4>
                  <ul className="list-disc pl-5 text-sm text-gray-600 dark:text-gray-300">
                    <li>Their tokens have clear utility (trading access)</li>
                    <li>Benefit from all arbitrage activity</li>
                    <li>Increasing demand for trading drives demand for BTB</li>
                  </ul>
                </div>
                
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <h4 className="font-bold text-btb-primary-dark mb-2">BTBY/ETH Liquidity Providers Win</h4>
                  <ul className="list-disc pl-5 text-sm text-gray-600 dark:text-gray-300">
                    <li>Earn rewards from all 0.1% trading fees</li>
                    <li>Benefit from increased trading volume due to arbitrage</li>
                    <li>Participate in a high-yield liquidity pool</li>
                  </ul>
                </div>
                
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <h4 className="font-bold text-btb-primary-dark mb-2">Traders Win</h4>
                  <ul className="list-disc pl-5 text-sm text-gray-600 dark:text-gray-300">
                    <li>Keep 100% of arbitrage profits</li>
                    <li>Trade on a unique exchange with bonding curve pricing</li>
                    <li>BTBY price always trends upward</li>
                    <li>Participate in a market with growing liquidity</li>
                  </ul>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-xl font-semibold text-btb-primary mb-3">Real-World Example</h3>
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-gray-600 dark:text-gray-300">
                <p className="mb-2">
                  Imagine Alice locks 9,000 BTB to make her second trade of the day. She buys BTBY tokens on our exchange. 
                  The trade generates a 0.1% fee which goes to the admin and is directed to BTBY/ETH LP providers on Uniswap. The bonding curve ensures her 
                  purchase <span className="font-semibold">increases</span> the BTBY price.
                </p>
                <p className="mb-2">
                  Bob notices that BTBY is now available at different prices on different platforms. He buys BTBY on Uniswap and sells it on our 
                  exchange. Uniquely, even though he's <span className="font-semibold">selling</span> BTBY, the price still <span className="font-semibold">increases</span>! 
                  He keeps 100% of his arbitrage profit while also paying the 0.1% fee that rewards LP providers. This transaction 
                  generates more volume and rewards.
                </p>
                <p>
                  Carol, seeing these rewards, decides to provide liquidity to the BTBY/ETH pair on Uniswap, earning a share of all these 
                  fees. The <span className="font-semibold">revolutionary bonding curve</span> where price increases with both buys AND sells creates 
                  a positive cycle that strengthens the entire ecosystem. Meanwhile, all BTB token holders benefit from this increased activity.
                </p>
              </div>
              <p className="mt-4 italic text-center text-gray-600 dark:text-gray-300">
                This flywheel creates aligned incentives where each participant's actions benefit the entire system, 
                creating a win-win scenario and sustainable growth for the BTB ecosystem.
              </p>
            </div>
            <FlywheelDiagram />
            
            <div className="text-center mt-6">
              <Button 
                className="bg-btb-primary hover:bg-btb-primary-dark text-white px-6"
                onClick={() => window.open('https://docs.btb.finance/exchange-flywheel', '_blank')}
              >
                Learn More About The BTB Exchange Flywheel
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
            <h3 className="font-semibold mb-2 text-btb-primary">Trade BTB Tokens</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">Buy and sell BTB tokens with competitive pricing and low fees</p>
          </div>
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
            <h3 className="font-semibold mb-2 text-btb-primary">Manage Holdings</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">Deposit, withdraw, and track your BTB token balance</p>
          </div>
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
            <h3 className="font-semibold mb-2 text-btb-primary">Real-time Quotes</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">Get instant price quotes and execute trades seamlessly</p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <BTBStatusPanel />
          <div className="mt-6">
            <BTBManagement />
          </div>
        </div>
        <div>
          <TradingInterface />
        </div>
      </div>
    </div>
  );
}
