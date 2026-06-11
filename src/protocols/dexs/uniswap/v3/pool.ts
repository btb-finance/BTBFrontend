import type { PublicClient } from 'viem';
import { UNISWAP_V3 } from './addresses';
import { FACTORY_ABI, POOL_ABI, ERC20_META_ABI } from './abis';

export interface MintPool {
  /** Pool contract address (zero when the pool doesn't exist). */
  address: `0x${string}`;
  token0: `0x${string}`;   // sorted: lower address
  token1: `0x${string}`;
  symbol0: string; symbol1: string;
  decimals0: number; decimals1: number;
  fee: number;
  exists: boolean;
  sqrtPriceX96: bigint;
  tick: number;
  /** Current in-range liquidity — denominator for fee-share estimates. */
  liquidity: bigint;
}

const ZERO = '0x0000000000000000000000000000000000000000';

/**
 * Resolve the Uniswap V3 pool for a token pair + fee tier, returning sorted
 * tokens (token0 = lower address), their metadata, whether the pool exists, and
 * its current price/tick. Read-only.
 */
export async function fetchPoolForMint(
  client: PublicClient,
  tokenA: `0x${string}`,
  tokenB: `0x${string}`,
  fee: number,
): Promise<MintPool> {
  const [token0, token1] = tokenA.toLowerCase() < tokenB.toLowerCase() ? [tokenA, tokenB] : [tokenB, tokenA];

  const pool = (await client.readContract({
    address: UNISWAP_V3.factory, abi: FACTORY_ABI, functionName: 'getPool', args: [token0, token1, fee],
  })) as `0x${string}`;
  const exists = !!pool && pool.toLowerCase() !== ZERO;

  const metaRes = await client.multicall({
    contracts: [
      { address: token0, abi: ERC20_META_ABI, functionName: 'symbol' },
      { address: token0, abi: ERC20_META_ABI, functionName: 'decimals' },
      { address: token1, abi: ERC20_META_ABI, functionName: 'symbol' },
      { address: token1, abi: ERC20_META_ABI, functionName: 'decimals' },
    ],
    allowFailure: true,
  });

  let sqrtPriceX96 = 0n, tick = 0, liquidity = 0n;
  if (exists) {
    const [s, liq] = await Promise.all([
      client.readContract({ address: pool, abi: POOL_ABI, functionName: 'slot0' }) as Promise<readonly unknown[]>,
      client.readContract({ address: pool, abi: POOL_ABI, functionName: 'liquidity' }) as Promise<bigint>,
    ]);
    sqrtPriceX96 = s[0] as bigint;
    tick = Number(s[1]);
    liquidity = liq;
  }

  return {
    address: pool,
    token0, token1,
    symbol0: metaRes[0].status === 'success' ? (metaRes[0].result as string) : '?',
    decimals0: metaRes[1].status === 'success' ? Number(metaRes[1].result) : 18,
    symbol1: metaRes[2].status === 'success' ? (metaRes[2].result as string) : '?',
    decimals1: metaRes[3].status === 'success' ? Number(metaRes[3].result) : 18,
    fee, exists, sqrtPriceX96, tick, liquidity,
  };
}
