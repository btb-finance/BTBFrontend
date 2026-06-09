/**
 * Uniswap V4 — minimal ABIs (SCAFFOLD).
 *
 * StateView gives read access to the singleton PoolManager's state by poolId.
 * PositionManager.modifyLiquidities is the entry point for mint/add/remove via
 * encoded actions — wiring it (with Permit2) is a later stage.
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
] as const;

export const POSITION_MANAGER_ABI = [
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }], outputs: [{ type: 'uint256' }] },
  {
    name: 'modifyLiquidities', type: 'function', stateMutability: 'payable',
    inputs: [{ name: 'unlockData', type: 'bytes' }, { name: 'deadline', type: 'uint256' }],
    outputs: [],
  },
] as const;
