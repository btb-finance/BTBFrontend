import { createConfig } from 'wagmi';
import {
  arbitrum, avalanche, base, berachain, blast, bsc, etherlink, fantom, hyperEvm,
  linea, mainnet, mantle, megaeth, monad, optimism, plasma, polygon, ronin, scroll,
  sonic, unichain, zkSync,
} from 'wagmi/chains';
import { defineChain, fallback, http } from 'viem';
import { injected, coinbaseWallet, walletConnect, metaMask } from '@wagmi/connectors';
import { MAINNET_TRANSPORT } from './rpc';
import { chainTransport } from './chainRpc';
import { ROBINHOOD_RPC_UPSTREAMS } from './robinhoodRpc';

export const robinhoodChain = defineChain({
  id: 4663, name: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.mainnet.chain.robinhood.com/'] } },
  blockExplorers: { default: { name: 'Robinhood Explorer', url: 'https://robinhoodchain.blockscout.com' } },
  // Multicall3 is live at the canonical address on this chain — verified by
  // reading real fee/slot0 results through aggregate3. Without this, viem
  // multicalls can't batch and every read becomes its own RPC request.
  contracts: {
    multicall3: {
      address: '0xcA11bde05977b3631167028862bE2a173976CA11',
    },
  },
});

export const ROBINHOOD_RPC_URLS = Array.from(new Set([
  // Same-origin reads are the most reliable path on Netlify — the proxy
  // round-robins the verified public pool server-side. Direct RPCs stay
  // available as fallbacks and are also used outside a browser origin;
  // only CORS-enabled endpoints work from a page, the rest cost one
  // failed hop when the proxy is down.
  typeof window !== 'undefined' ? '/api/robinhood-rpc' : undefined,
  ...ROBINHOOD_RPC_UPSTREAMS,
  process.env.NEXT_PUBLIC_ROBINHOOD_RPC_URL,
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
      // Every non-mainnet chain previously rode viem's single default public
      // RPC — one rate-limited endpoint with no fallback. chainTransport gives
      // each a verified multi-endpoint failover list (see ./chainRpc.ts).
      [bsc.id]: chainTransport(bsc.id), [polygon.id]: chainTransport(polygon.id),
      [arbitrum.id]: chainTransport(arbitrum.id), [optimism.id]: chainTransport(optimism.id),
      [base.id]: chainTransport(base.id), [avalanche.id]: chainTransport(avalanche.id),
      [berachain.id]: chainTransport(berachain.id), [sonic.id]: chainTransport(sonic.id),
      [ronin.id]: chainTransport(ronin.id), [unichain.id]: chainTransport(unichain.id),
      [linea.id]: chainTransport(linea.id), [hyperEvm.id]: chainTransport(hyperEvm.id),
      [plasma.id]: chainTransport(plasma.id), [etherlink.id]: chainTransport(etherlink.id),
      [mantle.id]: chainTransport(mantle.id), [monad.id]: chainTransport(monad.id),
      [scroll.id]: chainTransport(scroll.id), [fantom.id]: chainTransport(fantom.id),
      [blast.id]: chainTransport(blast.id), [zkSync.id]: chainTransport(zkSync.id),
      [megaeth.id]: chainTransport(megaeth.id),
      [robinhoodChain.id]: robinhoodTransport(),
    },
    connectors,
  });
}

// Addresses live in ./contractAddresses (no wallet-stack imports) so Convex
// actions can read them; re-exported here to keep every existing import site
// pointing at `@/lib/wagmi`.
export { CONTRACTS } from './contractAddresses';

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
