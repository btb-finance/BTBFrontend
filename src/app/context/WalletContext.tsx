'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
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
  
  // Use a ref to store the provider to prevent conflicts
  const providerRef = useRef<any>(null);

  // Check if we're in development mode
  useEffect(() => {
    setIsDevelopment(
      window.location.hostname === 'localhost' || 
      window.location.hostname === '127.0.0.1'
    );
  }, []);

  // Helper function to safely get a provider without causing conflicts
  const getSafeProvider = () => {
    // If we already have a provider reference, use it
    if (providerRef.current) return providerRef.current;
    
    // Otherwise, try to get a provider safely
    if (typeof window !== 'undefined') {
      // Try to get Phantom's provider first
      if (window.phantom?.ethereum) {
        providerRef.current = window.phantom.ethereum;
        return providerRef.current;
      }
      
      // Fall back to window.ethereum if available
      if (window.ethereum) {
        // Store a reference to avoid conflicts
        providerRef.current = window.ethereum;
        return providerRef.current;
      }
    }
    
    return null;
  };

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

    // Setup wallet listeners if any ethereum provider is available
    if (savedAddress && getSafeProvider()) {
      setupWalletListeners();
    }
    
    // Add this to prevent wallet conflicts
    const handleLoad = () => {
      // Store the initial provider reference
      getSafeProvider();
    };
    
    window.addEventListener('load', handleLoad);
    return () => window.removeEventListener('load', handleLoad);
  }, []);

  const clearError = () => {
    setError(null);
  };

  const connectWallet = async () => {
    setIsConnecting(true);
    setError(null);
    
    try {
      // Get a safe provider reference
      const provider = getSafeProvider();
      
      // Check if any Ethereum provider is available
      if (!provider) {
        setError('No Ethereum provider found. Please install MetaMask, Phantom, or another Web3 wallet and refresh the page.');
        setIsConnecting(false);
        return;
      }
      
      try {
        // Request account access using the selected provider
        const accounts = await provider.request({ 
          method: 'eth_requestAccounts' 
        });
        
        if (!accounts || accounts.length === 0) {
          throw new Error('No accounts found. Please make sure your wallet is unlocked.');
        }
        
        // Ensure the address is properly checksummed
        const userAddress = ethers.utils.getAddress(accounts[0]);
        
        // Message signing step removed to improve user experience
        // Users can now connect without needing to sign a verification message
        
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
    // Get a safe provider reference
    const provider = getSafeProvider();
    
    // If no provider is available, return early
    if (!provider) return;
    
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
      const handleChainChanged = (chainId: string) => {
        console.log('Chain changed to:', chainId);
        // Instead of reloading the page immediately, we'll update the state
        // This prevents constant refreshing with some wallets
        
        // Only disconnect if we can't handle the new chain
        // For now, we'll just log the chain change and not reload
        // If specific chain handling is needed, it can be added here
      };

      // Add event listeners
      provider.on('accountsChanged', handleAccountsChanged);
      
      // Some wallet providers might trigger chainChanged frequently
      // We'll use a debounced version to prevent constant refreshing
      let chainChangeTimeout: NodeJS.Timeout;
      provider.on('chainChanged', (chainId: string) => {
        clearTimeout(chainChangeTimeout);
        chainChangeTimeout = setTimeout(() => handleChainChanged(chainId), 500);
      });

      // Return cleanup function
      return () => {
        provider.removeListener('accountsChanged', handleAccountsChanged);
        provider.removeListener('chainChanged', handleChainChanged);
      };
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

// Add TypeScript declarations for window.ethereum and window.phantom
declare global {
  interface Window {
    ethereum: {
      request: (args: any) => Promise<any>;
      on: (event: string, callback: (...args: any[]) => void) => void;
      removeListener: (event: string, callback: (...args: any[]) => void) => void;
      isPhantom?: boolean;
      isTronLink?: boolean;
      isTrust?: boolean;
      isCoinbaseWallet?: boolean;
      isMetaMask?: boolean;
    } | undefined;
    phantom?: {
      ethereum: {
        request: (args: any) => Promise<any>;
        on: (event: string, callback: (...args: any[]) => void) => void;
        removeListener: (event: string, callback: (...args: any[]) => void) => void;
        isPhantom: boolean;
      };
    };
    tronLink?: any;
    tronWeb?: any;
  }
}
