'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { useWallet } from '@/app/context/WalletContext';
import gameService from '../services/gameService';
import HuntTimer from './HuntTimer';
import { ShieldExclamationIcon, ClockIcon, ExclamationTriangleIcon, UserIcon } from '@heroicons/react/24/outline';

interface HuntMimoProps {
  hunterTokens: any[];
  mimoBalance: string;
  onSuccess: () => void;
}

export default function HuntMimo({ hunterTokens, mimoBalance, onSuccess }: HuntMimoProps) {
  const { isConnected } = useWallet();
  const [selectedHunters, setSelectedHunters] = useState<string[]>([]);
  const [targetAddress, setTargetAddress] = useState<string>('');
  const [huntMode, setHuntMode] = useState<'self' | 'target'>('self');
  const [isLoading, setIsLoading] = useState(false);
  const [txHash, setTxHash] = useState<string>('');
  const [huntTimings, setHuntTimings] = useState<{[hunterId: string]: {
    timeUntilNextHunt: number;
    canHuntNow: boolean;
  }}>({});

  // Load hunt timings for all hunters
  useEffect(() => {
    const loadHuntTimings = async () => {
      if (hunterTokens.length === 0) return;
      
      try {
        const tokenIds = hunterTokens.map(hunter => parseInt(hunter.tokenId));
        const timings = await gameService.getHuntTimingForHunters(tokenIds);
        
        const formattedTimings: {[hunterId: string]: any} = {};
        Object.entries(timings).forEach(([tokenId, timing]) => {
          formattedTimings[tokenId] = {
            timeUntilNextHunt: timing.timeUntilNextHunt,
            canHuntNow: timing.canHuntNow
          };
        });
        
        setHuntTimings(formattedTimings);
      } catch (error) {
        console.error('Error loading hunt timings:', error);
      }
    };

    loadHuntTimings();
  }, [hunterTokens]);

  const handleTimerComplete = (hunterId: number) => {
    setHuntTimings(prev => ({
      ...prev,
      [hunterId.toString()]: {
        timeUntilNextHunt: 0,
        canHuntNow: true
      }
    }));
    onSuccess(); // Refresh hunter data
  };

  const handleSelectHunter = (tokenId: string) => {
    setSelectedHunters(prev => 
      prev.includes(tokenId) 
        ? prev.filter(id => id !== tokenId)
        : [...prev, tokenId]
    );
  };

  const handleSelectAllHuntable = () => {
    const huntableHunters = hunterTokens.filter(hunter => hunter.canHunt && hunter.isActive);
    const huntableIds = huntableHunters.map(hunter => hunter.tokenId);
    
    if (selectedHunters.length === huntableIds.length) {
      setSelectedHunters([]);
    } else {
      setSelectedHunters(huntableIds);
    }
  };

  const handleHunt = async () => {
    if (!isConnected || selectedHunters.length === 0) return;

    try {
      setIsLoading(true);
      setTxHash('');
      
      const hunterIds = selectedHunters.map(id => parseInt(id));
      const targets = huntMode === 'target' && targetAddress ? [targetAddress] : [];
      
      const tx = await gameService.hunt(hunterIds, targets);
      const receipt = await tx.wait();
      setTxHash(receipt?.hash || '');
      
      setSelectedHunters([]);
      onSuccess();
    } catch (error) {
      console.error('Error hunting:', error);
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
    if (!hunter.canHunt) {
      return { status: 'Cooldown', color: 'text-orange-500', bgColor: 'bg-orange-50 dark:bg-orange-900/20', icon: ClockIcon };
    }
    return { status: 'Ready to Hunt', color: 'text-purple-500', bgColor: 'bg-purple-50 dark:bg-purple-900/20', icon: ShieldExclamationIcon };
  };

  const huntableHunters = hunterTokens.filter(hunter => hunter.canHunt && hunter.isActive && hunter.daysRemaining > 0);
  const totalPower = selectedHunters.reduce((total, hunterId) => {
    const hunter = hunterTokens.find(h => h.tokenId === hunterId);
    return total + parseFloat(hunter?.power || '0');
  }, 0);

  if (!isConnected) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <ShieldExclamationIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Connect Wallet</h3>
          <p className="text-gray-600 dark:text-gray-400">
            Connect your wallet to start hunting for MiMo tokens
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hunting Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldExclamationIcon className="h-5 w-5" />
            Hunt for MiMo Tokens
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 p-4 rounded-lg mb-4">
            <h4 className="font-semibold text-purple-800 dark:text-purple-200 mb-2">Hunting Mechanics:</h4>
            <ul className="space-y-2 text-sm text-purple-700 dark:text-purple-300">
              <li className="flex items-center gap-2">
                <ShieldExclamationIcon className="h-4 w-4" />
                Hunt amount = Hunter power level
              </li>
              <li className="flex items-center gap-2">
                <ShieldExclamationIcon className="h-4 w-4" />
                50% goes to you, 25% burns, 25% to liquidity
              </li>
              <li className="flex items-center gap-2">
                <ShieldExclamationIcon className="h-4 w-4" />
                24-hour cooldown between hunts
              </li>
            </ul>
          </div>

          {/* Hunt Mode Selection */}
          <div className="mb-4">
            <div className="flex gap-4 mb-4">
              <Button
                variant={huntMode === 'self' ? 'default' : 'outline'}
                onClick={() => setHuntMode('self')}
                className="flex items-center gap-2"
              >
                <UserIcon className="h-4 w-4" />
                Hunt Your Own MiMo
              </Button>
              <Button
                variant={huntMode === 'target' ? 'default' : 'outline'}
                onClick={() => setHuntMode('target')}
                className="flex items-center gap-2"
              >
                <ShieldExclamationIcon className="h-4 w-4" />
                Hunt from Address
              </Button>
            </div>

            {huntMode === 'target' && (
              <div>
                <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                    🎯 Recommended Team Address
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <code className="text-xs bg-white dark:bg-gray-800 px-2 py-1 rounded border flex-1 break-all">
                      0xb52bDEa1c5940C07f3c243d5dF6F3ca05e267365
                    </code>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => setTargetAddress('0xb52bDEa1c5940C07f3c243d5dF6F3ca05e267365')}
                      className="shrink-0"
                    >
                      Use This
                    </Button>
                  </div>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    Safe team address - protects user funds from hunting
                  </p>
                </div>
                
                <Input
                  placeholder="Enter target wallet address (0x...)"
                  value={targetAddress}
                  onChange={(e) => setTargetAddress(e.target.value)}
                  className="mb-2"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Leave empty to hunt from your own MiMo balance
                </p>
              </div>
            )}
          </div>
          
          {hunterTokens.length === 0 ? (
            <div className="text-center py-8">
              <ShieldExclamationIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500 dark:text-gray-400">
                You don't have any Hunter NFTs
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
                    Select Hunters ({selectedHunters.length} selected)
                  </h4>
                  {huntableHunters.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSelectAllHuntable}
                    >
                      {selectedHunters.length === huntableHunters.length ? 'Deselect All' : 'Select All Huntable'}
                    </Button>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-64 overflow-y-auto">
                  {hunterTokens.map((hunter) => {
                    const status = getHunterStatus(hunter);
                    const canSelect = hunter.canHunt && hunter.isActive && hunter.daysRemaining > 0;
                    
                    return (
                      <div
                        key={hunter.tokenId}
                        className={`border-2 rounded-lg p-4 transition-all ${
                          selectedHunters.includes(hunter.tokenId)
                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                            : canSelect
                            ? 'border-gray-200 dark:border-gray-700 hover:border-purple-300 cursor-pointer'
                            : 'border-gray-200 dark:border-gray-700 opacity-60'
                        }`}
                        onClick={() => canSelect && handleSelectHunter(hunter.tokenId)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-indigo-500 rounded-lg flex items-center justify-center">
                              <span className="text-white font-bold text-lg">⚔️</span>
                            </div>
                            <div>
                              <p className="font-medium">Hunter #{hunter.tokenId}</p>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                Power: {parseFloat(hunter.power || '0').toString()}
                              </p>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                Total Hunted: {parseFloat(hunter.totalHunted || '0').toLocaleString()}
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
                        
                        {/* Hunt Timer for hunters on cooldown */}
                        {!hunter.canHunt && hunter.isActive && hunter.daysRemaining > 0 && huntTimings[hunter.tokenId] && (
                          <div className="mt-3">
                            <HuntTimer
                              hunterId={parseInt(hunter.tokenId)}
                              initialTimeRemaining={huntTimings[hunter.tokenId].timeUntilNextHunt}
                              onTimerComplete={() => handleTimerComplete(parseInt(hunter.tokenId))}
                              showIcon={false}
                              className="w-full"
                            />
                          </div>
                        )}
                        
                        {selectedHunters.includes(hunter.tokenId) && (
                          <div className="mt-2 w-4 h-4 mx-auto bg-purple-500 rounded-full flex items-center justify-center">
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

              {/* Hunt Prediction */}
              {selectedHunters.length > 0 && (
                <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 p-4 rounded-lg">
                  <h4 className="font-semibold mb-2">Hunt Prediction:</h4>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600 dark:text-gray-400">Total Power</p>
                      <p className="font-bold">{totalPower.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 dark:text-gray-400">You'll Earn</p>
                      <p className="font-bold text-green-600">{(totalPower * 0.5).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 dark:text-gray-400">Will Burn</p>
                      <p className="font-bold text-red-600">{(totalPower * 0.25).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Hunt Button */}
              <div className="pt-4">
                <Button
                  onClick={handleHunt}
                  disabled={isLoading || selectedHunters.length === 0}
                  className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white"
                  size="lg"
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Hunting...
                    </div>
                  ) : (
                    `Hunt with ${selectedHunters.length} Hunter${selectedHunters.length !== 1 ? 's' : ''}`
                  )}
                </Button>
                
                {huntMode === 'self' && parseFloat(mimoBalance) === 0 && (
                  <div className="mt-2 text-center text-sm text-yellow-600 dark:text-yellow-400">
                    You have no MiMo tokens to hunt from your own balance
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