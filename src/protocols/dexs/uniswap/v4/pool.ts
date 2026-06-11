import type { PublicClient } from 'viem';
import { UNISWAP_V4, NATIVE_CURRENCY, isNativeCurrency, type PoolKey } from './addresses';
import { POSITION_MANAGER_ABI, STATE_VIEW_ABI } from './abis';
import { ERC20_META_ABI } from '../v3/abis';
import type { MintPool } from '../v3/pool';

/**
 * A V4 pool ready for the mint sheet — same shape as V3's MintPool (so the
 * create-position UI is shared) plus the PoolKey needed to mint. There's no
 * per-pool contract in V4; `address` carries the zero address and `poolId`
 * identifies the pool inside the singleton PoolManager.
 */
export interface V4MintPool extends MintPool {
  poolId: `0x${string}`;
  tickSpacing: number;
  hooks: `0x${string}`;
  poolKey: PoolKey;
}

/**
 * Resolve a Uniswap V4 pool by its bytes32 poolId (as listed by the subgraph).
 * The full PoolKey (fee, tickSpacing, hooks) comes from the PositionManager's
 * poolKeys mapping — populated the first time anyone minted in the pool, so it
 * covers every pool a user would find in the Earn list. Read-only.
 */
export async function fetchV4PoolForMint(
  client: PublicClient,
  poolId: `0x${string}`,
): Promise<V4MintPool> {
  const id = poolId.toLowerCase() as `0x${string}`;
  const id25 = id.slice(0, 52) as `0x${string}`; // bytes25 — PositionManager's truncated key

  const [keyRes, slotRes, liqRes] = await client.multicall({
    contracts: [
      { address: UNISWAP_V4.positionManager, abi: POSITION_MANAGER_ABI, functionName: 'poolKeys', args: [id25] },
      { address: UNISWAP_V4.stateView, abi: STATE_VIEW_ABI, functionName: 'getSlot0', args: [id] },
      { address: UNISWAP_V4.stateView, abi: STATE_VIEW_ABI, functionName: 'getLiquidity', args: [id] },
    ],
    allowFailure: true,
  });

  if (keyRes.status !== 'success') throw new Error('pool key lookup failed');
  const [currency0, currency1, fee, tickSpacing, hooks] = keyRes.result as readonly [
    `0x${string}`, `0x${string}`, number, number, `0x${string}`,
  ];
  const poolKey: PoolKey = { currency0, currency1, fee: Number(fee), tickSpacing: Number(tickSpacing), hooks };

  let sqrtPriceX96 = 0n, tick = 0;
  if (slotRes.status === 'success') {
    const s = slotRes.result as readonly unknown[];
    sqrtPriceX96 = s[0] as bigint;
    tick = Number(s[1]);
  }
  const liquidity = liqRes.status === 'success' ? (liqRes.result as bigint) : 0n;
  // tickSpacing 0 = key never registered with the PositionManager; price 0 = uninitialized.
  const exists = poolKey.tickSpacing !== 0 && sqrtPriceX96 > 0n;

  // token metadata — currency0 may be native ETH (address 0)
  const erc20s = [currency0, currency1].filter((t) => !isNativeCurrency(t));
  const metaRes = await client.multicall({
    contracts: erc20s.flatMap((t) => [
      { address: t, abi: ERC20_META_ABI, functionName: 'symbol' as const },
      { address: t, abi: ERC20_META_ABI, functionName: 'decimals' as const },
    ]),
    allowFailure: true,
  });
  const meta = new Map<string, { symbol: string; decimals: number }>();
  erc20s.forEach((t, i) => {
    const sym = metaRes[i * 2], dec = metaRes[i * 2 + 1];
    meta.set(t.toLowerCase(), {
      symbol: sym.status === 'success' ? (sym.result as string) : '?',
      decimals: dec.status === 'success' ? Number(dec.result as number) : 18,
    });
  });
  const metaOf = (t: `0x${string}`) =>
    isNativeCurrency(t) ? { symbol: 'ETH', decimals: 18 } : meta.get(t.toLowerCase()) ?? { symbol: '?', decimals: 18 };
  const m0 = metaOf(currency0);
  const m1 = metaOf(currency1);

  return {
    address: NATIVE_CURRENCY, // no per-pool contract in V4
    token0: currency0, token1: currency1,
    symbol0: m0.symbol, symbol1: m1.symbol,
    decimals0: m0.decimals, decimals1: m1.decimals,
    fee: poolKey.fee, exists, sqrtPriceX96, tick, liquidity,
    poolId: id, tickSpacing: poolKey.tickSpacing, hooks, poolKey,
  };
}
