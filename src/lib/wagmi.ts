import { createConfig } from 'wagmi';
import {
  arbitrum, avalanche, base, berachain, blast, bsc, etherlink, fantom, hyperEvm,
  linea, mainnet, mantle, megaeth, monad, optimism, plasma, polygon, ronin, scroll,
  unichain, zkSync,
} from 'wagmi/chains';
import { defineChain, fallback, http } from 'viem';
import { injected, coinbaseWallet, walletConnect, metaMask, safe } from 'wagmi/connectors';
import { chainTransport } from './chainRpc';
import { lazyWalletSdk } from './lazyWalletSdk';
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

/** Arc (Circle): USDC is the gas token, 18 decimals at the protocol level. */
export const arcChain = defineChain({
  id: 5042, name: 'Arc',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.mainnet.arc.io'] } },
  blockExplorers: { default: { name: 'Arc Explorer', url: 'https://explorer.arc.io' } },
  contracts: { multicall3: { address: '0xcA11bde05977b3631167028862bE2a173976CA11' } },
});

export const ROBINHOOD_RPC_URLS = Array.from(new Set([
  // Same-origin reads are the most reliable path on Netlify — the proxy
  // round-robins the verified public pool server-side. Direct RPCs stay
  // available as fallbacks and are also used outside a browser origin;
  // only CORS-enabled endpoints work from a page, the rest cost one
  // failed hop when the proxy is down.
  // Absolute, not '/api/...': WalletConnect hands every chain's first RPC URL to its own provider, which
  // rejects a relative path ("Provided URL is not compatible with HTTP connection") and the connect fails.
  typeof window !== 'undefined' ? `${window.location.origin}/api/robinhood-rpc` : undefined,
  ...ROBINHOOD_RPC_UPSTREAMS,
  process.env.NEXT_PUBLIC_ROBINHOOD_RPC_URL,
].filter((url): url is string => Boolean(url))));

export function robinhoodTransport() {
  // Batched reads, and one pass down the list on failure (not viem's default of three more passes).
  return fallback(ROBINHOOD_RPC_URLS.map(url => http(url, {
    timeout: 20_000,
    batch: { batchSize: 25, wait: 16 },
  })), { retryCount: 1 });
}
export const SUPPORTED_CHAINS = [
  mainnet, bsc, polygon, arbitrum, optimism, base, avalanche, berachain,
  ronin, unichain, linea, hyperEvm, plasma, etherlink, mantle, scroll, fantom,
  blast, zkSync, monad, megaeth, robinhoodChain, arcChain,
] as const;
export type SupportedChain = typeof SUPPORTED_CHAINS[number];
export type SupportedChainId = SupportedChain['id'];

const DAPP_METADATA = {
  name: 'BTB Finance',
  description: 'Simulate, add and manage LP positions. Get paid every Friday.',
  url: 'https://btb.finance',
  icons: ['https://btb.finance/icon.png'],
};

export function makeConfig() {
  const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? 'b56e18d47c72ab683b10814fe9495694';
  // WalletConnect and other wallet connectors access indexedDB at construction
  // time, which crashes Node.js serverless (Netlify). Only create them in the
  // browser. See: https://github.com/vercel/next.js/discussions/82963
  const connectors = typeof window === 'undefined' ? [] : [
      // The three SDK connectors load their SDK only once this browser uses them (see ./lazyWalletSdk).
      lazyWalletSdk(metaMask({ dapp: { name: DAPP_METADATA.name, url: DAPP_METADATA.url } })),
      lazyWalletSdk(walletConnect({ projectId, showQrModal: true, metadata: DAPP_METADATA })),
      lazyWalletSdk(coinbaseWallet({ appName: DAPP_METADATA.name })),
      injected({ shimDisconnect: true }),
      // Safe{Wallet}: when BTB is opened as a Safe App (inside the Safe
      // iframe) this connector talks to the Safe through the Apps SDK and
      // every transaction becomes a Safe proposal. See public/manifest.json.
      // Last on purpose: the connect sheet falls back to connectors[0].
      safe({ allowedDomains: [/app\.safe\.global$/, /safe\.global$/, /gnosis-safe\.io$/], shimDisconnect: false }),
    ];
  return createConfig({
    chains: SUPPORTED_CHAINS,
    transports: {
      // The tested list first (convex/rpcHealth.ts, installed by Providers), then the hardcoded backup.
      [mainnet.id]: chainTransport(mainnet.id),
      // Every non-mainnet chain previously rode viem's single default public
      // RPC — one rate-limited endpoint with no fallback. chainTransport gives
      // each a verified multi-endpoint failover list (see ./chainRpc.ts).
      [bsc.id]: chainTransport(bsc.id), [polygon.id]: chainTransport(polygon.id),
      [arbitrum.id]: chainTransport(arbitrum.id), [optimism.id]: chainTransport(optimism.id),
      [base.id]: chainTransport(base.id), [avalanche.id]: chainTransport(avalanche.id),
      [berachain.id]: chainTransport(berachain.id),
      [ronin.id]: chainTransport(ronin.id), [unichain.id]: chainTransport(unichain.id),
      [linea.id]: chainTransport(linea.id), [hyperEvm.id]: chainTransport(hyperEvm.id),
      [plasma.id]: chainTransport(plasma.id), [etherlink.id]: chainTransport(etherlink.id),
      [mantle.id]: chainTransport(mantle.id), [monad.id]: chainTransport(monad.id),
      [scroll.id]: chainTransport(scroll.id), [fantom.id]: chainTransport(fantom.id),
      [blast.id]: chainTransport(blast.id), [zkSync.id]: chainTransport(zkSync.id),
      [megaeth.id]: chainTransport(megaeth.id),
      [robinhoodChain.id]: robinhoodTransport(),
      [arcChain.id]: chainTransport(arcChain.id),
    },
    connectors,
  });
}

// Addresses live in ./contractAddresses (no wallet-stack imports) so Convex
// actions can read them; re-exported here to keep every existing import site
// pointing at `@/lib/wagmi`.
export { CONTRACTS } from './contractAddresses';

export { CHAIN_META } from './chainMeta';
