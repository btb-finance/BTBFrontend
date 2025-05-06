'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useAddressProtection } from './useGameContract';

export default function AddressProtection() {
  const { loading, isProtected, error: hookError } = useAddressProtection();
  const [error, setError] = useState<string | null>(hookError);
  
  // Links to Aerodrome for different liquidity pairs
  const liquidityLinks = [
    {
      name: 'MiMo/USDC',
      url: 'https://aerodrome.finance/liquidity',
      icon: '💵'
    },
    {
      name: 'MiMo/cbBTC',
      url: 'https://aerodrome.finance/liquidity',
      icon: '₿'
    },
    {
      name: 'MiMo/WETH',
      url: 'https://aerodrome.finance/liquidity',
      icon: '⟠'
    }
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
      <h2 className="text-2xl font-bold mb-4 text-btb-primary dark:text-btb-primary-light">Protection Status</h2>
      
      {loading ? (
        <div className="py-8 text-center">
          <div className="inline-block animate-spin h-8 w-8 border-4 border-btb-primary border-t-transparent rounded-full mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400">Checking protection status...</p>
        </div>
      ) : (
        <>
          <div className="mb-6 p-5 rounded-lg bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-800/30">
            <div className="flex items-center mb-4">
              <div className={`h-6 w-6 rounded-full ${isProtected ? 'bg-green-500' : 'bg-red-500'} flex items-center justify-center text-white text-xs font-bold mr-3`}>
                {isProtected ? '✓' : '✕'}
              </div>
              <h3 className="text-xl font-bold">
                {isProtected ? 'Your address is protected' : 'Your address is not protected'}
              </h3>
            </div>
            
            <p className="mb-4 text-gray-700 dark:text-gray-300">
              {isProtected ? (
                'Your MiMo tokens are safe from being hunted. To maintain this protection, continue providing liquidity on Aerodrome Exchange.'
              ) : (
                'Your MiMo tokens can be hunted by other players. To protect your tokens, provide liquidity on Aerodrome Exchange with one of the supported pairs.'
              )}
            </p>
            
            {!isProtected && (
              <div className="bg-yellow-100 dark:bg-yellow-900/30 p-3 rounded-lg text-sm text-yellow-800 dark:text-yellow-200 mb-4">
                <p className="flex items-start">
                  <span className="mr-2 mt-0.5">⚠️</span>
                  <span>
                    Without protection, hunters can take MiMo tokens from your wallet during hunting. 
                    Add liquidity to protect your tokens.
                  </span>
                </p>
              </div>
            )}
          </div>
          
          <h3 className="text-xl font-bold mb-4 flex items-center">
            <span className="mr-2">🛡️</span>
            How Protection Works
          </h3>
          
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <h4 className="font-bold mb-2 flex items-center">
                <span className="w-6 h-6 bg-btb-primary text-white rounded-full flex items-center justify-center text-xs mr-2">1</span>
                Automatic Detection
              </h4>
              <p className="text-gray-700 dark:text-gray-300 text-sm">
                When you provide liquidity to approved pools on Aerodrome, your wallet address is automatically 
                added to the "Protected Addresses" list in the game contract.
              </p>
            </div>
            
            <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <h4 className="font-bold mb-2 flex items-center">
                <span className="w-6 h-6 bg-btb-primary text-white rounded-full flex items-center justify-center text-xs mr-2">2</span>
                Hunting Prevention
              </h4>
              <p className="text-gray-700 dark:text-gray-300 text-sm">
                Hunters cannot extract MiMo tokens from protected wallets. Every time a 
                Hunter attempts to hunt, the contract checks if the target address is protected.
              </p>
            </div>
          </div>
          
          <h3 className="text-xl font-bold mb-4">Liquidity Options</h3>
          
          <div className="mb-6">
            <p className="mb-4 text-gray-700 dark:text-gray-300">
              Protect your MiMo tokens by providing liquidity with one of these pairs on Aerodrome:
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {liquidityLinks.map((link, index) => (
                <motion.a
                  key={index}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700 hover:border-btb-primary dark:hover:border-btb-primary-light flex flex-col items-center"
                  whileHover={{ y: -5, transition: { duration: 0.2 } }}
                >
                  <div className="text-3xl mb-2">{link.icon}</div>
                  <div className="font-bold">{link.name}</div>
                  <div className="text-xs text-btb-primary dark:text-btb-primary-light mt-2">
                    Add Liquidity
                  </div>
                </motion.a>
              ))}
            </div>
          </div>
          
          {error && (
            <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded-lg text-sm">
              {error}
            </div>
          )}
        </>
      )}
    </div>
  );
}