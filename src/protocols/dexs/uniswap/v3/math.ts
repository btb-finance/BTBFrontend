/**
 * Uniswap V3 price/liquidity math (BigInt, exact).
 *
 * Used here to display a position's current token amounts from its liquidity
 * and range. The canonical TickMath constants below are from Uniswap's
 * TickMath.sol. NOTE: this pass uses these for DISPLAY only — no transaction
 * relies on them — so a constant error is cosmetic, not a fund risk. They must
 * be re-verified before wiring remove/add (which use amountMin slippage).
 */

const Q96 = 2n ** 96n;
const MAX_UINT256 = (1n << 256n) - 1n;

/** TickMath.getSqrtRatioAtTick — sqrtPriceX96 at a given tick. */
export function getSqrtRatioAtTick(tick: number): bigint {
  const absTick = BigInt(tick < 0 ? -tick : tick);
  let ratio = (absTick & 0x1n) !== 0n
    ? 0xfffcb933bd6fad37aa2d162d1a594001n
    : 0x100000000000000000000000000000000n;
  if ((absTick & 0x2n) !== 0n) ratio = (ratio * 0xfff97272373d413259a46990580e213an) >> 128n;
  if ((absTick & 0x4n) !== 0n) ratio = (ratio * 0xfff2e50f5f656932ef12357cf3c7fdccn) >> 128n;
  if ((absTick & 0x8n) !== 0n) ratio = (ratio * 0xffe5caca7e10e4e61c3624eaa0941cd0n) >> 128n;
  if ((absTick & 0x10n) !== 0n) ratio = (ratio * 0xffcb9843d60f6159c9db58835c926644n) >> 128n;
  if ((absTick & 0x20n) !== 0n) ratio = (ratio * 0xff973b41fa98c081472e6896dfb254c0n) >> 128n;
  if ((absTick & 0x40n) !== 0n) ratio = (ratio * 0xff2ea16466c96a3843ec78b326b52861n) >> 128n;
  if ((absTick & 0x80n) !== 0n) ratio = (ratio * 0xfe5dee046a99a2a811c461f1969c3053n) >> 128n;
  if ((absTick & 0x100n) !== 0n) ratio = (ratio * 0xfcbe86c7900a88aedcffc83b479aa3a4n) >> 128n;
  if ((absTick & 0x200n) !== 0n) ratio = (ratio * 0xf987a7253ac413176f2b074cf7815e54n) >> 128n;
  if ((absTick & 0x400n) !== 0n) ratio = (ratio * 0xf3392b0822b70005940c7a398e4b70f3n) >> 128n;
  if ((absTick & 0x800n) !== 0n) ratio = (ratio * 0xe7159475a2c29b7443b29c7fa6e889d9n) >> 128n;
  if ((absTick & 0x1000n) !== 0n) ratio = (ratio * 0xd097f3bdfd2022b8845ad8f792aa5825n) >> 128n;
  if ((absTick & 0x2000n) !== 0n) ratio = (ratio * 0xa9f746462d870fdf8a65dc1f90e061e5n) >> 128n;
  if ((absTick & 0x4000n) !== 0n) ratio = (ratio * 0x70d869a156d2a1b890bb3df62baf32f7n) >> 128n;
  if ((absTick & 0x8000n) !== 0n) ratio = (ratio * 0x31be135f97d08fd981231505542fcfa6n) >> 128n;
  if ((absTick & 0x10000n) !== 0n) ratio = (ratio * 0x9aa508b5b7a84e1c677de54f3e99bc9n) >> 128n;
  if ((absTick & 0x20000n) !== 0n) ratio = (ratio * 0x5d6af8dedb81196699c329225ee604n) >> 128n;
  if ((absTick & 0x40000n) !== 0n) ratio = (ratio * 0x2216e584f5fa1ea926041bedfe98n) >> 128n;
  if ((absTick & 0x80000n) !== 0n) ratio = (ratio * 0x48a170391f7dc42444e8fa2n) >> 128n;

  if (tick > 0) ratio = MAX_UINT256 / ratio;

  // Round up, then shift from Q128 to Q96.
  return (ratio >> 32n) + (ratio % (1n << 32n) === 0n ? 0n : 1n);
}

export function getAmount0(sqrtA: bigint, sqrtB: bigint, liquidity: bigint): bigint {
  if (sqrtA > sqrtB) [sqrtA, sqrtB] = [sqrtB, sqrtA];
  if (sqrtA === 0n) return 0n;
  return ((liquidity << 96n) * (sqrtB - sqrtA)) / sqrtB / sqrtA;
}

export function getAmount1(sqrtA: bigint, sqrtB: bigint, liquidity: bigint): bigint {
  if (sqrtA > sqrtB) [sqrtA, sqrtB] = [sqrtB, sqrtA];
  return (liquidity * (sqrtB - sqrtA)) / Q96;
}

// ── LiquidityAmounts (inverse) — liquidity a given token amount supports ──────
function getLiquidityForAmount0(sqrtA: bigint, sqrtB: bigint, amount0: bigint): bigint {
  if (sqrtA > sqrtB) [sqrtA, sqrtB] = [sqrtB, sqrtA];
  const intermediate = (sqrtA * sqrtB) / Q96;
  return (amount0 * intermediate) / (sqrtB - sqrtA);
}

function getLiquidityForAmount1(sqrtA: bigint, sqrtB: bigint, amount1: bigint): bigint {
  if (sqrtA > sqrtB) [sqrtA, sqrtB] = [sqrtB, sqrtA];
  return (amount1 * Q96) / (sqrtB - sqrtA);
}

/**
 * LiquidityAmounts.getLiquidityForAmounts — the liquidity a deposit of
 * (amount0, amount1) supports in [tickLower, tickUpper] at the current price.
 * Used to estimate a new position's share of pool fees.
 */
export function liquidityForAmounts(
  sqrtPriceX96: bigint,
  tickLower: number,
  tickUpper: number,
  amount0: bigint,
  amount1: bigint,
): bigint {
  const sqrtA = getSqrtRatioAtTick(tickLower);
  const sqrtB = getSqrtRatioAtTick(tickUpper);
  const [lo, hi] = sqrtA < sqrtB ? [sqrtA, sqrtB] : [sqrtB, sqrtA];
  if (sqrtPriceX96 <= lo) return getLiquidityForAmount0(lo, hi, amount0);
  if (sqrtPriceX96 >= hi) return getLiquidityForAmount1(lo, hi, amount1);
  const l0 = getLiquidityForAmount0(sqrtPriceX96, hi, amount0);
  const l1 = getLiquidityForAmount1(lo, sqrtPriceX96, amount1);
  return l0 < l1 ? l0 : l1;
}

/**
 * Given the amount of ONE token the user wants to add (side 0 or 1), compute
 * both token amounts that keep the position's ratio at the current price.
 * Out-of-range positions take a single token.
 */
export function addAmounts(
  sqrtPriceX96: bigint,
  tickLower: number,
  tickUpper: number,
  side: 0 | 1,
  amountRaw: bigint,
): { amount0: bigint; amount1: bigint } {
  const sqrtA = getSqrtRatioAtTick(tickLower);
  const sqrtB = getSqrtRatioAtTick(tickUpper);
  const [lo, hi] = sqrtA < sqrtB ? [sqrtA, sqrtB] : [sqrtB, sqrtA];
  const sp = sqrtPriceX96;

  if (sp <= lo) return { amount0: side === 0 ? amountRaw : 0n, amount1: 0n }; // below range → token0 only
  if (sp >= hi) return { amount0: 0n, amount1: side === 1 ? amountRaw : 0n }; // above range → token1 only

  if (side === 0) {
    const L = getLiquidityForAmount0(sp, hi, amountRaw);
    return { amount0: amountRaw, amount1: getAmount1(lo, sp, L) };
  }
  const L = getLiquidityForAmount1(lo, sp, amountRaw);
  return { amount0: getAmount0(sp, hi, L), amount1: amountRaw };
}

// ── Tick range helpers (for minting new positions) ───────────────────────────
export const MIN_TICK = -887272;
export const MAX_TICK = 887272;

/** Tick spacing per fee tier. */
export const TICK_SPACINGS: Record<number, number> = { 100: 1, 500: 10, 3000: 60, 10000: 200 };

/** Snap a tick to the pool's spacing, kept within [MIN_TICK, MAX_TICK]. */
export function nearestUsableTick(tick: number, spacing: number): number {
  const rounded = Math.round(tick / spacing) * spacing;
  if (rounded < MIN_TICK) return rounded + spacing;
  if (rounded > MAX_TICK) return rounded - spacing;
  return rounded;
}

/**
 * Usable [tickLower, tickUpper] for a position around the current tick.
 * `pct = null` → full range; otherwise a ±pct% band in price space.
 */
export function rangeTicks(currentTick: number, spacing: number, pct: number | null): { tickLower: number; tickUpper: number } {
  if (pct === null) {
    return { tickLower: nearestUsableTick(MIN_TICK, spacing), tickUpper: nearestUsableTick(MAX_TICK, spacing) };
  }
  const ln1p = Math.log(1.0001);
  const dDown = Math.round(Math.log(1 - pct / 100) / ln1p);
  const dUp = Math.round(Math.log(1 + pct / 100) / ln1p);
  const tickLower = nearestUsableTick(currentTick + dDown, spacing);
  let tickUpper = nearestUsableTick(currentTick + dUp, spacing);
  if (tickUpper <= tickLower) tickUpper = tickLower + spacing;
  return { tickLower, tickUpper };
}

/** Which token(s) an add requires at the current price: 'both' | 'token0' | 'token1'. */
export function addSide(sqrtPriceX96: bigint, tickLower: number, tickUpper: number): 'both' | 'token0' | 'token1' {
  const sqrtA = getSqrtRatioAtTick(tickLower);
  const sqrtB = getSqrtRatioAtTick(tickUpper);
  const [lo, hi] = sqrtA < sqrtB ? [sqrtA, sqrtB] : [sqrtB, sqrtA];
  if (sqrtPriceX96 <= lo) return 'token0';
  if (sqrtPriceX96 >= hi) return 'token1';
  return 'both';
}

/** Token amounts locked by `liquidity` between two ticks at the current price. */
export function getAmountsForLiquidity(
  sqrtPriceX96: bigint,
  tickLower: number,
  tickUpper: number,
  liquidity: bigint,
): [bigint, bigint] {
  const sqrtA = getSqrtRatioAtTick(tickLower);
  const sqrtB = getSqrtRatioAtTick(tickUpper);
  const [lo, hi] = sqrtA < sqrtB ? [sqrtA, sqrtB] : [sqrtB, sqrtA];
  if (sqrtPriceX96 <= lo) return [getAmount0(lo, hi, liquidity), 0n];
  if (sqrtPriceX96 < hi) return [getAmount0(sqrtPriceX96, hi, liquidity), getAmount1(lo, sqrtPriceX96, liquidity)];
  return [0n, getAmount1(lo, hi, liquidity)];
}

/**
 * "Smart fit" — place a range of the requested width so the wallet's actual
 * balances deposit cleanly, instead of making the user discover on the amount
 * step that their token ratio doesn't match the range they picked.
 *
 *  - Both tokens held: slide the window until depositing ALL of token0 needs
 *    no more token1 than the wallet has (that requirement falls monotonically
 *    as the range rises, so a binary search finds the spot).
 *  - Only one token held: a single-sided range hugging the current price —
 *    just above it for token0, just below for token1 — that starts earning
 *    once price moves into range.
 *
 * Returns the fitted range plus which side (`side`) to anchor with its full
 * balance; `single` marks a one-token, out-of-range placement.
 */
export function fitRangeToBalances(
  sqrtPriceX96: bigint,
  currentTick: number,
  widthTicks: number,
  spacing: number,
  bal0: bigint,
  bal1: bigint,
): { tickLower: number; tickUpper: number; side: 0 | 1; single: boolean } | null {
  if (bal0 <= 0n && bal1 <= 0n) return null;
  const minU = nearestUsableTick(MIN_TICK, spacing);
  const maxU = nearestUsableTick(MAX_TICK, spacing);
  const width = Math.min(Math.max(Math.round(widthTicks / spacing), 1) * spacing, maxU - minU);

  // First usable lower tick strictly above the price (token0-only ranges) and
  // last usable upper tick at/below it (token1-only ranges). The latter needs
  // a price check: when the current tick sits on a spacing boundary the floor
  // can still be a hair above the actual price, leaving the range fractionally
  // in-range and demanding dust of the token the wallet doesn't have.
  const aboveLo = Math.min(Math.floor(currentTick / spacing) * spacing + spacing, maxU - width);
  let belowHi = Math.floor(currentTick / spacing) * spacing;
  if (getSqrtRatioAtTick(belowHi) > sqrtPriceX96) belowHi -= spacing;
  belowHi = Math.max(belowHi, minU + width);

  if (bal1 <= 0n) return { tickLower: aboveLo, tickUpper: aboveLo + width, side: 0, single: true };
  if (bal0 <= 0n) return { tickLower: belowHi - width, tickUpper: belowHi, side: 1, single: true };

  // Both tokens: lowest placement still straddling the price → fully above it.
  const loMin = Math.max(belowHi - width + spacing, minU);
  const loMax = Math.max(aboveLo, loMin);
  const fits = (lo: number) => addAmounts(sqrtPriceX96, lo, lo + width, 0, bal0).amount1 <= bal1;

  let lt = 0, rt = Math.round((loMax - loMin) / spacing);
  while (lt < rt) {
    const mid = (lt + rt) >> 1;
    if (fits(loMin + mid * spacing)) rt = mid; else lt = mid + 1;
  }
  const tickLower = loMin + lt * spacing;
  return { tickLower, tickUpper: tickLower + width, side: 0, single: currentTick < tickLower };
}
