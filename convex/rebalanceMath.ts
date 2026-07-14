const Q96 = 1n << 96n;
const Q192 = 1n << 192n;
const MAX_UINT256 = (1n << 256n) - 1n;

export function getSqrtRatioAtTick(tick: number): bigint {
  const absTick = BigInt(tick < 0 ? -tick : tick);
  let ratio = (absTick & 0x1n) !== 0n ? 0xfffcb933bd6fad37aa2d162d1a594001n : 0x100000000000000000000000000000000n;
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
  return (ratio >> 32n) + (ratio % (1n << 32n) === 0n ? 0n : 1n);
}

function amount0(sqrtA: bigint, sqrtB: bigint, liquidity: bigint): bigint {
  if (sqrtA > sqrtB) [sqrtA, sqrtB] = [sqrtB, sqrtA];
  return sqrtA === 0n ? 0n : ((liquidity << 96n) * (sqrtB - sqrtA)) / sqrtB / sqrtA;
}

function amount1(sqrtA: bigint, sqrtB: bigint, liquidity: bigint): bigint {
  if (sqrtA > sqrtB) [sqrtA, sqrtB] = [sqrtB, sqrtA];
  return (liquidity * (sqrtB - sqrtA)) / Q96;
}

export function amountsForLiquidity(sqrtPriceX96: bigint, tickLower: number, tickUpper: number, liquidity: bigint): [bigint, bigint] {
  const sqrtA = getSqrtRatioAtTick(tickLower);
  const sqrtB = getSqrtRatioAtTick(tickUpper);
  const [lo, hi] = sqrtA < sqrtB ? [sqrtA, sqrtB] : [sqrtB, sqrtA];
  if (sqrtPriceX96 <= lo) return [amount0(lo, hi, liquidity), 0n];
  if (sqrtPriceX96 < hi) return [amount0(sqrtPriceX96, hi, liquidity), amount1(lo, sqrtPriceX96, liquidity)];
  return [0n, amount1(lo, hi, liquidity)];
}

function liquidityForAmount0(sqrtA: bigint, sqrtB: bigint, value: bigint): bigint {
  if (sqrtA > sqrtB) [sqrtA, sqrtB] = [sqrtB, sqrtA];
  return (value * ((sqrtA * sqrtB) / Q96)) / (sqrtB - sqrtA);
}

function liquidityForAmount1(sqrtA: bigint, sqrtB: bigint, value: bigint): bigint {
  if (sqrtA > sqrtB) [sqrtA, sqrtB] = [sqrtB, sqrtA];
  return (value * Q96) / (sqrtB - sqrtA);
}

export function liquidityForAmounts(sqrtPriceX96: bigint, tickLower: number, tickUpper: number, value0: bigint, value1: bigint): bigint {
  const sqrtA = getSqrtRatioAtTick(tickLower);
  const sqrtB = getSqrtRatioAtTick(tickUpper);
  const [lo, hi] = sqrtA < sqrtB ? [sqrtA, sqrtB] : [sqrtB, sqrtA];
  if (sqrtPriceX96 <= lo) return liquidityForAmount0(lo, hi, value0);
  if (sqrtPriceX96 >= hi) return liquidityForAmount1(lo, hi, value1);
  const l0 = liquidityForAmount0(sqrtPriceX96, hi, value0);
  const l1 = liquidityForAmount1(lo, sqrtPriceX96, value1);
  return l0 < l1 ? l0 : l1;
}

const floorTick = (tick: number, spacing: number) => Math.floor(tick / spacing) * spacing;
const ceilTick = (tick: number, spacing: number) => Math.ceil(tick / spacing) * spacing;
const roundTick = (tick: number, spacing: number) => Math.round(tick / spacing) * spacing;

/** Minimal-swap range with the live price near the edge of the token-heavy side. */
export function chooseRange(currentTick: number, spacing: number, width: number, minAllowed: number, maxAllowed: number, heavySide: 0 | 1) {
  if (spacing <= 0 || width <= 0 || width % spacing !== 0) throw new Error("Policy width is not usable for this pool's tick spacing");
  const minLower = ceilTick(minAllowed, spacing);
  const maxLower = floorTick(maxAllowed - width, spacing);
  if (minLower > maxLower) throw new Error("Allowed area is narrower than the configured LP range");
  const edge = Math.max(Math.round((width * 0.12) / spacing), 1) * spacing;
  let lower = heavySide === 0 ? roundTick(currentTick - edge, spacing) : roundTick(currentTick + edge, spacing) - width;
  lower = Math.max(minLower, Math.min(maxLower, lower));
  const upper = lower + width;
  if (currentTick < lower || currentTick >= upper) throw new Error("Live price is outside the owner's allowed automation area");
  return { tickLower: lower, tickUpper: upper };
}

/** Exact value-gap sizing in token1 raw-value space. */
export function planSwap(sqrtPriceX96: bigint, tickLower: number, tickUpper: number, balance0: bigint, balance1: bigint) {
  const sqrtSquared = sqrtPriceX96 * sqrtPriceX96;
  const value0 = balance0 * sqrtSquared;
  const value1 = balance1 * Q192;
  const total = value0 + value1;
  if (total === 0n) return { sellSide: null as 0 | 1 | null, amountIn: 0n };
  const [ratio0, ratio1] = amountsForLiquidity(sqrtPriceX96, tickLower, tickUpper, 10n ** 18n);
  const target0Weight = ratio0 * sqrtSquared;
  const target1Weight = ratio1 * Q192;
  const targetTotal = target0Weight + target1Weight;
  if (targetTotal === 0n) return { sellSide: null as 0 | 1 | null, amountIn: 0n };
  const wanted0 = (total * target0Weight) / targetTotal;
  const tolerance = total / 2_000n; // Ignore value gaps below 0.05%.
  if (value0 > wanted0 + tolerance) return { sellSide: 0 as const, amountIn: ((value0 - wanted0) * Q192) / sqrtSquared };
  if (wanted0 > value0 + tolerance) return { sellSide: 1 as const, amountIn: (wanted0 - value0) / Q192 };
  return { sellSide: null as 0 | 1 | null, amountIn: 0n };
}

export function heavySide(sqrtPriceX96: bigint, balance0: bigint, balance1: bigint): 0 | 1 {
  return balance0 * sqrtPriceX96 * sqrtPriceX96 >= balance1 * Q192 ? 0 : 1;
}
