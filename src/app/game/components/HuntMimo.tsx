'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useGame, Hunter } from './GameContext';
import { useWalletConnection } from '../../hooks/useWalletConnection';

interface HuntMimoProps {
  hunter: Hunter;
  onClose: () => void;
  onSuccess: () => void;
}

export default function HuntMimo({ hunter, onClose, onSuccess }: HuntMimoProps) {
  const { hunt, isAddressProtected } = useGame();
  const { address } = useWalletConnection();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [targetAddress, setTargetAddress] = useState<string>('');
  const [recentAddresses, setRecentAddresses] = useState<string[]>([]);
  const [isSelfHunt, setIsSelfHunt] = useState(true);
  
  // Populate recent addresses
  useEffect(() => {
    // Try to get stored addresses from localStorage
    try {
      const stored = localStorage.getItem('recentHuntTargets');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setRecentAddresses(parsed.slice(0, 5)); // Keep only the last 5
        }
      }
    } catch (err) {
      console.error('Failed to load recent hunt targets:', err);
    }
  }, []);
  
  // Save an address to the list of recent addresses
  const saveRecentAddress = (address: string) => {
    if (!address) return;
    
    try {
      // Validate it's a proper Ethereum address
      if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return;
      
      const updatedList = [address, ...recentAddresses.filter(a => a !== address)].slice(0, 5);
      setRecentAddresses(updatedList);
      localStorage.setItem('recentHuntTargets', JSON.stringify(updatedList));
    } catch (err) {
      console.error('Failed to save recent hunt target:', err);
    }
  };
  
  // Calculate if hunter can hunt
  const canHunt = () => {
    if (!hunter.canHuntNow) return false;
    if (isAddressProtected && isSelfHunt) return false; // Only matters for self-hunts
    
    return true;
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
    if (!canHunt()) return;
    
    setLoading(true);
    setError("");
    
    try {
      // Choose the target - self or entered address
      const target = isSelfHunt ? address : targetAddress;
      
      // If not a self-hunt, save the address for future use
      if (!isSelfHunt && targetAddress) {
        saveRecentAddress(targetAddress);
      }
      
      // Hunt with the selected target
      if (target) {
        await hunt(hunter.id, target);
        onSuccess();
      } else {
        throw new Error("No target address specified");
      }
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
      className="w-full max-w-md relative z-50"
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full p-6"
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-btb-primary dark:text-btb-primary-light">
            Hunt with Hunter #{hunter.id}
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
            
            <div className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">
              <p className="italic">When you hunt, your hunter will extract MiMo tokens from the target's wallet.</p>
              <p>Targets need to have MiMo tokens and cannot be protected addresses.</p>
            </div>
          </div>
        </div>
        
        {/* Target selection */}
        <div className="mb-5">
          <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-3">Target Selection</h3>
          
          <div className="flex gap-3 mb-3">
            <button
              onClick={() => setIsSelfHunt(true)}
              className={`flex-1 py-2 px-3 rounded-lg border ${
                isSelfHunt 
                  ? 'bg-btb-primary/10 border-btb-primary text-btb-primary dark:text-btb-primary-light' 
                  : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              Self Hunt
            </button>
            
            <button
              onClick={() => setIsSelfHunt(false)}
              className={`flex-1 py-2 px-3 rounded-lg border ${
                !isSelfHunt 
                  ? 'bg-btb-primary/10 border-btb-primary text-btb-primary dark:text-btb-primary-light' 
                  : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              Hunt Other
            </button>
          </div>
          
          {isSelfHunt ? (
            <div className="p-3 rounded-lg bg-gray-100 dark:bg-gray-900 text-sm">
              <p>
                You will hunt your own address. This is useful for testing your hunters or
                when you want to control your MiMo tokens.
              </p>
              
              <div className="mt-2 p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded text-xs">
                Target: <span className="font-mono">{address}</span>
              </div>
              
              {isAddressProtected && (
                <div className="mt-2 p-2 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 rounded text-xs">
                  Warning: Your address is protected and cannot be hunted. Select a different target.
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="mb-3">
                <label className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Target Address
                </label>
                <input 
                  type="text"
                  value={targetAddress}
                  onChange={(e) => setTargetAddress(e.target.value)}
                  placeholder="0x..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-btb-primary dark:bg-gray-900"
                />
              </div>
              
              {recentAddresses.length > 0 && (
                <div className="mb-3">
                  <label className="block mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">
                    Recent Addresses
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {recentAddresses.map((addr, index) => (
                      <button 
                        key={index}
                        onClick={() => setTargetAddress(addr)}
                        className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 truncate max-w-[100px] inline-block"
                        title={addr}
                      >
                        {addr.substring(0, 6)}...{addr.substring(addr.length - 4)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        
        {isAddressProtected && isSelfHunt && (
          <div className="mb-5 p-3 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded-lg text-sm">
            <div className="font-bold mb-1">Your Address is Protected</div>
            <p>
              Protected addresses cannot be hunted for MiMo tokens.
              To self-hunt, you need to stop providing liquidity on Aerodrome.
              Alternatively, you can hunt other non-protected addresses.
            </p>
          </div>
        )}
        
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
            onClick={handleHunt}
            disabled={loading || !canHunt()}
            className={`flex-1 py-2 rounded-lg text-white ${
              loading || !canHunt()
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-btb-primary hover:bg-blue-600 transition-colors'
            }`}
          >
            {loading ? 'Hunting...' : isSelfHunt ? 'Self Hunt' : 'Hunt Target'}
          </button>
        </div>
      </div>
    </motion.div>
  );
}