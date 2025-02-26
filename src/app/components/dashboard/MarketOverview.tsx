'use client';

import { ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/solid';
import { MarketData } from '../../services/btbApi';

interface MarketOverviewProps {
  marketData: MarketData | null;
}

export default function MarketOverview({ marketData }: MarketOverviewProps) {
  // Format number as currency or percentage
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      compactDisplay: 'short',
      maximumFractionDigits: 1
    }).format(value);
  };

  const formatPercentage = (value: number): string => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
  };

  if (!marketData) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
          Market Overview
        </h2>
        <div className="flex items-center justify-center h-40">
          <p className="text-gray-500 dark:text-gray-400">
            Market data not available. Connect your wallet to see market insights.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
        Market Overview
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {marketData.topProtocols.map((protocol) => (
          <div
            key={protocol.name}
            className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                {protocol.name}
              </h3>
              <div
                className={`flex items-center text-sm ${
                  protocol.change24h >= 0
                    ? 'text-green-600 dark:text-green-500'
                    : 'text-red-600 dark:text-red-500'
                }`}
              >
                {protocol.change24h >= 0 ? (
                  <ArrowUpIcon className="h-4 w-4 mr-1" />
                ) : (
                  <ArrowDownIcon className="h-4 w-4 mr-1" />
                )}
                {formatPercentage(protocol.change24h)}
              </div>
            </div>

            <div className="flex flex-col space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">TVL</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {formatCurrency(protocol.tvl)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Top Pairs by Volume
        </h3>
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
            <thead className="bg-gray-100 dark:bg-gray-800">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                >
                  Pair
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                >
                  24h Volume
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                >
                  APY
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-700 divide-y divide-gray-200 dark:divide-gray-600">
              {marketData.topPairs.map((pair) => (
                <tr key={pair.name} className="hover:bg-gray-50 dark:hover:bg-gray-600">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    {pair.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {formatCurrency(pair.volume24h)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {pair.apy.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
