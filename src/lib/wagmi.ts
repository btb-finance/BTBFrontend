import { createConfig } from 'wagmi';
import {
  arbitrum, avalanche, base, berachain, blast, bsc, etherlink, fantom, hyperEvm,
  linea, mainnet, mantle, megaeth, monad, optimism, plasma, polygon, ronin, scroll,
  sonic, unichain, zkSync,
} from 'wagmi/chains';
import { defineChain, fallback, http } from 'viem';
import { injected, coinbaseWallet, walletConnect, metaMask } from '@wagmi/connectors';
import { MAINNET_TRANSPORT } from './rpc';
import { ALCHEMY_KEY } from './alchemy';

const ALCHEMY_ROBINHOOD_RPC = `https://robinhood-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`;

export const robinhoodChain = defineChain({
  id: 4663, name: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [ALCHEMY_ROBINHOOD_RPC] } },
  blockExplorers: { default: { name: 'Robinhood Explorer', url: 'https://robinhoodchain.blockscout.com' } },
});

export const ROBINHOOD_RPC_URLS = Array.from(new Set([
  // Same-origin reads are the most reliable path on Netlify. Direct RPCs stay
  // available as fallbacks and are also used outside a browser origin.
  typeof window !== 'undefined' ? '/api/robinhood-rpc' : undefined,
  ALCHEMY_ROBINHOOD_RPC,
  process.env.NEXT_PUBLIC_ROBINHOOD_RPC_URL,
  'https://robinhood-mainnet-rpc.blockreq.com/v1/rpc/public',
  'https://rpc.nodeflare.app/robinhood/public',
  'https://rpc.mainnet.chain.robinhood.com/',
].filter((url): url is string => Boolean(url))));

export function robinhoodTransport() {
  return fallback(ROBINHOOD_RPC_URLS.map(url => http(url, {
    retryCount: url.startsWith('/') ? 1 : 0,
    timeout: 20_000,
  })));
}
export const SUPPORTED_CHAINS = [
  mainnet, bsc, polygon, arbitrum, optimism, base, avalanche, berachain, sonic,
  ronin, unichain, linea, hyperEvm, plasma, etherlink, mantle, scroll, fantom,
  blast, zkSync, monad, megaeth, robinhoodChain,
] as const;
export type SupportedChain = typeof SUPPORTED_CHAINS[number];
export type SupportedChainId = SupportedChain['id'];

const DAPP_METADATA = {
  name: 'BTB Finance',
  description: 'Swap, stake, and mint NFTs — BTB Finance mini app',
  url: 'https://btb.finance',
  icons: ['https://btb.finance/icon.png'],
};

export function makeConfig() {
  const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? 'b56e18d47c72ab683b10814fe9495694';
  // WalletConnect and other wallet connectors access indexedDB at construction
  // time, which crashes Node.js serverless (Netlify). Only create them in the
  // browser. See: https://github.com/vercel/next.js/discussions/82963
  const connectors = typeof window === 'undefined' ? [] : [
      metaMask({ dapp: { name: DAPP_METADATA.name, url: DAPP_METADATA.url } }),
      walletConnect({ projectId, showQrModal: true, metadata: DAPP_METADATA }),
      coinbaseWallet({ appName: DAPP_METADATA.name }),
      injected({ shimDisconnect: true }),
    ];
  return createConfig({
    chains: SUPPORTED_CHAINS,
    transports: {
      [mainnet.id]: MAINNET_TRANSPORT,
      [bsc.id]: http(), [polygon.id]: http(), [arbitrum.id]: http(), [optimism.id]: http(),
      [base.id]: http(), [avalanche.id]: http(), [berachain.id]: http(), [sonic.id]: http(),
      [ronin.id]: http(), [unichain.id]: http(), [linea.id]: http(), [hyperEvm.id]: http(),
  [plasma.id]: http(), [etherlink.id]: http(), [mantle.id]: http(), [monad.id]: http(), [scroll.id]: http(),
      [fantom.id]: http(), [blast.id]: http(), [zkSync.id]: http(), [megaeth.id]: http(),
      [robinhoodChain.id]: robinhoodTransport(),
    },
    connectors,
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
  4663:   { name: 'Robinhood Chain', symbol: 'ETH', color: '#00C805' },
  250:    { name: 'Fantom',    symbol: 'FTM',  color: '#1969FF' },
  59144:  { name: 'Linea',     symbol: 'ETH',  color: '#61DFFF' },
  534352: { name: 'Scroll',    symbol: 'ETH',  color: '#FFEEDA' },
  324:    { name: 'zkSync',    symbol: 'ETH',  color: '#8C8DFC' },
  81457:  { name: 'Blast',     symbol: 'ETH',  color: '#FCFC03' },
  80094:  { name: 'Berachain', symbol: 'BERA', color: '#FF8A00' },
  146:    { name: 'Sonic', symbol: 'S', color: '#7C5CFC' },
  2020:   { name: 'Ronin', symbol: 'RON', color: '#1273EA' },
  130:    { name: 'Unichain', symbol: 'ETH', color: '#FF37C7' },
  999:    { name: 'HyperEVM', symbol: 'HYPE', color: '#50E3C2' },
  9745:   { name: 'Plasma', symbol: 'XPL', color: '#7B61FF' },
  42793:  { name: 'Etherlink', symbol: 'XTZ', color: '#2C7DF7' },
  5000:   { name: 'Mantle', symbol: 'MNT', color: '#00D1B2' },
  143:    { name: 'Monad', symbol: 'MON', color: '#836EF9' },
  4326:   { name: 'MegaETH', symbol: 'ETH', color: '#F04E45' },
};
