/**
 * Shared types for the per-protocol "earn" integrations.
 *
 * Protocols live under `src/protocols/<category>/<name>/` (e.g.
 * `src/protocols/dexs/uniswap/`) so each app is developed/maintained
 * independently. Uniswap ships `v3/` and `v4/` (read + collect + add + remove +
 * mint, native ETH).
 *
 * Everything here is Ethereum mainnet (chain 1) only for now.
 */

export const MAINNET = 1;

/** A liquidity position a user holds in a protocol. */
export interface LiquidityPosition {
  protocol: 'uniswap-v3' | 'uniswap-v4' | 'pancakeswap-v3';
  /** Position id (V3 = NFT tokenId; V4 = position tokenId). */
  id: bigint;
  /** V4: currencies — token0 = address(0) means native ETH. */
  token0: `0x${string}`;
  token1: `0x${string}`;
  symbol0: string;
  symbol1: string;
  decimals0: number;
  decimals1: number;
  fee: number;            // fee tier in hundredths of a bip (e.g. 3000 = 0.3%)
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  /** Pool state at read time — needed to compute add-liquidity pairing. */
  sqrtPriceX96: bigint;
  currentTick: number;
  /** Current underlying token amounts (raw), computed from price + range. */
  amount0: bigint;
  amount1: bigint;
  /** Fees owed/claimable (raw) — from the position's tokensOwed. */
  fees0: bigint;
  fees1: bigint;
  inRange: boolean;
}

/** Minimal token metadata used when rendering a position. */
export interface TokenMeta {
  address: `0x${string}`;
  symbol: string;
  decimals: number;
}
