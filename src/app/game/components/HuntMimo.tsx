'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useGame, Hunter } from './GameContext';

interface HuntMimoProps {
  hunter: Hunter;
  onClose: () => void;
  onSuccess: () => void;
}

export default function HuntMimo({ hunter, onClose, onSuccess }: HuntMimoProps) {
  const { hunt, isAddressProtected } = useGame();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Calculate if hunter can hunt
  const canHunt = () => {
    if (!hunter.canHuntNow) return false;
    if (isAddressProtected) return false;
    
    const now = Math.floor(Date.now() / 1000);
    const huntCooldown = hunter.lastHuntTime + 24 * 60 * 60; // 24 hours
    return now >= huntCooldown;
  };
  
  // Calculate potential rewards
  const calculateRewards = () => {
    const hunterPower = parseFloat(hunter.power);
    
    return {
      total: hunterPower,
      toOwner: hunterPower * 0.5, // 50% to owner
      burned: hunterPower * 0.25, // 25% burned
      toLiquidity: hunterPower * 0.25 // 25% to liquidity
    };
  };
  
  const rewards = calculateRewards();
  
  const handleHunt = async () => {
    if (!canHunt()) {
      setError(hunter.huntReason || "Cannot hunt right now");
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      await hunt(hunter.id);
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to hunt");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-btb-primary dark:text-btb-primary-light">
            Hunt with Hunter #{hunter.id}
          </h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="mb-6">
          <div className="flex justify-between items-center mb-3">
            <div className="text-gray-600 dark:text-gray-400">Hunter Power</div>
            <div className="font-bold">{parseFloat(hunter.power).toFixed(2)} MiMo</div>
          </div>
          
          <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-4 mb-4">
            <h3 className="font-bold mb-3 text-center">Hunting Rewards Distribution</h3>
            
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-btb-primary/10 dark:bg-btb-primary/20 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-btb-primary dark:text-btb-primary-light">
                  {rewards.toOwner.toFixed(2)}
                </div>
                <div className="text-xs font-medium mt-1">To You (50%)</div>
              </div>
              
              <div className="bg-red-500/10 dark:bg-red-500/20 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-red-500">
                  {rewards.burned.toFixed(2)}
                </div>
                <div className="text-xs font-medium mt-1">Burned (25%)</div>
              </div>
              
              <div className="bg-blue-500/10 dark:bg-blue-500/20 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-blue-500">
                  {rewards.toLiquidity.toFixed(2)}
                </div>
                <div className="text-xs font-medium mt-1">To Liquidity (25%)</div>
              </div>
            </div>
          </div>
        </div>
        
        {isAddressProtected && (
          <div className="mb-6 p-3 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded-lg text-sm">
            <div className="font-bold mb-1">Your Address is Protected</div>
            <p>
              Protected addresses cannot hunt for MiMo tokens.
              To enable hunting, you need to stop providing liquidity on Aerodrome.
            </p>
          </div>
        )}
        
        {!hunter.canHuntNow && (
          <div className="mb-6 p-3 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded-lg text-sm">
            <div className="font-bold mb-1">Cannot Hunt</div>
            <p>{hunter.huntReason || "This hunter cannot hunt right now."}</p>
          </div>
        )}
        
        {hunter.inHibernation && (
          <div className="mb-6 p-3 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded-lg text-sm">
            <div className="font-bold mb-1">Hunter is in Hibernation</div>
            <p>
              You need to feed the hunter for 3 consecutive days to recover from hibernation
              before you can hunt again.
            </p>
          </div>
        )}
        
        {error && (
          <div className="mb-6 p-3 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded-lg text-sm">
            {error}
          </div>
        )}
        
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          
          <button
            onClick={handleHunt}
            disabled={loading || !canHunt()}
            className={`flex-1 py-2 rounded-lg text-white ${
              loading || !canHunt()
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-btb-primary hover:bg-blue-600 transition-colors'
            }`}
          >
            {loading ? 'Hunting...' : 'Hunt Now'}
          </button>
        </div>
      </div>
    </motion.div>
  );
}