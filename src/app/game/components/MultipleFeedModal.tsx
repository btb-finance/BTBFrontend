'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useGame, Hunter } from './GameContext';

interface MultipleFeedModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function MultipleFeedModal({ onClose, onSuccess }: MultipleFeedModalProps) {
  const { selectedHunters, hunters, feedMultipleHunters, clearSelectedHunters } = useGame();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Get selected hunter objects
  const selectedHunterObjects = hunters.filter(hunter => selectedHunters.includes(hunter.id));
  
  // Filter hunters that can be fed (not on cooldown)
  const feedableHunters = selectedHunterObjects.filter(hunter => {
    const now = Math.floor(Date.now() / 1000);
    const feedCooldown = hunter.lastFeedTime + 20 * 60 * 60; // 20 hours
    return now >= feedCooldown;
  });
  
  // Calculate if any hunters can be fed
  const canBulkFeed = () => {
    return feedableHunters.length > 0;
  };
  
  // Calculate total power increase
  const calculateTotalPowerIncrease = () => {
    const growthRate = 0.02; // 2%
    return feedableHunters.reduce((total, hunter) => {
      const currentPower = parseFloat(hunter.power);
      return total + (currentPower * growthRate);
    }, 0);
  };
  
  const totalPowerIncrease = calculateTotalPowerIncrease();
  
  const handleBulkFeed = async () => {
    if (!canBulkFeed()) {
      setError("No hunters are available for feeding");
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Get IDs of hunters that can be fed
      const hunterIds = feedableHunters.map(hunter => hunter.id);
      await feedMultipleHunters(hunterIds);
      clearSelectedHunters();
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to bulk feed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="w-full max-w-md relative z-50 max-h-[80vh] overflow-y-auto"
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full p-4"
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-btb-primary dark:text-btb-primary-light">
            Feed {selectedHunters.length} Hunters
          </h2>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="mb-5">
          <div className="flex flex-col mb-3">
            <div className="text-gray-600 dark:text-gray-400 mb-1">Selected Hunters: {selectedHunters.length}</div>
            <div className="text-gray-600 dark:text-gray-400 mb-1">Feedable Hunters: {feedableHunters.length}</div>
            <div className="font-bold text-green-600 dark:text-green-400">
              Total Power Increase: +{totalPowerIncrease.toFixed(2)} MiMo
            </div>
          </div>
          
          <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-4 mb-4">
            <h3 className="font-bold mb-3 text-center">Feeding Benefits</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-green-500/10 dark:bg-green-500/20 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-green-500">
                  +2%
                </div>
                <div className="text-xs font-medium mt-1">Power Growth</div>
              </div>
              
              <div className="bg-blue-500/10 dark:bg-blue-500/20 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-blue-500">
                  {feedableHunters.length}
                </div>
                <div className="text-xs font-medium mt-1">Hunters Ready</div>
              </div>
            </div>
            
            <div className="text-xs text-gray-500 dark:text-gray-400 text-center mt-3">
              <p className="italic">Feeding increases each hunter's power by 2% and helps prevent hibernation.</p>
              <p>Hunters can be fed once every 20 hours.</p>
            </div>
          </div>
        </div>

        {/* Hunter summary */}
        <div className="mb-5">
          <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-3">Selected Hunters</h3>
          <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-4 max-h-40 overflow-y-auto">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {selectedHunterObjects.map(hunter => {
                const now = Math.floor(Date.now() / 1000);
                const feedCooldown = hunter.lastFeedTime + 20 * 60 * 60; // 20 hours
                const canFeed = now >= feedCooldown;
                
                return (
                  <div 
                    key={hunter.id}
                    className={`p-2 rounded-lg border ${
                      canFeed 
                        ? 'border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-900/20' 
                        : 'border-yellow-300 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20'
                    }`}
                  >
                    <div className="text-sm font-medium">Hunter #{hunter.id}</div>
                    <div className="text-xs">Power: {parseFloat(hunter.power).toFixed(2)}</div>
                    {hunter.inHibernation && (
                      <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                        In Hibernation
                      </div>
                    )}
                    {hunter.recoveryStartTime > 0 && !hunter.inHibernation && (
                      <div className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                        Recovering
                      </div>
                    )}
                    {!canFeed && (
                      <div className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                        On Cooldown
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        
        {feedableHunters.length === 0 && (
          <div className="mb-5 p-3 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 rounded-lg text-sm">
            <div className="font-bold mb-1">No Hunters Ready for Feeding</div>
            <p>All selected hunters are on cooldown. Hunters can be fed once every 20 hours.</p>
          </div>
        )}
        
        {error && (
          <div className="mb-5 p-3 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded-lg text-sm">
            {error}
          </div>
        )}
        
        <div className="flex gap-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="flex-1 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          
          <button
            onClick={handleBulkFeed}
            disabled={loading || !canBulkFeed()}
            className={`flex-1 py-2 rounded-lg text-white ${
              loading || !canBulkFeed()
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700 transition-colors'
            }`}
          >
            {loading ? 'Feeding...' : `Feed ${feedableHunters.length} Hunters`}
          </button>
        </div>
      </div>
    </motion.div>
  );
}