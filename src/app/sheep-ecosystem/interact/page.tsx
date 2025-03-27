'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { 
  ArrowLeftIcon,
  BoltIcon
} from '@heroicons/react/24/outline';
import StakedBalances from '../components/StakedBalances';
import WolfDetails from '../components/WolfDetails';

// Contract Addresses
const SHEEP_CONTRACT = '0x7bf26dF0E9Db4F70f286c39A9cd3A77Cb7407aa4';
const SHEEPDOG_CONTRACT = '0xa3b5f40a5719208B507F658a11Fb314Ef5e2c0e2';
const WOLF_CONTRACT = '0xf1152a195B93d51457633F96B81B1CF95a96E7A7';

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
                SHEEP Ecosystem Token Tracker
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
            Monitor your SHEEP tokens, WOLF NFTs, and SheepDog shares with our interactive dashboard.
            View your balances, staking status, and protection in real-time.
          </motion.p>
          
          {/* User Token Balances Section */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8 text-center">Your SHEEP Ecosystem Tokens</h2>
            <div className="max-w-5xl mx-auto">
              <StakedBalances />
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