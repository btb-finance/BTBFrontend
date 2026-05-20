import { createConfig } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { injected, coinbaseWallet, walletConnect, metaMask } from '@wagmi/connectors';
import { MAINNET_TRANSPORT } from './rpc';

// Everything in this app lives on Ethereum mainnet — wagmi is locked to chain 1
// so reads/writes never need an explicit chainId and the wallet can only
// connect on mainnet.
export const SUPPORTED_CHAINS = [mainnet] as const;
export type SupportedChain = typeof SUPPORTED_CHAINS[number];

const DAPP_METADATA = {
  name: 'BTB Finance',
  description: 'Swap, stake, and mint NFTs — BTB Finance mini app',
  url: 'https://btb.finance',
  icons: ['https://btb.finance/icon.png'],
};

export function makeConfig() {
  const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? 'b56e18d47c72ab683b10814fe9495694';
  return createConfig({
    chains: SUPPORTED_CHAINS,
    transports: { [mainnet.id]: MAINNET_TRANSPORT },
    connectors: [
      // MetaMask SDK — handles mobile deep-linking (no window.ethereum needed).
      // On desktop with the extension, this still uses the injected provider.
      metaMask({ dappMetadata: { name: DAPP_METADATA.name, url: DAPP_METADATA.url } }),
      // WalletConnect v2 — explicit `showQrModal: true` so the wallet picker
      // actually opens on every device (including mobile browsers).
      walletConnect({ projectId, showQrModal: true, metadata: DAPP_METADATA }),
      coinbaseWallet({ appName: DAPP_METADATA.name }),
      // Catch-all for any other injected provider (Brave, Rabby, OKX, etc.).
      injected({ shimDisconnect: true }),
    ],
  });
}

export const CONTRACTS = {
  BTB:          '0x88888888c90CD71B35830daBFD24743DbC135B51' as `0x${string}`,
  BTBB:         '0x88888880d5Ca13018D2dC11e2e4744BD91a5656f' as `0x${string}`,
  BEAR_NFT:     '0x88888888aBa934ceA0b4f0000FeA62F1397D02A0' as `0x${string}`,
  BEAR_STAKING: '0x8888888Faf81E6a98deb2B90A05B46b6E903e927' as `0x${string}`,
  OPOS:         '0x88888805E7e3d5c7FB002AD98f08250E79c298dC' as `0x${string}`,
  FLIP:         '0x8888889C878a0aE26033799517461af33a8E50a0' as `0x${string}`,
};

// Chain metadata for UI display
export const CHAIN_META: Record<number, { name: string; symbol: string; color: string }> = {
  1:      { name: 'Ethereum',  symbol: 'ETH',  color: '#627EEA' },
  56:     { name: 'BNB Chain', symbol: 'BNB',  color: '#F3BA2F' },
  137:    { name: 'Polygon',   symbol: 'MATIC', color: '#8247E5' },
  42161:  { name: 'Arbitrum',  symbol: 'ETH',  color: '#28A0F0' },
  10:     { name: 'Optimism',  symbol: 'ETH',  color: '#FF0420' },
  8453:   { name: 'Base',      symbol: 'ETH',  color: '#0052FF' },
  43114:  { name: 'Avalanche', symbol: 'AVAX', color: '#E84142' },
  250:    { name: 'Fantom',    symbol: 'FTM',  color: '#1969FF' },
  59144:  { name: 'Linea',     symbol: 'ETH',  color: '#61DFFF' },
  534352: { name: 'Scroll',    symbol: 'ETH',  color: '#FFEEDA' },
};
