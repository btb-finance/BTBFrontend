/**
 * Uniswap V3 position analytics — impermanent loss + historical backtest.
 *
 * Our own implementation of the ideas the well-known LP simulators (DefiLab,
 * revert-backtester, Bella "Tuner") are built on, with NO dependency on them:
 *
 *   1. Closed-form IL for a CONCENTRATED range (not just the v2 curve) — a range
 *      amplifies IL while price is inside it and caps it once price exits (the
 *      position becomes 100% of one token and just tracks it). Derived from the
 *      standard v3 amount formulas (Atis Elsts, "Liquidity Math in Uniswap v3").
 *   2. A backtest that replays the pool's REAL daily price through the exact
 *      range: fees accrue only on days the price actually sat in range (the
 *      factor a naive "fees × liquidity share" estimate ignores — which is why
 *      tight ranges quote fantasy APRs), then nets them against realised IL.
 *
 * All prices here are "token0 priced in token1" in human units — the same
 * convention as `price`/`tickToPrice` in the rest of the app. Math is float
 * (Number): display-grade, never used to size a transaction.
 */

/** √price, clamped into [√pa, √pb]. Clamping reproduces the piecewise position:
 *  below range → all token0, above range → all token1, inside → mixed. */
function clampedSqrt(p: number, sa: number, sb: number): number {
  const s = Math.sqrt(p);
  return s < sa ? sa : s > sb ? sb : s;
}

/** Token amounts held by ONE unit of liquidity at price `p` in range [pa,pb].
 *  x = token0, y = token1 (human units). Exported for the simulator page's
 *  value/waterfall math so the position formulas live in exactly one place. */
export function unitAmounts(p: number, pa: number, pb: number): { x: number; y: number } {
  const sa = Math.sqrt(pa), sb = Math.sqrt(pb);
  const sc = clampedSqrt(p, sa, sb);
  return { x: 1 / sc - 1 / sb, y: sc - sa };
}

/**
 * Impermanent loss of a range position [pa,pb] as price moves p0 → p1, as a
 * signed fraction of the HODL value (e.g. -0.023 = 2.3% worse than holding).
 * Scale-invariant (uses unit liquidity), so it's the same for any deposit size.
 *
 * Sanity: full range (pa→0, pb→∞) reduces to the classic v2 IL 2√r/(1+r)−1.
 */
export function impermanentLossFraction(p0: number, p1: number, pa: number, pb: number): number {
  if (!(p0 > 0) || !(p1 > 0) || !(pa > 0) || !(pb > 0) || pa >= pb) return 0;
  const entry = unitAmounts(p0, pa, pb); // tokens the position starts with
  const now = unitAmounts(p1, pa, pb);   // tokens it holds after the move
  const posVal = now.x * p1 + now.y;     // LP value at p1 (token1 units)
  const hodlVal = entry.x * p1 + entry.y; // just holding the entry tokens
  return hodlVal > 0 ? posVal / hodlVal - 1 : 0;
}

export interface BacktestInput {
  /** Historical UTC-day snapshots, oldest → newest (price0 = token0 in token1). */
  history: { price0: number; feesUsd: number; liquidity?: number }[];
  /** Range bounds in the same price space (from tickToPrice on the range ticks). */
  priceLower: number;
  priceUpper: number;
  /** Your liquidity L and the pool's in-range liquidity, in the same units. */
  userLiquidity: number;
  activeLiquidity: number;
  /** USD value of the position at entry — the basis for IL$ and APR. */
  depositUsd: number;
}

export interface BacktestResult {
  days: number;
  depositUsd: number;
  daysInRange: number;
  feesUsd: number;      // your share of pool fees, only for in-range days
  ilFraction: number;   // signed; negative = loss vs HODL
  ilUsd: number;        // ilFraction × depositUsd (negative)
  netUsd: number;       // feesUsd + ilUsd
  netApr: number;       // annualised net return on depositUsd, %
  feeApr: number;       // fees-only annualised return, %
  endPrice: number;
  entryPrice: number;
  /** Days whose fee share used that day's indexed pool liquidity. */
  historicalLiquidityDays: number;
  /** Days that had to fall back to the live pool liquidity. */
  fallbackLiquidityDays: number;
}

/**
 * Replays historical daily pool snapshots through a fixed range. Pool price and
 * fee totals are historical. Your share is estimated from the day's indexed
 * in-range liquidity; a live-liquidity fallback remains for incomplete indexes.
 * This is deliberately not called realised position performance: day snapshots
 * cannot reconstruct intraday time in range or per-tick fee growth.
 */
export function backtestRange(input: BacktestInput): BacktestResult | null {
  const { history, priceLower, priceUpper, userLiquidity, activeLiquidity, depositUsd } = input;
  if (history.length < 2 || !(depositUsd > 0) || priceLower >= priceUpper) return null;

  let feesUsd = 0;
  let daysInRange = 0;
  let historicalLiquidityDays = 0;
  let fallbackLiquidityDays = 0;
  for (const d of history) {
    const inRange = d.price0 >= priceLower && d.price0 <= priceUpper;
    if (inRange) {
      daysInRange++;
      const poolLiquidity = d.liquidity && d.liquidity > 0 ? d.liquidity : activeLiquidity;
      if (d.liquidity && d.liquidity > 0) historicalLiquidityDays++;
      else fallbackLiquidityDays++;
      const share = userLiquidity + poolLiquidity > 0
        ? userLiquidity / (userLiquidity + poolLiquidity)
        : 0;
      feesUsd += (d.feesUsd || 0) * share;
    }
  }

  const entryPrice = history[0].price0;
  const endPrice = history[history.length - 1].price0;
  const ilFraction = impermanentLossFraction(entryPrice, endPrice, priceLower, priceUpper);
  const ilUsd = ilFraction * depositUsd;
  const netUsd = feesUsd + ilUsd;

  const days = history.length;
  const annualise = (usd: number) => (usd / depositUsd) * (365 / days) * 100;

  return {
    days,
    depositUsd,
    daysInRange,
    feesUsd,
    ilFraction,
    ilUsd,
    netUsd,
    netApr: annualise(netUsd),
    feeApr: annualise(feesUsd),
    endPrice,
    entryPrice,
    historicalLiquidityDays,
    fallbackLiquidityDays,
  };
}
