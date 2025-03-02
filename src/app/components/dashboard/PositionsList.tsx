'use client';

import { useState } from 'react';
import { ChevronRightIcon } from '@heroicons/react/24/outline';

// Local type definition
export interface Position {
  id: string;
  type: string; // 'liquidity' | 'lending' | 'staking'
  asset: string;
  protocol: string;
  value: string;
  rewards: string;
  apy: string;
  risk: string; // 'low' | 'medium' | 'high'
  startDate: string;
  endDate?: string;
  pair?: string;
  tvl?: string | number;
  health?: string;
  details?: {
    [key: string]: string;
  };
}

interface PositionsListProps {
  positions: Position[];
}

export default function PositionsList({ positions }: PositionsListProps) {
  const [expandedPosition, setExpandedPosition] = useState<string | null>(null);
  
  // Format currency with null handling
  const formatCurrency = (value: string | number | undefined): string => {
    if (value === undefined) return '$0.00';
    if (typeof value === 'string') {
      // Handle string inputs (like '$12,450.75')
      if (value.startsWith('$')) return value;
      const numValue = parseFloat(value.replace(/,/g, ''));
      if (isNaN(numValue)) return '$0.00';
      value = numValue;
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1
    }).format(value);
  };

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

  const getHealthColor = (health: string | undefined) => {
    if (!health) return '';
    switch (health.toLowerCase()) {
      case 'healthy':
      case 'good':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'critical':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const toggleExpand = (positionId: string) => {
    setExpandedPosition(expandedPosition === positionId ? null : positionId);
  };



  if (!positions || positions.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
          Active Positions
        </h2>
        <div className="flex items-center justify-center h-40">
          <p className="text-gray-500 dark:text-gray-400">
            No positions found. Connect your wallet to see your active positions.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">Your Active Positions</h2>
        {positions.length > 0 && (
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {positions.length} positions found
          </span>
        )}
      </div>
      
      {positions.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500 dark:text-gray-400">No active positions found</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead>
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Protocol / Pair
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  TVL
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  APY
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Risk
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Health
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {positions.map((position) => (
                <tr 
                  key={position.id} 
                  className={expandedPosition === position.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="ml-4">
                        <div className="text-sm font-medium">{position.protocol}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">{position.pair}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{formatCurrency(position.tvl)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className="text-gray-500 dark:text-gray-400">
                      {position.apy !== "N/A"
                        ? `${position.apy}%`
                        : position.apy}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getRiskColor(position.risk)}`}>
                      {position.risk}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getHealthColor(position.health)}`}>
                      {position.health}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    <button 
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                      onClick={() => toggleExpand(position.id)}
                    >
                      <ChevronRightIcon 
                        className={`h-5 w-5 transition-transform duration-200 ${expandedPosition === position.id ? 'transform rotate-90' : ''}`} 
                      />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
