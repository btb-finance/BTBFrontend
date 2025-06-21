'use client';

import React, { useState, useEffect } from 'react';
import { useGame } from './GameContext';

interface RedeemBearProps {
  onSuccess?: () => void;
}

export default function RedeemBear({ onSuccess }: RedeemBearProps) {
  const { mimoBalance, redeemBear, getRedemptionRequirements, refreshData } = useGame();
  
  const [loading, setLoading] = useState(true);
  const [redemptionAmount, setRedemptionAmount] = useState('0');
  const [redemptionFee, setRedemptionFee] = useState('0');
  const [isPaused, setIsPaused] = useState(false);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Load redemption requirements
  useEffect(() => {
    const loadRequirements = async () => {
      setLoading(true);
      try {
        const requirements = await getRedemptionRequirements();
        setRedemptionAmount(requirements.amount);
        setRedemptionFee(requirements.fee);
        setIsPaused(requirements.paused);
      } catch (err) {
        console.error("Error loading redemption requirements:", err);
        setError('Failed to load redemption requirements');
      } finally {
        setLoading(false);
      }
    };
    
    loadRequirements();
  }, [getRedemptionRequirements]);
  
  // Format number with commas
  const formatNumber = (value: string) => {
    const num = parseFloat(value);
    if (isNaN(num)) return '0';
    
    // If the number has more than 2 decimal places, show only 2
    const hasDecimal = value.includes('.');
    if (hasDecimal) {
      const parts = value.split('.');
      const formattedWhole = parseInt(parts[0]).toLocaleString();
      return `${formattedWhole}.${parts[1].substring(0, 2)}`;
    }
    
    return parseInt(value).toLocaleString();
  };
  
  // Check if user has enough MiMo tokens
  const hasEnoughMimo = parseFloat(mimoBalance) >= parseFloat(redemptionAmount);
  
  // Handle redeem
  const handleRedeem = async () => {
    if (isPaused) {
      setError("Redemption is currently paused");
      return;
    }
    
    if (!hasEnoughMimo) {
      setError(`You need at least ${formatNumber(redemptionAmount)} MiMo tokens to redeem a BEAR NFT`);
      return;
    }
    
    setIsRedeeming(true);
    setError(null);
    setSuccess(null);
    
    try {
      await redeemBear();
      setSuccess("Successfully redeemed a BEAR NFT!");
      
      // Refresh data after redeeming
      refreshData();
      
      // Call onSuccess callback if provided
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: unknown) {
      console.error("Error redeeming BEAR NFT:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to redeem BEAR NFT";
      setError(errorMessage);
    } finally {
      setIsRedeeming(false);
    }
  };

  return (
    <div 
      className="bg-gradient-to-br from-white via-purple-50/30 to-pink-50/20 dark:from-gray-800 dark:via-purple-900/20 dark:to-pink-900/10 rounded-2xl overflow-hidden shadow-2xl border-2 border-gradient-to-r from-purple-400/30 to-pink-400/30 transform transition-all duration-500 opacity-100"
    >
      {/* Enhanced Card Header */}
      <div className="relative">
        <div className="h-28 bg-gradient-to-r from-purple-600 via-pink-500 to-orange-500 relative overflow-hidden">
          {/* Animated particle effects in header */}
          <div className="absolute inset-0">
            {[...Array(15)].map((_, i) => (
              <div 
                key={i}
                className="absolute rounded-full bg-white/20"
                style={{
                  width: Math.random() * 6 + 2 + 'px',
                  height: Math.random() * 6 + 2 + 'px',
                  left: Math.random() * 100 + '%',
                  top: Math.random() * 100 + '%',
                }}
              />
            ))}
          </div>
          
          {/* Enhanced Title */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
            <div className="text-white font-extrabold text-3xl bg-clip-text text-transparent bg-gradient-to-r from-white via-yellow-200 to-orange-300">
              Redeem BEAR NFT
            </div>
            <div className="text-white/80 text-sm mt-2 font-medium">💰➡️🐻 Convert MiMo Tokens</div>
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
            <span className="text-5xl relative z-10">🐻</span>
          </div>
        </div>
      </div>
      
      {/* Enhanced Card Content */}
      <div className="pt-16 px-6 pb-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-2 rounded-xl">
              <span className="text-xl">💰</span>
            </div>
            <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-pink-600">
              Redeem BEAR NFT
            </h2>
          </div>
          
          {isPaused && (
            <div 
              className="px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 rounded-full text-xs font-medium animate-pulse"
            >
              Paused
            </div>
          )}
          
          {!isPaused && (
            <div 
              className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded-full text-xs font-medium flex items-center"
            >
              <span className="h-2 w-2 bg-green-500 rounded-full mr-1.5 animate-pulse"></span>
              Active
            </div>
          )}
        </div>
        
        {loading ? (
          <div className="py-10 text-center">
            <div className="flex flex-col items-center">
              <div className="relative mb-6">
                {/* Background rings */}
                {[...Array(3)].map((_, i) => (
                  <div 
                    key={i}
                    className="absolute inset-0 rounded-full border-2 border-indigo-500/30"
                    style={{
                      animation: `ping 1.4s cubic-bezier(0, 0, 0.2, 1) infinite`,
                      animationDelay: `${i * 0.3}s`,
                      width: `${(i+1) * 10 + 100}%`,
                      height: `${(i+1) * 10 + 100}%`,
                      top: `${-(i+1) * 5}%`,
                      left: `${-(i+1) * 5}%`,
                      opacity: 0.6 - (i * 0.15)
                    }}
                  ></div>
                ))}
                
                {/* Main spinner */}
                <div 
                  className="inline-block w-16 h-16 border-4 border-indigo-500/30 rounded-full animate-pulse"
                >
                  <div 
                    className="absolute top-0 left-0 w-16 h-16 border-4 border-transparent border-t-indigo-500 border-r-indigo-500 rounded-full animate-spin"
                    style={{ animationDuration: '1.2s' }}
                  >
                  </div>
                  
                  {/* Pulsing center */}
                  <div 
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <div
                      className="w-6 h-6 bg-indigo-500/20 rounded-full animate-ping"
                    ></div>
                  </div>
                  
                  {/* Inner content */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div
                      className="text-2xl animate-bounce"
                      style={{ animationDuration: '4s' }}
                    >
                      🔄
                    </div>
                  </div>
                </div>
              </div>
              
              <p 
                className="text-indigo-600 dark:text-indigo-400 font-medium animate-pulse"
              >
                Loading Redemption Data
              </p>
              
              <div className="mt-3 flex justify-center">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="h-1.5 w-1.5 mx-0.5 rounded-full bg-blue-500 animate-bounce"
                    style={{
                      animationDelay: `${i * 0.15}s`,
                      animationDuration: '1s'
                    }}
                  ></div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-6 bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800/30 relative overflow-hidden">
              <div className="relative z-10 flex items-start">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600 dark:text-indigo-400 mr-2 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="text-indigo-800 dark:text-indigo-200 mb-1 font-medium">
                    Redeem MiMo for a BEAR NFT
                  </p>
                  <p className="text-sm text-indigo-700/80 dark:text-indigo-300/80">
                    Spend your MiMo tokens to redeem a BEAR NFT that can be used in the game or
                    sold on marketplaces.
                  </p>
                  
                  {/* Progress bar for MiMo balance */}
                  <div className="mt-3 w-full bg-indigo-100 dark:bg-indigo-900/30 h-2 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-indigo-500 to-blue-500 rounded-full transition-all duration-500"
                      style={{ 
                        width: `${Math.min(100, (parseFloat(mimoBalance) / parseFloat(redemptionAmount)) * 100)}%`,
                      }}
                    ></div>
                  </div>
                  
                  <div className="flex justify-between text-xs mt-1">
                    <span className="text-indigo-700 dark:text-indigo-300">Current: {formatNumber(mimoBalance)} MiMo</span>
                    <span className="text-indigo-700 dark:text-indigo-300">Required: {formatNumber(redemptionAmount)} MiMo</span>
                  </div>
                </div>
              </div>
              
              {/* Decorative elements */}
              <div className="absolute -left-4 -bottom-4 h-16 w-16 rounded-full bg-indigo-400/5"></div>
              <div className="absolute -right-6 -bottom-8 h-24 w-24 rounded-full bg-blue-400/5"></div>
            </div>
            
            {/* Redemption Details Card */}
            <div className="mb-6 bg-white dark:bg-gray-900/50 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <h3 className="font-semibold text-gray-700 dark:text-gray-300">Redemption Details</h3>
              </div>
              <div className="p-5">
                <ul className="space-y-3">
                  <li className="flex justify-between items-center">
                    <div className="flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-500 dark:text-indigo-400 mr-2" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                      </svg>
                      <span className="text-gray-600 dark:text-gray-400">Cost per BEAR NFT:</span>
                    </div>
                    <span className="font-semibold text-gray-800 dark:text-gray-200">{formatNumber(redemptionAmount)} MiMo</span>
                  </li>
                  
                  {parseInt(redemptionFee) > 0 && (
                    <li className="flex justify-between items-center">
                      <div className="flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-500 dark:text-indigo-400 mr-2" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                        </svg>
                        <span className="text-gray-600 dark:text-gray-400">Redemption Fee:</span>
                      </div>
                      <span className="font-semibold text-gray-800 dark:text-gray-200">{redemptionFee}%</span>
                    </li>
                  )}
                  
                  <li className="flex justify-between items-center pt-3 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-500 dark:text-indigo-400 mr-2" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.715-5.349L11 6.477V16h2a1 1 0 110 2H7a1 1 0 110-2h2V6.477L6.237 7.582l1.715 5.349a1 1 0 01-.285 1.05A3.989 3.989 0 015 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.617a1 1 0 01.894-1.788l1.599.799L9 4.323V3a1 1 0 011-1z" clipRule="evenodd" />
                      </svg>
                      <span className="text-gray-600 dark:text-gray-400">Your MiMo Balance:</span>
                    </div>
                    <span className={`font-semibold ${hasEnoughMimo ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {formatNumber(mimoBalance)} MiMo
                    </span>
                  </li>
                </ul>
              </div>
            </div>
            
            {isPaused && (
              <div 
                className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800/30 text-yellow-800 dark:text-yellow-200 rounded-xl flex items-start animate-pulse"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 flex-shrink-0 text-yellow-600 dark:text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div>
                  <div className="font-bold mb-1">Redemption Paused</div>
                  <p>
                    NFT redemption is currently paused by the contract owner. Please check back later.
                  </p>
                </div>
              </div>
            )}
            
            {error && (
              <div 
                className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 text-red-800 dark:text-red-200 rounded-xl text-sm flex items-start"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <p>{error}</p>
              </div>
            )}
            
            {success && (
              <div 
                className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/30 text-green-800 dark:text-green-200 rounded-xl text-sm flex items-start"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <p>{success}</p>
              </div>
            )}
            
            <div className="mt-6">
              <button
                type="button"
                onClick={handleRedeem}
                disabled={isRedeeming || !hasEnoughMimo || isPaused}
                className={`w-full py-3 px-4 rounded-xl font-bold text-white shadow-lg flex items-center justify-center relative z-10 pointer-events-auto ${
                  isRedeeming || !hasEnoughMimo || isPaused
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-600/95 hover:to-blue-700 hover:shadow-xl hover:-translate-y-1 transition-all duration-200'
                }`}
              >
                {isRedeeming ? (
                  <>
                    <div className="flex items-center justify-center">
                      {/* Animated sparkle effect */}
                      <div className="relative mr-3">
                        <div className="absolute inset-0">
                          {[...Array(3)].map((_, index) => (
                            <div
                              key={index}
                              className="absolute w-full h-full"
                              style={{ 
                                rotate: `${index * 30}deg`,
                                opacity: 0.7,
                                animation: 'spin 1.5s linear infinite'
                              }}
                            >
                              <div
                                className="absolute bg-white h-4 w-0.5 left-1/2 -ml-0.5"
                                style={{
                                  animation: 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
                                  animationDelay: `${index * 0.2}s`
                                }}
                              ></div>
                            </div>
                          ))}
                        </div>
                        
                        {/* Main spinner background */}
                        <div
                          className="h-5 w-5 rounded-full bg-white/20 animate-pulse"
                        ></div>
                        
                        {/* Spinner animation */}
                        <div
                          className="absolute top-0 left-0 h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"
                        ></div>
                        
                        {/* Pulsing center */}
                        <div
                          className="absolute inset-0 flex items-center justify-center"
                        >
                          <div
                            className="h-1.5 w-1.5 bg-white rounded-full animate-ping"
                          ></div>
                        </div>
                      </div>
                      <span className="relative">
                        Redeeming BEAR NFT
                        <span 
                          className="absolute animate-bounce"
                          style={{
                            animationDuration: '1.5s',
                            opacity: 0.7
                          }}
                        >...</span>
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                    </svg>
                    Redeem BEAR NFT
                  </>
                )}
              </button>
              
              <div 
                className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800/30 text-xs text-blue-700 dark:text-blue-300"
              >
                <p className="flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5 text-blue-500 dark:text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  The BEAR NFT will be sent directly to your connected wallet after redemption
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}