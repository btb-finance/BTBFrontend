import { fallback, http } from 'viem';
import type { Transport } from 'viem';

/**
 * Single source of truth for Ethereum mainnet RPCs.
 *
 * Wagmi uses `MAINNET_TRANSPORT` (fallback) so contract reads & writes survive
 * a single endpoint going down or rate-limiting. Balance multicalls now run
 * server-side in Convex (`convex/balances.ts`) — the frontend no longer touches
 * these RPCs for portfolio loads.
 *
 * Ordered roughly by measured latency (chainlist health check). Keyless HTTPS
 * endpoints only — no wss (http transport), no embedded third-party API keys,
 * no virtual/fork networks.
 *
 * Add/remove RPCs here — nowhere else.
 */
export const MAINNET_RPCS = [
  // Each one answered a real eth_call (BTB balanceOf) on 2026-10-03. Dropped that day for failing it: zan (CU limit),
  // gateway.fm (503), tatum, onfinality (429), mainnet.gateway.tenderly.co, flashbots x2 (403 on reads),
  // lava (410, retired), therpc, 1rpc and public.1rpc (limits), publicnode, blastapi, mevblocker, meowrpc.
  'https://rpc-eth.blockmachine.io',
  'https://eth.api.pocket.network',
  'https://ethereum-json-rpc.stakely.io',
  'https://eth.rpc.blxrbdn.com',
  'https://virginia.rpc.blxrbdn.com',
  'https://uk.rpc.blxrbdn.com',
  'https://singapore.rpc.blxrbdn.com',
  'https://gateway.tenderly.co/public/mainnet',
  'https://rpc.fullsend.to',
  'https://mainnet.rpc.sentio.xyz',
  'https://public-eth.nownodes.io',
  'https://eth.blockrazor.xyz',
  'https://1.rpc.thirdweb.com',
  'https://0xrpc.io/eth',
  'https://rpc.swiftnodes.io/rpc/eth',
  'https://ethereum.public.blockpi.network/v1/rpc/public',
  'https://ethereum-public.nodies.app',
  'https://eth.drpc.org',
];

/** Wagmi transport for chain 1 — falls over to the next RPC if one fails. */
export const MAINNET_TRANSPORT: Transport = fallback(MAINNET_RPCS.map(url => http(url, { batch: { batchSize: 25, wait: 16 } })), { retryCount: 1 });
