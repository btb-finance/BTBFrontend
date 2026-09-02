import { createPublicClient, defineChain, http, type Chain, type PublicClient } from 'viem';
import {
  arbitrum, avalanche, base, berachain, blast, bsc, etherlink, fantom,
  hyperEvm, linea, mainnet, mantle, megaeth, monad, optimism, plasma,
  polygon, ronin, scroll, sonic, unichain, zkSync,
} from 'viem/chains';
import { CHAIN_RPC_URLS } from './chainRpc';

/**
 * Server-side public clients for on-chain enrichment. The Robinhood chain
 * object is re-declared here (with its live Multicall3) so server routes
 * don't need to import the browser wallet stack from lib/wagmi.
 */
const robinhood = defineChain({
  id: 4663,
  name: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.mainnet.chain.robinhood.com/'] } },
  contracts: {
    multicall3: { address: '0xcA11bde05977b3631167028862bE2a173976CA11' },
  },
});

const CHAINS: Record<number, Chain> = {
  1: mainnet,
  56: bsc,
  137: polygon,
  42161: arbitrum,
  10: optimism,
  8453: base,
  43114: avalanche,
  80094: berachain,
  146: sonic,
  2020: ronin,
  130: unichain,
  59144: linea,
  999: hyperEvm,
  9745: plasma,
  42793: etherlink,
  5000: mantle,
  143: monad,
  4326: megaeth,
  534352: scroll,
  250: fantom,
  81457: blast,
  324: zkSync,
  4663: robinhood,
};

/** Public client with the verified failover transports — server-side only. */
export function getChainClient(chainId: number): PublicClient | null {
  const chain = CHAINS[chainId];
  if (!chain) return null;
  return createPublicClient({
    chain,
    transport: http(CHAIN_RPC_URLS[chainId]?.[0], { timeout: 15_000, retryCount: 1 }),
  });
}
