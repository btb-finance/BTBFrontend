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

// v3
export { fetchV3Positions } from './v3/positions';
export { buildCollect, buildRemove, buildIncrease, buildMint } from './v3/actions';
export { addAmounts, addSide, rangeTicks, TICK_SPACINGS } from './v3/math';
export { fetchPoolForMint } from './v3/pool';
export type { MintPool } from './v3/pool';
export { UNISWAP_V3, FEE_TIERS, WETH, isWeth } from './v3/addresses';

// v4 (scaffold)
export { UNISWAP_V4 } from './v4/addresses';
