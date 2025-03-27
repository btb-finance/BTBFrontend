'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { 
  ArrowLeftIcon,
  BoltIcon,
  ShoppingCartIcon
} from '@heroicons/react/24/outline';
import StakedBalances from '../components/StakedBalances';
import WolfDetails from '../components/WolfDetails';
import SheepDogInteract from '../components/SheepDogInteract';
import { Button } from '@/app/components/ui/button';
import { SheepEcosystemService } from '@/app/services/sheepEcosystemService';
import { Card } from '@/app/components/ui/card';

// Contract Addresses
const SHEEP_CONTRACT = '0x7bf26dF0E9Db4F70f286c39A9cd3A77Cb7407aa4';
const SHEEPDOG_CONTRACT = '0xa3b5f40a5719208B507F658a11Fb314Ef5e2c0e2';
const WOLF_CONTRACT = '0xf1152a195B93d51457633F96B81B1CF95a96E7A7';

// BuySheep component 
function BuySheep() {
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  
  const handleBuySheep = async () => {
    setIsLoading(true);
    setSuccess(false);
    setError('');
    
    try {
      const sheepService = new SheepEcosystemService();
      await sheepService.connect();
      
      const tx = await sheepService.buySheepDogDistributeRewards();
      await tx.wait();
      
      setSuccess(true);
    } catch (err: any) {
      console.error('Error buying sheep:', err);
      setError(err.reason || err.message || String(err));
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <Card className="p-6 bg-white dark:bg-gray-800 shadow-sm mb-8">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Buy SHEEP with Gas Tokens</h3>
        <ShoppingCartIcon className="w-6 h-6 text-green-500" />
      </div>
      
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
        This function uses the accumulated gas tokens from SheepDog rent payments to buy SHEEP tokens 
        from the market. The purchased SHEEP is then distributed proportionally to all SheepDog share holders.
      </p>
      
      {success && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-md">
          <p className="text-sm text-green-700 dark:text-green-300">
            Successfully bought SHEEP with gas tokens and distributed to SheepDog holders!
          </p>
        </div>
      )}
      
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-md">
          <p className="text-sm text-red-700 dark:text-red-300">
            Error: {error}
          </p>
        </div>
      )}
      
      <div className="flex justify-center">
        <Button
          onClick={handleBuySheep}
          disabled={isLoading}
          className="bg-green-500 hover:bg-green-600"
        >
          {isLoading ? 'Processing...' : 'Buy SHEEP with Gas Tokens'}
        </Button>
      </div>
    </Card>
  );
}

export default function SheepEcosystemInteract() {
  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center">
            <Link href="/sheep-ecosystem" className="flex items-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
              <ArrowLeftIcon className="w-5 h-5 mr-2" />
              <span>Back to Ecosystem</span>
            </Link>
          </div>
        </div>
      </div>
      
      {/* Disclaimer Banner */}
      <div className="bg-amber-500 dark:bg-amber-600">
        <div className="max-w-7xl mx-auto py-2 px-3">
          <div className="flex flex-wrap items-start">
            <div className="flex items-start">
              <span className="flex p-1 rounded-lg bg-amber-800 flex-shrink-0 mt-0.5">
                <svg className="h-3.5 w-3.5 md:h-5 md:w-5 text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </span>
              <p className="ml-2 font-medium text-white text-xs md:text-sm leading-tight">
                Sheep is a 3rd party app on BTB Finance. Please use at your own risk.
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* SHEEP Features Banner */}
      <div className="bg-green-600 dark:bg-green-700">
        <div className="max-w-7xl mx-auto py-2 px-3">
          <div className="flex flex-col sm:flex-row items-center">
            <div className="flex items-center">
              <BoltIcon className="h-5 w-5 text-white" />
              <p className="ml-2 font-medium text-white text-xs md:text-sm">
                SHEEP Ecosystem Interaction
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-grow py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* SHEEP Ecosystem Dashboard Header */}
          <motion.h1
            className="text-3xl font-bold text-gray-900 dark:text-white mb-4 text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            SHEEP Ecosystem Dashboard
          </motion.h1>
          
          <motion.p
            className="text-center text-gray-600 dark:text-gray-300 mb-12 max-w-3xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            Interact with the SHEEP ecosystem contracts, protect your tokens from wolves,
            and manage your investments in one place.
          </motion.p>
          
          {/* User Token Balances Section */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8 text-center">Your SHEEP Ecosystem Tokens</h2>
            <div className="max-w-5xl mx-auto">
              <StakedBalances />
            </div>
          </div>
          
          {/* SheepDog Interaction Section */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8 text-center">SheepDog Protection</h2>
            <div className="max-w-5xl mx-auto">
              <SheepDogInteract />
            </div>
          </div>
          
          {/* BuySheep Section */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8 text-center">SheepDog Rewards</h2>
            <div className="max-w-5xl mx-auto">
              <BuySheep />
            </div>
          </div>
          
          {/* Wolf Details Section */}
          <div className="mb-16">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8 text-center">Your Wolf NFT Collection</h2>
            <div className="max-w-5xl mx-auto">
              <WolfDetails />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 