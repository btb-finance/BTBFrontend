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
  'https://eth.rpc.blxrbdn.com',
  'https://api.zan.top/eth-mainnet',
  'https://eth.api.pocket.network',
  'https://rpc.eth.gateway.fm',
  'https://ethereum-mainnet.gateway.tatum.io',
  'https://eth.blockrazor.xyz',
  'https://eth.api.onfinality.io/public',
  'https://mainnet.gateway.tenderly.co',
  'https://eth.drpc.org',
  'https://0xrpc.io/eth',
  'https://rpc.flashbots.net/fast',
  'https://eth1.lava.build',
  'https://rpc.flashbots.net',
  'https://ethereum.therpc.io',
  'https://mainnet.rpc.sentio.xyz',
  'https://1rpc.io/eth',
  'https://ethereum.public.blockpi.network/v1/rpc/public',
  'https://ethereum-rpc.publicnode.com',
  'https://public-eth.nownodes.io',
  'https://ethereum-public.nodies.app',
  'https://gateway.tenderly.co/public/mainnet',
  'https://eth-mainnet.public.blastapi.io',
  'https://rpc.mevblocker.io',
  'https://rpc.fullsend.to',
];

/** Wagmi transport for chain 1 — falls over to the next RPC if one fails. */
export const MAINNET_TRANSPORT: Transport = fallback(MAINNET_RPCS.map(url => http(url)));
