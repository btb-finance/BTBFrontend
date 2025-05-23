import React from 'react';
import { Pool } from '../types/uniswap';
import { formatCurrency, formatPercent, formatAddress } from '@/app/utils/formatting';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Skeleton } from '@/app/components/ui/skeleton';
import { Info, Plus } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface PoolMetricsProps {
  pool: Pool | null;
  isLoading: boolean;
  onAddLiquidity?: (pool: Pool) => void;
}

// Generate some mock historical data for the chart
const generateHistoricalData = (baseAPR: number) => {
  const data = [];
  const now = new Date();
  
  for (let i = 30; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    
    // Generate some variation around the base APR
    const variation = (Math.random() - 0.5) * (baseAPR * 0.3);
    const apr = Math.max(0, baseAPR + variation);
    
    data.push({
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      apr: apr
    });
  }
  
  return data;
};

export const PoolMetrics: React.FC<PoolMetricsProps> = ({ pool, isLoading, onAddLiquidity }) => {
  // If loading, show skeleton UI
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-3/4 mb-2" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // If no pool is selected
  if (!pool) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pool Metrics</CardTitle>
          <CardDescription>Select a pool to view metrics</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center text-gray-500 dark:text-gray-400">
            <Info className="mx-auto h-10 w-10 mb-2" />
            <p>No pool selected. Please select a pool from the list to view its metrics.</p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  // Generate historical APR data based on the current pool's APR
  const historicalAPRData = generateHistoricalData(pool.apr);
  
  // Generate projected returns
  const projectedReturns = [
    { period: '1 month', return: (pool.apr / 12).toFixed(2) + '%', usd: formatCurrency((100 * pool.apr) / 12 / 100) },
    { period: '3 months', return: (pool.apr / 4).toFixed(2) + '%', usd: formatCurrency((100 * pool.apr) / 4 / 100) },
    { period: '6 months', return: (pool.apr / 2).toFixed(2) + '%', usd: formatCurrency((100 * pool.apr) / 2 / 100) },
    { period: '1 year', return: pool.apr.toFixed(2) + '%', usd: formatCurrency((100 * pool.apr) / 100) }
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>
                {pool.token0.symbol}/{pool.token1.symbol} Pool
              </CardTitle>
              <CardDescription>
                {formatAddress(pool.address)} | Fee: {(pool.fee / 10000).toFixed(2)}%
              </CardDescription>
            </div>
            <Button 
              onClick={() => onAddLiquidity && onAddLiquidity(pool)}
              size="sm"
              className="flex items-center gap-1"
            >
              <Plus className="h-4 w-4" />
              Add Liquidity
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-gray-50 dark:bg-slate-800 p-4 rounded-lg">
              <div className="text-sm text-gray-500 dark:text-gray-400">TVL</div>
              <div className="text-2xl font-bold">{formatCurrency(pool.tvl)}</div>
            </div>
            <div className="bg-gray-50 dark:bg-slate-800 p-4 rounded-lg">
              <div className="text-sm text-gray-500 dark:text-gray-400">APR</div>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {formatPercent(pool.apr)}
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-slate-800 p-4 rounded-lg">
              <div className="text-sm text-gray-500 dark:text-gray-400">24h Volume</div>
              <div className="text-2xl font-bold">{formatCurrency(pool.volume24h || 0)}</div>
            </div>
            <div className="bg-gray-50 dark:bg-slate-800 p-4 rounded-lg">
              <div className="text-sm text-gray-500 dark:text-gray-400">Fee Tier</div>
              <div className="text-2xl font-bold">{(pool.fee / 10000).toFixed(2)}%</div>
            </div>
          </div>
          
          <div className="mb-8">
            <h3 className="text-lg font-medium mb-4">Historical APR</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={historicalAPRData}
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="date" />
                  <YAxis 
                    tickFormatter={(value) => `${value.toFixed(1)}%`}
                    domain={[0, 'auto']}
                  />
                  <Tooltip formatter={(value) => [`${typeof value === 'number' ? value.toFixed(2) : value}%`, 'APR']} />
                  <Area 
                    type="monotone" 
                    dataKey="apr" 
                    stroke="#3B82F6" 
                    fill="#3B82F6" 
                    fillOpacity={0.3} 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-medium mb-4">Projected Returns (based on $100 investment)</h3>
            <div className="grid grid-cols-4 gap-2">
              {projectedReturns.map((item) => (
                <div key={item.period} className="bg-gray-50 dark:bg-slate-800 p-3 rounded-lg text-center">
                  <div className="text-sm text-gray-500 dark:text-gray-400">{item.period}</div>
                  <div className="font-medium text-blue-600 dark:text-blue-400">{item.return}</div>
                  <div className="text-xs">{item.usd}</div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
        <CardFooter className="text-xs text-gray-500 dark:text-gray-400">
          Note: Historical data and projected returns are simulated for illustrative purposes.
        </CardFooter>
      </Card>
    </div>
  );
};
