'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ethers } from 'ethers';
import { useWalletConnection } from '../../hooks/useWalletConnection';
import BearHunterEcosystemABI from '../BearHunterEcosystemabi.json';
import BTBSwapLogicABI from '../BTBSwapLogicabi.json';
import MiMoGaMeABI from '../MiMoGaMeabi.json';

// Contract addresses
const BEAR_HUNTER_ECOSYSTEM_ADDRESS = '0xD4feebBB3bcAD99237A3A6b495088D6d0CA78115';
const BEAR_NFT_ADDRESS = '0xFDF941c77E6Dd3eA4a714B26F91F09824C589404';
const BTB_TOKEN_ADDRESS = '0xE7997Bc2d74B407d2A21fDaEf0fD44824876Ef70';
const MIMO_TOKEN_ADDRESS = '0xD2bfAAD896F70ef217a478b0908a7Ce6A65523C4';
const BTB_SWAP_LOGIC_ADDRESS = '0xe49e40c262A8BbCb4207427bFEb7F28d71960f6F';

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
  btbSwapContract: ethers.Contract | null;
  mimoToken: ethers.Contract | null;
  
  // Contract interactions
  depositBear: (bearId: number) => Promise<void>;
  feedHunter: (hunterId: number) => Promise<void>;
  hunt: (hunterId: number, target?: string) => Promise<void>;
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
  btbSwapContract: null,
  mimoToken: null,
  
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
  const [btbSwapContract, setBtbSwapContract] = useState<ethers.Contract | null>(null);
  const [mimoToken, setMimoToken] = useState<ethers.Contract | null>(null);

  // Initialize contracts when provider is available
  useEffect(() => {
    console.log("Provider/address state:", { provider: !!provider, address });
    if (!address) {
      console.log("Missing address, can't initialize contracts");
      return;
    }
    
    // Force provider initialization if needed
    const initializeContracts = async () => {
      try {
        let signer;
        if (provider) {
          console.log("Using existing provider");
          signer = provider.getSigner();
        } else if (window.ethereum) {
          console.log("Using window.ethereum as provider");
          const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
          signer = web3Provider.getSigner();
          console.log("Created ethers provider and signer");
        } else {
          console.error("No provider available");
          setError('No Web3 provider available. Please connect your wallet.');
          return;
        }
        
        // Initialize Bear Hunter Ecosystem contract
        console.log("Initializing Bear Hunter Ecosystem contract with address:", BEAR_HUNTER_ECOSYSTEM_ADDRESS);
        const bearHunterContract = new ethers.Contract(BEAR_HUNTER_ECOSYSTEM_ADDRESS, BearHunterEcosystemABI, signer);
        setGameContract(bearHunterContract);
        
        // Initialize BTB Swap Logic contract
        console.log("Initializing BTB Swap Logic contract with address:", BTB_SWAP_LOGIC_ADDRESS);
        const btbSwapLogicContract = new ethers.Contract(BTB_SWAP_LOGIC_ADDRESS, BTBSwapLogicABI, signer);
        setBtbSwapContract(btbSwapLogicContract);
        
        // Initialize MiMo Token contract
        console.log("Initializing MiMo Token contract with address:", MIMO_TOKEN_ADDRESS);
        const mimoTokenContract = new ethers.Contract(MIMO_TOKEN_ADDRESS, MiMoGaMeABI, signer);
        setMimoToken(mimoTokenContract);
        
        console.log("All contracts initialized successfully");
      } catch (error) {
        console.error('Failed to initialize contracts:', error);
        setError('Failed to connect to game contracts');
      }
    };
    
    initializeContracts();
  }, [provider, address]);

  // Load data when contract and address are available
  useEffect(() => {
    console.log("Contract/address state for data loading:", { 
      hasGameContract: !!gameContract,
      hasBtbSwapContract: !!btbSwapContract,
      hasMimoToken: !!mimoToken,
      address 
    });
    
    if (gameContract && address) {
      console.log("Game contract and address available, refreshing data");
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
      // Get contract constants
      console.log("Fetching contract constants...");
      let huntCooldown, feedCooldown, recoveryPeriod, lifespan;
      try {
        huntCooldown = await gameContract.HUNT_COOLDOWN();
        feedCooldown = await gameContract.RECOVERY_PERIOD();
        recoveryPeriod = await gameContract.RECOVERY_PERIOD();
        lifespan = await gameContract.LIFESPAN();
        
        console.log("Contract constants:");
        console.log("- HUNT_COOLDOWN:", huntCooldown.toString());
        console.log("- RECOVERY_PERIOD:", recoveryPeriod.toString());
        console.log("- LIFESPAN:", lifespan.toString());
      } catch (err) {
        console.error("Error fetching contract constants:", err);
      }
      
      // Get MiMo balance
      console.log("Fetching MiMo balance...");
      try {
        if (mimoToken) {
          const balance = await mimoToken.balanceOf(address);
          console.log("MiMo balance:", balance.toString());
          setMimoBalance(ethers.utils.formatUnits(balance, 18));
        } else {
          console.log("MiMo token contract not initialized, checking game contract");
          const balance = await gameContract.balanceOf(address);
          console.log("MiMo balance from game contract:", balance.toString());
          setMimoBalance(ethers.utils.formatUnits(balance, 18));
        }
      } catch (err) {
        console.error("Error fetching MiMo balance:", err);
      }
      
      // Check if address is protected
      console.log("Checking if address is protected...");
      try {
        const isProtected = await gameContract.protectedAddresses(address);
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
              missedFeedings: stats.missedFeedings,
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
      console.log("Approving BEAR NFT transfer to:", BEAR_HUNTER_ECOSYSTEM_ADDRESS);
      const approveTx = await bearContract.approve(BEAR_HUNTER_ECOSYSTEM_ADDRESS, bearId);
      console.log("Approval transaction:", approveTx.hash);
      const approveReceipt = await approveTx.wait();
      console.log("Approval confirmed in block:", approveReceipt.blockNumber);
      
      // Verify approval
      const approved = await bearContract.getApproved(bearId);
      console.log("Approved address:", approved);
      if (approved.toLowerCase() !== BEAR_HUNTER_ECOSYSTEM_ADDRESS.toLowerCase()) {
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
      console.log(`Feeding hunter #${hunterId}...`);
      const tx = await gameContract.feedHunter(hunterId);
      console.log("Feed transaction:", tx.hash);
      const receipt = await tx.wait();
      console.log("Feed confirmed in block:", receipt.blockNumber);
      
      await refreshData();
    } catch (error: any) {
      console.error('Error feeding hunter:', error);
      setError(error.message || 'Failed to feed hunter');
    }
  };

  const hunt = async (hunterId: number, target?: string) => {
    if (!gameContract) {
      setError('Game contract not initialized');
      return;
    }
    
    try {
      // Make sure we have a target address - default to self if not provided
      const targetAddress = target || address;
      
      console.log(`Hunter #${hunterId} hunting target: ${targetAddress}`);
      console.log(`Parameters: tokenId=${hunterId}, target=${targetAddress}`);
      
      // Call hunt function with both required parameters:
      // 1. tokenId (uint256): The hunter NFT ID
      // 2. target (address): The address to hunt from
      const tx = await gameContract.hunt(hunterId, targetAddress);
      console.log("Hunt transaction:", tx.hash);
      const receipt = await tx.wait();
      console.log("Hunt confirmed in block:", receipt.blockNumber);
      
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
      // This is for checking status only, actual protection is set by contract owner or through liquidity provision
      console.log(`Address protection status is currently: ${isAddressProtected}`);
      console.log("(Note: Only the contract owner can actually change the protected status)");
      
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
      return { amount: '0', paused: true, fee: '0' };
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
    btbSwapContract,
    mimoToken,
    
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