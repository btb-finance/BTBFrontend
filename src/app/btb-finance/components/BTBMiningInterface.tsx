'use client';

import React, { useState, useEffect } from 'react';
import { useAccount, useBalance, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Pickaxe, Trophy, AlertCircle, CheckCircle2, Grid3x3, Users, Coins, Zap } from 'lucide-react';
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
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
      <button
        onClick={handleDeploy}
        disabled={!isConnected || selectedSquares.length === 0 || !amountPerSquare || isLoading}
        className="relative group w-full overflow-hidden rounded-xl bg-gradient-to-r from-orange-600 to-red-600 p-[1px] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <div className="relative bg-black/80 backdrop-blur-sm rounded-xl px-6 py-4 transition-all group-hover:bg-black/60">
          <div className="flex items-center justify-center gap-2 font-bold text-white">
            {isLoading && isDeploying ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>DEPLOYING...</span>
              </>
            ) : (
              <>
                <Pickaxe className="w-5 h-5" />
                <span>DEPLOY ({selectedSquares.length})</span>
              </>
            )}
          </div>
        </div>
      </button>

      <button
        onClick={handleCheckpoint}
        disabled={!isConnected || !roundInfo?.isCheckpointable || isLoading}
        className="relative group w-full overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 p-[1px] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <div className="relative bg-black/80 backdrop-blur-sm rounded-xl px-6 py-4 transition-all group-hover:bg-black/60">
          <div className="flex items-center justify-center gap-2 font-bold text-white">
            {isLoading && isCheckpointing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>CHECKPOINTING...</span>
              </>
            ) : (
              <>
                <Trophy className="w-5 h-5" />
                <span>CHECKPOINT</span>
              </>
            )}
          </div>
        </div>
      </button>

      <button
        onClick={handleClaimAll}
        disabled={!isConnected || isLoading}
        className="relative group w-full overflow-hidden rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 p-[1px] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <div className="relative bg-black/80 backdrop-blur-sm rounded-xl px-6 py-4 transition-all group-hover:bg-black/60">
          <div className="flex items-center justify-center gap-2 font-bold text-white">
            {isLoading && isClaiming ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>CLAIMING...</span>
              </>
            ) : (
              <>
                <Coins className="w-5 h-5" />
                <span>CLAIM REWARDS</span>
              </>
            )}
          </div>
        </div>
      </button>
    </div>
  );
}

export function BTBMiningInterface(): React.ReactElement {
  const { address, isConnected } = useAccount();

  // Get user's ETH balance
  const { data: ethBalance } = useBalance({
    address: address,
  });

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
  const { writeContract: deploy, data: deployHash, error: deployError, isPending: deployPending } = useWriteContract();
  const { writeContract: checkpoint, data: checkpointHash, error: checkpointError, isPending: checkpointPending } = useWriteContract();
  const { writeContract: claimAll, data: claimHash, error: claimError, isPending: claimPending } = useWriteContract();

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
    { name: 'Bronze', color: 'from-orange-400 to-amber-600' },
    { name: 'Silver', color: 'from-gray-300 to-slate-500' },
    { name: 'Gold', color: 'from-yellow-300 to-amber-500' },
    { name: 'Platinum', color: 'from-slate-200 to-slate-400' },
    { name: 'Diamond', color: 'from-blue-300 to-cyan-500' },
    { name: 'Emerald', color: 'from-emerald-400 to-green-600' },
    { name: 'Ruby', color: 'from-red-400 to-rose-600' },
    { name: 'Sapphire', color: 'from-indigo-400 to-blue-600' },
    { name: 'Crystal', color: 'from-cyan-300 to-sky-500' },
    { name: 'MOTHERLODE', color: 'from-pink-500 to-fuchsia-600' },
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

  // Handle transaction errors
  useEffect(() => {
    if (deployError) {
      setError(deployError.message || 'Transaction rejected or failed');
      setIsLoading(false);
    }
  }, [deployError]);

  useEffect(() => {
    if (checkpointError) {
      setError(checkpointError.message || 'Checkpoint failed');
      setIsLoading(false);
    }
  }, [checkpointError]);

  useEffect(() => {
    if (claimError) {
      setError(claimError.message || 'Claim failed');
      setIsLoading(false);
    }
  }, [claimError]);

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
    <div className="space-y-8 font-sans">
      {/* Motherlode Ticker */}
      <div className="relative overflow-hidden rounded-xl bg-black/40 border border-white/10 backdrop-blur-sm">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-900/20 to-blue-900/20" />
        <div className="relative p-4">
          <div className="flex items-center gap-2 mb-3 text-xs font-bold tracking-widest text-purple-400 uppercase">
            <Trophy className="w-3 h-3" />
            Motherlode Jackpots
          </div>
          <div className="grid grid-cols-5 md:grid-cols-10 gap-2">
            {motherlodeTiers.map((tier, index) => (
              <div
                key={index}
                className="group relative flex flex-col items-center p-2 rounded-lg bg-white/5 border border-white/5 hover:border-white/20 transition-all"
              >
                <div className={`absolute inset-0 bg-gradient-to-b ${tier.color} opacity-0 group-hover:opacity-10 rounded-lg transition-opacity`} />
                <span className="text-[9px] text-white/60 uppercase tracking-wider mb-1">{tier.name}</span>
                <span className="text-xs font-bold text-white">
                  {motherlodePots && Array.isArray(motherlodePots)
                    ? `${formatEther(motherlodePots[index] as bigint).slice(0, 4)}`
                    : '0'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Game Interface */}
      <div className="relative rounded-3xl border border-white/10 bg-black/40 backdrop-blur-xl overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-500/10 border border-orange-500/20">
              <Pickaxe className="w-6 h-6 text-orange-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Mining Terminal</h2>
              <p className="text-xs text-white/40 font-mono">ROUND #{displayRoundInfo.id.toString()}</p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="text-right">
              <div className="text-[10px] text-white/40 uppercase tracking-wider">Time Remaining</div>
              <div className="text-xl font-bold font-mono text-red-400 tabular-nums">
                {formatTimeRemaining(BigInt(localTimeRemaining))}
              </div>
            </div>
            <div className="w-px h-10 bg-white/10" />
            <div className="text-right">
              <div className="text-[10px] text-white/40 uppercase tracking-wider">Current Pot</div>
              <div className="text-xl font-bold font-mono text-green-400 tabular-nums">
                {formatEther(displayRoundInfo.totalDeployed).slice(0, 6)} <span className="text-sm text-white/40">ETH</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 md:p-8">
          {/* Game Grid */}
          <div className="grid grid-cols-5 gap-2 md:gap-3 mb-8">
            {Array.from({ length: NUM_SQUARES }, (_, i) => {
              const isEven = i % 2 === 0;
              const isSelected = selectedSquares.includes(i);

              // Get square data
              const squareDeployed = displayRoundInfo && Array.isArray((displayRoundInfo as any).deployed)
                ? (displayRoundInfo as any).deployed[i]
                : 0n;
              const squareMinerCount = displayRoundInfo && Array.isArray((displayRoundInfo as any).minerCount)
                ? (displayRoundInfo as any).minerCount[i]
                : 0n;

              const ethAmount = squareDeployed ? formatEther(squareDeployed as bigint).slice(0, 6) : '0';
              const playerCount = squareMinerCount ? Number(squareMinerCount) : 0;

              return (
                <motion.button
                  key={i}
                  onClick={() => toggleSquare(i)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`
                    relative aspect-square rounded-xl border transition-all duration-300 flex flex-col items-center justify-center
                    ${isSelected
                      ? isEven
                        ? 'bg-blue-500/20 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)]'
                        : 'bg-orange-500/20 border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.3)]'
                      : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                    }
                  `}
                >
                  <span className={`text-lg md:text-2xl font-bold ${isSelected ? 'text-white' : 'text-white/40'}`}>
                    {i}
                  </span>
                  {playerCount > 0 && (
                    <div className="absolute bottom-1 md:bottom-2 left-0 right-0 text-center">
                      <div className="text-[8px] md:text-[10px] font-mono text-white/60">{ethAmount}Ξ</div>
                    </div>
                  )}
                  {isSelected && (
                    <div className={`absolute inset-0 rounded-xl border-2 opacity-50 ${isEven ? 'border-blue-400' : 'border-orange-400'}`} />
                  )}
                </motion.button>
              );
            })}
          </div>

          {/* Controls */}
          <div className="flex flex-col gap-6">
            {/* Selection Tools */}
            <div className="flex flex-wrap justify-center gap-2">
              {['All', 'Even', 'Odd', 'Clear'].map((action) => (
                <button
                  key={action}
                  onClick={() => {
                    if (action === 'All') selectAllSquares();
                    if (action === 'Even') selectEvenSquares();
                    if (action === 'Odd') selectOddSquares();
                    if (action === 'Clear') clearAllSquares();
                  }}
                  className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-xs font-bold text-white/60 hover:text-white hover:bg-white/10 transition-all uppercase tracking-wider"
                >
                  {action}
                </button>
              ))}
            </div>

            {/* Input Area */}
            <div className="bg-black/20 rounded-xl p-4 border border-white/5">
              <div className="flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1 w-full">
                  <div className="flex justify-between text-xs text-white/40 mb-2">
                    <span>AMOUNT PER SQUARE (ETH)</span>
                    <span>BAL: {ethBalance ? parseFloat(formatEther(ethBalance.value)).toFixed(4) : '0.00'}</span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      placeholder="0.01"
                      value={amountPerSquare && selectedSquares.length > 0
                        ? (parseFloat(amountPerSquare) * selectedSquares.length).toFixed(6)
                        : ''}
                      onChange={(e) => {
                        if (selectedSquares.length > 0) {
                          const totalAmount = parseFloat(e.target.value);
                          if (!isNaN(totalAmount)) {
                            setAmountPerSquare((totalAmount / selectedSquares.length).toFixed(8));
                          }
                        }
                      }}
                      className="w-full bg-transparent border-b border-white/20 py-2 text-2xl font-light text-white focus:outline-none focus:border-orange-500 transition-colors placeholder-white/10"
                    />
                    <div className="absolute right-0 bottom-2 flex gap-2">
                      {[0.001, 0.01, 0.1, 1].map((val) => (
                        <button
                          key={val}
                          onClick={() => {
                            if (selectedSquares.length > 0) {
                              setAmountPerSquare((val / selectedSquares.length).toFixed(8));
                            }
                          }}
                          className="px-2 py-1 rounded bg-white/5 text-[10px] font-bold text-white/40 hover:text-white hover:bg-white/10 transition-all"
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
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

            {/* Feedback Messages */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2"
                >
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </motion.div>
              )}
              {success && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {success}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}