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
 *
 * The third-party lookups (subgraph history, GeckoTerminal OHLCV and stats,
 * DeFiLlama prices, token safety) run on Convex and are cached there per key
 * — see src/lib/cacheKeys.ts for the TTLs. Only the on-chain reads (pool
 * state, tick depth) still leave the browser.
 */
import { useEffect, useMemo, useState } from 'react';
import { useConfig } from 'wagmi';
import { getPublicClient } from 'wagmi/actions';
import {
  fetchKnownV3Pool, fetchPoolsForMint, fetchV4PoolForMint, hasGraphKey, V3_SUBGRAPH_ID,
  uniswapV3DeploymentForChain,
  UNISWAP_V4, ROBINHOOD_UNISWAP_V4, isNativeCurrency,
  type MintPool, type V4MintPool, type PoolDay,
} from '@/protocols/dexs/uniswap';
import { PANCAKE_V3_DEPLOYMENT, PANCAKE_V3_SUBGRAPH_ID } from '@/protocols/dexs/pancakeswap';
import type { DailyBar } from '../../lib/geckoterminal';
import type { TokenSafety } from '../../lib/tokenSafety';
import { useCachedJson } from '../../lib/convexCache';
import { fetchTickLiquidityDistribution, type TickLiquidityPoint } from '@/protocols/dexs/uniswap/v3/ticks';
import { fetchV4TickLiquidityDistribution } from '@/protocols/dexs/uniswap/v4/ticks';
import type { SupportedChainId } from '../../lib/wagmi';
import type { ChainDataNetwork } from '../../lib/chainDataNetworks';

function toV3Address(address: string, wrappedNative: `0x${string}`): `0x${string}` {
  return (address.toLowerCase() === 'eth' ? wrappedNative : address) as `0x${string}`;
}

async function retryRead<T>(read: () => Promise<T>): Promise<T> {
  try {
    return await read();
  } catch {
    return read();
  }
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
  chainId: number,
  wrappedNative: `0x${string}`,
  selectedPoolAddress?: `0x${string}`,
  selectedFee?: number,
): SimPools {
  const config = useConfig();
  const [pools, setPools] = useState<Record<number, MintPool> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let live = true;
    setLoading(true); setPools(null); setError(null);
    const client = getPublicClient(config, { chainId: chainId as SupportedChainId });
    if (!client) { setLoading(false); setError('No RPC client'); return; }
    const deployment = dex === 'pancakeswap'
      ? PANCAKE_V3_DEPLOYMENT
      : uniswapV3DeploymentForChain(chainId);
    const v4Deployment = chainId === 4663 ? ROBINHOOD_UNISWAP_V4 : UNISWAP_V4;
    const token0 = tokenA ? toV3Address(tokenA, wrappedNative) : undefined;
    const token1 = tokenB ? toV3Address(tokenB, wrappedNative) : undefined;
    const run = v4PoolId
      ? fetchV4PoolForMint(client, v4PoolId, v4Deployment).then((p) => ({ [p.fee]: p as MintPool }))
      : token0 && token1 && deployment
        ? selectedPoolAddress && selectedFee != null
          ? retryRead(() => fetchKnownV3Pool(client, selectedPoolAddress, token0, token1, selectedFee))
              .then(selected => ({ [selected.fee]: selected }))
          : fetchPoolsForMint(client, token0, token1, deployment)
        : Promise.reject(new Error(deployment ? 'Missing token pair' : 'Uniswap V3 is not deployed on this chain'));
    run
      .then((record) => { if (live) setPools(record); })
      .catch((e: Error) => { if (live) setError(e?.message ?? 'network error'); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, tokenA, tokenB, v4PoolId, dex, chainId, wrappedNative, selectedPoolAddress, selectedFee, nonce]);

  return { pools, loading, error, retry: () => setNonce((n) => n + 1) };
}

export interface PoolExtras {
  /** Subgraph day history (real fees) — null when unavailable. */
  history: PoolDay[] | null;
  /** Daily days synthesized from OHLCV volume × fee tier when the indexed
   * history above is missing (new chains) — flagged, not presented as real. */
  estimatedHistory: PoolDay[] | null;
  /** GeckoTerminal closes rescaled into pool price space — trend only, no fees. */
  fallbackCloses: number[] | null;
  tokenUsd: { p0: number; p1: number } | null;
  tickLiq: TickLiquidityPoint[] | null;
  /** Pool creation timestamp (ms), from the explorer — null when unknown. */
  poolCreatedAt: number | null;
}

/**
 * History + USD prices + tick liquidity for one resolved pool.
 *
 * Everything except tick depth now reads through the Convex memo cache: the
 * subgraph/GeckoTerminal/DeFiLlama answers for a given pool are identical for
 * every visitor, so the first person to open a pool pays the round trip
 * server-side and everyone after reads the stored row (see
 * `convex/cacheFill.ts`). Tick liquidity stays a direct RPC read — it is
 * pool state that moves with every swap.
 *
 * Degradation is unchanged: the pool read is the only hard requirement, and
 * history, USD prices, and tick depth each fail independently.
 */
export function usePoolExtras(
  pool: MintPool | null,
  isV4: boolean,
  v4PoolId: `0x${string}` | undefined,
  dex: 'uniswap' | 'pancakeswap',
  spacing: number,
  chainId: number,
  wrappedNative: `0x${string}`,
  networks: ChainDataNetwork,
  feeTier: number,
): PoolExtras {
  const config = useConfig();
  const [tickLiq, setTickLiq] = useState<TickLiquidityPoint[] | null>(null);

  const resolved = !!pool && pool.exists;
  const price = resolved && pool
    ? ((Number(pool.sqrtPriceX96) / 2 ** 96) ** 2) * 10 ** (pool.decimals0 - pool.decimals1)
    : 0;

  // Real indexed fee history — mainnet V3 with a Graph key. Everywhere else
  // falls through to the OHLCV path below.
  const useGraph = resolved && chainId === 1 && hasGraphKey && !isV4;
  const historyQ = useCachedJson<PoolDay[]>(useGraph && pool ? {
    kind: 'pool-history',
    id: pool.address,
    days: 30,
    subgraphId: dex === 'pancakeswap' ? PANCAKE_V3_SUBGRAPH_ID : V3_SUBGRAPH_ID,
  } : null);

  const history = historyQ.data && historyQ.data.length > 1 ? historyQ.data : null;

  // The subgraph runs on Convex now, so its Graph key has to exist there too.
  // If it doesn't — or the pool simply isn't indexed — fall through to the
  // OHLCV path rather than showing no history at all. `hasGraphKey` only tells
  // us about the browser's env, which is why this checks the actual result.
  const graphEmpty = useGraph && !historyQ.loading && !history;
  const chartId = isV4 ? v4PoolId : pool?.address;
  const dailyQ = useCachedJson<DailyBar[]>(resolved && chartId && (!useGraph || graphEmpty) ? {
    kind: 'pool-daily', id: chartId, days: 30, network: networks.gecko,
  } : null);

  // Pool age — the explorer reports creation time; immutable once known.
  const statsQ = useCachedJson<Record<string, { createdAt?: number }>>(resolved && pool ? {
    kind: 'pool-stats', id: pool.address, network: networks.gecko,
  } : null);

  const priceToken0 = pool ? (isNativeCurrency(pool.token0) ? wrappedNative : pool.token0) : undefined;
  const pricesQ = useCachedJson<Record<string, number>>(resolved && pool && priceToken0 ? {
    kind: 'token-prices', id: `${priceToken0},${pool.token1}`, network: networks.llama,
  } : null);

  // GeckoTerminal closes rescaled into pool price space, plus a daily fee
  // series synthesized from traded volume × fee tier so the replay and
  // fee-steadiness stats work on chains with no subgraph. Clearly labelled as
  // estimated downstream — never presented as real fees.
  const { fallbackCloses, estimatedHistory } = useMemo(() => {
    const bars = dailyQ.data;
    if (!pool || !bars || bars.length < 2) return { fallbackCloses: null, estimatedHistory: null };
    const last = bars[bars.length - 1].close;
    const ratio = last > 0 && price > 0 ? price / last : 1;
    const closes = bars.map((b) => b.close * ratio);

    const feeFraction = feeTier > 0 ? feeTier / 1_000_000 : 0;
    if (feeFraction <= 0) return { fallbackCloses: closes, estimatedHistory: null };

    const todayBucket = Math.floor(Date.now() / 1000 / 86400) * 86400;
    const days: PoolDay[] = bars
      .map((b) => ({
        // ohlcv_list timestamps are unix seconds — bucket to UTC days
        date: Math.floor(b.timestamp / 86400) * 86400,
        price0: b.close * ratio,
        volumeUsd: b.volumeUsd,
        feesUsd: b.volumeUsd * feeFraction,
        tvlUsd: 0,
        liquidity: Number(pool.liquidity),
      }))
      .filter((d) => d.date > 0 && d.date < todayBucket);

    return { fallbackCloses: closes, estimatedHistory: days.length >= 5 ? days : null };
  }, [dailyQ.data, pool, price, feeTier]);

  const poolCreatedAt = pool ? statsQ.data?.[pool.address.toLowerCase()]?.createdAt ?? null : null;

  useEffect(() => {
    let live = true;
    setTickLiq(null);
    if (!pool || !pool.exists) return;
    const client = getPublicClient(config, { chainId: chainId as SupportedChainId });
    if (!client) return;
    const v4Pool = isV4 ? (pool as V4MintPool) : null;
    const fetcher = v4Pool
      ? fetchV4TickLiquidityDistribution(
          client,
          v4Pool.poolId,
          pool.tick,
          pool.liquidity,
          spacing,
          chainId === 4663 ? ROBINHOOD_UNISWAP_V4.stateView : UNISWAP_V4.stateView,
        )
      : fetchTickLiquidityDistribution(client, pool.address, pool.tick, pool.liquidity, spacing);
    fetcher.then((pts) => { if (live && pts.length > 0) setTickLiq(pts); }).catch(() => {});
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, pool, isV4, spacing, chainId]);

  // Derived USD pair with pool-price backfill for a missing side.
  const tokenUsd = useMemo(() => {
    if (!pool || !pricesQ.data) return null;
    const usd = { ...pricesQ.data };
    // The native side is priced as its wrapped token; mirror it back.
    if (priceToken0 && priceToken0 !== pool.token0 && usd[wrappedNative.toLowerCase()]) {
      usd[pool.token0.toLowerCase()] = usd[wrappedNative.toLowerCase()];
    }
    let p0 = usd[pool.token0.toLowerCase()];
    let p1 = usd[pool.token1.toLowerCase()];
    if (!p0 && p1 && price > 0) p0 = price * p1;
    if (!p1 && p0 && price > 0) p1 = p0 / price;
    return p0 && p1 ? { p0, p1 } : null;
  }, [pricesQ.data, pool, priceToken0, wrappedNative, price]);

  return { history, estimatedHistory, fallbackCloses, tokenUsd, tickLiq, poolCreatedAt };
}

/**
 * Token safety for both sides of the pool — holder concentration, holder
 * count, spam/honeypot flags. Served from the shared Convex cache, so one
 * explorer lookup per token covers every visitor for the TTL. Degrades to
 * missing entries when a chain has no explorer coverage; callers show nothing
 * rather than a fake verdict.
 */
export function useTokenSafety(
  token0?: `0x${string}`,
  token1?: `0x${string}`,
  blockscoutBase?: string,
  chainId?: number,
): Record<string, TokenSafety> {
  const q0 = useCachedJson<TokenSafety>(token0 && chainId
    ? { kind: 'token-safety', id: token0, chainId, explorerBase: blockscoutBase } : null);
  const q1 = useCachedJson<TokenSafety>(token1 && chainId
    ? { kind: 'token-safety', id: token1, chainId, explorerBase: blockscoutBase } : null);

  return useMemo(() => {
    const map: Record<string, TokenSafety> = {};
    if (token0 && q0.data) map[token0.toLowerCase()] = q0.data;
    if (token1 && q1.data) map[token1.toLowerCase()] = q1.data;
    return map;
  }, [token0, token1, q0.data, q1.data]);
}
