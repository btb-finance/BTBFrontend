'use client';

import { ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/solid';
import { useEffect, useRef, useMemo } from 'react';

// Local type definition
export interface Portfolio {
  totalValueUSD: string;
  totalValue?: string | number;
  totalEarningsUSD: string;
  averageApy: string;
  activePositions: number;
  totalChange24h: string;
  change24h?: number | string;
  totalChangePercentage24h: string;
  changePercentage24h?: string | number;
  assets: {
    tokens: number;
    liquidity: number;
    lending: number;
    staking: number;
    active?: number;
    total?: number;
  };
  history: Array<{
    timestamp: number;
    value: number;
  }>;
}

interface PortfolioOverviewProps {
  portfolioData: Portfolio | null;
}

export default function PortfolioOverview({ portfolioData }: PortfolioOverviewProps) {
  // Format number as currency
  const formatCurrency = (value: number | string): string => {
    // Handle string inputs (like '$12,450.75')
    if (typeof value === 'string') {
      if (value.startsWith('$')) return value;
      const numValue = parseFloat(value.replace(/,/g, ''));
      if (isNaN(numValue)) return value;
      value = numValue;
    }
    
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2
    }).format(value);
  };

  // If no data is provided, use empty stats
  const stats = useMemo(() => {
    if (!portfolioData) return [];
    
    return [
      {
        name: '24h Change',
        value: portfolioData.change24h !== undefined 
          ? formatCurrency(portfolioData.change24h)
          : '-',
        changeType: portfolioData.change24h !== undefined && Number(portfolioData.change24h) < 0 ? 'negative' : 'positive',
      },
      {
        name: 'Total Value',
        value: portfolioData.totalValue !== undefined 
          ? formatCurrency(portfolioData.totalValue)
          : '-',
      },
      {
        name: 'Active Assets',
        value: portfolioData.assets.active !== undefined ? portfolioData.assets.active.toString() : '0',
      },
      {
        name: 'Total Assets',
        value: portfolioData.assets.total !== undefined ? portfolioData.assets.total.toString() : '0',
      },
    ];
  }, [portfolioData]);

  if (!portfolioData) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
          Portfolio Overview
        </h2>
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-500 dark:text-gray-400">
            Connect your wallet to view portfolio
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <div key={index} className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
            <p className="text-sm text-gray-500 dark:text-gray-400">{stat.name}</p>
            <p className="text-xl font-semibold mt-1">{stat.value}</p>
            {stat.changeType && (
              <div className="flex items-center mt-2">
                {stat.changeType === 'negative' ? (
                  <ArrowDownIcon className="w-4 h-4 text-red-500 mr-1" />
                ) : stat.changeType === 'positive' ? (
                  <ArrowUpIcon className="w-4 h-4 text-green-500 mr-1" />
                ) : null}
                <span
                  className={`text-sm ${
                    stat.changeType === 'negative'
                      ? 'text-red-500'
                      : stat.changeType === 'positive'
                      ? 'text-green-500'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {portfolioData.changePercentage24h || portfolioData.totalChangePercentage24h || '0'}%
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
