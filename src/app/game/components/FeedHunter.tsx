'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useGame, Hunter } from './GameContext';

interface FeedHunterProps {
  hunter: Hunter;
  onClose: () => void;
  onSuccess: () => void;
}

export default function FeedHunter({ hunter, onClose, onSuccess }: FeedHunterProps) {
  const { feedHunter } = useGame();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Calculate if hunter can be fed
  const canFeed = () => {
    const now = Math.floor(Date.now() / 1000);
    const feedCooldown = hunter.lastFeedTime + 20 * 60 * 60; // 20 hours
    return now >= feedCooldown;
  };
  
  // Calculate potential power increase
  const calculatePowerIncrease = () => {
    const currentPower = parseFloat(hunter.power);
    const growthRate = 0.02; // 2%
    return currentPower * growthRate;
  };
  
  const handleFeed = async () => {
    if (!canFeed()) {
      setError("You must wait before feeding this hunter again");
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      await feedHunter(hunter.id);
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to feed hunter");
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
            Feed Hunter #{hunter.id}
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
          <div className="flex justify-between items-center mb-2">
            <div className="text-gray-600 dark:text-gray-400">Current Power</div>
            <div className="font-bold">{parseFloat(hunter.power).toFixed(2)} MiMo</div>
          </div>
          
          <div className="flex justify-between items-center mb-4">
            <div className="text-gray-600 dark:text-gray-400">Power Increase</div>
            <div className="font-bold text-green-600 dark:text-green-400">
              +{calculatePowerIncrease().toFixed(2)} MiMo
            </div>
          </div>
          
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-btb-primary"
              style={{ width: `${Math.min((parseFloat(hunter.power) / 10) * 100, 100)}%` }}
            ></div>
          </div>
        </div>
        
        {hunter.inHibernation ? (
          <div className="mb-6 p-3 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 rounded-lg text-sm">
            <div className="font-bold mb-1">Hunter is in Hibernation</div>
            <p>
              Feeding will begin the recovery process. 
              You will need to feed the hunter for 3 consecutive days to fully recover.
            </p>
          </div>
        ) : hunter.recoveryStartTime > 0 ? (
          <div className="mb-6 p-3 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 rounded-lg text-sm">
            <div className="font-bold mb-1">Hunter is Recovering</div>
            <p>
              Continue feeding the hunter to complete the recovery process.
              After 3 consecutive days of feeding, your hunter will be fully recovered.
            </p>
          </div>
        ) : hunter.missedFeedings > 0 ? (
          <div className="mb-6 p-3 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 rounded-lg text-sm">
            <div className="font-bold mb-1">Missed Feedings: {hunter.missedFeedings}</div>
            <p>
              Your hunter has missed {hunter.missedFeedings} consecutive feedings.
              If you miss {7 - hunter.missedFeedings} more, your hunter will enter hibernation.
            </p>
          </div>
        ) : (
          <div className="mb-6 p-3 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded-lg text-sm">
            <div className="font-bold mb-1">Hunter is Healthy</div>
            <p>
              Feeding will increase your hunter's power by 2%.
              Feed once every day to maximize power growth.
            </p>
          </div>
        )}
        
        {!canFeed() && (
          <div className="mb-6 p-3 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded-lg text-sm">
            You need to wait before feeding this hunter again.
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
            onClick={handleFeed}
            disabled={loading || !canFeed()}
            className={`flex-1 py-2 rounded-lg text-white ${
              loading || !canFeed()
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-btb-primary hover:bg-blue-600 transition-colors'
            }`}
          >
            {loading ? 'Feeding...' : 'Feed Hunter'}
          </button>
        </div>
      </div>
    </motion.div>
  );
}