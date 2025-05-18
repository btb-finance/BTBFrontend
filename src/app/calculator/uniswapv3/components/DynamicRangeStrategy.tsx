'use client';

import { ArrowPathIcon, ArrowTrendingUpIcon, ArrowTrendingDownIcon } from '@heroicons/react/24/outline';

export default function DynamicRangeStrategy() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Dynamic Range Positioning Strategy</h2>
        <div className="flex items-center bg-blue-100 dark:bg-blue-900/30 px-3 py-1 rounded-full">
          <ArrowPathIcon className="h-4 w-4 text-blue-600 dark:text-blue-400 mr-1.5" />
          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Coming Soon</span>
        </div>
      </div>
      
      <p className="text-gray-600 dark:text-gray-300 mb-6">
        Dynamic Range Positioning (DRP) is an innovative approach to liquidity management that continuously 
        recalibrates position ranges based on price movements and profit/loss status.
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
          <div className="flex items-center mb-3">
            <ArrowTrendingUpIcon className="h-5 w-5 text-green-500 mr-2" />
            <h3 className="text-md font-medium text-gray-900 dark:text-white">Uptrend Strategy</h3>
          </div>
          <ol className="list-decimal pl-5 text-sm text-gray-600 dark:text-gray-300 space-y-2">
            <li>Start with a balanced position (e.g., symmetric range of -10%/+10%)</li>
            <li>When price increases beyond your upper range, position converts to stablecoin</li>
            <li>Create an asymmetric position with tight upper bound (+2%) and wider lower bound (-18%)</li>
            <li>This reduces capital at risk while allowing for continued upside capture</li>
          </ol>
        </div>
        
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
          <div className="flex items-center mb-3">
            <ArrowTrendingDownIcon className="h-5 w-5 text-red-500 mr-2" />
            <h3 className="text-md font-medium text-gray-900 dark:text-white">Downtrend Recovery</h3>
          </div>
          <ol className="list-decimal pl-5 text-sm text-gray-600 dark:text-gray-300 space-y-2">
            <li>Start with a balanced position (e.g., symmetric range of -10%/+10%)</li>
            <li>When price decreases below your lower range, position converts to volatile asset</li>
            <li>Calculate the price target needed to recover the loss</li>
            <li>Create a recovery position with upper bound at recovery price and lower bound close to current price</li>
          </ol>
        </div>
      </div>
      
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-6">
        <h3 className="text-md font-medium text-blue-700 dark:text-blue-300 mb-2">Benefits Over Traditional Strategies</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ul className="list-disc pl-5 text-sm text-blue-600 dark:text-blue-400 space-y-1">
            <li>Enhanced Capital Efficiency</li>
            <li>Systematic Risk Management</li>
            <li>Impermanent Loss Mitigation</li>
          </ul>
          <ul className="list-disc pl-5 text-sm text-blue-600 dark:text-blue-400 space-y-1">
            <li>Fee Optimization</li>
            <li>Automated Execution</li>
            <li>Adaptive to Market Conditions</li>
          </ul>
        </div>
      </div>
      
      <div className="text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          BTB Finance is exploring the integration of Dynamic Range Positioning as a new vault strategy.
          This would allow users to deposit assets into a DRP vault and have positions automatically managed.
        </p>
        <button 
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md font-medium transition-colors"
          disabled
        >
          Join Waitlist
        </button>
      </div>
    </div>
  );
}
