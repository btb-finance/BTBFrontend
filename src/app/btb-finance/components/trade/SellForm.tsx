'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '../../../context/WalletContext';
import btbFinanceService from '../../services/btbFinanceService';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { ArrowsRightLeftIcon } from '@heroicons/react/24/outline';

interface SellFormProps {
  btbPrice: string;
  btbBalance: string;
  onSuccess: () => void;
}

export default function SellForm({ btbPrice, btbBalance, onSuccess }: SellFormProps) {
  const { isConnected } = useWallet();
  const [btbAmount, setBtbAmount] = useState<string>('');
  const [ethAmount, setEthAmount] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate ETH amount when BTB amount changes
  useEffect(() => {
    const calculateEthAmount = async () => {
      if (!btbAmount || parseFloat(btbAmount) === 0) {
        setEthAmount('');
        return;
      }

      try {
        const estimate = await btbFinanceService.getSellEstimate(btbAmount);
        setEthAmount(estimate);
      } catch (error) {
        console.error('Error calculating ETH amount:', error);
        setEthAmount('0');
      }
    };

    const debounceTimer = setTimeout(() => {
      calculateEthAmount();
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [btbAmount]);

  const handleBtbChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setBtbAmount(value);
    }
  };

  const handleMaxClick = () => {
    if (parseFloat(btbBalance) > 0) {
      setBtbAmount(btbBalance);
    }
  };

  const handleSell = async () => {
    if (!isConnected) {
      setError('Please connect your wallet first');
      return;
    }

    if (!btbAmount || parseFloat(btbAmount) <= 0) {
      setError('Please enter a valid BTB amount');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const tx = await btbFinanceService.sellBTB(btbAmount);
      
      // Reset form
      setBtbAmount('');
      setEthAmount('');
      
      // Call success callback
      onSuccess();
    } catch (error: any) {
      console.error('Error selling BTB:', error);
      setError(error.message || 'Failed to sell BTB tokens');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-4">Sell BTB Tokens</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Sell your BTB tokens for ETH
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">BTB Amount</label>
          <div className="relative">
            <Input
              type="text"
              value={btbAmount}
              onChange={handleBtbChange}
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
          {btbBalance && (
            <p className="text-xs text-gray-500 mt-1">
              Balance: {parseFloat(btbBalance).toFixed(4)} BTB
            </p>
          )}
        </div>

        <div className="flex justify-center">
          <ArrowsRightLeftIcon className="w-5 h-5 text-gray-400" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">ETH Amount (Estimate)</label>
          <Input
            type="text"
            value={ethAmount}
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
          onClick={handleSell}
          disabled={!isConnected || isSubmitting || !btbAmount || parseFloat(btbAmount) <= 0}
          className="w-full"
        >
          {isSubmitting ? 'Selling...' : 'Sell BTB Tokens'}
        </Button>
      </div>
    </div>
  );
}
