'use client';

import { ArrowTrendingUpIcon, ArrowTrendingDownIcon } from '@heroicons/react/24/outline';
import { ethers } from 'ethers';
import { PositionWithMetrics } from '@/app/uniswap/services/uniswapV3Service';

interface PositionSummaryProps {
  position: PositionWithMetrics;
}

export default function PositionSummary({ position }: PositionSummaryProps) {
  const formatPercent = (value: number): string => {
    return `${(value * 100).toFixed(2)}%`;
  };

  const formatUSD = (value: number): string => {
    return `$${value.toFixed(2)}`;
  };

  // Format token amounts based on their decimals
  const formatTokenAmount = (amount: string, decimals: number): string => {
    return parseFloat(ethers.utils.formatUnits(amount, decimals)).toFixed(6);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <div className="space-y-6">
        {/* Position Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex -space-x-1">
              <img 
                src="/images/eth-logo.png" 
                alt="ETH" 
                className="w-6 h-6 rounded-full" 
              />
              <img 
                src="/images/usdc-logo.png" 
                alt="USDC" 
                className="w-6 h-6 rounded-full" 
              />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                ETH-USDC ({(position.fee / 10000).toFixed(2)}%)
              </h3>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                ID: {position.tokenId}
              </div>
            </div>
          </div>
          
          <div className={`px-2.5 py-1 rounded-full text-xs font-medium ${
            position.inRange 
              ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400' 
              : 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-400'
          }`}>
            {position.inRange ? 'In Range' : 'Out of Range'}
          </div>
        </div>
        
        {/* Position Stats */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-4">
          <div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Price Range</div>
            <div className="font-medium text-gray-900 dark:text-white">
              ${position.priceLower.toFixed(2)} - ${position.priceUpper.toFixed(2)}
            </div>
          </div>
          
          <div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Current Price</div>
            <div className="font-medium text-gray-900 dark:text-white">
              ${position.currentPrice.toFixed(2)}
            </div>
          </div>
          
          <div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Current Value</div>
            <div className="font-medium text-gray-900 dark:text-white">
              {formatUSD(position.currentValue)}
            </div>
          </div>
          
          <div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Impermanent Loss</div>
            <div className={`font-medium flex items-center ${
              position.impermanentLoss < 0 
                ? 'text-red-600 dark:text-red-400' 
                : 'text-green-600 dark:text-green-400'
            }`}>
              {position.impermanentLoss < 0 ? (
                <ArrowTrendingDownIcon className="h-4 w-4 mr-1" />
              ) : (
                <ArrowTrendingUpIcon className="h-4 w-4 mr-1" />
              )}
              {formatPercent(position.impermanentLoss)}
            </div>
          </div>
        </div>
        
        {/* Asset Composition */}
        <div>
          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Asset Composition</h4>
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center">
                <img 
                  src="/images/eth-logo.png" 
                  alt="ETH" 
                  className="w-5 h-5 rounded-full mr-2" 
                />
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {formatTokenAmount(position.amount0, position.token0Decimals)} {position.token0Symbol}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {formatUSD(parseFloat(ethers.utils.formatUnits(position.amount0, position.token0Decimals)) * position.currentPrice)}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center">
                <img 
                  src="/images/usdc-logo.png" 
                  alt="USDC" 
                  className="w-5 h-5 rounded-full mr-2" 
                />
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {formatTokenAmount(position.amount1, position.token1Decimals)} {position.token1Symbol}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {formatUSD(parseFloat(ethers.utils.formatUnits(position.amount1, position.token1Decimals)))}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Asset Distribution Bar */}
            <div className="mt-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-500 dark:text-gray-400">Asset Distribution</span>
              </div>
              <div className="h-2 w-full bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                {position.token0Percentage > 0 && (
                  <div 
                    className="h-full bg-blue-500" 
                    style={{ width: `${position.token0Percentage * 100}%` }}
                  ></div>
                )}
              </div>
              <div className="flex justify-between text-xs mt-1">
                <span className="text-blue-600 dark:text-blue-400">{formatPercent(position.token0Percentage)} {position.token0Symbol}</span>
                <span className="text-green-600 dark:text-green-400">{formatPercent(1 - position.token0Percentage)} {position.token1Symbol}</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Recovery Information */}
        {position.impermanentLoss < 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Recovery Information</h4>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-sm">
              <div className="flex items-start">
                <ArrowTrendingUpIcon className="h-5 w-5 text-blue-500 mr-2 mt-0.5" />
                <div>
                  <p className="text-blue-700 dark:text-blue-300 font-medium">
                    Recovery Price: ${position.recoveryUpperPrice.toFixed(2)}
                  </p>
                  <p className="text-blue-600 dark:text-blue-400 mt-1">
                    {position.currentPrice < position.priceLower
                      ? `ETH price needs to increase by ${formatPercent((position.recoveryUpperPrice - position.currentPrice) / position.currentPrice)} to recover from impermanent loss.`
                      : `ETH price needs to decrease by ${formatPercent((position.currentPrice - position.recoveryUpperPrice) / position.currentPrice)} to recover from impermanent loss.`
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
