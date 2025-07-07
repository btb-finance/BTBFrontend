'use client';

import { useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { useWallet } from '@/app/context/WalletContext';
import gameService from '../services/gameService';
import { FireIcon, ClockIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

interface FeedHunterProps {
  hunterTokens: any[];
  onSuccess: () => void;
}

export default function FeedHunter({ hunterTokens, onSuccess }: FeedHunterProps) {
  const { isConnected } = useWallet();
  const [selectedHunters, setSelectedHunters] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [txHash, setTxHash] = useState<string>('');

  const handleSelectHunter = (tokenId: string) => {
    setSelectedHunters(prev => 
      prev.includes(tokenId) 
        ? prev.filter(id => id !== tokenId)
        : [...prev, tokenId]
    );
  };

  const handleSelectAllFeedable = () => {
    const feedableHunters = hunterTokens.filter(hunter => hunter.canFeed && !hunter.inHibernation);
    const feedableIds = feedableHunters.map(hunter => hunter.tokenId);
    
    if (selectedHunters.length === feedableIds.length) {
      setSelectedHunters([]);
    } else {
      setSelectedHunters(feedableIds);
    }
  };

  const handleFeed = async () => {
    if (!isConnected || selectedHunters.length === 0) return;

    try {
      setIsLoading(true);
      setTxHash('');
      
      const hunterIds = selectedHunters.map(id => parseInt(id));
      const tx = await gameService.feedHunters(hunterIds);
      
      setTxHash(tx.hash);
      await tx.wait();
      
      setSelectedHunters([]);
      onSuccess();
    } catch (error) {
      console.error('Error feeding hunters:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getHunterStatus = (hunter: any) => {
    if (hunter.daysRemaining === 0) {
      return { status: 'Expired', color: 'text-red-500', bgColor: 'bg-red-50 dark:bg-red-900/20', icon: ExclamationTriangleIcon };
    }
    if (hunter.inHibernation) {
      return { status: 'Hibernating', color: 'text-yellow-500', bgColor: 'bg-yellow-50 dark:bg-yellow-900/20', icon: ClockIcon };
    }
    if (!hunter.canFeed) {
      return { status: 'Fed Recently', color: 'text-green-500', bgColor: 'bg-green-50 dark:bg-green-900/20', icon: FireIcon };
    }
    return { status: 'Ready to Feed', color: 'text-blue-500', bgColor: 'bg-blue-50 dark:bg-blue-900/20', icon: FireIcon };
  };

  const feedableHunters = hunterTokens.filter(hunter => hunter.canFeed && !hunter.inHibernation && hunter.daysRemaining > 0);

  if (!isConnected) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <FireIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Connect Wallet</h3>
          <p className="text-gray-600 dark:text-gray-400">
            Connect your wallet to feed your Hunter NFTs
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Feeding Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FireIcon className="h-5 w-5" />
            Feed Your Hunters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 p-4 rounded-lg mb-4">
            <h4 className="font-semibold text-red-800 dark:text-red-200 mb-2">Feeding Benefits:</h4>
            <ul className="space-y-2 text-sm text-red-700 dark:text-red-300">
              <li className="flex items-center gap-2">
                <FireIcon className="h-4 w-4" />
                Increases hunter power by 2% daily
              </li>
              <li className="flex items-center gap-2">
                <FireIcon className="h-4 w-4" />
                Prevents hibernation and keeps hunters active
              </li>
              <li className="flex items-center gap-2">
                <FireIcon className="h-4 w-4" />
                Must feed every 24 hours for optimal performance
              </li>
            </ul>
          </div>
          
          {hunterTokens.length === 0 ? (
            <div className="text-center py-8">
              <FireIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500 dark:text-gray-400">
                You don't have any Hunter NFTs to feed
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                Deposit Bear NFTs first to get Hunter NFTs
              </p>
            </div>
          ) : (
            <>
              {/* Hunter Selection */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-semibold">
                    Select Hunters to Feed ({selectedHunters.length} selected)
                  </h4>
                  {feedableHunters.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSelectAllFeedable}
                    >
                      {selectedHunters.length === feedableHunters.length ? 'Deselect All' : 'Select All Feedable'}
                    </Button>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-64 overflow-y-auto">
                  {hunterTokens.map((hunter) => {
                    const status = getHunterStatus(hunter);
                    const canSelect = hunter.canFeed && !hunter.inHibernation && hunter.daysRemaining > 0;
                    
                    return (
                      <div
                        key={hunter.tokenId}
                        className={`border-2 rounded-lg p-4 transition-all ${
                          selectedHunters.includes(hunter.tokenId)
                            ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                            : canSelect
                            ? 'border-gray-200 dark:border-gray-700 hover:border-red-300 cursor-pointer'
                            : 'border-gray-200 dark:border-gray-700 opacity-60'
                        }`}
                        onClick={() => canSelect && handleSelectHunter(hunter.tokenId)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-red-400 to-pink-500 rounded-lg flex items-center justify-center">
                              <span className="text-white font-bold text-lg">⚔️</span>
                            </div>
                            <div>
                              <p className="font-medium">Hunter #{hunter.tokenId}</p>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                Power: {hunter.power || '0'}
                              </p>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                Days Left: {hunter.daysRemaining || 0}
                              </p>
                            </div>
                          </div>
                          <div className={`px-2 py-1 rounded-full ${status.bgColor} flex items-center gap-1`}>
                            <status.icon className={`h-3 w-3 ${status.color}`} />
                            <span className={`text-xs font-medium ${status.color}`}>
                              {status.status}
                            </span>
                          </div>
                        </div>
                        
                        {selectedHunters.includes(hunter.tokenId) && (
                          <div className="mt-2 w-4 h-4 mx-auto bg-red-500 rounded-full flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Feed Button */}
              <div className="pt-4">
                <Button
                  onClick={handleFeed}
                  disabled={isLoading || selectedHunters.length === 0}
                  className="w-full bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white"
                  size="lg"
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Feeding...
                    </div>
                  ) : (
                    `Feed ${selectedHunters.length} Hunter${selectedHunters.length !== 1 ? 's' : ''}`
                  )}
                </Button>
                
                {feedableHunters.length === 0 && hunterTokens.length > 0 && (
                  <div className="mt-2 text-center text-sm text-yellow-600 dark:text-yellow-400">
                    All hunters have been fed recently or are not available for feeding
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