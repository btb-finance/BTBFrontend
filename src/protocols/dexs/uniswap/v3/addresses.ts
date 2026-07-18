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

export const ROBINHOOD_UNISWAP_V3_DEPLOYMENT: V3Deployment = {
  protocol: 'uniswap-v3',
  positionManager: '0x73991a25c818bf1f1128deaab1492d45638de0d3',
  factory: '0x1f7d7550b1b028f7571e69a784071f0205fd2efa',
  feeTiers: FEE_TIERS,
  tickSpacings: { 100: 1, 500: 10, 3000: 60, 10000: 200 },
};

/**
 * Official Uniswap V3 deployments by chain. The V3 ABI and simulator math are
 * shared, but factory/NPM addresses are not guaranteed to be the same.
 * Source: https://developers.uniswap.org/docs/protocols/v3/deployments
 */
export const UNISWAP_V3_DEPLOYMENTS: Record<number, V3Deployment> = {
  1: UNISWAP_V3_DEPLOYMENT,
  10: UNISWAP_V3_DEPLOYMENT,
  137: UNISWAP_V3_DEPLOYMENT,
  42161: UNISWAP_V3_DEPLOYMENT,
  8453: {
    ...UNISWAP_V3_DEPLOYMENT,
    factory: '0x33128a8fC17869897dcE68Ed026d694621f6FDfD',
    positionManager: '0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1',
  },
  56: {
    ...UNISWAP_V3_DEPLOYMENT,
    factory: '0xdB1d10011AD0Ff90774D0C6Bb92e5C5c8b4461F7',
    positionManager: '0x7b8A01B39D58278b5DE7e48c8449c9f4F5170613',
  },
  43114: {
    ...UNISWAP_V3_DEPLOYMENT,
    factory: '0x740b1c1de25031C31FF4fC9A62f554A55cdC1baD',
    positionManager: '0x655C406EBFa14EE2006250925e54ec43AD184f8B',
  },
  130: {
    ...UNISWAP_V3_DEPLOYMENT,
    factory: '0x1f98400000000000000000000000000000000003',
    positionManager: '0x943e6e07a7e8e791dafc44083e54041d743c46e9',
  },
  324: {
    ...UNISWAP_V3_DEPLOYMENT,
    factory: '0x8FdA5a7a8dCA67BBcDd10F02Fa0649A937215422',
    positionManager: '0x0616e5762c1E7Dc3723c50663dF10a162D690a86',
  },
  143: {
    ...UNISWAP_V3_DEPLOYMENT,
    factory: '0x204faca1764b154221e35c0d20abb3c525710498',
    positionManager: '0x7197e214c0b767cfb76fb734ab638e2c192f4e53',
  },
  4326: {
    ...UNISWAP_V3_DEPLOYMENT,
    factory: '0x3a5f0cd7d62452b7f899b2a5758bfa57be0de478',
    positionManager: '0xcdc86e98184e96436f733a8bf31bd4f0214e6d7d',
  },
  4663: ROBINHOOD_UNISWAP_V3_DEPLOYMENT,
};

export function uniswapV3DeploymentForChain(chainId: number): V3Deployment | null {
  return UNISWAP_V3_DEPLOYMENTS[chainId] ?? null;
}
export const ROBINHOOD_WETH = '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73' as `0x${string}`;
export const ROBINHOOD_SWAP_ROUTER_02 = '0xcaf681a66d020601342297493863e78c959e5cb2' as `0x${string}`;
export const ROBINHOOD_UNIVERSAL_ROUTER = '0x8876789976decbfcbbbe364623c63652db8c0904' as `0x${string}`;
export const ROBINHOOD_QUOTER_V2 = '0x33e885ed0ec9bf04ecfb19341582aadcb4c8a9e7' as `0x${string}`;
