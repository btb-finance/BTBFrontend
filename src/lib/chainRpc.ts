import { fallback, http, type Transport } from 'viem';
import { ROBINHOOD_RPC_UPSTREAMS } from './robinhoodRpc';

/**
 * Keyless RPC fallbacks per chain — the cross-chain read path (token metadata,
 * pool probes, cross-chain research) used to ride viem's single default public
 * RPC per chain, which rate-limits and fails often. Every endpoint here was
 * verified live (eth_chainId plus a multicall3 eth_call, batch JSON-RPC) before
 * being listed; order = fastest first at the time of the check.
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
  1: [
    'https://eth.api.pocket.network', 'https://gateway.tenderly.co/public/mainnet', 'https://eth.rpc.blxrbdn.com',
    'https://ethereum.public.blockpi.network/v1/rpc/public', 'https://0xrpc.io/eth', 'https://eth.blockrazor.xyz',
    'https://eth.drpc.org', 'https://ethereum-rpc.publicnode.com', 'https://1.rpc.thirdweb.com', 'https://eth.meowrpc.com',
  ],
  56: [
    'https://rpc.swiftnodes.io/rpc/bsc', 'https://bsc.rpc.blxrbdn.com', 'https://bsc.api.pocket.network', 'https://public.1rpc.io/bnb',
    'https://bsc-dataseed1.bnbchain.org', 'https://bsc-dataseed1.defibit.io', 'https://bsc-dataseed1.ninicoin.io', 'https://bsc-dataseed2.bnbchain.org',
    'https://rpc-bsc.48.club', 'https://binance.nodereal.io', 'https://bsc-mainnet.public.blastapi.io', 'https://bsc-rpc.publicnode.com',
    'https://bsc-dataseed.bnbchain.org', 'https://56.rpc.thirdweb.com',
  ],
  137: ['https://polygon-bor-rpc.publicnode.com', 'https://polygon.drpc.org'],
  42161: ['https://arbitrum-one-rpc.publicnode.com', 'https://arbitrum.drpc.org'],
  10: ['https://optimism-rpc.publicnode.com', 'https://optimism.drpc.org'],
  // Base carries most of auto-rebalance, so it gets a deep list: two endpoints alone rate-limited and cost users
  // their positions on screen. All verified live with a batched eth_call and CORS for the page.
  8453: [
    'https://base-rpc.publicnode.com', 'https://mainnet.base.org', 'https://base.gateway.tenderly.co', 'https://1rpc.io/base',
    'https://base.meowrpc.com', 'https://base.api.pocket.network', 'https://base-mainnet.public.blastapi.io', 'https://base.drpc.org',
  ],
  43114: ['https://avalanche-c-chain-rpc.publicnode.com', 'https://avalanche.drpc.org'],
  59144: ['https://linea-rpc.publicnode.com', 'https://linea.drpc.org'],
  534352: ['https://scroll-rpc.publicnode.com', 'https://scroll.drpc.org'],
  5000: ['https://mantle-rpc.publicnode.com', 'https://mantle.drpc.org'],
  81457: ['https://blast-rpc.publicnode.com', 'https://blast.drpc.org'],
  130: ['https://unichain-rpc.publicnode.com', 'https://unichain.drpc.org'],
  324: ['https://mainnet.era.zksync.io', 'https://zksync.drpc.org'],
  250: ['https://rpc.fantom.network', 'https://fantom.drpc.org'],
  80094: ['https://berachain-rpc.publicnode.com', 'https://rpc.berachain.com'],
  9745: ['https://rpc.plasma.to'],
  143: [
    'https://rpc.monad.xyz', 'https://rpc2.monad.xyz', 'https://rpc.swiftnodes.io/rpc/monad', 'https://rpc1.monad.xyz', 'https://rpc3.monad.xyz',
    'https://monad-rpc.huginn.tech', 'https://infra.originstake.com/monad/evm', 'https://monad-mainnet.rpc.sentio.xyz', 'https://rpc4.monad.xyz',
    'https://143.rpc.thirdweb.com',
  ],
  2020: ['https://api.roninchain.com/rpc'],
  4326: ['https://mainnet.megaeth.com/rpc'],
  999: ['https://rpc.hyperliquid.xyz/evm'],
  42793: ['https://etherlink.drpc.org'],
  // Arc's own endpoint first; the partner RPCs behind it each passed a
  // parallel multicall load test (5 x 20 reads) on 2026-09-23.
  5042: ['https://rpc.mainnet.arc.io', 'https://rpc.beamrpc.com', 'https://rpc.blockdaemon.mainnet.arc.io', 'https://rpc.quicknode.mainnet.arc.io', 'https://rpc.drpc.mainnet.arc.io'],
  // Robinhood Chain intentionally omitted: it routes through its own pooled
  // proxy (see ./robinhoodRpc.ts), and getChainClient falls back to the chain
  // object's default endpoint, which is that same RPC.
};

/** Failover transport for a chain: every listed endpoint, preferred first. */
export function chainTransport(chainId: number): Transport {
  // Robinhood Chain: the verified upstream pool (the page's own proxy is not reachable from the server).
  const urls = CHAIN_RPC_URLS[chainId] ?? (chainId === 4663 ? ROBINHOOD_RPC_UPSTREAMS : undefined);
  if (!urls?.length) return http();
  return fallback(urls.map(url => http(url, { timeout: 15_000, retryCount: 1 })));
}
