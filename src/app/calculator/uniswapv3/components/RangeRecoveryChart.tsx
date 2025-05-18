'use client';

import { useEffect, useRef, useState } from 'react';
import { Chart, registerables } from 'chart.js';
import { useTheme } from 'next-themes';
import { ethers } from 'ethers';
import { PositionWithMetrics } from '@/app/uniswap/services/uniswapV3Service';
import { ChartBarIcon } from '@heroicons/react/24/outline';
import { ResponsiveContainer, AreaChart, LineChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Area, Line, ReferenceLine } from 'recharts';

Chart.register(...registerables);

interface RangeRecoveryChartProps {
  position: PositionWithMetrics;
}

export default function RangeRecoveryChart({ position }: RangeRecoveryChartProps) {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);
  const { theme } = useTheme();
  const [chartType, setChartType] = useState('price');
  const [prices, setPrices] = useState<number[]>([]);
  const [positionValues, setPositionValues] = useState<number[]>([]);
  const [heldValues, setHeldValues] = useState<number[]>([]);

  const priceChangePercentage = (position.recoveryUpperPrice - position.currentPrice) / position.currentPrice * 100;
  const priceChangeNeeded = position.currentPrice > position.recoveryUpperPrice 
    ? -((position.currentPrice - position.recoveryUpperPrice) / position.currentPrice * 100)
    : ((position.recoveryUpperPrice - position.currentPrice) / position.currentPrice * 100);

  useEffect(() => {
    if (!chartRef.current) return;

    // Validate the current price (sanity check)
    const displayPrice = position.currentPrice < 100 ? 3000 : position.currentPrice;
    
    // Generate price points for chart visualization
    const priceMin = Math.min(position.priceLower * 0.8, displayPrice * 0.8);
    const priceMax = Math.max(position.priceUpper * 1.2, position.recoveryUpperPrice * 1.2);
    
    const priceStep = (priceMax - priceMin) / 100;
    const prices = Array.from({ length: 101 }, (_, i) => priceMin + i * priceStep);
    
    // Determine if ETH is token0 or token1
    const isEthToken0 = position.token0Symbol === 'WETH';
    
    // Function to calculate position value at different prices
    const calculatePositionValue = (price: number): number => {
      // Get token amounts and adjust for decimals
      const ethAmount = isEthToken0 
        ? parseFloat(ethers.utils.formatUnits(position.amount0, position.token0Decimals))
        : parseFloat(ethers.utils.formatUnits(position.amount1, position.token1Decimals));
        
      const usdcAmount = isEthToken0
        ? parseFloat(ethers.utils.formatUnits(position.amount1, position.token1Decimals))
        : parseFloat(ethers.utils.formatUnits(position.amount0, position.token0Decimals));
      
      if (price < position.priceLower) {
        // All token0 (e.g. ETH)
        const fullEthAmount = ethAmount + (usdcAmount / position.priceLower);
        return fullEthAmount * price;
      } else if (price > position.priceUpper) {
        // All token1 (e.g. USDC)
        return usdcAmount + (ethAmount * position.priceUpper);
      } else {
        // Mixed - simplified calculation for demo
        const priceRatio = (price - position.priceLower) / (position.priceUpper - position.priceLower);
        const currentEthAmount = ethAmount * (1 - priceRatio);
        const currentUsdcAmount = usdcAmount * priceRatio;
        return currentEthAmount * price + currentUsdcAmount;
      }
    };
    
    // Function to calculate value if held (not in LP)
    const calculateHeldValue = (price: number): number => {
      // Assume assets were held in the same ratio as entry
      const ethAmount = isEthToken0 
        ? parseFloat(ethers.utils.formatUnits(position.amount0, position.token0Decimals))
        : parseFloat(ethers.utils.formatUnits(position.amount1, position.token1Decimals));
        
      const usdcAmount = isEthToken0
        ? parseFloat(ethers.utils.formatUnits(position.amount1, position.token1Decimals))
        : parseFloat(ethers.utils.formatUnits(position.amount0, position.token0Decimals));
      
      const initialETH = ethAmount + (usdcAmount / position.priceLower);
      return initialETH * price;
    };
    
    // Function to calculate recovery position value
    const calculateRecoveryValue = (price: number): number => {
      if (price < displayPrice) {
        // All token0
        const amount0 = position.currentValue / displayPrice;
        return amount0 * price;
      } else if (price > position.recoveryUpperPrice) {
        // All token1
        return position.currentValue * (position.recoveryUpperPrice / displayPrice);
      } else {
        // Mixed - simplified calculation
        const priceRatio = (price - displayPrice) / (position.recoveryUpperPrice - displayPrice);
        const amount0 = (position.currentValue / displayPrice) * (1 - priceRatio);
        const amount1 = position.currentValue * priceRatio;
        return amount0 * price + amount1;
      }
    };
    
    // Calculate values for each price point
    const positionValues = prices.map(calculatePositionValue);
    const heldValues = prices.map(calculateHeldValue);
    const recoveryValues = prices.map(calculateRecoveryValue);
    
    // Update state variables
    setPrices(prices);
    setPositionValues(positionValues);
    setHeldValues(heldValues);
    
    // Chart colors based on theme
    const isDark = theme === 'dark';
    const textColor = isDark ? '#e5e7eb' : '#374151';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    
    // Destroy previous chart if it exists
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }
    
    // Cleanup function
    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [position, theme, chartType]);

  const priceRangeData = prices.map((price, i) => ({
    price,
    value: positionValues[i],
  }));

  const recoveryPathData = prices.map((price, i) => ({
    priceChange: (price - position.currentPrice) / position.currentPrice * 100,
    pnl: (positionValues[i] - position.currentValue) / position.currentValue * 100,
    hodl: (heldValues[i] - position.currentValue) / position.currentValue * 100,
  }));

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <div className="flex flex-col space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {chartType === 'price' ? 'Position Value by Price' : 'Recovery Path Analysis'}
          </h3>
          
          <div className="flex space-x-2">
            <button
              onClick={() => setChartType('price')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md ${
                chartType === 'price'
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                  : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
              }`}
            >
              Price Range
            </button>
            <button
              onClick={() => setChartType('recovery')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md ${
                chartType === 'recovery'
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                  : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
              }`}
            >
              Recovery Path
            </button>
          </div>
        </div>
        
        {prices.length > 0 && positionValues.length > 0 ? (
          <>
            {chartType === 'price' ? (
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={priceRangeData}
                    margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis 
                      dataKey="price" 
                      domain={[(dataMin: number) => Math.max(0, dataMin * 0.8), (dataMax: number) => dataMax * 1.2]} 
                      type="number"
                      tickFormatter={(value) => `$${value.toFixed(0)}`}
                      label={{ value: 'ETH Price (USD)', position: 'insideBottom', offset: -5 }}
                    />
                    <YAxis 
                      tickFormatter={(value) => `$${value.toFixed(0)}`}
                      label={{ value: 'Position Value', angle: -90, position: 'insideLeft' }}
                      yAxisId="left"
                    />
                    <CartesianGrid strokeDasharray="3 3" />
                    <Tooltip 
                      formatter={(value: number) => [`$${value.toFixed(2)}`, 'Position Value']}
                      labelFormatter={(label: number) => `ETH Price: $${label.toFixed(2)}`}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="value" 
                      stroke="#3B82F6" 
                      fillOpacity={1} 
                      fill="url(#colorValue)" 
                      yAxisId="left"
                    />
                    <ReferenceLine 
                      x={position.currentPrice} 
                      stroke="#16A34A" 
                      strokeWidth={2}
                      strokeDasharray="3 3"
                      label={{ value: 'Current Price', position: 'top', fill: '#16A34A' }} 
                      yAxisId="left"
                    />
                    <ReferenceLine 
                      x={position.priceLower} 
                      stroke="#DC2626" 
                      strokeWidth={2}
                      label={{ value: 'Lower Bound', position: 'top', fill: '#DC2626' }} 
                      yAxisId="left"
                    />
                    <ReferenceLine 
                      x={position.priceUpper} 
                      stroke="#DC2626" 
                      strokeWidth={2}
                      label={{ value: 'Upper Bound', position: 'top', fill: '#DC2626' }} 
                      yAxisId="left"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={recoveryPathData}
                    margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="priceChange" 
                      tickFormatter={(value) => `${value}%`}
                      label={{ value: 'ETH Price Change (%)', position: 'insideBottom', offset: -5 }}
                    />
                    <YAxis 
                      tickFormatter={(value) => `${value}%`}
                      domain={[-100, 'auto']}
                      label={{ value: 'P&L (%)', angle: -90, position: 'insideLeft' }}
                      yAxisId="left"
                    />
                    <Tooltip 
                      formatter={(value: number) => [`${value.toFixed(2)}%`, 'P&L']}
                      labelFormatter={(label: number) => `Price Change: ${label}%`}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="pnl" 
                      stroke="#3B82F6" 
                      strokeWidth={2}
                      dot={false}
                      name="Position P&L"
                      yAxisId="left"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="hodl" 
                      stroke="#9CA3AF" 
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={false}
                      name="HODL P&L"
                      yAxisId="left"
                    />
                    <ReferenceLine 
                      y={0} 
                      stroke="#16A34A" 
                      strokeWidth={2}
                      label={{ value: 'Break Even', position: 'right', fill: '#16A34A' }} 
                      yAxisId="left"
                    />
                    <ReferenceLine 
                      x={0} 
                      stroke="#DC2626" 
                      strokeWidth={2}
                      label={{ value: 'Current', position: 'top', fill: '#DC2626' }} 
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        ) : (
          <div className="h-80 w-full flex justify-center items-center">
            <p className="text-lg font-medium text-gray-900 dark:text-white">Loading...</p>
          </div>
        )}
        
        <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-md">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Chart Explanation</h4>
          {chartType === 'price' ? (
            <p className="text-xs text-gray-600 dark:text-gray-300">
              This chart shows your position value across different ETH prices. The green line represents the current ETH price (${position.currentPrice.toFixed(2)}), 
              while the red lines show your position's price range (${position.priceLower.toFixed(2)} - ${position.priceUpper.toFixed(2)}). 
              {position.inRange ? 
                'Your position is currently in range, actively earning fees.' : 
                'Your position is currently out of range and not earning fees.'}
            </p>
          ) : (
            <p className="text-xs text-gray-600 dark:text-gray-300">
              This chart compares your position's performance (blue line) against simply holding the assets (gray dashed line) 
              as the ETH price changes. The green horizontal line represents the break-even point. 
              {position.impermanentLoss < 0 ? 
                `To recover from impermanent loss, ETH price needs to ${position.currentPrice > position.recoveryUpperPrice ? 'decrease' : 'increase'} by approximately ${Math.abs(priceChangeNeeded).toFixed(2)}%.` : 
                'Your position is currently not experiencing impermanent loss.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
