/**
 * Uniswap — Ethereum mainnet liquidity integration. Single import surface.
 *
 *   v3/  — read positions + collect + add + remove + mint (native ETH)
 *   v4/  — read positions + collect + add + remove + mint (Permit2 + packed
 *          actions; native ETH is currency0 = address(0)). Tick/liquidity math
 *          is identical to V3 and reused from v3/math.
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

// v4
export { UNISWAP_V4, NATIVE_CURRENCY, isNativeCurrency } from './v4/addresses';
export type { PoolKey } from './v4/addresses';
export { fetchV4Positions } from './v4/positions';
export { buildV4Mint, buildV4Increase, buildV4Remove, buildV4Collect, maxIn } from './v4/actions';
export { fetchV4PoolForMint } from './v4/pool';
export type { V4MintPool } from './v4/pool';
