'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '../../../context/WalletContext';
import btbFinanceService from '../../services/btbFinanceService';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { ArrowsRightLeftIcon } from '@heroicons/react/24/outline';

interface BuyFormProps {
  btbPrice: string;
  ethBalance: string;
  onSuccess: () => void;
}

export default function BuyForm({ btbPrice, ethBalance, onSuccess }: BuyFormProps) {
  const { isConnected } = useWallet();
  const [ethAmount, setEthAmount] = useState<string>('');
  const [btbAmount, setBtbAmount] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate BTB amount when ETH amount changes
  useEffect(() => {
    const calculateBtbAmount = async () => {
      if (!ethAmount || parseFloat(ethAmount) === 0) {
        setBtbAmount('');
        return;
      }

      try {
        const estimate = await btbFinanceService.getPurchaseEstimate(ethAmount);
        setBtbAmount(estimate);
      } catch (error) {
        console.error('Error calculating BTB amount:', error);
        setBtbAmount('0');
      }
    };

    const debounceTimer = setTimeout(() => {
      calculateBtbAmount();
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [ethAmount]);

  const handleEthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setEthAmount(value);
    }
  };

  const handleMaxClick = () => {
    if (parseFloat(ethBalance) > 0) {
      // Leave some ETH for gas fees
      const maxAmount = Math.max(0, parseFloat(ethBalance) - 0.01);
      setEthAmount(maxAmount.toString());
    }
  };

  const handleBuy = async () => {
    if (!isConnected) {
      setError('Please connect your wallet first');
      return;
    }

    if (!ethAmount || parseFloat(ethAmount) <= 0) {
      setError('Please enter a valid ETH amount');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const tx = await btbFinanceService.buyBTB(ethAmount);
      await tx.wait();
      
      // Reset form
      setEthAmount('');
      setBtbAmount('');
      
      // Call success callback
      onSuccess();
    } catch (error: any) {
      console.error('Error buying BTB:', error);
      setError(error.message || 'Failed to buy BTB tokens');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-4">Buy BTB Tokens</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Purchase BTB tokens with ETH
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">ETH Amount</label>
          <div className="relative">
            <Input
              type="text"
              value={ethAmount}
              onChange={handleEthChange}
              placeholder="0.00"
              className="pr-16"
            />
            <button
              type="button"
              onClick={handleMaxClick}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs bg-btb-primary text-white px-2 py-1 rounded hover:bg-btb-primary-dark"
            >
              MAX
            </button>
          </div>
          {ethBalance && (
            <p className="text-xs text-gray-500 mt-1">
              Balance: {parseFloat(ethBalance).toFixed(4)} ETH
            </p>
          )}
        </div>

        <div className="flex justify-center">
          <ArrowsRightLeftIcon className="w-5 h-5 text-gray-400" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">BTB Amount (Estimate)</label>
          <Input
            type="text"
            value={btbAmount}
            readOnly
            placeholder="0.00"
            className="bg-gray-50 dark:bg-gray-800"
          />
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <Button
          onClick={handleBuy}
          disabled={!isConnected || isSubmitting || !ethAmount || parseFloat(ethAmount) <= 0}
          className="w-full"
        >
          {isSubmitting ? 'Buying...' : 'Buy BTB Tokens'}
        </Button>
      </div>
    </div>
  );
}
