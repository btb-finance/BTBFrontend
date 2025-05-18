'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '../../../context/WalletContext';
import chicksService from '../../services/chicksService';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';

interface LoanData {
  collateral: string;
  borrowed: string;
  endDate: number;
  numberOfDays: number;
}

interface BorrowFormProps {
  chicksPrice: string;
  chicksBalance: string;
  onSuccess: () => void;
}

export default function BorrowForm({ chicksPrice, chicksBalance, onSuccess }: BorrowFormProps) {
  const { isConnected } = useWallet();
  const [chicksAmount, setChicksAmount] = useState<string>('');
  const [usdcAmount, setUsdcAmount] = useState<string>('');
  const [days, setDays] = useState<number>(30);
  const [borrowFee, setBorrowFee] = useState<string>('0');
  const [collateralRatio, setCollateralRatio] = useState<number>(150);
  const [maxBorrowAmount, setMaxBorrowAmount] = useState<string>('0');
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoan, setHasLoan] = useState<boolean>(false);
  const [loanData, setLoanData] = useState<LoanData | null>(null);
  const [isBorrowMore, setIsBorrowMore] = useState<boolean>(false);

  // Calculate max borrow amount based on CHICKS balance
  useEffect(() => {
    const calculateMaxBorrow = async () => {
      if (!isConnected || parseFloat(chicksBalance) <= 0) {
        setMaxBorrowAmount('0');
        return;
      }

      try {
        // Calculate max borrow amount based on collateral ratio
        // Max borrow = (CHICKS balance * CHICKS price) / collateral ratio
        const maxBorrow = (
          (parseFloat(chicksBalance) * parseFloat(chicksPrice)) / 
          (collateralRatio / 100)
        ).toFixed(6);
        
        setMaxBorrowAmount(maxBorrow);
      } catch (error) {
        console.error('Error calculating max borrow amount:', error);
        setMaxBorrowAmount('0');
      }
    };

    calculateMaxBorrow();
  }, [isConnected, chicksBalance, chicksPrice, collateralRatio]);

  // Check if user has an existing loan
  useEffect(() => {
    const checkLoan = async () => {
      if (!isConnected) {
        setHasLoan(false);
        setLoanData(null);
        setIsBorrowMore(false);
        return;
      }

      try {
        const loan = await chicksService.getUserLoan();
        const hasActiveLoan = parseFloat(loan.borrowed) > 0;
        setHasLoan(hasActiveLoan);
        setLoanData(loan);
        
        // Automatically switch to borrowMore mode if user has an active loan
        if (hasActiveLoan) {
          setIsBorrowMore(true);
        }
      } catch (error) {
        console.error('Error checking loan:', error);
      }
    };

    checkLoan();
  }, [isConnected]);

  // Calculate borrow fee when USDC amount or days change
  useEffect(() => {
    const calculateBorrowFee = async () => {
      if (!usdcAmount || parseFloat(usdcAmount) <= 0 || days <= 0) return;

      try {
        // Don't disable the input field during calculation
        // setIsCalculating(true);
        
        // Calculate borrow fee
        const fee = await chicksService.getBorrowFee(usdcAmount, days);
        setBorrowFee(fee);
      } catch (error) {
        console.error('Error calculating borrow fee:', error);
      } finally {
        // setIsCalculating(false);
      }
    };
    
    // Add debounce to prevent calculation on every keystroke
    const debounceTimer = setTimeout(() => {
      calculateBorrowFee();
    }, 300); // 300ms delay - faster for more responsive feel

    return () => clearTimeout(debounceTimer);
  }, [usdcAmount, days]);

  // Calculate CHICKS amount needed for collateral when USDC amount changes
  useEffect(() => {
    const calculateCollateral = () => {
      if (!usdcAmount || parseFloat(usdcAmount) <= 0) {
        setChicksAmount('0');
        return;
      }

      // Calculate required CHICKS collateral based on collateral ratio
      // Required CHICKS = (USDC amount * collateral ratio) / CHICKS price
      const requiredChicks = (
        (parseFloat(usdcAmount) * (collateralRatio / 100)) / 
        parseFloat(chicksPrice)
      ).toFixed(6);
      
      setChicksAmount(requiredChicks);
    };
    
    // Add debounce to prevent calculation on every keystroke
    const debounceTimer = setTimeout(() => {
      calculateCollateral();
    }, 300); // 300ms delay - faster for more responsive feel

    return () => clearTimeout(debounceTimer);
  }, [usdcAmount, chicksPrice, collateralRatio]);

  const handleUsdcChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setUsdcAmount(value);
      if (value === '') {
        setBorrowFee('0');
        setChicksAmount('0');
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
    if (parseFloat(maxBorrowAmount) > 0) {
      // Set to 90% of max to be safe
      const safeMax = (parseFloat(maxBorrowAmount) * 0.9).toFixed(6);
      setUsdcAmount(safeMax);
    }
  };

  const handleBorrow = async () => {
    if (!isConnected) {
      return;
    }

    if (!usdcAmount || parseFloat(usdcAmount) <= 0) {
      setError('Please enter a valid USDC amount');
      return;
    }

    if (!isBorrowMore && (days <= 0 || days > 365)) {
      setError('Loan duration must be between 1 and 365 days');
      return;
    }

    if (parseFloat(usdcAmount) > parseFloat(maxBorrowAmount)) {
      setError('Borrow amount exceeds maximum allowed based on your collateral');
      return;
    }

    if (!isBorrowMore && parseFloat(chicksAmount) > parseFloat(chicksBalance)) {
      setError('Insufficient CHICKS balance for required collateral');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      // If attempting to create a new loan, check if user already has one
      if (!isBorrowMore) {
        // Check for active loan first
        const hasActiveLoan = await chicksService.hasActiveLoan();
        
        if (hasActiveLoan) {
          // Switch to borrowMore mode
          setIsBorrowMore(true);
          setError("You already have an active loan. Switched to 'Borrow More' mode. Please try again.");
          setIsSubmitting(false);
          return;
        }
      }

      // Execute borrow transaction
      let tx;
      if (isBorrowMore) {
        tx = await chicksService.borrowMore(usdcAmount);
      } else {
        tx = await chicksService.borrow(usdcAmount, days);
      }
      
      await tx.wait();

      // Reset form
      setUsdcAmount('');
      setChicksAmount('0');
      setBorrowFee('0');
      setDays(30);
      setIsBorrowMore(false);

      // Refresh data
      onSuccess();
    } catch (error: unknown) {
      console.error('Error borrowing USDC:', error);
      
      // Still try to catch the error for better UX
      if (error instanceof Error && error.message && error.message.includes('Use borrowMore')) {
        setIsBorrowMore(true);
        setError("You already have an active loan. Switched to 'Borrow More' mode. Please try again.");
      } else {
        setError(error instanceof Error ? error.message : 'Failed to borrow USDC. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">Borrow USDC</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Borrow USDC using your CHICKS tokens as collateral.
        </p>
      </div>

      {hasLoan && (
        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800 mb-4">
          <p className="text-sm text-blue-800 dark:text-blue-300">
            <strong>You have an active loan.</strong> You can borrow more USDC against your existing collateral or create a new loan.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {hasLoan && (
          <div className="flex justify-between">
            <Button
              type="button"
              variant={!isBorrowMore ? "default" : "outline"}
              onClick={() => setIsBorrowMore(false)}
              disabled={isSubmitting}
              className="flex-1 mr-2"
            >
              New Loan
            </Button>
            <Button
              type="button"
              variant={isBorrowMore ? "default" : "outline"}
              onClick={() => setIsBorrowMore(true)}
              disabled={isSubmitting}
              className="flex-1 ml-2"
            >
              Borrow More
            </Button>
          </div>
        )}

        <div>
          <div className="flex justify-between mb-2">
            <label htmlFor="usdcAmount" className="text-sm font-medium">
              USDC Amount to Borrow
            </label>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Max: {parseFloat(maxBorrowAmount).toFixed(2)} USDC
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
              disabled={!isConnected || isSubmitting || parseFloat(maxBorrowAmount) <= 0}
              className="w-16"
            >
              Max
            </Button>
          </div>
        </div>

        {!isBorrowMore && (
          <>
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
            </div>

            <div>
              <label htmlFor="collateralRatio" className="block text-sm font-medium mb-2">
                Collateral Ratio: {collateralRatio}%
              </label>
              <input
                type="range"
                min="120"
                max="300"
                step="10"
                value={collateralRatio}
                onChange={(e) => setCollateralRatio(parseInt(e.target.value))}
                disabled={isSubmitting}
                className="w-full"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Higher collateral ratio reduces liquidation risk but requires more CHICKS.
              </p>
            </div>
          </>
        )}

        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg space-y-2">
          {!isBorrowMore && (
            <>
              <div className="flex justify-between">
                <span className="text-sm">Required CHICKS Collateral:</span>
                <span className="text-sm font-medium">
                  {chicksAmount !== '0' ? parseFloat(chicksAmount).toFixed(6) : '0.00'} CHICKS
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Your CHICKS Balance:</span>
                <span className="text-sm font-medium">
                  {parseFloat(chicksBalance).toFixed(6)} CHICKS
                </span>
              </div>
            </>
          )}
          
          {isBorrowMore && hasLoan && (
            <>
              <div className="flex justify-between">
                <span className="text-sm">Current Collateral:</span>
                <span className="text-sm font-medium">
                  {loanData ? parseFloat(loanData.collateral).toFixed(6) : '0.00'} CHICKS
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Current Borrowed:</span>
                <span className="text-sm font-medium">
                  {loanData ? parseFloat(loanData.borrowed).toFixed(6) : '0.00'} USDC
                </span>
              </div>
            </>
          )}
          
          <div className="flex justify-between">
            <span className="text-sm">Borrow Fee:</span>
            <span className="text-sm font-medium">
              {borrowFee ? parseFloat(borrowFee).toFixed(6) : '0.00'} USDC
            </span>
          </div>
          <div className="flex justify-between font-medium">
            <span>Net USDC Received:</span>
            <span>
              {usdcAmount && borrowFee
                ? (parseFloat(usdcAmount) - parseFloat(borrowFee)).toFixed(6)
                : '0.00'} USDC
            </span>
          </div>
        </div>

        {error && (
          <div className="text-red-500 text-sm p-2 bg-red-50 dark:bg-red-900/20 rounded">
            {error}
          </div>
        )}

        <Button
          onClick={handleBorrow}
          disabled={
            isSubmitting || 
            isCalculating || 
            !usdcAmount || 
            parseFloat(usdcAmount) <= 0 ||
            parseFloat(usdcAmount) > parseFloat(maxBorrowAmount) ||
            (!isBorrowMore && parseFloat(chicksAmount) > parseFloat(chicksBalance))
          }
          className="w-full bg-btb-primary hover:bg-btb-primary/90"
        >
          {!isConnected
            ? 'Connect Wallet'
            : isSubmitting
            ? 'Processing...'
            : isBorrowMore
            ? 'Borrow More USDC'
            : 'Borrow USDC'}
        </Button>
      </div>
    </div>
  );
}
