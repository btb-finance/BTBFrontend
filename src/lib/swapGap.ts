import { encodeFunctionData, erc20Abi } from 'viem';
import type { Call } from './txRunner';
import { getKyberQuote, buildKyberTx } from './kyberswap';
import { GAS_RESERVE } from '@/protocols/dexs/uniswap/shared';

/**
 * Build the KyberSwap calls that move a wallet's two-token budget toward the
 * ratio a target range needs — "swap only the gap". Shared by the rebalance
 * flow (RebalanceSheet) and the balanced fresh-mint (CreatePosition), so the
 * fund-touching swap path has ONE audited implementation.
 *
 * The caller supplies which side to sell and the fraction (from `rebalancePlan`)
 * plus the current budgets; this returns the approve+swap calls to run and the
 * budgets updated for the swap's expected output. Returns null when no swap is
 * worth doing. Selling native ETH (V4 currency0) needs no approval and keeps a
 * gas reserve; the post-swap budget is still capped to the live wallet by the
 * caller before minting, so an optimistic quote can't over-deposit.
 */
export interface SwapGapArgs {
  sellSide: 0 | 1;
  swapFraction: number;
  budget0: bigint;
  budget1: bigint;
  token0: `0x${string}`;
  token1: `0x${string}`;
  decimals0: number;
  decimals1: number;
  /** token0 is native ETH (V4 native pool) — swapped/sent as ETH. */
  native0: boolean;
  account: `0x${string}`;
  slippageBps: number;
}

export interface SwapGapResult {
  calls: Call[];
  budget0: bigint;
  budget1: bigint;
}

export async function buildSwapGap(args: SwapGapArgs): Promise<SwapGapResult | null> {
  const { sellSide, swapFraction, token0, token1, decimals0, decimals1, native0, account, slippageBps } = args;
  let { budget0, budget1 } = args;
  if (swapFraction <= 0.0005) return null;

  const sellBudget = sellSide === 0 ? budget0 : budget1;
  const bps = Math.min(10_000, Math.max(0, Math.round(swapFraction * 10_000)));
  let sellRaw = (sellBudget * BigInt(bps)) / 10_000n;

  // Selling native ETH must leave gas for the swap + mint that follow.
  const sellNative = native0 && sellSide === 0;
  if (sellNative) {
    const room = budget0 > GAS_RESERVE ? budget0 - GAS_RESERVE : 0n;
    if (sellRaw > room) sellRaw = room;
  }
  if (sellRaw <= 0n) return null;

  const kyberAddr = (side: 0 | 1) => (side === 0 && native0 ? 'ETH' : side === 0 ? token0 : token1);
  const outDec = sellSide === 0 ? decimals1 : decimals0;
  const quote = await getKyberQuote(kyberAddr(sellSide), kyberAddr(sellSide === 0 ? 1 : 0), sellRaw.toString(), outDec, 1);
  const tx = await buildKyberTx(quote.routeSummary, quote.routerAddress, account, account, slippageBps, 1);

  const calls: Call[] = [];
  // Native ETH needs no approval; ERC-20 must allow the Kyber router.
  if (!sellNative) {
    const inTok = sellSide === 0 ? token0 : token1;
    calls.push({ to: inTok, data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [quote.routerAddress as `0x${string}`, sellRaw] }) });
  }
  calls.push({
    to: tx.to as `0x${string}`,
    data: tx.data as `0x${string}`,
    value: sellNative ? sellRaw : BigInt(tx.value && tx.value !== '0' ? tx.value : '0'),
    gas: tx.gas ? BigInt(tx.gas) : undefined,
  });

  // Recompute the budget: spent `sellRaw`, received the quote's amount-out.
  const out = BigInt(quote.routeSummary?.amountOut ?? quote.amountOut ?? '0');
  if (sellSide === 0) { budget0 -= sellRaw; budget1 += out; }
  else { budget1 -= sellRaw; budget0 += out; }

  return { calls, budget0, budget1 };
}
