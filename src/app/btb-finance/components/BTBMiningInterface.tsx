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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Contract reads
  const { data: currentRound, refetch: refetchRound } = useReadContract({
    address: BTB_MINING_ADDRESS,
    abi: BTBMiningABI,
    functionName: 'getCurrentRound',
  });

  const { data: timeRemaining } = useReadContract({
    address: BTB_MINING_ADDRESS,
    abi: BTBMiningABI,
    functionName: 'getCurrentRoundTimeRemaining',
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
    if (!seconds) return '0s';
    const secs = Number(seconds);
    if (secs <= 0) return 'Round ended';
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins}m ${remainingSecs}s`;
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
    if (!isConnected || !roundInfo) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      checkpoint({
        address: BTB_MINING_ADDRESS,
        abi: BTBMiningABI,
        functionName: 'checkpoint',
        args: [roundInfo.id],
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

  if (!roundInfo) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Mining Stats Banner */}
      <Card className="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-950/20 dark:to-red-950/20 border-2 border-orange-200 dark:border-orange-800/50">
        <CardContent className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                #{roundInfo.id.toString()}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Current Round</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {formatTimeRemaining(timeRemaining as bigint)}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Time Remaining</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {formatEther(roundInfo.totalDeployed).slice(0, 6)} ETH
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Total Deployed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {roundInfo.finalized ? 'Finalized' : 'Active'}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Round Status</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Motherlode Information - Ultra compact version */}
      <Card className="border border-purple-200 dark:border-purple-800/50 shadow-sm">
        <CardHeader className="pb-2 pt-3 px-3">
          <CardTitle className="flex items-center gap-2 text-xs">
            <Trophy className="w-3 h-3 text-purple-600" />
            Motherlode Jackpots
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-1 pb-2 px-3">
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
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Pickaxe className="w-5 h-5 text-orange-600" />
            BTB Mining Game
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium">Select Squares ({selectedSquares.length} selected)</label>
              <div className="flex gap-2">
                <Button
                  onClick={selectAllSquares}
                  variant="outline"
                  size="sm"
                  disabled={!isConnected || isLoading}
                >
                  Select All
                </Button>
                <Button
                  onClick={clearAllSquares}
                  variant="outline"
                  size="sm"
                  disabled={!isConnected || isLoading || selectedSquares.length === 0}
                >
                  Clear
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {Array.from({ length: NUM_SQUARES }, (_, i) => (
                <Button
                  key={i}
                  onClick={() => toggleSquare(i)}
                  variant={selectedSquares.includes(i) ? "default" : "outline"}
                  className={`h-12 ${
                    selectedSquares.includes(i)
                      ? 'bg-orange-600 hover:bg-orange-700 text-white'
                      : 'hover:bg-orange-100 dark:hover:bg-orange-900/20'
                  }`}
                  disabled={!isConnected || isLoading}
                >
                  {i}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <div className="text-xs text-gray-500">
                Min: 0.0000001 ETH, Max: 10 ETH per square
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Partner Address (optional)</label>
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
          </div>

          <ActionButtons
            isConnected={isConnected}
            selectedSquares={selectedSquares}
            amountPerSquare={amountPerSquare}
            isLoading={isLoading}
            isDeploying={isDeploying}
            isCheckpointing={isCheckpointing}
            isClaiming={isClaiming}
            roundInfo={roundInfo}
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
              <div className="text-center">
                <div className="text-lg font-bold text-blue-600">
                  {formatEther(minerStats[0] as bigint || 0n)} ETH
                </div>
                <div className="text-xs text-gray-600">Claimable ETH</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-purple-600">
                  {formatEther(minerStats[1] as bigint || 0n)} BTB
                </div>
                <div className="text-xs text-gray-600">Claimable BTB</div>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2 pt-4">
            <Badge variant="secondary" className="flex items-center gap-1">
              <Grid3x3 className="w-3 h-3" />
              25 squares, 60-second rounds
            </Badge>
            <Badge variant="secondary" className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              Winners split losers' ETH
            </Badge>
            <Badge variant="secondary" className="flex items-center gap-1">
              <Trophy className="w-3 h-3" />
              20k BTB + motherlode bonuses
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}