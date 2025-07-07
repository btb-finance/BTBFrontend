'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { useWallet } from '@/app/context/WalletContext';
import gameService from '../services/gameService';
import { ArrowsRightLeftIcon, BanknotesIcon } from '@heroicons/react/24/outline';

interface GameDashboardProps {
  gameStats: {
    btbBalance: string;
    swapRate: string;
  };
  onSuccess: () => void;
}

export default function GameDashboard({ gameStats, onSuccess }: GameDashboardProps) {
  const { isConnected } = useWallet();
  const [swapMode, setSwapMode] = useState<'btb-to-nft' | 'nft-to-btb'>('btb-to-nft');
  const [nftCount, setNftCount] = useState<string>('1');
  const [isLoading, setIsLoading] = useState(false);
  const [txHash, setTxHash] = useState<string>('');
  const [costBreakdown, setCostBreakdown] = useState<any>(null);
  const [returnBreakdown, setReturnBreakdown] = useState<any>(null);
  const [liquidityInfo, setLiquidityInfo] = useState<any>(null);

  const handleSwapBTBForNFT = async () => {
    if (!isConnected || !nftCount) return;

    try {
      setIsLoading(true);
      setTxHash('');
      
      const amount = parseInt(nftCount);
      const tx = await gameService.swapBTBForNFT(amount);
      
      setTxHash(tx.hash);
      await tx.wait();
      
      setNftCount('1');
      onSuccess();
    } catch (error) {
      console.error('Error swapping BTB for NFT:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwapNFTForBTB = async () => {
    if (!isConnected || !nftCount) return;

    try {
      setIsLoading(true);
      setTxHash('');
      
      // This would need NFT token IDs - simplified for demo
      const count = parseInt(nftCount);
      // In real implementation, you'd need to get user's NFT IDs
      const tokenIds = Array.from({ length: count }, (_, i) => i + 1);
      const tx = await gameService.swapNFTForBTB(tokenIds);
      
      setTxHash(tx.hash);
      await tx.wait();
      
      setNftCount('1');
      onSuccess();
    } catch (error) {
      console.error('Error swapping NFT for BTB:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate costs and returns when nftCount changes
  useEffect(() => {
    if (nftCount && parseInt(nftCount) > 0) {
      const count = parseInt(nftCount);
      
      // Calculate cost for buying NFTs
      gameService.calculateBTBCostForNFTs(count).then(setCostBreakdown);
      
      // Calculate return for selling NFTs
      gameService.calculateBTBReturnForNFTs(count).then(setReturnBreakdown);
    } else {
      setCostBreakdown(null);
      setReturnBreakdown(null);
    }
  }, [nftCount]);

  // Get liquidity info on component mount
  useEffect(() => {
    gameService.getSwapLiquidityInfo().then(setLiquidityInfo);
  }, []);

  if (!isConnected) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <ArrowsRightLeftIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Connect Wallet</h3>
          <p className="text-gray-600 dark:text-gray-400">
            Connect your wallet to access BTB / NFT swapping
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Swap Interface */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowsRightLeftIcon className="h-5 w-5" />
            BTB / NFT Swap
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Swap Mode Toggle */}
          <div className="flex gap-2 mb-6">
            <Button
              variant={swapMode === 'btb-to-nft' ? 'default' : 'outline'}
              onClick={() => setSwapMode('btb-to-nft')}
              className="flex-1"
            >
              <BanknotesIcon className="h-4 w-4 mr-2" />
              BTB to NFT
            </Button>
            <Button
              variant={swapMode === 'nft-to-btb' ? 'default' : 'outline'}
              onClick={() => setSwapMode('nft-to-btb')}
              className="flex-1"
            >
              <ArrowsRightLeftIcon className="h-4 w-4 mr-2" />
              NFT to BTB
            </Button>
          </div>

          {/* Liquidity Status */}
          {liquidityInfo && (
            <div className={`p-4 rounded-lg mb-4 ${
              liquidityInfo.isLiquidityAvailable 
                ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' 
                : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
            }`}>
              <h4 className={`font-semibold mb-2 ${
                liquidityInfo.isLiquidityAvailable 
                  ? 'text-green-800 dark:text-green-200' 
                  : 'text-red-800 dark:text-red-200'
              }`}>
                Liquidity Status
              </h4>
              <div className={`space-y-1 text-sm ${
                liquidityInfo.isLiquidityAvailable 
                  ? 'text-green-700 dark:text-green-300' 
                  : 'text-red-700 dark:text-red-300'
              }`}>
                <p>{liquidityInfo.status}</p>
                <p>BTB in Pool: {parseFloat(liquidityInfo.btbBalance).toLocaleString()}</p>
                <p>NFTs in Pool: {liquidityInfo.nftBalance}</p>
              </div>
            </div>
          )}

          {/* Swap Rate Info */}
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg mb-6">
            <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">Current Pricing:</h4>
            <div className="space-y-1 text-sm text-blue-700 dark:text-blue-300">
              {parseFloat(gameStats.swapRate || '0') > 0 ? (
                <>
                  <p>Base Rate: {parseFloat(gameStats.swapRate || '0').toFixed(6)} BTB per NFT</p>
                  <p className="text-orange-700 dark:text-orange-300">Buy Price: {(parseFloat(gameStats.swapRate || '0') + 5000).toFixed(6)} BTB per NFT (+5K premium)</p>
                  <p className="text-red-700 dark:text-red-300">Sell Price: {Math.max(0, parseFloat(gameStats.swapRate || '0') - 5000) < 0.000001 ? '~0' : Math.max(0, parseFloat(gameStats.swapRate || '0') - 5000).toFixed(6)} BTB per NFT (-5K discount)</p>
                </>
              ) : (
                <p className="text-red-700 dark:text-red-300">No pricing available - insufficient liquidity</p>
              )}
            </div>
          </div>

          {swapMode === 'btb-to-nft' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Number of Bear NFTs to Buy
                </label>
                <Input
                  type="number"
                  value={nftCount}
                  onChange={(e) => setNftCount(e.target.value)}
                  placeholder="Enter NFT count"
                  min="1"
                  step="1"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Your BTB Balance: {parseFloat(gameStats.btbBalance).toFixed(2)}
                </p>
              </div>

              {costBreakdown && (
                <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg">
                  <h4 className="font-semibold mb-2">Cost Breakdown:</h4>
                  {costBreakdown.isValid ? (
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Base Rate ({nftCount} NFT{parseInt(nftCount) !== 1 ? 's' : ''}):</span>
                        <span className="font-medium">{parseFloat(costBreakdown.baseRate).toFixed(6)} BTB</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Buy Premium (+5000 BTB per NFT):</span>
                        <span className="font-medium text-orange-600">+{parseFloat(costBreakdown.premium).toFixed(6)} BTB</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Subtotal:</span>
                        <span className="font-medium">{parseFloat(costBreakdown.subtotal).toFixed(6)} BTB</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Swap Fee (1%):</span>
                        <span className="font-medium">+{parseFloat(costBreakdown.fee).toFixed(6)} BTB</span>
                      </div>
                      <hr className="border-gray-300 dark:border-gray-600" />
                      <div className="flex justify-between font-bold">
                        <span>Total Cost:</span>
                        <span className={`${parseFloat(costBreakdown.total) > parseFloat(gameStats.btbBalance) ? 'text-red-600' : 'text-green-600'}`}>
                          {parseFloat(costBreakdown.total).toFixed(6)} BTB
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-red-600 dark:text-red-400 text-sm">
                        {costBreakdown.error || 'Cannot calculate cost - insufficient liquidity'}
                      </p>
                    </div>
                  )}
                </div>
              )}

              <Button
                onClick={handleSwapBTBForNFT}
                disabled={isLoading || !nftCount || parseInt(nftCount) <= 0 || (costBreakdown && parseFloat(costBreakdown.total) > parseFloat(gameStats.btbBalance))}
                className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white"
                size="lg"
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Buying...
                  </div>
                ) : (
                  <span>Buy {nftCount || '0'} Bear NFT{parseInt(nftCount || '0') !== 1 ? 's' : ''}</span>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Number of Bear NFTs to Swap
                </label>
                <Input
                  type="number"
                  value={nftCount}
                  onChange={(e) => setNftCount(e.target.value)}
                  placeholder="Enter NFT count"
                  min="1"
                  step="1"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Note: You need to own the Bear NFTs to swap them
                </p>
              </div>

              {returnBreakdown && (
                <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg">
                  <h4 className="font-semibold mb-2">Return Breakdown:</h4>
                  {returnBreakdown.isValid ? (
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Base Rate ({nftCount} NFT{parseInt(nftCount) !== 1 ? 's' : ''}):</span>
                        <span className="font-medium">{parseFloat(returnBreakdown.baseRate).toFixed(6)} BTB</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Sell Discount (-5000 BTB per NFT):</span>
                        <span className="font-medium text-red-600">-{parseFloat(returnBreakdown.discount).toFixed(6)} BTB</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Subtotal:</span>
                        <span className="font-medium">{parseFloat(returnBreakdown.subtotal).toFixed(6)} BTB</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Swap Fee (1%):</span>
                        <span className="font-medium">-{parseFloat(returnBreakdown.fee).toFixed(6)} BTB</span>
                      </div>
                      <hr className="border-gray-300 dark:border-gray-600" />
                      <div className="flex justify-between font-bold">
                        <span>You'll Receive:</span>
                        <span className="text-green-600">
                          {parseFloat(returnBreakdown.userReceives).toFixed(6)} BTB
                        </span>
                      </div>
                      {parseFloat(returnBreakdown.userReceives) <= 0 && (
                        <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
                          <p className="text-xs text-red-800 dark:text-red-200">
                            ⚠️ Selling at current rates would result in no BTB return due to the sell discount.
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-red-600 dark:text-red-400 text-sm">
                        {returnBreakdown.error || 'Cannot calculate return - insufficient liquidity'}
                      </p>
                    </div>
                  )}
                </div>
              )}

              <Button
                onClick={handleSwapNFTForBTB}
                disabled={isLoading || !nftCount || parseInt(nftCount) <= 0 || (returnBreakdown && !returnBreakdown.isValid)}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white"
                size="lg"
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Selling...
                  </div>
                ) : (
                  <span>Sell {nftCount || '0'} Bear NFT{parseInt(nftCount || '0') !== 1 ? 's' : ''}</span>
                )}
              </Button>
            </div>
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

      {/* Additional Swap Information */}
      <Card>
        <CardHeader>
          <CardTitle>Swap Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Base Swap Rate:</span>
              <span className="font-medium">{parseFloat(gameStats.swapRate || '0').toFixed(6)} BTB per NFT</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Buy Premium:</span>
              <span className="font-medium text-orange-600">+5,000 BTB per NFT</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Sell Discount:</span>
              <span className="font-medium text-red-600">-5,000 BTB per NFT</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Swap Fee:</span>
              <span className="font-medium">1% (managed by protocol)</span>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-xs text-blue-800 dark:text-blue-200">
              💡 <strong>Premium/Discount System:</strong> Buy orders include a +5,000 BTB premium per NFT, while sell orders have a -5,000 BTB discount per NFT. This creates spread for liquidity providers.
            </p>
          </div>
          
          <div className="mt-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p className="text-xs text-yellow-800 dark:text-yellow-200">
              ⚠️ Base swap rates are dynamic and based on liquidity pool balances. Rates may change between preview and execution.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}