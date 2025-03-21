'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '../../../context/WalletContext';
import chicksService from '../../../services/chicksService';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { ArrowTrendingUpIcon } from '@heroicons/react/24/outline';

interface LeverageFormProps {
  chicksPrice: string;
  usdcBalance: string;
  onSuccess: () => void;
}

export default function LeverageForm({ chicksPrice, usdcBalance, onSuccess }: LeverageFormProps) {
  const { isConnected } = useWallet();
  const [usdcAmount, setUsdcAmount] = useState<string>('');
  const [chicksAmount, setChicksAmount] = useState<string>('');
  const [days, setDays] = useState<number>(30);
  const [leverageFee, setLeverageFee] = useState<string>('0');
  const [totalCost, setTotalCost] = useState<string>('0');
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate leverage fee and CHICKS amount when USDC amount or days change
  useEffect(() => {
    const calculateLeverage = async () => {
      if (!usdcAmount || parseFloat(usdcAmount) === 0 || days <= 0) return;

      try {
        setIsCalculating(true);
        
        // Calculate leverage fee
        const fee = await chicksService.getLeverageFee(usdcAmount, days);
        setLeverageFee(fee);
        
        // Calculate total cost (USDC amount + fee)
        const total = (parseFloat(usdcAmount) + parseFloat(fee)).toFixed(6);
        setTotalCost(total);
        
        // Calculate estimated CHICKS amount
        // This is an approximation since we don't have the exact formula
        const estimatedChicks = (parseFloat(usdcAmount) / parseFloat(chicksPrice)).toFixed(6);
        setChicksAmount(estimatedChicks);
      } catch (error) {
        console.error('Error calculating leverage details:', error);
      } finally {
        setIsCalculating(false);
      }
    };

    calculateLeverage();
  }, [usdcAmount, days, chicksPrice]);

  const handleUsdcChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setUsdcAmount(value);
      if (value === '') {
        setChicksAmount('');
        setLeverageFee('0');
        setTotalCost('0');
      }
    }
  };

  const handleDaysChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value >= 1 && value <= 365) {
      setDays(value);
    }
  };

  const handleMaxClick = () => {
    if (parseFloat(usdcBalance) > 0) {
      // Set to 90% of balance to account for fees
      const maxAmount = (parseFloat(usdcBalance) * 0.9).toFixed(6);
      setUsdcAmount(maxAmount);
    }
  };

  const handleLeverage = async () => {
    if (!isConnected) {
      // Removed connectWallet call
      return;
    }

    if (!usdcAmount || parseFloat(usdcAmount) <= 0) {
      setError('Please enter a valid USDC amount');
      return;
    }

    if (days <= 0 || days > 365) {
      setError('Loan duration must be between 1 and 365 days');
      return;
    }

    if (parseFloat(totalCost) > parseFloat(usdcBalance)) {
      setError('Insufficient USDC balance for leverage + fees');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      // Execute leverage transaction
      const tx = await chicksService.leverage(usdcAmount, days);
      await tx.wait();

      // Reset form
      setUsdcAmount('');
      setChicksAmount('');
      setDays(30);
      setLeverageFee('0');
      setTotalCost('0');

      // Refresh data
      onSuccess();
    } catch (error: any) {
      console.error('Error creating leveraged position:', error);
      setError(error.message || 'Failed to create leveraged position. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">Leverage</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Create a leveraged position by borrowing USDC to buy more CHICKS.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <div className="flex justify-between mb-2">
            <label htmlFor="usdcAmount" className="text-sm font-medium">
              USDC Amount to Leverage
            </label>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Balance: {isConnected ? parseFloat(usdcBalance).toFixed(2) : '0.00'} USDC
            </div>
          </div>
          <div className="flex space-x-2">
            <Input
              id="usdcAmount"
              type="text"
              placeholder="0.00"
              value={usdcAmount}
              onChange={handleUsdcChange}
              disabled={isSubmitting || isCalculating}
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

        <div>
          <label htmlFor="days" className="block text-sm font-medium mb-2">
            Loan Duration (Days)
          </label>
          <div className="flex items-center space-x-2">
            <Input
              id="days"
              type="number"
              min="1"
              max="365"
              value={days}
              onChange={handleDaysChange}
              disabled={isSubmitting}
              className="w-24"
            />
            <input
              type="range"
              min="1"
              max="365"
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value))}
              disabled={isSubmitting}
              className="flex-1"
            />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Longer durations have higher fees but provide more time before liquidation.
          </p>
        </div>

        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg space-y-2">
          <div className="flex justify-between">
            <span className="text-sm">Estimated CHICKS:</span>
            <span className="text-sm font-medium">
              {chicksAmount ? parseFloat(chicksAmount).toFixed(6) : '0.00'} CHICKS
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm">Leverage Fee:</span>
            <span className="text-sm font-medium">
              {leverageFee ? parseFloat(leverageFee).toFixed(6) : '0.00'} USDC
            </span>
          </div>
          <div className="flex justify-between font-medium">
            <span>Total Cost:</span>
            <span>{totalCost ? parseFloat(totalCost).toFixed(6) : '0.00'} USDC</span>
          </div>
        </div>

        {error && (
          <div className="text-red-500 text-sm p-2 bg-red-50 dark:bg-red-900/20 rounded">
            {error}
          </div>
        )}

        <Button
          onClick={handleLeverage}
          disabled={
            isSubmitting || 
            isCalculating || 
            !usdcAmount || 
            parseFloat(usdcAmount) <= 0 ||
            parseFloat(totalCost) > parseFloat(usdcBalance)
          }
          className="w-full bg-btb-primary hover:bg-btb-primary/90"
        >
          {!isConnected
            ? 'Connect Wallet'
            : isSubmitting
            ? 'Processing...'
            : 'Create Leveraged Position'}
        </Button>
      </div>
    </div>
  );
}
