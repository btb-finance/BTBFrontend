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
  fetchKnownV3Pool, fetchPoolsForMint, fetchV4PoolForMint, getPoolHistory, hasGraphKey, V3_SUBGRAPH_ID,
  uniswapV3DeploymentForChain,
  UNISWAP_V4, ROBINHOOD_UNISWAP_V4, isNativeCurrency,
  type MintPool, type V4MintPool, type PoolDay,
} from '@/protocols/dexs/uniswap';
import { PANCAKE_V3_DEPLOYMENT, PANCAKE_V3_SUBGRAPH_ID } from '@/protocols/dexs/pancakeswap';
import { getTokenPricesUsd } from '../../lib/defillama';
import { fetchPoolDailyHistory, fetchPoolStats } from '../../lib/geckoterminal';
import { fetchTokenSafety, type TokenSafety } from '../../lib/tokenSafety';
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

/** History + USD prices + tick liquidity for one resolved pool. */
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
  const [history, setHistory] = useState<PoolDay[] | null>(null);
  const [estimatedHistory, setEstimatedHistory] = useState<PoolDay[] | null>(null);
  const [fallbackCloses, setFallbackCloses] = useState<number[] | null>(null);
  const [usd, setUsd] = useState<Record<string, number>>({});
  const [tickLiq, setTickLiq] = useState<TickLiquidityPoint[] | null>(null);
  const [poolCreatedAt, setPoolCreatedAt] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    setHistory(null); setEstimatedHistory(null); setFallbackCloses(null); setUsd({}); setPoolCreatedAt(null);
    if (!pool || !pool.exists) return;
    const price = ((Number(pool.sqrtPriceX96) / 2 ** 96) ** 2) * 10 ** (pool.decimals0 - pool.decimals1);

    if (chainId === 1 && hasGraphKey && !isV4) {
      getPoolHistory(dex === 'pancakeswap' ? PANCAKE_V3_SUBGRAPH_ID : V3_SUBGRAPH_ID, pool.address)
        .then((h) => { if (live && h.length > 1) setHistory(h); })
        .catch(() => {});
    } else {
      const chartId = isV4 ? v4PoolId : pool.address;
      if (chartId) {
        fetchPoolDailyHistory(chartId, 30, networks.gecko)
          .then((bars) => {
            if (!live || bars.length < 2) return;
            const last = bars[bars.length - 1].close;
            const ratio = last > 0 && price > 0 ? price / last : 1;
            setFallbackCloses(bars.map((b) => b.close * ratio));
            // Synthesize a daily fee history from traded volume × fee tier so
            // the replay and fee-steadiness stats work on chains with no
            // subgraph. Clearly labelled as estimated downstream.
            const feeFraction = feeTier > 0 ? feeTier / 1_000_000 : 0;
            if (feeFraction > 0) {
              const todayBucket = Math.floor(Date.now() / 1000 / 86400) * 86400;
              const days: PoolDay[] = bars
                .map((b) => ({
                  date: Math.floor(b.timestamp / 1000 / 86400) * 86400,
                  price0: b.close * ratio,
                  volumeUsd: b.volumeUsd,
                  feesUsd: b.volumeUsd * feeFraction,
                  tvlUsd: 0,
                  liquidity: Number(pool.liquidity),
                }))
                .filter((d) => d.date > 0 && d.date < todayBucket);
              if (days.length >= 5) setEstimatedHistory(days);
            }
          })
          .catch(() => {});
      }
    }

    // Pool age — one batched stats call; explorer reports creation time.
    fetchPoolStats([pool.address], networks.gecko)
      .then((stats) => { if (live) setPoolCreatedAt(stats[pool.address.toLowerCase()]?.createdAt ?? null); })
      .catch(() => {});

    const priceToken0 = isNativeCurrency(pool.token0) ? wrappedNative : pool.token0;
    getTokenPricesUsd([priceToken0, pool.token1], networks.llama)
      .then((p) => {
        if (!live) return;
        if (priceToken0 !== pool.token0 && p[wrappedNative.toLowerCase()]) p[pool.token0.toLowerCase()] = p[wrappedNative.toLowerCase()];
        setUsd(p);
      })
      .catch(() => {});
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool, isV4, dex, chainId, wrappedNative, networks.gecko, networks.llama, v4PoolId, feeTier]);

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
  const price = pool && pool.exists ? ((Number(pool.sqrtPriceX96) / 2 ** 96) ** 2) * 10 ** (pool.decimals0 - pool.decimals1) : 0;
  let p0 = pool ? usd[pool.token0.toLowerCase()] : undefined;
  let p1 = pool ? usd[pool.token1.toLowerCase()] : undefined;
  if (!p0 && p1 && price > 0) p0 = price * p1;
  if (!p1 && p0 && price > 0) p1 = p0 / price;
  const tokenUsd = p0 && p1 ? { p0, p1 } : null;

  return { history, estimatedHistory, fallbackCloses, tokenUsd, tickLiq, poolCreatedAt };
}

/**
 * Token safety for both sides of the pool — holder concentration, holder
 * count, spam/honeypot flags. Degrades to missing entries when a chain has
 * no explorer coverage; callers show nothing rather than a fake verdict.
 */
export function useTokenSafety(
  token0?: `0x${string}`,
  token1?: `0x${string}`,
  blockscoutBase?: string,
  chainId?: number,
): Record<string, TokenSafety> {
  const [map, setMap] = useState<Record<string, TokenSafety>>({});
  useEffect(() => {
    let live = true;
    setMap({});
    const addrs = [token0, token1].filter((x): x is `0x${string}` => !!x);
    if (addrs.length === 0 || !chainId) return;
    Promise.all(addrs.map(async (a) => [a.toLowerCase(), await fetchTokenSafety(a, chainId, blockscoutBase)] as const))
      .then((pairs) => { if (live) setMap(Object.fromEntries(pairs)); })
      .catch(() => {});
    return () => { live = false; };
  }, [token0, token1, blockscoutBase, chainId]);
  return map;
}
