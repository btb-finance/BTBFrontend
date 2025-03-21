'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '../../../context/WalletContext';
import chicksService from '../../../services/chicksService';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { ShieldCheckIcon } from '@heroicons/react/24/outline';

interface RepayFormProps {
  hasLoan: boolean;
  loanData: any;
  usdcBalance: string;
  onSuccess: () => void;
}

export default function RepayForm({ hasLoan, loanData, usdcBalance, onSuccess }: RepayFormProps) {
  const { isConnected } = useWallet();
  const [repayAmount, setRepayAmount] = useState<string>('');
  const [isPartialRepay, setIsPartialRepay] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [remainingDebt, setRemainingDebt] = useState<string>('0');
  const [repayMethod, setRepayMethod] = useState<'regular' | 'close' | 'flash'>('regular');

  // Safely parse numeric values to prevent NaN
  const safeParseFloat = (value: string | number | undefined): number => {
    if (value === undefined || value === null) return 0;
    const parsed = typeof value === 'string' ? parseFloat(value) : value;
    return isNaN(parsed) ? 0 : parsed;
  };

  useEffect(() => {
    if (hasLoan && loanData) {
      // Calculate remaining debt - safely parse values to prevent NaN
      const borrowed = safeParseFloat(loanData.borrowed);
      const interest = safeParseFloat(loanData.interest);
      const totalDebt = borrowed + interest;
      
      setRemainingDebt(totalDebt.toFixed(6));
      
      // Only set default repayment amount if it's not already set
      // This prevents overriding user input when loan data updates
      if (!repayAmount) {
        setRepayAmount(totalDebt.toFixed(6));
        setIsPartialRepay(false);
      }
    } else {
      setRemainingDebt('0');
      setRepayAmount('');
    }
  }, [hasLoan, loanData, repayAmount]);

  // Calculate new remaining debt when repay amount changes
  useEffect(() => {
    if (!hasLoan || !loanData || !repayAmount || safeParseFloat(repayAmount) <= 0) {
      return;
    }

    const borrowed = safeParseFloat(loanData.borrowed);
    const interest = safeParseFloat(loanData.interest);
    const totalDebt = borrowed + interest;
    const newRemainingDebt = Math.max(0, totalDebt - safeParseFloat(repayAmount));
    setRemainingDebt(newRemainingDebt.toFixed(6));
    
    // Update partial repay flag
    setIsPartialRepay(safeParseFloat(repayAmount) < totalDebt);
  }, [repayAmount, hasLoan, loanData]);

  const handleRepayAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow empty string, digits, and at most one decimal point
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setRepayAmount(value);
      
      // When user starts typing, consider it a partial repayment
      if (value && hasLoan && loanData) {
        const borrowed = safeParseFloat(loanData.borrowed);
        const interest = safeParseFloat(loanData.interest);
        const totalDebt = borrowed + interest;
        setIsPartialRepay(safeParseFloat(value) < totalDebt);
      }
    }
  };

  const handleMaxClick = () => {
    if (hasLoan && loanData) {
      const borrowed = safeParseFloat(loanData.borrowed);
      const interest = safeParseFloat(loanData.interest);
      const totalDebt = borrowed + interest;
      
      // Use the minimum of total debt or USDC balance
      const maxRepay = Math.min(totalDebt, safeParseFloat(usdcBalance));
      setRepayAmount(maxRepay.toFixed(6));
    }
  };

  const handleFullRepayClick = () => {
    if (hasLoan && loanData) {
      const borrowed = safeParseFloat(loanData.borrowed);
      const interest = safeParseFloat(loanData.interest);
      const totalDebt = borrowed + interest;
      setRepayAmount(totalDebt.toFixed(6));
    }
  };

  const handleRepay = async () => {
    if (!isConnected) {
      return;
    }

    if (!hasLoan) {
      setError('You don\'t have any active loans to repay');
      return;
    }

    if (repayMethod !== 'flash' && (!repayAmount || safeParseFloat(repayAmount) <= 0)) {
      setError('Please enter a valid repayment amount');
      return;
    }

    if (repayMethod !== 'flash') {
      const borrowed = safeParseFloat(loanData.borrowed);
      const interest = safeParseFloat(loanData.interest);
      const totalDebt = borrowed + interest;
      
      if (safeParseFloat(repayAmount) > totalDebt) {
        setError('Repayment amount cannot exceed your total debt');
        return;
      }

      if (safeParseFloat(repayAmount) > safeParseFloat(usdcBalance)) {
        setError('Insufficient USDC balance for repayment');
        return;
      }
    }

    try {
      setIsSubmitting(true);
      setError(null);

      let tx;
      // Execute transaction based on selected method
      switch (repayMethod) {
        case 'regular':
          tx = await chicksService.repay(repayAmount);
          break;
        case 'close':
          // Use the updated closePosition method which automatically gets the borrowed amount
          tx = await chicksService.closePosition();
          break;
        case 'flash':
          tx = await chicksService.flashClosePosition();
          break;
      }
      
      await tx.wait();

      // Reset form
      setRepayAmount('');
      setRepayMethod('regular');

      // Refresh data
      onSuccess();
    } catch (error: any) {
      console.error('Error repaying loan:', error);
      setError(error.message || 'Failed to repay loan. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!hasLoan) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium mb-2">Repay Loan</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Repay your outstanding loans to retrieve your collateral.
          </p>
        </div>
        
        <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg text-center">
          <ShieldCheckIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h4 className="text-lg font-medium mb-2">No Active Loans</h4>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            You don't have any active loans to repay at this time.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">Repay Loan</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Repay your outstanding loans to retrieve your collateral.
        </p>
      </div>

      <div className="space-y-4">
        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg space-y-2">
          <div className="flex justify-between">
            <span className="text-sm text-gray-500 dark:text-gray-400">Borrowed Amount:</span>
            <span className="text-sm font-medium">
              {loanData?.borrowed ? safeParseFloat(loanData.borrowed).toFixed(6) : '0'} USDC
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-500 dark:text-gray-400">Accrued Interest:</span>
            <span className="text-sm font-medium">
              {loanData?.interest ? safeParseFloat(loanData.interest).toFixed(6) : '0'} USDC
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-500 dark:text-gray-400">Total Debt:</span>
            <span className="text-sm font-medium">
              {loanData ? (safeParseFloat(loanData.borrowed) + safeParseFloat(loanData.interest)).toFixed(6) : '0'} USDC
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-500 dark:text-gray-400">Loan Expiry:</span>
            <span className="text-sm font-medium">
              {loanData?.endDate ? new Date(loanData.endDate * 1000).toLocaleDateString() : 'N/A'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-500 dark:text-gray-400">Collateral:</span>
            <span className="text-sm font-medium">
              {loanData?.collateral ? safeParseFloat(loanData.collateral).toFixed(6) : '0'} CHICKS
            </span>
          </div>
        </div>

        <div className="flex flex-col space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <Button
              type="button"
              variant={repayMethod === 'regular' ? "default" : "outline"}
              onClick={() => setRepayMethod('regular')}
              disabled={isSubmitting}
              className="w-full"
            >
              Regular Repay
            </Button>
            <Button
              type="button"
              variant={repayMethod === 'close' ? "default" : "outline"}
              onClick={() => setRepayMethod('close')}
              disabled={isSubmitting}
              className="w-full"
            >
              Close Position
            </Button>
            <Button
              type="button"
              variant={repayMethod === 'flash' ? "default" : "outline"}
              onClick={() => setRepayMethod('flash')}
              disabled={isSubmitting}
              className="w-full"
            >
              Flash Close
            </Button>
          </div>

          {repayMethod !== 'flash' && (
            <div>
              <div className="flex justify-between mb-2">
                <label htmlFor="repayAmount" className="text-sm font-medium">
                  Repayment Amount
                </label>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Balance: {safeParseFloat(usdcBalance).toFixed(2)} USDC
                </div>
              </div>
              <div className="flex space-x-2">
                <Input
                  id="repayAmount"
                  type="text"
                  placeholder="0.00"
                  value={repayAmount}
                  onChange={handleRepayAmountChange}
                  disabled={isSubmitting}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleMaxClick}
                  disabled={isSubmitting}
                  className="w-16"
                >
                  Max
                </Button>
              </div>
              {repayMethod === 'close' && (
                <div className="mt-2 text-sm text-amber-600 dark:text-amber-400">
                  For closing position, the full debt amount will be used regardless of the input value.
                </div>
              )}
            </div>
          )}

          {repayMethod === 'flash' && (
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded text-sm">
              <p className="font-medium text-blue-800 dark:text-blue-200 mb-1">
                Flash Close Position
              </p>
              <p className="text-blue-700 dark:text-blue-300">
                This will use a flash loan to repay your entire debt and return your collateral in a single transaction.
                No USDC is required upfront, but there may be additional fees.
              </p>
            </div>
          )}

          {repayMethod === 'close' && (
            <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded text-sm">
              <p className="font-medium text-green-800 dark:text-green-200 mb-1">
                Close Position
              </p>
              <p className="text-green-700 dark:text-green-300">
                This will fully repay your loan and return all your collateral in a single transaction.
              </p>
            </div>
          )}

          {repayMethod === 'regular' && (
            <div className="flex justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={handleFullRepayClick}
                disabled={isSubmitting}
                className="flex-1 mr-2"
              >
                Full Repayment
              </Button>
              <Button
                type="button"
                variant={isPartialRepay ? "default" : "outline"}
                onClick={() => setIsPartialRepay(true)}
                disabled={isSubmitting}
                className="flex-1 ml-2"
              >
                Partial Repayment
              </Button>
            </div>
          )}

          {repayMethod === 'regular' && isPartialRepay && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded text-sm">
              <p className="font-medium text-yellow-800 dark:text-yellow-200 mb-1">
                Partial Repayment
              </p>
              <p className="text-yellow-700 dark:text-yellow-300">
                After this repayment, you will still owe {safeParseFloat(remainingDebt).toFixed(6)} USDC.
                Your collateral will remain locked until the loan is fully repaid.
              </p>
            </div>
          )}

          {error && (
            <div className="text-red-500 text-sm p-2 bg-red-50 dark:bg-red-900/20 rounded">
              {error}
            </div>
          )}

          <Button
            onClick={handleRepay}
            disabled={
              isSubmitting || 
              (repayMethod !== 'flash' && (!repayAmount || safeParseFloat(repayAmount) <= 0 || safeParseFloat(repayAmount) > safeParseFloat(usdcBalance)))
            }
            className="w-full bg-btb-primary hover:bg-btb-primary/90"
          >
            {isSubmitting 
              ? 'Processing...' 
              : repayMethod === 'regular' 
                ? 'Repay Loan' 
                : repayMethod === 'close' 
                  ? 'Close Position' 
                  : 'Flash Close Position'}
          </Button>
        </div>
      </div>
    </div>
  );
}
