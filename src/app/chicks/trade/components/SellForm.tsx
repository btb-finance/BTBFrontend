'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '../../../context/WalletContext';
import chicksService from '../../services/chicksService';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { ArrowsRightLeftIcon } from '@heroicons/react/24/outline';

interface SellFormProps {
  chicksPrice: string;
  chicksBalance: string;
  onSuccess: () => void;
}

export default function SellForm({ chicksPrice, chicksBalance, onSuccess }: SellFormProps) {
  const { isConnected } = useWallet();
  const [chicksAmount, setChicksAmount] = useState<string>('');
  const [usdcAmount, setUsdcAmount] = useState<string>('');
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [activeInput, setActiveInput] = useState<'usdc' | 'chicks'>('chicks');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate USDC amount when CHICKS amount changes
  useEffect(() => {
    const calculateUsdcAmount = async () => {
      if (!chicksAmount || parseFloat(chicksAmount) === 0 || activeInput !== 'chicks') return;

      try {
        // Don't disable the input field during calculation
        // setIsCalculating(true);
        const amount = await chicksService.getSellAmount(chicksAmount);
        // Apply sell fee (1.6%)
        const amountAfterFee = (parseFloat(amount) * 0.984).toFixed(6);
        setUsdcAmount(amountAfterFee);
      } catch (error) {
        console.error('Error calculating USDC amount:', error);
      } finally {
        // setIsCalculating(false);
      }
    };

    // Add debounce to prevent calculation on every keystroke
    const debounceTimer = setTimeout(() => {
      calculateUsdcAmount();
    }, 300); // 300ms delay - faster for more responsive feel

    return () => clearTimeout(debounceTimer);
  }, [chicksAmount, activeInput]);

  // Calculate CHICKS amount when USDC amount changes
  useEffect(() => {
    const calculateChicksAmount = async () => {
      if (!usdcAmount || parseFloat(usdcAmount) === 0 || activeInput !== 'usdc') return;

      try {
        // Don't disable the input field during calculation
        // setIsCalculating(true);
        // This is just an approximation since there's no direct method to calculate this
        // We need to account for the 1.6% fee
        const estimatedChicks = (parseFloat(usdcAmount) / (parseFloat(chicksPrice) * 0.984)).toFixed(6);
        setChicksAmount(estimatedChicks);
      } catch (error) {
        console.error('Error calculating CHICKS amount:', error);
      } finally {
        // setIsCalculating(false);
      }
    };

    // Add debounce to prevent calculation on every keystroke
    const debounceTimer = setTimeout(() => {
      calculateChicksAmount();
    }, 300); // 300ms delay - faster for more responsive feel

    return () => clearTimeout(debounceTimer);
  }, [usdcAmount, chicksPrice, activeInput]);

  const handleChicksChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setActiveInput('chicks');
      setChicksAmount(value);
      if (value === '') {
        setUsdcAmount('');
      }
    }
  };

  const handleUsdcChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setActiveInput('usdc');
      setUsdcAmount(value);
      if (value === '') {
        setChicksAmount('');
      }
    }
  };

  const handleMaxClick = () => {
    if (parseFloat(chicksBalance) > 0) {
      setChicksAmount(chicksBalance);
    }
  };

  const handleSell = async () => {
    if (!isConnected) {
      return;
    }

    if (!chicksAmount || parseFloat(chicksAmount) <= 0) {
      setError('Please enter a valid CHICKS amount');
      return;
    }

    if (parseFloat(chicksAmount) > parseFloat(chicksBalance)) {
      setError('Insufficient CHICKS balance');
      return;
    }
    
    // The minimum check will be handled by the service, but we can provide a better UX
    // by checking if the USDC value is too low (below 0.13 USDC)
    if (usdcAmount && parseFloat(usdcAmount) < 0.13) {
      setError('Sell amount too small. Must result in at least 0.13 USDC');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      // Execute sell transaction
      const tx = await chicksService.sellChicks(chicksAmount);
      await tx.wait();

      // Reset form
      setChicksAmount('');
      setUsdcAmount('');

      // Refresh data
      onSuccess();
    } catch (error: any) {
      console.error('Error selling CHICKS:', error);
      setError(error.message || 'Failed to sell CHICKS. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">Sell CHICKS</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Sell your CHICKS tokens for USDC at the current market price.
          <span className="font-semibold text-amber-600 dark:text-amber-400 block mt-1">
            Minimum trade value: 0.13 USDC equivalent
          </span>
        </p>
      </div>

      <div className="space-y-4">
        <div className="mb-4">
          <div className="flex justify-between mb-2">
            <label className="text-sm font-medium">CHICKS Amount</label>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Balance: {isConnected ? parseFloat(chicksBalance).toFixed(4) : '0.0000'} CHICKS
            </div>
          </div>
          <div className="flex space-x-2">
            <Input
              type="text"
              placeholder="0.00"
              value={chicksAmount}
              onChange={handleChicksChange}
              disabled={isSubmitting}
              className={`flex-1 ${activeInput === 'chicks' ? 'border-blue-500 ring-1 ring-blue-500' : ''}`}
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
          <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded-full">
            <ArrowsRightLeftIcon className="h-5 w-5 text-gray-500" />
          </div>
        </div>

        <div className="mb-4">
          <div className="flex justify-between mb-2">
            <label className="text-sm font-medium">USDC Amount (Estimated)</label>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Price: ${parseFloat(chicksPrice).toFixed(6)} USDC
            </div>
          </div>
          <Input
            type="text"
            placeholder="0.00"
            value={usdcAmount}
            onChange={handleUsdcChange}
            disabled={isSubmitting}
            className={`${activeInput === 'usdc' ? 'border-blue-500 ring-1 ring-blue-500' : ''}`}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            *Includes 1.6% sell fee
          </p>
        </div>

        {error && (
          <div className="text-red-500 text-sm p-2 bg-red-50 dark:bg-red-900/20 rounded">
            {error}
          </div>
        )}

        <Button
          onClick={handleSell}
          disabled={
            isSubmitting || 
            !chicksAmount || 
            parseFloat(chicksAmount) <= 0 ||
            parseFloat(chicksAmount) > parseFloat(chicksBalance)
          }
          className="w-full bg-btb-primary hover:bg-btb-primary/90"
        >
          {isSubmitting
            ? 'Processing...'
            : 'Sell CHICKS'}
        </Button>
      </div>
    </div>
  );
}
