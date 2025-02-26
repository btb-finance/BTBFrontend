'use client';

import { useState, useEffect } from 'react';
import { ArrowPathIcon, ExclamationCircleIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import { ethers } from 'ethers';
import RangeRecoveryChart from './RangeRecoveryChart';
import PositionSummary from './PositionSummary';
import RecoveryStrategy from './RecoveryStrategy';
import DynamicRangeStrategy from './DynamicRangeStrategy';
import ImpermanentLossVisualizer from './ImpermanentLossVisualizer';
import uniswapV3Service, { Position, PositionWithMetrics as ImportedPositionWithMetrics } from '../../../services/uniswapV3Service';

// Types for Uniswap V3 position with additional properties
interface PositionWithMetrics extends ImportedPositionWithMetrics {
  token0Symbol: string;
  token1Symbol: string;
  token0Decimals: number;
  token1Decimals: number;
}

export default function UniswapV3Calculator() {
  const [address, setAddress] = useState<string>('');
  const [positions, setPositions] = useState<PositionWithMetrics[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<PositionWithMetrics | null>(null);
  const [ethPrice, setEthPrice] = useState<number>(3000); // Default ETH price
  const [usingFallbackPrice, setUsingFallbackPrice] = useState<boolean>(false);
  const [usingMockData, setUsingMockData] = useState<boolean>(false);

  // Function to calculate tick to price
  const tickToPrice = (tick: number): number => {
    return 1.0001 ** tick;
  };

  // Function to calculate price to tick
  const priceToTick = (price: number): number => {
    return Math.floor(Math.log(price) / Math.log(1.0001));
  };

  // Function to load positions for a wallet address
  const loadPositions = async (walletAddress: string) => {
    if (!ethers.utils.isAddress(walletAddress)) {
      setError('Please enter a valid Ethereum address');
      setPositions([]);
      setSelectedPosition(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setUsingFallbackPrice(false);
    setUsingMockData(false);

    try {
      // Set a timeout to prevent infinite loading
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timed out')), 15000);
      });

      // Get current ETH price - with timeout
      const currentPricePromise = uniswapV3Service.getCurrentEthPrice();
      const currentPrice = await Promise.race([currentPricePromise, timeoutPromise]) as number;
      setEthPrice(currentPrice);
      
      // Check if we're using a fallback price (sanity check)
      if (currentPrice < 100 || currentPrice > 10000) {
        setUsingFallbackPrice(true);
      }
      
      // Get positions with metrics - with timeout
      const positionsPromise = uniswapV3Service.getPositionsWithMetrics(walletAddress);
      const positionsWithMetrics = await Promise.race([positionsPromise, timeoutPromise]) as PositionWithMetrics[];
      
      if (positionsWithMetrics.length === 0) {
        // Try to use mock data in development mode
        if (process.env.NODE_ENV !== 'production') {
          const mockPositions = await uniswapV3Service.getMockPositions();
          setPositions(mockPositions);
          setSelectedPosition(mockPositions[0]);
          setUsingMockData(true);
        } else {
          setError('No ETH-USDC Uniswap V3 positions found for this address');
          setPositions([]);
          setSelectedPosition(null);
        }
      } else {
        // Check if we're using mock data (tokenId starts with '123456')
        if (positionsWithMetrics[0].tokenId === '123456') {
          setUsingMockData(true);
        }
        
        setPositions(positionsWithMetrics);
        setSelectedPosition(positionsWithMetrics[0]);
      }
    } catch (error: unknown) {
      console.error('Error loading positions:', error);
      
      // Handle timeout errors specifically
      if (error instanceof Error && error.message === 'Request timed out') {
        setError('Request timed out. Using demo data instead.');
        
        // Use mock data when timeout occurs
        const mockPositions = await uniswapV3Service.getMockPositions();
        setPositions(mockPositions);
        setSelectedPosition(mockPositions[0]);
        setUsingMockData(true);
      } else {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setError(`Error loading positions: ${errorMessage}`);
        
        // Try to use mock data in development mode
        if (process.env.NODE_ENV !== 'production') {
          const mockPositions = await uniswapV3Service.getMockPositions();
          setPositions(mockPositions);
          setSelectedPosition(mockPositions[0]);
          setUsingMockData(true);
        } else {
          setPositions([]);
          setSelectedPosition(null);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // Function to load demo data
  const loadDemoData = async () => {
    setLoading(true);
    setError(null);
    setUsingFallbackPrice(false);
    setUsingMockData(true);
    
    try {
      // Get current ETH price
      const currentPrice = await uniswapV3Service.getCurrentEthPrice();
      setEthPrice(currentPrice);
      
      // Get mock positions
      const mockPositions = await uniswapV3Service.getMockPositions();
      setPositions(mockPositions);
      setSelectedPosition(mockPositions[0]);
    } catch (error: unknown) {
      console.error('Error loading demo data:', error);
      setError('Error loading demo data. Using default values.');
      
      // Use hardcoded mock data as last resort
      const defaultMockPosition: PositionWithMetrics = {
        tokenId: '123456',
        token0: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        token1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        token0Symbol: 'WETH',
        token1Symbol: 'USDC',
        token0Decimals: 18,
        token1Decimals: 6,
        fee: 3000,
        tickLower: -84222,
        tickUpper: -73136,
        liquidity: '1000000000000000000',
        amount0: '500000000000000000',
        amount1: '1500000000',
        currentPrice: 3000,
        priceLower: 2000,
        priceUpper: 4000,
        inRange: true,
        impermanentLoss: -0.02,
        recoveryUpperTick: -69315,
        recoveryUpperPrice: 5000,
        valueAtEntry: 3000,
        currentValue: 2940,
        feesEarned: 30,
        token0Percentage: 50,
      };
      
      setPositions([defaultMockPosition]);
      setSelectedPosition(defaultMockPosition);
    } finally {
      setLoading(false);
    }
  };

  // Effect to update recovery calculations when ETH price changes
  useEffect(() => {
    if (positions.length > 0) {
      const updatedPositions = positions.map(pos => {
        const inRange = ethPrice >= pos.priceLower && ethPrice <= pos.priceUpper;
        
        // Recalculate current value based on new ETH price
        let ethAmount, usdcAmount;
        if (pos.token0Symbol === 'WETH') {
          ethAmount = parseFloat(ethers.utils.formatUnits(pos.amount0, pos.token0Decimals));
          usdcAmount = parseFloat(ethers.utils.formatUnits(pos.amount1, pos.token1Decimals));
        } else {
          ethAmount = parseFloat(ethers.utils.formatUnits(pos.amount1, pos.token1Decimals));
          usdcAmount = parseFloat(ethers.utils.formatUnits(pos.amount0, pos.token0Decimals));
        }
        
        const currentValue = ethAmount * ethPrice + usdcAmount;
        
        // Recalculate impermanent loss
        const initialETH = ethAmount + (usdcAmount / pos.priceLower);
        const valueIfHeld = initialETH * ethPrice;
        const impermanentLoss = (currentValue / valueIfHeld) - 1;
        
        // Recalculate recovery tick
        const recoveryUpperTick = uniswapV3Service.calculateRecoveryUpperTick(pos, ethPrice);
        
        return {
          ...pos,
          currentPrice: ethPrice,
          inRange,
          impermanentLoss,
          recoveryUpperTick,
          recoveryUpperPrice: tickToPrice(recoveryUpperTick),
          currentValue
        };
      });
      
      setPositions(updatedPositions);
      
      // Update selected position if it exists
      if (selectedPosition) {
        const updated = updatedPositions.find(p => p.tokenId === selectedPosition.tokenId);
        if (updated) {
          setSelectedPosition(updated);
        }
      }
    }
  }, [ethPrice]);

  // Effect to auto-load positions when address is changed and is valid
  useEffect(() => {
    // Check if address is valid and has the correct format
    if (address && ethers.utils.isAddress(address)) {
      // Add a small delay to avoid loading while user is still typing
      const timer = setTimeout(() => {
        loadPositions(address);
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [address]);

  return (
    <div className="space-y-6">
      <div className="text-2xl font-bold text-btb-primary dark:text-btb-primary mb-4">
        Uniswap V3 Position Analyzer
      </div>

      {/* Input Section */}
      <div className="mb-6 space-y-4">
        
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-grow">
            <label htmlFor="walletAddress" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Wallet Address
            </label>
            <div className="flex">
              <input
                type="text"
                id="walletAddress"
                className="flex-grow px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-l-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-800 dark:text-white"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Enter Ethereum address"
              />
              <button
                onClick={() => loadPositions(address)}
                className="px-4 py-2 bg-blue-600 text-white rounded-none hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                disabled={loading}
              >
                {loading ? 'Loading...' : 'Load'}
              </button>
              <button
                onClick={loadDemoData}
                className="ml-1 px-4 py-2 bg-green-600 text-white rounded-r-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                disabled={loading}
              >
                {loading ? 'Loading...' : 'Use Demo'}
              </button>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Current ETH Price ($)
            </label>
            <input
              type="number"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-800 dark:text-white"
              value={ethPrice}
              onChange={(e) => setEthPrice(parseFloat(e.target.value) || 0)}
              placeholder="0.0"
            />
          </div>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          <div className="flex items-start">
            <ExclamationCircleIcon className="h-5 w-5 text-red-500 mr-2 mt-0.5" />
            <div>
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                Make sure you've entered a valid Ethereum address with active ETH-USDC Uniswap V3 positions.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Price Warning */}
      {usingFallbackPrice && (
        <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
          <div className="flex items-start">
            <ExclamationCircleIcon className="h-5 w-5 text-yellow-500 mr-2 mt-0.5" />
            <div>
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                Using estimated ETH price. Real-time price data could not be fetched.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Mock Data Warning */}
      {usingMockData && (
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
          <div className="flex items-start">
            <InformationCircleIcon className="h-5 w-5 text-blue-500 mr-2 mt-0.5" />
            <div>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Using demo data for educational purposes. These positions demonstrate different Uniswap V3 scenarios:
              </p>
              <ul className="text-xs text-blue-600 dark:text-blue-400 mt-1 ml-4 list-disc">
                <li>In-range position with small impermanent loss</li>
                <li>Out-of-range position (price moved above range)</li>
                <li>Out-of-range position (price moved below range)</li>
                <li>Narrow range position with high fee tier</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Positions List */}
      {positions.length > 0 && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Your Positions</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {positions.map((position) => (
              <div 
                key={position.tokenId}
                className={`p-4 rounded-lg border cursor-pointer transition-all ${
                  selectedPosition?.tokenId === position.tokenId
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-400'
                    : 'border-gray-200 hover:border-blue-300 dark:border-gray-700 dark:hover:border-blue-600'
                }`}
                onClick={() => setSelectedPosition(position)}
              >
                <div className="flex items-center mb-2">
                  <div className="flex -space-x-1 mr-2">
                    <img 
                      src="/images/eth-logo.png" 
                      alt="ETH" 
                      className="w-5 h-5 rounded-full" 
                    />
                    <img 
                      src="/images/usdc-logo.png" 
                      alt="USDC" 
                      className="w-5 h-5 rounded-full" 
                    />
                  </div>
                  <div className="text-sm font-medium">
                    ETH-USDC ({(position.fee / 10000).toFixed(2)}%)
                  </div>
                </div>
                
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Range:</span>
                    <span className="font-medium">${position.priceLower.toFixed(0)} - ${position.priceUpper.toFixed(0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Status:</span>
                    <span className={`font-medium ${position.inRange ? 'text-green-500' : 'text-red-500'}`}>
                      {position.inRange ? 'In Range' : 'Out of Range'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">IL:</span>
                    <span className="font-medium text-red-500">
                      {(position.impermanentLoss * 100).toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Value:</span>
                    <span className="font-medium">${position.currentValue.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Position Details and Charts */}
      {selectedPosition && (
        <div className="mt-8 space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Position Summary</h3>
              <PositionSummary position={selectedPosition} />
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Recovery Strategy</h3>
              <RecoveryStrategy position={selectedPosition} />
            </div>
          </div>
          
          <div className="md:col-span-2">
            <RangeRecoveryChart position={selectedPosition} />
          </div>

          {/* Impermanent Loss Visualizer */}
          <div className="mt-6">
            <ImpermanentLossVisualizer position={selectedPosition} />
          </div>
        </div>
      )}

      {/* Dynamic Range Strategy Section */}
      <div className="mt-8">
        <DynamicRangeStrategy />
      </div>

      {/* Educational Section */}
      <div className="card mt-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Understanding Uniswap V3 Positions</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-gray-700">
            <h3 className="text-md font-medium text-blue-600 dark:text-blue-400 mb-2">Concentrated Liquidity</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Uniswap V3 allows liquidity providers to concentrate their capital within specific price ranges, 
              potentially increasing capital efficiency by many multiples compared to Uniswap V2.
            </p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-gray-700">
            <h3 className="text-md font-medium text-blue-600 dark:text-blue-400 mb-2">Impermanent Loss</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Impermanent loss occurs when the price of your deposited assets changes compared to when you deposited them. 
              In V3, this effect can be amplified due to concentrated liquidity but may be offset by higher fee earnings.
            </p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-gray-700">
            <h3 className="text-md font-medium text-blue-600 dark:text-blue-400 mb-2">Recovery Strategies</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              When experiencing impermanent loss, you can create a recovery position with a specific price range 
              that will help recapture losses when the price returns to a certain level.
            </p>
          </div>
        </div>
        
        <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
          <h3 className="text-md font-medium text-blue-700 dark:text-blue-300 mb-2">Dynamic Range Positioning Strategy</h3>
          <p className="text-sm text-blue-600 dark:text-blue-400 mb-3">
            BTB Finance is developing an innovative approach to liquidity management that adapts to market movements:
          </p>
          <ul className="list-disc pl-5 text-sm text-blue-600 dark:text-blue-400 space-y-1">
            <li>Automatically recalibrates position ranges based on price movements</li>
            <li>Locks in profits in uptrends with asymmetric positioning</li>
            <li>Creates targeted recovery positions in downtrends</li>
            <li>Optimizes fee generation while reducing impermanent loss risk</li>
          </ul>
          <p className="text-sm text-blue-600 dark:text-blue-400 mt-3">
            Stay tuned for our upcoming Dynamic Range Positioning vault strategy!
          </p>
        </div>
      </div>
    </div>
  );
}
