'use client';

import { useState } from 'react';
import { ArrowsRightLeftIcon } from '@heroicons/react/24/outline';

interface TokenInput {
  name: string;
  initialPrice: string;
  currentPrice: string;
  amount: string;
}

export default function ILCalculator() {
  const [token1, setToken1] = useState<TokenInput>({
    name: '',
    initialPrice: '',
    currentPrice: '',
    amount: ''
  });
  
  const [token2, setToken2] = useState<TokenInput>({
    name: '',
    initialPrice: '',
    currentPrice: '',
    amount: ''
  });

  const [ilResult, setIlResult] = useState<{
    percentage: number;
    dollarValue: number;
  } | null>(null);

  const calculateIL = () => {
    const p1 = parseFloat(token1.currentPrice) / parseFloat(token1.initialPrice);
    const p2 = parseFloat(token2.currentPrice) / parseFloat(token2.initialPrice);
    
    if (isNaN(p1) || isNaN(p2)) return;

    const sqrtP = Math.sqrt(p1 * p2);
    const il = 2 * sqrtP / (1 + p1) - 1;
    const ilPercentage = il * 100;

    const initialValue = 
      parseFloat(token1.amount) * parseFloat(token1.initialPrice) +
      parseFloat(token2.amount) * parseFloat(token2.initialPrice);
    
    const ilDollarValue = Math.abs(initialValue * il);

    setIlResult({
      percentage: ilPercentage,
      dollarValue: ilDollarValue
    });
  };

  const handleInputChange = (
    tokenSetter: (value: TokenInput) => void,
    token: TokenInput,
    field: keyof TokenInput,
    value: string
  ) => {
    tokenSetter({
      ...token,
      [field]: value
    });
  };

  return (
    <div className="space-y-6">
      <div className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
        Input Token Details
      </div>

      {/* Token 1 Inputs */}
      <div className="space-y-4">
        <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Token 1</div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Token Name
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              value={token1.name}
              onChange={(e) => handleInputChange(setToken1, token1, 'name', e.target.value)}
              placeholder="e.g., ETH"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Amount
            </label>
            <input
              type="number"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              value={token1.amount}
              onChange={(e) => handleInputChange(setToken1, token1, 'amount', e.target.value)}
              placeholder="0.0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Initial Price ($)
            </label>
            <input
              type="number"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              value={token1.initialPrice}
              onChange={(e) => handleInputChange(setToken1, token1, 'initialPrice', e.target.value)}
              placeholder="0.0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Current Price ($)
            </label>
            <input
              type="number"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              value={token1.currentPrice}
              onChange={(e) => handleInputChange(setToken1, token1, 'currentPrice', e.target.value)}
              placeholder="0.0"
            />
          </div>
        </div>
      </div>

      {/* Token 2 Inputs */}
      <div className="space-y-4">
        <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Token 2</div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Token Name
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              value={token2.name}
              onChange={(e) => handleInputChange(setToken2, token2, 'name', e.target.value)}
              placeholder="e.g., USDC"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Amount
            </label>
            <input
              type="number"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              value={token2.amount}
              onChange={(e) => handleInputChange(setToken2, token2, 'amount', e.target.value)}
              placeholder="0.0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Initial Price ($)
            </label>
            <input
              type="number"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              value={token2.initialPrice}
              onChange={(e) => handleInputChange(setToken2, token2, 'initialPrice', e.target.value)}
              placeholder="0.0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Current Price ($)
            </label>
            <input
              type="number"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              value={token2.currentPrice}
              onChange={(e) => handleInputChange(setToken2, token2, 'currentPrice', e.target.value)}
              placeholder="0.0"
            />
          </div>
        </div>
      </div>

      {/* Calculate Button */}
      <button
        onClick={calculateIL}
        className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 transition-colors duration-200 flex items-center justify-center gap-2"
      >
        <ArrowsRightLeftIcon className="h-5 w-5" />
        Calculate Impermanent Loss
      </button>

      {/* Results */}
      {ilResult && (
        <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Results
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-300">Impermanent Loss:</span>
              <span className={`font-semibold ${
                ilResult.percentage < 0 ? 'text-red-500' : 'text-green-500'
              }`}>
                {ilResult.percentage.toFixed(2)}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-300">Value Impact:</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                ${ilResult.dollarValue.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
