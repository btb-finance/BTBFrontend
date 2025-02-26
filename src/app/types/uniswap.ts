/**
 * Uniswap related type definitions
 */

export interface Token {
  address: string;
  symbol: string;
  decimals: number;
  name?: string;
}

export interface Pool {
  address: string;
  token0: Token;
  token1: Token;
  fee: number;
  tickSpacing: number;
  liquidity: string;
  sqrtPrice: string;
  tick: number;
  apr: number;
  tvl: number;
  volume24h?: number;
}

export interface Position {
  tokenId: string;
  owner: string;
  token0: Token;
  token1: Token;
  fee: number;
  tickLower: number;
  tickUpper: number;
  liquidity: string;
  token0Balance: string;
  token1Balance: string;
  apr?: number;
  poolAddress?: string;
}
