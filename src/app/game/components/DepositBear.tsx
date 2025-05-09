'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ethers } from 'ethers';
import { useGame, BEAR_NFT_ADDRESS } from './GameContext';

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
    <motion.div 
      className="bg-gradient-to-br from-white to-blue-50 dark:from-gray-800 dark:to-gray-800/90 rounded-xl overflow-hidden shadow-xl border border-blue-100 dark:border-blue-800/30"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Card Header */}
      <div className="relative">
        <div className="h-24 bg-gradient-to-r from-btb-primary via-blue-500 to-indigo-600 relative overflow-hidden">
          {/* Animated particle effects in header */}
          <div className="absolute inset-0">
            {[...Array(15)].map((_, i) => (
              <motion.div 
                key={i}
                className="absolute rounded-full bg-white/20"
                style={{
                  width: Math.random() * 6 + 2 + 'px',
                  height: Math.random() * 6 + 2 + 'px',
                  left: Math.random() * 100 + '%',
                  top: Math.random() * 100 + '%',
                }}
                animate={{
                  y: [0, Math.random() * -20 - 5, 0],
                  x: [0, Math.random() * 10 - 5, 0],
                  opacity: [0.2, 0.6, 0.2],
                }}
                transition={{
                  duration: Math.random() * 3 + 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            ))}
          </div>
        </div>
        
        <div className="absolute -bottom-10 left-6">
          <motion.div 
            className="rounded-full h-20 w-20 border-4 border-white dark:border-gray-800 bg-gradient-to-br from-amber-100 to-amber-200 dark:from-amber-700 dark:to-amber-800 flex items-center justify-center shadow-xl"
            animate={{ 
              boxShadow: ["0 10px 25px -15px rgba(251, 191, 36, 0.4)", "0 15px 35px -15px rgba(251, 191, 36, 0.6)", "0 10px 25px -15px rgba(251, 191, 36, 0.4)"]
            }}
            transition={{ 
              duration: 3, 
              repeat: Infinity, 
              ease: "easeInOut" 
            }}
          >
            <motion.span 
              className="text-4xl"
              animate={{ rotate: [0, 10, 0, -10, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            >
              🐻
            </motion.span>
          </motion.div>
        </div>
        
        <div className="absolute top-4 right-4">
          <motion.button 
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
            className="text-sm px-3 py-1 bg-black/30 text-white rounded-full hover:bg-black/40 transition-colors backdrop-blur-sm flex items-center"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
            </svg>
            Reload
          </motion.button>
        </div>
      </div>
      
      {/* Card Content */}
      <div className="pt-14 px-6 pb-6">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-btb-primary to-blue-600 dark:from-btb-primary-light dark:to-blue-400">
            Deposit BEAR NFT
          </h2>
        </div>

        <div className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800/30 relative overflow-hidden">
          <div className="relative z-10 flex items-start">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-btb-primary dark:text-btb-primary-light mr-2 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="text-blue-800 dark:text-blue-200 mb-1 font-medium">
                Become a Hunter and Earn Rewards
              </p>
              <p className="text-sm text-blue-700/80 dark:text-blue-300/80">
                Deposit your BEAR NFT to create a Hunter with a base power of 10 MiMo.
                You'll also receive 1,000,000 MiMo tokens as an initial reward!
              </p>
            </div>
          </div>
          
          {/* Decorative elements */}
          <div className="absolute -right-4 -bottom-4 h-16 w-16 rounded-full bg-blue-400/10 dark:bg-blue-400/5"></div>
          <div className="absolute right-8 -top-6 h-12 w-12 rounded-full bg-indigo-400/10 dark:bg-indigo-400/5"></div>
        </div>
        
        {loading ? (
          <div className="py-10 text-center">
            <div className="flex flex-col items-center">
              <div className="relative mb-6">
                <motion.div 
                  className="inline-block w-16 h-16 border-4 border-btb-primary/30 rounded-full"
                  animate={{ scale: [1, 1.05, 1], rotate: [0, 180, 360] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                ></motion.div>
                <motion.div 
                  className="absolute top-0 left-0 w-16 h-16 border-4 border-transparent border-t-btb-primary border-r-btb-primary rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
                ></motion.div>
                
                {/* Animated dots */}
                <div className="absolute inset-0 flex items-center justify-center">
                  {[...Array(3)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="w-1.5 h-1.5 mx-0.5 bg-btb-primary rounded-full"
                      animate={{
                        y: [0, -6, 0],
                        opacity: [0.5, 1, 0.5]
                      }}
                      transition={{
                        duration: 1,
                        repeat: Infinity,
                        delay: i * 0.2,
                        ease: "easeInOut"
                      }}
                    />
                  ))}
                </div>
              </div>
              
              <motion.p 
                className="text-gray-600 dark:text-gray-300 font-medium"
                animate={{ opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              >
                Searching for your BEAR NFTs
              </motion.p>
              
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">
                Connecting to your wallet...
              </p>
            </div>
          </div>
        ) : bearNFTs.length === 0 ? (
          <div className="py-8 text-center">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-6 mb-6 border border-gray-200 dark:border-gray-700"
            >
              <div className="inline-block p-3 rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <p className="text-gray-600 dark:text-gray-300 mb-4 font-medium">
                {error || "No BEAR NFTs Found"}
              </p>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-5">
                You don't have any BEAR NFTs in your connected wallet. 
                You'll need BEAR NFTs to participate in the game.
              </p>
              
              <div className="flex flex-wrap justify-center gap-3">
                <motion.a 
                  href="https://opensea.io" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-gradient-to-r from-btb-primary to-blue-500 text-white rounded-lg shadow-md hover:shadow-lg flex items-center"
                  whileHover={{ scale: 1.03, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <svg className="h-5 w-5 mr-2" viewBox="0 0 90 90" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <path d="M45 0C20.2 0 0 20.2 0 45C0 69.8 20.2 90 45 90C69.8 90 90 69.8 90 45C90 20.2 69.8 0 45 0ZM22.7 46.2L22.8 46L35.1 26.3C35.4 25.8 36.1 25.9 36.3 26.4C38.9 33.3 41.1 41.8 39.6 47.1C39.1 48.7 38.1 50.8 36.9 52.9C36.7 53.3 36.5 53.7 36.3 54C36.2 54.2 36 54.3 35.8 54.3H23.4C22.8 54.3 22.5 53.6 22.8 53.1L22.7 46.2ZM74.7 54.5C74.7 54.9 74.4 55.2 74 55.2H62.6C62.2 55.2 61.9 54.9 61.9 54.5C61.9 54.3 62 54.1 62.1 54L62.3 53.8C62.3 53.8 65.3 50.3 65.5 50C68.9 45.9 71.2 42.2 71.2 38C71.2 34.9 69.9 32.6 67.1 32.6C64.7 32.6 62.6 34.9 62.6 37.9C62.6 39.5 63.1 40.7 63.7 42.2C63.9 42.7 63.6 43.3 63.1 43.3H55.4C55.1 43.3 54.9 43.1 54.9 42.9C54.6 38.6 57.8 28.2 67.3 28.2C74.3 28.2 79.6 33.5 79.6 39.5C79.6 44.1 77.2 48.7 73.1 54C72.5 54.8 71.8 55.6 71.1 56.5C70.5 57.3 69.7 58.3 69.7 59.3C69.7 60.7 70.4 62 72.1 62C73.5 62 74.4 61.2 75.3 59.8C75.7 59.2 76.4 59.3 76.5 60L77.9 65C78 65.4 77.9 65.7 77.6 66C76.3 67 74.6 67.5 72.5 67.5C67.5 67.5 63.2 64.3 63.2 58.9C63.2 56.8 63.9 54.6 65.2 52.5C65.8 51.4 66.9 50 67.5 49.3C67.9 48.9 68.4 48.1 68.4 47.7C68.4 46.9 67.8 46.3 67 46.3C66 46.3 65.2 47.1 64.8 48.1C64.6 48.6 64.1 48.9 63.6 48.7L56.4 46.5C56 46.4 55.7 46 55.9 45.6C57.9 39.9 61.6 35.5 68.8 35.5C76.4 35.5 79.9 40.3 79.9 45.3C79.9 48.8 78.2 50.3 76.3 51.7L74.5 53C74.2 53.2 74 53.5 74.1 53.8L74.7 54.5Z"/>
                  </svg>
                  Get BEAR NFTs on OpenSea
                </motion.a>
                
                <motion.button
                  onClick={() => {
                    // For testing: add mock BEAR NFTs
                    setBearNFTs([1, 2, 3]);
                  }}
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-500 text-white rounded-lg shadow-md hover:shadow-lg flex items-center"
                  whileHover={{ scale: 1.03, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                    <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                  </svg>
                  Show Test NFTs
                </motion.button>
              </div>
            </motion.div>
          </div>
        ) : (
          <>
            <div className="mb-5">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                Select a BEAR NFT to deposit:
              </label>
              
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 mb-6">
                {bearNFTs.map((bearId) => (
                  <motion.div
                    key={bearId}
                    whileHover={{ y: -5, boxShadow: "0 10px 25px -5px rgba(59, 130, 246, 0.3)" }}
                    whileTap={{ scale: 0.98 }}
                    className={`relative cursor-pointer rounded-xl overflow-hidden transition-all duration-300 border-2 ${
                      selectedBearId === bearId 
                        ? 'border-btb-primary ring-2 ring-btb-primary/30' 
                        : 'border-gray-200 dark:border-gray-700'
                    }`}
                    onClick={() => setSelectedBearId(bearId)}
                  >
                    <div className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20">
                      <div className="h-24 flex items-center justify-center">
                        <motion.div
                          animate={{ 
                            y: [0, -5, 0],
                            rotate: [0, 5, 0, -5, 0]
                          }}
                          transition={{ 
                            duration: 5, 
                            repeat: Infinity, 
                            ease: "easeInOut" 
                          }}
                        >
                          <span className="text-5xl drop-shadow-md">🐻</span>
                        </motion.div>
                      </div>
                      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm p-3 text-center">
                        <div className="font-bold text-btb-primary dark:text-btb-primary-light">BEAR #{bearId}</div>
                      </div>
                    </div>
                    
                    {selectedBearId === bearId && (
                      <motion.div 
                        className="absolute top-2 right-2 h-8 w-8 bg-btb-primary text-white rounded-full flex items-center justify-center"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 500, damping: 15 }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </motion.div>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
            
            <div className="mt-6">
              <motion.button
                onClick={handleDeposit}
                disabled={isDepositing || !selectedBearId}
                className={`w-full py-3 px-4 rounded-xl font-bold text-white shadow-lg flex items-center justify-center ${
                  isDepositing || !selectedBearId
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-btb-primary to-blue-600 hover:from-btb-primary/95 hover:to-blue-700'
                }`}
                whileHover={!isDepositing && selectedBearId ? { y: -2, boxShadow: "0 10px 25px -5px rgba(59, 130, 246, 0.4)" } : {}}
                whileTap={!isDepositing && selectedBearId ? { y: 0, boxShadow: "0 5px 15px -5px rgba(59, 130, 246, 0.4)" } : {}}
              >
                {isDepositing ? (
                  <>
                    <div className="flex items-center justify-center">
                      <div className="relative mr-3">
                        <motion.div 
                          className="w-5 h-5 border-2 border-white/30 rounded-full"
                          animate={{ scale: [1, 1.1, 1] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        />
                        <motion.div 
                          className="absolute top-0 left-0 w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                        />
                      </div>
                      <span className="relative">
                        Depositing BEAR NFT
                        <motion.span 
                          className="absolute"
                          animate={{ 
                            opacity: [0, 1, 0],
                            x: [0, 3, 0]
                          }}
                          transition={{ 
                            duration: 1.5, 
                            repeat: Infinity, 
                            repeatType: "loop"
                          }}
                        >...</motion.span>
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" />
                    </svg>
                    Deposit BEAR NFT
                  </>
                )}
              </motion.button>
              
              <p className="text-sm text-center text-gray-500 dark:text-gray-400 mt-3">
                Deposit is permanent and will mint a new Hunter NFT to your wallet
              </p>
            </div>
          </>
        )}
        
        {error && (
          <motion.div 
            className="mt-5 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 text-red-800 dark:text-red-200 rounded-xl text-sm"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex items-start">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <p>{error}</p>
            </div>
          </motion.div>
        )}
        
        {success && (
          <motion.div 
            className="mt-5 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/30 text-green-800 dark:text-green-200 rounded-xl text-sm"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex items-start">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <p>{success}</p>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}