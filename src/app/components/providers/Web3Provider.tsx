'use client';

import { useState, useEffect } from 'react';
import { WagmiProvider, cookieToInitialState } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConnectKitProvider } from 'connectkit';
import { config } from '../../config/connectkit';

export function Web3Provider({ 
  children,
  cookie 
}: { 
  children: React.ReactNode;
  cookie?: string;
}) {
  const [queryClient] = useState(() => new QueryClient());
  const initialState = cookieToInitialState(config, cookie);

  useEffect(() => {
    // Listen for network changes and refresh page when switching to Base
    const handleChainChanged = (chainId: string) => {
      const baseChainId = '0x2105'; // Base mainnet (8453)
      const baseSepoliaChainId = '0x14a34'; // Base Sepolia (84532)
      
      if (chainId === baseChainId || chainId === baseSepoliaChainId) {
        // Small delay to ensure the network switch is complete
        setTimeout(() => {
          window.location.reload();
        }, 500);
      }
    };

    if (typeof window !== 'undefined' && window.ethereum) {
      window.ethereum.on('chainChanged', handleChainChanged);
      
      return () => {
        if (window.ethereum?.removeListener) {
          window.ethereum.removeListener('chainChanged', handleChainChanged);
        }
      };
    }
  }, []);

  return (
    <WagmiProvider config={config} initialState={initialState}>
      <QueryClientProvider client={queryClient}>
        <ConnectKitProvider
          theme="auto"
          mode="dark"
          customTheme={{
            "--ck-accent-color": "#7B3FF2",
            "--ck-accent-text-color": "#ffffff",
            "--ck-primary-button-border-radius": "6px",
            "--ck-primary-button-color": "#7B3FF2",
            "--ck-primary-button-background": "#7B3FF2",
          }}
          options={{
            initialChainId: 8453, // Base mainnet
            enforceSupportedChains: true,
            disclaimer: "Welcome to BTB Finance - The most capital efficient token in DeFi"
          }}
        >
          {children}
        </ConnectKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}