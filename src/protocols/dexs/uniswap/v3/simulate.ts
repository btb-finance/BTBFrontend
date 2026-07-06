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
 *  x = token0, y = token1 (human units). */
function unitAmounts(p: number, pa: number, pb: number): { x: number; y: number } {
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
  /** Real daily history, oldest → newest (price0 = token0 in token1). */
  history: { price0: number; feesUsd: number }[];
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
  daysInRange: number;
  feesUsd: number;      // your share of pool fees, only for in-range days
  ilFraction: number;   // signed; negative = loss vs HODL
  ilUsd: number;        // ilFraction × depositUsd (negative)
  netUsd: number;       // feesUsd + ilUsd
  netApr: number;       // annualised net return on depositUsd, %
  feeApr: number;       // fees-only annualised return, %
  endPrice: number;
  entryPrice: number;
}

/**
 * Replay the pool's real daily price through a fixed range: accrue your share of
 * that day's fees ONLY when the price was in range, then net the total against
 * the impermanent loss realised over the whole move. This is what turns a
 * "guessed" APR into one grounded in what actually happened.
 *
 * Approximation (same one the in-sheet estimate makes): your fee share uses the
 * pool's *current* in-range liquidity as the denominator each day rather than a
 * per-day historical value — day-level history doesn't carry active liquidity.
 * So treat fees as indicative, IL as exact for the price path.
 */
export function backtestRange(input: BacktestInput): BacktestResult | null {
  const { history, priceLower, priceUpper, userLiquidity, activeLiquidity, depositUsd } = input;
  if (history.length < 2 || !(depositUsd > 0) || priceLower >= priceUpper) return null;

  const share = userLiquidity + activeLiquidity > 0
    ? userLiquidity / (userLiquidity + activeLiquidity)
    : 0;

  let feesUsd = 0;
  let daysInRange = 0;
  for (const d of history) {
    const inRange = d.price0 >= priceLower && d.price0 <= priceUpper;
    if (inRange) {
      daysInRange++;
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
    daysInRange,
    feesUsd,
    ilFraction,
    ilUsd,
    netUsd,
    netApr: annualise(netUsd),
    feeApr: annualise(feesUsd),
    endPrice,
    entryPrice,
  };
}
