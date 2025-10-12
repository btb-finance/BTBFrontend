'use client';

import { createConfig, http, cookieStorage, createStorage } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';
import { walletConnect, coinbaseWallet, injected, metaMask } from 'wagmi/connectors';

// Get project ID from environment
const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'e78d121a165909ad1ec1cd20c2af0f9a';

// Create connectors function to avoid SSR issues with WalletConnect
const getConnectors = () => {
  // Only add WalletConnect on client-side to avoid indexedDB issues
  if (typeof window !== 'undefined') {
    return [
      injected(),
      coinbaseWallet({
        appName: 'BTB Finance',
        appLogoUrl: 'https://btb.finance/logo.png'
      }),
      walletConnect({
        projectId: walletConnectProjectId,
        metadata: {
          name: 'BTB Finance',
          description: 'The most capital efficient token in DeFi',
          url: window.location.origin,
          icons: ['https://btb.finance/logo.png']
        },
        showQrModal: false  // Disable QR modal popup
      })
    ];
  }

  // Server-side: only return connectors that don't require browser APIs
  return [
    injected(),
    coinbaseWallet({
      appName: 'BTB Finance',
      appLogoUrl: 'https://btb.finance/logo.png'
    })
  ];
};

export const config = createConfig({
  chains: [base, baseSepolia],
  connectors: getConnectors(),
  transports: {
    [base.id]: http(),
    [baseSepolia.id]: http(),
  },
  ssr: true,
  storage: createStorage({
    storage: cookieStorage,
  }),
  multiInjectedProviderDiscovery: true,
});