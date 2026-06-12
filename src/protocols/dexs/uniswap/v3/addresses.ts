/**
 * Uniswap V3 — Ethereum mainnet (chain 1) canonical deployments.
 *
 * The V3 modules (positions/actions/pool) are written against a `V3Deployment`
 * so byte-compatible forks (PancakeSwap V3) reuse them with different
 * addresses/fee tiers — see `src/protocols/dexs/pancakeswap/`.
 */
export const UNISWAP_V3 = {
  /** NonfungiblePositionManager — mints/owns position NFTs, collect/decrease/increase. */
  positionManager: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88' as `0x${string}`,
  /** UniswapV3Factory — getPool(token0, token1, fee). */
  factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984' as `0x${string}`,
} as const;

/** Standard V3 fee tiers (hundredths of a bip). */
export const FEE_TIERS = [100, 500, 3000, 10000] as const;

export const MAX_UINT128 = (1n << 128n) - 1n;

/** Canonical WETH9 on Ethereum mainnet — the wrapped-ETH token in V3 pools. */
// NOTE: must be the EXACT EIP-55 checksum — viem rejects mixed-case addresses
// with a wrong checksum when encoding call arguments.
export const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' as `0x${string}`;

export function isWeth(addr: string): boolean {
  return addr.toLowerCase() === WETH.toLowerCase();
}

/** A V3-architecture DEX deployment (Uniswap V3 or a byte-compatible fork). */
export interface V3Deployment {
  /** Position tag used in LiquidityPosition.protocol. */
  protocol: 'uniswap-v3' | 'pancakeswap-v3';
  positionManager: `0x${string}`;
  factory: `0x${string}`;
  feeTiers: readonly number[];
  /** Tick spacing per fee tier. */
  tickSpacings: Record<number, number>;
}

export const UNISWAP_V3_DEPLOYMENT: V3Deployment = {
  protocol: 'uniswap-v3',
  positionManager: UNISWAP_V3.positionManager,
  factory: UNISWAP_V3.factory,
  feeTiers: FEE_TIERS,
  tickSpacings: { 100: 1, 500: 10, 3000: 60, 10000: 200 },
};
