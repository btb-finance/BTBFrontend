'use client';
/**
 * Data layer for the simulator page — the same sources the CreatePosition
 * sheet uses (on-chain pool state, subgraph day history with a GeckoTerminal
 * fallback, DeFiLlama USD prices, tick liquidity), extracted so the page and
 * the sheet can't drift apart on where numbers come from.
 *
 * Everything degrades progressively: the pool read is the only hard
 * requirement; history, USD prices, and tick depth each fail independently
 * without blocking the page.
 */
import { useEffect, useState } from 'react';
import { useConfig } from 'wagmi';
import { getPublicClient } from 'wagmi/actions';
import {
  fetchPoolsForMint, fetchV4PoolForMint, getPoolHistory, hasGraphKey, V3_SUBGRAPH_ID,
  WETH, UNISWAP_V3_DEPLOYMENT, isNativeCurrency,
  type MintPool, type V4MintPool, type PoolDay,
} from '@/protocols/dexs/uniswap';
import { PANCAKE_V3_DEPLOYMENT, PANCAKE_V3_SUBGRAPH_ID } from '@/protocols/dexs/pancakeswap';
import { getTokenPricesUsd } from '../../lib/defillama';
import { fetchPoolDailyHistory } from '../../lib/geckoterminal';
import { fetchTickLiquidityDistribution, type TickLiquidityPoint } from '@/protocols/dexs/uniswap/v3/ticks';
import { fetchV4TickLiquidityDistribution } from '@/protocols/dexs/uniswap/v4/ticks';

function toV3Address(address: string): `0x${string}` {
  return (address.toLowerCase() === 'eth' ? WETH : address) as `0x${string}`;
}

export interface SimPools {
  pools: Record<number, MintPool> | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

/** All fee tiers for a V3 pair in one batch, or the single pool a V4 id pins. */
export function useSimPools(
  tokenA: string | undefined,
  tokenB: string | undefined,
  v4PoolId: `0x${string}` | undefined,
  dex: 'uniswap' | 'pancakeswap',
): SimPools {
  const config = useConfig();
  const [pools, setPools] = useState<Record<number, MintPool> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let live = true;
    setLoading(true); setPools(null); setError(null);
    const client = getPublicClient(config);
    if (!client) { setLoading(false); setError('No RPC client'); return; }
    const deployment = dex === 'pancakeswap' ? PANCAKE_V3_DEPLOYMENT : UNISWAP_V3_DEPLOYMENT;
    const run = v4PoolId
      ? fetchV4PoolForMint(client, v4PoolId).then((p) => ({ [p.fee]: p as MintPool }))
      : tokenA && tokenB
        ? fetchPoolsForMint(client, toV3Address(tokenA), toV3Address(tokenB), deployment)
        : Promise.reject(new Error('Missing token pair'));
    run
      .then((record) => { if (live) setPools(record); })
      .catch((e: Error) => { if (live) setError(e?.message ?? 'network error'); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, tokenA, tokenB, v4PoolId, dex, nonce]);

  return { pools, loading, error, retry: () => setNonce((n) => n + 1) };
}

export interface PoolExtras {
  /** Subgraph day history (real fees) — null when unavailable. */
  history: PoolDay[] | null;
  /** GeckoTerminal closes rescaled into pool price space — trend only, no fees. */
  fallbackCloses: number[] | null;
  tokenUsd: { p0: number; p1: number } | null;
  tickLiq: TickLiquidityPoint[] | null;
}

/** History + USD prices + tick liquidity for one resolved pool. */
export function usePoolExtras(
  pool: MintPool | null,
  isV4: boolean,
  v4PoolId: `0x${string}` | undefined,
  dex: 'uniswap' | 'pancakeswap',
  spacing: number,
): PoolExtras {
  const config = useConfig();
  const [history, setHistory] = useState<PoolDay[] | null>(null);
  const [fallbackCloses, setFallbackCloses] = useState<number[] | null>(null);
  const [usd, setUsd] = useState<Record<string, number>>({});
  const [tickLiq, setTickLiq] = useState<TickLiquidityPoint[] | null>(null);

  useEffect(() => {
    let live = true;
    setHistory(null); setFallbackCloses(null); setUsd({});
    if (!pool || !pool.exists) return;
    const price = ((Number(pool.sqrtPriceX96) / 2 ** 96) ** 2) * 10 ** (pool.decimals0 - pool.decimals1);

    if (hasGraphKey && !isV4) {
      getPoolHistory(dex === 'pancakeswap' ? PANCAKE_V3_SUBGRAPH_ID : V3_SUBGRAPH_ID, pool.address)
        .then((h) => { if (live && h.length > 1) setHistory(h); })
        .catch(() => {});
    } else {
      const chartId = isV4 ? v4PoolId : pool.address;
      if (chartId) {
        fetchPoolDailyHistory(chartId, 30)
          .then((bars) => {
            if (!live || bars.length < 2) return;
            const last = bars[bars.length - 1].close;
            const ratio = last > 0 && price > 0 ? price / last : 1;
            setFallbackCloses(bars.map((b) => b.close * ratio));
          })
          .catch(() => {});
      }
    }

    const priceToken0 = isNativeCurrency(pool.token0) ? WETH : pool.token0;
    getTokenPricesUsd([priceToken0, pool.token1])
      .then((p) => {
        if (!live) return;
        if (priceToken0 !== pool.token0 && p[WETH.toLowerCase()]) p[pool.token0.toLowerCase()] = p[WETH.toLowerCase()];
        setUsd(p);
      })
      .catch(() => {});
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool, isV4, dex]);

  useEffect(() => {
    let live = true;
    setTickLiq(null);
    if (!pool || !pool.exists) return;
    const client = getPublicClient(config);
    if (!client) return;
    const v4Pool = isV4 ? (pool as V4MintPool) : null;
    const fetcher = v4Pool
      ? fetchV4TickLiquidityDistribution(client, v4Pool.poolId, pool.tick, pool.liquidity, spacing)
      : fetchTickLiquidityDistribution(client, pool.address, pool.tick, pool.liquidity, spacing);
    fetcher.then((pts) => { if (live && pts.length > 0) setTickLiq(pts); }).catch(() => {});
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, pool, isV4, spacing]);

  // Derived USD pair with pool-price backfill for a missing side.
  const price = pool && pool.exists ? ((Number(pool.sqrtPriceX96) / 2 ** 96) ** 2) * 10 ** (pool.decimals0 - pool.decimals1) : 0;
  let p0 = pool ? usd[pool.token0.toLowerCase()] : undefined;
  let p1 = pool ? usd[pool.token1.toLowerCase()] : undefined;
  if (!p0 && p1 && price > 0) p0 = price * p1;
  if (!p1 && p0 && price > 0) p1 = p0 / price;
  const tokenUsd = p0 && p1 ? { p0, p1 } : null;

  return { history, fallbackCloses, tokenUsd, tickLiq };
}
