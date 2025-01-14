import { createConfig, http } from 'wagmi';
import { mainnet, optimism } from 'wagmi/chains';
import { getDefaultConfig } from '@rainbow-me/rainbowkit';

export const config = getDefaultConfig({
  appName: 'BTB Finance',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID',
  chains: [mainnet, optimism],
  transports: {
    [mainnet.id]: http(),
    [optimism.id]: http(),
  },
});
