'use client';

import { useQuery } from '@tanstack/react-query';
import type { MarketToken } from './robinhoodMarkets';

/**
 * Live launch feed, read straight off the Uniswap V3 factory rather than from
 * DexScreener or GeckoTerminal — both only list a pool once it clears their
 * liquidity thresholds, which is minutes too late to ape and sometimes never.
 * Rows come back shaped as MarketToken so the existing market table, buy/sell
 * buttons and trade presets work on them unchanged.
 */

const WETH = '0x0bd7d308f8e1639fab988df18a8011f41eacad73';

export type PoolSafety = {
  token: string;
  status: 'sellable' | 'honeypot' | 'no-liquidity' | 'unknown';
  taxBps: number | null;
  roundTripBps: number | null;
};

export type NewPool = {
  pool: string;
  token: string;
  symbol: string;
  name: string;
  decimals: number;
  fee: number;
  block: number;
  createdAt: string | null;
  ageSeconds: number | null;
  priceUsd: number;
  priceWeth: number;
  liquidityUsd: number;
  wethLiquidity: number;
  transactionHash: string | null;
  tokenIsToken0: boolean;
  resolved: boolean;
  launchpad: boolean;
  deployer: string | null;
  lpLocked: boolean | null;
  lpOwner: string | null;
  devBuyWeth: number;
  devBuyUsd: number;
  restrictionsEndBlock: number | null;
};

export function newPoolToMarket(pool: NewPool): MarketToken {
  const createdAt = pool.createdAt ? Date.parse(pool.createdAt) : NaN;
  return {
    address: pool.token,
    symbol: pool.symbol,
    name: pool.name,
    quoteSymbol: 'WETH',
    quoteAddress: WETH,
    pairAddress: pool.pool,
    dex: 'uniswap',
    version: `v3 ${(pool.fee / 10_000).toFixed(2)}%`,
    priceUsd: pool.priceUsd,
    // A pool seconds old has no history to change against, and no vendor has
    // counted its trades yet — showing "—" beats inventing a zero.
    change5m: null,
    change1h: null,
    change24h: null,
    volume24h: 0,
    liquidityUsd: pool.liquidityUsd,
    buys24h: 0,
    sells24h: 0,
    marketCap: 0,
    pairCreatedAt: Number.isFinite(createdAt) ? createdAt : null,
    imageUrl: '',
    boosts: 0,
    url: `https://robinhoodchain.blockscout.com/token/${pool.token}`,
    trendingScore: 0,
  };
}

/**
 * One row per token, newest first. A launch often creates several pools for the
 * same token across fee tiers; the one holding the most WETH is the one worth
 * routing a buy through, and the others would only collide as duplicate rows.
 */
export function newPoolsToMarkets(pools: NewPool[]): MarketToken[] {
  const best = new Map<string, NewPool>();
  for (const pool of pools) {
    const key = pool.token.toLowerCase();
    const current = best.get(key);
    if (!current || pool.wethLiquidity > current.wethLiquidity) best.set(key, pool);
  }
  return [...best.values()].sort((a, b) => b.block - a.block).map(newPoolToMarket);
}

async function fetchNewPools(signal?: AbortSignal): Promise<NewPool[]> {
  const response = await fetch('/api/new-pools?limit=50', { signal, cache: 'no-store' });
  if (!response.ok) throw new Error('Launch feed is unavailable');
  const body = await response.json() as { pools?: NewPool[] };
  return Array.isArray(body.pools) ? body.pools : [];
}

/**
 * Round-trip sell simulation for the rows on screen. Kept separate from the
 * feed and deliberately narrow: a quote is far heavier than a balance read and
 * the shared RPC key rate limits, so only the handful of rows a user can act on
 * get checked, and only every 15 seconds.
 */
export function usePoolSafety(pools: NewPool[]) {
  const probes = pools.filter(pool => pool.wethLiquidity > 0).slice(0, 12);
  const key = probes.map(pool => `${pool.token}:${pool.fee}`).join(',');
  const query = useQuery<PoolSafety[]>({
    queryKey: ['pool-safety', key],
    queryFn: async ({ signal }) => {
      const response = await fetch(`/api/pool-safety?pools=${key}`, { signal, cache: 'no-store' });
      if (!response.ok) throw new Error('Safety check unavailable');
      const body = await response.json() as { safety?: PoolSafety[] };
      return Array.isArray(body.safety) ? body.safety : [];
    },
    enabled: key.length > 0,
    refetchInterval: 15_000,
    staleTime: 10_000,
    gcTime: 60_000,
    refetchOnWindowFocus: false,
    placeholderData: previous => previous,
  });
  const byToken = new Map((query.data ?? []).map(entry => [entry.token.toLowerCase(), entry]));
  return { byToken, checking: query.isFetching };
}

/** Polls only while the caller is showing the feed — this chain mints roughly
 *  one pool a second, so an idle tab has no reason to keep pulling. */
export function useNewPools(active: boolean) {
  const query = useQuery<NewPool[]>({
    queryKey: ['new-pools'],
    queryFn: ({ signal }) => fetchNewPools(signal),
    enabled: active,
    refetchInterval: active ? 5_000 : false,
    staleTime: 3_000,
    gcTime: 60_000,
    refetchOnWindowFocus: false,
    placeholderData: previous => previous,
  });
  return {
    pools: query.data ?? [],
    loading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    updatedAt: query.dataUpdatedAt || null,
  };
}
