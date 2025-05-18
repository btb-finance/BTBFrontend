'use client';

import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, ResponsiveContainer } from 'recharts';
import { PositionWithMetrics } from '@/app/uniswap/services/uniswapV3Service';

interface ImpermanentLossVisualizerProps {
  position: PositionWithMetrics;
}

export default function ImpermanentLossVisualizer({ position }: ImpermanentLossVisualizerProps) {
  const [priceRange, setPriceRange] = useState<number>(50); // Default 50% price range

  // Generate data for the chart
  const generateChartData = () => {
    const data = [];
    const currentPrice = position.currentPrice;
    const minPrice = currentPrice * (1 - priceRange / 100);
    const maxPrice = currentPrice * (1 + priceRange / 100);
    const step = (maxPrice - minPrice) / 20;

    for (let price = minPrice; price <= maxPrice; price += step) {
      // Calculate impermanent loss for this price point
      let il = 0;
      
      // Simplified IL calculation for V3 (this is an approximation)
      // In a real implementation, this would be more complex based on the specific range
      if (price < position.priceLower || price > position.priceUpper) {
        // Out of range - calculate IL based on how far we are from range
        const ratio = price / position.currentPrice;
        il = 2 * Math.sqrt(ratio) / (1 + ratio) - 1;
      } else {
        // In range - calculate IL based on standard formula
        const ratio = price / position.currentPrice;
        il = 2 * Math.sqrt(ratio) / (1 + ratio) - 1;
        
        // Adjust for concentrated liquidity (simplified)
        const rangeWidth = position.priceUpper - position.priceLower;
        const fullRange = position.currentPrice * 2; // Assuming a full range would be 2x current price
        const concentrationMultiplier = fullRange / rangeWidth;
        
        // Concentrated liquidity can amplify IL
        il = il * Math.min(concentrationMultiplier, 5); // Cap at 5x to avoid extreme values
      }
      
      data.push({
        price: price,
        impermanentLoss: il * 100, // Convert to percentage
        value: position.currentValue * (1 + il), // Adjust value based on IL
      });
    }
    
    return data;
  };

  const data = generateChartData();
  
  // Format for tooltip
  const formatTooltip = (value: number) => {
    return `${value.toFixed(2)}%`;
  };
  
  const formatPrice = (value: number) => {
    return `$${value.toFixed(2)}`;
  };
  
  const formatValue = (value: number) => {
    return `$${value.toFixed(2)}`;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Impermanent Loss Visualization</h2>
      
      <div className="mb-4">
        <label htmlFor="priceRange" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Price Range: ±{priceRange}% from current price
        </label>
        <input
          type="range"
          id="priceRange"
          min="10"
          max="100"
          step="10"
          value={priceRange}
          onChange={(e) => setPriceRange(parseInt(e.target.value))}
          className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
        />
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
          <span>±10%</span>
          <span>±50%</span>
          <span>±100%</span>
        </div>
      </div>
      
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
            <XAxis 
              dataKey="price" 
              tickFormatter={formatPrice}
              domain={['dataMin', 'dataMax']}
              type="number"
              allowDecimals={false}
            />
            <YAxis 
              yAxisId="left"
              tickFormatter={formatTooltip}
              domain={[0, 'dataMax']}
              label={{ value: 'Impermanent Loss (%)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' } }}
            />
            <YAxis 
              yAxisId="right" 
              orientation="right"
              tickFormatter={formatValue}
              domain={[0, 'dataMax']}
              label={{ value: 'Position Value ($)', angle: 90, position: 'insideRight', style: { textAnchor: 'middle' } }}
            />
            <Tooltip 
              formatter={(value: number, name: string) => {
                if (name === 'impermanentLoss') return [`${value.toFixed(2)}%`, 'Impermanent Loss'];
                return [`$${value.toFixed(2)}`, 'Position Value'];
              }}
              labelFormatter={(label) => `Price: $${label.toFixed(2)}`}
            />
            <Legend />
            <ReferenceLine 
              x={position.currentPrice} 
              stroke="#3B82F6" 
              strokeDasharray="3 3"
              yAxisId="left"
              label={{ value: 'Current Price', position: 'top', fill: '#3B82F6' }}
            />
            <ReferenceLine 
              x={position.priceLower} 
              stroke="#10B981" 
              strokeDasharray="3 3"
              yAxisId="left"
              label={{ value: 'Lower Range', position: 'insideBottomLeft', fill: '#10B981' }}
            />
            <ReferenceLine 
              x={position.priceUpper} 
              stroke="#EF4444" 
              strokeDasharray="3 3"
              yAxisId="left"
              label={{ value: 'Upper Range', position: 'insideBottomRight', fill: '#EF4444' }}
            />
            <Line 
              yAxisId="left"
              type="monotone" 
              dataKey="impermanentLoss" 
              stroke="#EF4444" 
              name="impermanentLoss"
              dot={false}
              activeDot={{ r: 8 }}
            />
            <Line 
              yAxisId="right"
              type="monotone" 
              dataKey="value" 
              stroke="#10B981" 
              name="value"
              dot={false}
              activeDot={{ r: 8 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      
      <div className="mt-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-sm text-gray-600 dark:text-gray-300">
        <p className="mb-2">
          <span className="font-medium">Understanding the chart:</span> This visualization shows how your position value and impermanent loss change as the price of ETH moves.
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>The <span className="text-red-500 font-medium">red line</span> shows impermanent loss percentage at different price points.</li>
          <li>The <span className="text-green-500 font-medium">green line</span> shows your position value in USD.</li>
          <li>Vertical lines mark your current price and position range boundaries.</li>
          <li>Impermanent loss is typically highest when price moves far outside your range.</li>
        </ul>
      </div>
    </div>
  );
}
