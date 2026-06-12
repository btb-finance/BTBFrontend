/**
 * PancakeSwap V3 — Ethereum mainnet only. Single import surface.
 *
 * PancakeSwap V3 is a byte-compatible fork of Uniswap V3 (same
 * NonfungiblePositionManager/Factory/Pool ABIs, same tick math, ERC721-
 * enumerable NPM), so everything here delegates to the shared V3 modules in
 * `../uniswap/v3/*` with PancakeSwap's deployment: different addresses and a
 * 2500-bps tier (spacing 50) instead of Uniswap's 3000 (spacing 60).
 *
 * Both addresses are PancakeSwap's deterministic cross-chain deployments
 * (identical on BNB Chain — see developer.pancakeswap.finance/contracts/v3).
 */
import type { PublicClient } from 'viem';
import type { V3Deployment } from '../uniswap/v3/addresses';
import { fetchV3Positions } from '../uniswap/v3/positions';
import { queryTopPools, getPoolHistory, type IndexedPool, type PoolDay } from '../uniswap/graph';
import type { LiquidityPosition } from '@/protocols/types';

export const PANCAKE_V3_DEPLOYMENT: V3Deployment = {
  protocol: 'pancakeswap-v3',
  positionManager: '0x46A15B0b27311cedF172AB29E4f4766fbE7F4364',
  factory: '0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865',
  feeTiers: [100, 500, 2500, 10000],
  tickSpacings: { 100: 1, 500: 10, 2500: 50, 10000: 200 },
};

/**
 * PancakeSwap exchange-v3-eth on The Graph's decentralized network (from the
 * official developer docs). Discovery/charts only — if the id ever rotates,
 * pools fall back to DeFiLlama and positions stay on-chain, so nothing breaks.
 */
export const PANCAKE_V3_SUBGRAPH_ID = '9psTWtnVVQwSHUVRtCuR8985UfzotdtdZwVt8K9kJGeg';

/** Top PancakeSwap V3 mainnet pools — same V3 subgraph schema as Uniswap's. */
export function getPancakeTopPools(limit = 20, minTvlUsd = 100_000): Promise<IndexedPool[]> {
  return queryTopPools(PANCAKE_V3_SUBGRAPH_ID, 'v3', limit, minTvlUsd);
}

/** 30-day daily history for one pool (price/volume/fees) — chart + earnings sim. */
export function getPancakePoolHistory(poolAddress: string, days = 30): Promise<PoolDay[]> {
  return getPoolHistory(PANCAKE_V3_SUBGRAPH_ID, poolAddress, days);
}

/** The wallet's PancakeSwap V3 positions — on-chain NPM enumeration, keyless. */
export function fetchPancakePositions(client: PublicClient, owner: `0x${string}`): Promise<LiquidityPosition[]> {
  return fetchV3Positions(client, owner, PANCAKE_V3_DEPLOYMENT);
}
