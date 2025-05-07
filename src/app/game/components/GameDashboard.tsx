'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useGame } from './GameContext';
import { useWalletConnection } from '../../hooks/useWalletConnection';
import HunterCard from './HunterCard';
import DepositBear from './DepositBear';
import RedeemBear from './RedeemBear';

// Contract addresses
const GAME_CONTRACT_ADDRESS = '0xc15D784F2B51f2376eCD06CCA0fCA702d4A232A6';
const BEAR_NFT_ADDRESS = '0xbBA5E5416815cdC744651E9E258bdf3506b62A99';

export default function GameDashboard() {
  const { loading, hunters, mimoBalance, isAddressProtected, feedHunter, hunt, refreshData, error, gameContract } = useGame();
  const { provider, address, connectWallet } = useWalletConnection();
  
  const [showDeposit, setShowDeposit] = useState(false);
  const [activeTab, setActiveTab] = useState('hunters');
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  
  const [connectionState, setConnectionState] = useState({
    hasProvider: false,
    hasAddress: false,
    hasContract: false,
  });

  // Clear notification after 5 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Update notification on error
  useEffect(() => {
    if (error) {
      setNotification({
        type: 'error',
        message: error,
      });
    }
  }, [error]);
  
  // Update connection state for debugging
  useEffect(() => {
    setConnectionState({
      hasProvider: !!provider,
      hasAddress: !!address,
      hasContract: !!gameContract,
    });
  }, [provider, address, gameContract]);

  // Handle hunter actions
  const handleFeed = async (hunterId: number) => {
    try {
      await feedHunter(hunterId);
      setNotification({
        type: 'success',
        message: `Successfully fed Hunter #${hunterId}`,
      });
    } catch (err) {
      // Error is handled by the context
    }
  };

  const handleHunt = async (hunterId: number) => {
    try {
      await hunt(hunterId);
      setNotification({
        type: 'success',
        message: `Successfully hunted with Hunter #${hunterId}`,
      });
    } catch (err) {
      // Error is handled by the context
    }
  };

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Game Header */}
      <div className="mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div className="mb-4 md:mb-0">
              <h1 className="text-3xl font-bold text-btb-primary dark:text-btb-primary-light mb-2">
                MiMo Game
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Hunt, earn, and grow your digital ecosystem
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4">
              {/* MiMo Balance */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30 rounded-lg p-4 border border-blue-100 dark:border-blue-800/30 min-w-[200px]">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Your MiMo Balance</div>
                <div className="text-2xl font-bold text-btb-primary dark:text-btb-primary-light">
                  {loading ? '...' : parseFloat(mimoBalance).toLocaleString()}
                </div>
              </div>
              
              {/* Protection Status */}
              <div className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/30 dark:to-blue-900/30 rounded-lg p-4 border border-green-100 dark:border-green-800/30 min-w-[200px]">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Protection Status</div>
                <div className="flex items-center">
                  <div className={`h-3 w-3 rounded-full mr-2 ${isAddressProtected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <div className="text-lg font-bold">
                    {loading ? '...' : isAddressProtected ? 'Protected' : 'Not Protected'}
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Quick Actions */}
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={() => {
                setShowDeposit(true);
                setActiveTab('deposit');
              }}
              className="bg-btb-primary hover:bg-blue-600 text-white py-2 px-4 rounded-lg shadow-sm transition-colors"
            >
              Deposit BEAR NFT
            </button>
            
            <button
              onClick={() => setActiveTab('redeem')}
              className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg shadow-sm transition-colors"
            >
              Redeem BEAR NFT
            </button>
            
            <button
              onClick={refreshData}
              className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 py-2 px-4 rounded-lg shadow-sm transition-colors"
            >
              Refresh Data
            </button>
          </div>
        </div>
      </div>
      
      {/* Notification */}
      {notification && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className={`mb-4 p-4 rounded-lg ${
            notification.type === 'success'
              ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
              : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
          }`}
        >
          {notification.message}
        </motion.div>
      )}
      
      {/* Connection Status Panel */}
      <div className="mb-6 bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-800 dark:to-gray-800/90 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="bg-gradient-to-r from-btb-primary/90 to-blue-600/90 p-3 text-white">
          <h3 className="font-bold text-lg">Connection Status</h3>
        </div>
        
        <div className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className={`${connectionState.hasProvider ? 'bg-green-500' : 'bg-red-500'} h-1`}></div>
              <div className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Wallet Provider</div>
                  <div className={`text-xs px-2 py-0.5 rounded-full ${connectionState.hasProvider ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400' : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400'}`}>
                    {connectionState.hasProvider ? 'Connected' : 'Disconnected'}
                  </div>
                </div>
                <div className="font-semibold flex items-center">
                  {connectionState.hasProvider ? (
                    <svg className="w-4 h-4 text-green-500 mr-1" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-red-500 mr-1" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  )}
                  {connectionState.hasProvider ? 'MetaMask/Wallet' : 'No Provider Found'}
                </div>
              </div>
            </div>
            
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className={`${connectionState.hasAddress ? 'bg-green-500' : 'bg-red-500'} h-1`}></div>
              <div className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Wallet Address</div>
                  <div className={`text-xs px-2 py-0.5 rounded-full ${connectionState.hasAddress ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400' : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400'}`}>
                    {connectionState.hasAddress ? 'Available' : 'Not Available'}
                  </div>
                </div>
                {address ? (
                  <div className="text-xs font-mono bg-gray-100 dark:bg-gray-800 py-1 px-2 rounded truncate">
                    {address}
                  </div>
                ) : (
                  <div className="font-semibold flex items-center">
                    <svg className="w-4 h-4 text-red-500 mr-1" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    No Address Connected
                  </div>
                )}
              </div>
            </div>
            
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className={`${connectionState.hasContract ? 'bg-green-500' : 'bg-red-500'} h-1`}></div>
              <div className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Game Contract</div>
                  <div className={`text-xs px-2 py-0.5 rounded-full ${connectionState.hasContract ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400' : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400'}`}>
                    {connectionState.hasContract ? 'Connected' : 'Not Connected'}
                  </div>
                </div>
                <div className="font-semibold flex items-center">
                  {connectionState.hasContract ? (
                    <svg className="w-4 h-4 text-green-500 mr-1" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-red-500 mr-1" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  )}
                  {connectionState.hasContract ? 'MiMo Game Ready' : 'Contract Unavailable'}
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-3 mb-4">
            <button 
              onClick={connectWallet}
              className="bg-btb-primary hover:bg-blue-600 transition-colors text-white px-4 py-2 rounded-md font-medium flex items-center"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Connect Wallet
            </button>
            
            <button 
              onClick={refreshData}
              className="bg-gray-700 hover:bg-gray-800 transition-colors text-white px-4 py-2 rounded-md font-medium flex items-center"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh Data
            </button>
            
            <button 
              onClick={() => {
                if (window.ethereum) {
                  window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                      chainId: '0x14a34', // 84532 in hex
                      chainName: 'Base Sepolia Testnet',
                      nativeCurrency: {
                        name: 'ETH',
                        symbol: 'ETH',
                        decimals: 18
                      },
                      rpcUrls: ['https://sepolia.base.org'],
                      blockExplorerUrls: ['https://sepolia.basescan.org']
                    }]
                  });
                }
              }}
              className="bg-yellow-600 hover:bg-yellow-700 transition-colors text-white px-4 py-2 rounded-md font-medium flex items-center"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              Switch to Base Sepolia
            </button>
          </div>
          
          <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-md text-xs text-gray-600 dark:text-gray-400 font-mono">
            <div className="flex flex-col sm:flex-row sm:justify-between gap-2">
              <div className="flex items-center">
                <span className="font-semibold mr-1 not-mono">Game:</span>
                <span className="truncate">{GAME_CONTRACT_ADDRESS}</span>
              </div>
              <div className="flex items-center">
                <span className="font-semibold mr-1 not-mono">BEAR:</span>
                <span className="truncate">{BEAR_NFT_ADDRESS}</span>
              </div>
            </div>
            <div className="mt-1 flex items-center">
              <span className="font-semibold mr-1 not-mono">Network:</span>
              <span className="text-green-600 dark:text-green-400 font-semibold">Base Sepolia Testnet</span>
              <span className="ml-2 px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded-full">Chain ID: 84532</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex -mb-px space-x-8">
          <button
            onClick={() => setActiveTab('hunters')}
            className={`py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'hunters'
                ? 'border-btb-primary text-btb-primary dark:text-btb-primary-light'
                : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-300'
            }`}
          >
            My Hunters
          </button>
          
          <button
            onClick={() => {
              setActiveTab('deposit');
              setShowDeposit(true);
            }}
            className={`py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'deposit'
                ? 'border-btb-primary text-btb-primary dark:text-btb-primary-light'
                : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-300'
            }`}
          >
            Deposit
          </button>
          
          <button
            onClick={() => setActiveTab('redeem')}
            className={`py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'redeem'
                ? 'border-btb-primary text-btb-primary dark:text-btb-primary-light'
                : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-300'
            }`}
          >
            Redeem
          </button>
          
          <button
            onClick={() => setActiveTab('protection')}
            className={`py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'protection'
                ? 'border-btb-primary text-btb-primary dark:text-btb-primary-light'
                : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-300'
            }`}
          >
            Protection
          </button>
        </div>
      </div>
      
      {/* Tab Content */}
      <div>
        {/* Hunters Tab */}
        {activeTab === 'hunters' && (
          <>
            {loading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="text-gray-500 dark:text-gray-400">Loading your hunters...</div>
              </div>
            ) : hunters.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🐻</div>
                <h3 className="text-xl font-bold mb-2">No Hunters Yet</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4 max-w-md mx-auto">
                  Start by depositing a BEAR NFT to get your first Hunter and 1,000,000 MiMo tokens!
                </p>
                <button
                  onClick={() => {
                    setShowDeposit(true);
                    setActiveTab('deposit');
                  }}
                  className="bg-btb-primary hover:bg-blue-600 text-white py-2 px-6 rounded-lg transition-colors"
                >
                  Deposit BEAR NFT
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {hunters.map((hunter) => (
                  <HunterCard
                    key={hunter.id}
                    hunter={hunter}
                    onFeed={handleFeed}
                    onHunt={handleHunt}
                  />
                ))}
              </div>
            )}
          </>
        )}
        
        {/* Deposit Tab */}
        {activeTab === 'deposit' && <DepositBear />}
        
        {/* Redeem Tab */}
        {activeTab === 'redeem' && <RedeemBear />}
        
        {/* Protection Tab */}
        {activeTab === 'protection' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-2xl font-bold mb-4 text-btb-primary dark:text-btb-primary-light">Protection</h2>
            
            <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-500 text-yellow-800 dark:text-yellow-200">
              <h3 className="font-bold mb-2">Why Protection Matters</h3>
              <p>
                In the MiMo game, unprotected wallets are at risk of having their MiMo tokens hunted by other players.
                Without protection, you could lose your hard-earned tokens!
              </p>
            </div>
            
            <div className="mb-6">
              <h3 className="text-xl font-bold mb-4 flex items-center text-green-700 dark:text-green-300">
                <span className="mr-2">🛡️</span>
                How to Protect Your MiMo
              </h3>
              
              <p className="mb-4">
                Protect your MiMo tokens from being hunted by providing liquidity on Aerodrome with one of these pairs:
              </p>
              
              <div className="bg-white dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <ul className="space-y-2">
                  <li className="flex items-center p-2 bg-green-50 dark:bg-green-900/20 rounded">
                    <span className="text-green-500 mr-2">✓</span>
                    <span className="font-medium">MiMo/USDC</span>
                  </li>
                  <li className="flex items-center p-2 bg-green-50 dark:bg-green-900/20 rounded">
                    <span className="text-green-500 mr-2">✓</span>
                    <span className="font-medium">MiMo/cbBTC</span>
                  </li>
                  <li className="flex items-center p-2 bg-green-50 dark:bg-green-900/20 rounded">
                    <span className="text-green-500 mr-2">✓</span>
                    <span className="font-medium">MiMo/WETH</span>
                  </li>
                </ul>
              </div>
            </div>
            
            <div className="mt-6 bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-center mb-4">
                <div className={`h-4 w-4 rounded-full ${isAddressProtected ? 'bg-green-500' : 'bg-red-500'} mr-3`}></div>
                <h3 className="font-bold text-lg">
                  {isAddressProtected ? 'Your address is protected' : 'Your address is not protected'}
                </h3>
              </div>
              
              {!isAddressProtected && (
                <a
                  href="https://aerodrome.finance" 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full text-center bg-btb-primary hover:bg-blue-600 text-white py-3 rounded-lg transition-colors"
                >
                  Add Liquidity on Aerodrome
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}