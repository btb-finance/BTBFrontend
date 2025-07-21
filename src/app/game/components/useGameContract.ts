import { useState, useEffect } from 'react';
import { useWallet } from '@/app/context/WalletContext';
import gameService from '../services/gameService';

export default function useGameContract() {
  const { isConnected } = useWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize service when wallet connects
  useEffect(() => {
    if (isConnected) {
      gameService.connect().catch(err => {
        console.error('Failed to connect game service:', err);
        setError(err.message);
      });
    } else {
      gameService.disconnect();
    }
  }, [isConnected]);

  const executeTransaction = async (
    operation: () => Promise<any>,
    successMessage?: string
  ) => {
    if (!isConnected) {
      throw new Error('Wallet not connected');
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await operation();
      if (successMessage) {
        console.log(successMessage);
      }
      return result;
    } catch (err: any) {
      const errorMessage = err.message || 'Transaction failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Game operations
  const depositBears = async (bearIds: number[]) => {
    return executeTransaction(
      () => gameService.depositBears(bearIds),
      `Successfully deposited ${bearIds.length} Bear NFT(s)`
    );
  };

  const feedHunters = async (hunterIds: number[]) => {
    return executeTransaction(
      () => gameService.feedHunters(hunterIds),
      `Successfully fed ${hunterIds.length} Hunter(s)`
    );
  };

  const hunt = async (hunterIds: number[], targets: string[] = []) => {
    return executeTransaction(
      () => gameService.hunt(hunterIds, targets),
      `Successfully hunted with ${hunterIds.length} Hunter(s)`
    );
  };

  const redeemBears = async (count: number, hunterIds: number[]) => {
    return executeTransaction(
      () => gameService.redeemBears(count, hunterIds),
      `Successfully redeemed ${count} Bear NFT(s) using ${hunterIds.length} Hunter(s)`
    );
  };

  const swapBTBForNFT = async (amount: number) => {
    return executeTransaction(
      () => gameService.swapBTBForNFT(amount),
      `Successfully swapped ${amount} BTB for NFT(s)`
    );
  };

  const swapNFTForBTB = async (tokenIds: number[]) => {
    return executeTransaction(
      () => gameService.swapNFTForBTB(tokenIds),
      `Successfully swapped ${tokenIds.length} NFT(s) for BTB`
    );
  };

  // Read operations
  const getHunterStats = async (tokenId: number) => {
    try {
      return await gameService.getHunterStats(tokenId);
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const getUserHunters = async () => {
    try {
      return await gameService.getUserHunters();
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const getUserBears = async () => {
    try {
      return await gameService.getUserBears();
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const getBalances = async () => {
    try {
      const [mimoBalance, btbBalance, bearBalance, hunterBalance] = await Promise.all([
        gameService.getMiMoBalance(),
        gameService.getBTBBalance(),
        gameService.getBearNFTBalance(),
        gameService.getHunterNFTBalance()
      ]);

      return {
        mimoBalance,
        btbBalance,
        bearNFTBalance: bearBalance,
        hunterNFTBalance: hunterBalance
      };
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const getSwapRate = async () => {
    try {
      return await gameService.getSwapRate();
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const clearError = () => setError(null);

  return {
    // State
    isLoading,
    error,
    
    // Actions
    depositBears,
    feedHunters,
    hunt,
    redeemBears,
    swapBTBForNFT,
    swapNFTForBTB,
    
    // Read operations
    getHunterStats,
    getUserHunters,
    getUserBears,
    getBalances,
    getSwapRate,
    
    // Utilities
    clearError,
    gameService
  };
}