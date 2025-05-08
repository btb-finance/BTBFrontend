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
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
      <h2 className="text-2xl font-bold mb-4 text-btb-primary dark:text-btb-primary-light">Redeem BEAR NFT</h2>
      
      <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-blue-800 dark:text-blue-200">
        <p className="flex items-start">
          <span className="mr-2 mt-0.5">ℹ️</span>
          <span>
            Redeem your MiMo tokens for a BEAR NFT. You need {loading ? '...' : formatNumber(redemptionAmount)} MiMo tokens to redeem one BEAR NFT.
          </span>
        </p>
      </div>
      
      {loading ? (
        <div className="py-8 text-center">
          <div className="inline-block w-8 h-8 border-4 border-btb-primary border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400">
            Loading redemption requirements...
          </p>
        </div>
      ) : (
        <>
          <div className="mb-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 bg-gray-100 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Required MiMo Tokens</div>
                <div className="text-2xl font-bold text-btb-primary dark:text-btb-primary-light">
                  {formatNumber(redemptionAmount)}
                </div>
              </div>
              
              <div className="flex-1 bg-gray-100 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Your MiMo Balance</div>
                <div className={`text-2xl font-bold ${hasEnoughMimo ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {formatNumber(mimoBalance)}
                </div>
              </div>
            </div>
          </div>
          
          {isPaused && (
            <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/30 border-l-4 border-yellow-500 text-yellow-800 dark:text-yellow-200">
              <div className="font-bold mb-1">Redemption Paused</div>
              <p>
                NFT redemption is currently paused by the contract owner. Please check back later.
              </p>
            </div>
          )}
          
          <div className="mb-6 bg-gray-100 dark:bg-gray-900 p-4 rounded-lg">
            <h3 className="font-medium mb-3 text-gray-700 dark:text-gray-300">Redemption Details</h3>
            <ul className="space-y-2">
              <li className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Cost per BEAR NFT:</span>
                <span className="font-medium">{formatNumber(redemptionAmount)} MiMo</span>
              </li>
              {parseInt(redemptionFee) > 0 && (
                <li className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Fee:</span>
                  <span className="font-medium">{redemptionFee}%</span>
                </li>
              )}
              <li className="flex justify-between border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
                <span className="text-gray-600 dark:text-gray-400">Status:</span>
                <span className={`font-medium ${isPaused ? 'text-red-500' : 'text-green-500'}`}>
                  {isPaused ? 'Paused' : 'Active'}
                </span>
              </li>
            </ul>
          </div>
          
          {error && (
            <div className="mb-6 p-3 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded-lg text-sm">
              {error}
            </div>
          )}
          
          {success && (
            <div className="mb-6 p-3 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded-lg text-sm">
              {success}
            </div>
          )}
          
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleRedeem}
            disabled={isRedeeming || !hasEnoughMimo || isPaused}
            className={`w-full py-3 rounded-lg font-bold text-white ${
              isRedeeming || !hasEnoughMimo || isPaused
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-btb-primary hover:bg-blue-600 transition-colors'
            }`}
          >
            {isRedeeming 
              ? 'Redeeming...' 
              : !hasEnoughMimo 
                ? `Need ${formatNumber(redemptionAmount)} MiMo` 
                : isPaused 
                  ? 'Redemption Paused' 
                  : 'Redeem BEAR NFT'}
          </motion.button>
          
          <div className="mt-4 text-sm text-center text-gray-500 dark:text-gray-400">
            After redemption, you'll receive a BEAR NFT in your wallet
          </div>
        </>
      )}
    </div>
  );
}