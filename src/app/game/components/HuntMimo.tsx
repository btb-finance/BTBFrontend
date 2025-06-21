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
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to hunt";
      setError(errorMessage);
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
        className="bg-gradient-to-br from-white via-purple-50/30 to-pink-50/20 dark:from-gray-800 dark:via-purple-900/20 dark:to-pink-900/10 rounded-2xl shadow-2xl w-full p-6 border-2 border-gradient-to-r from-purple-400/30 to-pink-400/30 backdrop-blur-md"
      >
        {/* Enhanced Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-2 rounded-xl">
              <span className="text-xl">🏹</span>
            </div>
            <div>
              <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-pink-600">
                Hunt with Hunter #{hunter.id}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Deploy your hunter for the hunt</p>
            </div>
          </div>
          <motion.button 
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            whileHover={{ scale: 1.1, rotate: 90 }}
            whileTap={{ scale: 0.9 }}
            className="text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </motion.button>
        </div>
        
        {/* Enhanced Power Display */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4 p-4 bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 rounded-xl border border-purple-200/50 dark:border-purple-700/50">
            <div className="flex items-center gap-2">
              <span className="text-2xl">⚡</span>
              <div className="text-gray-600 dark:text-gray-400 font-medium">Hunter Power</div>
            </div>
            <div className="font-bold text-2xl bg-clip-text text-transparent bg-gradient-to-r from-yellow-500 to-orange-500">
              {parseFloat(hunter.power).toFixed(2)} MiMo
            </div>
          </div>
          
          {/* Enhanced Rewards Display */}
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800/50 dark:to-gray-900/50 rounded-2xl p-5 mb-4 border border-gray-200/50 dark:border-gray-700/50">
            <h3 className="font-bold mb-4 text-center flex items-center justify-center gap-2">
              <span className="text-2xl">💰</span>
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-pink-600">
                Hunting Rewards Distribution
              </span>
            </h3>
            
            <div className="grid grid-cols-3 gap-3">
              <motion.div 
                className="bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 rounded-xl p-4 text-center border border-green-200/50 dark:border-green-700/50"
                whileHover={{ scale: 1.05, y: -2 }}
                transition={{ duration: 0.2 }}
              >
                <div className="text-2xl mb-1">💎</div>
                <div className="text-xl font-bold text-green-600 dark:text-green-400">
                  {rewards.toOwner.toFixed(2)}
                </div>
                <div className="text-xs font-medium mt-1 text-green-700 dark:text-green-300">To You (50%)</div>
              </motion.div>
              
              <motion.div 
                className="bg-gradient-to-br from-red-100 to-pink-100 dark:from-red-900/30 dark:to-pink-900/30 rounded-xl p-4 text-center border border-red-200/50 dark:border-red-700/50"
                whileHover={{ scale: 1.05, y: -2 }}
                transition={{ duration: 0.2 }}
              >
                <div className="text-2xl mb-1">🔥</div>
                <div className="text-xl font-bold text-red-500">
                  {rewards.burned.toFixed(2)}
                </div>
                <div className="text-xs font-medium mt-1 text-red-700 dark:text-red-300">Burned (25%)</div>
              </motion.div>
              
              <motion.div 
                className="bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-xl p-4 text-center border border-blue-200/50 dark:border-blue-700/50"
                whileHover={{ scale: 1.05, y: -2 }}
                transition={{ duration: 0.2 }}
              >
                <div className="text-2xl mb-1">🌊</div>
                <div className="text-xl font-bold text-blue-500">
                  {rewards.toLiquidity.toFixed(2)}
                </div>
                <div className="text-xs font-medium mt-1 text-blue-700 dark:text-blue-300">To Liquidity (25%)</div>
              </motion.div>
            </div>
            
            <div className="text-xs text-gray-500 dark:text-gray-400 text-center mt-4 p-3 bg-white/50 dark:bg-gray-800/50 rounded-xl border border-gray-200/30 dark:border-gray-700/30">
              <p className="italic flex items-center justify-center gap-1 mb-1">
                <span>🎯</span>
                When you hunt, your hunter will extract MiMo tokens from the target's wallet.
              </p>
              <p className="flex items-center justify-center gap-1">
                <span>🛡️</span>
                Targets need to have MiMo tokens and cannot be protected addresses.
              </p>
            </div>
          </div>
        </div>
        
        {/* Enhanced Target selection */}
        <div className="mb-6">
          <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
            <span className="text-xl">🎯</span>
            Target Selection
          </h3>
          
          <div className="flex gap-3 mb-4">
            <motion.button
              onClick={() => setIsSelfHunt(true)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`flex-1 py-3 px-4 rounded-xl border-2 font-medium transition-all duration-200 ${
                isSelfHunt 
                  ? 'bg-gradient-to-r from-purple-100 to-pink-100 border-purple-400 text-purple-700 dark:from-purple-900/30 dark:to-pink-900/30 dark:text-purple-300 dark:border-purple-500' 
                  : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <span className="mr-2">🔄</span>
              Self Hunt
            </motion.button>
            
            <motion.button
              onClick={() => setIsSelfHunt(false)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`flex-1 py-3 px-4 rounded-xl border-2 font-medium transition-all duration-200 ${
                !isSelfHunt 
                  ? 'bg-gradient-to-r from-purple-100 to-pink-100 border-purple-400 text-purple-700 dark:from-purple-900/30 dark:to-pink-900/30 dark:text-purple-300 dark:border-purple-500' 
                  : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <span className="mr-2">🏹</span>
              Hunt Other
            </motion.button>
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
        
        <div className="flex gap-4">
          <motion.button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex-1 py-3 rounded-xl border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 font-medium"
          >
            <span className="mr-2">❌</span>
            Cancel
          </motion.button>
          
          <motion.button
            onClick={handleHunt}
            disabled={loading || !canHunt()}
            whileHover={loading || !canHunt() ? {} : { scale: 1.02 }}
            whileTap={loading || !canHunt() ? {} : { scale: 0.98 }}
            className={`flex-1 py-3 rounded-xl text-white font-bold transition-all duration-200 ${
              loading || !canHunt()
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-purple-600 via-pink-500 to-orange-500 hover:from-purple-700 hover:via-pink-600 hover:to-orange-600 shadow-lg hover:shadow-xl'
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                Hunting...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <span>{isSelfHunt ? '🔄' : '🏹'}</span>
                {isSelfHunt ? 'Self Hunt' : 'Hunt Target'}
              </span>
            )}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}