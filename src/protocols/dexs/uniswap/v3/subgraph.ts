/**
 * Uniswap V3 mainnet pools from the official V3 subgraph — TVL, 24h volume,
 * 24h fees and fee APR computed from real fees. See `../graph.ts` for the
 * shared gateway client and key setup (NEXT_PUBLIC_GRAPH_KEY).
 */
import { queryTopPools, V3_SUBGRAPH_ID as SUBGRAPH_ID, IndexedPool } from '../graph';

export type V3IndexedPool = IndexedPool;

export function getV3TopPools(limit = 50, minTvlUsd = 100_000): Promise<IndexedPool[]> {
  return queryTopPools(SUBGRAPH_ID, 'v3', limit, minTvlUsd);
}
