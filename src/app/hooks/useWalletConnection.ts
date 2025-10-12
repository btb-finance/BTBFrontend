import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWallet } from '../context/WalletContext';

export interface WalletState {
  isConnected: boolean;
  address: string | null;
  chainId: number | null;
  isCorrectNetwork: boolean;
  provider: ethers.BrowserProvider | null;
}

const BASE_CHAIN_ID = 8453;

export function useWalletConnection() {
  const { address, isConnected, connectWallet: contextConnectWallet } = useWallet();
  const [walletState, setWalletState] = useState<WalletState>({
    isConnected: false,
    address: null,
    chainId: null,
    isCorrectNetwork: false,
    provider: null,
  });

  const checkConnection = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const network = await provider.getNetwork();
        const accounts = await provider.listAccounts();
        
        const signer = accounts.length > 0 ? await provider.getSigner(0) : null;
        const address = signer ? await signer.getAddress() : null;

        setWalletState({
          isConnected: accounts.length > 0,
          address,
          chainId: Number(network.chainId),
          isCorrectNetwork: Number(network.chainId) === BASE_CHAIN_ID,
          provider,
        });
      } catch (error) {
        console.error('Error checking wallet connection:', error);
        setWalletState({
          isConnected: false,
          address: null,
          chainId: null,
          isCorrectNetwork: false,
          provider: null,
        });
      }
    }
  };

  const handleAccountsChanged = async (accounts: string[]) => {
    if (accounts.length === 0) {
      setWalletState({
        isConnected: false,
        address: null,
        chainId: walletState.chainId,
        isCorrectNetwork: walletState.isCorrectNetwork,
        provider: null,
      });
    } else {
      await checkConnection();
    }
  };

  const handleChainChanged = async () => {
    await checkConnection();
  };

  useEffect(() => {
    checkConnection();

    if (window.ethereum) {
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);
    }

    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, []);

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
        provider: null,
      });
    }
  };

  return { ...walletState, connectWallet };
}
