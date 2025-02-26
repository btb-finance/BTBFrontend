import React from 'react';
import { Pool } from '@/app/types/uniswap';
import { formatCurrency, formatPercent, formatAddress } from '@/app/utils/formatting';
import { Skeleton } from '@/app/components/ui/skeleton';

interface PoolsListProps {
  pools: Pool[];
  selectedPool: Pool | null;
  onSelectPool: (pool: Pool) => void;
  isLoading: boolean;
}

export const PoolsList: React.FC<PoolsListProps> = ({ 
  pools, 
  selectedPool, 
  onSelectPool,
  isLoading 
}) => {
  // If loading, show skeleton UI
  if (isLoading) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-md p-4 space-y-2">
        <h2 className="text-xl font-bold mb-4">Pools</h2>
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full bg-gray-200 dark:bg-gray-700 rounded-md mb-3" />
        ))}
      </div>
    );
  }

  // If no pools, show message
  if (pools.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-md p-4">
        <h2 className="text-xl font-bold mb-4">Pools</h2>
        <p className="text-gray-500 dark:text-gray-400">No pools found.</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg shadow-md p-4">
      <h2 className="text-xl font-bold mb-4">Pools</h2>
      <div className="space-y-2">
        {pools.map((pool) => {
          // Safe token data display
          const token0Symbol = pool.token0?.symbol || 'UNK';
          const token1Symbol = pool.token1?.symbol || 'UNK';
          
          return (
            <div
              key={pool.address}
              className={`p-3 rounded-md cursor-pointer transition-all ${
                selectedPool?.address === pool.address
                  ? 'bg-blue-100 dark:bg-blue-900/30 border-l-4 border-blue-500'
                  : 'bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700'
              }`}
              onClick={() => onSelectPool(pool)}
            >
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-medium">
                    {token0Symbol}/{token1Symbol}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {formatAddress(pool.address)}
                  </div>
                  <div className="text-xs mt-1">
                    Fee: {(pool.fee / 10000).toFixed(2)}%
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium">
                    {formatCurrency(pool.tvl)}
                  </div>
                  <div className={`font-medium ${
                    pool.apr > 10 ? 'text-green-600 dark:text-green-400' : ''
                  }`}>
                    {formatPercent(pool.apr)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
