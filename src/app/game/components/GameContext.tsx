'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ethers } from 'ethers';
import { useWalletConnection } from '../../hooks/useWalletConnection';
import BearHunterEcosystemABI from '../abi/BearHunterEcosystem.json';
import MiMoGaMeABI from '../abi/MiMoGaMe.json';
import { 
  ECOSYSTEM_ADDRESS,
  BEAR_NFT_ADDRESS,
  BTB_TOKEN_ADDRESS,
  MIMO_TOKEN_ADDRESS,
  BTB_SWAP_LOGIC_ADDRESS 
} from '../addresses';

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
  
  // Hunter selection state
  selectedHunters: number[];
  
  // Contract interactions
  depositBear: (bearId: number | number[]) => Promise<void>;
  feedHunter: (hunterId: number) => Promise<void>;
  feedMultipleHunters: (hunterIds: number[]) => Promise<void>;
  hunt: (hunterId: number, target?: string) => Promise<void>;
  huntMultiple: (hunterIds: number[], target: string) => Promise<void>;
  huntMultipleTargets: (hunterId: number, targets: string[]) => Promise<void>;
  setAddressProtection: (status: boolean) => Promise<void>;
  redeemBear: (count?: number) => Promise<any>;
  getRedemptionRequirements: () => Promise<{
    amount: string;
    fee: string;
    paused: boolean;
  }>;
  
  // UI state
  refreshData: () => Promise<void>;
  error: string | null;
  clearError: () => void;
  clearSelectedHunters: () => void;
  toggleHunterSelection: (hunterId: number) => void;
  selectAllHunters: () => void;
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
  selectedHunters: [],
  
  depositBear: async () => {},
  feedHunter: async () => {},
  feedMultipleHunters: async () => {},
  hunt: async () => {},
  huntMultiple: async () => {},
  huntMultipleTargets: async () => {},
  setAddressProtection: async () => {},
  redeemBear: async () => { return null; },
  getRedemptionRequirements: async () => ({ amount: '0', fee: '0', paused: true }),
  
  refreshData: async () => {},
  error: null,
  clearError: () => {},
  clearSelectedHunters: () => {},
  toggleHunterSelection: () => {},
  selectAllHunters: () => {},
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
  const [selectedHunters, setSelectedHunters] = useState<number[]>([]);

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
        console.log("Initializing Bear Hunter Ecosystem contract with address:", ECOSYSTEM_ADDRESS);
        const bearHunterContract = new ethers.Contract(ECOSYSTEM_ADDRESS, BearHunterEcosystemABI, signer);
        setGameContract(bearHunterContract);
        
        // Initialize BTB Swap Logic contract - using same ABI as the main contract since it contains the swap functions
        console.log("Initializing BTB Swap Logic contract with address:", BTB_SWAP_LOGIC_ADDRESS);
        const btbSwapLogicContract = new ethers.Contract(BTB_SWAP_LOGIC_ADDRESS, BearHunterEcosystemABI, signer);
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
  const depositBear = async (bearIdOrIds: number | number[]) => {
    const isBatch = Array.isArray(bearIdOrIds);
    const bearIds = isBatch ? bearIdOrIds : [bearIdOrIds];
    
    console.log(`Attempting to deposit BEAR NFT${isBatch ? 's' : ''}:`, bearIds);
    
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
      
      // We'll use the bearId directly from the parameter for single deposits
      const bearId = isBatch ? bearIds[0] : bearIdOrIds as number;
      
      // If it's a batch operation and using setApprovalForAll, we assume it's already been called
      // by the DepositBear component. Otherwise, we need to approve individually.
      if (!isBatch) {
        const bearContract = new ethers.Contract(
          BEAR_NFT_ADDRESS,
          [
            'function approve(address to, uint256 tokenId) public',
            'function getApproved(uint256 tokenId) view returns (address)',
            'function ownerOf(uint256 tokenId) view returns (address)',
            'function isApprovedForAll(address owner, address operator) view returns (bool)'
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
        
        // Check if we already have approval for all
        const isApprovedForAll = await bearContract.isApprovedForAll(signerAddress, ECOSYSTEM_ADDRESS);
        if (isApprovedForAll) {
          console.log("Already have approval for all tokens, skipping individual approval");
        } else {
          // Check if this specific NFT is already approved
          const currentApproval = await bearContract.getApproved(bearId);
          if (currentApproval.toLowerCase() === ECOSYSTEM_ADDRESS.toLowerCase()) {
            console.log("This NFT is already approved, skipping approval");
          } else {
            // Approve the game contract for this specific NFT
            console.log("Approving BEAR NFT transfer to:", ECOSYSTEM_ADDRESS);
            const approveTx = await bearContract.approve(ECOSYSTEM_ADDRESS, bearId);
            console.log("Approval transaction:", approveTx.hash);
            const approveReceipt = await approveTx.wait();
            console.log("Approval confirmed in block:", approveReceipt.blockNumber);
            
            // Verify approval
            const approved = await bearContract.getApproved(bearId);
            console.log("Approved address:", approved);
            if (approved.toLowerCase() !== ECOSYSTEM_ADDRESS.toLowerCase()) {
              throw new Error("Approval did not succeed. Try again.");
            }
          }
        }
      }
      
      // Use the new depositBears function that takes an array (works for both single and batch)
      console.log(`Depositing ${bearIds.length} BEAR NFT${bearIds.length > 1 ? 's' : ''} using depositBears function...`);
      const tx = await gameContract.depositBears(bearIds);
      console.log("Deposit transaction:", tx.hash);
      const receipt = await tx.wait();
      console.log(`Deposit confirmed in block:`, receipt.blockNumber);
      
      // Refresh data after transaction
      await refreshData();
      
      console.log(`BEAR NFT${isBatch ? 's' : ''} deposit successful!`);
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
      console.log(`Feeding hunter #${hunterId} using feedHunters function...`);
      // Use the new feedHunters function that takes an array (even for single hunter)
      const tx = await gameContract.feedHunters([hunterId]);
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
      
      console.log(`Hunter #${hunterId} hunting target: ${targetAddress} using new hunt function...`);
      console.log(`Parameters: tokenIds=[${hunterId}], targets=[${targetAddress}]`);
      
      // Call hunt function with new signature:
      // 1. tokenIds (uint256[]): Array of hunter NFT IDs
      // 2. targets (address[]): Array of target addresses
      const tx = await gameContract.hunt([hunterId], [targetAddress]);
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
  const redeemBear = async (count: number = 1) => {
    if (!gameContract) {
      setError('Game contract not initialized');
      return;
    }
    
    try {
      console.log(`Attempting to redeem ${count} BEAR NFT${count > 1 ? 's' : ''} using redeemBears function...`);
      const tx = await gameContract.redeemBears(count);
      console.log("Redemption transaction:", tx.hash);
      const receipt = await tx.wait();
      console.log("Redemption confirmed in block:", receipt.blockNumber);
      
      // Refresh data after transaction
      await refreshData();
      
      console.log(`BEAR NFT${count > 1 ? 's' : ''} redemption successful!`);
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

  const clearSelectedHunters = () => {
    setSelectedHunters([]);
  };

  const toggleHunterSelection = (hunterId: number) => {
    setSelectedHunters(prev => {
      if (prev.includes(hunterId)) {
        return prev.filter(id => id !== hunterId);
      } else {
        return [...prev, hunterId];
      }
    });
  };

  const selectAllHunters = () => {
    const allHunterIds = hunters.map(hunter => hunter.id);
    setSelectedHunters(allHunterIds);
  };

  const feedMultipleHunters = async (hunterIds: number[]) => {
    if (!gameContract) {
      setError('Game contract not initialized');
      return;
    }
    
    try {
      console.log(`Feeding ${hunterIds.length} hunters using feedHunters function:`, hunterIds);
      
      // Use the new feedHunters function from the ABI
      const tx = await gameContract.feedHunters(hunterIds);
      console.log("Multiple feed transaction:", tx.hash);
      const receipt = await tx.wait();
      console.log("Multiple feed confirmed in block:", receipt.blockNumber);
      
      await refreshData();
    } catch (error: any) {
      console.error('Error feeding multiple hunters:', error);
      setError(error.message || 'Failed to feed multiple hunters');
      throw error;
    }
  };

  const huntMultiple = async (hunterIds: number[], target: string) => {
    if (!gameContract) {
      setError('Game contract not initialized');
      return;
    }
    
    try {
      console.log(`Bulk hunting with ${hunterIds.length} hunters targeting: ${target} using new hunt function`);
      
      // Create arrays of same length with the same target for each hunter
      const targets = Array(hunterIds.length).fill(target);
      
      console.log(`Parameters: tokenIds=[${hunterIds.join(', ')}], targets=[${targets.join(', ')}]`);
      
      // Use the new hunt function that accepts arrays
      const tx = await gameContract.hunt(hunterIds, targets);
      console.log("Bulk hunt transaction:", tx.hash);
      const receipt = await tx.wait();
      console.log("Bulk hunt confirmed in block:", receipt.blockNumber);
      
      console.log('Bulk hunt completed successfully!');
      await refreshData();
    } catch (error: any) {
      console.error('Error bulk hunting:', error);
      setError(error.message || 'Failed to perform bulk hunt');
      throw error;
    }
  };

  const huntMultipleTargets = async (hunterId: number, targets: string[]) => {
    if (!gameContract) {
      setError('Game contract not initialized');
      return;
    }
    
    try {
      console.log(`Hunter #${hunterId} hunting multiple targets using new hunt function:`, targets);
      
      // Create arrays with same hunter for each target
      const hunterIds = Array(targets.length).fill(hunterId);
      
      console.log(`Parameters: tokenIds=[${hunterIds.join(', ')}], targets=[${targets.join(', ')}]`);
      
      // Use the new hunt function that accepts arrays
      const tx = await gameContract.hunt(hunterIds, targets);
      console.log("Multiple target hunt transaction:", tx.hash);
      const receipt = await tx.wait();
      console.log("Multiple target hunt confirmed in block:", receipt.blockNumber);
      
      await refreshData();
    } catch (error: any) {
      console.error('Error hunting multiple targets:', error);
      setError(error.message || 'Failed to hunt multiple targets');
      throw error;
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
    selectedHunters,
    
    depositBear,
    feedHunter,
    feedMultipleHunters,
    hunt,
    huntMultiple,
    huntMultipleTargets,
    setAddressProtection,
    redeemBear,
    getRedemptionRequirements,
    
    refreshData,
    error,
    clearError,
    clearSelectedHunters,
    toggleHunterSelection,
    selectAllHunters,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

// Custom hook to use the game context
export function useGame() {
  return useContext(GameContext);
}