export interface LiquidityRange {
  minPrice: number;
  maxPrice: number;
  minTick: number;
  maxTick: number;
}

export interface LiquidityPosition {
  token0Amount: string;
  token1Amount: string;
  liquidity: string;
  range: LiquidityRange;
}

export interface LiquidityCalculation {
  token0Amount: bigint;
  token1Amount: bigint;
  liquidity: bigint;
  estimatedLPTokens: bigint;
  priceImpact: number;
  expectedFees24h: bigint;
  expectedAPR: number;
}

export interface PriceRange {
  min: number;
  max: number;
  current: number;
}

export interface PoolInfo {
  token0: string;
  token1: string;
  token0Symbol: string;
  token1Symbol: string;
  token0Decimals: number;
  token1Decimals: number;
  fee: number;
  liquidity: bigint;
  sqrtPriceX96: bigint;
  tick: number;
  currentPrice: number;
  totalValueLocked: bigint;
}

export interface LiquidityChartData {
  price: number;
  liquidity: number;
  inRange: boolean;
}

export interface FeeTier {
  value: number;
  label: string;
  description: string;
}

export const FEE_TIERS: FeeTier[] = [
  { value: 500, label: "0.05%", description: "Best for stable pairs" },
  { value: 3000, label: "0.3%", description: "Best for most pairs" },
  { value: 10000, label: "1%", description: "Best for exotic pairs" },
];

export interface UserPosition {
  id: string;
  tokenId: bigint;
  liquidity: bigint;
  token0Amount: bigint;
  token1Amount: bigint;
  minTick: number;
  maxTick: number;
  feesEarned0: bigint;
  feesEarned1: bigint;
  createdAt: number;
}
