'use client';

import ILCalculator from '../components/calculator/ILCalculator';
import PriceChart from '../components/calculator/PriceChart';

export default function CalculatorPage() {
  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Impermanent Loss Calculator
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Calculate potential impermanent loss for your liquidity positions. 
            Understand your risks before providing liquidity to AMM pools.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Calculator Form */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <ILCalculator />
          </div>

          {/* Results and Visualization */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <PriceChart />
          </div>
        </div>

        {/* Educational Section */}
        <div className="mt-16 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Understanding Impermanent Loss
          </h2>
          <div className="prose dark:prose-invert max-w-none">
            <p className="text-gray-600 dark:text-gray-300">
              Impermanent Loss (IL) occurs when the price ratio of tokens in a liquidity pool changes
              compared to their prices when you deposited them. This calculator helps you:
            </p>
            <ul className="list-disc pl-6 mt-4 space-y-2 text-gray-600 dark:text-gray-300">
              <li>Estimate potential IL based on price changes</li>
              <li>Compare IL against earned trading fees</li>
              <li>Make informed decisions about liquidity provision</li>
              <li>Understand the risks involved in AMM pools</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
