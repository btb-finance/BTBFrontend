'use client';

import React, { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { Badge } from '../../components/ui/badge';
import { Loader2, Pickaxe, Trophy, AlertCircle, CheckCircle2, Grid3x3, Users, Coins } from 'lucide-react';
import BTBMiningABI from '../BTBMiningABI.json';

const BTB_MINING_ADDRESS = '0x88888DC54965374764F85cB5AB1B45DCEf186508';
const NUM_SQUARES = 25;

interface RoundInfo {
  id: bigint;
  startTime: bigint;
  endTime: bigint;
  totalDeployed: bigint;
  winningSquare: number;
  finalized: boolean;
  isCheckpointable: boolean;
}

// Action buttons component
function ActionButtons({
  isConnected,
  selectedSquares,
  amountPerSquare,
  isLoading,
  isDeploying,
  isCheckpointing,
  isClaiming,
  roundInfo,
  handleDeploy,
  handleCheckpoint,
  handleClaimAll,
}: {
  isConnected: boolean;
  selectedSquares: number[];
  amountPerSquare: string;
  isLoading: boolean;
  isDeploying: boolean;
  isCheckpointing: boolean;
  isClaiming: boolean;
  roundInfo: RoundInfo | undefined;
  handleDeploy: () => void;
  handleCheckpoint: () => void;
  handleClaimAll: () => void;
}): React.ReactElement {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Button
        onClick={handleDeploy}
        disabled={!isConnected || selectedSquares.length === 0 || !amountPerSquare || isLoading}
        className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700"
      >
        {isLoading && isDeploying ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Deploying...
          </>
        ) : (
          <>
            <Pickaxe className="w-4 h-4 mr-2" />
            Deploy to {selectedSquares.length} Squares
          </>
        )}
      </Button>

      <Button
        onClick={handleCheckpoint}
        disabled={!isConnected || !roundInfo?.isCheckpointable || isLoading}
        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
      >
        {isLoading && isCheckpointing ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Checkpointing...
          </>
        ) : (
          <>
            <Trophy className="w-4 h-4 mr-2" />
            Checkpoint Round
          </>
        )}
      </Button>

      <Button
        onClick={handleClaimAll}
        disabled={!isConnected || isLoading}
        className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
      >
        {isLoading && isClaiming ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Claiming...
          </>
        ) : (
          <>
            <Coins className="w-4 h-4 mr-2" />
            Claim All Rewards
          </>
        )}
      </Button>
    </div>
  );
}

export function BTBMiningInterface(): React.ReactElement {
  const { address, isConnected } = useAccount();
  
  // UI State
  const [selectedSquares, setSelectedSquares] = useState<number[]>([]);
  const [amountPerSquare, setAmountPerSquare] = useState('');
  const [partnerAddress, setPartnerAddress] = useState('');
  const [showPartnerAddress, setShowPartnerAddress] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [localTimeRemaining, setLocalTimeRemaining] = useState<number>(0);
  
  // Contract reads with dynamic polling based on time remaining
  const { data: currentRound, refetch: refetchRound } = useReadContract({
    address: BTB_MINING_ADDRESS,
    abi: BTBMiningABI,
    functionName: 'getCurrentRound',
    query: {
      refetchInterval: localTimeRemaining < 60 ? 1000 : 60000, // 1s if < 60s, else 1min
    }
  });

  const { data: timeRemaining } = useReadContract({
    address: BTB_MINING_ADDRESS,
    abi: BTBMiningABI,
    functionName: 'getCurrentRoundTimeRemaining',
    query: {
      refetchInterval: 5000, // Check every 5 seconds
    }
  });

  const { data: minerStats } = useReadContract({
    address: BTB_MINING_ADDRESS,
    abi: BTBMiningABI,
    functionName: 'getTotalClaimableBalance',
    args: address ? [address] : undefined,
  });

  // Contract writes
  const { writeContract: deploy, data: deployHash } = useWriteContract();
  const { writeContract: checkpoint, data: checkpointHash } = useWriteContract();
  const { writeContract: claimAll, data: claimHash } = useWriteContract();

  // Motherlode data
  const { data: motherlodePots } = useReadContract({
    address: BTB_MINING_ADDRESS,
    abi: BTBMiningABI,
    functionName: 'getAllMotherloadePots',
    query: {
      refetchInterval: localTimeRemaining < 60 ? 1000 : 60000, // 1s if < 60s, else 1min
    }
  });

  const motherlodeTiers = [
    { name: 'Bronze Nugget', probability: '1 in 100', color: 'bg-orange-100 dark:bg-orange-950/20 border-orange-300 dark:border-orange-700' },
    { name: 'Silver Nugget', probability: '1 in 200', color: 'bg-gray-100 dark:bg-gray-900 border-gray-300 dark:border-gray-700' },
    { name: 'Gold Nugget', probability: '1 in 300', color: 'bg-yellow-100 dark:bg-yellow-950/20 border-yellow-300 dark:border-yellow-700' },
    { name: 'Platinum Nugget', probability: '1 in 400', color: 'bg-slate-100 dark:bg-slate-900 border-slate-300 dark:border-slate-700' },
    { name: 'Diamond Nugget', probability: '1 in 500', color: 'bg-blue-100 dark:bg-blue-950/20 border-blue-300 dark:border-blue-700' },
    { name: 'Emerald Vein', probability: '1 in 600', color: 'bg-green-100 dark:bg-green-950/20 border-green-300 dark:border-green-700' },
    { name: 'Ruby Vein', probability: '1 in 700', color: 'bg-red-100 dark:bg-red-950/20 border-red-300 dark:border-red-700' },
    { name: 'Sapphire Vein', probability: '1 in 800', color: 'bg-indigo-100 dark:bg-indigo-950/20 border-indigo-300 dark:border-indigo-700' },
    { name: 'Crystal Cache', probability: '1 in 900', color: 'bg-cyan-100 dark:bg-cyan-950/20 border-cyan-300 dark:border-cyan-700' },
    { name: 'MOTHERLODE', probability: '1 in 1000', color: 'bg-pink-100 dark:bg-pink-950/20 border-pink-400 dark:border-pink-600' },
  ];

  // Transaction receipts
  const { isLoading: isDeploying, isSuccess: deploySuccess } = useWaitForTransactionReceipt({
    hash: deployHash,
  });

  const { isLoading: isCheckpointing, isSuccess: checkpointSuccess } = useWaitForTransactionReceipt({
    hash: checkpointHash,
  });

  const { isLoading: isClaiming, isSuccess: claimSuccess } = useWaitForTransactionReceipt({
    hash: claimHash,
  });

  // Parse round data
  const roundInfo = currentRound as RoundInfo | undefined;
  
  // Format time remaining
  const formatTimeRemaining = (seconds: bigint | undefined) => {
    if (!seconds || seconds === 0n) return '0s';
    const secs = Number(seconds);
    if (secs <= 0) return 'Ended';

    const days = Math.floor(secs / 86400);
    const hours = Math.floor((secs % 86400) / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const remainingSecs = secs % 60;

    if (days > 0) {
      return `${days}d ${hours}h ${mins}m`;
    } else if (hours > 0) {
      return `${hours}h ${mins}m ${remainingSecs}s`;
    } else if (mins > 0) {
      return `${mins}m ${remainingSecs}s`;
    } else {
      return `${remainingSecs}s`;
    }
  };

  // Handle square selection
  const toggleSquare = (square: number) => {
    setSelectedSquares(prev => {
      if (prev.includes(square)) {
        return prev.filter(s => s !== square);
      }
      return [...prev, square];
    });
  };

  // Select all squares
  const selectAllSquares = () => {
    setSelectedSquares(Array.from({ length: NUM_SQUARES }, (_, i) => i));
  };

  // Clear all squares
  const clearAllSquares = () => {
    setSelectedSquares([]);
  };

  // Select even squares (0, 2, 4, 6, ...)
  const selectEvenSquares = () => {
    setSelectedSquares(Array.from({ length: NUM_SQUARES }, (_, i) => i).filter(i => i % 2 === 0));
  };

  // Select odd squares (1, 3, 5, 7, ...)
  const selectOddSquares = () => {
    setSelectedSquares(Array.from({ length: NUM_SQUARES }, (_, i) => i).filter(i => i % 2 === 1));
  };

  // Handle deploy
  const handleDeploy = async () => {
    if (!isConnected || selectedSquares.length === 0 || !amountPerSquare) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      const squaresArray = selectedSquares.map(s => Number(s));
      const amountWei = parseEther(amountPerSquare);
      const partner = partnerAddress || '0x0000000000000000000000000000000000000000';
      
      const totalValue = amountWei * BigInt(squaresArray.length);
      
      deploy({
        address: BTB_MINING_ADDRESS,
        abi: BTBMiningABI,
        functionName: 'deploy',
        args: [squaresArray, amountWei, partner],
        value: totalValue,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deploy');
      setIsLoading(false);
    }
  };

  // Handle checkpoint
  const handleCheckpoint = async () => {
    if (!isConnected || !displayRoundInfo || isDataLoading) return;

    try {
      setIsLoading(true);
      setError(null);

      checkpoint({
        address: BTB_MINING_ADDRESS,
        abi: BTBMiningABI,
        functionName: 'checkpoint',
        args: [displayRoundInfo.id],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to checkpoint');
      setIsLoading(false);
    }
  };

  // Handle claim all
  const handleClaimAll = async () => {
    if (!isConnected) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      claimAll({
        address: BTB_MINING_ADDRESS,
        abi: BTBMiningABI,
        functionName: 'claimAll',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to claim');
      setIsLoading(false);
    }
  };

  // Handle transaction success
  useEffect(() => {
    if (deploySuccess) {
      setSuccess(`Successfully deployed to ${selectedSquares.length} squares!`);
      setSelectedSquares([]);
      setAmountPerSquare('');
      setIsLoading(false);
      refetchRound();
    }
  }, [deploySuccess]);

  useEffect(() => {
    if (checkpointSuccess) {
      setSuccess('Successfully checkpointed! Rewards calculated.');
      setIsLoading(false);
      refetchRound();
    }
  }, [checkpointSuccess]);

  useEffect(() => {
    if (claimSuccess) {
      setSuccess('Successfully claimed all rewards!');
      setIsLoading(false);
    }
  }, [claimSuccess]);

  // Clear messages
  useEffect(() => {
    setError(null);
    setSuccess(null);
  }, [selectedSquares, amountPerSquare]);

  // Initialize and countdown local timer
  useEffect(() => {
    if (timeRemaining) {
      setLocalTimeRemaining(Number(timeRemaining));
    }
  }, [timeRemaining]);

  // Countdown timer
  useEffect(() => {
    if (localTimeRemaining <= 0) return;

    const interval = setInterval(() => {
      setLocalTimeRemaining(prev => {
        if (prev <= 1) {
          refetchRound();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [localTimeRemaining, refetchRound]);

  // Default values for when data is loading
  const defaultRoundInfo = {
    id: 0n,
    startTime: 0n,
    endTime: 0n,
    totalDeployed: 0n,
    winningSquare: 0,
    finalized: false,
    isCheckpointable: false,
  };

  const displayRoundInfo = (roundInfo as RoundInfo) || defaultRoundInfo;
  const isDataLoading = !roundInfo;

  return (
    <div className="space-y-4">
      {isDataLoading && (
        <Alert className="bg-orange-50 border-orange-200">
          <Loader2 className="w-4 h-4 animate-spin text-orange-600" />
          <AlertDescription className="text-orange-800">Loading contract data...</AlertDescription>
        </Alert>
      )}
      {/* Motherlode Information - Ultra compact version */}
      <Card className="border border-purple-200 dark:border-purple-800/50">
        <CardHeader className="pb-1 pt-2 px-2">
          <CardTitle className="flex items-center gap-1 text-[10px]">
            <Trophy className="w-3 h-3 text-purple-600" />
            Motherlode Jackpots
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 pb-2 px-2">
          <div className="grid grid-cols-5 md:grid-cols-10 gap-1">
            {motherlodeTiers.map((tier, index) => (
              <div
                key={index}
                className={`p-1 rounded text-center ${tier.color} transition-all hover:shadow-sm border border-purple-200 dark:border-purple-800`}
              >
                <div className="font-bold text-[10px] leading-tight mb-0.5 truncate">
                  {tier.name.replace(' Nugget', '').replace(' Vein', '').replace(' Cache', '').replace('MOTHERLODE', 'ULTIMATE')}
                </div>
                <div className="text-sm font-bold text-purple-700 dark:text-purple-400 leading-tight">
                  {motherlodePots && Array.isArray(motherlodePots)
                    ? `${formatEther(motherlodePots[index] as bigint).slice(0, 4)}`
                    : '0'}
                </div>
                <div className="text-[9px] text-gray-600 dark:text-gray-400 leading-tight">
                  BTB
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Mining Interface */}
      <Card className="border-2 border-orange-200 dark:border-orange-800/50">
        <CardHeader className="pb-3 pt-4 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Pickaxe className="w-5 h-5 text-orange-600" />
              BTB Mining Game
            </CardTitle>
            <div className="flex items-center gap-3 text-sm">
              <div className="flex items-center gap-1">
                <span className="text-gray-500">Round</span>
                <span className="font-bold text-orange-600">#{displayRoundInfo.id.toString()}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-gray-500">Time</span>
                <span className="font-bold text-red-600">{formatTimeRemaining(BigInt(localTimeRemaining))}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-gray-500">Pot</span>
                <span className="font-bold text-green-600">{formatEther(displayRoundInfo.totalDeployed).slice(0, 6)} ETH</span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 px-4 pb-4">
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium">Select Squares ({selectedSquares.length})</label>
              <div className="flex gap-2 items-center">
                <Button
                  onClick={selectAllSquares}
                  variant="outline"
                  size="sm"
                  disabled={!isConnected || isLoading}
                >
                  All
                </Button>
                <Button
                  onClick={selectEvenSquares}
                  variant="outline"
                  size="sm"
                  disabled={!isConnected || isLoading}
                >
                  Even
                </Button>
                <Button
                  onClick={selectOddSquares}
                  variant="outline"
                  size="sm"
                  disabled={!isConnected || isLoading}
                >
                  Odd
                </Button>
                <Button
                  onClick={clearAllSquares}
                  variant="outline"
                  size="sm"
                  disabled={!isConnected || isLoading || selectedSquares.length === 0}
                >
                  Clear
                </Button>
                <div className="h-4 w-px bg-gray-300 dark:bg-gray-700"></div>
                <Button
                  onClick={() => setShowPartnerAddress(!showPartnerAddress)}
                  variant="outline"
                  size="sm"
                  disabled={!isConnected || isLoading}
                >
                  {showPartnerAddress ? 'Hide' : '+'} Partner
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {Array.from({ length: NUM_SQUARES }, (_, i) => {
                const isEven = i % 2 === 0;
                const isSelected = selectedSquares.includes(i);

                // Get square data from current round
                const squareDeployed = displayRoundInfo && Array.isArray((displayRoundInfo as any).deployed)
                  ? (displayRoundInfo as any).deployed[i]
                  : 0n;
                const squareMinerCount = displayRoundInfo && Array.isArray((displayRoundInfo as any).minerCount)
                  ? (displayRoundInfo as any).minerCount[i]
                  : 0n;

                const ethAmount = squareDeployed ? formatEther(squareDeployed as bigint).slice(0, 6) : '0';
                const playerCount = squareMinerCount ? Number(squareMinerCount) : 0;

                return (
                  <Button
                    key={i}
                    onClick={() => toggleSquare(i)}
                    variant={isSelected ? "default" : "outline"}
                    className={`h-16 relative p-1 ${
                      isSelected
                        ? isEven
                          ? 'bg-blue-600 hover:bg-blue-700 text-white'
                          : 'bg-orange-600 hover:bg-orange-700 text-white'
                        : isEven
                        ? 'hover:bg-blue-50 dark:hover:bg-blue-950/20 border-blue-200 dark:border-blue-800'
                        : 'hover:bg-orange-50 dark:hover:bg-orange-950/20 border-orange-200 dark:border-orange-800'
                    }`}
                    disabled={!isConnected || isLoading}
                  >
                    <div className="flex flex-col items-center justify-center h-full">
                      <div className="font-bold text-base">{i}</div>
                      {playerCount > 0 && (
                        <div className="text-[9px] leading-tight mt-0.5">{ethAmount}Ξ</div>
                      )}
                    </div>
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Amount per Square (ETH)</label>
              <Input
                type="number"
                placeholder="0.001"
                step="0.001"
                min="0.0000001"
                max="10"
                value={amountPerSquare}
                onChange={(e) => setAmountPerSquare(e.target.value)}
                disabled={!isConnected || isLoading}
              />
              <div className="flex gap-1 flex-wrap">
                <Button
                  onClick={() => setAmountPerSquare('0.001')}
                  variant="outline"
                  size="sm"
                  className="text-xs px-2 py-1 h-6"
                  disabled={!isConnected || isLoading}
                >
                  0.001
                </Button>
                <Button
                  onClick={() => setAmountPerSquare('0.01')}
                  variant="outline"
                  size="sm"
                  className="text-xs px-2 py-1 h-6"
                  disabled={!isConnected || isLoading}
                >
                  0.01
                </Button>
                <Button
                  onClick={() => setAmountPerSquare('0.1')}
                  variant="outline"
                  size="sm"
                  className="text-xs px-2 py-1 h-6"
                  disabled={!isConnected || isLoading}
                >
                  0.1
                </Button>
                <Button
                  onClick={() => setAmountPerSquare('1')}
                  variant="outline"
                  size="sm"
                  className="text-xs px-2 py-1 h-6"
                  disabled={!isConnected || isLoading}
                >
                  1
                </Button>
              </div>
            </div>

            {showPartnerAddress && (
              <div className="space-y-1">
                <label className="text-sm font-medium">Partner Address</label>
                <Input
                  type="text"
                  placeholder="0x... (optional)"
                  value={partnerAddress}
                  onChange={(e) => setPartnerAddress(e.target.value)}
                  disabled={!isConnected || isLoading}
                />
                <div className="text-xs text-gray-500">
                  Referral partner for cashback
                </div>
              </div>
            )}
          </div>

          <ActionButtons
            isConnected={isConnected}
            selectedSquares={selectedSquares}
            amountPerSquare={amountPerSquare}
            isLoading={isLoading || isDataLoading}
            isDeploying={isDeploying}
            isCheckpointing={isCheckpointing}
            isClaiming={isClaiming}
            roundInfo={displayRoundInfo}
            handleDeploy={handleDeploy}
            handleCheckpoint={handleCheckpoint}
            handleClaimAll={handleClaimAll}
          />

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="bg-green-50 border-green-500">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <AlertDescription className="text-green-800">{success}</AlertDescription>
            </Alert>
          )}

          {(minerStats && Array.isArray(minerStats)) ? (
            <div className="grid grid-cols-2 gap-2 pt-2 border-t">
              <div className="text-center">
                <div className="text-sm font-bold text-blue-600">
                  {formatEther(minerStats[0] as bigint || 0n)} ETH
                </div>
                <div className="text-[10px] text-gray-600">Claimable</div>
              </div>
              <div className="text-center">
                <div className="text-sm font-bold text-purple-600">
                  {formatEther(minerStats[1] as bigint || 0n)} BTB
                </div>
                <div className="text-[10px] text-gray-600">Claimable</div>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-1 pt-2">
            <Badge variant="secondary" className="flex items-center gap-1 text-[10px] px-1.5 py-0.5">
              <Grid3x3 className="w-2.5 h-2.5" />
              25sq/60s
            </Badge>
            <Badge variant="secondary" className="flex items-center gap-1 text-[10px] px-1.5 py-0.5">
              <Users className="w-2.5 h-2.5" />
              Split ETH
            </Badge>
            <Badge variant="secondary" className="flex items-center gap-1 text-[10px] px-1.5 py-0.5">
              <Trophy className="w-2.5 h-2.5" />
              20k BTB
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}