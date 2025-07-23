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
  const [userBears, setUserBears] = useState<any[]>([]);
  const [selectedBearIds, setSelectedBearIds] = useState<number[]>([]);
  const [loadingBears, setLoadingBears] = useState(false);

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
    if (!isConnected || selectedBearIds.length === 0) return;

    try {
      setIsLoading(true);
      setTxHash('');
      
      // Use the actual selected Bear NFT token IDs
      const tx = await gameService.swapNFTForBTB(selectedBearIds);
      
      setTxHash(tx.hash);
      await tx.wait();
      
      setSelectedBearIds([]);
      setNftCount('1');
      await fetchUserBears(); // Refresh the bear list
      onSuccess();
    } catch (error) {
      console.error('Error swapping NFT for BTB:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch user's Bear NFTs
  const fetchUserBears = async () => {
    if (!isConnected) return;
    
    try {
      setLoadingBears(true);
      const bears = await gameService.getUserBears();
      setUserBears(bears);
    } catch (error) {
      console.error('Error fetching user bears:', error);
    } finally {
      setLoadingBears(false);
    }
  };

  // Handle Bear NFT selection
  const handleBearSelection = (tokenId: number, checked: boolean) => {
    if (checked) {
      setSelectedBearIds(prev => [...prev, tokenId]);
    } else {
      setSelectedBearIds(prev => prev.filter(id => id !== tokenId));
    }
  };

  // Calculate costs and returns when nftCount or selectedBears changes
  useEffect(() => {
    if (swapMode === 'btb-to-nft' && nftCount && parseInt(nftCount) > 0) {
      const count = parseInt(nftCount);
      gameService.calculateBTBCostForNFTs(count).then(setCostBreakdown);
    } else if (swapMode === 'nft-to-btb' && selectedBearIds.length > 0) {
      gameService.calculateBTBReturnForNFTs(selectedBearIds.length).then(setReturnBreakdown);
    } else {
      if (swapMode === 'btb-to-nft') setCostBreakdown(null);
      if (swapMode === 'nft-to-btb') setReturnBreakdown(null);
    }
  }, [nftCount, selectedBearIds, swapMode]);

  // Get liquidity info on component mount
  useEffect(() => {
    gameService.getSwapLiquidityInfo().then(setLiquidityInfo);
  }, []);

  // Fetch user's Bears when connected
  useEffect(() => {
    if (isConnected) {
      fetchUserBears();
    }
  }, [isConnected]);

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
                  <p className="text-green-700 dark:text-green-300">Sell Price: {parseFloat(gameStats.swapRate || '0').toFixed(6)} BTB per NFT (base rate)</p>
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
                      {parseFloat(costBreakdown.total) > parseFloat(gameStats.btbBalance) && (
                        <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
                          <p className="text-xs text-blue-800 dark:text-blue-200 mb-2">
                            💰 Insufficient BTB balance. You need {(parseFloat(costBreakdown.total) - parseFloat(gameStats.btbBalance)).toFixed(6)} more BTB.
                          </p>
                          <a 
                            href="/btb-finance" 
                            className="text-xs text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-200"
                          >
                            🔗 Buy BTB tokens here →
                          </a>
                        </div>
                      )}
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
                  Select Bear NFTs to Swap ({selectedBearIds.length} selected)
                </label>
                
                {loadingBears ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-600 mx-auto"></div>
                    <p className="text-sm text-gray-500 mt-2">Loading your Bear NFTs...</p>
                  </div>
                ) : userBears.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-gray-500 text-sm">You don't own any Bear NFTs to swap</p>
                  </div>
                ) : (
                  <div className="max-h-48 overflow-y-auto space-y-2 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                    {userBears.map((bear) => (
                      <div
                        key={bear.tokenId}
                        className={`flex items-center gap-3 p-2 rounded border ${
                          selectedBearIds.includes(parseInt(bear.tokenId))
                            ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/30'
                            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedBearIds.includes(parseInt(bear.tokenId))}
                          onChange={(e) => 
                            handleBearSelection(parseInt(bear.tokenId), e.target.checked)
                          }
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="flex-1">
                          <span className="font-medium text-sm">Bear #{bear.tokenId}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {returnBreakdown && (
                <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg">
                  <h4 className="font-semibold mb-2">Return Breakdown:</h4>
                  {returnBreakdown.isValid ? (
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Base Rate ({selectedBearIds.length} NFT{selectedBearIds.length !== 1 ? 's' : ''}):</span>
                        <span className="font-medium">{parseFloat(returnBreakdown.baseRate).toFixed(6)} BTB</span>
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
                disabled={isLoading || selectedBearIds.length === 0 || (returnBreakdown && !returnBreakdown.isValid)}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white"
                size="lg"
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Selling...
                  </div>
                ) : (
                  <span>Sell {selectedBearIds.length} Bear NFT{selectedBearIds.length !== 1 ? 's' : ''}</span>
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
              <span className="text-gray-600 dark:text-gray-400">Sell Price:</span>
              <span className="font-medium text-green-600">Base rate (no discount)</span>
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
          
          <div className="mt-2 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
            <p className="text-xs text-orange-800 dark:text-orange-200 mb-2">
              🛒 <strong>Alternative:</strong> Looking for cheaper Bear NFTs? You can buy them directly from OpenSea and bring them to the game!
            </p>
            <a 
              href="https://opensea.io/collection/btb-bears" 
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-orange-600 dark:text-orange-400 underline hover:text-orange-800 dark:hover:text-orange-200"
            >
              🔗 View BTB Bears on OpenSea →
            </a>
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