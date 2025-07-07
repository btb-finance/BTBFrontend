'use client';

import { useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { useWallet } from '@/app/context/WalletContext';
import gameService from '../services/gameService';
import { GiftIcon, SparklesIcon } from '@heroicons/react/24/outline';

interface DepositBearProps {
  bearTokens: any[];
  onSuccess: () => void;
}

export default function DepositBear({ bearTokens, onSuccess }: DepositBearProps) {
  const { isConnected } = useWallet();
  const [selectedBears, setSelectedBears] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [txHash, setTxHash] = useState<string>('');

  const handleSelectBear = (tokenId: string) => {
    setSelectedBears(prev => 
      prev.includes(tokenId) 
        ? prev.filter(id => id !== tokenId)
        : [...prev, tokenId]
    );
  };

  const handleSelectAll = () => {
    if (selectedBears.length === bearTokens.length) {
      setSelectedBears([]);
    } else {
      setSelectedBears(bearTokens.map(bear => bear.tokenId));
    }
  };

  const handleDeposit = async () => {
    if (!isConnected || selectedBears.length === 0) return;

    try {
      setIsLoading(true);
      setTxHash('');
      
      const bearIds = selectedBears.map(id => parseInt(id));
      const tx = await gameService.depositBears(bearIds);
      
      setTxHash(tx.hash);
      await tx.wait();
      
      setSelectedBears([]);
      onSuccess();
    } catch (error) {
      console.error('Error depositing bears:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isConnected) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <GiftIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Connect Wallet</h3>
          <p className="text-gray-600 dark:text-gray-400">
            Connect your wallet to deposit Bear NFTs and start playing
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Deposit Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GiftIcon className="h-5 w-5" />
            Deposit Bear NFTs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 p-4 rounded-lg mb-4">
            <h4 className="font-semibold text-orange-800 dark:text-orange-200 mb-2">Rewards for Each Bear Deposited:</h4>
            <ul className="space-y-2 text-sm text-orange-700 dark:text-orange-300">
              <li className="flex items-center gap-2">
                <SparklesIcon className="h-4 w-4" />
                1 Hunter NFT (your battle companion)
              </li>
              <li className="flex items-center gap-2">
                <SparklesIcon className="h-4 w-4" />
                1,000,000 MiMo tokens (game currency)
              </li>
            </ul>
          </div>
          
          {bearTokens.length === 0 ? (
            <div className="text-center py-8">
              <GiftIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500 dark:text-gray-400">
                You don't have any Bear NFTs to deposit
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                Purchase Bear NFTs first to start playing the game
              </p>
            </div>
          ) : (
            <>
              {/* Bear Selection */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-semibold">Select Bears to Deposit ({selectedBears.length} selected)</h4>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAll}
                  >
                    {selectedBears.length === bearTokens.length ? 'Deselect All' : 'Select All'}
                  </Button>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-h-64 overflow-y-auto">
                  {bearTokens.map((bear) => (
                    <div
                      key={bear.tokenId}
                      className={`border-2 rounded-lg p-3 cursor-pointer transition-all ${
                        selectedBears.includes(bear.tokenId)
                          ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-orange-300'
                      }`}
                      onClick={() => handleSelectBear(bear.tokenId)}
                    >
                      <div className="text-center">
                        <div className="w-16 h-16 mx-auto mb-2 bg-gradient-to-br from-orange-400 to-amber-500 rounded-lg flex items-center justify-center">
                          <span className="text-white font-bold text-lg">🐻</span>
                        </div>
                        <p className="text-sm font-medium">Bear #{bear.tokenId}</p>
                        {selectedBears.includes(bear.tokenId) && (
                          <div className="mt-2 w-4 h-4 mx-auto bg-orange-500 rounded-full flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Deposit Button */}
              <div className="pt-4">
                <Button
                  onClick={handleDeposit}
                  disabled={isLoading || selectedBears.length === 0}
                  className="w-full bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white"
                  size="lg"
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Depositing...
                    </div>
                  ) : (
                    `Deposit ${selectedBears.length} Bear${selectedBears.length !== 1 ? 's' : ''}`
                  )}
                </Button>
                
                {selectedBears.length > 0 && (
                  <div className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
                    You will receive: {selectedBears.length} Hunter NFT{selectedBears.length !== 1 ? 's' : ''} + {(selectedBears.length * 1000000).toLocaleString()} MiMo tokens
                  </div>
                )}
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