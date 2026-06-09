import { encodeFunctionData, erc20Abi } from 'viem';
import { NPM_ABI } from './abis';
import { UNISWAP_V3, MAX_UINT128 } from './addresses';
import type { Call } from '@/lib/txRunner';
import type { LiquidityPosition } from '@/protocols/types';

const DEADLINE_SECONDS = 1200; // 20 minutes

function deadline(): bigint {
  return BigInt(Math.floor(Date.now() / 1000) + DEADLINE_SECONDS);
}

/** Apply a downward slippage tolerance (bps) to a minimum-out amount. */
function minOut(amount: bigint, slippageBps: number): bigint {
  return (amount * BigInt(10_000 - slippageBps)) / 10_000n;
}

/**
 * If a deposit is paid in native ETH (one side is WETH), wrap the action in
 * NPM.multicall([action, refundETH]) and attach msg.value = the WETH amount.
 * `refundETH` returns any unused ETH. `nativeEthSide` = which sorted token (0/1)
 * is being paid as ETH, or null for plain ERC-20.
 */
function withEth(
  actionData: `0x${string}`,
  nativeEthSide: 0 | 1 | null,
  amount0: bigint,
  amount1: bigint,
): { data: `0x${string}`; value?: bigint } {
  if (nativeEthSide === null) return { data: actionData };
  const value = nativeEthSide === 0 ? amount0 : amount1;
  const refundData = encodeFunctionData({ abi: NPM_ABI, functionName: 'refundETH', args: [] });
  return {
    data: encodeFunctionData({ abi: NPM_ABI, functionName: 'multicall', args: [[actionData, refundData]] }),
    value,
  };
}

/**
 * Collect (claim) all fees owed on a V3 position to the owner.
 * Safe: only transfers fees already owed — can't touch principal.
 */
export function buildCollect(tokenId: bigint, recipient: `0x${string}`): Call[] {
  return [{
    to: UNISWAP_V3.positionManager,
    data: encodeFunctionData({
      abi: NPM_ABI,
      functionName: 'collect',
      args: [{ tokenId, recipient, amount0Max: MAX_UINT128, amount1Max: MAX_UINT128 }],
    }),
  }];
}

/**
 * Withdraw `pctBps`/10000 of a position's liquidity to `recipient`.
 *
 * One atomic NPM.multicall(decreaseLiquidity, collect): decrease credits the
 * tokens owed, collect sweeps principal + fees out. Amounts scale linearly with
 * liquidity, so expected-out = currentAmount * pct; `amount0Min/amount1Min`
 * apply the slippage tolerance and revert the tx if the pool moved against us.
 */
export function buildRemove(
  pos: LiquidityPosition,
  pctBps: number,
  slippageBps: number,
  recipient: `0x${string}`,
): Call[] {
  const liquidity = (pos.liquidity * BigInt(pctBps)) / 10_000n;
  const expected0 = (pos.amount0 * BigInt(pctBps)) / 10_000n;
  const expected1 = (pos.amount1 * BigInt(pctBps)) / 10_000n;
  const dl = deadline();

  const decreaseData = encodeFunctionData({
    abi: NPM_ABI,
    functionName: 'decreaseLiquidity',
    args: [{ tokenId: pos.id, liquidity, amount0Min: minOut(expected0, slippageBps), amount1Min: minOut(expected1, slippageBps), deadline: dl }],
  });
  const collectData = encodeFunctionData({
    abi: NPM_ABI,
    functionName: 'collect',
    args: [{ tokenId: pos.id, recipient, amount0Max: MAX_UINT128, amount1Max: MAX_UINT128 }],
  });

  return [{
    to: UNISWAP_V3.positionManager,
    data: encodeFunctionData({ abi: NPM_ABI, functionName: 'multicall', args: [[decreaseData, collectData]] }),
  }];
}

/**
 * Add liquidity to an existing position. Approvals for whichever tokens are
 * being deposited are emitted first (batched by the txRunner: one wallet
 * confirmation on EIP-5792 wallets, otherwise approve→confirm→add). The
 * desired amounts are computed by the caller from `addAmounts()`; `amount0Min/
 * amount1Min` protect against the ratio shifting before the tx lands.
 */
export function buildIncrease(
  pos: LiquidityPosition,
  amount0Desired: bigint,
  amount1Desired: bigint,
  slippageBps: number,
  nativeEthSide: 0 | 1 | null = null,
): Call[] {
  const calls: Call[] = [];
  if (amount0Desired > 0n && nativeEthSide !== 0) {
    calls.push({ to: pos.token0, data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [UNISWAP_V3.positionManager, amount0Desired] }) });
  }
  if (amount1Desired > 0n && nativeEthSide !== 1) {
    calls.push({ to: pos.token1, data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [UNISWAP_V3.positionManager, amount1Desired] }) });
  }
  const incData = encodeFunctionData({
    abi: NPM_ABI,
    functionName: 'increaseLiquidity',
    args: [{
      tokenId: pos.id,
      amount0Desired, amount1Desired,
      amount0Min: minOut(amount0Desired, slippageBps),
      amount1Min: minOut(amount1Desired, slippageBps),
      deadline: deadline(),
    }],
  });
  const { data, value } = withEth(incData, nativeEthSide, amount0Desired, amount1Desired);
  calls.push({ to: UNISWAP_V3.positionManager, data, value });
  return calls;
}

/**
 * Mint a brand-new V3 position. `token0` MUST be the lower-address token and the
 * amounts must already be paired for the chosen range (see addAmounts). Emits
 * the token approvals first (batched by the txRunner), then NPM.mint with
 * amountMin slippage protection.
 */
export function buildMint(args: {
  token0: `0x${string}`; token1: `0x${string}`; fee: number;
  tickLower: number; tickUpper: number;
  amount0Desired: bigint; amount1Desired: bigint;
  slippageBps: number; recipient: `0x${string}`;
  nativeEthSide?: 0 | 1 | null;
}): Call[] {
  const { token0, token1, fee, tickLower, tickUpper, amount0Desired, amount1Desired, slippageBps, recipient } = args;
  const nativeEthSide = args.nativeEthSide ?? null;
  const calls: Call[] = [];
  if (amount0Desired > 0n && nativeEthSide !== 0) {
    calls.push({ to: token0, data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [UNISWAP_V3.positionManager, amount0Desired] }) });
  }
  if (amount1Desired > 0n && nativeEthSide !== 1) {
    calls.push({ to: token1, data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [UNISWAP_V3.positionManager, amount1Desired] }) });
  }
  const mintData = encodeFunctionData({
    abi: NPM_ABI,
    functionName: 'mint',
    args: [{
      token0, token1, fee, tickLower, tickUpper,
      amount0Desired, amount1Desired,
      amount0Min: minOut(amount0Desired, slippageBps),
      amount1Min: minOut(amount1Desired, slippageBps),
      recipient,
      deadline: deadline(),
    }],
  });
  const { data, value } = withEth(mintData, nativeEthSide, amount0Desired, amount1Desired);
  calls.push({ to: UNISWAP_V3.positionManager, data, value });
  return calls;
}
