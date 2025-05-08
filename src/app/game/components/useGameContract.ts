'use client';

import { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { useWalletConnection } from '../../hooks/useWalletConnection';
import BearHunterEcosystemABI from '../BearHunterEcosystemabi.json';
import BTBSwapLogicABI from '../BTBSwapLogicabi.json';
import MiMoGaMeABI from '../MiMoGaMeabi.json';
import { BTBTokenABI } from '../../contracts/BTBToken';

// Contract addresses
const BEAR_HUNTER_ECOSYSTEM_ADDRESS = '0x9adEa91A07C1EFB76ad15aBFF9D407D2BaEa0323';
const BEAR_NFT_ADDRESS = '0x98DfAb84a36c68dDC835bFb5681129f2b2A9e0aC';
const BTB_TOKEN_ADDRESS = '0x7765fcea35C8f9bd79aF28413a41Bb15dE640D9B';
const MIMO_TOKEN_ADDRESS = '0xD2bfAAD896F70ef217a478b0908a7Ce6A65523C4';
const BTB_SWAP_LOGIC_ADDRESS = '0xe49e40c262A8BbCb4207427bFEb7F28d71960f6F';

// Create interfaces for event parsing
const gameInterface = new ethers.utils.Interface(BearHunterEcosystemABI);
const btbInterface = new ethers.utils.Interface(BTBTokenABI);

// Types
export type HunterStats = {
  creationTime: number;
  lastFeedTime: number;
  lastHuntTime: number;
  power: string;
  missedFeedings: number;
  inHibernation: boolean;
  recoveryStartTime: number;
  totalHunted: string;
  daysRemaining: number;
};

export type HuntingStatus = {
  canHunt: boolean;
  reason: string;
};

// Hook for interacting with Hunter NFTs
export function useHunterNFTs() {
  const { provider, address } = useWalletConnection();
  const [loading, setLoading] = useState(true);
  const [hunters, setHunters] = useState<number[]>([]);
  const [contract, setContract] = useState<ethers.Contract | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Initialize contract
  useEffect(() => {
    if (!provider || !address) return;
    
    try {
      const signer = provider.getSigner();
      const gameContract = new ethers.Contract(BEAR_HUNTER_ECOSYSTEM_ADDRESS, BearHunterEcosystemABI, signer);
      setContract(gameContract);
    } catch (err) {
      console.error('Failed to initialize game contract:', err);
      setError('Failed to connect to game');
    }
  }, [provider, address]);

  // Load hunter NFTs
  useEffect(() => {
    if (!contract || !address) return;
    
    const loadHunters = async () => {
      try {
        setLoading(true);
        const balance = await contract.balanceOf(address);
        const hunterIds = [];
        
        for (let i = 0; i < balance.toNumber(); i++) {
          const tokenId = await contract.tokenOfOwnerByIndex(address, i);
          hunterIds.push(tokenId.toNumber());
        }
        
        setHunters(hunterIds);
        setLoading(false);
      } catch (err) {
        console.error('Error loading hunters:', err);
        setError('Failed to load your hunters');
        setLoading(false);
      }
    };
    
    loadHunters();
  }, [contract, address]);

  const getHunterStats = async (hunterId: number): Promise<HunterStats | null> => {
    if (!contract) return null;
    
    try {
      const stats = await contract.getHunterStats(hunterId);
      
      return {
        creationTime: stats.creationTime.toNumber(),
        lastFeedTime: stats.lastFeedTime.toNumber(),
        lastHuntTime: stats.lastHuntTime.toNumber(),
        power: ethers.utils.formatUnits(stats.power, 18),
        missedFeedings: stats.missedFeedings,
        inHibernation: stats.inHibernation,
        recoveryStartTime: stats.recoveryStartTime.toNumber(),
        totalHunted: ethers.utils.formatUnits(stats.totalHunted, 18),
        daysRemaining: stats.daysRemaining.toNumber(),
      };
    } catch (err) {
      console.error(`Error getting stats for hunter ${hunterId}:`, err);
      return null;
    }
  };

  const checkHuntingStatus = async (hunterId: number): Promise<HuntingStatus | null> => {
    if (!contract) return null;
    
    try {
      const [canHunt, reason] = await contract.canHunt(hunterId);
      return { canHunt, reason };
    } catch (err) {
      console.error(`Error checking hunting status for hunter ${hunterId}:`, err);
      return null;
    }
  };

  const feedHunter = async (hunterId: number): Promise<boolean> => {
    if (!contract) return false;
    
    try {
      const tx = await contract.feedHunter(hunterId);
      await tx.wait();
      return true;
    } catch (err) {
      console.error(`Error feeding hunter ${hunterId}:`, err);
      return false;
    }
  };

  const hunt = async (hunterId: number, target: string): Promise<boolean> => {
    if (!contract) return false;
    
    try {
      // Call hunt with both required parameters:
      // tokenId (hunterId): The ID of the hunter NFT
      // target (targetAddress): The address to hunt
      console.log(`Hunting with parameters: tokenId=${hunterId}, target=${target}`);
      const tx = await contract.hunt(hunterId, target);
      await tx.wait();
      return true;
    } catch (err) {
      console.error(`Error hunting with hunter ${hunterId}:`, err);
      return false;
    }
  };

  return {
    loading,
    hunters,
    error,
    getHunterStats,
    checkHuntingStatus,
    feedHunter,
    hunt,
  };
}

// Hook for interacting with BEAR NFTs and deposits
export function useBearDeposit() {
  const { provider, address } = useWalletConnection();
  const [loading, setLoading] = useState(true);
  const [bearNFTs, setBearNFTs] = useState<number[]>([]);
  const [contract, setContract] = useState<ethers.Contract | null>(null);
  const [bearContract, setBearContract] = useState<ethers.Contract | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Initialize contracts
  useEffect(() => {
    if (!provider || !address) return;
    
    try {
      const signer = provider.getSigner();
      const gameContract = new ethers.Contract(BEAR_HUNTER_ECOSYSTEM_ADDRESS, BearHunterEcosystemABI, signer);
      setContract(gameContract);
      
      // Simple ERC721 interface for BEAR NFT
      const bearNFTContract = new ethers.Contract(
        BEAR_NFT_ADDRESS,
        [
          'function balanceOf(address owner) view returns (uint256)',
          'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
          'function approve(address to, uint256 tokenId) public',
          'function ownerOf(uint256 tokenId) view returns (address)'
        ],
        signer
      );
      
      setBearContract(bearNFTContract);
    } catch (err) {
      console.error('Failed to initialize contracts:', err);
      setError('Failed to connect to game');
    }
  }, [provider, address]);

  // Load BEAR NFTs
  useEffect(() => {
    if (!bearContract || !address) return;
    
    const loadBearNFTs = async () => {
      try {
        setLoading(true);
        const balance = await bearContract.balanceOf(address);
        const nftIds = [];
        
        for (let i = 0; i < balance.toNumber(); i++) {
          const tokenId = await bearContract.tokenOfOwnerByIndex(address, i);
          nftIds.push(tokenId.toNumber());
        }
        
        setBearNFTs(nftIds);
        setLoading(false);
      } catch (err) {
        console.error('Error loading BEAR NFTs:', err);
        setError('Failed to load your BEAR NFTs');
        setLoading(false);
      }
    };
    
    loadBearNFTs();
  }, [bearContract, address]);

  const depositBear = async (bearId: number): Promise<boolean> => {
    if (!contract || !bearContract || !address) return false;
    
    try {
      // Check if we own the NFT
      const ownerAddress = await bearContract.ownerOf(bearId);
      if (ownerAddress.toLowerCase() !== address.toLowerCase()) {
        throw new Error(`You don't own BEAR NFT #${bearId}`);
      }
      
      // First approve the game contract to transfer the BEAR NFT
      const approveTx = await bearContract.approve(BEAR_HUNTER_ECOSYSTEM_ADDRESS, bearId);
      await approveTx.wait();
      
      // Then deposit the BEAR NFT
      const depositTx = await contract.depositBear(bearId);
      await depositTx.wait();
      
      return true;
    } catch (err) {
      console.error(`Error depositing BEAR NFT ${bearId}:`, err);
      return false;
    }
  };

  return {
    loading,
    bearNFTs,
    error,
    depositBear,
  };
}

// Hook for MiMo token interactions
export function useMimoToken() {
  const { provider, address } = useWalletConnection();
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState('0');
  const [gameContract, setGameContract] = useState<ethers.Contract | null>(null);
  const [mimoContract, setMimoContract] = useState<ethers.Contract | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Initialize contracts
  useEffect(() => {
    if (!provider || !address) return;
    
    try {
      const signer = provider.getSigner();
      const bearHunterContract = new ethers.Contract(BEAR_HUNTER_ECOSYSTEM_ADDRESS, BearHunterEcosystemABI, signer);
      setGameContract(bearHunterContract);
      
      // MiMo token contract
      const mimoTokenContract = new ethers.Contract(MIMO_TOKEN_ADDRESS, MiMoGaMeABI, signer);
      setMimoContract(mimoTokenContract);
    } catch (err) {
      console.error('Failed to initialize contracts:', err);
      setError('Failed to connect to game contracts');
    }
  }, [provider, address]);

  // Load MiMo balance
  useEffect(() => {
    if (!mimoContract || !address) return;
    
    const loadBalance = async () => {
      try {
        setLoading(true);
        const mimoBalance = await mimoContract.balanceOf(address);
        setBalance(ethers.utils.formatUnits(mimoBalance, 18));
        setLoading(false);
      } catch (err) {
        console.error('Error loading MiMo balance:', err);
        setError('Failed to load your MiMo balance');
        setLoading(false);
      }
    };
    
    loadBalance();
  }, [mimoContract, address]);

  const transfer = async (to: string, amount: string): Promise<boolean> => {
    if (!mimoContract) return false;
    
    try {
      const amountWei = ethers.utils.parseUnits(amount, 18);
      const tx = await mimoContract.transfer(to, amountWei);
      await tx.wait();
      
      // Update balance
      const newBalance = await mimoContract.balanceOf(address);
      setBalance(ethers.utils.formatUnits(newBalance, 18));
      
      return true;
    } catch (err) {
      console.error('Error transferring MiMo:', err);
      return false;
    }
  };

  const burn = async (amount: string): Promise<boolean> => {
    if (!mimoContract) return false;
    
    try {
      const amountWei = ethers.utils.parseUnits(amount, 18);
      const tx = await mimoContract.burn(amountWei);
      await tx.wait();
      
      // Update balance
      const newBalance = await mimoContract.balanceOf(address);
      setBalance(ethers.utils.formatUnits(newBalance, 18));
      
      return true;
    } catch (err) {
      console.error('Error burning MiMo:', err);
      return false;
    }
  };

  return {
    loading,
    balance,
    error,
    transfer,
    burn,
  };
}

// Hook for address protection status
export function useAddressProtection() {
  const { provider, address } = useWalletConnection();
  const [loading, setLoading] = useState(true);
  const [isProtected, setIsProtected] = useState(false);
  const [contract, setContract] = useState<ethers.Contract | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Initialize contract
  useEffect(() => {
    if (!provider || !address) return;
    
    try {
      const signer = provider.getSigner();
      const gameContract = new ethers.Contract(BEAR_HUNTER_ECOSYSTEM_ADDRESS, BearHunterEcosystemABI, signer);
      setContract(gameContract);
    } catch (err) {
      console.error('Failed to initialize game contract:', err);
      setError('Failed to connect to game');
    }
  }, [provider, address]);

  // Load protection status
  useEffect(() => {
    if (!contract || !address) return;
    
    const loadProtectionStatus = async () => {
      try {
        setLoading(true);
        const isAddressProtected = await contract.protectedAddresses(address);
        setIsProtected(isAddressProtected);
        setLoading(false);
      } catch (err) {
        console.error('Error loading protection status:', err);
        setError('Failed to load your protection status');
        setLoading(false);
      }
    };
    
    loadProtectionStatus();
  }, [contract, address]);

  return {
    loading,
    isProtected,
    error,
  };
}

// Hook for BTB Swap Logic interactions
export function useBTBSwapLogic() {
  const { provider, address } = useWalletConnection();
  const [loading, setLoading] = useState(true);
  const [swapRate, setSwapRate] = useState('0');
  const [swapContract, setSwapContract] = useState<ethers.Contract | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Initialize contract
  useEffect(() => {
    if (!provider || !address) return;
    
    try {
      const signer = provider.getSigner();
      const btbSwapContract = new ethers.Contract(BTB_SWAP_LOGIC_ADDRESS, BTBSwapLogicABI, signer);
      setSwapContract(btbSwapContract);
    } catch (err) {
      console.error('Failed to initialize BTB swap contract:', err);
      setError('Failed to connect to BTB swap');
    }
  }, [provider, address]);

  // Load swap rate
  useEffect(() => {
    if (!swapContract) return;
    
    const loadSwapRate = async () => {
      try {
        setLoading(true);
        const rate = await swapContract.getSwapRate();
        setSwapRate(ethers.utils.formatUnits(rate, 18));
        setLoading(false);
      } catch (err) {
        console.error('Error loading swap rate:', err);
        setError('Failed to load BTB swap rate');
        setLoading(false);
      }
    };
    
    loadSwapRate();
  }, [swapContract]);

  const swapBTBForNFT = async (amount: string): Promise<{success: boolean, tokenIds?: number[]}> => {
    if (!swapContract || !provider) return { success: false };
    
    try {
      const amountWei = ethers.utils.parseEther(amount);
      
      // First we need to approve the swap contract to spend our BTB
      const btbContract = new ethers.Contract(BTB_TOKEN_ADDRESS, BTBTokenABI, provider.getSigner());
      const approveTx = await btbContract.approve(BTB_SWAP_LOGIC_ADDRESS, amountWei);
      await approveTx.wait();
      
      // Then call the swap function
      const tx = await swapContract.swapBTBForNFT(amountWei);
      const receipt = await tx.wait();
      
      // Parse the event logs to get the minted NFT IDs
      const events = receipt.logs
        .filter((log: any) => log.address === BEAR_HUNTER_ECOSYSTEM_ADDRESS)
        .map((log: any) => {
          try {
            return gameInterface.parseLog(log);
          } catch (err) {
            return null;
          }
        })
        .filter(Boolean);
      
      if (events.length > 0) {
        // Access the NFT IDs from the event
        const tokenIds = events[0].args.nftIds.map((id: any) => id.toNumber());
        return { success: true, tokenIds };
      }
      
      return { success: true };
    } catch (err) {
      console.error('Error swapping BTB for NFT:', err);
      return { success: false };
    }
  };

  const swapNFTForBTB = async (tokenIds: number[]): Promise<{success: boolean, btbAmount?: string}> => {
    if (!swapContract || !provider) return { success: false };
    
    try {
      // First approve the swap contract for each NFT
      const hunterContract = new ethers.Contract(BEAR_HUNTER_ECOSYSTEM_ADDRESS, BearHunterEcosystemABI, provider.getSigner());
      
      for (const tokenId of tokenIds) {
        const approveTx = await hunterContract.approve(BTB_SWAP_LOGIC_ADDRESS, tokenId);
        await approveTx.wait();
      }
      
      // Then call the swap function
      const tx = await swapContract.swapNFTForBTB(tokenIds);
      const receipt = await tx.wait();
      
      // Parse the event logs to get the BTB amount received
      const events = receipt.logs
        .filter((log: any) => log.address === BTB_TOKEN_ADDRESS)
        .map((log: any) => {
          try {
            return btbInterface.parseLog(log);
          } catch (err) {
            return null;
          }
        })
        .filter(Boolean);
      
      if (events.length > 0) {
        // Access the BTB amount from the event
        const btbAmount = ethers.utils.formatEther(events[0].args.value);
        return { success: true, btbAmount };
      }
      
      return { success: true };
    } catch (err) {
      console.error('Error swapping NFT for BTB:', err);
      return { success: false };
    }
  };

  return {
    loading,
    swapRate,
    error,
    swapBTBForNFT,
    swapNFTForBTB,
  };
}