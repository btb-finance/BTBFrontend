import { encodeFunctionData, erc20Abi } from 'viem';
import { NPM_ABI, SLIPSTREAM_NPM_ABI, RAMSES_NPM_ABI } from './abis';
import { MAX_UINT128, UNISWAP_V3_DEPLOYMENT, type V3Deployment } from './addresses';
import type { Call } from '@/lib/txRunner';
import type { LiquidityPosition } from '@/protocols/types';
import { deadline, minOut } from '../shared';
import { removeMinimums } from './math';

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
export function buildCollect(tokenId: bigint, recipient: `0x${string}`, d: V3Deployment = UNISWAP_V3_DEPLOYMENT, eth?: NativeOut): Call[] {
  const collectData = encodeFunctionData({
    abi: NPM_ABI,
    functionName: 'collect',
    args: [{ tokenId, recipient: eth ? d.positionManager : recipient, amount0Max: MAX_UINT128, amount1Max: MAX_UINT128 }],
  });
  if (!eth) return [{ to: d.positionManager, data: collectData }];
  return [{ to: d.positionManager, data: encodeFunctionData({ abi: NPM_ABI, functionName: 'multicall', args: [[collectData, ...nativeOutData(eth, recipient)]] }) }];
}

/**
 * Paid out as native ETH instead of WETH: the tokens are collected into the position manager itself, then its
 * own unwrapWETH9 sends the WETH as ETH and sweepToken sends the other token, all inside one multicall.
 */
export type NativeOut = { weth: `0x${string}`; other: `0x${string}` };

/** The NativeOut for a position when one side is the chain's wrapped native token, else undefined. */
export function nativeOutFor(pos: Pick<LiquidityPosition, 'token0' | 'token1'>, wrappedNative: `0x${string}` | null): NativeOut | undefined {
  if (!wrappedNative) return undefined;
  const w = wrappedNative.toLowerCase();
  if (pos.token0.toLowerCase() === w) return { weth: pos.token0, other: pos.token1 };
  if (pos.token1.toLowerCase() === w) return { weth: pos.token1, other: pos.token0 };
  return undefined;
}

function nativeOutData(eth: NativeOut, recipient: `0x${string}`): `0x${string}`[] {
  return [
    encodeFunctionData({ abi: NPM_ABI, functionName: 'unwrapWETH9', args: [0n, recipient] }),
    encodeFunctionData({ abi: NPM_ABI, functionName: 'sweepToken', args: [eth.other, 0n, recipient] }),
  ];
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
  d: V3Deployment = UNISWAP_V3_DEPLOYMENT,
  eth?: NativeOut,
): Call[] {
  const liquidity = (pos.liquidity * BigInt(pctBps)) / 10_000n;
  const [amount0Min, amount1Min] = removeMinimums(pos.sqrtPriceX96, pos.tickLower, pos.tickUpper, liquidity, slippageBps);
  const dl = deadline();

  const decreaseData = encodeFunctionData({
    abi: NPM_ABI,
    functionName: 'decreaseLiquidity',
    args: [{ tokenId: pos.id, liquidity, amount0Min, amount1Min, deadline: dl }],
  });
  const collectData = encodeFunctionData({
    abi: NPM_ABI,
    functionName: 'collect',
    args: [{ tokenId: pos.id, recipient: eth ? d.positionManager : recipient, amount0Max: MAX_UINT128, amount1Max: MAX_UINT128 }],
  });

  return [{
    to: d.positionManager,
    data: encodeFunctionData({ abi: NPM_ABI, functionName: 'multicall', args: [[decreaseData, collectData, ...(eth ? nativeOutData(eth, recipient) : [])]] }),
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
  d: V3Deployment = UNISWAP_V3_DEPLOYMENT,
): Call[] {
  const calls: Call[] = [];
  if (amount0Desired > 0n && nativeEthSide !== 0) {
    calls.push({ to: pos.token0, data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [d.positionManager, amount0Desired] }) });
  }
  if (amount1Desired > 0n && nativeEthSide !== 1) {
    calls.push({ to: pos.token1, data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [d.positionManager, amount1Desired] }) });
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
  calls.push({ to: d.positionManager, data, value });
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
  deployment?: V3Deployment;
  /** Slipstream: the pool's tickSpacing (its mint key; `fee` is ignored). */
  tickSpacing?: number;
}): Call[] {
  const { token0, token1, fee, tickLower, tickUpper, amount0Desired, amount1Desired, slippageBps, recipient } = args;
  const nativeEthSide = args.nativeEthSide ?? null;
  const d = args.deployment ?? UNISWAP_V3_DEPLOYMENT;
  const calls: Call[] = [];
  if (amount0Desired > 0n && nativeEthSide !== 0) {
    calls.push({ to: token0, data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [d.positionManager, amount0Desired] }) });
  }
  if (amount1Desired > 0n && nativeEthSide !== 1) {
    calls.push({ to: token1, data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [d.positionManager, amount1Desired] }) });
  }
  const mintData = d.compactPositions
    ? encodeFunctionData({
        abi: RAMSES_NPM_ABI,
        functionName: 'mint',
        args: [{
          token0, token1, tickSpacing: args.tickSpacing ?? d.tickSpacings[fee] ?? fee, tickLower, tickUpper,
          amount0Desired, amount1Desired,
          amount0Min: minOut(amount0Desired, slippageBps),
          amount1Min: minOut(amount1Desired, slippageBps),
          recipient,
          deadline: deadline(),
        }],
      })
    : d.slipstream
    ? encodeFunctionData({
        abi: SLIPSTREAM_NPM_ABI,
        functionName: 'mint',
        args: [{
          token0, token1, tickSpacing: args.tickSpacing ?? d.tickSpacings[fee] ?? fee, tickLower, tickUpper,
          amount0Desired, amount1Desired,
          amount0Min: minOut(amount0Desired, slippageBps),
          amount1Min: minOut(amount1Desired, slippageBps),
          recipient,
          deadline: deadline(),
          // Only consulted when the pool does not exist yet; ours always does.
          sqrtPriceX96: 0n,
        }],
      })
    : encodeFunctionData({
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
  calls.push({ to: d.positionManager, data, value });
  return calls;
}
