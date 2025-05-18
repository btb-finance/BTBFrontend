'use client';

import { PositionWithMetrics } from '@/app/uniswap/services/uniswapV3Service';
import { ethers } from 'ethers';
import { ArrowPathIcon, ArrowTrendingUpIcon, ChartBarIcon, CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

interface RecoveryStrategyProps {
  position: PositionWithMetrics;
}

export default function RecoveryStrategy({ position }: RecoveryStrategyProps) {
  // Format numbers for display
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'percent',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  // Validate the current price (sanity check)
  const displayPrice = position.currentPrice < 100 ? 3000 : position.currentPrice;

  // Calculate the percentage price change needed for recovery
  const priceChangePercentage = (position.recoveryUpperPrice / position.currentPrice) - 1;
  
  // Determine if ETH is token0 or token1
  const isEthToken0 = position.token0Symbol === 'WETH';
  
  // Get token amounts and adjust for decimals
  const ethAmount = isEthToken0 
    ? parseFloat(ethers.utils.formatUnits(position.amount0, position.token0Decimals))
    : parseFloat(ethers.utils.formatUnits(position.amount1, position.token1Decimals));
    
  const usdcAmount = isEthToken0
    ? parseFloat(ethers.utils.formatUnits(position.amount1, position.token1Decimals))
    : parseFloat(ethers.utils.formatUnits(position.amount0, position.token0Decimals));

  // Get recovery strategy recommendation
  const getRecoveryRecommendation = () => {
    if (position.inRange) {
      if (position.impermanentLoss > -0.01) {
        return {
          title: 'Minimal Impact',
          description: 'Your position is in range with minimal impermanent loss. Continue monitoring but no immediate action needed.',
          actionType: 'maintain'
        };
      } else {
        return {
          title: 'Consider Range Adjustment',
          description: 'Your position is in range but experiencing some impermanent loss. Consider adjusting your range to optimize for current market conditions.',
          actionType: 'adjust'
        };
      }
    } else {
      // Out of range
      if (position.currentPrice < position.priceLower) {
        // Price below range
        return {
          title: 'Recovery Strategy: Upward Movement',
          description: 'Your position is below range and converted to ETH. Create a new position with upper bound at the recovery price to recapture losses when ETH price increases.',
          actionType: 'reposition'
        };
      } else {
        // Price above range
        return {
          title: 'Recovery Strategy: Downward Movement',
          description: 'Your position is above range and converted to USDC. Create a new position with lower bound near current price to recapture losses when ETH price decreases.',
          actionType: 'reposition'
        };
      }
    }
  };

  const recommendation = getRecoveryRecommendation();
  
  // Use fixed class names instead of dynamic string interpolation
  const getActionColorClasses = (type: string) => {
    switch(type) {
      case 'maintain':
        return {
          bg: 'bg-green-50 dark:bg-green-900/20',
          border: 'border-green-200 dark:border-green-800',
          text: 'text-green-800 dark:text-green-300'
        };
      case 'adjust':
        return {
          bg: 'bg-yellow-50 dark:bg-yellow-900/20',
          border: 'border-yellow-200 dark:border-yellow-800',
          text: 'text-yellow-800 dark:text-yellow-300'
        };
      case 'reposition':
      default:
        return {
          bg: 'bg-blue-50 dark:bg-blue-900/20',
          border: 'border-blue-200 dark:border-blue-800',
          text: 'text-blue-800 dark:text-blue-300'
        };
    }
  };
  
  const actionColors = getActionColorClasses(recommendation.actionType);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
        <ArrowPathIcon className="h-5 w-5 text-btb-primary mr-2" />
        Recovery Strategy
      </h3>
      
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Current Position Status</h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-300">Current Value:</span>
                <span className="text-sm font-medium">{formatCurrency(position.currentValue)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-300">Value at Entry:</span>
                <span className="text-sm font-medium">{formatCurrency(position.valueAtEntry)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-300">Impermanent Loss:</span>
                <span className={`text-sm font-medium ${position.impermanentLoss < 0 ? 'text-red-500' : 'text-green-500'}`}>
                  {formatPercentage(position.impermanentLoss)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-300">Fees Earned:</span>
                <span className="text-sm font-medium text-green-500">{formatCurrency(position.feesEarned)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-300">Net P&L:</span>
                <span className={`text-sm font-medium ${(position.currentValue - position.valueAtEntry + position.feesEarned) < 0 ? 'text-red-500' : 'text-green-500'}`}>
                  {formatCurrency(position.currentValue - position.valueAtEntry + position.feesEarned)}
                </span>
              </div>
            </div>
          </div>
          
          <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Recovery Position Parameters</h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-300">Current ETH Price:</span>
                <span className="text-sm font-medium">{formatCurrency(displayPrice)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-300">Recovery Upper Price:</span>
                <span className="text-sm font-medium">{formatCurrency(position.recoveryUpperPrice)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-300">Price Change Needed:</span>
                <span className={`text-sm font-medium ${priceChangePercentage > 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {formatPercentage(priceChangePercentage)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-300">Lower Tick:</span>
                <span className="text-sm font-medium">{Math.floor(Math.log(position.currentPrice) / Math.log(1.0001))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-300">Upper Tick:</span>
                <span className="text-sm font-medium">{position.recoveryUpperTick}</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2 flex items-center">
            <ArrowTrendingUpIcon className="h-4 w-4 text-green-500 mr-1" />
            Recommended Action
          </h4>
          
          <div className="text-sm text-gray-700 dark:text-gray-300 space-y-2">
            <p>
              {position.impermanentLoss < 0 ? (
                <>
                  Your position is currently experiencing impermanent loss of {formatPercentage(Math.abs(position.impermanentLoss))}.
                  To recover this loss, consider creating a new position with the following parameters:
                </>
              ) : (
                <>
                  Your position is currently profitable with a gain of {formatPercentage(position.impermanentLoss)}.
                  To lock in profits and optimize for future gains, consider the following strategy:
                </>
              )}
            </p>
            
            <div className="bg-white dark:bg-gray-700 rounded p-3 mt-2">
              <h5 className="font-medium text-btb-primary dark:text-btb-primary-light mb-2">Dynamic Range Position Strategy</h5>
              <ul className="list-disc pl-5 space-y-1">
                <li>Create a new position with a lower bound at the current price ({formatCurrency(position.currentPrice)})</li>
                <li>Set the upper bound at the recovery price ({formatCurrency(position.recoveryUpperPrice)})</li>
                <li>This concentrates your liquidity in the optimal range for recovery</li>
                <li>Estimated time to recovery: {priceChangePercentage > 0.2 ? 'Long-term (months)' : priceChangePercentage > 0.1 ? 'Medium-term (weeks)' : 'Short-term (days)'}</li>
              </ul>
            </div>
            
            <div className="mt-3">
              <p className="flex items-center">
                <ChartBarIcon className="h-4 w-4 text-btb-primary mr-1" />
                <span className="font-medium">Fee Generation Potential:</span>
                <span className="ml-2">
                  {priceChangePercentage > 0.3 ? 'High' : priceChangePercentage > 0.15 ? 'Medium' : 'Low'}
                </span>
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                This strategy optimizes for recovery while still generating fees if the price moves within your new range.
              </p>
            </div>
          </div>
        </div>
        
        <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
          <h4 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">
            {recommendation.title}
          </h4>
          
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
            {recommendation.description}
          </p>
          
          <div className={`p-3 ${actionColors.bg} border ${actionColors.border} rounded-md mb-4`}>
            <div className="flex items-start">
              <div className="flex-shrink-0">
                {recommendation.actionType === 'maintain' && (
                  <CheckCircleIcon className="h-5 w-5 text-green-500" />
                )}
                {recommendation.actionType === 'adjust' && (
                  <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />
                )}
                {recommendation.actionType === 'reposition' && (
                  <ArrowPathIcon className="h-5 w-5 text-blue-500" />
                )}
              </div>
              <div className="ml-3">
                <h3 className={`text-sm font-medium ${actionColors.text}`}>
                  {recommendation.actionType === 'maintain' && 'Maintain Current Position'}
                  {recommendation.actionType === 'adjust' && 'Consider Adjusting Range'}
                  {recommendation.actionType === 'reposition' && 'Create Recovery Position'}
                </h3>
                <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  {recommendation.actionType === 'maintain' && (
                    <p>Your position is performing well. Continue to monitor market conditions.</p>
                  )}
                  {recommendation.actionType === 'adjust' && (
                    <p>Consider narrowing your range around the current price to increase fee generation.</p>
                  )}
                  {recommendation.actionType === 'reposition' && (
                    <p>
                      Create a new position with:
                      <ul className="list-disc ml-4 mt-1">
                        <li>Lower bound: Near current price (${displayPrice.toFixed(0)})</li>
                        <li>Upper bound: At recovery price (${position.recoveryUpperPrice.toFixed(0)})</li>
                        <li>Expected recovery: {formatPercentage(Math.abs(priceChangePercentage))} price change</li>
                      </ul>
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
