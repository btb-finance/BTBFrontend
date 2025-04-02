'use client';

import { useState } from 'react';
import { CHAIN_CONFIG } from '../services/simpleBridgeService';

// Network switching hook
export default function useNetworkSwitcher() {
  const [isSwitching, setIsSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Function to switch networks
  const switchNetwork = async (chainKey: keyof typeof CHAIN_CONFIG): Promise<boolean> => {
    setIsSwitching(true);
    setError(null);

    try {
      // Check if ethereum is available
      if (typeof window.ethereum === 'undefined') {
        throw new Error('No Ethereum wallet detected. Please install MetaMask or another Web3 wallet.');
      }

      const chainConfig = CHAIN_CONFIG[chainKey];
      
      // Format chain ID as hex
      const chainIdHex = `0x${chainConfig.chainId.toString(16)}`;
      
      try {
        // Request network switch
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: chainIdHex }],
        });
        
        return true;
      } catch (switchError: any) {
        // This error code indicates that the chain has not been added to MetaMask
        if (switchError.code === 4902) {
          // Add the network
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: chainIdHex,
                chainName: chainConfig.name,
                nativeCurrency: {
                  name: chainConfig.symbol,
                  symbol: chainConfig.symbol,
                  decimals: 18,
                },
                rpcUrls: [getRpcUrl(chainKey)],
                blockExplorerUrls: [getExplorerUrl(chainKey)],
              },
            ],
          });
          
          return true;
        }
        
        throw switchError;
      }
    } catch (err: any) {
      console.error('Error switching network:', err);
      setError(err instanceof Error ? err.message : 'Failed to switch network');
      return false;
    } finally {
      setIsSwitching(false);
    }
  };

  // Helper function to get RPC URL for a chain
  function getRpcUrl(chainKey: keyof typeof CHAIN_CONFIG): string {
    switch (chainKey) {
      case 'AVALANCHE':
        return 'https://api.avax.network/ext/bc/C/rpc';
      case 'ARBITRUM':
        return 'https://arb1.arbitrum.io/rpc';
      case 'OPTIMISM':
        return 'https://mainnet.optimism.io';
      case 'BASE':
        return 'https://mainnet.base.org';
      default:
        return '';
    }
  }

  // Helper function to get explorer URL for a chain
  function getExplorerUrl(chainKey: keyof typeof CHAIN_CONFIG): string {
    switch (chainKey) {
      case 'AVALANCHE':
        return 'https://snowtrace.io';
      case 'ARBITRUM':
        return 'https://arbiscan.io';
      case 'OPTIMISM':
        return 'https://optimistic.etherscan.io';
      case 'BASE':
        return 'https://basescan.org';
      default:
        return '';
    }
  }

  return {
    switchNetwork,
    isSwitching,
    error,
  };
}
