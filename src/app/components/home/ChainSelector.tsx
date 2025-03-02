'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RocketLaunchIcon } from '@heroicons/react/24/outline';

// Creative phrases to show how BTB works across chains
const phrases = [
  "Seamlessly Trading on",
  "Unleashed on",
  "Natively Built for",
  "Thriving on",
  "Optimized for",
  "Experience BTB on",
  "Trading Revolution on",
  "DeFi Powerhouse on",
  "Secure Trading on",
  "Limitless Trading on",
  "Wherever You Are, We're on",
  "Your Trading Partner on",
  "You Need It, We're on"
];

// List of blockchain networks
const chainNetworks = [
  // From user's list - top 50 chains
  { name: 'BNB Smart Chain', color: 'from-yellow-500 to-yellow-400' },
  { name: 'Ethereum', color: 'from-blue-500 to-purple-500' },
  { name: 'Polygon', color: 'from-purple-600 to-purple-700' },
  { name: 'TRON', color: 'from-red-400 to-red-500' },
  { name: 'Arbitrum', color: 'from-blue-600 to-blue-800' },
  { name: 'Avalanche C-Chain', color: 'from-red-500 to-red-600' },
  { name: 'Base', color: 'from-blue-400 to-blue-600' },
  { name: 'Solana', color: 'from-purple-500 to-blue-500' },
  { name: 'Fantom', color: 'from-blue-700 to-indigo-800' },
  { name: 'OP Mainnet', color: 'from-red-500 to-red-700' },
  { name: 'WAX', color: 'from-amber-400 to-amber-500' },
  { name: 'ZKSync Era', color: 'from-blue-300 to-blue-500' },
  { name: 'Cronos', color: 'from-blue-800 to-indigo-900' },
  { name: 'TON', color: 'from-blue-400 to-blue-500' },
  { name: 'Blast', color: 'from-purple-400 to-purple-600' },
  { name: 'Tezos', color: 'from-blue-500 to-blue-600' },
  { name: 'Linea', color: 'from-teal-500 to-teal-600' },
  { name: 'Kaia', color: 'from-green-500 to-green-600' },
  { name: 'Moonbeam', color: 'from-purple-400 to-purple-500' },
  { name: 'Aurora', color: 'from-green-400 to-green-500' },
  { name: 'Immutable X', color: 'from-pink-500 to-red-500' },
  { name: 'Celo', color: 'from-yellow-300 to-green-500' },
  { name: 'NEAR', color: 'from-teal-400 to-teal-500' },
  { name: 'SKALE', color: 'from-blue-500 to-indigo-500' },
  { name: 'Core', color: 'from-red-600 to-red-700' },
  { name: 'Astar EVM', color: 'from-purple-500 to-blue-500' },
  { name: 'Steem', color: 'from-blue-600 to-blue-700' },
  { name: 'Moonriver', color: 'from-yellow-400 to-amber-500' },
  { name: 'Cardano', color: 'from-blue-500 to-blue-600' },
  { name: 'opBNB', color: 'from-yellow-400 to-yellow-500' },
  { name: 'Hive', color: 'from-red-500 to-red-600' },
  { name: 'Oasys', color: 'from-teal-500 to-teal-600' },
  { name: 'Sei', color: 'from-blue-400 to-indigo-500' },
  { name: 'ZetaChain', color: 'from-purple-500 to-purple-600' },
  { name: 'Ontology', color: 'from-blue-600 to-blue-700' },
  { name: 'Oasis Emerald', color: 'from-green-500 to-green-600' },
  { name: 'Aptos', color: 'from-blue-500 to-blue-600' },
  { name: 'Soneium', color: 'from-green-400 to-blue-400' },
  { name: 'Flow', color: 'from-green-500 to-teal-500' },
  { name: 'XRP Ledger', color: 'from-blue-500 to-blue-600' },
  { name: 'Mantle Network', color: 'from-purple-500 to-purple-600' },
  { name: 'Abstract', color: 'from-gray-600 to-gray-700' },
  { name: 'Algorand', color: 'from-blue-500 to-blue-600' },
  { name: 'Immutable zkEVM', color: 'from-pink-500 to-pink-600' },
  { name: 'Ronin', color: 'from-yellow-400 to-yellow-500' },
  { name: 'TelosEVM', color: 'from-blue-400 to-blue-500' },
  { name: 'Starknet', color: 'from-amber-500 to-amber-600' },
  { name: 'Hedera', color: 'from-teal-500 to-teal-600' },
  { name: 'MultiversX', color: 'from-blue-500 to-blue-600' },
  
  // Special chains the user specified
  { name: 'Kekchain', color: 'from-green-500 to-green-600' },
  { name: 'MUUCHAIN', color: 'from-blue-400 to-cyan-400' },
  { name: 'Tlchain', color: 'from-green-400 to-blue-400' },
  { name: 'Zeniq', color: 'from-blue-300 to-indigo-500' },
  { name: 'Bitindi', color: 'from-indigo-500 to-indigo-700' },
  { name: 'Lung', color: 'from-green-600 to-green-700' },
  { name: 'Bone', color: 'from-amber-300 to-amber-500' },
  { name: 'Lukso', color: 'from-yellow-400 to-orange-500' },
  { name: 'Joltify', color: 'from-yellow-500 to-red-500' },
  
  { name: 'Any Blockchain', color: 'from-btb-primary to-btb-primary-light' },
];

export default function ChainSelector() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentIndex((prevIndex) => (prevIndex + 1) % chainNetworks.length);
        // Change phrase every 4 chain changes
        if ((currentIndex + 1) % 4 === 0) {
          setPhraseIndex((prevIndex) => (prevIndex + 1) % phrases.length);
        }
        setIsAnimating(false);
      }, 500); // Time for exit animation
    }, 2000); // Change every 2 seconds for a more dynamic feel

    return () => clearInterval(interval);
  }, [currentIndex, phrases.length, chainNetworks.length]);

  const currentChain = chainNetworks[currentIndex];
  const currentPhrase = phrases[phraseIndex];

  return (
    <div className="inline-block px-4 py-1 mb-4 rounded-full bg-gradient-to-r from-btb-primary/10 to-btb-primary-light/20 border border-btb-primary/20 backdrop-blur-sm shadow-lg shadow-btb-primary/5">
      <p className="text-sm font-medium text-btb-primary dark:text-btb-primary-light flex items-center">
        <RocketLaunchIcon className="h-4 w-4 mr-2 animate-pulse" /> 
        <AnimatePresence mode="wait">
          <motion.span
            key={`phrase-${phraseIndex}`}
            className="inline-block"
            initial={{ opacity: 0, x: -5 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 5 }}
            transition={{ duration: 0.3 }}
          >
            {currentPhrase}
          </motion.span>
        </AnimatePresence>
        {' '}
        <AnimatePresence mode="wait">
          <motion.span
            key={currentIndex}
            className={`ml-1 font-bold bg-gradient-to-r ${currentChain.color} bg-clip-text text-transparent`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.5 }}
          >
            {currentChain.name}
          </motion.span>
        </AnimatePresence>
      </p>
    </div>
  );
}
