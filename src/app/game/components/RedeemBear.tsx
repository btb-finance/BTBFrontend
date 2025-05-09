'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useGame } from './GameContext';

export default function RedeemBear() {
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
        setError("Failed to load redemption requirements");
      } finally {
        setLoading(false);
      }
    };
    
    loadRequirements();
  }, [getRedemptionRequirements]);

  // Calculate if user has enough MiMo
  const hasEnoughMimo = parseFloat(mimoBalance) >= parseFloat(redemptionAmount);
  
  // Calculate percentage of MiMo tokens user has compared to requirement
  const getProgressPercentage = () => {
    if (parseFloat(redemptionAmount) === 0) return 0;
    const percentage = (parseFloat(mimoBalance) / parseFloat(redemptionAmount)) * 100;
    return Math.min(percentage, 100);
  };

  const handleRedeem = async () => {
    if (isPaused) {
      setError("Redemption is currently paused");
      return;
    }
    
    if (!hasEnoughMimo) {
      setError(`You need at least ${redemptionAmount} MiMo tokens to redeem a BEAR NFT`);
      return;
    }
    
    setIsRedeeming(true);
    setError(null);
    setSuccess(null);
    
    try {
      await redeemBear();
      setSuccess("Successfully redeemed a BEAR NFT!");
      refreshData();
    } catch (err: any) {
      console.error("Redemption error:", err);
      setError(err.message || "Failed to redeem BEAR NFT");
    } finally {
      setIsRedeeming(false);
    }
  };

  // Format number with commas
  const formatNumber = (num: string) => {
    return parseFloat(num).toLocaleString(undefined, { maximumFractionDigits: 0 });
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
        <div className="h-24 bg-gradient-to-r from-indigo-600 via-blue-600 to-blue-500 relative overflow-hidden">
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

          {/* MiMo Token Emblem */}
          <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2">
            <motion.div 
              className="text-white text-opacity-10 text-8xl font-bold"
              animate={{ scale: [1, 1.05, 1], rotate: [0, 5, 0, -5, 0] }}
              transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
            >
              MiMo
            </motion.div>
          </div>
        </div>
        
        <div className="absolute -bottom-10 left-6">
          <motion.div 
            className="rounded-full h-20 w-20 border-4 border-white dark:border-gray-800 bg-gradient-to-br from-indigo-100 to-blue-200 dark:from-indigo-700 dark:to-blue-800 flex items-center justify-center shadow-xl"
            animate={{ 
              boxShadow: ["0 10px 25px -15px rgba(99, 102, 241, 0.4)", "0 15px 35px -15px rgba(99, 102, 241, 0.6)", "0 10px 25px -15px rgba(99, 102, 241, 0.4)"]
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
      </div>
      
      {/* Card Content */}
      <div className="pt-14 px-6 pb-6">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-blue-600 dark:from-indigo-400 dark:to-blue-400">
            Redeem BEAR NFT
          </h2>
          
          {isPaused && (
            <motion.div 
              className="px-3 py-1 bg-yellow-500/20 border border-yellow-500/30 rounded-full text-yellow-700 dark:text-yellow-300 text-sm font-medium flex items-center"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <span className="h-2 w-2 rounded-full bg-yellow-500 mr-2"></span>
              Paused
            </motion.div>
          )}
          
          {!isPaused && (
            <motion.div 
              className="px-3 py-1 bg-green-500/20 border border-green-500/30 rounded-full text-green-700 dark:text-green-300 text-sm font-medium flex items-center"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <span className="h-2 w-2 rounded-full bg-green-500 mr-2"></span>
              Active
            </motion.div>
          )}
        </div>

        <div className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800/30 relative overflow-hidden">
          <div className="relative z-10 flex items-start">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-14a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V4z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="text-blue-800 dark:text-blue-200 mb-1 font-medium">
                Exchange MiMo for BEAR NFT
              </p>
              <p className="text-sm text-blue-700/80 dark:text-blue-300/80">
                Redeem your MiMo tokens for a BEAR NFT. You need 
                {loading ? '...' : <span className="font-bold"> {formatNumber(redemptionAmount)}</span>} MiMo tokens for one BEAR NFT.
              </p>
            </div>
          </div>
          
          {/* Decorative elements */}
          <div className="absolute -right-4 -bottom-4 h-16 w-16 rounded-full bg-indigo-400/10 dark:bg-indigo-400/5"></div>
          <div className="absolute right-8 -top-6 h-12 w-12 rounded-full bg-blue-400/10 dark:bg-blue-400/5"></div>
        </div>
        
        {loading ? (
          <div className="py-12 text-center">
            <div className="flex flex-col items-center">
              <div className="relative mb-6">
                {/* Background rings */}
                {[...Array(3)].map((_, i) => (
                  <motion.div
                    key={i}
                    className={`absolute rounded-full border-2 ${
                      i === 0 ? 'border-indigo-500/20' :
                      i === 1 ? 'border-blue-500/20' :
                      'border-indigo-400/20'
                    }`}
                    style={{
                      width: `${60 + i * 16}px`,
                      height: `${60 + i * 16}px`,
                      top: `${-i * 8}px`,
                      left: `${-i * 8}px`,
                    }}
                    animate={{
                      scale: [1, 1.1, 1],
                      opacity: [0.3, 0.6, 0.3]
                    }}
                    transition={{
                      duration: 2 + i * 0.5,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  />
                ))}
                
                {/* Spinning loader */}
                <div className="relative">
                  <motion.div 
                    className="inline-block w-16 h-16 border-4 border-indigo-500/20 rounded-full"
                    animate={{ rotate: [0, 180] }}
                    transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                  >
                    <motion.div
                      className="absolute h-2 w-2 rounded-full bg-indigo-500"
                      style={{ top: '-4px', left: 'calc(50% - 4px)' }}
                    />
                  </motion.div>
                  
                  <motion.div 
                    className="absolute top-0 left-0 w-16 h-16 border-4 border-transparent border-t-blue-500 rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                  />
                  
                  <motion.div 
                    className="absolute top-0 left-0 w-16 h-16 border-4 border-transparent border-l-indigo-500 rounded-full"
                    animate={{ rotate: -360 }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                  />
                  
                  {/* Inner content */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <motion.div
                      className="text-2xl"
                      animate={{ scale: [1, 1.2, 1], rotate: [0, 10, 0, -10, 0] }}
                      transition={{ duration: 4, repeat: Infinity }}
                    >
                      🔄
                    </motion.div>
                  </div>
                </div>
              </div>
              
              <motion.p 
                className="text-indigo-600 dark:text-indigo-400 font-medium"
                animate={{ opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              >
                Loading Redemption Data
              </motion.p>
              
              <div className="mt-3 flex justify-center">
                {[...Array(3)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="h-1.5 w-1.5 mx-0.5 rounded-full bg-blue-500"
                    animate={{
                      scale: [1, 1.5, 1],
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
              
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-3">
                Getting current requirements from blockchain...
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* MiMo Balance Card */}
            <div className="mb-8">
              <div className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 rounded-xl p-5 border border-indigo-100 dark:border-indigo-800/30 relative overflow-hidden">
                <div className="mb-2 text-sm font-medium text-gray-600 dark:text-gray-400">Your MiMo Balance</div>
                
                <div className="flex items-end mb-3">
                  <div className={`text-3xl font-bold ${hasEnoughMimo ? 'text-green-600 dark:text-green-400' : 'text-indigo-600 dark:text-indigo-400'}`}>
                    {formatNumber(mimoBalance)}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 ml-2 mb-1">
                    MiMo tokens
                  </div>
                </div>
                
                <div className="relative h-8 w-full bg-white dark:bg-gray-900 rounded-lg shadow-inner overflow-hidden mb-2">
                  <motion.div 
                    className={`absolute left-0 top-0 h-full rounded-lg ${
                      hasEnoughMimo ? 'bg-gradient-to-r from-green-500 to-green-400' : 'bg-gradient-to-r from-indigo-500 to-blue-400'
                    }`}
                    style={{ width: '0%' }}
                    animate={{ width: `${getProgressPercentage()}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                  >
                    <div className="absolute inset-0 overflow-hidden flex">
                      {[...Array(20)].map((_, i) => (
                        <div 
                          key={i} 
                          className="h-full w-1 bg-white/20 transform -skew-x-12"
                          style={{
                            left: `${i * 8}%`,
                            opacity: 0.5 + Math.random() * 0.5
                          }}
                        ></div>
                      ))}
                    </div>
                  </motion.div>
                  
                  {/* Goal marker */}
                  <div className="absolute top-0 h-full" style={{ left: '100%', transform: 'translateX(-2px)' }}>
                    <div className="h-full w-px bg-gray-300 dark:bg-gray-600"></div>
                  </div>
                </div>
                
                <div className="flex justify-between text-xs">
                  <div className="font-medium text-gray-500 dark:text-gray-400">
                    {getProgressPercentage().toFixed(0)}% of required MiMo
                  </div>
                  <div className="font-medium text-gray-500 dark:text-gray-400">
                    Need {formatNumber(redemptionAmount)} MiMo
                  </div>
                </div>
                
                {/* Decorative elements */}
                <div className="absolute -left-4 -bottom-4 h-16 w-16 rounded-full bg-indigo-400/5"></div>
                <div className="absolute -right-6 -bottom-8 h-24 w-24 rounded-full bg-blue-400/5"></div>
              </div>
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
                      <span className="text-gray-600 dark:text-gray-400">Status:</span>
                    </div>
                    <span className={`font-semibold px-3 py-1 rounded-full text-sm ${
                      isPaused 
                        ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' 
                        : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                    }`}>
                      {isPaused ? 'Paused' : 'Active'}
                    </span>
                  </li>
                </ul>
              </div>
            </div>
            
            {isPaused && (
              <motion.div 
                className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800/30 rounded-xl text-sm text-yellow-800 dark:text-yellow-200 flex items-start"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.2 }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 flex-shrink-0 text-yellow-600 dark:text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div>
                  <div className="font-bold mb-1">Redemption Paused</div>
                  <p>
                    NFT redemption is currently paused by the contract owner. Please check back later.
                  </p>
                </div>
              </motion.div>
            )}
            
            {error && (
              <motion.div 
                className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 text-red-800 dark:text-red-200 rounded-xl text-sm flex items-start"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <p>{error}</p>
              </motion.div>
            )}
            
            {success && (
              <motion.div 
                className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/30 text-green-800 dark:text-green-200 rounded-xl text-sm flex items-start"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <p>{success}</p>
              </motion.div>
            )}
            
            <div className="mt-6">
              <motion.button
                onClick={handleRedeem}
                disabled={isRedeeming || !hasEnoughMimo || isPaused}
                className={`w-full py-3 px-4 rounded-xl font-bold text-white shadow-lg flex items-center justify-center ${
                  isRedeeming || !hasEnoughMimo || isPaused
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-600/95 hover:to-blue-700'
                }`}
                whileHover={!isRedeeming && hasEnoughMimo && !isPaused ? { y: -2, boxShadow: "0 10px 25px -5px rgba(79, 70, 229, 0.4)" } : {}}
                whileTap={!isRedeeming && hasEnoughMimo && !isPaused ? { y: 0, boxShadow: "0 5px 15px -5px rgba(79, 70, 229, 0.4)" } : {}}
              >
                {isRedeeming ? (
                  <>
                    <div className="flex items-center justify-center">
                      {/* Animated sparkle effect */}
                      <div className="relative mr-3">
                        <div className="absolute inset-0">
                          {[...Array(3)].map((_, index) => (
                            <motion.div
                              key={index}
                              className="absolute w-full h-full"
                              style={{ 
                                rotate: index * 30,
                                opacity: 0.7 
                              }}
                            >
                              <motion.div
                                className="absolute bg-white h-4 w-0.5 left-1/2 -ml-0.5"
                                style={{ 
                                  top: -4,
                                  transformOrigin: 'bottom center'
                                }}
                                animate={{ 
                                  scaleY: [0, 1, 0],
                                  opacity: [0, 1, 0]
                                }}
                                transition={{ 
                                  repeat: Infinity, 
                                  duration: 1.5, 
                                  delay: index * 0.2,
                                  ease: "easeInOut"
                                }}
                              />
                            </motion.div>
                          ))}
                        </div>
                        
                        {/* Main spinner */}
                        <motion.div 
                          className="w-6 h-6 border-2 border-white/20 rounded-full"
                        />
                        <motion.div 
                          className="absolute top-0 left-0 w-6 h-6 border-2 border-transparent border-t-white border-r-white rounded-full"
                          animate={{ rotate: 360 }}
                          transition={{ 
                            duration: 1, 
                            repeat: Infinity, 
                            ease: "linear" 
                          }}
                        />
                        
                        {/* Pulsing center */}
                        <motion.div 
                          className="absolute top-1/2 left-1/2 w-2 h-2 -ml-1 -mt-1 bg-white rounded-full"
                          animate={{ 
                            scale: [1, 1.5, 1],
                            opacity: [0.5, 1, 0.5]
                          }}
                          transition={{ 
                            duration: 1, 
                            repeat: Infinity 
                          }}
                        />
                      </div>
                      <span className="relative font-medium">
                        Redeeming BEAR NFT
                        <motion.span 
                          className="absolute inline-flex"
                          animate={{ 
                            opacity: [0, 1, 0],
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
                ) : !hasEnoughMimo ? (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                    Need {formatNumber(redemptionAmount)} MiMo
                  </>
                ) : isPaused ? (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                    </svg>
                    Redemption Paused
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" />
                    </svg>
                    Redeem BEAR NFT
                  </>
                )}
              </motion.button>
              
              <motion.div 
                className="mt-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 rounded-xl p-4 text-blue-800 dark:text-blue-200 text-sm flex items-start"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-500 dark:text-blue-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M11 17a1 1 0 001.447.894l4-2A1 1 0 0017 15V9.236a1 1 0 00-1.447-.894l-4 2a1 1 0 00-.553.894V17zM15.211 6.276a1 1 0 000-1.788l-4.764-2.382a1 1 0 00-.894 0L4.789 4.488a1 1 0 000 1.788l4.764 2.382a1 1 0 00.894 0l4.764-2.382zM4.447 8.342A1 1 0 003 9.236V15a1 1 0 00.553.894l4 2A1 1 0 009 17v-5.764a1 1 0 00-.553-.894l-4-2z" />
                </svg>
                <div>
                  <span className="font-medium">After redemption:</span> Your BEAR NFT will be automatically minted and sent to your connected wallet. You can use this NFT to deposit and create a Hunter.
                </div>
              </motion.div>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}