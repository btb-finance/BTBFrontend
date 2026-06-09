import type { PublicClient } from 'viem';
import { UNISWAP_V3 } from './addresses';
import { NPM_ABI, FACTORY_ABI, POOL_ABI, ERC20_META_ABI } from './abis';
import { getAmountsForLiquidity } from './math';
import type { LiquidityPosition } from '@/protocols/types';

/**
 * Read every Uniswap V3 position the owner holds on mainnet, with current
 * token amounts, claimable fees, and in/out-of-range status. Read-only — safe.
 */
export async function fetchV3Positions(
  client: PublicClient,
  owner: `0x${string}`,
): Promise<LiquidityPosition[]> {
  const npm = UNISWAP_V3.positionManager;

  const count = (await client.readContract({
    address: npm, abi: NPM_ABI, functionName: 'balanceOf', args: [owner],
  })) as bigint;
  const n = Number(count);
  if (n === 0) return [];

  // 1) tokenId for each owned position NFT
  const idxCalls = Array.from({ length: n }, (_, i) => ({
    address: npm, abi: NPM_ABI, functionName: 'tokenOfOwnerByIndex' as const, args: [owner, BigInt(i)] as const,
  }));
  const tokenIds = (await client.multicall({ contracts: idxCalls, allowFailure: true }))
    .map((r) => (r.status === 'success' ? (r.result as bigint) : undefined))
    .filter((x): x is bigint => x !== undefined);

  // 2) position struct for each tokenId
  const posCalls = tokenIds.map((id) => ({
    address: npm, abi: NPM_ABI, functionName: 'positions' as const, args: [id] as const,
  }));
  const posRes = await client.multicall({ contracts: posCalls, allowFailure: true });

  type Raw = {
    id: bigint; token0: `0x${string}`; token1: `0x${string}`; fee: number;
    tickLower: number; tickUpper: number; liquidity: bigint; owed0: bigint; owed1: bigint;
  };
  const raws: Raw[] = [];
  posRes.forEach((r, i) => {
    if (r.status !== 'success') return;
    const p = r.result as readonly unknown[];
    const liquidity = p[7] as bigint;
    const owed0 = p[10] as bigint;
    const owed1 = p[11] as bigint;
    // Keep positions with liquidity OR claimable fees; drop fully-burned ones.
    if (liquidity === 0n && owed0 === 0n && owed1 === 0n) return;
    raws.push({
      id: tokenIds[i],
      token0: p[2] as `0x${string}`,
      token1: p[3] as `0x${string}`,
      fee: Number(p[4]),
      tickLower: Number(p[5]),
      tickUpper: Number(p[6]),
      liquidity,
      owed0, owed1,
    });
  });
  if (raws.length === 0) return [];

  // 3) resolve pools + slot0 (current price/tick) for each unique (t0,t1,fee)
  const poolKey = (r: Raw) => `${r.token0}-${r.token1}-${r.fee}`;
  const uniquePools = [...new Map(raws.map((r) => [poolKey(r), r])).values()];
  const poolAddrs = (await client.multicall({
    contracts: uniquePools.map((r) => ({
      address: UNISWAP_V3.factory, abi: FACTORY_ABI, functionName: 'getPool' as const,
      args: [r.token0, r.token1, r.fee] as const,
    })),
    allowFailure: true,
  })).map((r) => (r.status === 'success' ? (r.result as `0x${string}`) : undefined));

  const slot0Res = await client.multicall({
    contracts: poolAddrs.map((addr) => ({
      address: (addr ?? '0x0000000000000000000000000000000000000000') as `0x${string}`,
      abi: POOL_ABI, functionName: 'slot0' as const,
    })),
    allowFailure: true,
  });
  const poolState = new Map<string, { sqrtPriceX96: bigint; tick: number }>();
  uniquePools.forEach((r, i) => {
    const s = slot0Res[i];
    if (s.status !== 'success') return;
    const arr = s.result as readonly unknown[];
    poolState.set(poolKey(r), { sqrtPriceX96: arr[0] as bigint, tick: Number(arr[1]) });
  });

  // 4) token metadata (symbol/decimals) for every token involved
  const tokens = [...new Set(raws.flatMap((r) => [r.token0, r.token1]))] as `0x${string}`[];
  const metaRes = await client.multicall({
    contracts: tokens.flatMap((t) => [
      { address: t, abi: ERC20_META_ABI, functionName: 'symbol' as const },
      { address: t, abi: ERC20_META_ABI, functionName: 'decimals' as const },
    ]),
    allowFailure: true,
  });
  const meta = new Map<string, { symbol: string; decimals: number }>();
  tokens.forEach((t, i) => {
    const sym = metaRes[i * 2];
    const dec = metaRes[i * 2 + 1];
    meta.set(t.toLowerCase(), {
      symbol: sym.status === 'success' ? (sym.result as string) : '?',
      decimals: dec.status === 'success' ? Number(dec.result as number) : 18,
    });
  });

  // 5) assemble
  return raws.map((r): LiquidityPosition => {
    const st = poolState.get(poolKey(r));
    const m0 = meta.get(r.token0.toLowerCase()) ?? { symbol: '?', decimals: 18 };
    const m1 = meta.get(r.token1.toLowerCase()) ?? { symbol: '?', decimals: 18 };
    let amount0 = 0n, amount1 = 0n, inRange = false;
    if (st && r.liquidity > 0n) {
      [amount0, amount1] = getAmountsForLiquidity(st.sqrtPriceX96, r.tickLower, r.tickUpper, r.liquidity);
      inRange = st.tick >= r.tickLower && st.tick < r.tickUpper;
    }
    return {
      protocol: 'uniswap-v3',
      id: r.id,
      token0: r.token0, token1: r.token1,
      symbol0: m0.symbol, symbol1: m1.symbol,
      decimals0: m0.decimals, decimals1: m1.decimals,
      fee: r.fee, tickLower: r.tickLower, tickUpper: r.tickUpper,
      liquidity: r.liquidity,
      sqrtPriceX96: st?.sqrtPriceX96 ?? 0n,
      currentTick: st?.tick ?? 0,
      amount0, amount1,
      fees0: r.owed0, fees1: r.owed1,
      inRange,
    };
  });
}
