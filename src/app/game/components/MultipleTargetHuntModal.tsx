'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useGame, Hunter } from './GameContext';
import { useWalletConnection } from '../../hooks/useWalletConnection';

interface MultipleTargetHuntModalProps {
  hunter: Hunter;
  onClose: () => void;
  onSuccess: () => void;
}

export default function MultipleTargetHuntModal({ hunter, onClose, onSuccess }: MultipleTargetHuntModalProps) {
  const { huntMultipleTargets, isAddressProtected } = useGame();
  const { address } = useWalletConnection();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [targetAddresses, setTargetAddresses] = useState<string[]>(['']);
  const [recentAddresses, setRecentAddresses] = useState<string[]>([]);
  
  // Populate recent addresses
  useEffect(() => {
    try {
      const stored = localStorage.getItem('recentHuntTargets');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setRecentAddresses(parsed.slice(0, 10)); // Keep more for multiple targets
        }
      }
    } catch (err) {
      console.error('Failed to load recent hunt targets:', err);
    }
  }, []);
  
  // Save addresses to the list of recent addresses
  const saveRecentAddresses = (addresses: string[]) => {
    try {
      const validAddresses = addresses.filter(addr => 
        addr && /^0x[a-fA-F0-9]{40}$/.test(addr)
      );
      
      if (validAddresses.length === 0) return;
      
      const updatedList = [
        ...validAddresses,
        ...recentAddresses.filter(a => !validAddresses.includes(a))
      ].slice(0, 10);
      
      setRecentAddresses(updatedList);
      localStorage.setItem('recentHuntTargets', JSON.stringify(updatedList));
    } catch (err) {
      console.error('Failed to save recent hunt targets:', err);
    }
  };
  
  // Add a new target input
  const addTargetInput = () => {
    setTargetAddresses([...targetAddresses, '']);
  };
  
  // Remove a target input
  const removeTargetInput = (index: number) => {
    const newTargets = targetAddresses.filter((_, i) => i !== index);
    setTargetAddresses(newTargets.length > 0 ? newTargets : ['']);
  };
  
  // Update a target address
  const updateTargetAddress = (index: number, value: string) => {
    const newTargets = [...targetAddresses];
    newTargets[index] = value;
    setTargetAddresses(newTargets);
  };
  
  // Add self to targets
  const addSelfTarget = () => {
    if (address && !targetAddresses.includes(address)) {
      setTargetAddresses([...targetAddresses.filter(addr => addr), address]);
    }
  };
  
  // Calculate if hunter can hunt
  const canHunt = () => {
    if (!hunter.canHuntNow) return false;
    const validTargets = getValidTargets();
    return validTargets.length > 0;
  };
  
  // Get valid target addresses
  const getValidTargets = () => {
    return targetAddresses.filter(addr => 
      addr && /^0x[a-fA-F0-9]{40}$/.test(addr)
    );
  };
  
  // Calculate potential rewards for all targets
  const calculateTotalRewards = () => {
    const hunterPower = parseFloat(hunter.power);
    const validTargetsCount = getValidTargets().length;
    
    return {
      total: hunterPower * validTargetsCount,
      toOwner: hunterPower * validTargetsCount * 0.5, // 50% to owner per target
      burned: hunterPower * validTargetsCount * 0.25, // 25% burned per target
      toLiquidity: hunterPower * validTargetsCount * 0.25 // 25% to liquidity per target
    };
  };
  
  const rewards = calculateTotalRewards();
  const validTargets = getValidTargets();
  
  const handleMultipleTargetHunt = async () => {
    if (!canHunt()) return;
    if (validTargets.length === 0) {
      setError("Please enter at least one valid target address");
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      await huntMultipleTargets(hunter.id, validTargets);
      saveRecentAddresses(validTargets);
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to hunt multiple targets");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="w-full max-w-2xl relative z-50"
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full p-6 max-h-[80vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-btb-primary dark:text-btb-primary-light">
            Hunt Multiple Targets with Hunter #{hunter.id}
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
          <div className="flex justify-between items-center mb-3">
            <div className="text-gray-600 dark:text-gray-400">Hunter Power</div>
            <div className="font-bold">{parseFloat(hunter.power).toFixed(2)} MiMo</div>
          </div>
          
          <div className="flex justify-between items-center mb-3">
            <div className="text-gray-600 dark:text-gray-400">Valid Targets</div>
            <div className="font-bold">{validTargets.length}</div>
          </div>
          
          <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-4 mb-4">
            <h3 className="font-bold mb-3 text-center">Total Hunting Rewards (All Targets)</h3>
            
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
            
            <div className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">
              <p className="italic">Hunter will extract MiMo from each target address in a single transaction.</p>
              <p>Each target needs MiMo tokens and cannot be a protected address.</p>
            </div>
          </div>
        </div>
        
        {/* Target addresses */}
        <div className="mb-5">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-medium text-gray-700 dark:text-gray-300">Target Addresses</h3>
            <div className="flex gap-2">
              <button
                onClick={addSelfTarget}
                disabled={!address || targetAddresses.includes(address)}
                className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Add Self
              </button>
              <button
                onClick={addTargetInput}
                className="px-3 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
              >
                Add Target
              </button>
            </div>
          </div>
          
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {targetAddresses.map((addr, index) => (
              <div key={index} className="flex gap-2">
                <input 
                  type="text"
                  value={addr}
                  onChange={(e) => updateTargetAddress(index, e.target.value)}
                  placeholder={`Target ${index + 1} (0x...)`}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-btb-primary dark:bg-gray-900 text-sm"
                />
                {targetAddresses.length > 1 && (
                  <button
                    onClick={() => removeTargetInput(index)}
                    className="px-2 py-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
          
          {recentAddresses.length > 0 && (
            <div className="mt-3">
              <label className="block mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">
                Recent Addresses (click to add)
              </label>
              <div className="flex flex-wrap gap-2">
                {recentAddresses.map((addr, index) => (
                  <button 
                    key={index}
                    onClick={() => {
                      if (!targetAddresses.includes(addr)) {
                        setTargetAddresses([...targetAddresses.filter(a => a), addr]);
                      }
                    }}
                    disabled={targetAddresses.includes(addr)}
                    className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 truncate max-w-[120px] inline-block disabled:opacity-50 disabled:cursor-not-allowed"
                    title={addr}
                  >
                    {addr.substring(0, 6)}...{addr.substring(addr.length - 4)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {!hunter.canHuntNow && (
          <div className="mb-5 p-3 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded-lg text-sm">
            <div className="font-bold mb-1">Cannot Hunt</div>
            <p>{hunter.huntReason || "This hunter cannot hunt right now."}</p>
          </div>
        )}
        
        {hunter.inHibernation && (
          <div className="mb-5 p-3 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded-lg text-sm">
            <div className="font-bold mb-1">Hunter is in Hibernation</div>
            <p>
              You need to feed the hunter for 3 consecutive days to recover from hibernation
              before you can hunt again.
            </p>
          </div>
        )}
        
        {address && isAddressProtected && targetAddresses.includes(address) && (
          <div className="mb-5 p-3 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 rounded-lg text-sm">
            <div className="font-bold mb-1">Protected Address Warning</div>
            <p>
              Your address ({address.substring(0, 6)}...{address.substring(address.length - 4)}) is protected and cannot be hunted.
              Remove it from targets or stop providing liquidity on Aerodrome.
            </p>
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
            onClick={handleMultipleTargetHunt}
            disabled={loading || !canHunt()}
            className={`flex-1 py-2 rounded-lg text-white ${
              loading || !canHunt()
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-btb-primary hover:bg-blue-600 transition-colors'
            }`}
          >
            {loading ? 'Hunting...' : `Hunt ${validTargets.length} Targets`}
          </button>
        </div>
      </div>
    </motion.div>
  );
}