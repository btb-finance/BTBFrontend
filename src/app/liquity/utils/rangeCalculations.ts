import { LiquidityCalculation, PriceRange } from "../types/liquity";

// Uniswap V3 math constants
const Q96 = 2n ** 96n;
const MIN_TICK = -887272;
const MAX_TICK = 887272;
const MIN_SQRT_RATIO = 4295128739n;
const MAX_SQRT_RATIO = 1461446703485210103287273052203988822378723970342n;

/**
 * Convert price to tick
 */
export function priceToTick(price: number): number {
  if (price <= 0) return MIN_TICK;
  const tick = Math.floor(Math.log(price) / Math.log(1.0001));
  return Math.max(MIN_TICK, Math.min(MAX_TICK, tick));
}

/**
 * Convert tick to price
 */
export function tickToPrice(tick: number): number {
  return Math.pow(1.0001, tick);
}

/**
 * Convert price to sqrtPriceX96
 */
export function priceToSqrtPriceX96(price: number): bigint {
  const sqrtPrice = Math.sqrt(price);
  return BigInt(Math.floor(sqrtPrice * Number(Q96)));
}

/**
 * Convert sqrtPriceX96 to price
 */
export function sqrtPriceX96ToPrice(sqrtPriceX96: bigint): number {
  const sqrtPrice = Number(sqrtPriceX96) / Number(Q96);
  return sqrtPrice * sqrtPrice;
}

/**
 * Calculate liquidity from token amounts
 * Based on Uniswap V3 formula
 */
export function getLiquidityForAmounts(
  sqrtPriceX96: bigint,
  sqrtPriceAX96: bigint,
  sqrtPriceBX96: bigint,
  amount0: bigint,
  amount1: bigint
): bigint {
  if (sqrtPriceAX96 > sqrtPriceBX96) {
    [sqrtPriceAX96, sqrtPriceBX96] = [sqrtPriceBX96, sqrtPriceAX96];
  }

  let liquidity: bigint;

  if (sqrtPriceX96 <= sqrtPriceAX96) {
    // Current price is below the range
    liquidity = getLiquidityForAmount0(sqrtPriceAX96, sqrtPriceBX96, amount0);
  } else if (sqrtPriceX96 < sqrtPriceBX96) {
    // Current price is within the range
    const liquidity0 = getLiquidityForAmount0(sqrtPriceX96, sqrtPriceBX96, amount0);
    const liquidity1 = getLiquidityForAmount1(sqrtPriceAX96, sqrtPriceX96, amount1);
    liquidity = liquidity0 < liquidity1 ? liquidity0 : liquidity1;
  } else {
    // Current price is above the range
    liquidity = getLiquidityForAmount1(sqrtPriceAX96, sqrtPriceBX96, amount1);
  }

  return liquidity;
}

/**
 * Calculate liquidity for token0
 */
function getLiquidityForAmount0(
  sqrtPriceAX96: bigint,
  sqrtPriceBX96: bigint,
  amount0: bigint
): bigint {
  if (sqrtPriceAX96 > sqrtPriceBX96) {
    [sqrtPriceAX96, sqrtPriceBX96] = [sqrtPriceBX96, sqrtPriceAX96];
  }
  const intermediate = (sqrtPriceAX96 * sqrtPriceBX96) / Q96;
  return (amount0 * intermediate) / (sqrtPriceBX96 - sqrtPriceAX96);
}

/**
 * Calculate liquidity for token1
 */
function getLiquidityForAmount1(
  sqrtPriceAX96: bigint,
  sqrtPriceBX96: bigint,
  amount1: bigint
): bigint {
  if (sqrtPriceAX96 > sqrtPriceBX96) {
    [sqrtPriceAX96, sqrtPriceBX96] = [sqrtPriceBX96, sqrtPriceAX96];
  }
  return (amount1 * Q96) / (sqrtPriceBX96 - sqrtPriceAX96);
}

/**
 * Calculate token amounts from liquidity
 */
export function getAmountsForLiquidity(
  liquidity: bigint,
  sqrtPriceX96: bigint,
  sqrtPriceAX96: bigint,
  sqrtPriceBX96: bigint
): { amount0: bigint; amount1: bigint } {
  if (sqrtPriceAX96 > sqrtPriceBX96) {
    [sqrtPriceAX96, sqrtPriceBX96] = [sqrtPriceBX96, sqrtPriceAX96];
  }

  let amount0: bigint;
  let amount1: bigint;

  if (sqrtPriceX96 <= sqrtPriceAX96) {
    // Current price is below the range
    amount0 = getAmount0ForLiquidity(sqrtPriceAX96, sqrtPriceBX96, liquidity);
    amount1 = 0n;
  } else if (sqrtPriceX96 < sqrtPriceBX96) {
    // Current price is within the range
    amount0 = getAmount0ForLiquidity(sqrtPriceX96, sqrtPriceBX96, liquidity);
    amount1 = getAmount1ForLiquidity(sqrtPriceAX96, sqrtPriceX96, liquidity);
  } else {
    // Current price is above the range
    amount0 = 0n;
    amount1 = getAmount1ForLiquidity(sqrtPriceAX96, sqrtPriceBX96, liquidity);
  }

  return { amount0, amount1 };
}

/**
 * Calculate amount0 from liquidity
 */
function getAmount0ForLiquidity(
  sqrtPriceAX96: bigint,
  sqrtPriceBX96: bigint,
  liquidity: bigint
): bigint {
  if (sqrtPriceAX96 > sqrtPriceBX96) {
    [sqrtPriceAX96, sqrtPriceBX96] = [sqrtPriceBX96, sqrtPriceAX96];
  }
  return (liquidity * (sqrtPriceBX96 - sqrtPriceAX96)) / sqrtPriceBX96 / Q96;
}

/**
 * Calculate amount1 from liquidity
 */
function getAmount1ForLiquidity(
  sqrtPriceAX96: bigint,
  sqrtPriceBX96: bigint,
  liquidity: bigint
): bigint {
  if (sqrtPriceAX96 > sqrtPriceBX96) {
    [sqrtPriceAX96, sqrtPriceBX96] = [sqrtPriceBX96, sqrtPriceAX96];
  }
  return (liquidity * (sqrtPriceBX96 - sqrtPriceAX96)) / Q96;
}

/**
 * Calculate expected liquidity and amounts
 */
export function calculateLiquidity(
  token0Amount: string,
  token1Amount: string,
  currentPrice: number,
  minPrice: number,
  maxPrice: number,
  token0Decimals: number = 18,
  token1Decimals: number = 18
): LiquidityCalculation {
  const amount0 = BigInt(Math.floor(parseFloat(token0Amount) * 10 ** token0Decimals));
  const amount1 = BigInt(Math.floor(parseFloat(token1Amount) * 10 ** token1Decimals));

  const sqrtPriceX96 = priceToSqrtPriceX96(currentPrice);
  const sqrtPriceAX96 = priceToSqrtPriceX96(minPrice);
  const sqrtPriceBX96 = priceToSqrtPriceX96(maxPrice);

  const liquidity = getLiquidityForAmounts(
    sqrtPriceX96,
    sqrtPriceAX96,
    sqrtPriceBX96,
    amount0,
    amount1
  );

  const { amount0: actualAmount0, amount1: actualAmount1 } = getAmountsForLiquidity(
    liquidity,
    sqrtPriceX96,
    sqrtPriceAX96,
    sqrtPriceBX96
  );

  // Calculate price impact (simplified)
  const priceImpact = Math.abs(
    (Number(actualAmount0) / 10 ** token0Decimals - parseFloat(token0Amount)) /
      parseFloat(token0Amount)
  ) * 100;

  // Estimate daily fees (0.3% of TVL as example)
  const tvl = actualAmount0 + (actualAmount1 * BigInt(Math.floor(currentPrice * 1e18))) / BigInt(1e18);
  const expectedFees24h = (tvl * 3n) / 1000n / 365n; // 0.3% annual / 365

  // Estimate APR (simplified)
  const expectedAPR = 30; // Example: 30% APR

  return {
    token0Amount: actualAmount0,
    token1Amount: actualAmount1,
    liquidity,
    estimatedLPTokens: liquidity, // Simplified
    priceImpact: isNaN(priceImpact) ? 0 : priceImpact,
    expectedFees24h,
    expectedAPR,
  };
}

/**
 * Get preset price ranges based on current price
 */
export function getPresetRanges(currentPrice: number): PriceRange[] {
  return [
    {
      min: currentPrice * 0.9,
      max: currentPrice * 1.1,
      current: currentPrice,
    },
    {
      min: currentPrice * 0.8,
      max: currentPrice * 1.2,
      current: currentPrice,
    },
    {
      min: currentPrice * 0.5,
      max: currentPrice * 2,
      current: currentPrice,
    },
    {
      min: 0,
      max: Infinity,
      current: currentPrice,
    },
  ];
}

/**
 * Validate price range
 */
export function validateRange(minPrice: number, maxPrice: number, currentPrice: number): {
  valid: boolean;
  error?: string;
} {
  if (minPrice <= 0) {
    return { valid: false, error: "Minimum price must be greater than 0" };
  }
  if (maxPrice <= minPrice) {
    return { valid: false, error: "Maximum price must be greater than minimum price" };
  }
  if (minPrice > currentPrice * 10 || maxPrice < currentPrice * 0.1) {
    return { valid: false, error: "Price range is too far from current price" };
  }
  return { valid: true };
}

/**
 * Format price for display
 */
export function formatPrice(price: number, decimals: number = 6): string {
  if (price === 0) return "0";
  if (price === Infinity) return "∞";
  if (price < 0.000001) return price.toExponential(2);
  if (price < 1) return price.toFixed(decimals);
  if (price < 1000) return price.toFixed(4);
  if (price < 1000000) return price.toFixed(2);
  return price.toExponential(2);
}
