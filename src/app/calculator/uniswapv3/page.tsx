'use client';

import UniswapV3Calculator from './components/UniswapV3Calculator';

export default function UniswapV3CalculatorPage() {
  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gradient mb-4">
            Uniswap V3 Range Position Analyzer
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            Analyze your Uniswap V3 ETH/USDC liquidity positions, calculate impermanent loss, 
            and determine optimal recovery ranges based on real-time data.
          </p>
        </div>

        {/* Calculator */}
        <div className="card">
          <UniswapV3Calculator />
        </div>

        {/* Educational Section */}
        <div className="mt-16 card">
          <h2 className="text-2xl font-bold text-btb-primary dark:text-btb-primary mb-4">
            Dynamic Range Liquidity Positioning
          </h2>
          <div className="prose dark:prose-invert max-w-none">
            <p className="text-gray-600 dark:text-gray-300">
              Uniswap V3's concentrated liquidity feature allows for more efficient capital usage but introduces 
              complexity in managing impermanent loss. Our Dynamic Range Positioning strategy helps optimize your approach.
            </p>
            
            <h3 className="text-xl font-semibold text-btb-primary dark:text-btb-primary mt-6 mb-2">Key Concepts</h3>
            <ul className="list-disc pl-6 mt-4 space-y-2 text-gray-600 dark:text-gray-300">
              <li><strong>Concentrated Liquidity</strong>: Unlike previous AMM versions, Uniswap V3 allows you to provide liquidity within specific price ranges.</li>
              <li><strong>Price Range Selection</strong>: Narrower ranges earn more fees when prices stay within range but risk going out of range.</li>
              <li><strong>Impermanent Loss</strong>: The opportunity cost of providing liquidity compared to holding assets, which can be larger in V3 due to concentration.</li>
              <li><strong>Dynamic Repositioning</strong>: Our strategy involves continually adjusting position ranges based on price movements and profit/loss status.</li>
            </ul>
            
            <h3 className="text-xl font-semibold text-btb-primary dark:text-btb-primary mt-6 mb-2">Recovery Strategy</h3>
            <p className="text-gray-600 dark:text-gray-300">
              When a position experiences impermanent loss and moves out of range, our calculator determines an optimal recovery range:
            </p>
            <ol className="list-decimal pl-6 mt-2 space-y-2 text-gray-600 dark:text-gray-300">
              <li>Use current price as the lower bound</li>
              <li>Calculate a mathematically optimized upper bound that would recover losses if reached</li>
              <li>Concentrate liquidity in this recovery range to maximize fee generation if price returns to the target level</li>
            </ol>
            
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
              <p className="text-gray-700 dark:text-gray-300 font-medium">
                By repositioning your liquidity based on the recovery analysis provided by this calculator, you can potentially convert 
                a position with impermanent loss into one that yields positive returns over time.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
