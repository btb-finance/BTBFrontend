import { fallback, http, type Transport } from 'viem';

/**
 * Keyless RPC fallbacks per chain — the cross-chain read path (token metadata,
 * pool probes, cross-chain research) used to ride viem's single default public
 * RPC per chain, which rate-limits and fails often. Every endpoint here was
 * verified live with eth_chainId before being listed; order = preferred first.
 *
 * Ethereum mainnet has its own long list — see ./rpc.ts (MAINNET_TRANSPORT).
 * Robinhood Chain routes through its own pooled proxy — see ./robinhoodRpc.ts.
 * Add/remove endpoints here — nowhere else.
 */
export const CHAIN_RPC_URLS: Record<number, readonly string[]> = {
  // Ethereum was missing here, so any consumer going through getChainClient
  // (the pool enrichment route, the Discover discovery pass) fell through to
  // viem's built in default endpoint and hung. The dedicated failover list in
  // ./rpc.ts is still what the wallet config uses; this is the keyless subset
  // for server side reads.
  1: ['https://eth.drpc.org', 'https://ethereum.publicnode.com', 'https://eth.llamarpc.com'],
  56: ['https://bsc-rpc.publicnode.com', 'https://bsc-dataseed.bnbchain.org'],
  137: ['https://polygon-bor-rpc.publicnode.com', 'https://polygon.drpc.org'],
  42161: ['https://arbitrum-one-rpc.publicnode.com', 'https://arbitrum.drpc.org'],
  10: ['https://optimism-rpc.publicnode.com', 'https://optimism.drpc.org'],
  8453: ['https://base-rpc.publicnode.com', 'https://base.drpc.org'],
  43114: ['https://avalanche-c-chain-rpc.publicnode.com', 'https://avalanche.drpc.org'],
  146: ['https://sonic-rpc.publicnode.com', 'https://sonic.drpc.org'],
  59144: ['https://linea-rpc.publicnode.com', 'https://linea.drpc.org'],
  534352: ['https://scroll-rpc.publicnode.com', 'https://scroll.drpc.org'],
  5000: ['https://mantle-rpc.publicnode.com', 'https://mantle.drpc.org'],
  81457: ['https://blast-rpc.publicnode.com', 'https://blast.drpc.org'],
  130: ['https://unichain-rpc.publicnode.com', 'https://unichain.drpc.org'],
  324: ['https://mainnet.era.zksync.io', 'https://zksync.drpc.org'],
  250: ['https://rpc.fantom.network', 'https://fantom.drpc.org'],
  80094: ['https://berachain-rpc.publicnode.com', 'https://rpc.berachain.com'],
  9745: ['https://rpc.plasma.to'],
  143: ['https://rpc.monad.xyz'],
  2020: ['https://api.roninchain.com/rpc'],
  4326: ['https://mainnet.megaeth.com/rpc'],
  999: ['https://rpc.hyperliquid.xyz/evm'],
  42793: ['https://etherlink.drpc.org'],
  // Robinhood Chain intentionally omitted: it routes through its own pooled
  // proxy (see ./robinhoodRpc.ts), and getChainClient falls back to the chain
  // object's default endpoint, which is that same RPC.
};

/** Failover transport for a chain: every listed endpoint, preferred first. */
export function chainTransport(chainId: number): Transport {
  const urls = CHAIN_RPC_URLS[chainId];
  if (!urls?.length) return http();
  return fallback(urls.map(url => http(url, { timeout: 15_000, retryCount: 1 })));
}
