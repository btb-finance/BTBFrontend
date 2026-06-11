/**
 * Uniswap — Ethereum mainnet liquidity integration. Single import surface.
 *
 *   v3/  — shipping: read positions + collect + add + remove + mint (native ETH)
 *   v4/  — scaffold: addresses + ABIs (execution staged: Permit2 + actions)
 *
 * Shared cross-protocol types live in `@/protocols/types`.
 */
export const PROTOCOL = 'uniswap';

export type { LiquidityPosition, TokenMeta } from '@/protocols/types';
export { MAINNET } from '@/protocols/types';

// pool discovery (official V3/V4 subgraphs — TVL, volume, fees, APR)
export { queryTopPools, getPoolHistory, fmtFeeTier, hasGraphKey, V3_SUBGRAPH_ID } from './graph';
export type { IndexedPool, PoolDay } from './graph';
export { getV3TopPools } from './v3/subgraph';
export { getV4TopPools } from './v4/subgraph';

// v3
export { fetchV3Positions } from './v3/positions';
export { buildCollect, buildRemove, buildIncrease, buildMint } from './v3/actions';
export { addAmounts, addSide, rangeTicks, nearestUsableTick, liquidityForAmounts, TICK_SPACINGS, MIN_TICK, MAX_TICK } from './v3/math';
export { fetchPoolForMint, fetchPoolsForMint } from './v3/pool';
export type { MintPool } from './v3/pool';
export { UNISWAP_V3, FEE_TIERS, WETH, isWeth } from './v3/addresses';

// v4 (scaffold)
export { UNISWAP_V4 } from './v4/addresses';
