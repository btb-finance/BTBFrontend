'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ethers } from 'ethers';
import { useWalletConnection } from '../../hooks/useWalletConnection';
import gameAbi from '../gameabi.json';

// Contract addresses
const GAME_CONTRACT_ADDRESS = '0xA44906a6c5A0fC974a73C76F6E8B8a5C066413B7';
const BEAR_NFT_ADDRESS = '0x4AF11c8ea29039b9F169DBB08Bf6B794EB45BB7a';

// Types
export type Hunter = {
  id: number;
  creationTime: number;
  lastFeedTime: number;
  lastHuntTime: number;
  power: string;
  missedFeedings: number;
  inHibernation: boolean;
  recoveryStartTime: number;
  totalHunted: string;
  daysRemaining: number;
  canHuntNow?: boolean;
  huntReason?: string;
};

export type GameContextType = {
  // Contract state
  loading: boolean;
  hunters: Hunter[];
  mimoBalance: string;
  isAddressProtected: boolean;
  gameContract: ethers.Contract | null;
  
  // Contract interactions
  depositBear: (bearId: number) => Promise<void>;
  feedHunter: (hunterId: number) => Promise<void>;
  hunt: (hunterId: number) => Promise<void>;
  setAddressProtection: (status: boolean) => Promise<void>;
  redeemBear: () => Promise<any>;
  getRedemptionRequirements: () => Promise<{
    amount: string;
    fee: string;
    paused: boolean;
  }>;
  
  // UI state
  refreshData: () => Promise<void>;
  error: string | null;
  clearError: () => void;
};

// Create the context with default values
const GameContext = createContext<GameContextType>({
  loading: true,
  hunters: [],
  mimoBalance: '0',
  isAddressProtected: false,
  gameContract: null,
  
  depositBear: async () => {},
  feedHunter: async () => {},
  hunt: async () => {},
  setAddressProtection: async () => {},
  redeemBear: async () => { return null; },
  getRedemptionRequirements: async () => ({ amount: '0', fee: '0', paused: true }),
  
  refreshData: async () => {},
  error: null,
  clearError: () => {},
});

// Provider component
export function GameProvider({ children }: { children: ReactNode }) {
  const { provider, address } = useWalletConnection();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hunters, setHunters] = useState<Hunter[]>([]);
  const [mimoBalance, setMimoBalance] = useState('0');
  const [isAddressProtected, setIsAddressProtected] = useState(false);
  const [gameContract, setGameContract] = useState<ethers.Contract | null>(null);

  // Initialize contract when provider is available
  useEffect(() => {
    console.log("Provider/address state:", { provider: !!provider, address });
    if (!address) {
      console.log("Missing address, can't initialize contract");
      return;
    }
    
    // Force provider initialization if needed
    const initializeContract = async () => {
      try {
        if (!provider && window.ethereum) {
          console.log("Using window.ethereum as provider");
          const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
          const signer = web3Provider.getSigner();
          console.log("Created ethers provider and signer");
          
          console.log("Initializing game contract with address:", GAME_CONTRACT_ADDRESS);
          const contract = new ethers.Contract(GAME_CONTRACT_ADDRESS, gameAbi, signer);
          setGameContract(contract);
          console.log("Game contract initialized successfully with window.ethereum");
        } else if (provider) {
          console.log("Using existing provider");
          const signer = provider.getSigner();
          console.log("Initializing game contract with address:", GAME_CONTRACT_ADDRESS);
          const contract = new ethers.Contract(GAME_CONTRACT_ADDRESS, gameAbi, signer);
          setGameContract(contract);
          console.log("Game contract initialized successfully");
        } else {
          console.error("No provider available");
          setError('No Web3 provider available. Please connect your wallet.');
          return;
        }
      } catch (error) {
        console.error('Failed to initialize game contract:', error);
        setError('Failed to connect to game contract');
      }
    };
    
    initializeContract();
  }, [provider, address]);

  // Load data when contract and address are available
  useEffect(() => {
    console.log("Contract/address state for data loading:", { 
      hasContract: !!gameContract, 
      address 
    });
    
    if (gameContract && address) {
      console.log("Contract and address available, refreshing data");
      refreshData();
    }
  }, [gameContract, address]);

  // Function to refresh all data
  const refreshData = async () => {
    if (!gameContract || !address) {
      console.log("Cannot refresh data - missing contract or address");
      return;
    }
    
    setLoading(true);
    console.log("Starting data refresh for address:", address);
    
    try {
      // Get MiMo balance
      console.log("Fetching MiMo balance...");
      try {
        const balance = await gameContract.mimoBalanceOf(address);
        console.log("MiMo balance:", balance.toString());
        setMimoBalance(ethers.utils.formatUnits(balance, 18));
      } catch (err) {
        console.error("Error fetching MiMo balance:", err);
      }
      
      // Check if address is protected
      console.log("Checking if address is protected...");
      try {
        const isProtected = await gameContract.isAddressProtected(address);
        console.log("Address protected:", isProtected);
        setIsAddressProtected(isProtected);
      } catch (err) {
        console.error("Error checking address protection:", err);
      }
      
      // Get hunter NFTs owned by user
      console.log("Fetching hunter NFTs...");
      try {
        const hunterCount = await gameContract.balanceOf(address);
        console.log("Hunter count:", hunterCount.toString());
        const hunterIds = [];
        
        for (let i = 0; i < hunterCount.toNumber(); i++) {
          const tokenId = await gameContract.tokenOfOwnerByIndex(address, i);
          hunterIds.push(tokenId.toNumber());
        }
        
        console.log("Hunter IDs:", hunterIds);
        
        // Get details for each hunter
        const huntersData = await Promise.all(
          hunterIds.map(async (id) => {
            console.log(`Fetching details for hunter #${id}`);
            const stats = await gameContract.getHunterStats(id);
            const [canHunt, reason] = await gameContract.canHunt(id);
            
            return {
              id,
              creationTime: stats.creationTime.toNumber(),
              lastFeedTime: stats.lastFeedTime.toNumber(),
              lastHuntTime: stats.lastHuntTime.toNumber(),
              power: ethers.utils.formatUnits(stats.power, 18),
              missedFeedings: stats.missedFeedings.toNumber(),
              inHibernation: stats.inHibernation,
              recoveryStartTime: stats.recoveryStartTime.toNumber(),
              totalHunted: ethers.utils.formatUnits(stats.totalHunted, 18),
              daysRemaining: stats.daysRemaining.toNumber(),
              canHuntNow: canHunt,
              huntReason: reason,
            };
          })
        );
        
        console.log("Hunter data loaded:", huntersData);
        setHunters(huntersData);
      } catch (err) {
        console.error("Error fetching hunter data:", err);
      }
      
      setLoading(false);
      console.log("Data refresh complete");
    } catch (error) {
      console.error('Error fetching game data:', error);
      setError('Failed to load game data');
      setLoading(false);
    }
  };

  // Contract interaction methods
  const depositBear = async (bearId: number) => {
    console.log("Attempting to deposit BEAR NFT:", bearId);
    
    if (!gameContract) {
      const errorMsg = 'Game contract not initialized';
      console.error(errorMsg);
      setError(errorMsg);
      return;
    }
    
    try {
      console.log("Setting up BEAR NFT contract...");
      // First approve the game contract to transfer the BEAR NFT
      let signer;
      if (provider) {
        signer = provider.getSigner();
      } else if (window.ethereum) {
        const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
        signer = web3Provider.getSigner();
      } else {
        throw new Error("No provider available to create signer");
      }
      
      const bearContract = new ethers.Contract(
        BEAR_NFT_ADDRESS,
        [
          'function approve(address to, uint256 tokenId) public',
          'function getApproved(uint256 tokenId) view returns (address)',
          'function ownerOf(uint256 tokenId) view returns (address)'
        ],
        signer
      );
      
      // Check if we own the NFT
      console.log("Checking ownership of BEAR NFT:", bearId);
      const ownerAddress = await bearContract.ownerOf(bearId);
      const signerAddress = await signer.getAddress();
      
      console.log("Owner:", ownerAddress);
      console.log("Signer:", signerAddress);
      
      if (ownerAddress.toLowerCase() !== signerAddress.toLowerCase()) {
        throw new Error(`You don't own BEAR NFT #${bearId}`);
      }
      
      // Approve the game contract
      console.log("Approving BEAR NFT transfer to:", GAME_CONTRACT_ADDRESS);
      const approveTx = await bearContract.approve(GAME_CONTRACT_ADDRESS, bearId);
      console.log("Approval transaction:", approveTx.hash);
      const approveReceipt = await approveTx.wait();
      console.log("Approval confirmed in block:", approveReceipt.blockNumber);
      
      // Verify approval
      const approved = await bearContract.getApproved(bearId);
      console.log("Approved address:", approved);
      if (approved.toLowerCase() !== GAME_CONTRACT_ADDRESS.toLowerCase()) {
        throw new Error("Approval did not succeed. Try again.");
      }
      
      // Then deposit the BEAR NFT
      console.log("Depositing BEAR NFT...");
      const tx = await gameContract.depositBear(bearId);
      console.log("Deposit transaction:", tx.hash);
      const receipt = await tx.wait();
      console.log("Deposit confirmed in block:", receipt.blockNumber);
      
      // Refresh data after transaction
      await refreshData();
      
      console.log("BEAR NFT deposit successful!");
    } catch (error: any) {
      console.error('Error depositing BEAR NFT:', error);
      setError(error.message || 'Failed to deposit BEAR NFT');
      throw error; // Re-throw so the component can handle it
    }
  };

  const feedHunter = async (hunterId: number) => {
    if (!gameContract) {
      setError('Game contract not initialized');
      return;
    }
    
    try {
      const tx = await gameContract.feedHunter(hunterId);
      await tx.wait();
      
      await refreshData();
    } catch (error: any) {
      console.error('Error feeding hunter:', error);
      setError(error.message || 'Failed to feed hunter');
    }
  };

  const hunt = async (hunterId: number) => {
    if (!gameContract) {
      setError('Game contract not initialized');
      return;
    }
    
    try {
      const tx = await gameContract.hunt(hunterId);
      await tx.wait();
      
      await refreshData();
    } catch (error: any) {
      console.error('Error hunting:', error);
      setError(error.message || 'Failed to hunt');
    }
  };

  const setAddressProtection = async (status: boolean) => {
    if (!gameContract) {
      setError('Game contract not initialized');
      return;
    }
    
    try {
      // Only contract owner can set address protection
      // This is for checking status only, actual protection is set by contract owner or through liquidity provision
      setIsAddressProtected(status);
    } catch (error: any) {
      console.error('Error setting protection:', error);
      setError(error.message || 'Failed to set protection status');
    }
  };

  const clearError = () => setError(null);

  // Redeem BEAR NFT (spend MiMo tokens to get a BEAR)
  const redeemBear = async () => {
    if (!gameContract) {
      setError('Game contract not initialized');
      return;
    }
    
    try {
      console.log("Attempting to redeem a BEAR NFT...");
      const tx = await gameContract.redeemBear();
      console.log("Redemption transaction:", tx.hash);
      const receipt = await tx.wait();
      console.log("Redemption confirmed in block:", receipt.blockNumber);
      
      // Refresh data after transaction
      await refreshData();
      
      console.log("BEAR NFT redemption successful!");
      return receipt;
    } catch (error: any) {
      console.error('Error redeeming BEAR NFT:', error);
      setError(error.message || 'Failed to redeem BEAR NFT');
      throw error;
    }
  };

  // Get redemption requirements
  const getRedemptionRequirements = async () => {
    if (!gameContract) {
      setError('Game contract not initialized');
      return { amount: '0', paused: true };
    }
    
    try {
      const mimoAmount = await gameContract.REDEMPTION_MIMO_AMOUNT();
      const isPaused = await gameContract.redemptionPaused();
      const feePercentage = await gameContract.REDEMPTION_FEE_PERCENTAGE();
      
      return {
        amount: ethers.utils.formatUnits(mimoAmount, 18),
        fee: feePercentage.toString(),
        paused: isPaused
      };
    } catch (error: any) {
      console.error('Error getting redemption requirements:', error);
      return { amount: '0', fee: '0', paused: true };
    }
  };

  // Context value
  const value = {
    loading,
    hunters,
    mimoBalance,
    isAddressProtected,
    gameContract,
    
    depositBear,
    feedHunter,
    hunt,
    setAddressProtection,
    redeemBear,
    getRedemptionRequirements,
    
    refreshData,
    error,
    clearError,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

// Custom hook to use the game context
export function useGame() {
  return useContext(GameContext);
}