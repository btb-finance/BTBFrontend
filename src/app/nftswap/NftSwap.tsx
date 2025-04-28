'use client';

import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { motion } from 'framer-motion';
import { useWallet } from '../context/WalletContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { ArrowRightIcon, ArrowLeftIcon, ShieldCheckIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline';
import dynamic from 'next/dynamic';
import useNetworkSwitcher from '@/app/hooks/useNetworkSwitcher';

// Define component prop types
type SwapBTBForNFTProps = {
  btbTokenAddress: string;
  nftSwapAddress: string;
  swapRate: string;
};

type SwapNFTForBTBProps = {
  bearNftAddress: string;
  nftSwapAddress: string;
  swapRate: string;
};

type NFTDisplayProps = {
  bearNftAddress: string;
  isConnected: boolean;
};

// Use dynamic imports to avoid hydration issues but with suspense for better loading experience
const SwapBTBForNFT = dynamic<SwapBTBForNFTProps>(() => import('./components/SwapBTBForNFT'), { 
  ssr: false,
  loading: () => <div className="flex justify-center items-center py-8"><div className="h-8 w-8 rounded-full border-2 border-t-transparent border-blue-500 animate-spin"></div></div>
});
const SwapNFTForBTB = dynamic<SwapNFTForBTBProps>(() => import('./components/SwapNFTForBTB'), { 
  ssr: false,
  loading: () => <div className="flex justify-center items-center py-8"><div className="h-8 w-8 rounded-full border-2 border-t-transparent border-blue-500 animate-spin"></div></div>
});
const NFTDisplay = dynamic<NFTDisplayProps>(() => import('./components/NFTDisplay'), { 
  ssr: false,
  loading: () => <div className="flex justify-center items-center py-8"><div className="h-8 w-8 rounded-full border-2 border-t-transparent border-blue-500 animate-spin"></div></div>
});
import nftswapabi from './nftswapabi.json';

// Contract addresses from the parameters
const BTB_TOKEN_ADDRESS = '0xBBF88F780072F5141dE94E0A711bD2ad2c1f83BB';
const BEAR_NFT_ADDRESS = '0x000081733751860A8E5BA00FdCF7000b53E90dDD';
const NFT_SWAP_ADDRESS = '0x9e93eF8aD9c899A7798868FAACfA28276e082903';
const NETWORK = 'BASE'; // Required network for NFT swap

export default function NftSwap() {
  const { address, isConnected, connectWallet } = useWallet();
  const [activeTab, setActiveTab] = useState<'btb-to-nft' | 'nft-to-btb'>('btb-to-nft');
  const [swapRate, setSwapRate] = useState<string>('0');
  const [isLoading, setIsLoading] = useState(true);
  const [contractNFTCount, setContractNFTCount] = useState<number>(0);
  const [swapPaused, setSwapPaused] = useState<boolean>(false);
  const [isCorrectNetwork, setIsCorrectNetwork] = useState<boolean>(false);
  const { switchNetwork, isSwitching, error } = useNetworkSwitcher();

  // Check if user is on the correct network
  const checkNetwork = async () => {
    if (!window.ethereum) return;
    
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum as any);
      const network = await provider.getNetwork();
      // Base network has chainId 8453
      setIsCorrectNetwork(network.chainId === 8453);
    } catch (error) {
      console.error('Error checking network:', error);
      setIsCorrectNetwork(false);
    }
  };

  // Handle network changes
  const handleChainChanged = () => {
    checkNetwork();
  };

  // Fetch contract data
  useEffect(() => {
    const fetchContractData = async () => {
      try {
        setIsLoading(true);
        
        // Create provider - use Web3Provider if connected, otherwise use JsonRpcProvider
        let provider;
        if (isConnected && window.ethereum) {
          provider = new ethers.providers.Web3Provider(window.ethereum as any);
        } else {
          // Fallback to a public RPC provider for Base network when wallet is not connected
          provider = new ethers.providers.JsonRpcProvider('https://mainnet.base.org');
        }
        
        const nftSwapContract = new ethers.Contract(
          NFT_SWAP_ADDRESS,
          nftswapabi,
          provider
        );

        // Always fetch all contract data regardless of connection status
        // Get swap rate
        const rate = await nftSwapContract.getSwapRate();
        setSwapRate(ethers.utils.formatEther(rate));

        // Get contract NFT count
        const nftCount = await nftSwapContract.getContractNFTCount();
        setContractNFTCount(nftCount.toNumber());

        // Check if swap is paused
        const isPaused = await nftSwapContract.swapPaused();
        setSwapPaused(isPaused);

        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching contract data:', error);
        setIsLoading(false);
      }
    };

    fetchContractData();
    checkNetwork();

    // Listen for chain changes
    if (window.ethereum) {
      window.ethereum.on('chainChanged', handleChainChanged);
    }

    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, [isConnected, address]);

  return (
    <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-6">
      <div className="max-w-6xl mx-auto overflow-hidden">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex flex-col md:flex-row justify-between items-start mb-2 sm:mb-4 gap-2">
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-1 md:mb-2">BTB NFT Swap</h1>
              <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm md:text-base mb-2 md:mb-4">
                Swap between BTB tokens and Bear NFTs. Rate: {parseFloat(swapRate).toFixed(3)} BTB per NFT.
              </p>
            </div>
            {isConnected && !isCorrectNetwork && (
              <div className="w-full md:w-auto">
                <Button 
                  onClick={() => switchNetwork('BASE')}
                  disabled={isSwitching}
                  className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2"
                >
                  {isSwitching ? 'Switching...' : 'Switch to Base Network'}
                </Button>
                {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
              </div>
            )}
          </div>

          {/* Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 sm:gap-4 mb-4 sm:mb-6">
          <Card className="overflow-hidden border border-gray-200 dark:border-gray-800 shadow-md">
            <div className="bg-blue-50 dark:bg-blue-900/20 px-4 py-3 border-b border-gray-200 dark:border-gray-800">
              <h3 className="font-semibold text-blue-800 dark:text-blue-300 text-sm">Current Swap Rate</h3>
            </div>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold">{isLoading ? '...' : `${parseFloat(swapRate).toFixed(3)} BTB`}</h3>
                </div>
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                  <CurrencyDollarIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border border-gray-200 dark:border-gray-800 shadow-md">
            <div className="bg-purple-50 dark:bg-purple-900/20 px-4 py-3 border-b border-gray-200 dark:border-gray-800">
              <h3 className="font-semibold text-purple-800 dark:text-purple-300 text-sm">Available NFTs</h3>
            </div>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold">{isLoading ? '...' : contractNFTCount}</h3>
                </div>
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-full">
                  <ShieldCheckIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border border-gray-200 dark:border-gray-800 shadow-md">
            <div className={`${swapPaused ? 'bg-red-50 dark:bg-red-900/20' : 'bg-green-50 dark:bg-green-900/20'} px-4 py-3 border-b border-gray-200 dark:border-gray-800`}>
              <h3 className={`font-semibold ${swapPaused ? 'text-red-800 dark:text-red-300' : 'text-green-800 dark:text-green-300'} text-sm`}>Swap Status</h3>
            </div>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className={`text-2xl font-bold ${swapPaused ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                    {isLoading ? '...' : swapPaused ? 'Paused' : 'Active'}
                  </h3>
                </div>
                <div className={`p-2 ${swapPaused ? 'bg-red-100 dark:bg-red-900/30' : 'bg-green-100 dark:bg-green-900/30'} rounded-full`}>
                  <ShieldCheckIcon className={`h-5 w-5 ${swapPaused ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`} />
                </div>
              </div>
            </CardContent>
          </Card>
          </div>

          {/* Swap Interface */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 sm:gap-4">
          {/* Left Panel - Swap Interface */}
          <div className="lg:col-span-2">
            <Card className="border border-gray-200 dark:border-gray-800 shadow-md">
              <CardHeader className="p-3 sm:p-4">
                <CardTitle>NFT Swap</CardTitle>
                <CardDescription>Exchange BTB tokens for Bear NFTs or vice versa</CardDescription>
              </CardHeader>
              <CardContent className="p-2 sm:p-4">
                {!isConnected ? (
                  <div className="flex flex-col items-center justify-center h-full py-12">
                    <h3 className="text-xl font-bold mb-4">Connect Wallet to Swap</h3>
                    <Button 
                      onClick={connectWallet}
                      size="lg"
                      className="w-full max-w-xs"
                    >
                      Connect Wallet
                    </Button>
                  </div>
                ) : !isCorrectNetwork ? (
                  <div className="flex flex-col items-center justify-center h-full py-12">
                    <h3 className="text-xl font-bold text-amber-600 dark:text-amber-400 mb-4">Wrong Network Detected</h3>
                    <p className="text-gray-700 dark:text-gray-300 text-center font-medium mb-4">
                      Please switch to the Base network to use the NFT swap feature.
                    </p>
                    <Button 
                      onClick={() => switchNetwork('BASE')}
                      disabled={isSwitching}
                      size="lg"
                      className="w-full max-w-xs bg-blue-600 hover:bg-blue-700"
                    >
                      {isSwitching ? 'Switching...' : 'Switch to Base Network'}
                    </Button>
                    {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
                  </div>
                ) : swapPaused ? (
                  <div className="flex flex-col items-center justify-center h-full py-12">
                    <h3 className="text-xl font-bold text-red-600 dark:text-red-400 mb-4">Swap is Currently Paused</h3>
                    <p className="text-gray-700 dark:text-gray-300 text-center font-medium">
                      The NFT swap functionality is temporarily paused. Please check back later.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Swap Type Selector */}
                    <div className="flex justify-center mb-3 sm:mb-4">
                      <div className="inline-flex p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
                        <button
                          onClick={() => setActiveTab('btb-to-nft')}
                          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                            activeTab === 'btb-to-nft'
                              ? 'bg-blue-500 text-white shadow-md'
                              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                          }`}
                        >
                          BTB → NFT
                        </button>
                        <button
                          onClick={() => setActiveTab('nft-to-btb')}
                          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                            activeTab === 'nft-to-btb'
                              ? 'bg-blue-500 text-white shadow-md'
                              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                          }`}
                        >
                          NFT → BTB
                        </button>
                      </div>
                    </div>

                    {/* Swap Interface */}
                    <div className="mt-4">
                      {/* Both components are always rendered but only one is visible */}
                      <div className={activeTab === 'btb-to-nft' ? 'block' : 'hidden'}>
                        <SwapBTBForNFT 
                          btbTokenAddress={BTB_TOKEN_ADDRESS} 
                          nftSwapAddress={NFT_SWAP_ADDRESS} 
                          swapRate={swapRate}
                        />
                      </div>
                      <div className={activeTab === 'nft-to-btb' ? 'block' : 'hidden'}>
                        <SwapNFTForBTB 
                          bearNftAddress={BEAR_NFT_ADDRESS} 
                          nftSwapAddress={NFT_SWAP_ADDRESS} 
                          swapRate={swapRate}
                        />
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Panel - NFT Display */}
          <div className="lg:col-span-1">
            <NFTDisplay 
              bearNftAddress={BEAR_NFT_ADDRESS}
              isConnected={isConnected}
            />
          </div>
        </div>
        </motion.div>
      </div>
    </div>
  );
}
