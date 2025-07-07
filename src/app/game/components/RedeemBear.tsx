'use client';

import { useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { useWallet } from '@/app/context/WalletContext';
import gameService from '../services/gameService';
import { ArrowsRightLeftIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

interface RedeemBearProps {
  mimoBalance: string;
  swapRate: string;
  onSuccess: () => void;
}

export default function RedeemBear({ mimoBalance, swapRate, onSuccess }: RedeemBearProps) {
  const { isConnected } = useWallet();
  const [bearCount, setBearCount] = useState<string>('1');
  const [isLoading, setIsLoading] = useState(false);
  const [txHash, setTxHash] = useState<string>('');

  const REDEMPTION_COST = 1000000; // 1M MiMo per Bear
  const REDEMPTION_FEE = 0.1; // 10% fee
  
  const totalCost = parseInt(bearCount || '0') * REDEMPTION_COST;
  const feeAmount = totalCost * REDEMPTION_FEE;
  const totalWithFee = totalCost + feeAmount;
  const hasEnoughBalance = parseFloat(mimoBalance) >= totalWithFee;
  const maxAffordable = Math.floor(parseFloat(mimoBalance) / (REDEMPTION_COST * (1 + REDEMPTION_FEE)));

  const handleRedeem = async () => {
    if (!isConnected || !bearCount || parseInt(bearCount) <= 0) return;

    try {
      setIsLoading(true);
      setTxHash('');
      
      const count = parseInt(bearCount);
      const tx = await gameService.redeemBears(count);
      
      setTxHash(tx.hash);
      await tx.wait();
      
      setBearCount('1');
      onSuccess();
    } catch (error) {
      console.error('Error redeeming bears:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMaxClick = () => {
    setBearCount(maxAffordable.toString());
  };

  if (!isConnected) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <ArrowsRightLeftIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Connect Wallet</h3>
          <p className="text-gray-600 dark:text-gray-400">
            Connect your wallet to redeem Bear NFTs
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Redemption Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowsRightLeftIcon className="h-5 w-5" />
            Redeem Bear NFTs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-4 rounded-lg mb-6">
            <h4 className="font-semibold text-green-800 dark:text-green-200 mb-2">Redemption Details:</h4>
            <ul className="space-y-2 text-sm text-green-700 dark:text-green-300">
              <li className="flex items-center gap-2">
                <ArrowsRightLeftIcon className="h-4 w-4" />
                Cost: 1,000,000 MiMo tokens per Bear NFT
              </li>
              <li className="flex items-center gap-2">
                <ArrowsRightLeftIcon className="h-4 w-4" />
                Fee: 10% (100,000 MiMo tokens per redemption)
              </li>
              <li className="flex items-center gap-2">
                <ArrowsRightLeftIcon className="h-4 w-4" />
                Total cost: 1,100,000 MiMo tokens per Bear NFT
              </li>
            </ul>
          </div>

          {/* Balance Display */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">Your MiMo Balance</p>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {parseFloat(mimoBalance).toLocaleString()}
              </p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">Max Bears You Can Redeem</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {maxAffordable}
              </p>
            </div>
          </div>

          {parseFloat(mimoBalance) === 0 ? (
            <div className="text-center py-8">
              <ExclamationTriangleIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500 dark:text-gray-400 mb-2">
                You don't have any MiMo tokens
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500">
                Deposit Bear NFTs or hunt to earn MiMo tokens first
              </p>
            </div>
          ) : maxAffordable === 0 ? (
            <div className="text-center py-8">
              <ExclamationTriangleIcon className="h-12 w-12 mx-auto text-yellow-400 mb-4" />
              <p className="text-yellow-600 dark:text-yellow-400 mb-2">
                Insufficient MiMo tokens
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                You need at least 1,100,000 MiMo tokens to redeem a Bear NFT
              </p>
            </div>
          ) : (
            <>
              {/* Bear Count Input */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Number of Bears to Redeem
                  </label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min="1"
                      max={maxAffordable}
                      value={bearCount}
                      onChange={(e) => setBearCount(e.target.value)}
                      placeholder="Enter amount"
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      onClick={handleMaxClick}
                      disabled={maxAffordable === 0}
                    >
                      Max
                    </Button>
                  </div>
                </div>

                {/* Cost Breakdown */}
                {bearCount && parseInt(bearCount) > 0 && (
                  <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg">
                    <h4 className="font-semibold mb-3">Cost Breakdown:</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Base Cost ({bearCount} × 1M):</span>
                        <span className="font-medium">{totalCost.toLocaleString()} MiMo</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Fee (10%):</span>
                        <span className="font-medium">{feeAmount.toLocaleString()} MiMo</span>
                      </div>
                      <hr className="border-gray-200 dark:border-gray-700" />
                      <div className="flex justify-between font-bold">
                        <span>Total Cost:</span>
                        <span className={hasEnoughBalance ? 'text-green-600' : 'text-red-600'}>
                          {totalWithFee.toLocaleString()} MiMo
                        </span>
                      </div>
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>Remaining Balance:</span>
                        <span>
                          {Math.max(0, parseFloat(mimoBalance) - totalWithFee).toLocaleString()} MiMo
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Warning for insufficient balance */}
                {bearCount && parseInt(bearCount) > 0 && !hasEnoughBalance && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 rounded-lg">
                    <div className="flex items-center gap-2">
                      <ExclamationTriangleIcon className="h-4 w-4 text-red-500" />
                      <p className="text-sm text-red-800 dark:text-red-200">
                        Insufficient MiMo balance. You need {totalWithFee.toLocaleString()} MiMo but only have {parseFloat(mimoBalance).toLocaleString()}.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Redeem Button */}
              <div className="pt-4">
                <Button
                  onClick={handleRedeem}
                  disabled={isLoading || !bearCount || parseInt(bearCount) <= 0 || !hasEnoughBalance}
                  className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white"
                  size="lg"
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Redeeming...
                    </div>
                  ) : (
                    `Redeem ${bearCount || 0} Bear NFT${parseInt(bearCount || '0') !== 1 ? 's' : ''}`
                  )}
                </Button>
              </div>
            </>
          )}

          {/* Transaction Hash */}
          {txHash && (
            <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="text-sm text-green-800 dark:text-green-200">
                Transaction submitted! Hash: 
                <a 
                  href={`https://basescan.org/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-1 underline"
                >
                  {txHash.slice(0, 10)}...{txHash.slice(-8)}
                </a>
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}