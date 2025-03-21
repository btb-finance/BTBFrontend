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

  useEffect(() => {
    if (hasLoan && loanData) {
      // Calculate remaining debt
      const totalDebt = parseFloat(loanData.borrowed) + parseFloat(loanData.interest);
      setRemainingDebt(totalDebt.toFixed(6));
      
      // Default to full repayment
      setRepayAmount(totalDebt.toFixed(6));
      setIsPartialRepay(false);
    } else {
      setRemainingDebt('0');
      setRepayAmount('');
    }
  }, [hasLoan, loanData]);

  // Calculate new remaining debt when repay amount changes
  useEffect(() => {
    if (!hasLoan || !loanData || !repayAmount || parseFloat(repayAmount) <= 0) {
      return;
    }

    const totalDebt = parseFloat(loanData.borrowed) + parseFloat(loanData.interest);
    const newRemainingDebt = Math.max(0, totalDebt - parseFloat(repayAmount));
    setRemainingDebt(newRemainingDebt.toFixed(6));
    
    // Update partial repay flag
    setIsPartialRepay(parseFloat(repayAmount) < totalDebt);
  }, [repayAmount, hasLoan, loanData]);

  const handleRepayAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setRepayAmount(value);
    }
  };

  const handleMaxClick = () => {
    if (hasLoan && loanData) {
      const totalDebt = parseFloat(loanData.borrowed) + parseFloat(loanData.interest);
      
      // Use the minimum of total debt or USDC balance
      const maxRepay = Math.min(totalDebt, parseFloat(usdcBalance));
      setRepayAmount(maxRepay.toFixed(6));
    }
  };

  const handleFullRepayClick = () => {
    if (hasLoan && loanData) {
      const totalDebt = parseFloat(loanData.borrowed) + parseFloat(loanData.interest);
      setRepayAmount(totalDebt.toFixed(6));
    }
  };

  const handleRepay = async () => {
    if (!isConnected) {
      // Removed connectWallet call
      return;
    }

    if (!hasLoan) {
      setError('You don\'t have any active loans to repay');
      return;
    }

    if (!repayAmount || parseFloat(repayAmount) <= 0) {
      setError('Please enter a valid repayment amount');
      return;
    }

    const totalDebt = parseFloat(loanData.borrowed) + parseFloat(loanData.interest);
    if (parseFloat(repayAmount) > totalDebt) {
      setError('Repayment amount cannot exceed your total debt');
      return;
    }

    if (parseFloat(repayAmount) > parseFloat(usdcBalance)) {
      setError('Insufficient USDC balance for repayment');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      // Execute repay transaction
      const tx = await chicksService.repay(repayAmount);
      await tx.wait();

      // Reset form
      setRepayAmount('');

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
            <span className="text-sm">Borrowed Amount:</span>
            <span className="text-sm font-medium">
              {loanData ? parseFloat(loanData.borrowed).toFixed(6) : '0.00'} USDC
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm">Accrued Interest:</span>
            <span className="text-sm font-medium">
              {loanData ? parseFloat(loanData.interest).toFixed(6) : '0.00'} USDC
            </span>
          </div>
          <div className="flex justify-between font-medium">
            <span>Total Debt:</span>
            <span>
              {loanData 
                ? (parseFloat(loanData.borrowed) + parseFloat(loanData.interest)).toFixed(6) 
                : '0.00'} USDC
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm">Loan Expiry:</span>
            <span className="text-sm font-medium">
              {loanData && loanData.expiry 
                ? new Date(parseInt(loanData.expiry) * 1000).toLocaleDateString() 
                : 'N/A'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm">Collateral:</span>
            <span className="text-sm font-medium">
              {loanData ? parseFloat(loanData.collateral).toFixed(6) : '0.00'} CHICKS
            </span>
          </div>
        </div>

        <div>
          <div className="flex justify-between mb-2">
            <label htmlFor="repayAmount" className="text-sm font-medium">
              Repayment Amount
            </label>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Balance: {parseFloat(usdcBalance).toFixed(2)} USDC
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
        </div>

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

        {isPartialRepay && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded text-sm">
            <p className="font-medium text-yellow-800 dark:text-yellow-200 mb-1">
              Partial Repayment
            </p>
            <p className="text-yellow-700 dark:text-yellow-300">
              After this repayment, you will still owe {parseFloat(remainingDebt).toFixed(6)} USDC.
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
            !repayAmount || 
            parseFloat(repayAmount) <= 0 ||
            parseFloat(repayAmount) > parseFloat(usdcBalance)
          }
          className="w-full bg-btb-primary hover:bg-btb-primary/90"
        >
          {isSubmitting ? 'Processing...' : 'Repay Loan'}
        </Button>
      </div>
    </div>
  );
}
