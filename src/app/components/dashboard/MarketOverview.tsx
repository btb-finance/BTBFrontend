'use client';

import { ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/solid';

const marketData = [
  {
    protocol: 'Uniswap V3',
    tvl: '$8.2B',
    volume24h: '$1.2B',
    change24h: '+5.2%',
    topPairs: ['ETH/USDC', 'BTC/USDC', 'ETH/BTC'],
    changeType: 'increase'
  },
  {
    protocol: 'Curve Finance',
    tvl: '$3.8B',
    volume24h: '$580M',
    change24h: '-2.1%',
    topPairs: ['stETH/ETH', '3pool', 'tricrypto'],
    changeType: 'decrease'
  },
  {
    protocol: 'Balancer',
    tvl: '$2.1B',
    volume24h: '$320M',
    change24h: '+1.8%',
    topPairs: ['wstETH/ETH', 'BTC/ETH/USDC', 'auraBAL'],
    changeType: 'increase'
  },
  {
    protocol: 'Aave V3',
    tvl: '$5.4B',
    volume24h: '$890M',
    change24h: '+3.4%',
    topPairs: ['ETH', 'USDC', 'wBTC'],
    changeType: 'increase'
  }
];

export default function MarketOverview() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
        Market Overview
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {marketData.map((protocol) => (
          <div
            key={protocol.protocol}
            className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                {protocol.protocol}
              </h3>
              <div
                className={`flex items-center text-sm ${
                  protocol.changeType === 'increase'
                    ? 'text-green-600 dark:text-green-500'
                    : 'text-red-600 dark:text-red-500'
                }`}
              >
                {protocol.changeType === 'increase' ? (
                  <ArrowUpIcon className="h-4 w-4 mr-1" />
                ) : (
                  <ArrowDownIcon className="h-4 w-4 mr-1" />
                )}
                {protocol.change24h}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Total Value Locked
                </div>
                <div className="text-lg font-semibold text-gray-900 dark:text-white">
                  {protocol.tvl}
                </div>
              </div>

              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  24h Volume
                </div>
                <div className="text-lg font-semibold text-gray-900 dark:text-white">
                  {protocol.volume24h}
                </div>
              </div>

              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                  Top Pairs
                </div>
                <div className="flex flex-wrap gap-2">
                  {protocol.topPairs.map((pair) => (
                    <span
                      key={pair}
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
                    >
                      {pair}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
