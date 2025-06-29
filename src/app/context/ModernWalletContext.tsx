'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';

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
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { isPending: isConnecting, error: connectError } = useConnect();

  const connectWallet = async () => {
    // This is now handled directly by ConnectKit buttons in components
    console.log('ConnectKit modal should be triggered by the button component');
  };

  const disconnectWallet = () => {
    try {
      disconnect();
    } catch (err) {
      console.error('Failed to disconnect:', err);
    }
  };

  const clearError = () => {
    // ConnectKit handles errors internally
  };

  const value: WalletContextType = {
    address: address || null,
    isConnected,
    isConnecting,
    connectWallet,
    disconnectWallet,
    error: connectError?.message || null,
    clearError
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};