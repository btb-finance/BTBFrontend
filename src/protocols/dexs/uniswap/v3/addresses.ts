/** Uniswap V3 — Ethereum mainnet (chain 1) canonical deployments. */
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
export const WETH = '0xC02aaa39b223FE8D0A0e5C4F27eAD9083C756Cc2' as `0x${string}`;

export function isWeth(addr: string): boolean {
  return addr.toLowerCase() === WETH.toLowerCase();
}
