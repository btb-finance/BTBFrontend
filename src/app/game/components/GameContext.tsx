'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useWallet } from '@/app/context/WalletContext';
import gameService from '../services/gameService';

interface GameContextType {
  gameStats: {
    mimoBalance: string;
    bearNFTBalance: string;
    hunterNFTBalance: string;
    btbBalance: string;
    totalHunted: string;
    swapRate: string;
  };
  hunterTokens: any[];
  bearTokens: any[];
  isLoading: boolean;
  refreshData: () => Promise<void>;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const useGame = () => {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};

interface GameProviderProps {
  children: ReactNode;
}

export default function GameProvider({ children }: GameProviderProps) {
  const { isConnected } = useWallet();
  const [gameStats, setGameStats] = useState({
    mimoBalance: '0',
    bearNFTBalance: '0',
    hunterNFTBalance: '0',
    btbBalance: '0',
    totalHunted: '0',
    swapRate: '0'
  });
  const [hunterTokens, setHunterTokens] = useState<any[]>([]);
  const [bearTokens, setBearTokens] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refreshData = async () => {
    try {
      setIsLoading(true);
      
      // Always fetch swap rate regardless of connection status
      const swapRate = await gameService.getSwapRate();
      
      if (isConnected) {
        // Get user balances
        const [mimoBalance, bearBalance, hunterBalance, btbBalance] = await Promise.all([
          gameService.getMiMoBalance(),
          gameService.getBearNFTBalance(),
          gameService.getHunterNFTBalance(),
          gameService.getBTBBalance()
        ]);

        // Get user's Hunter NFTs with stats
        const hunters = await gameService.getUserHunters();
        
        // Get user's Bear NFTs
        const bears = await gameService.getUserBears();
        
        setGameStats({
          mimoBalance,
          bearNFTBalance: bearBalance,
          hunterNFTBalance: hunterBalance,
          btbBalance,
          totalHunted: hunters.reduce((total: number, hunter: any) => total + parseFloat(hunter.totalHunted || '0'), 0).toString(),
          swapRate
        });
        
        setHunterTokens(hunters);
        setBearTokens(bears);
      } else {
        setGameStats(prev => ({
          ...prev,
          swapRate
        }));
        setHunterTokens([]);
        setBearTokens([]);
      }
    } catch (error) {
      console.error('Error fetching game data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
    
    // Set up interval to refresh data every 30 seconds
    const interval = setInterval(refreshData, 30000);
    
    return () => clearInterval(interval);
  }, [isConnected]);

  const value: GameContextType = {
    gameStats,
    hunterTokens,
    bearTokens,
    isLoading,
    refreshData
  };

  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  );
}