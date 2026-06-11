import type { PublicClient } from 'viem';
import { UNISWAP_V3, FEE_TIERS } from './addresses';
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

/**
 * Resolve ALL fee tiers of a token pair in three batched round-trips, so the
 * mint sheet can switch tiers instantly instead of refetching per click.
 */
export async function fetchPoolsForMint(
  client: PublicClient,
  tokenA: `0x${string}`,
  tokenB: `0x${string}`,
): Promise<Record<number, MintPool>> {
  const [token0, token1] = tokenA.toLowerCase() < tokenB.toLowerCase() ? [tokenA, tokenB] : [tokenB, tokenA];

  const [addrRes, metaRes] = await Promise.all([
    client.multicall({
      contracts: FEE_TIERS.map((fee) => ({
        address: UNISWAP_V3.factory, abi: FACTORY_ABI, functionName: 'getPool' as const, args: [token0, token1, fee] as const,
      })),
      allowFailure: true,
    }),
    client.multicall({
      contracts: [
        { address: token0, abi: ERC20_META_ABI, functionName: 'symbol' },
        { address: token0, abi: ERC20_META_ABI, functionName: 'decimals' },
        { address: token1, abi: ERC20_META_ABI, functionName: 'symbol' },
        { address: token1, abi: ERC20_META_ABI, functionName: 'decimals' },
      ],
      allowFailure: true,
    }),
  ]);

  const addrs = FEE_TIERS.map((fee, i) => ({
    fee,
    pool: (addrRes[i].status === 'success' ? (addrRes[i].result as `0x${string}`) : ZERO) as `0x${string}`,
  }));
  const existing = addrs.filter((a) => a.pool && a.pool.toLowerCase() !== ZERO);

  // slot0 + liquidity for every existing tier, one batch
  const stateRes = existing.length > 0
    ? await client.multicall({
        contracts: existing.flatMap((a) => [
          { address: a.pool, abi: POOL_ABI, functionName: 'slot0' as const },
          { address: a.pool, abi: POOL_ABI, functionName: 'liquidity' as const },
        ]),
        allowFailure: true,
      })
    : [];

  const meta = {
    symbol0: metaRes[0].status === 'success' ? (metaRes[0].result as string) : '?',
    decimals0: metaRes[1].status === 'success' ? Number(metaRes[1].result) : 18,
    symbol1: metaRes[2].status === 'success' ? (metaRes[2].result as string) : '?',
    decimals1: metaRes[3].status === 'success' ? Number(metaRes[3].result) : 18,
  };

  const out: Record<number, MintPool> = {};
  for (const a of addrs) {
    const idx = existing.findIndex((e) => e.fee === a.fee);
    let exists = idx >= 0, sqrtPriceX96 = 0n, tick = 0, liquidity = 0n;
    if (idx >= 0) {
      const s = stateRes[idx * 2], l = stateRes[idx * 2 + 1];
      if (s.status === 'success') {
        const slot = s.result as readonly unknown[];
        sqrtPriceX96 = slot[0] as bigint;
        tick = Number(slot[1]);
      } else exists = false; // state read failed — treat as unusable
      if (l.status === 'success') liquidity = l.result as bigint;
    }
    out[a.fee] = { address: a.pool, token0, token1, ...meta, fee: a.fee, exists, sqrtPriceX96, tick, liquidity };
  }
  return out;
}
