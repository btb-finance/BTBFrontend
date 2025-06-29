'use client';

import { useState } from 'react';
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