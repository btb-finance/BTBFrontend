'use client';

import { createConfig, http, cookieStorage, createStorage } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';
import { walletConnect, coinbaseWallet, injected, metaMask } from 'wagmi/connectors';

// Get project ID from environment
const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'e78d121a165909ad1ec1cd20c2af0f9a';

export const config = createConfig({
  chains: [base, baseSepolia],
  connectors: [
    injected(),
    coinbaseWallet({
      appName: 'BTB Finance',
      appLogoUrl: 'https://btb.finance/logo.png'
    }),
    // WalletConnect as last option
    walletConnect({ 
      projectId: walletConnectProjectId,
      metadata: {
        name: 'BTB Finance',
        description: 'The most capital efficient token in DeFi',
        url: typeof window !== 'undefined' ? window.location.origin : 'https://btb.finance',
        icons: ['https://btb.finance/logo.png']
      },
      showQrModal: false  // Disable QR modal popup
    })
  ],
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