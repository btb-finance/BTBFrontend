'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ethers } from 'ethers';

interface WalletContextType {
  address: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  error: string | null;
  clearError: () => void;
}

const WalletContext = createContext<WalletContextType>({
  address: null,
  isConnected: false,
  isConnecting: false,
  connectWallet: async () => {},
  disconnectWallet: () => {},
  error: null,
  clearError: () => {}
});

export const useWallet = () => useContext(WalletContext);

interface WalletProviderProps {
  children: ReactNode;
}

export const WalletProvider: React.FC<WalletProviderProps> = ({ children }) => {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isDevelopment, setIsDevelopment] = useState(false);

  // Check if we're in development mode
  useEffect(() => {
    setIsDevelopment(
      window.location.hostname === 'localhost' || 
      window.location.hostname === '127.0.0.1'
    );
  }, []);

  // Check for saved wallet address on mount
  useEffect(() => {
    const savedAddress = localStorage.getItem('walletAddress');
    if (savedAddress) {
      try {
        // Ensure the address is properly checksummed
        const checksummedAddress = ethers.utils.getAddress(savedAddress);
        setAddress(checksummedAddress);
        setIsConnected(true);
      } catch (error) {
        console.error('Invalid wallet address in localStorage:', error);
        localStorage.removeItem('walletAddress');
      }
    }

    // Setup wallet listeners if ethereum provider is available
    if (typeof window !== 'undefined' && typeof window.ethereum !== 'undefined' && savedAddress) {
      setupWalletListeners();
    }
  }, []);

  const clearError = () => {
    setError(null);
  };

  const connectWallet = async () => {
    setIsConnecting(true);
    setError(null);
    
    try {
      // Check if we're in a development environment
      const isDevelopment = typeof window !== 'undefined' && window.location.hostname === 'localhost';
      
      // Check if MetaMask is installed
      if (typeof window.ethereum === 'undefined') {
        throw new Error('No Ethereum wallet detected. Please install MetaMask or another Web3 wallet.');
      }
      
      try {
        // Request account access
        const accounts = await window.ethereum.request({ 
          method: 'eth_requestAccounts' 
        });
        
        if (!accounts || accounts.length === 0) {
          throw new Error('No accounts found. Please make sure your wallet is unlocked.');
        }
        
        // Ensure the address is properly checksummed
        const userAddress = ethers.utils.getAddress(accounts[0]);
        
        let signature;
        try {
          // Sign message to verify ownership
          signature = await window.ethereum.request({
            method: 'personal_sign',
            params: [
              `Welcome to BTB Finance! By signing this message, you confirm that:\n\n1. You are connecting to BTB Finance - The Next Generation DeFi Platform\n2. You understand that cryptocurrency markets are subject to high risk\n3. You are responsible for securing your wallet and assets\n\nWallet verification timestamp: ${new Date().toISOString()}`,
              userAddress
            ]
          });
        } catch (signError: any) {
          // Handle user rejection of signature request
          if (signError.code === 4001) { // MetaMask error code for user rejected request
            throw new Error('You must sign the message to connect your wallet.');
          }
          throw signError;
        }
        
        // Set user address and connected state
        setAddress(userAddress);
        setIsConnected(true);
        localStorage.setItem('walletAddress', userAddress);
        
        // Setup wallet event listeners
        setupWalletListeners();
      } catch (walletError: any) {
        // Specific wallet interaction errors
        if (walletError.code === -32002) {
          throw new Error('Wallet connection already pending. Please check your wallet.');
        }
        throw walletError;
      }
    } catch (err: any) {
      console.error('Wallet connection error:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect wallet');
      setIsConnected(false);
      setAddress(null);
    } finally {
      setIsConnecting(false);
    }
  };

  const setupWalletListeners = () => {
    if (typeof window.ethereum !== 'undefined') {
      // Handle account changes
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length === 0) {
          // User disconnected their wallet
          disconnectWallet();
        } else if (accounts[0] !== address) {
          // User switched accounts - ensure proper checksum
          const checksummedAddress = ethers.utils.getAddress(accounts[0]);
          setAddress(checksummedAddress);
          localStorage.setItem('walletAddress', checksummedAddress);
        }
      };

      // Handle chain changes
      const handleChainChanged = () => {
        // Reload the page on chain change as recommended by MetaMask
        window.location.reload();
      };

      // Add event listeners
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);

      // Return cleanup function
      return () => {
        window.ethereum?.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum?.removeListener('chainChanged', handleChainChanged);
      };
    }
  };

  const disconnectWallet = () => {
    setAddress(null);
    setIsConnected(false);
    localStorage.removeItem('walletAddress');
  };

  return (
    <WalletContext.Provider
      value={{
        address,
        isConnected,
        isConnecting,
        connectWallet,
        disconnectWallet,
        error,
        clearError
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

// Add TypeScript declarations for window.ethereum
declare global {
  interface Window {
    ethereum: {
      request: (args: any) => Promise<any>;
      on: (event: string, callback: (...args: any[]) => void) => void;
      removeListener: (event: string, callback: (...args: any[]) => void) => void;
    } | undefined;
  }
}
