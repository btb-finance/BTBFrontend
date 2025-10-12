'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '../../../context/WalletContext';
import chicksService from '../../services/chicksService';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { ArrowsRightLeftIcon } from '@heroicons/react/24/outline';

interface BuyFormProps {
  chicksPrice: string;
  usdcBalance: string;
  onSuccess: () => void;
}

export default function BuyForm({ chicksPrice, usdcBalance, onSuccess }: BuyFormProps) {
  const { isConnected } = useWallet();
  const [usdcAmount, setUsdcAmount] = useState<string>('');
  const [chicksAmount, setChicksAmount] = useState<string>('');
  const [isCalculatingChicks, setIsCalculatingChicks] = useState<boolean>(false);
  const [activeInput, setActiveInput] = useState<'usdc' | 'chicks'>('usdc');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate CHICKS amount when USDC amount changes
  useEffect(() => {
    const calculateChicksAmount = async () => {
      if (!usdcAmount || parseFloat(usdcAmount) === 0 || activeInput !== 'usdc') return;

      try {
        setIsCalculatingChicks(true);
        const amount = await chicksService.getBuyAmount(usdcAmount);
        setChicksAmount(amount);
      } catch (error) {
        console.error('Error calculating CHICKS amount:', error);
      } finally {
        setIsCalculatingChicks(false);
      }
    };

    // Add debounce to prevent calculation on every keystroke
    const debounceTimer = setTimeout(() => {
      calculateChicksAmount();
    }, 300); // 300ms delay - faster for more responsive feel

    return () => clearTimeout(debounceTimer);
  }, [usdcAmount, activeInput]);

  // Calculate USDC amount when CHICKS amount changes
  useEffect(() => {
    const calculateUsdcAmount = async () => {
      if (!chicksAmount || parseFloat(chicksAmount) === 0 || activeInput !== 'chicks') return;

      try {
        // This is just an approximation since there's no direct method to calculate this
        const estimatedUsdc = (parseFloat(chicksAmount) * parseFloat(chicksPrice)).toFixed(6);
        setUsdcAmount(estimatedUsdc);
      } catch (error) {
        console.error('Error calculating USDC amount:', error);
      }
    };

    // Add debounce to prevent calculation on every keystroke
    const debounceTimer = setTimeout(() => {
      calculateUsdcAmount();
    }, 300); // 300ms delay - faster for more responsive feel

    return () => clearTimeout(debounceTimer);
  }, [chicksAmount, chicksPrice, activeInput]);

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

  const handleMaxClick = () => {
    if (parseFloat(usdcBalance) > 0) {
      setUsdcAmount(usdcBalance);
    }
  };

  const handleBuy = async () => {
    if (!isConnected) {
      return;
    }

    if (!usdcAmount || parseFloat(usdcAmount) <= 0) {
      setError('Please enter a valid USDC amount');
      return;
    }
    
    if (parseFloat(usdcAmount) < 0.125) {
      setError('Minimum trade amount is 0.125 USDC');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      // Execute buy transaction
      const tx = await chicksService.buyChicks(usdcAmount);

      // Reset form
      setUsdcAmount('');
      setChicksAmount('');

      // Refresh data
      onSuccess();
    } catch (error: any) {
      console.error('Error buying CHICKS:', error);
      setError(error.message || 'Failed to buy CHICKS. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">Buy CHICKS</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Purchase CHICKS tokens with USDC at the current market price.
          <span className="font-semibold text-amber-600 dark:text-amber-400 block mt-1">
            Minimum trade amount: 0.125 USDC
          </span>
        </p>
      </div>

      <div className="space-y-4">
        <div className="mb-4">
          <div className="flex justify-between mb-2">
            <label className="text-sm font-medium">USDC Amount</label>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Balance: {isConnected ? parseFloat(usdcBalance).toFixed(4) : '0.0000'} USDC
            </div>
          </div>
          <div className="flex space-x-2">
            <Input
              type="text"
              placeholder="0.00"
              value={usdcAmount}
              onChange={handleUsdcChange}
              disabled={isSubmitting}
              className={`flex-1 ${activeInput === 'usdc' ? 'border-blue-500 ring-1 ring-blue-500' : ''}`}
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
            <label className="text-sm font-medium">CHICKS Amount (Estimated)</label>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Price: ${parseFloat(chicksPrice).toFixed(6)} USDC
            </div>
          </div>
          <Input
            type="text"
            placeholder="0.00"
            value={chicksAmount}
            onChange={handleChicksChange}
            disabled={isSubmitting}
            className={`${activeInput === 'chicks' ? 'border-blue-500 ring-1 ring-blue-500' : ''}`}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            *Includes 1.6% buy fee
          </p>
        </div>

        {error && (
          <div className="text-red-500 text-sm p-2 bg-red-50 dark:bg-red-900/20 rounded">
            {error}
          </div>
        )}

        <Button
          onClick={handleBuy}
          disabled={isSubmitting || !usdcAmount || parseFloat(usdcAmount) < 0.125}
          className="w-full bg-btb-primary hover:bg-btb-primary/90"
        >
          {!isConnected
            ? 'Connect Wallet'
            : isSubmitting
            ? 'Processing...'
            : parseFloat(usdcAmount || '0') < 0.125
            ? 'Minimum 0.125 USDC'
            : 'Buy CHICKS'}
        </Button>
      </div>
    </div>
  );
}
