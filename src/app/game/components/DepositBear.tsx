'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ethers } from 'ethers';
import { useGame } from './GameContext';

// Contract addresses
const BEAR_NFT_ADDRESS = '0x4AF11c8ea29039b9F169DBB08Bf6B794EB45BB7a';

export default function DepositBear() {
  const { depositBear, refreshData } = useGame();
  
  const [loading, setLoading] = useState(true);
  const [bearNFTs, setBearNFTs] = useState<number[]>([]);
  const [selectedBearId, setSelectedBearId] = useState<number | null>(null);
  const [isDepositing, setIsDepositing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Load BEAR NFTs directly
  useEffect(() => {
    const loadBearNFTs = async () => {
      setLoading(true);
      try {
        console.log("Loading BEAR NFTs...");
        if (typeof window.ethereum === 'undefined') {
          console.log("No ethereum provider found");
          setError("No wallet detected. Please connect your wallet.");
          setLoading(false);
          return;
        }
        
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const accounts = await provider.listAccounts();
        
        if (!accounts || accounts.length === 0) {
          console.log("No accounts found");
          setError("Please connect your wallet first.");
          setLoading(false);
          return;
        }

        console.log("Connected account:", accounts[0]);
        
        // Basic ERC721 interface for BEAR NFT
        const bearContract = new ethers.Contract(
          BEAR_NFT_ADDRESS,
          [
            'function balanceOf(address owner) view returns (uint256)',
            'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)'
          ],
          provider
        );
        
        // Get BEAR NFTs owned by the user
        try {
          const balance = await bearContract.balanceOf(accounts[0]);
          console.log("BEAR NFT balance:", balance.toString());
          
          const nftIds = [];
          for (let i = 0; i < balance.toNumber(); i++) {
            try {
              const tokenId = await bearContract.tokenOfOwnerByIndex(accounts[0], i);
              nftIds.push(tokenId.toNumber());
            } catch (err) {
              console.error("Error getting BEAR token ID:", err);
            }
          }
          
          console.log("Found BEAR NFTs:", nftIds);
          setBearNFTs(nftIds);
        } catch (err) {
          console.error("Error loading BEAR NFTs:", err);
          setError("Unable to load your BEAR NFTs. This contract might not be deployed on this network.");
        }
      } catch (err) {
        console.error("Error in loadBearNFTs:", err);
        setError("Failed to load BEAR NFTs");
      } finally {
        setLoading(false);
      }
    };
    
    loadBearNFTs();
  }, []);

  // Reset messages when bear NFTs change
  useEffect(() => {
    setError(null);
    setSuccess(null);
  }, [bearNFTs]);

  const handleDeposit = async () => {
    if (!selectedBearId) {
      setError("Please select a BEAR NFT to deposit");
      return;
    }
    
    setIsDepositing(true);
    setError(null);
    setSuccess(null);
    
    try {
      await depositBear(selectedBearId);
      setSuccess(`Successfully deposited BEAR #${selectedBearId} and received a Hunter NFT!`);
      setSelectedBearId(null);
      // Refresh data after successful deposit
      refreshData();
    } catch (err: any) {
      console.error("Deposit error:", err);
      setError(err.message || "Failed to deposit BEAR NFT");
    } finally {
      setIsDepositing(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-btb-primary dark:text-btb-primary-light">Deposit BEAR NFT</h2>
        
        <button 
          onClick={() => {
            setLoading(true);
            setBearNFTs([]);
            setError(null);
            
            // Re-run the loading logic
            setTimeout(() => {
              const loadBearNFTs = async () => {
                try {
                  console.log("Reloading BEAR NFTs...");
                  if (typeof window.ethereum === 'undefined') {
                    console.log("No ethereum provider found");
                    setError("No wallet detected. Please connect your wallet.");
                    setLoading(false);
                    return;
                  }
                  
                  const provider = new ethers.providers.Web3Provider(window.ethereum);
                  const accounts = await provider.listAccounts();
                  
                  if (!accounts || accounts.length === 0) {
                    console.log("No accounts found");
                    setError("Please connect your wallet first.");
                    setLoading(false);
                    return;
                  }
            
                  console.log("Connected account:", accounts[0]);
                  
                  // Basic ERC721 interface for BEAR NFT
                  const bearContract = new ethers.Contract(
                    BEAR_NFT_ADDRESS,
                    [
                      'function balanceOf(address owner) view returns (uint256)',
                      'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)'
                    ],
                    provider
                  );
                  
                  // Get BEAR NFTs owned by the user
                  try {
                    const balance = await bearContract.balanceOf(accounts[0]);
                    console.log("BEAR NFT balance:", balance.toString());
                    
                    const nftIds = [];
                    for (let i = 0; i < balance.toNumber(); i++) {
                      try {
                        const tokenId = await bearContract.tokenOfOwnerByIndex(accounts[0], i);
                        nftIds.push(tokenId.toNumber());
                      } catch (err) {
                        console.error("Error getting BEAR token ID:", err);
                      }
                    }
                    
                    console.log("Found BEAR NFTs:", nftIds);
                    setBearNFTs(nftIds);
                  } catch (err) {
                    console.error("Error loading BEAR NFTs:", err);
                    setError("Unable to load your BEAR NFTs. This contract might not be deployed on this network.");
                  }
                } catch (err) {
                  console.error("Error in loadBearNFTs:", err);
                  setError("Failed to load BEAR NFTs");
                } finally {
                  setLoading(false);
                }
              };
              
              loadBearNFTs();
            }, 100);
          }}
          className="text-sm px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
        >
          Reload NFTs
        </button>
      </div>
      
      <div className="mb-6 bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg text-sm text-blue-800 dark:text-blue-200">
        <p className="flex items-start">
          <span className="mr-2 mt-0.5">ℹ️</span>
          <span>
            Deposit your BEAR NFT to create a Hunter with a base power of 10 MiMo.
            You'll also receive 1,000,000 MiMo tokens as an initial reward!
          </span>
        </p>
      </div>
      
      {loading ? (
        <div className="py-8 text-center">
          <div className="inline-block w-8 h-8 border-4 border-btb-primary border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400">
            Loading your BEAR NFTs...
          </p>
        </div>
      ) : bearNFTs.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            {error || "You don't have any BEAR NFTs in your wallet."}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <a 
              href="https://opensea.io" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-btb-primary dark:text-btb-primary-light hover:underline"
            >
              Get BEAR NFTs on OpenSea
            </a>
            
            <button
              onClick={() => {
                // For testing: add mock BEAR NFTs
                setBearNFTs([1, 2, 3]);
              }}
              className="text-sm px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 transition-colors"
            >
              Show Test NFTs
            </button>
          </div>
        </div>
      ) : (
        <>
          <label className="block text-sm font-medium mb-2">
            Select a BEAR NFT to deposit:
          </label>
          
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 mb-6">
            {bearNFTs.map((bearId) => (
              <motion.div
                key={bearId}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`relative cursor-pointer p-3 border-2 rounded-lg ${
                  selectedBearId === bearId 
                    ? 'border-btb-primary bg-blue-50 dark:bg-blue-900/30' 
                    : 'border-gray-200 dark:border-gray-700'
                }`}
                onClick={() => setSelectedBearId(bearId)}
              >
                <div className="h-20 bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center mb-2">
                  <span className="text-3xl">🐻</span>
                </div>
                <div className="text-center font-medium text-sm">BEAR #{bearId}</div>
                
                {selectedBearId === bearId && (
                  <div className="absolute -top-2 -right-2 h-6 w-6 bg-btb-primary text-white rounded-full flex items-center justify-center text-xs">
                    ✓
                  </div>
                )}
              </motion.div>
            ))}
          </div>
          
          <button
            onClick={handleDeposit}
            disabled={isDepositing || !selectedBearId}
            className={`w-full py-3 rounded-lg font-bold text-white ${
              isDepositing || !selectedBearId
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-btb-primary hover:bg-blue-600 transition-colors'
            }`}
          >
            {isDepositing ? 'Depositing...' : 'Deposit BEAR NFT'}
          </button>
        </>
      )}
      
      {error && (
        <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded-lg text-sm">
          {error}
        </div>
      )}
      
      {success && (
        <div className="mt-4 p-3 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded-lg text-sm">
          {success}
        </div>
      )}
    </div>
  );
}