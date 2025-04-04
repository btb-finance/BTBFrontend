'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ethers } from 'ethers';
import Web3Modal from 'web3modal';
import EthereumProvider from '@walletconnect/ethereum-provider';

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

  // Check for saved wallet address on mount and auto-reconnect
  useEffect(() => {
    const savedAddress = localStorage.getItem('walletAddress');
    if (savedAddress) {
      try {
        // Ensure the address is properly checksummed
        const checksummedAddress = ethers.utils.getAddress(savedAddress);
        setAddress(checksummedAddress);
        
        // Auto-connect if we have both an address and access to the wallet
        if (typeof window !== 'undefined' && typeof window.ethereum !== 'undefined') {
          // Check if the current connected account matches our saved address
          const autoConnect = async () => {
            try {
              // We've already checked window.ethereum is defined above, so we can safely use it here
              const accounts = await window.ethereum!.request({ 
                method: 'eth_accounts' // This is non-intrusive, just checks current connected accounts
              });
              
              if (accounts && accounts.length > 0) {
                const connectedAddress = ethers.utils.getAddress(accounts[0]);
                if (connectedAddress.toLowerCase() === checksummedAddress.toLowerCase()) {
                  console.log('Auto-reconnected to wallet:', connectedAddress);
                  setIsConnected(true);
                  setupWalletListeners();
                } else {
                  console.log('Saved address doesn\'t match current wallet account. User needs to connect manually.');
                  // We have the address but need explicit connection
                  setIsConnected(false);
                }
              } else {
                // Wallet is available but not connected to the site
                console.log('Wallet available but not connected. User needs to connect manually.');
                setIsConnected(false);
              }
            } catch (error) {
              console.error('Error auto-connecting wallet:', error);
              setIsConnected(false);
            }
          };
          
          autoConnect();
        } else {
          // We have the address but no wallet available
          console.log('No wallet available. User needs to connect manually.');
          setIsConnected(false);
        }
      } catch (error) {
        console.error('Invalid wallet address in localStorage:', error);
        localStorage.removeItem('walletAddress');
        setIsConnected(false);
      }
    }
  }, []);

  const clearError = () => {
    setError(null);
  };

  // Web3Modal instance (client-side only)
  const [web3Modal, setWeb3Modal] = useState<Web3Modal | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const modal = new Web3Modal({
        cacheProvider: true,
        providerOptions: {
          walletconnect: {
            package: EthereumProvider,
            options: {
              projectId: 'e78d121a165909ad1ec1cd20c2af0f9a',
              chains: [1, 8453], // Mainnet and Base
              showQrModal: true
            }
          }
        }
      });
      setWeb3Modal(modal);
    }
  }, []);

  const connectWallet = async () => {
    setIsConnecting(true);
    setError(null);

    try {
      if (!web3Modal) {
        console.error('Web3Modal is not initialized yet.');
        setError('Wallet connection is not ready. Please try again in a moment.');
        setIsConnecting(false);
        return;
      }
      const providerInstance = await web3Modal.connect();

      const provider = new ethers.providers.Web3Provider(providerInstance);
      const signer = provider.getSigner();
      const userAddress = await signer.getAddress();

      setAddress(userAddress);
      setIsConnected(true);
      localStorage.setItem('walletAddress', userAddress);

      // Setup wallet event listeners
      setupWalletListeners();
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

