'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { useWallet } from '@/app/context/WalletContext';
import gameService from '../services/gameService';
import { ArrowsRightLeftIcon, ExclamationTriangleIcon, FireIcon } from '@heroicons/react/24/outline';

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
  const [hunters, setHunters] = useState<any[]>([]);
  const [selectedHunterIds, setSelectedHunterIds] = useState<number[]>([]);
  const [loadingHunters, setLoadingHunters] = useState(true);

  const REDEMPTION_COST = 1000000; // 1M MiMo per Bear
  const REDEMPTION_FEE = 0.1; // 10% fee
  
  // Fetch hunters when component mounts
  useEffect(() => {
    if (isConnected) {
      fetchHunters();
    }
  }, [isConnected]);

  const fetchHunters = async () => {
    try {
      setLoadingHunters(true);
      const hunterData = await gameService.getUserHunters();
      setHunters(hunterData);
    } catch (error) {
      console.error('Error fetching hunters:', error);
    } finally {
      setLoadingHunters(false);
    }
  };
  
  const totalCost = parseInt(bearCount || '0') * REDEMPTION_COST;
  const feeAmount = totalCost * REDEMPTION_FEE;
  const totalWithFee = totalCost + feeAmount;
  const hasEnoughBalance = parseFloat(mimoBalance) >= totalWithFee;
  const maxAffordable = Math.floor(parseFloat(mimoBalance) / (REDEMPTION_COST * (1 + REDEMPTION_FEE)));
  const requiredHunters = parseInt(bearCount || '0');
  const hasEnoughHunters = selectedHunterIds.length >= requiredHunters;
  const canRedeem = hasEnoughBalance && hasEnoughHunters && parseInt(bearCount || '0') > 0;

  const handleRedeem = async () => {
    if (!canRedeem) return;

    try {
      setIsLoading(true);
      setTxHash('');
      
      const count = parseInt(bearCount);
      const huntersToUse = selectedHunterIds.slice(0, count);
      const tx = await gameService.redeemBears(count, huntersToUse);
      const receipt = await tx.wait();
      setTxHash(receipt?.hash || '');
      
      setBearCount('1');
      setSelectedHunterIds([]);
      await fetchHunters(); // Refresh hunters list
      onSuccess();
    } catch (error) {
      console.error('Error redeeming bears:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleHunterSelection = (hunterId: number, checked: boolean) => {
    if (checked) {
      setSelectedHunterIds(prev => [...prev, hunterId]);
    } else {
      setSelectedHunterIds(prev => prev.filter(id => id !== hunterId));
    }
  };

  const handleSelectOptimalHunters = () => {
    const count = parseInt(bearCount || '0');
    if (count > 0 && hunters.length > 0) {
      // Select hunters with lowest power first (optimal to burn)
      const sortedHunters = [...hunters].sort((a, b) => parseFloat(a.power) - parseFloat(b.power));
      const optimalIds = sortedHunters.slice(0, count).map(h => parseInt(h.tokenId));
      setSelectedHunterIds(optimalIds);
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
          ) : hunters.length === 0 && !loadingHunters ? (
            <div className="text-center py-8">
              <FireIcon className="h-12 w-12 mx-auto text-red-400 mb-4" />
              <p className="text-red-600 dark:text-red-400 mb-2">
                No Hunters available
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                You need Hunter NFTs to burn in exchange for Bear redemptions
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

                {/* Hunter Selection */}
                {bearCount && parseInt(bearCount) > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">
                        Select Hunters to Burn ({selectedHunterIds.length} of {requiredHunters} required)
                      </label>
                      {hunters.length > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleSelectOptimalHunters}
                          disabled={loadingHunters}
                        >
                          Select Optimal
                        </Button>
                      )}
                    </div>

                    {loadingHunters ? (
                      <div className="text-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-600 mx-auto"></div>
                        <p className="text-sm text-gray-500 mt-2">Loading hunters...</p>
                      </div>
                    ) : (
                      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-lg">
                        <div className="flex items-center gap-2 mb-3">
                          <FireIcon className="h-4 w-4 text-red-500" />
                          <p className="text-sm text-red-800 dark:text-red-200 font-medium">
                            ⚠️ Warning: Selected hunters will be permanently burned!
                          </p>
                        </div>
                        
                        <div className="max-h-48 overflow-y-auto space-y-2">
                          {hunters.map((hunter) => (
                            <div
                              key={hunter.tokenId}
                              className={`flex items-center gap-3 p-2 rounded border ${
                                selectedHunterIds.includes(parseInt(hunter.tokenId))
                                  ? 'border-red-400 bg-red-100 dark:bg-red-900/30'
                                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={selectedHunterIds.includes(parseInt(hunter.tokenId))}
                                onChange={(e) => 
                                  handleHunterSelection(parseInt(hunter.tokenId), e.target.checked)
                                }
                                className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                              />
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm">Hunter #{hunter.tokenId}</span>
                                  <span className="text-xs text-gray-500">Power: {parseFloat(hunter.power).toFixed(2)}</span>
                                </div>
                                <div className="text-xs text-gray-400">
                                  {hunter.inHibernation && <span className="text-red-500">Hibernating • </span>}
                                  Status: {hunter.isActive ? 'Active' : 'Inactive'}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {!hasEnoughHunters && (
                          <div className="mt-3 p-2 bg-red-100 dark:bg-red-900/30 rounded border border-red-300 dark:border-red-700">
                            <p className="text-sm text-red-800 dark:text-red-200">
                              You need to select {requiredHunters - selectedHunterIds.length} more hunter(s).
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Redeem Button */}
              <div className="pt-4">
                <Button
                  onClick={handleRedeem}
                  disabled={isLoading || !canRedeem || loadingHunters}
                  className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white"
                  size="lg"
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Redeeming...
                    </div>
                  ) : loadingHunters ? (
                    'Loading Hunters...'
                  ) : (
                    `Redeem ${bearCount || 0} Bear NFT${parseInt(bearCount || '0') !== 1 ? 's' : ''} (Burn ${selectedHunterIds.length} Hunter${selectedHunterIds.length !== 1 ? 's' : ''})`
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