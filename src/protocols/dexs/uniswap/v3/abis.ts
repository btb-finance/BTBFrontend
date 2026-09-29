/** Minimal ABIs for Uniswap V3 — only the functions this app calls. */

export const NPM_ABI = [
  { name: 'ownerOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ name: '', type: 'address' }] },
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'tokenOfOwnerByIndex', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'index', type: 'uint256' }], outputs: [{ type: 'uint256' }] },
  {
    name: 'positions', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [
      { name: 'nonce', type: 'uint96' },
      { name: 'operator', type: 'address' },
      { name: 'token0', type: 'address' },
      { name: 'token1', type: 'address' },
      { name: 'fee', type: 'uint24' },
      { name: 'tickLower', type: 'int24' },
      { name: 'tickUpper', type: 'int24' },
      { name: 'liquidity', type: 'uint128' },
      { name: 'feeGrowthInside0LastX128', type: 'uint256' },
      { name: 'feeGrowthInside1LastX128', type: 'uint256' },
      { name: 'tokensOwed0', type: 'uint128' },
      { name: 'tokensOwed1', type: 'uint128' },
    ],
  },
  {
    name: 'collect', type: 'function', stateMutability: 'payable',
    inputs: [{
      name: 'params', type: 'tuple', components: [
        { name: 'tokenId', type: 'uint256' },
        { name: 'recipient', type: 'address' },
        { name: 'amount0Max', type: 'uint128' },
        { name: 'amount1Max', type: 'uint128' },
      ],
    }],
    outputs: [{ name: 'amount0', type: 'uint256' }, { name: 'amount1', type: 'uint256' }],
  },
  {
    name: 'decreaseLiquidity', type: 'function', stateMutability: 'payable',
    inputs: [{
      name: 'params', type: 'tuple', components: [
        { name: 'tokenId', type: 'uint256' },
        { name: 'liquidity', type: 'uint128' },
        { name: 'amount0Min', type: 'uint256' },
        { name: 'amount1Min', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
      ],
    }],
    outputs: [{ name: 'amount0', type: 'uint256' }, { name: 'amount1', type: 'uint256' }],
  },
  {
    name: 'increaseLiquidity', type: 'function', stateMutability: 'payable',
    inputs: [{
      name: 'params', type: 'tuple', components: [
        { name: 'tokenId', type: 'uint256' },
        { name: 'amount0Desired', type: 'uint256' },
        { name: 'amount1Desired', type: 'uint256' },
        { name: 'amount0Min', type: 'uint256' },
        { name: 'amount1Min', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
      ],
    }],
    outputs: [{ name: 'liquidity', type: 'uint128' }, { name: 'amount0', type: 'uint256' }, { name: 'amount1', type: 'uint256' }],
  },
  {
    name: 'mint', type: 'function', stateMutability: 'payable',
    inputs: [{
      name: 'params', type: 'tuple', components: [
        { name: 'token0', type: 'address' },
        { name: 'token1', type: 'address' },
        { name: 'fee', type: 'uint24' },
        { name: 'tickLower', type: 'int24' },
        { name: 'tickUpper', type: 'int24' },
        { name: 'amount0Desired', type: 'uint256' },
        { name: 'amount1Desired', type: 'uint256' },
        { name: 'amount0Min', type: 'uint256' },
        { name: 'amount1Min', type: 'uint256' },
        { name: 'recipient', type: 'address' },
        { name: 'deadline', type: 'uint256' },
      ],
    }],
    outputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'liquidity', type: 'uint128' },
      { name: 'amount0', type: 'uint256' },
      { name: 'amount1', type: 'uint256' },
    ],
  },
  { name: 'multicall', type: 'function', stateMutability: 'payable', inputs: [{ name: 'data', type: 'bytes[]' }], outputs: [{ name: 'results', type: 'bytes[]' }] },
  { name: 'refundETH', type: 'function', stateMutability: 'payable', inputs: [], outputs: [] },
  { name: 'unwrapWETH9', type: 'function', stateMutability: 'payable', inputs: [{ name: 'amountMinimum', type: 'uint256' }, { name: 'recipient', type: 'address' }], outputs: [] },
  { name: 'sweepToken', type: 'function', stateMutability: 'payable', inputs: [{ name: 'token', type: 'address' }, { name: 'amountMinimum', type: 'uint256' }, { name: 'recipient', type: 'address' }], outputs: [] },
] as const;

/** Slipstream NonfungiblePositionManager: positions() carries tickSpacing in
 * the slot V3 uses for fee, and mint() takes tickSpacing + sqrtPriceX96. */
export const SLIPSTREAM_NPM_ABI = [
  {
    name: 'positions', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [
      { name: 'nonce', type: 'uint96' },
      { name: 'operator', type: 'address' },
      { name: 'token0', type: 'address' },
      { name: 'token1', type: 'address' },
      { name: 'tickSpacing', type: 'int24' },
      { name: 'tickLower', type: 'int24' },
      { name: 'tickUpper', type: 'int24' },
      { name: 'liquidity', type: 'uint128' },
      { name: 'feeGrowthInside0LastX128', type: 'uint256' },
      { name: 'feeGrowthInside1LastX128', type: 'uint256' },
      { name: 'tokensOwed0', type: 'uint128' },
      { name: 'tokensOwed1', type: 'uint128' },
    ],
  },
  {
    name: 'mint', type: 'function', stateMutability: 'payable',
    inputs: [{
      name: 'params', type: 'tuple', components: [
        { name: 'token0', type: 'address' },
        { name: 'token1', type: 'address' },
        { name: 'tickSpacing', type: 'int24' },
        { name: 'tickLower', type: 'int24' },
        { name: 'tickUpper', type: 'int24' },
        { name: 'amount0Desired', type: 'uint256' },
        { name: 'amount1Desired', type: 'uint256' },
        { name: 'amount0Min', type: 'uint256' },
        { name: 'amount1Min', type: 'uint256' },
        { name: 'recipient', type: 'address' },
        { name: 'deadline', type: 'uint256' },
        { name: 'sqrtPriceX96', type: 'uint160' },
      ],
    }],
    outputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'liquidity', type: 'uint128' },
      { name: 'amount0', type: 'uint256' },
      { name: 'amount1', type: 'uint256' },
    ],
  },
] as const;

/** Ramses V3 NonfungiblePositionManager: compact position struct and a
 * tickSpacing mint without the Slipstream sqrtPriceX96 field. */
export const RAMSES_NPM_ABI = [
  {
    name: 'positions', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [
      { name: 'token0', type: 'address' },
      { name: 'token1', type: 'address' },
      { name: 'tickSpacing', type: 'int24' },
      { name: 'tickLower', type: 'int24' },
      { name: 'tickUpper', type: 'int24' },
      { name: 'liquidity', type: 'uint128' },
      { name: 'feeGrowthInside0LastX128', type: 'uint256' },
      { name: 'feeGrowthInside1LastX128', type: 'uint256' },
      { name: 'tokensOwed0', type: 'uint128' },
      { name: 'tokensOwed1', type: 'uint128' },
    ],
  },
  {
    name: 'mint', type: 'function', stateMutability: 'payable',
    inputs: [{
      name: 'params', type: 'tuple', components: [
        { name: 'token0', type: 'address' },
        { name: 'token1', type: 'address' },
        { name: 'tickSpacing', type: 'int24' },
        { name: 'tickLower', type: 'int24' },
        { name: 'tickUpper', type: 'int24' },
        { name: 'amount0Desired', type: 'uint256' },
        { name: 'amount1Desired', type: 'uint256' },
        { name: 'amount0Min', type: 'uint256' },
        { name: 'amount1Min', type: 'uint256' },
        { name: 'recipient', type: 'address' },
        { name: 'deadline', type: 'uint256' },
      ],
    }],
    outputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'liquidity', type: 'uint128' },
      { name: 'amount0', type: 'uint256' },
      { name: 'amount1', type: 'uint256' },
    ],
  },
] as const;

export const SLIPSTREAM_FACTORY_ABI = [
  { name: 'getPool', type: 'function', stateMutability: 'view', inputs: [{ name: 'tokenA', type: 'address' }, { name: 'tokenB', type: 'address' }, { name: 'tickSpacing', type: 'int24' }], outputs: [{ name: 'pool', type: 'address' }] },
] as const;

/** slot0 decoded to sqrtPriceX96 and tick only. Works on Uniswap V3 (seven
 * outputs) and Slipstream (six) alike; use it wherever only the price and
 * tick matter. */
export const SLOT0_HEAD_ABI = [
  { name: 'slot0', type: 'function', stateMutability: 'view', inputs: [], outputs: [
    { name: 'sqrtPriceX96', type: 'uint160' },
    { name: 'tick', type: 'int24' },
  ] },
] as const;

export const FACTORY_ABI = [
  { name: 'getPool', type: 'function', stateMutability: 'view', inputs: [{ name: 'tokenA', type: 'address' }, { name: 'tokenB', type: 'address' }, { name: 'fee', type: 'uint24' }], outputs: [{ name: 'pool', type: 'address' }] },
] as const;

export const POOL_ABI = [
  { name: 'slot0', type: 'function', stateMutability: 'view', inputs: [], outputs: [
    { name: 'sqrtPriceX96', type: 'uint160' },
    { name: 'tick', type: 'int24' },
    { name: 'observationIndex', type: 'uint16' },
    { name: 'observationCardinality', type: 'uint16' },
    { name: 'observationCardinalityNext', type: 'uint16' },
    { name: 'feeProtocol', type: 'uint8' },
    { name: 'unlocked', type: 'bool' },
  ] },
  // in-range liquidity — used to estimate a new position's fee share
  { name: 'liquidity', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: 'liquidity', type: 'uint128' }] },
  // pool identity — used to resolve a pasted pool address to its token pair (Simulate-any-pool)
  { name: 'token0', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'address' }] },
  { name: 'token1', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'address' }] },
  { name: 'fee', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint24' }] },
  { name: 'tickSpacing', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'int24' }] },
  // per-tick liquidity — used to build the liquidity-depth-by-price histogram
  { name: 'tickBitmap', type: 'function', stateMutability: 'view', inputs: [{ name: 'wordPosition', type: 'int16' }], outputs: [{ name: '', type: 'uint256' }] },
  {
    name: 'ticks', type: 'function', stateMutability: 'view', inputs: [{ name: 'tick', type: 'int24' }],
    outputs: [
      { name: 'liquidityGross', type: 'uint128' },
      { name: 'liquidityNet', type: 'int128' },
      { name: 'feeGrowthOutside0X128', type: 'uint256' },
      { name: 'feeGrowthOutside1X128', type: 'uint256' },
      { name: 'tickCumulativeOutside', type: 'int56' },
      { name: 'secondsPerLiquidityOutsideX128', type: 'uint160' },
      { name: 'secondsOutside', type: 'uint32' },
      { name: 'initialized', type: 'bool' },
    ],
  },
] as const;

export const ERC20_META_ABI = [
  { name: 'symbol', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'decimals', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
] as const;

/** Global fee growth per unit of liquidity, same on every V3 fork. */
export const FEE_GROWTH_ABI = [
  { name: 'feeGrowthGlobal0X128', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'feeGrowthGlobal1X128', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
] as const;

/** Leading fields of ticks(): enough for fee growth outside. All static, so
 * decoding the head of the longer real struct is safe. */
export const TICKS_HEAD_ABI = [
  { name: 'ticks', type: 'function', stateMutability: 'view', inputs: [{ name: 'tick', type: 'int24' }], outputs: [
    { name: 'liquidityGross', type: 'uint128' }, { name: 'liquidityNet', type: 'int128' },
    { name: 'feeGrowthOutside0X128', type: 'uint256' }, { name: 'feeGrowthOutside1X128', type: 'uint256' },
  ] },
] as const;

/** Slipstream adds stakedLiquidityNet before the fee growth fields. */
export const SLIPSTREAM_TICKS_HEAD_ABI = [
  { name: 'ticks', type: 'function', stateMutability: 'view', inputs: [{ name: 'tick', type: 'int24' }], outputs: [
    { name: 'liquidityGross', type: 'uint128' }, { name: 'liquidityNet', type: 'int128' }, { name: 'stakedLiquidityNet', type: 'int128' },
    { name: 'feeGrowthOutside0X128', type: 'uint256' }, { name: 'feeGrowthOutside1X128', type: 'uint256' },
  ] },
] as const;

/**
 * Algebra Integral (Alandale on Robinhood Chain). One pool per pair (no fee tiers), found with poolByPair; the pool
 * reports price and tick through globalState() with a dynamic fee, keeps its own tickSpacing, and names its fee
 * accumulators totalFeeGrowth*Token. The position struct has no fee field (eleven words), and mint takes no fee or
 * spacing. increaseLiquidity, decreaseLiquidity, collect and burn are the Uniswap V3 ones. Read from the live
 * contracts: manager 0xe62a5F67…B5c3 (bytecode selectors) and a WETH/USAR pool.
 */
export const ALGEBRA_NPM_ABI = [
  {
    name: 'positions', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [
      { name: 'nonce', type: 'uint88' },
      { name: 'operator', type: 'address' },
      { name: 'token0', type: 'address' },
      { name: 'token1', type: 'address' },
      { name: 'tickLower', type: 'int24' },
      { name: 'tickUpper', type: 'int24' },
      { name: 'liquidity', type: 'uint128' },
      { name: 'feeGrowthInside0LastX128', type: 'uint256' },
      { name: 'feeGrowthInside1LastX128', type: 'uint256' },
      { name: 'tokensOwed0', type: 'uint128' },
      { name: 'tokensOwed1', type: 'uint128' },
    ],
  },
  {
    name: 'mint', type: 'function', stateMutability: 'payable',
    inputs: [{
      name: 'params', type: 'tuple', components: [
        { name: 'token0', type: 'address' },
        { name: 'token1', type: 'address' },
        { name: 'tickLower', type: 'int24' },
        { name: 'tickUpper', type: 'int24' },
        { name: 'amount0Desired', type: 'uint256' },
        { name: 'amount1Desired', type: 'uint256' },
        { name: 'amount0Min', type: 'uint256' },
        { name: 'amount1Min', type: 'uint256' },
        { name: 'recipient', type: 'address' },
        { name: 'deadline', type: 'uint256' },
      ],
    }],
    outputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'liquidity', type: 'uint128' },
      { name: 'amount0', type: 'uint256' },
      { name: 'amount1', type: 'uint256' },
    ],
  },
] as const;

export const ALGEBRA_FACTORY_ABI = [
  { name: 'poolByPair', type: 'function', stateMutability: 'view', inputs: [{ type: 'address' }, { type: 'address' }], outputs: [{ type: 'address' }] },
] as const;

export const ALGEBRA_POOL_ABI = [
  {
    name: 'globalState', type: 'function', stateMutability: 'view', inputs: [],
    outputs: [
      { name: 'price', type: 'uint160' },
      { name: 'tick', type: 'int24' },
      { name: 'lastFee', type: 'uint16' },
      { name: 'pluginConfig', type: 'uint8' },
      { name: 'communityFee', type: 'uint16' },
      { name: 'unlocked', type: 'bool' },
    ],
  },
  { name: 'liquidity', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint128' }] },
  { name: 'tickSpacing', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'int24' }] },
  { name: 'fee', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint16' }] },
  { name: 'totalFeeGrowth0Token', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'totalFeeGrowth1Token', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  {
    name: 'ticks', type: 'function', stateMutability: 'view', inputs: [{ type: 'int24' }],
    outputs: [
      { name: 'liquidityTotal', type: 'uint256' },
      { name: 'liquidityDelta', type: 'int128' },
      { name: 'prevTick', type: 'int24' },
      { name: 'nextTick', type: 'int24' },
      { name: 'outerFeeGrowth0Token', type: 'uint256' },
      { name: 'outerFeeGrowth1Token', type: 'uint256' },
    ],
  },
  { name: 'plugin', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const;
