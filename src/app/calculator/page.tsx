'use client';

import Link from 'next/link';
import ILCalculator from './components/ILCalculator';
import PriceChart from './components/PriceChart';

export default function CalculatorPage() {
  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gradient mb-4">
            Impermanent Loss Calculator
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Calculate potential impermanent loss for your liquidity positions. 
            Understand your risks before providing liquidity to AMM pools.
          </p>
        </div>

        {/* Calculator Types */}
        <div className="flex flex-wrap justify-center gap-4 mb-12">
          <Link 
            href="/calculator" 
            className="btn-primary"
          >
            Standard IL Calculator
          </Link>
          <Link 
            href="/calculator/uniswapv3" 
            className="btn-secondary"
          >
            Uniswap V3 Range Analysis
          </Link>
        </div>

        {/* Calculator Form - Full Width */}
        <div className="mb-8">
          <div className="card">
            <ILCalculator />
          </div>
        </div>

        {/* Charts Section - Multiple Charts in Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <div className="card">
            <h3 className="text-xl font-semibold mb-4">Impermanent Loss vs Price</h3>
            <PriceChart chartType="ilVsPrice" />
          </div>
          <div className="card">
            <h3 className="text-xl font-semibold mb-4">Position Value vs Price</h3>
            <PriceChart chartType="valueVsPrice" />
          </div>
        </div>

        {/* Additional Chart - Full Width */}
        <div className="mb-8">
          <div className="card">
            <h3 className="text-xl font-semibold mb-4">Fee APR vs Price Range</h3>
            <PriceChart chartType="feeAprVsRange" height={300} />
          </div>
        </div>

        {/* Educational Section */}
        <div className="mt-8 card">
          <h2 className="text-2xl font-bold text-[#FF0420] dark:text-[#FF0420] mb-4">
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
            
            <h3 className="text-xl font-semibold text-[#FF0420] dark:text-[#FF0420] mt-6 mb-3">
              Concentrated Liquidity Explained
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Concentrated liquidity, introduced by Uniswap V3, allows liquidity providers to focus their capital
              within specific price ranges, potentially increasing capital efficiency but also introducing new
              considerations for impermanent loss:
            </p>
            <ul className="list-disc pl-6 mt-4 space-y-2 text-gray-600 dark:text-gray-300">
              <li>When prices stay within your specified range, you earn more fees with less capital</li>
              <li>If prices move outside your range, your position becomes 100% composed of a single asset</li>
              <li>Narrower ranges can lead to higher returns but increase the risk of the price moving out of range</li>
              <li>The impermanent loss calculation is more complex than in traditional AMMs</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
