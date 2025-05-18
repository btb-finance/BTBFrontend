'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '../../../context/WalletContext';
import chicksService from '../../services/chicksService';
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
        // Don't disable the input field during calculation
        // setIsCalculating(true);
        setError(null);
        
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
      } catch (error: any) {
        console.error('Error calculating leverage details:', error);
        setError('Failed to calculate leverage details. Please try again.');
      } finally {
        // setIsCalculating(false);
      }
    };
    
    // Add debounce to prevent calculation on every keystroke
    const debounceTimer = setTimeout(() => {
      calculateLeverage();
    }, 300); // 300ms delay - faster for more responsive feel

    return () => clearTimeout(debounceTimer);
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
      return;
    }

    if (!usdcAmount || parseFloat(usdcAmount) <= 0) {
      setError('Please enter a valid USDC amount');
      return;
    }

    if (days <= 0) {
      setError('Please select a valid loan duration');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('Preparing transaction...');

      // Check if user already has an active loan
      const hasLoan = await chicksService.hasActiveLoan();
      if (hasLoan) {
        setError('You already have an active loan. Please repay or close your existing position before creating a new one.');
        setIsSubmitting(false);
        return;
      }

      console.log('Starting leverage process with:', {
        usdcAmount,
        days,
        leverageFee,
        totalCost
      });

      // Execute leverage transaction with retry logic
      let tx;
      try {
        tx = await chicksService.leverage(usdcAmount, days);
      } catch (leverageError: any) {
        console.error('Initial leverage attempt failed:', leverageError);
        
        // Display the error to the user
        setError(`Transaction failed: ${leverageError.message || 'Unknown error'}. Please check your wallet and try again.`);
        setIsSubmitting(false);
        return;
      }
      
      if (!tx) {
        setError('Failed to create transaction. Please try again later.');
        setIsSubmitting(false);
        return;
      }
      
      console.log('Transaction submitted:', tx.hash);
      setError(`Transaction submitted. Waiting for confirmation... (${tx.hash.substring(0, 10)}...)`);
      
      try {
        const receipt = await tx.wait();
        console.log('Transaction confirmed:', receipt);
        
        // Reset form
        setUsdcAmount('');
        setChicksAmount('');
        setDays(30);
        setLeverageFee('0');
        setTotalCost('0');
        setError('Transaction successful! Position created.');
        
        // Refresh data
        onSuccess();
      } catch (confirmError: any) {
        console.error('Transaction failed during confirmation:', confirmError);
        setError(`Transaction failed during confirmation: ${confirmError.message || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Error creating leveraged position:', error);
      
      // Extract meaningful error message
      let errorMessage = 'Failed to create leveraged position. Please try again.';
      
      if (typeof error === 'object' && error !== null) {
        if (error.message) {
          errorMessage = error.message;
          
          // Special case handling for common errors
          if (errorMessage.includes('active loan')) {
            errorMessage = 'You already have an active loan. Please repay or close your existing position before creating a new one.';
          } else if (errorMessage.includes('user rejected')) {
            errorMessage = 'Transaction was rejected in your wallet. Please try again if you want to proceed.';
          } else if (errorMessage.includes('insufficient funds')) {
            errorMessage = 'Insufficient funds for this transaction. Please check your balance and try again.';
          }
        }
      }
      
      setError(errorMessage);
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

        <div className="space-y-2">
          <label htmlFor="days" className="block text-sm font-medium">
            Loan Duration (Days)
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[7, 14, 30].map((option) => (
              <Button
                key={option}
                type="button"
                variant={days === option ? "default" : "outline"}
                onClick={() => setDays(option)}
                disabled={isSubmitting}
                className="w-full"
              >
                {option} Days
              </Button>
            ))}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Longer durations may have higher fees but provide more time before repayment is required.
          </div>
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
          <div className={`text-sm p-3 rounded ${error.includes('submitted') ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300' : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'}`}>
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
