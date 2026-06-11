/**
 * Uniswap V4 — minimal ABIs.
 *
 * StateView gives read access to the singleton PoolManager's state by poolId.
 * PositionManager.modifyLiquidities is the single entry point for
 * mint/add/remove/collect via encoded actions (see actions.ts); token pulls go
 * through Permit2. The PositionManager is an ERC-721 but NOT enumerable —
 * positions are discovered from Transfer logs (see positions.ts).
 */

export const STATE_VIEW_ABI = [
  {
    name: 'getSlot0', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'poolId', type: 'bytes32' }],
    outputs: [
      { name: 'sqrtPriceX96', type: 'uint160' },
      { name: 'tick', type: 'int24' },
      { name: 'protocolFee', type: 'uint24' },
      { name: 'lpFee', type: 'uint24' },
    ],
  },
  {
    name: 'getLiquidity', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'poolId', type: 'bytes32' }],
    outputs: [{ name: 'liquidity', type: 'uint128' }],
  },
  {
    // Fee growth inside a tick range right now — minus the position's
    // last-recorded value (getPositionInfo) gives its uncollected fees.
    name: 'getFeeGrowthInside', type: 'function', stateMutability: 'view',
    inputs: [
      { name: 'poolId', type: 'bytes32' },
      { name: 'tickLower', type: 'int24' },
      { name: 'tickUpper', type: 'int24' },
    ],
    outputs: [
      { name: 'feeGrowthInside0X128', type: 'uint256' },
      { name: 'feeGrowthInside1X128', type: 'uint256' },
    ],
  },
  {
    name: 'getPositionInfo', type: 'function', stateMutability: 'view',
    inputs: [
      { name: 'poolId', type: 'bytes32' },
      { name: 'positionId', type: 'bytes32' },
    ],
    outputs: [
      { name: 'liquidity', type: 'uint128' },
      { name: 'feeGrowthInside0LastX128', type: 'uint256' },
      { name: 'feeGrowthInside1LastX128', type: 'uint256' },
    ],
  },
] as const;

/** PoolKey tuple components — shared by ABI entries and abi.encode of params. */
export const POOL_KEY_COMPONENTS = [
  { name: 'currency0', type: 'address' },
  { name: 'currency1', type: 'address' },
  { name: 'fee', type: 'uint24' },
  { name: 'tickSpacing', type: 'int24' },
  { name: 'hooks', type: 'address' },
] as const;

export const POSITION_MANAGER_ABI = [
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'ownerOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ type: 'address' }] },
  {
    name: 'modifyLiquidities', type: 'function', stateMutability: 'payable',
    inputs: [{ name: 'unlockData', type: 'bytes' }, { name: 'deadline', type: 'uint256' }],
    outputs: [],
  },
  {
    // PositionInfo is a packed uint256: poolId[25 bytes] | tickUpper | tickLower | flags.
    name: 'getPoolAndPositionInfo', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [
      { name: 'poolKey', type: 'tuple', components: POOL_KEY_COMPONENTS },
      { name: 'info', type: 'uint256' },
    ],
  },
  {
    name: 'getPositionLiquidity', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: 'liquidity', type: 'uint128' }],
  },
  {
    // Full PoolKey for a pool the PositionManager has seen, keyed by the first
    // 25 bytes of the poolId — recovers fee/tickSpacing/hooks from a subgraph id.
    name: 'poolKeys', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'poolId', type: 'bytes25' }],
    outputs: POOL_KEY_COMPONENTS,
  },
] as const;

export const PERMIT2_ABI = [
  {
    name: 'approve', type: 'function', stateMutability: 'nonpayable',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint160' },
      { name: 'expiration', type: 'uint48' },
    ],
    outputs: [],
  },
] as const;

export const ERC721_TRANSFER_EVENT = {
  name: 'Transfer', type: 'event',
  inputs: [
    { name: 'from', type: 'address', indexed: true },
    { name: 'to', type: 'address', indexed: true },
    { name: 'tokenId', type: 'uint256', indexed: true },
  ],
} as const;
