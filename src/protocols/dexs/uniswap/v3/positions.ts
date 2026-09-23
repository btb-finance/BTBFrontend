import type { PublicClient } from 'viem';
import { UNISWAP_V3_DEPLOYMENT, type V3Deployment } from './addresses';
import { NPM_ABI, FACTORY_ABI, POOL_ABI, ERC20_META_ABI, SLIPSTREAM_NPM_ABI, SLIPSTREAM_FACTORY_ABI, SLOT0_HEAD_ABI, RAMSES_NPM_ABI, FEE_GROWTH_ABI, TICKS_HEAD_ABI, SLIPSTREAM_TICKS_HEAD_ABI } from './abis';
import { getAmountsForLiquidity } from './math';
import type { LiquidityPosition } from '@/protocols/types';
import { withSafeMulticall } from '@/lib/safeMulticall';

/**
 * Read every V3-architecture position the owner holds on mainnet, with current
 * token amounts, claimable fees, and in/out-of-range status. Read-only — safe.
 * Defaults to Uniswap V3; pass a fork deployment (PancakeSwap V3) to read its
 * byte-compatible NonfungiblePositionManager instead.
 */
export async function fetchV3Positions(
  client: PublicClient,
  owner: `0x${string}`,
  d: V3Deployment = UNISWAP_V3_DEPLOYMENT,
  /** Pre-enumerated position tokenIds (from the Alchemy NFT index) — skips
   * the balanceOf + tokenOfOwnerByIndex round trips entirely. */
  knownIds?: bigint[],
): Promise<LiquidityPosition[]> {
  const npm = d.positionManager;
  // Slipstream keys pools by tickSpacing where V3 uses fee — same slot in the
  // positions() struct, same getPool arity, different meaning.
  const slip = !!d.slipstream;
  // Ramses: ten-field position struct, tickSpacing third, no nonce/operator.
  const compact = !!d.compactPositions;
  const npmAbi = compact ? RAMSES_NPM_ABI : slip ? SLIPSTREAM_NPM_ABI : NPM_ABI;

  let tokenIds: bigint[];
  if (knownIds) {
    if (knownIds.length === 0) return [];
    tokenIds = knownIds;
  } else {
    const count = (await client.readContract({
      address: npm, abi: NPM_ABI, functionName: 'balanceOf', args: [owner],
    })) as bigint;
    const n = Number(count);
    if (n === 0) return [];

    // 1) tokenId for each owned position NFT
    const idxCalls = Array.from({ length: n }, (_, i) => ({
      address: npm, abi: NPM_ABI, functionName: 'tokenOfOwnerByIndex' as const, args: [owner, BigInt(i)] as const,
    }));
    tokenIds = (await withSafeMulticall(client).multicall({ contracts: idxCalls, allowFailure: true }))
      .map((r) => (r.status === 'success' ? (r.result as bigint) : undefined))
      .filter((x): x is bigint => x !== undefined);
    if (n > 0 && tokenIds.length === 0) throw new Error('Could not read owned LP NFT ids');
  }

  // 2) position struct for each tokenId
  const posCalls = tokenIds.map((id) => ({
    address: npm, abi: npmAbi, functionName: 'positions' as const, args: [id] as const,
  }));
  const posRes = await withSafeMulticall(client).multicall({ contracts: posCalls, allowFailure: true });
  if (posCalls.length > 0 && !posRes.some((result) => result.status === 'success')) {
    throw new Error('Could not read LP NFT balances');
  }

  type Raw = {
    id: bigint; token0: `0x${string}`; token1: `0x${string}`; fee: number;
    tickLower: number; tickUpper: number; liquidity: bigint; owed0: bigint; owed1: bigint;
    inside0Last: bigint; inside1Last: bigint;
  };
  const raws: Raw[] = [];
  posRes.forEach((r, i) => {
    if (r.status !== 'success') return;
    const raw = r.result as readonly unknown[];
    // Normalise the compact layout onto the twelve-field one by prefixing two
    // empty slots, so every index below is the same for both.
    const p = compact ? [undefined, undefined, ...raw] : raw;
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
      inside0Last: p[8] as bigint, inside1Last: p[9] as bigint,
    });
  });
  if (raws.length === 0) return [];

  // 3) resolve pools + slot0 (current price/tick) for each unique (t0,t1,fee)
  const poolKey = (r: Raw) => `${r.token0}-${r.token1}-${r.fee}`;
  const uniquePools = [...new Map(raws.map((r) => [poolKey(r), r])).values()];
  const poolAddrs = (await withSafeMulticall(client).multicall({
    contracts: uniquePools.map((r) => ({
      address: d.factory, abi: slip ? SLIPSTREAM_FACTORY_ABI : FACTORY_ABI, functionName: 'getPool' as const,
      args: [r.token0, r.token1, r.fee] as const,
    })),
    allowFailure: true,
  })).map((r) => (r.status === 'success' ? (r.result as `0x${string}`) : undefined));
  if (uniquePools.length > 0 && poolAddrs.every((address) => !address)) {
    throw new Error('Could not resolve LP pools');
  }

  const slot0Res = await withSafeMulticall(client).multicall({
    contracts: poolAddrs.map((addr) => ({
      address: (addr ?? '0x0000000000000000000000000000000000000000') as `0x${string}`,
      // Price and tick only: works for seven-field (V3, Ramses) and six-field (Slipstream) slot0 alike.
      abi: SLOT0_HEAD_ABI, functionName: 'slot0' as const,
    })),
    allowFailure: true,
  });
  if (slot0Res.length > 0 && !slot0Res.some((result) => result.status === 'success')) {
    throw new Error('Could not read live LP balances');
  }
  // Slipstream fees are per pool, not per position — read them for display.
  const feeRes = slip
    ? await withSafeMulticall(client).multicall({
        contracts: poolAddrs.map((addr) => ({
          address: (addr ?? '0x0000000000000000000000000000000000000000') as `0x${string}`,
          abi: POOL_ABI, functionName: 'fee' as const,
        })),
        allowFailure: true,
      })
    : null;
  const poolState = new Map<string, { sqrtPriceX96: bigint; tick: number; fee?: number }>();
  uniquePools.forEach((r, i) => {
    const s = slot0Res[i];
    if (s.status !== 'success') return;
    const arr = s.result as readonly unknown[];
    const f = feeRes?.[i];
    poolState.set(poolKey(r), { sqrtPriceX96: arr[0] as bigint, tick: Number(arr[1]), fee: f?.status === 'success' ? Number(f.result) : undefined });
  });
  // Same retry for a Slipstream fee the batch dropped, so the tier never shows 0%.
  if (slip) await Promise.all(uniquePools.map(async (r, i) => {
    const st = poolState.get(poolKey(r));
    const addr = poolAddrs[i];
    if (!st || st.fee != null || !addr) return;
    st.fee = await client.readContract({ address: addr, abi: POOL_ABI, functionName: 'fee' }).then(Number).catch(() => undefined);
  }));

  // 3b) Live unclaimed fees. tokensOwed on the position only moves when the
  // position is touched (add, remove, collect), so on its own it reads "none"
  // for a position that has been earning for weeks. Add what accrued since:
  // liquidity * (feeGrowthInside now - feeGrowthInside at last touch) / 2^128.
  // Ramses' tick struct is not the Uniswap one, so it keeps tokensOwed only.
  const accrued = new Map<bigint, [bigint, bigint]>();
  if (!compact) {
    const addrOf = new Map(uniquePools.map((r, i) => [poolKey(r), poolAddrs[i]]));
    const live = raws.filter((r) => r.liquidity > 0n && addrOf.get(poolKey(r)) && poolState.has(poolKey(r)));
    const tickAbi = slip ? SLIPSTREAM_TICKS_HEAD_ABI : TICKS_HEAD_ABI;
    const res = live.length === 0 ? [] : await withSafeMulticall(client).multicall({
      contracts: live.flatMap((r) => {
        const pool = addrOf.get(poolKey(r))!;
        return [
          { address: pool, abi: FEE_GROWTH_ABI, functionName: 'feeGrowthGlobal0X128' as const },
          { address: pool, abi: FEE_GROWTH_ABI, functionName: 'feeGrowthGlobal1X128' as const },
          { address: pool, abi: tickAbi, functionName: 'ticks' as const, args: [r.tickLower] as const },
          { address: pool, abi: tickAbi, functionName: 'ticks' as const, args: [r.tickUpper] as const },
        ];
      }),
      allowFailure: true,
    }).catch(() => []);
    const MASK = (1n << 256n) - 1n;
    const sub = (a: bigint, b: bigint) => (a - b) & MASK;
    live.forEach((r, i) => {
      const [g0, g1, lo, hi] = res.slice(i * 4, i * 4 + 4);
      if (!g0 || !g1 || !lo || !hi || [g0, g1, lo, hi].some((x) => x.status !== 'success')) return;
      const tick = poolState.get(poolKey(r))!.tick;
      const outside = (t: unknown) => { const a = t as readonly bigint[]; return slip ? [a[3], a[4]] : [a[2], a[3]]; };
      const [lo0, lo1] = outside(lo.result), [hi0, hi1] = outside(hi.result);
      const inside = (global: bigint, below: bigint, above: bigint) => {
        const b = tick >= r.tickLower ? below : sub(global, below);
        const a = tick < r.tickUpper ? above : sub(global, above);
        return sub(sub(global, b), a);
      };
      const in0 = inside(g0.result as bigint, lo0, hi0), in1 = inside(g1.result as bigint, lo1, hi1);
      const d0 = (sub(in0, r.inside0Last) * r.liquidity) >> 128n;
      const d1 = (sub(in1, r.inside1Last) * r.liquidity) >> 128n;
      // A wrapped subtraction from a bad read shows up as an absurd number; keep tokensOwed then.
      if (d0 >= 1n << 128n || d1 >= 1n << 128n) return;
      accrued.set(r.id, [d0, d1]);
    });
  }

  // 4) token metadata (symbol/decimals) for every token involved
  const tokens = [...new Set(raws.flatMap((r) => [r.token0, r.token1]))] as `0x${string}`[];
  const metaRes = await withSafeMulticall(client).multicall({
    contracts: tokens.flatMap((t) => [
      { address: t, abi: ERC20_META_ABI, functionName: 'symbol' as const },
      { address: t, abi: ERC20_META_ABI, functionName: 'decimals' as const },
    ]),
    allowFailure: true,
  });
  const meta = new Map<string, { symbol: string; decimals: number }>();
  // A busy RPC can fail part of a batch. Retry those tokens one read at a
  // time: a wrong decimals default turns every amount and price into nonsense.
  await Promise.all(tokens.map(async (t, i) => {
    const sym = metaRes[i * 2];
    const dec = metaRes[i * 2 + 1];
    const read = <T,>(fn: 'symbol' | 'decimals') => client.readContract({ address: t, abi: ERC20_META_ABI, functionName: fn }).then((r) => r as T).catch(() => undefined);
    const symbol = sym.status === 'success' ? (sym.result as string) : await read<string>('symbol');
    const decimals = dec.status === 'success' ? Number(dec.result as number) : await read<number>('decimals');
    meta.set(t.toLowerCase(), { symbol: symbol ?? '?', decimals: decimals != null ? Number(decimals) : 18 });
  }));

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
      protocol: d.protocol,
      id: r.id,
      token0: r.token0, token1: r.token1,
      symbol0: m0.symbol, symbol1: m1.symbol,
      decimals0: m0.decimals, decimals1: m1.decimals,
      fee: slip ? (st?.fee ?? 0) : r.fee, tickLower: r.tickLower, tickUpper: r.tickUpper,
      // Every position carries its manager so later actions resolve the same deployment on the same chain.
      positionManager: npm,
      ...(slip ? { tickSpacing: r.fee } : {}),
      liquidity: r.liquidity,
      sqrtPriceX96: st?.sqrtPriceX96 ?? 0n,
      currentTick: st?.tick ?? 0,
      amount0, amount1,
      fees0: r.owed0 + (accrued.get(r.id)?.[0] ?? 0n), fees1: r.owed1 + (accrued.get(r.id)?.[1] ?? 0n),
      inRange,
    };
  });
}
