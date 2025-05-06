'use client';

import { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { useWalletConnection } from '../../hooks/useWalletConnection';
import gameAbi from '../gameabi.json';

// Contract addresses
const GAME_CONTRACT_ADDRESS = '0xA44906a6c5A0fC974a73C76F6E8B8a5C066413B7';
const BEAR_NFT_ADDRESS = '0x4AF11c8ea29039b9F169DBB08Bf6B794EB45BB7a';

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
      const gameContract = new ethers.Contract(GAME_CONTRACT_ADDRESS, gameAbi, signer);
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
        missedFeedings: stats.missedFeedings.toNumber(),
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

  const hunt = async (hunterId: number): Promise<boolean> => {
    if (!contract) return false;
    
    try {
      const tx = await contract.hunt(hunterId);
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
      const gameContract = new ethers.Contract(GAME_CONTRACT_ADDRESS, gameAbi, signer);
      setContract(gameContract);
      
      // Simple ERC721 interface for BEAR NFT
      const bearNFTContract = new ethers.Contract(
        BEAR_NFT_ADDRESS,
        [
          'function balanceOf(address owner) view returns (uint256)',
          'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
          'function approve(address to, uint256 tokenId) public',
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
    if (!contract || !bearContract) return false;
    
    try {
      // First approve the game contract to transfer the BEAR NFT
      const approveTx = await bearContract.approve(GAME_CONTRACT_ADDRESS, bearId);
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
  const [contract, setContract] = useState<ethers.Contract | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Initialize contract
  useEffect(() => {
    if (!provider || !address) return;
    
    try {
      const signer = provider.getSigner();
      const gameContract = new ethers.Contract(GAME_CONTRACT_ADDRESS, gameAbi, signer);
      setContract(gameContract);
    } catch (err) {
      console.error('Failed to initialize game contract:', err);
      setError('Failed to connect to game');
    }
  }, [provider, address]);

  // Load MiMo balance
  useEffect(() => {
    if (!contract || !address) return;
    
    const loadBalance = async () => {
      try {
        setLoading(true);
        const mimoBalance = await contract.mimoBalanceOf(address);
        setBalance(ethers.utils.formatUnits(mimoBalance, 18));
        setLoading(false);
      } catch (err) {
        console.error('Error loading MiMo balance:', err);
        setError('Failed to load your MiMo balance');
        setLoading(false);
      }
    };
    
    loadBalance();
  }, [contract, address]);

  const transfer = async (to: string, amount: string): Promise<boolean> => {
    if (!contract) return false;
    
    try {
      const amountWei = ethers.utils.parseUnits(amount, 18);
      const tx = await contract.mimoTransfer(to, amountWei);
      await tx.wait();
      
      // Update balance
      const newBalance = await contract.mimoBalanceOf(address);
      setBalance(ethers.utils.formatUnits(newBalance, 18));
      
      return true;
    } catch (err) {
      console.error('Error transferring MiMo:', err);
      return false;
    }
  };

  const burn = async (amount: string): Promise<boolean> => {
    if (!contract) return false;
    
    try {
      const amountWei = ethers.utils.parseUnits(amount, 18);
      const tx = await contract.mimoBurn(amountWei);
      await tx.wait();
      
      // Update balance
      const newBalance = await contract.mimoBalanceOf(address);
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
      const gameContract = new ethers.Contract(GAME_CONTRACT_ADDRESS, gameAbi, signer);
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
        const isAddressProtected = await contract.isAddressProtected(address);
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