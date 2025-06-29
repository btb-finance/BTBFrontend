'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWallet } from '../../../context/WalletContext';
import btbFinanceService from '../../services/btbFinanceService';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Card, CardContent } from '../../../components/ui/card';

interface LoopFormProps {
  ethBalance: string;
  btbBalance: string;
  onSuccess: () => void;
}

export default function LoopForm({ ethBalance, btbBalance, onSuccess }: LoopFormProps) {
  const { isConnected } = useWallet();
  const [ethAmount, setEthAmount] = useState<string>('');
  const [days, setDays] = useState<string>('30');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [estimate, setEstimate] = useState<{tokens: string, totalRequired: string}>({ tokens: '0', totalRequired: '0' });
  const [maxLoop, setMaxLoop] = useState<{maxETH: string, userBorrow: string, totalRequired: string}>({ maxETH: '0', userBorrow: '0', totalRequired: '0' });

  // Get loop estimation when amount or days change
  useEffect(() => {
    const getEstimate = async () => {
      if (ethAmount && parseFloat(ethAmount) > 0 && days) {
        try {
          const est = await btbFinanceService.getLoopOutput(ethAmount, parseInt(days));
          setEstimate(est);
        } catch (error) {
          console.error('Error getting loop estimate:', error);
        }
      }
    };

    getEstimate();
  }, [ethAmount, days]);

  // Get max loop amount when days change
  useEffect(() => {
    const getMaxLoop = async () => {
      if (days && isConnected) {
        try {
          const max = await btbFinanceService.getMaxLoop(parseInt(days));
          setMaxLoop(max);
        } catch (error) {
          console.error('Error getting max loop:', error);
        }
      }
    };

    getMaxLoop();
  }, [days, isConnected]);

  const handleMaxClick = () => {
    // Use max loop amount based on user's total balance (ETH + BTB value)
    setEthAmount(maxLoop.maxETH);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected || !ethAmount || parseFloat(ethAmount) <= 0) return;

    try {
      setIsLoading(true);
      await btbFinanceService.connect();
      
      const tx = await btbFinanceService.createLoopPosition(ethAmount, parseInt(days));
      await tx.wait();
      
      onSuccess();
      setEthAmount('');
      alert('Loop position created successfully!');
    } catch (error: any) {
      console.error('Error creating loop position:', error);
      alert(`Error: ${error.message || 'Failed to create loop position'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const canAffordLoop = parseFloat(ethBalance) >= parseFloat(estimate.totalRequired);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="ethAmount">ETH Amount to Loop</Label>
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
          Available: {parseFloat(ethBalance).toFixed(4)} ETH | Max Loop: {parseFloat(maxLoop.maxETH).toFixed(4)} ETH
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
              <span>BTB Tokens You'll Get:</span>
              <span className="font-medium">{parseFloat(estimate.tokens).toFixed(4)} BTB</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Total ETH Required:</span>
              <span className="font-medium">{parseFloat(estimate.totalRequired).toFixed(6)} ETH</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>You'll Borrow:</span>
              <span className="font-medium">{parseFloat(maxLoop.userBorrow).toFixed(6)} ETH</span>
            </div>
            {!canAffordLoop && parseFloat(estimate.totalRequired) > 0 && (
              <p className="text-sm text-red-500">
                Insufficient ETH balance for this loop size
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Button 
        type="submit" 
        className="w-full" 
        disabled={!isConnected || !ethAmount || parseFloat(ethAmount) <= 0 || isLoading || !canAffordLoop}
      >
        {isLoading ? 'Creating Loop Position...' : 'Create Loop Position'}
      </Button>

      {!isConnected && (
        <p className="text-sm text-center text-gray-500">
          Connect your wallet to create loop positions
        </p>
      )}
    </form>
  );
}