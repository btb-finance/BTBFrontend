'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  TrophyIcon,
  CheckCircleIcon,
  XCircleIcon,
  CurrencyDollarIcon
} from '@heroicons/react/24/outline';
import { Card } from '@/app/components/ui/card';
import { megapotAPI } from '@/app/lib/megapot-api';
import { useAccount } from 'wagmi';

interface DailyPrizeWinner {
  jackpotRoundId: string;
  claimTransactionHash: string;
  claimedTimestamp: string;
  prizeValue: string;
}

export default function DailyPrizeChecker() {
  const { address } = useAccount();
  const [prizes, setPrizes] = useState<DailyPrizeWinner[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalEarned, setTotalEarned] = useState(0);

  const checkPrizes = async () => {
    if (!address) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await megapotAPI.getDailyPrizeWinners(address);
      setPrizes(response.winners || []);
      
      const total = response.winners?.reduce((sum, winner) => 
        sum + parseFloat(winner.prizeValue || '0'), 0
      ) || 0;
      setTotalEarned(total);
      
    } catch (err) {
      setError('Failed to check prizes. Please try again.');
      console.error('Prize check error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (address) {
      checkPrizes();
    }
  }, [address]);

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (!address) {
    return (
      <Card className="p-6 text-center">
        <TrophyIcon className="w-12 h-12 mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Connect Wallet to Check Prizes
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          Connect your wallet to see if you've won any guaranteed daily prizes!
        </p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <motion.div 
              className="p-3 rounded-full bg-gradient-to-r from-green-500 to-emerald-600 mr-3"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <TrophyIcon className="w-6 h-6 text-white" />
            </motion.div>
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                Your Daily Prizes
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Check your guaranteed daily prize wins
              </p>
            </div>
          </div>
          
          {totalEarned > 0 && (
            <div className="text-right">
              <p className="text-2xl font-bold text-green-600">${totalEarned.toFixed(2)}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Earned</p>
            </div>
          )}
        </div>

        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-8"
            >
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400">Checking your prizes...</p>
            </motion.div>
          ) : error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-8"
            >
              <XCircleIcon className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <p className="text-red-600 mb-4">{error}</p>
              <button
                onClick={checkPrizes}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Try Again
              </button>
            </motion.div>
          ) : prizes.length > 0 ? (
            <motion.div
              key="prizes"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="space-y-3">
                {prizes.map((prize, index) => (
                  <motion.div
                    key={`${prize.jackpotRoundId}-${index}`}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800"
                  >
                    <div className="flex items-center">
                      <CheckCircleIcon className="w-6 h-6 text-green-600 mr-3" />
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">
                          Prize Won!
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Round {prize.jackpotRoundId} • {formatDate(prize.claimedTimestamp)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-green-600">
                        ${parseFloat(prize.prizeValue || '0').toFixed(2)}
                      </p>
                      {prize.claimTransactionHash && (
                        <a
                          href={`https://basescan.org/tx/${prize.claimTransactionHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline"
                        >
                          View TX
                        </a>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="no-prizes"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-8"
            >
              <CurrencyDollarIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                No Prizes Yet
              </h4>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Keep playing! Every ticket gives you a chance at daily prizes.
              </p>
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  💡 <strong>Tip:</strong> Winners are selected daily after the jackpot drawing. 
                  31 prizes worth $100 total are distributed every day!
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={checkPrizes}
            disabled={loading}
            className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Checking...' : 'Refresh Prizes'}
          </button>
        </div>
      </div>
    </Card>
  );
}