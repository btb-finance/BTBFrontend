import { encodeAbiParameters, encodeFunctionData, erc20Abi } from 'viem';
import { POSITION_MANAGER_ABI, PERMIT2_ABI, POOL_KEY_COMPONENTS } from './abis';
import { UNISWAP_V4, isNativeCurrency, type PoolKey } from './addresses';
import type { Call } from '@/lib/txRunner';
import type { LiquidityPosition } from '@/protocols/types';

/**
 * Uniswap V4 liquidity actions. Unlike V3's direct NPM calls, every V4
 * operation is one PositionManager.modifyLiquidities(unlockData, deadline)
 * where unlockData = abi.encode(actions bytes, params bytes[]) — a liquidity
 * action followed by a delta-settling action:
 *
 *   mint/add   → MINT_POSITION / INCREASE_LIQUIDITY + SETTLE_PAIR (+ SWEEP for ETH refund)
 *   remove     → DECREASE_LIQUIDITY + TAKE_PAIR
 *   collect    → DECREASE_LIQUIDITY(0) + TAKE_PAIR (fees are the only delta)
 *
 * ERC-20 deposits are pulled via Permit2, so each deposited token needs
 * ERC20.approve(Permit2) + Permit2.approve(token, PositionManager) first —
 * batched with the action by the txRunner exactly like V3's approvals. Native
 * ETH (currency0 = address(0)) is paid as msg.value, excess refunded by SWEEP.
 */

// v4-periphery Actions.sol
const Actions = {
  INCREASE_LIQUIDITY: 0x00,
  DECREASE_LIQUIDITY: 0x01,
  MINT_POSITION: 0x02,
  SETTLE_PAIR: 0x0d,
  TAKE_PAIR: 0x11,
  SWEEP: 0x14,
} as const;

const DEADLINE_SECONDS = 1200; // 20 minutes

function deadline(): bigint {
  return BigInt(Math.floor(Date.now() / 1000) + DEADLINE_SECONDS);
}

/** Apply a downward slippage tolerance (bps) to a minimum-out amount. */
function minOut(amount: bigint, slippageBps: number): bigint {
  return (amount * BigInt(10_000 - slippageBps)) / 10_000n;
}

/** Apply an upward slippage tolerance (bps) to a maximum-in amount. */
export function maxIn(amount: bigint, slippageBps: number): bigint {
  return (amount * BigInt(10_000 + slippageBps)) / 10_000n;
}

/** modifyLiquidities call data for a sequence of (action, params) pairs. */
function encodeModify(actions: number[], params: `0x${string}`[], dl: bigint): `0x${string}` {
  const actionBytes = ('0x' + actions.map((a) => a.toString(16).padStart(2, '0')).join('')) as `0x${string}`;
  const unlockData = encodeAbiParameters(
    [{ type: 'bytes' }, { type: 'bytes[]' }],
    [actionBytes, params],
  );
  return encodeFunctionData({ abi: POSITION_MANAGER_ABI, functionName: 'modifyLiquidities', args: [unlockData, dl] });
}

/**
 * Approvals to deposit `amount` of an ERC-20 through Permit2: the token allows
 * Permit2, then Permit2 allows the PositionManager (expiring with the deadline).
 * Native ETH needs none — it travels as msg.value.
 */
function permit2Approvals(token: `0x${string}`, amount: bigint, dl: bigint): Call[] {
  if (amount === 0n || isNativeCurrency(token)) return [];
  return [
    { to: token, data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [UNISWAP_V4.permit2, amount] }) },
    { to: UNISWAP_V4.permit2, data: encodeFunctionData({ abi: PERMIT2_ABI, functionName: 'approve', args: [token, UNISWAP_V4.positionManager, amount, Number(dl)] }) },
  ];
}

const POOL_KEY_PARAM = { type: 'tuple', components: POOL_KEY_COMPONENTS } as const;

/**
 * Mint a brand-new V4 position. The caller computes `liquidity` from the
 * desired amounts (liquidityForAmounts — same math as V3); `amount0Max/
 * amount1Max` cap what the pool may pull if price moves before the tx lands,
 * and are also what gets approved / attached as msg.value.
 */
export function buildV4Mint(args: {
  poolKey: PoolKey;
  tickLower: number; tickUpper: number;
  liquidity: bigint;
  amount0Max: bigint; amount1Max: bigint;
  recipient: `0x${string}`;
}): Call[] {
  const { poolKey, tickLower, tickUpper, liquidity, amount0Max, amount1Max, recipient } = args;
  const dl = deadline();
  const native0 = isNativeCurrency(poolKey.currency0);

  const mintParams = encodeAbiParameters(
    [POOL_KEY_PARAM, { type: 'int24' }, { type: 'int24' }, { type: 'uint256' }, { type: 'uint128' }, { type: 'uint128' }, { type: 'address' }, { type: 'bytes' }],
    [poolKey, tickLower, tickUpper, liquidity, amount0Max, amount1Max, recipient, '0x'],
  );
  const settleParams = encodeAbiParameters(
    [{ type: 'address' }, { type: 'address' }],
    [poolKey.currency0, poolKey.currency1],
  );

  const actions: number[] = [Actions.MINT_POSITION, Actions.SETTLE_PAIR];
  const params = [mintParams, settleParams];
  if (native0) {
    // Refund whatever of msg.value the pool didn't take.
    actions.push(Actions.SWEEP);
    params.push(encodeAbiParameters([{ type: 'address' }, { type: 'address' }], [poolKey.currency0, recipient]));
  }

  return [
    ...permit2Approvals(poolKey.currency0, amount0Max, dl),
    ...permit2Approvals(poolKey.currency1, amount1Max, dl),
    { to: UNISWAP_V4.positionManager, data: encodeModify(actions, params, dl), value: native0 ? amount0Max : undefined },
  ];
}

/**
 * Add liquidity to an existing V4 position. Desired amounts come from
 * `addAmounts()` at the current price (same as V3); they're converted to a
 * liquidity delta by the caller via liquidityForAmounts.
 */
export function buildV4Increase(
  pos: LiquidityPosition,
  liquidity: bigint,
  amount0Max: bigint,
  amount1Max: bigint,
  recipient: `0x${string}`,
): Call[] {
  const dl = deadline();
  const native0 = isNativeCurrency(pos.token0);

  const incParams = encodeAbiParameters(
    [{ type: 'uint256' }, { type: 'uint256' }, { type: 'uint128' }, { type: 'uint128' }, { type: 'bytes' }],
    [pos.id, liquidity, amount0Max, amount1Max, '0x'],
  );
  const settleParams = encodeAbiParameters([{ type: 'address' }, { type: 'address' }], [pos.token0, pos.token1]);

  const actions: number[] = [Actions.INCREASE_LIQUIDITY, Actions.SETTLE_PAIR];
  const params = [incParams, settleParams];
  if (native0) {
    actions.push(Actions.SWEEP);
    params.push(encodeAbiParameters([{ type: 'address' }, { type: 'address' }], [pos.token0, recipient]));
  }

  return [
    ...permit2Approvals(pos.token0, amount0Max, dl),
    ...permit2Approvals(pos.token1, amount1Max, dl),
    { to: UNISWAP_V4.positionManager, data: encodeModify(actions, params, dl), value: native0 ? amount0Max : undefined },
  ];
}

/**
 * Withdraw `pctBps`/10000 of a V4 position's liquidity (plus its share of
 * accrued fees — V4 credits fees on every liquidity change) to `recipient`.
 * Expected-out scales linearly with liquidity; amountMin applies the slippage
 * tolerance and reverts if the pool moved against us.
 */
export function buildV4Remove(
  pos: LiquidityPosition,
  pctBps: number,
  slippageBps: number,
  recipient: `0x${string}`,
): Call[] {
  const dl = deadline();
  const liquidity = (pos.liquidity * BigInt(pctBps)) / 10_000n;
  const expected0 = (pos.amount0 * BigInt(pctBps)) / 10_000n;
  const expected1 = (pos.amount1 * BigInt(pctBps)) / 10_000n;

  const decParams = encodeAbiParameters(
    [{ type: 'uint256' }, { type: 'uint256' }, { type: 'uint128' }, { type: 'uint128' }, { type: 'bytes' }],
    [pos.id, liquidity, minOut(expected0, slippageBps), minOut(expected1, slippageBps), '0x'],
  );
  const takeParams = encodeAbiParameters(
    [{ type: 'address' }, { type: 'address' }, { type: 'address' }],
    [pos.token0, pos.token1, recipient],
  );

  return [{
    to: UNISWAP_V4.positionManager,
    data: encodeModify([Actions.DECREASE_LIQUIDITY, Actions.TAKE_PAIR], [decParams, takeParams], dl),
  }];
}

/**
 * Collect (claim) all fees owed on a V4 position to `recipient`. A zero-
 * liquidity decrease leaves principal untouched and surfaces the accrued fees
 * as the only deltas, which TAKE_PAIR sends out. Safe: can't touch principal.
 */
export function buildV4Collect(pos: LiquidityPosition, recipient: `0x${string}`): Call[] {
  const decParams = encodeAbiParameters(
    [{ type: 'uint256' }, { type: 'uint256' }, { type: 'uint128' }, { type: 'uint128' }, { type: 'bytes' }],
    [pos.id, 0n, 0n, 0n, '0x'],
  );
  const takeParams = encodeAbiParameters(
    [{ type: 'address' }, { type: 'address' }, { type: 'address' }],
    [pos.token0, pos.token1, recipient],
  );
  return [{
    to: UNISWAP_V4.positionManager,
    data: encodeModify([Actions.DECREASE_LIQUIDITY, Actions.TAKE_PAIR], [decParams, takeParams], deadline()),
  }];
}
