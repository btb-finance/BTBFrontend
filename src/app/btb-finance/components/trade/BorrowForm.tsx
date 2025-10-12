'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWallet } from '../../../context/WalletContext';
import btbFinanceService from '../../services/btbFinanceService';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Card, CardContent } from '../../../components/ui/card';

interface BorrowFormProps {
  btbBalance: string;
  onSuccess: () => void;
}

export default function BorrowForm({ btbBalance, onSuccess }: BorrowFormProps) {
  const { isConnected } = useWallet();
  const [ethAmount, setEthAmount] = useState<string>('');
  const [days, setDays] = useState<string>('30');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [maxBorrow, setMaxBorrow] = useState<{userETH: string, userBorrow: string, interestFee: string}>({ userETH: '0', userBorrow: '0', interestFee: '0' });
  const [interestCost, setInterestCost] = useState<string>('0');

  // Get max borrow amount when days change
  useEffect(() => {
    const getMaxBorrow = async () => {
      if (days && isConnected) {
        try {
          const max = await btbFinanceService.getMaxBorrow(parseInt(days));
          setMaxBorrow(max);
        } catch (error) {
          console.error('Error getting max borrow:', error);
        }
      }
    };

    getMaxBorrow();
  }, [days, isConnected]);

  // Calculate interest cost when amount or days change
  useEffect(() => {
    const getInterestCost = async () => {
      if (ethAmount && parseFloat(ethAmount) > 0 && days) {
        try {
          const cost = await btbFinanceService.getInterestCost(ethAmount, parseInt(days));
          setInterestCost(cost);
        } catch (error) {
          console.error('Error getting interest cost:', error);
        }
      }
    };

    getInterestCost();
  }, [ethAmount, days]);

  const handleMaxClick = () => {
    // Use max borrow amount based on user's BTB collateral
    setEthAmount(maxBorrow.userBorrow);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected || !ethAmount || parseFloat(ethAmount) <= 0) return;

    try {
      setIsLoading(true);
      await btbFinanceService.connect();
      
      await btbFinanceService.borrowAgainstCollateral(ethAmount, parseInt(days));
      
      onSuccess();
      setEthAmount('');
      alert('Borrow position created successfully!');
    } catch (error: any) {
      console.error('Error creating borrow position:', error);
      alert(`Error: ${error.message || 'Failed to create borrow position'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const requiredBTBCollateral = parseFloat(ethAmount) > 0 ? (parseFloat(ethAmount) * 1.01).toString() : '0'; // Rough estimate: 101% collateral
  const hasEnoughCollateral = parseFloat(btbBalance) >= parseFloat(requiredBTBCollateral);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="ethAmount">ETH Amount to Borrow</Label>
        <div className="flex gap-2">
          <Input
            id="ethAmount"
            type="number"
            step="0.001"
            placeholder="0.0"
            value={ethAmount}
            onChange={(e) => setEthAmount(e.target.value)}
            className="flex-1"
          />
          <Button 
            type="button" 
            variant="outline" 
            onClick={handleMaxClick}
            disabled={!isConnected}
          >
            MAX
          </Button>
        </div>
        <p className="text-xs text-gray-500">
          Your BTB Balance: {parseFloat(btbBalance).toFixed(4)} BTB | Max Borrow: {parseFloat(maxBorrow.userBorrow).toFixed(4)} ETH
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="days">Loan Duration (Days)</Label>
        <Input
          id="days"
          type="number"
          min="1"
          max="365"
          value={days}
          onChange={(e) => setDays(e.target.value)}
        />
      </div>

      {ethAmount && parseFloat(ethAmount) > 0 && (
        <Card className="bg-gray-50 dark:bg-gray-800/50">
          <CardContent className="p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span>You'll Receive:</span>
              <span className="font-medium">{(parseFloat(ethAmount) - parseFloat(interestCost)).toFixed(6)} ETH</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Interest Cost:</span>
              <span className="font-medium">{parseFloat(interestCost).toFixed(6)} ETH</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>BTB Collateral Required:</span>
              <span className="font-medium">~{parseFloat(requiredBTBCollateral).toFixed(4)} BTB</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Total Debt:</span>
              <span className="font-medium">{parseFloat(ethAmount).toFixed(6)} ETH</span>
            </div>
            {!hasEnoughCollateral && parseFloat(ethAmount) > 0 && (
              <p className="text-sm text-red-500">
                Insufficient BTB balance for collateral
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Button 
        type="submit" 
        className="w-full" 
        disabled={!isConnected || !ethAmount || parseFloat(ethAmount) <= 0 || isLoading || !hasEnoughCollateral}
      >
        {isLoading ? 'Creating Borrow Position...' : 'Borrow ETH'}
      </Button>

      {!isConnected && (
        <p className="text-sm text-center text-gray-500">
          Connect your wallet to borrow against your BTB tokens
        </p>
      )}
    </form>
  );
}