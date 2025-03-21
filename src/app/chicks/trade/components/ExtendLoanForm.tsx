'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '../../../context/WalletContext';
import chicksService from '../../../services/chicksService';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { ClockIcon } from '@heroicons/react/24/outline';
import { formatDistanceToNow } from 'date-fns';

interface ExtendLoanFormProps {
  hasLoan: boolean;
  loanData: any;
  usdcBalance: string;
  onSuccess: () => void;
}

export default function ExtendLoanForm({ hasLoan, loanData, usdcBalance, onSuccess }: ExtendLoanFormProps) {
  const { isConnected } = useWallet();
  const [additionalDays, setAdditionalDays] = useState<number>(30);
  const [extensionFee, setExtensionFee] = useState<string>('0');
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [currentEndDate, setCurrentEndDate] = useState<Date | null>(null);
  const [newEndDate, setNewEndDate] = useState<Date | null>(null);
  const [maxAdditionalDays, setMaxAdditionalDays] = useState<number>(365);

  // Safely parse numeric values to prevent NaN
  const safeParseFloat = (value: string | number | undefined): number => {
    if (value === undefined || value === null) return 0;
    const parsed = typeof value === 'string' ? parseFloat(value) : value;
    return isNaN(parsed) ? 0 : parsed;
  };

  // Calculate extension fee when days change
  useEffect(() => {
    const calculateExtensionFee = async () => {
      if (!hasLoan || !loanData || additionalDays <= 0) return;

      try {
        setIsCalculating(true);
        
        // Calculate extension fee based on borrowed amount and additional days
        const fee = await chicksService.getBorrowFee(loanData.borrowed, additionalDays);
        setExtensionFee(fee);
      } catch (error) {
        console.error('Error calculating extension fee:', error);
      } finally {
        setIsCalculating(false);
      }
    };

    calculateExtensionFee();
  }, [hasLoan, loanData, additionalDays]);

  // Update end date calculations when loan data or additional days change
  useEffect(() => {
    if (hasLoan && loanData && loanData.endDate) {
      const endDate = new Date(loanData.endDate * 1000); // Convert from Unix timestamp
      setCurrentEndDate(endDate);
      
      // Calculate new end date
      const newDate = new Date(endDate);
      newDate.setDate(newDate.getDate() + additionalDays);
      setNewEndDate(newDate);

      // Calculate max additional days (365 - current loan days)
      if (loanData.numberOfDays) {
        const remainingDays = Math.max(0, Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
        const currentLoanDays = loanData.numberOfDays;
        const maxDays = Math.max(0, 365 - currentLoanDays);
        setMaxAdditionalDays(maxDays);
        
        // If current additionalDays is greater than maxAdditionalDays, adjust it
        if (additionalDays > maxDays) {
          setAdditionalDays(maxDays);
        }
      }
    } else {
      setCurrentEndDate(null);
      setNewEndDate(null);
    }
  }, [hasLoan, loanData, additionalDays]);

  const handleDaysChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value > 0 && value <= maxAdditionalDays) {
      setAdditionalDays(value);
    }
  };

  const handleExtendLoan = async () => {
    if (!isConnected || !hasLoan) {
      setError('Please connect your wallet and ensure you have an active loan.');
      return;
    }

    if (additionalDays <= 0) {
      setError('Please enter a valid number of days to extend.');
      return;
    }

    if (additionalDays > maxAdditionalDays) {
      setError(`You can only extend your loan by up to ${maxAdditionalDays} more days to stay within the 1-year limit.`);
      return;
    }

    // Check if user has enough USDC for the extension fee
    if (safeParseFloat(extensionFee) > safeParseFloat(usdcBalance)) {
      setError('Insufficient USDC balance to pay the extension fee.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      // Call the extendLoan method from the service
      const tx = await chicksService.extendLoan(additionalDays, extensionFee);
      
      // Wait for transaction to be mined
      await tx.wait();
      
      // Call onSuccess callback to refresh data
      onSuccess();
      
      // Reset form
      setAdditionalDays(30);
    } catch (error: any) {
      console.error('Error extending loan:', error);
      setError(error.message || 'Failed to extend loan. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!hasLoan) {
    return (
      <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-800 text-center">
        <p className="text-gray-500 dark:text-gray-400">
          You don't have an active loan to extend.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">Extend Loan Duration</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Extend the duration of your existing loan by paying an additional interest fee.
        </p>
      </div>

      <div className="space-y-4">
        {/* Current loan details */}
        <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
          <h4 className="font-medium mb-2">Current Loan Details</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="text-gray-500 dark:text-gray-400">Borrowed Amount:</div>
            <div className="text-right font-medium">{loanData?.borrowed} USDC</div>
            
            <div className="text-gray-500 dark:text-gray-400">Collateral:</div>
            <div className="text-right font-medium">{loanData?.collateral} CHICKS</div>
            
            <div className="text-gray-500 dark:text-gray-400">Current End Date:</div>
            <div className="text-right font-medium">
              {currentEndDate ? currentEndDate.toLocaleDateString() : 'N/A'}
              {currentEndDate && (
                <span className="block text-xs text-gray-500">
                  ({formatDistanceToNow(currentEndDate, { addSuffix: true })})
                </span>
              )}
            </div>
            
            <div className="text-gray-500 dark:text-gray-400">Current Duration:</div>
            <div className="text-right font-medium">
              {loanData?.numberOfDays ? `${loanData.numberOfDays} days` : 'N/A'}
            </div>
          </div>
        </div>

        {/* Extension form */}
        <div>
          <label htmlFor="additionalDays" className="block text-sm font-medium mb-2">
            Additional Days (Max: {maxAdditionalDays})
          </label>
          <div className="flex items-center space-x-2">
            <Input
              id="additionalDays"
              type="number"
              min="1"
              max={maxAdditionalDays}
              value={additionalDays}
              onChange={handleDaysChange}
              disabled={isSubmitting}
              className="w-24"
            />
            <input
              type="range"
              min="1"
              max={maxAdditionalDays}
              value={additionalDays}
              onChange={(e) => setAdditionalDays(parseInt(e.target.value))}
              disabled={isSubmitting}
              className="flex-1"
            />
          </div>
        </div>

        {/* Extension fee */}
        <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
          <div className="flex justify-between mb-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">Extension Fee:</span>
            <span className="font-medium">
              {isCalculating ? 'Calculating...' : `${extensionFee} USDC`}
            </span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-sm text-gray-500 dark:text-gray-400">New End Date:</span>
            <span className="font-medium">
              {newEndDate ? newEndDate.toLocaleDateString() : 'N/A'}
              {newEndDate && (
                <span className="block text-xs text-gray-500 text-right">
                  ({formatDistanceToNow(newEndDate, { addSuffix: true })})
                </span>
              )}
            </span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-sm text-gray-500 dark:text-gray-400">Total Duration After Extension:</span>
            <span className="font-medium">
              {loanData?.numberOfDays ? `${loanData.numberOfDays + additionalDays} days` : 'N/A'}
            </span>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-md">
            {error}
          </div>
        )}

        {/* Submit button */}
        <Button
          type="button"
          onClick={handleExtendLoan}
          disabled={!isConnected || isSubmitting || isCalculating || additionalDays <= 0}
          className="w-full"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center">
              <ClockIcon className="w-4 h-4 mr-2 animate-spin" />
              Extending Loan...
            </span>
          ) : (
            'Extend Loan'
          )}
        </Button>

        <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
          Your USDC Balance: {parseFloat(usdcBalance).toFixed(6)} USDC
        </div>
      </div>
    </div>
  );
}
