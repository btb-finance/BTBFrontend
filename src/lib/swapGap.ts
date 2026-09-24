import { encodeFunctionData, erc20Abi } from 'viem';
import type { Call } from './txRunner';
import { getKyberQuote, buildKyberTx } from './kyberswap';
import { GAS_RESERVE } from '@/protocols/dexs/uniswap/shared';
import { getAmountsForLiquidity } from '@/protocols/dexs/uniswap/v3/math';

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
  /** Chain the swap executes on (KyberSwap-supported). Defaults to mainnet. */
  chainId?: number;
}

export interface SwapGapResult {
  calls: Call[];
  budget0: bigint;
  budget1: bigint;
}

export async function buildSwapGap(args: SwapGapArgs): Promise<SwapGapResult | null> {
  const { sellSide, swapFraction, token0, token1, decimals0, decimals1, native0, account, slippageBps, chainId = 1 } = args;
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
  const quote = await getKyberQuote(kyberAddr(sellSide), kyberAddr(sellSide === 0 ? 1 : 0), sellRaw.toString(), outDec, chainId);
  const tx = await buildKyberTx(quote.routeSummary, quote.routerAddress, account, account, slippageBps, chainId);

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

// ── Swap to fit an existing range, exactly ─────────────────────────────────────

export interface FitArgs {
  sqrtPriceX96: bigint;
  tickLower: number;
  tickUpper: number;
  /** What the user puts in, per side (either may be zero). */
  budget0: bigint;
  budget1: bigint;
  token0: `0x${string}`;
  token1: `0x${string}`;
  decimals0: number;
  decimals1: number;
  /** That side is paid and received as native ETH. */
  native0: boolean;
  native1: boolean;
  account: `0x${string}`;
  slippageBps: number;
  chainId: number;
  /** Build the swap transaction too (at confirm time); a preview only quotes. */
  build?: boolean;
}

export interface FitPlan {
  sellSide: 0 | 1 | null;
  sellRaw: bigint;
  /** Expected output of the swap, after price impact and the 1% BTB fee. */
  out: bigint;
  /** What goes into the position once the swap is done. */
  final0: bigint;
  final1: bigint;
  calls: Call[];
  route: string;
  priceImpact: number;
}

/**
 * How much of the budget to swap so what is left and what the swap returns sit in exactly the ratio the range
 * needs: nothing left over. With R = token0 needed per token1 at this price and range, and r the swap's own rate
 * (output per input, after price impact and the BTB fee), selling x of token0 needs (b0 - x) / (b1 + r x) = R, so
 * x = (b0 - R b1) / (1 + R r); selling token1 needs (b0 + r x) / (b1 - x) = R, so x = (R b1 - b0) / (r + R). The rate
 * is taken from the spot price first and then from a real quote for that size, and quoted again at the final
 * size, so the swap that runs is the one priced. Charges the BTB swap fee.
 */
export async function planSwapToFit(a: FitArgs): Promise<FitPlan> {
  const none: FitPlan = { sellSide: null, sellRaw: 0n, out: 0n, final0: a.budget0, final1: a.budget1, calls: [], route: '', priceImpact: 0 };
  const [need0, need1] = getAmountsForLiquidity(a.sqrtPriceX96, a.tickLower, a.tickUpper, 10n ** 24n);
  const b0 = Number(a.budget0), b1 = Number(a.budget1);
  // Which side is in excess of the range's ratio (a one-sided range wants none of the other token).
  const sellSide: 0 | 1 | null = need1 === 0n ? (a.budget1 > 0n ? 1 : null)
    : need0 === 0n ? (a.budget0 > 0n ? 0 : null)
    : a.budget0 * need1 > a.budget1 * need0 ? 0 : a.budget1 * need0 > a.budget0 * need1 ? 1 : null;
  if (sellSide === null) return none;
  const R = need1 === 0n ? Infinity : Number(need0) / Number(need1);
  const spot = (Number(a.sqrtPriceX96) / 2 ** 96) ** 2; // token1 per token0, raw units
  // The budget is what the user chose to put in; gas for ETH is kept back when they fill it (Max leaves some).
  const budget = sellSide === 0 ? a.budget0 : a.budget1;
  const cap = budget;

  const sizeFor = (r: number): bigint => {
    let x: number;
    if (sellSide === 0) x = need1 === 0n ? 0 : need0 === 0n ? b0 : (b0 - R * b1) / (1 + R * r);
    else x = need0 === 0n ? 0 : need1 === 0n ? b1 : (R * b1 - b0) / (r + R);
    if (!(x > 0)) return 0n;
    const raw = BigInt(Math.floor(x));
    return raw > cap ? cap : raw;
  };
  const addr = (side: 0 | 1) => ((side === 0 ? a.native0 : a.native1) ? 'ETH' : side === 0 ? a.token0 : a.token1);
  const outDec = sellSide === 0 ? a.decimals1 : a.decimals0;
  const quoteFor = (x: bigint) => getKyberQuote(addr(sellSide), addr(sellSide === 0 ? 1 : 0), x.toString(), outDec, a.chainId, { chargeBtbFee: true });

  // 1. Size from the spot price, less the fee. 2. Re-size from a real quote at that size. 3. Quote the final size.
  let x = sizeFor(sellSide === 0 ? spot * 0.99 : (1 / spot) * 0.99);
  if (x <= 0n || x * 1000n < budget) return none; // under 0.1% of the budget: not worth a swap
  let quote = await quoteFor(x);
  x = sizeFor(Number(quote.amountOut) / Number(x));
  if (x <= 0n) return none;
  quote = await quoteFor(x);
  const out = BigInt(quote.amountOut);
  const final0 = sellSide === 0 ? a.budget0 - x : a.budget0 + out;
  const final1 = sellSide === 0 ? a.budget1 + out : a.budget1 - x;

  const calls: Call[] = [];
  if (a.build) {
    const tx = await buildKyberTx(quote.routeSummary, quote.routerAddress, a.account, a.account, a.slippageBps, a.chainId);
    const sellNative = sellSide === 0 ? a.native0 : a.native1;
    if (!sellNative) calls.push({ to: sellSide === 0 ? a.token0 : a.token1, label: 'Approve the swap', data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [quote.routerAddress as `0x${string}`, x] }) });
    calls.push({ to: tx.to as `0x${string}`, data: tx.data as `0x${string}`, value: sellNative ? x : BigInt(tx.value && tx.value !== '0' ? tx.value : '0'), gas: tx.gas ? BigInt(tx.gas) : undefined, label: 'Swap to fit the range' });
  }
  return { sellSide, sellRaw: x, out, final0, final1, calls, route: quote.route, priceImpact: quote.priceImpact };
}
