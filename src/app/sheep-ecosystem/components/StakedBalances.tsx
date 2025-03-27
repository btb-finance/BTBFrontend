'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/app/components/ui/card';
import { motion } from 'framer-motion';
import { SheepEcosystemService } from '@/app/services/sheepEcosystemService';
import { 
  ArrowPathIcon,
  CurrencyDollarIcon,
  ShieldCheckIcon,
  ExclamationCircleIcon
} from '@heroicons/react/24/outline';
import { Button } from '@/app/components/ui/button';

export default function StakedBalances() {
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [balances, setBalances] = useState({
    sheep: '0',
    stakedSheep: '0',
    totalSheep: '0',
    wolfCount: 0,
    wolfHunger: '0',
    sheepDogShares: '0',
    protectionStatus: 0
  });
  const [error, setError] = useState('');
  
  const sheepService = new SheepEcosystemService();
  
  const loadBalances = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      await sheepService.connect();
      setIsConnected(true);
      
      // Get all balances in parallel
      const [
        sheepBalance,
        stakedSheepBalance,
        totalSheepBalance,
        wolfCount,
        highestWolfHunger,
        sheepDogShares,
        protectionStatus
      ] = await Promise.all([
        sheepService.getFormattedSheepBalance(),
        sheepService.getStakedSheepBalance(),
        sheepService.getFormattedTotalSheepBalance(),
        sheepService.getWolfCount(),
        sheepService.getHighestWolfHunger(),
        sheepService.getFormattedSheepDogShares(),
        sheepService.getProtectionStatus()
      ]);
      
      setBalances({
        sheep: sheepBalance,
        stakedSheep: stakedSheepBalance,
        totalSheep: totalSheepBalance,
        wolfCount,
        wolfHunger: highestWolfHunger,
        sheepDogShares,
        protectionStatus
      });
      
    } catch (err) {
      console.error('Error loading balances:', err);
      setError('Failed to load token balances. Please check your wallet connection.');
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    loadBalances();
  }, []);
  
  const formatBalance = (balance: string) => {
    return parseFloat(balance).toLocaleString(undefined, { 
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };
  
  const getProtectionStatusText = (status: number) => {
    return `${Math.round(status)}% Protected`;
  };
  
  const getProtectionStatusColor = (status: number) => {
    if (status >= 100) return 'text-green-500';
    if (status >= 50) return 'text-amber-500';
    return 'text-red-500';
  };
  
  return (
    <Card className="p-6 bg-white dark:bg-gray-800 shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Your Token Balances</h3>
        <Button 
          variant="outline" 
          size="sm"
          className="flex items-center"
          onClick={loadBalances}
          disabled={isLoading}
        >
          <ArrowPathIcon className={`w-4 h-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>
      
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-md flex items-start">
          <ExclamationCircleIcon className="w-5 h-5 text-red-500 mt-0.5 mr-2 flex-shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}
      
      {!isConnected && !isLoading && !error && (
        <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-md">
          <p className="text-sm text-amber-700 dark:text-amber-300">
            Connect your wallet to view your token balances.
          </p>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* SHEEP balance card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/20 rounded-lg p-4"
        >
          <div className="flex justify-between">
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">SHEEP Tokens</div>
              <div className="text-xl font-bold text-gray-900 dark:text-white">
                {isLoading ? (
                  <div className="h-7 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                ) : (
                  formatBalance(balances.totalSheep)
                )}
              </div>
              <div className="mt-2">
                <div className="text-xs text-gray-500 dark:text-gray-400 flex justify-between">
                  <span>Staked:</span>
                  <span className="font-medium text-gray-700 dark:text-gray-200">
                    {isLoading ? (
                      <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                    ) : (
                      formatBalance(balances.stakedSheep)
                    )}
                  </span>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 flex justify-between mt-1">
                  <span>Wallet:</span>
                  <span className="font-medium text-gray-700 dark:text-gray-200">
                    {isLoading ? (
                      <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                    ) : (
                      formatBalance(balances.sheep)
                    )}
                  </span>
                </div>
              </div>
            </div>
            <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-700/30 flex items-center justify-center">
              <CurrencyDollarIcon className="h-6 w-6 text-blue-500 dark:text-blue-400" />
            </div>
          </div>
        </motion.div>
        
        {/* WOLF balance card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-800/20 rounded-lg p-4"
        >
          <div className="flex justify-between">
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">WOLF NFTs</div>
              <div className="text-xl font-bold text-gray-900 dark:text-white">
                {isLoading ? (
                  <div className="h-7 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                ) : (
                  balances.wolfCount
                )}
              </div>
              <div className="mt-2">
                <div className="text-xs text-gray-500 dark:text-gray-400 flex justify-between">
                  <span>Hunger:</span>
                  <span className="font-medium text-gray-700 dark:text-gray-200">
                    {isLoading ? (
                      <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                    ) : (
                      `${parseFloat(balances.wolfHunger).toFixed(0)}%`
                    )}
                  </span>
                </div>
              </div>
            </div>
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-700/30 flex items-center justify-center">
              <svg className="h-6 w-6 text-red-500 dark:text-red-400" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 5L10 3H5L3 5V10L5 12L3 14V19L5 21H10L12 19V14L10 12L12 10V5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M14 5L16 3H21L23 5V10L21 12L23 14V19L21 21H16L14 19V14L16 12L14 10V5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
        </motion.div>
        
        {/* SHEEPDOG balance card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-800/20 rounded-lg p-4"
        >
          <div className="flex justify-between">
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">SHEEPDOG Shares</div>
              <div className="text-xl font-bold text-gray-900 dark:text-white">
                {isLoading ? (
                  <div className="h-7 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                ) : (
                  formatBalance(balances.sheepDogShares)
                )}
              </div>
              <div className="mt-2">
                <div className="text-xs text-gray-500 dark:text-gray-400 flex justify-between">
                  <span>Protection:</span>
                  <span className={`font-medium ${getProtectionStatusColor(balances.protectionStatus)}`}>
                    {isLoading ? (
                      <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                    ) : (
                      getProtectionStatusText(balances.protectionStatus)
                    )}
                  </span>
                </div>
              </div>
            </div>
            <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-700/30 flex items-center justify-center">
              <ShieldCheckIcon className="h-6 w-6 text-amber-500 dark:text-amber-400" />
            </div>
          </div>
        </motion.div>
      </div>
      
      {isConnected && (
        <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
          <p>Last updated: {new Date().toLocaleTimeString()}</p>
        </div>
      )}
    </Card>
  );
} 