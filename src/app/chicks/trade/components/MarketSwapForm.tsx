'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWallet } from '../../../context/WalletContext';
import chicksService from '../../../services/chicksService';
import openOceanService from '../../../services/openOceanService';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { ArrowsRightLeftIcon } from '@heroicons/react/24/outline';
import { Loader2 } from 'lucide-react';

interface MarketSwapFormProps {
  chicksPrice: string;
  chicksBalance: string;
  usdcBalance: string;
  onSuccess: () => void;
}

export default function MarketSwapForm({ 
  chicksPrice, 
  chicksBalance, 
  usdcBalance, 
  onSuccess 
}: MarketSwapFormProps) {
  const { isConnected } = useWallet();
  const [direction, setDirection] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState<string>('');
  const [estimatedOutput, setEstimatedOutput] = useState<string>('');
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [priceComparison, setPriceComparison] = useState<{
    btbPrice: string;
    openOceanPrice: string;
    priceDifference: string;
    priceDifferencePercentage: string;
  } | null>(null);
  const [isLoadingComparison, setIsLoadingComparison] = useState<boolean>(false);
  const [slippage, setSlippage] = useState<number>(1); // Default 1% slippage

  // USDC and CHICKS addresses
  const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
  const CHICKS_ADDRESS = '0x0000a88106096104877F79674396708E017DFf00';

  // Load price comparison on component mount
  useEffect(() => {
    fetchPriceComparison();
  }, [chicksPrice]);

  // Calculate output amount when input amount changes
  useEffect(() => {
    const calculateOutput = async () => {
      if (!amount || parseFloat(amount) === 0) {
        setEstimatedOutput('');
        return;
      }

      try {
        setIsCalculating(true);
        setError(null);

        if (direction === 'buy') {
          // Buy: USDC -> CHICKS
          const quoteData = await openOceanService.getQuote(
            USDC_ADDRESS,
            CHICKS_ADDRESS,
            amount
          );
          
          if (quoteData.data) {
            // The API returns outAmount with decimals already applied
            setEstimatedOutput(
              parseFloat(ethers.utils.formatUnits(quoteData.data.outAmount, 6)).toFixed(6)
            );
          }
        } else {
          // Sell: CHICKS -> USDC
          const quoteData = await openOceanService.getQuote(
            CHICKS_ADDRESS,
            USDC_ADDRESS,
            amount
          );
          
          if (quoteData.data) {
            // The API returns outAmount with decimals already applied
            setEstimatedOutput(
              parseFloat(ethers.utils.formatUnits(quoteData.data.outAmount, 6)).toFixed(6)
            );
          }
        }
      } catch (error: any) {
        console.error('Error calculating output amount:', error);
        setError(error.message || 'Failed to calculate output amount');
      } finally {
        setIsCalculating(false);
      }
    };

    // Add debounce to prevent calculation on every keystroke
    const debounceTimer = setTimeout(() => {
      if (amount) {
        calculateOutput();
      }
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [amount, direction]);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setAmount(value);
      if (value === '') {
        setEstimatedOutput('');
      }
    }
  };

  const handleMaxClick = () => {
    if (direction === 'buy' && parseFloat(usdcBalance) > 0) {
      setAmount(usdcBalance);
    } else if (direction === 'sell' && parseFloat(chicksBalance) > 0) {
      setAmount(chicksBalance);
    }
  };

  const toggleDirection = () => {
    setDirection(direction === 'buy' ? 'sell' : 'buy');
    setAmount('');
    setEstimatedOutput('');
  };

  const fetchPriceComparison = async () => {
    if (!chicksPrice) return;
    
    try {
      setIsLoadingComparison(true);
      setError(null);
      const comparison = await openOceanService.getPriceComparison(chicksPrice);
      setPriceComparison(comparison);
    } catch (error: any) {
      console.error('Error fetching price comparison:', error);
      setError(error.message || 'Failed to fetch price comparison');
    } finally {
      setIsLoadingComparison(false);
    }
  };

  const handleSwap = async () => {
    if (!isConnected) {
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      // Validate slippage is within reasonable bounds
      if (slippage < 0.1 || slippage > 50) {
        setError('Slippage must be between 0.1% and 50%');
        setIsSubmitting(false);
        return;
      }
      
      // Execute swap transaction
      let tx;
      if (direction === 'buy') {
        // Buy: USDC -> CHICKS
        tx = await openOceanService.executeSwap(
          USDC_ADDRESS,
          CHICKS_ADDRESS,
          amount,
          slippage // Use configurable slippage
        );
      } else {
        // Sell: CHICKS -> USDC
        tx = await openOceanService.executeSwap(
          CHICKS_ADDRESS,
          USDC_ADDRESS,
          amount,
          slippage // Use configurable slippage
        );
      }

      await tx.wait();

      // Reset form
      setAmount('');
      setEstimatedOutput('');

      // Refresh data
      onSuccess();
      
      // Refresh price comparison
      fetchPriceComparison();
    } catch (error: any) {
      console.error('Error executing swap:', error);
      setError(error.message || 'Failed to execute swap. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-lg font-medium">Market Swap</h3>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchPriceComparison}
            disabled={isLoadingComparison}
            className="text-xs"
          >
            {isLoadingComparison ? (
              <>
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Updating
              </>
            ) : (
              'Refresh Prices'
            )}
          </Button>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Swap CHICKS and USDC at market rates via OpenOcean.
        </p>
        
        {priceComparison && (
          <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg mb-4">
            <div className="flex justify-between mb-2">
              <span className="text-sm">CHICKS Price:</span>
              <span className="text-sm font-medium">${priceComparison.btbPrice}</span>
            </div>
            <div className="flex justify-between mb-2">
              <span className="text-sm">Market Price:</span>
              <span className="text-sm font-medium">${priceComparison.openOceanPrice}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Difference:</span>
              <div 
                className={`text-xs px-2 py-1 rounded-full ${parseFloat(priceComparison.priceDifference) > 0 ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300" : "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300"}`}
              >
                {parseFloat(priceComparison.priceDifference) > 0 ? '+' : ''}
                {priceComparison.priceDifference} ({priceComparison.priceDifferencePercentage}%)
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="mb-4">
          <div className="flex justify-between mb-2">
            <label className="text-sm font-medium">
              {direction === 'buy' ? 'USDC Amount' : 'CHICKS Amount'}
            </label>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Balance: {isConnected ? 
                parseFloat(direction === 'buy' ? usdcBalance : chicksBalance).toFixed(4) 
                : '0.0000'} {direction === 'buy' ? 'USDC' : 'CHICKS'}
            </div>
          </div>
          <div className="flex space-x-2">
            <Input
              type="text"
              placeholder="0.00"
              value={amount}
              onChange={handleAmountChange}
              disabled={isSubmitting}
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              onClick={handleMaxClick}
              disabled={!isConnected || isSubmitting}
              className="w-16"
            >
              Max
            </Button>
          </div>
        </div>

        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={toggleDirection}
            disabled={isSubmitting}
            className="rounded-full h-10 w-10"
          >
            <ArrowsRightLeftIcon className="h-5 w-5" />
          </Button>
        </div>

        <div className="mb-4">
          <div className="flex justify-between mb-2">
            <label className="text-sm font-medium">
              {direction === 'buy' ? 'CHICKS Amount (Estimated)' : 'USDC Amount (Estimated)'}
            </label>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Price: ${parseFloat(chicksPrice).toFixed(6)} USDC
            </div>
          </div>
          <Input
            type="text"
            placeholder="0.00"
            value={isCalculating ? 'Calculating...' : estimatedOutput}
            disabled={true}
            className="w-full"
          />
          <div className="flex justify-between items-center mt-1">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              *Includes OpenOcean fees and slippage
            </p>
            <div className="flex items-center space-x-1">
              <span className="text-xs text-gray-500 dark:text-gray-400">Slippage:</span>
              <div className="flex space-x-1">
                {[0.5, 1, 3].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSlippage(value)}
                    className={`px-1.5 py-0.5 text-xs rounded ${slippage === value 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
                  >
                    {value}%
                  </button>
                ))}
                <div className="relative w-14">
                  <Input
                    type="number"
                    min="0.1"
                    max="50"
                    step="0.1"
                    value={slippage}
                    onChange={(e) => setSlippage(parseFloat(e.target.value) || 1)}
                    className="pr-5 h-6 text-xs"
                  />
                  <span className="absolute right-1 top-1/2 transform -translate-y-1/2 text-xs text-gray-500">%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300 text-sm rounded-md mb-4">
            {error}
          </div>
        )}

        <Button
          type="button"
          onClick={handleSwap}
          disabled={!isConnected || isSubmitting || isCalculating || !amount || !estimatedOutput}
          className="w-full"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {direction === 'buy' ? 'Buying CHICKS...' : 'Selling CHICKS...'}
            </>
          ) : (
            direction === 'buy' ? 'Buy CHICKS' : 'Sell CHICKS'
          )}
        </Button>
      </div>
    </div>
  );
}
