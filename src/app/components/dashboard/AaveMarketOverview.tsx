'use client';

import { Card, CardContent } from '@/app/components/ui/card';
import { format } from 'date-fns';

export interface AaveMarketData {
  tvl: number;
  totalLiquidity: number;
  totalBorrowed: number;
  depositApy: number;
  borrowApy: number;
}

interface AaveMarketOverviewProps {
  marketData: AaveMarketData;
}

export default function AaveMarketOverview({ marketData }: AaveMarketOverviewProps) {
  // Format currency values
  const formatCurrency = (value: number): string => {
    if (!value && value !== 0) return 'Loading...';
    
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      compactDisplay: 'short',
      maximumFractionDigits: 2
    }).format(value);
  };

  // Format percentage
  const formatPercentage = (value: number): string => {
    if (!value && value !== 0) return 'Loading...';
    return `${(value * 100).toFixed(2)}%`;
  };

  // Current date
  const currentDate = format(new Date(), 'MMMM d, yyyy');

  return (
    <Card className="mb-6">
      <CardContent className="pt-6">
        <div className="mb-4">
          <h2 className="text-xl font-bold">Market Overview</h2>
          <p className="text-sm text-gray-500">Updated: {currentDate}</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-5">
            <h3 className="text-sm text-gray-500 font-medium mb-2">Total Value Locked</h3>
            <p className="text-2xl font-bold">{formatCurrency(marketData?.tvl)}</p>
          </div>
          
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-5">
            <h3 className="text-sm text-gray-500 font-medium mb-2">Supply APY</h3>
            <p className="text-2xl font-bold text-green-600">{formatPercentage(marketData?.depositApy)}</p>
          </div>
          
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-5">
            <h3 className="text-sm text-gray-500 font-medium mb-2">Borrow APY</h3>
            <p className="text-2xl font-bold text-blue-600">{formatPercentage(marketData?.borrowApy)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
