import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWallet } from '../context/WalletContext';

export interface WalletState {
  isConnected: boolean;
  address: string | null;
  chainId: number | null;
  isCorrectNetwork: boolean;
}

const BASE_CHAIN_ID = 8453;

export function useWalletConnection() {
  const { address: contextAddress, isConnected: contextIsConnected, connectWallet: contextConnectWallet } = useWallet();
  const [walletState, setWalletState] = useState<WalletState>({
    isConnected: contextIsConnected || false,
    address: contextAddress || null,
    chainId: null,
    isCorrectNetwork: false,
  });

  const checkConnection = async () => {
    // First check localStorage for saved address (this is our source of truth)
    const savedAddress = localStorage.getItem('walletAddress');
    
    if (savedAddress) {
      // If we have a saved address, consider the wallet connected
      try {
        // Set basic connection info from localStorage
        setWalletState(prev => ({
          ...prev,
          isConnected: true,
          address: ethers.utils.getAddress(savedAddress),
        }));
        
        // Then check if provider is available to get chain details
        if (typeof window !== 'undefined' && typeof window.ethereum !== 'undefined') {
          const provider = new ethers.providers.Web3Provider(window.ethereum);
          const network = await provider.getNetwork();
          
          setWalletState(prev => ({
            ...prev,
            chainId: network.chainId,
            isCorrectNetwork: network.chainId === BASE_CHAIN_ID,
          }));
        }
      } catch (error) {
        console.error('Error with saved wallet address:', error);
        // If there's an error with the saved address, clear it
        localStorage.removeItem('walletAddress');
        setWalletState({
          isConnected: false,
          address: null,
          chainId: null,
          isCorrectNetwork: false,
        });
      }
    } else if (typeof window !== 'undefined' && typeof window.ethereum !== 'undefined') {
      // If no saved address, check if wallet is connected directly
      try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const network = await provider.getNetwork();
        const accounts = await provider.listAccounts();
        
        if (accounts.length > 0) {
          const checksummedAddress = ethers.utils.getAddress(accounts[0]);
          // Save the address to localStorage for future use
          localStorage.setItem('walletAddress', checksummedAddress);
        }
        
        setWalletState({
          isConnected: accounts.length > 0,
          address: accounts.length > 0 ? ethers.utils.getAddress(accounts[0]) : null,
          chainId: network.chainId,
          isCorrectNetwork: network.chainId === BASE_CHAIN_ID,
        });
      } catch (error) {
        console.error('Error checking wallet connection:', error);
        setWalletState({
          isConnected: false,
          address: null,
          chainId: null,
          isCorrectNetwork: false,
        });
      }
    }
  };

  const handleAccountsChanged = async (accounts: string[]) => {
    if (accounts.length === 0) {
      // User disconnected their wallet
      localStorage.removeItem('walletAddress');
      setWalletState({
        isConnected: false,
        address: null,
        chainId: walletState.chainId,
        isCorrectNetwork: walletState.isCorrectNetwork,
      });
    } else {
      // User switched accounts or connected
      const checksummedAddress = ethers.utils.getAddress(accounts[0]);
      localStorage.setItem('walletAddress', checksummedAddress);
      await checkConnection();
    }
  };

  const handleChainChanged = async () => {
    await checkConnection();
  };

  useEffect(() => {
    checkConnection();

    if (typeof window !== 'undefined' && typeof window.ethereum !== 'undefined') {
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);
    }

    return () => {
      if (typeof window !== 'undefined' && typeof window.ethereum !== 'undefined') {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, []);

  // Update walletState if contextAddress changes (sync with WalletContext)
  useEffect(() => {
    if (contextAddress && contextAddress !== walletState.address) {
      setWalletState(prev => ({
        ...prev,
        isConnected: true,
        address: contextAddress
      }));
    }
  }, [contextAddress, contextIsConnected]);

  const connectWallet = async (): Promise<void> => {
    try {
      await contextConnectWallet();
      await checkConnection();
    } catch (error) {
      console.error('Error connecting wallet:', error);
      setWalletState({
        isConnected: false,
        address: null,
        chainId: null,
        isCorrectNetwork: false,
      });
    }
  };

  return { ...walletState, connectWallet };
}
