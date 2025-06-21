'use client';

import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useGame } from './GameContext';

const FloatingAnimation = () => {
  return (
    <style jsx global>{`
      @keyframes float {
        0% { transform: translateY(0px); }
        50% { transform: translateY(-10px); }
        100% { transform: translateY(0px); }
      }
    `}</style>
  );
};

export default function GameOverview() {
  const { gameContract, mimoToken, hunters, mimoBalance, loading, refreshData } = useGame();
  
  const [gameStats, setGameStats] = useState({
    basePower: '0',
    growthRate: '0',
    huntCooldown: '0',
    lifespan: '0',
    missedFeedingPenalty: '0',
    recoveryPeriod: '0',
    hibernationThreshold: '0',
    depositMimoReward: '0',
    redemptionMimoAmount: '0',
    redemptionFeePercentage: '0',
    ownerRewardPercentage: '0',
    burnPercentage: '0',
    liquidityPercentage: '0',
    totalHunters: '0',
    mimoTokenSupply: '0',
  });
  
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadGameStats = async () => {
      if (!gameContract || !mimoToken) return;
      
      setIsLoading(true);
      try {
        const [
          basePower,
          growthRate,
          huntCooldown,
          lifespan,
          missedFeedingPenalty,
          recoveryPeriod,
          hibernationThreshold,
          depositMimoReward,
          redemptionMimoAmount,
          redemptionFeePercentage,
          totalSupply,
          totalHunters,
          ownerRewardPercentage,
          burnPercentage,
          liquidityPercentage
        ] = await Promise.all([
          gameContract.BASE_POWER(),
          gameContract.GROWTH_RATE(),
          gameContract.HUNT_COOLDOWN(),
          gameContract.LIFESPAN(),
          gameContract.MISSED_FEEDING_PENALTY(),
          gameContract.RECOVERY_PERIOD(),
          gameContract.HIBERNATION_THRESHOLD(),
          gameContract.DEPOSIT_MIMO_REWARD(),
          gameContract.REDEMPTION_MIMO_AMOUNT(),
          gameContract.REDEMPTION_FEE_PERCENTAGE(),
          mimoToken.totalSupply(),
          gameContract.totalSupply(),
          gameContract.ownerRewardPercentage(),
          gameContract.burnPercentage(),
          gameContract.liquidityPercentage()
        ]);
        
        setGameStats({
          basePower: ethers.utils.formatUnits(basePower, 18),
          growthRate: growthRate.toString(),
          huntCooldown: (huntCooldown.toNumber() / 3600).toFixed(1), // Convert seconds to hours
          lifespan: (lifespan.toNumber() / 86400).toFixed(1), // Convert seconds to days
          missedFeedingPenalty: missedFeedingPenalty.toString(),
          recoveryPeriod: (recoveryPeriod.toNumber() / 3600).toFixed(1), // Convert seconds to hours
          hibernationThreshold: hibernationThreshold.toString(),
          depositMimoReward: ethers.utils.formatUnits(depositMimoReward, 18),
          redemptionMimoAmount: ethers.utils.formatUnits(redemptionMimoAmount, 18),
          redemptionFeePercentage: redemptionFeePercentage.toString(),
          ownerRewardPercentage: ownerRewardPercentage.toString(),
          burnPercentage: burnPercentage.toString(),
          liquidityPercentage: liquidityPercentage.toString(),
          totalHunters: totalHunters.toString(),
          mimoTokenSupply: ethers.utils.formatUnits(totalSupply, 18),
        });
      } catch (error) {
        console.error("Error loading game stats:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadGameStats();
  }, [gameContract, mimoToken, refreshData]);

  // Format number with commas
  const formatNumber = (value: string, decimals = 2) => {
    const num = parseFloat(value);
    if (isNaN(num)) return '0';
    
    if (num > 1000000) {
      return (num / 1000000).toFixed(decimals) + 'M';
    } else if (num > 1000) {
      return (num / 1000).toFixed(decimals) + 'K';
    }
    
    // If the number has decimal places
    if (value.includes('.')) {
      const parts = value.split('.');
      const formattedWhole = parseInt(parts[0]).toLocaleString();
      return `${formattedWhole}.${parts[1].substring(0, decimals)}`;
    }
    
    return parseInt(value).toLocaleString();
  };

  return (
    <div className="bg-gradient-to-br from-white to-blue-50 dark:from-gray-800 dark:to-gray-800/90 rounded-xl overflow-hidden shadow-xl border border-blue-100 dark:border-blue-800/30">
      <FloatingAnimation />
      {/* Enhanced Card Header */}
      <div className="relative">
        <div className="h-28 bg-gradient-to-r from-purple-600 via-pink-500 to-orange-500 relative overflow-hidden">
          {/* Enhanced animated particle effects in header */}
          <div className="absolute inset-0">
            {[...Array(20)].map((_, i) => (
              <div 
                key={i}
                className={`absolute rounded-full ${i % 4 === 0 ? 'bg-yellow-300/40' : i % 4 === 1 ? 'bg-white/30' : i % 4 === 2 ? 'bg-pink-300/40' : 'bg-purple-300/40'}`}
                style={{
                  width: Math.random() * 8 + 3 + 'px',
                  height: Math.random() * 8 + 3 + 'px',
                  left: Math.random() * 100 + '%',
                  top: Math.random() * 100 + '%',
                  animation: `float ${Math.random() * 5 + 4}s ease-in-out infinite`,
                  animationDelay: `${Math.random() * 3}s`
                }}
              />
            ))}
          </div>
          
          {/* Animated gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent power-charge-animation"></div>
          
          {/* Enhanced Title */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
            <div className="text-white font-extrabold text-3xl bg-clip-text text-transparent bg-gradient-to-r from-white via-yellow-200 to-orange-300">
              Game Overview
            </div>
            <div className="text-white/80 text-sm mt-2 font-medium">🐻 BEAR Hunter Ecosystem 🎯</div>
          </div>
          
          {/* Gaming-style corner decorations */}
          <div className="absolute top-2 left-2">
            <div className="w-8 h-8 border-l-2 border-t-2 border-white/60"></div>
          </div>
          <div className="absolute top-2 right-2">
            <div className="w-8 h-8 border-r-2 border-t-2 border-white/60"></div>
          </div>
          <div className="absolute bottom-2 left-2">
            <div className="w-8 h-8 border-l-2 border-b-2 border-white/60"></div>
          </div>
          <div className="absolute bottom-2 right-2">
            <div className="w-8 h-8 border-r-2 border-b-2 border-white/60"></div>
          </div>
        </div>
        
        <div className="absolute -bottom-12 left-6">
          <div className="relative rounded-full h-24 w-24 border-4 border-white dark:border-gray-800 bg-gradient-to-br from-yellow-400 via-orange-500 to-red-600 flex items-center justify-center shadow-2xl animate-gaming-pulse">
            {/* Power level indicator ring */}
            <div className="absolute inset-0 rounded-full border-2 border-transparent bg-gradient-to-r from-purple-400 to-pink-400 opacity-60"></div>
            <div className="absolute inset-1 rounded-full bg-gradient-to-br from-yellow-400 via-orange-500 to-red-600"></div>
            <span className="text-5xl relative z-10">🎮</span>
          </div>
        </div>
      </div>
      
      {/* Card Content */}
      <div className="pt-14 px-6 pb-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin mb-4"></div>
            <p className="text-gray-500 dark:text-gray-400">Loading game data...</p>
          </div>
        ) : (
          <>
            {/* Your Account Stats */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">Your Account</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white/70 dark:bg-gray-700/30 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center mb-2">
                    <div className="rounded-full bg-blue-100 dark:bg-blue-900/50 p-2 mr-3">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">MiMo Balance</div>
                      <div className="text-xl font-bold text-gray-800 dark:text-gray-100">{formatNumber(mimoBalance)}</div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    MiMo tokens are earned by hunting and can be used to redeem BEAR NFTs.
                  </div>
                </div>
                
                <div className="bg-white/70 dark:bg-gray-700/30 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center mb-2">
                    <div className="rounded-full bg-indigo-100 dark:bg-indigo-900/50 p-2 mr-3">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-500" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M13 7H7v6h6V7z" />
                        <path fillRule="evenodd" d="M7 2a1 1 0 012 0v1h2V2a1 1 0 112 0v1h2a2 2 0 012 2v2h1a1 1 0 110 2h-1v2h1a1 1 0 110 2h-1v2a2 2 0 01-2 2h-2v1a1 1 0 11-2 0v-1H9v1a1 1 0 11-2 0v-1H5a2 2 0 01-2-2v-2H2a1 1 0 110-2h1V9H2a1 1 0 010-2h1V5a2 2 0 012-2h2V2zM5 5h10v10H5V5z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">Active Hunters</div>
                      <div className="text-xl font-bold text-gray-800 dark:text-gray-100">{hunters.length}</div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Hunters gain power when fed and can be used to hunt for MiMo tokens.
                  </div>
                </div>
              </div>
            </div>
            
            {/* Game Economy Stats */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">Game Economy</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-white/70 dark:bg-gray-700/30 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="text-sm text-gray-500 dark:text-gray-400">Total Hunters</div>
                  <div className="text-xl font-bold text-gray-800 dark:text-gray-100">{formatNumber(gameStats.totalHunters, 0)}</div>
                </div>
                
                <div className="bg-white/70 dark:bg-gray-700/30 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="text-sm text-gray-500 dark:text-gray-400">MiMo Supply</div>
                  <div className="text-xl font-bold text-gray-800 dark:text-gray-100">{formatNumber(gameStats.mimoTokenSupply)}</div>
                </div>
                
                <div className="bg-white/70 dark:bg-gray-700/30 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="text-sm text-gray-500 dark:text-gray-400">BEAR Redemption Cost</div>
                  <div className="text-xl font-bold text-gray-800 dark:text-gray-100">{formatNumber(gameStats.redemptionMimoAmount)} MiMo</div>
                </div>
              </div>
            </div>
            
            {/* Hunter Stats */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">Hunter Stats</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-white/70 dark:bg-gray-700/30 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="text-sm text-gray-500 dark:text-gray-400">Base Power</div>
                  <div className="text-xl font-bold text-gray-800 dark:text-gray-100">{formatNumber(gameStats.basePower)}</div>
                </div>
                
                <div className="bg-white/70 dark:bg-gray-700/30 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="text-sm text-gray-500 dark:text-gray-400">Hunt Cooldown</div>
                  <div className="text-xl font-bold text-gray-800 dark:text-gray-100">{gameStats.huntCooldown} hours</div>
                </div>
                
                <div className="bg-white/70 dark:bg-gray-700/30 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="text-sm text-gray-500 dark:text-gray-400">Hunter Lifespan</div>
                  <div className="text-xl font-bold text-gray-800 dark:text-gray-100">{gameStats.lifespan} days</div>
                </div>
              </div>
            </div>
            
            {/* Advanced Stats (Collapsible) */}
            <div className="mb-2">
              <button 
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full flex justify-between items-center p-3 bg-gray-100 dark:bg-gray-700/50 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700/80 transition duration-200"
              >
                <span className="font-medium">Advanced Game Statistics</span>
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className={`h-5 w-5 transition-transform duration-200 ${showAdvanced ? 'transform rotate-180' : ''}`} 
                  viewBox="0 0 20 20" 
                  fill="currentColor"
                >
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
              
              {showAdvanced && (
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="bg-white/70 dark:bg-gray-700/30 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="text-sm text-gray-500 dark:text-gray-400">Growth Rate</div>
                    <div className="text-lg font-bold text-gray-800 dark:text-gray-100">{gameStats.growthRate}</div>
                  </div>
                  
                  <div className="bg-white/70 dark:bg-gray-700/30 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="text-sm text-gray-500 dark:text-gray-400">Missed Feeding Penalty</div>
                    <div className="text-lg font-bold text-gray-800 dark:text-gray-100">{gameStats.missedFeedingPenalty}</div>
                  </div>
                  
                  <div className="bg-white/70 dark:bg-gray-700/30 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="text-sm text-gray-500 dark:text-gray-400">Recovery Period</div>
                    <div className="text-lg font-bold text-gray-800 dark:text-gray-100">{gameStats.recoveryPeriod} hours</div>
                  </div>
                  
                  <div className="bg-white/70 dark:bg-gray-700/30 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="text-sm text-gray-500 dark:text-gray-400">Hibernation Threshold</div>
                    <div className="text-lg font-bold text-gray-800 dark:text-gray-100">{gameStats.hibernationThreshold}</div>
                  </div>
                  
                  <div className="bg-white/70 dark:bg-gray-700/30 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="text-sm text-gray-500 dark:text-gray-400">Deposit MiMo Reward</div>
                    <div className="text-lg font-bold text-gray-800 dark:text-gray-100">{formatNumber(gameStats.depositMimoReward)}</div>
                  </div>
                  
                  <div className="bg-white/70 dark:bg-gray-700/30 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="text-sm text-gray-500 dark:text-gray-400">Redemption Fee</div>
                    <div className="text-lg font-bold text-gray-800 dark:text-gray-100">{gameStats.redemptionFeePercentage}%</div>
                  </div>
                  
                  <div className="bg-white/70 dark:bg-gray-700/30 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="text-sm text-gray-500 dark:text-gray-400">Owner Reward %</div>
                    <div className="text-lg font-bold text-gray-800 dark:text-gray-100">{gameStats.ownerRewardPercentage}%</div>
                  </div>
                  
                  <div className="bg-white/70 dark:bg-gray-700/30 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="text-sm text-gray-500 dark:text-gray-400">Burn %</div>
                    <div className="text-lg font-bold text-gray-800 dark:text-gray-100">{gameStats.burnPercentage}%</div>
                  </div>
                  
                  <div className="bg-white/70 dark:bg-gray-700/30 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="text-sm text-gray-500 dark:text-gray-400">Liquidity %</div>
                    <div className="text-lg font-bold text-gray-800 dark:text-gray-100">{gameStats.liquidityPercentage}%</div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Game Instructions */}
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800/30">
              <h4 className="font-medium text-blue-700 dark:text-blue-300 mb-3 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                How To Play
              </h4>
              <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-2">
                <li className="flex items-start">
                  <span className="inline-block w-5 h-5 bg-blue-500 dark:bg-blue-600 rounded-full text-white text-xs flex items-center justify-center mr-2 mt-0.5">1</span>
                  <span>Deposit BEAR NFTs to create Hunters. Each Hunter has a base power level and lifespan.</span>
                </li>
                <li className="flex items-start">
                  <span className="inline-block w-5 h-5 bg-blue-500 dark:bg-blue-600 rounded-full text-white text-xs flex items-center justify-center mr-2 mt-0.5">2</span>
                  <span>Feed your Hunters daily to increase their power and prevent hibernation. Missing feedings reduces power.</span>
                </li>
                <li className="flex items-start">
                  <span className="inline-block w-5 h-5 bg-blue-500 dark:bg-blue-600 rounded-full text-white text-xs flex items-center justify-center mr-2 mt-0.5">3</span>
                  <span>Use your Hunters to hunt for MiMo tokens. More powerful Hunters earn more tokens.</span>
                </li>
                <li className="flex items-start">
                  <span className="inline-block w-5 h-5 bg-blue-500 dark:bg-blue-600 rounded-full text-white text-xs flex items-center justify-center mr-2 mt-0.5">4</span>
                  <span>Spend {formatNumber(gameStats.redemptionMimoAmount)} MiMo tokens to redeem a new BEAR NFT.</span>
                </li>
              </ul>
            </div>
            
            {/* Refresh Button */}
            <div className="mt-6 flex justify-center">
              <button
                onClick={() => refreshData()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition duration-200 flex items-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                </svg>
                Refresh Data
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
} 