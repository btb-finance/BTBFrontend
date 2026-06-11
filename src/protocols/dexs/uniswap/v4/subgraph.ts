/**
 * Uniswap V4 mainnet pools from the official V4 subgraph — TVL, 24h volume,
 * 24h fees, fee APR and hook address. Same schema family as V3, so it shares
 * the gateway client in `../graph.ts` (key: NEXT_PUBLIC_GRAPH_KEY).
 *
 * Discovery only for now — in-app minting stays V3 until V4 execution
 * (Permit2 + actions) ships.
 */
import { queryTopPools, IndexedPool } from '../graph';

// Official Uniswap V4 Ethereum subgraph on the decentralized network.
const SUBGRAPH_ID = '8B2wKxnkciCTc5HSgsAojF6vhKn6wxQ1nVecYzMge1hA';

export type V4IndexedPool = IndexedPool;

export function getV4TopPools(limit = 30, minTvlUsd = 100_000): Promise<IndexedPool[]> {
  return queryTopPools(SUBGRAPH_ID, 'v4', limit, minTvlUsd);
}
