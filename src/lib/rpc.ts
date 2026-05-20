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
 * Add/remove RPCs here — nowhere else.
 */
export const MAINNET_RPCS = [
  'https://eth.llamarpc.com',
  'https://cloudflare-eth.com',
  'https://rpc.ankr.com/eth',
  'https://ethereum.publicnode.com',
  'https://ethereum-rpc.publicnode.com',
  'https://1rpc.io/eth',
  'https://eth.drpc.org',
  'https://eth.blockrazor.xyz',
  'https://api.zan.top/eth-mainnet',
  'https://ethereum-mainnet.gateway.tatum.io',
  'https://eth.rpc.blxrbdn.com',
  'https://rpc.eth.gateway.fm',
  'https://gateway.tenderly.co/public/mainnet',
  'https://mainnet.gateway.tenderly.co',
  'https://eth1.lava.build',
  'https://rpc.flashbots.net',
  'https://eth.api.onfinality.io/public',
  'https://0xrpc.io/eth',
  'https://ethereum.public.blockpi.network/v1/rpc/public',
  'https://eth-mainnet.public.blastapi.io',
  'https://eth.meowrpc.com',
  'https://rpc.payload.de',
];

/** Wagmi transport for chain 1 — falls over to the next RPC if one fails. */
export const MAINNET_TRANSPORT: Transport = fallback(MAINNET_RPCS.map(url => http(url)));
