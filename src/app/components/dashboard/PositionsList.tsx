'use client';

import { useState } from 'react';
import { ChevronRightIcon } from '@heroicons/react/24/outline';

const positions = [
  {
    id: 1,
    protocol: 'Uniswap V3',
    pair: 'ETH/USDC',
    tvl: '$45,230.00',
    apy: '28.4%',
    rewards: '$234.12',
    risk: 'Medium',
    health: 'Healthy'
  },
  {
    id: 2,
    protocol: 'Curve Finance',
    pair: 'stETH/ETH',
    tvl: '$32,180.00',
    apy: '12.8%',
    rewards: '$89.45',
    risk: 'Low',
    health: 'Healthy'
  },
  {
    id: 3,
    protocol: 'Balancer',
    pair: 'BTC/ETH/USDC',
    tvl: '$28,940.00',
    apy: '18.2%',
    rewards: '$142.30',
    risk: 'Medium',
    health: 'Warning'
  },
  {
    id: 4,
    protocol: 'Aave V3',
    pair: 'ETH Supply',
    tvl: '$18,242.00',
    apy: '4.2%',
    rewards: '$21.15',
    risk: 'Low',
    health: 'Healthy'
  }
];

export default function PositionsList() {
  const [expandedPosition, setExpandedPosition] = useState<number | null>(null);

  const getRiskColor = (risk: string) => {
    switch (risk.toLowerCase()) {
      case 'low':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'high':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const getHealthColor = (health: string) => {
    switch (health.toLowerCase()) {
      case 'healthy':
        return 'text-green-600 dark:text-green-500';
      case 'warning':
        return 'text-yellow-600 dark:text-yellow-500';
      case 'danger':
        return 'text-red-600 dark:text-red-500';
      default:
        return 'text-gray-600 dark:text-gray-500';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      <div className="p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
          Active Positions
        </h2>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead>
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Protocol/Pair
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  TVL
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  APY
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Rewards
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Risk Level
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Health
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {positions.map((position) => (
                <tr
                  key={position.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {position.protocol}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {position.pair}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">
                      {position.tvl}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">
                      {position.apy}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">
                      {position.rewards}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getRiskColor(position.risk)}`}>
                      {position.risk}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`text-sm font-medium ${getHealthColor(position.health)}`}>
                      {position.health}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => setExpandedPosition(
                        expandedPosition === position.id ? null : position.id
                      )}
                      className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      Details
                      <ChevronRightIcon className="h-4 w-4 inline ml-1" />
                    </button>
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
