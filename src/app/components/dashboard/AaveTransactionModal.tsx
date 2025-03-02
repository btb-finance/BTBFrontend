'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Slider } from '@/app/components/ui/slider';
import { ethers } from 'ethers';
import { ERC20_ABI } from '@/app/constants/abis';

interface Asset {
  tokenAddress: string;
  symbol: string;
  name: string;
  decimals?: string;
}

interface UserPosition {
  totalCollateralBase: string;
  totalDebtBase: string;
  availableBorrowsBase: string;
  healthFactor: string;
  reserves: any[];
}

interface AaveTransactionModalProps {
  type: 'supply' | 'withdraw' | 'borrow' | 'repay';
  asset: Asset;
  onClose: () => void;
  onSubmit: (amount: string) => void;
  userPositions: UserPosition | null;
  chainId: string;
}

export function AaveTransactionModal({
  type,
  asset,
  onClose,
  onSubmit,
  userPositions,
  chainId
}: AaveTransactionModalProps) {
  const [amount, setAmount] = useState<string>('');
  const [balance, setBalance] = useState<string>('0');
  const [maxAmount, setMaxAmount] = useState<string>('0');
  const [error, setError] = useState<string>('');
  const [sliderValue, setSliderValue] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Get asset balance
  useEffect(() => {
    const getBalance = async () => {
      setIsLoading(true);
      try {
        if (typeof window !== 'undefined' && (window as any).ethereum) {
          const provider = new ethers.providers.Web3Provider((window as any).ethereum);
          const accounts = await provider.listAccounts();
          
          if (accounts.length > 0) {
            const userAddress = accounts[0];
            
            if (type === 'supply' || type === 'repay') {
              // Get wallet balance for token
              const tokenContract = new ethers.Contract(asset.tokenAddress, ERC20_ABI, provider);
              const rawBalance = await tokenContract.balanceOf(userAddress);
              const formattedBalance = ethers.utils.formatUnits(rawBalance, asset.decimals || 18);
              setBalance(formattedBalance);
              setMaxAmount(formattedBalance);
            } else if (type === 'withdraw') {
              // Get supplied balance from Aave
              if (userPositions) {
                const assetPosition = userPositions.reserves.find(
                  reserve => reserve.tokenAddress.toLowerCase() === asset.tokenAddress.toLowerCase()
                );
                if (assetPosition && assetPosition.currentATokenBalance) {
                  setBalance(assetPosition.currentATokenBalance);
                  setMaxAmount(assetPosition.currentATokenBalance);
                }
              }
            } else if (type === 'borrow') {
              // Get max borrowable amount
              if (userPositions) {
                setBalance(userPositions.availableBorrowsBase);
                setMaxAmount(userPositions.availableBorrowsBase);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error getting balance:', error);
        setError('Failed to get balance. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
    
    getBalance();
  }, [asset, type, userPositions]);

  // Handle amount input change
  const handleAmountChange = (value: string) => {
    // Remove non-numeric characters except decimal point
    const sanitizedValue = value.replace(/[^0-9.]/g, '');
    
    // Ensure only one decimal point
    const parts = sanitizedValue.split('.');
    const sanitizedFinal = parts.length > 1 
      ? `${parts[0]}.${parts.slice(1).join('')}` 
      : sanitizedValue;
    
    setAmount(sanitizedFinal);
    
    // Update slider
    if (parseFloat(maxAmount) > 0) {
      const percentage = (parseFloat(sanitizedFinal) / parseFloat(maxAmount)) * 100;
      setSliderValue(Math.min(percentage, 100));
    }
    
    // Validate amount
    validateAmount(sanitizedFinal);
  };

  // Handle slider change
  const handleSliderChange = (value: number[]) => {
    setSliderValue(value[0]);
    
    if (parseFloat(maxAmount) > 0) {
      const calculatedAmount = (parseFloat(maxAmount) * (value[0] / 100)).toFixed(6);
      setAmount(calculatedAmount);
      
      // Validate amount
      validateAmount(calculatedAmount);
    }
  };

  // Set max amount
  const handleSetMax = () => {
    setAmount(maxAmount);
    setSliderValue(100);
    
    // Validate amount
    validateAmount(maxAmount);
  };

  // Validate amount
  const validateAmount = (value: string) => {
    if (!value || parseFloat(value) <= 0) {
      setError('Amount must be greater than 0');
      return false;
    }
    
    if (parseFloat(value) > parseFloat(maxAmount)) {
      setError(`Amount exceeds maximum available (${parseFloat(maxAmount).toFixed(6)})`);
      return false;
    }
    
    setError('');
    return true;
  };

  // Handle submit
  const handleSubmit = () => {
    if (validateAmount(amount)) {
      onSubmit(amount);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {type === 'supply' && `Supply ${asset.symbol}`}
            {type === 'withdraw' && `Withdraw ${asset.symbol}`}
            {type === 'borrow' && `Borrow ${asset.symbol}`}
            {type === 'repay' && `Repay ${asset.symbol}`}
          </DialogTitle>
        </DialogHeader>
        
        {isLoading ? (
          <div className="py-6 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : (
          <>
            <div className="grid gap-4 py-4">
              <div className="flex justify-between items-center">
                <Label htmlFor="amount">Amount</Label>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Available: {parseFloat(balance).toFixed(6)} {asset.symbol}
                </div>
              </div>
              
              <div className="flex space-x-2">
                <Input
                  id="amount"
                  value={amount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  placeholder="0.00"
                  className="flex-1"
                />
                <Button 
                  variant="outline" 
                  onClick={handleSetMax}
                  type="button"
                >
                  Max
                </Button>
              </div>
              
              <Slider
                defaultValue={[0]}
                max={100}
                step={1}
                value={[sliderValue]}
                onValueChange={handleSliderChange}
                className="my-4"
              />
              
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 px-1">
                <div>0%</div>
                <div>25%</div>
                <div>50%</div>
                <div>75%</div>
                <div>100%</div>
              </div>
              
              {error && (
                <div className="text-sm text-red-500 dark:text-red-400 mt-1">
                  {error}
                </div>
              )}
              
              {type === 'supply' && (
                <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-md text-sm">
                  <div className="font-medium mb-1">Supply Information</div>
                  <div className="text-gray-500 dark:text-gray-400 space-y-1">
                    <div>• Your supplied assets will be used as collateral</div>
                    <div>• You'll earn interest on your supply</div>
                    <div>• You can withdraw your assets at any time</div>
                    <div>• If used as collateral, withdrawals may be limited by your loan position</div>
                  </div>
                </div>
              )}
              
              {type === 'borrow' && (
                <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-md text-sm">
                  <div className="font-medium mb-1">Borrow Information</div>
                  <div className="text-gray-500 dark:text-gray-400 space-y-1">
                    <div>• You'll pay interest on borrowed assets</div>
                    <div>• Maintain a healthy safety buffer to avoid liquidation</div>
                    <div>• Your health factor should stay above 1.0</div>
                    <div>• Interest rates are variable and may change over time</div>
                  </div>
                </div>
              )}
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button 
                onClick={handleSubmit}
                disabled={!!error || !amount || parseFloat(amount) <= 0}
              >
                {type === 'supply' && 'Supply'}
                {type === 'withdraw' && 'Withdraw'}
                {type === 'borrow' && 'Borrow'}
                {type === 'repay' && 'Repay'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
