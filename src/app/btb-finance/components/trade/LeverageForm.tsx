'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '../../../context/WalletContext';
import btbFinanceService from '../../services/btbFinanceService';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';

interface LeverageFormProps {
  btbPrice: string;
  usdcBalance: string;
  onSuccess: () => void;
}

export default function LeverageForm({ btbPrice, usdcBalance, onSuccess }: LeverageFormProps) {
  const { isConnected } = useWallet();
  const [ethAmount, setEthAmount] = useState<string>('');
  const [numberOfDays, setNumberOfDays] = useState<number>(30);
  const [leverageCost, setLeverageCost] = useState<string>('0');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate leverage cost when amount or days change
  useEffect(() => {
    const calculateCost = async () => {
      if (!ethAmount || parseFloat(ethAmount) === 0) {
        setLeverageCost('0');
        return;
      }

      try {
        const cost = await btbFinanceService.getLeverageCost(ethAmount, numberOfDays);
        setLeverageCost(cost);
      } catch (error) {
        console.error('Error calculating leverage cost:', error);
        setLeverageCost('0');
      }
    };

    const debounceTimer = setTimeout(() => {
      calculateCost();
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [ethAmount, numberOfDays]);

  const handleEthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setEthAmount(value);
    }
  };

  const handleCreateLeverage = async () => {
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
      const tx = await btbFinanceService.createLeveragePosition(ethAmount, numberOfDays);
      
      // Reset form
      setEthAmount('');
      setNumberOfDays(30);
      setLeverageCost('0');
      
      // Call success callback
      onSuccess();
    } catch (error: any) {
      console.error('Error creating leverage position:', error);
      setError(error.message || 'Failed to create leverage position');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-4">Create Leverage Position</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Create a leveraged position with your ETH collateral
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">ETH Amount</label>
          <Input
            type="text"
            value={ethAmount}
            onChange={handleEthChange}
            placeholder="0.00"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Loan Duration</label>
          <Select value={numberOfDays.toString()} onValueChange={(value) => setNumberOfDays(parseInt(value))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 days</SelectItem>
              <SelectItem value="14">14 days</SelectItem>
              <SelectItem value="30">30 days</SelectItem>
              <SelectItem value="60">60 days</SelectItem>
              <SelectItem value="90">90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
          <div className="flex justify-between text-sm">
            <span>Leverage Cost:</span>
            <span className="font-medium">{parseFloat(leverageCost).toFixed(6)} ETH</span>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <Button
          onClick={handleCreateLeverage}
          disabled={!isConnected || isSubmitting || !ethAmount || parseFloat(ethAmount) <= 0}
          className="w-full"
        >
          {isSubmitting ? 'Creating Position...' : 'Create Leverage Position'}
        </Button>
      </div>
    </div>
  );
}
