'use client';
import { useSyncExternalStore } from 'react';
import type { PublicClient } from 'viem';
import { getEarnPools, addRangeAprs, EarnPool } from './pools';
import { fetchPoolPriceChanges, fetchPoolSparkline } from './geckoterminal';
import { fetchPoolChart } from './defillama';

// ─── Discover pool data store ────────────────────────────────────────────────
// Lives at module level so the data survives the screen unmounting, and so the
// app shell can start loading it in the background before the user ever opens
// the Discover tab. The screen subscribes via useDiscoverPools().

// Sparkline curves cost one request per pool (neither GeckoTerminal nor
// DeFiLlama has a batch history endpoint) — cap how many rows fetch one so
// warming up Discover never fires dozens of requests at once.
const SPARKLINE_ROW_LIMIT = 12;
const TTL = 5 * 60_000;

export type DiscoverData = {
  pools: EarnPool[];
  priceChange: Record<string, number>;
  sparklines: Record<string, number[]>;
  loading: boolean;
};

let state: DiscoverData = { pools: [], priceChange: {}, sparklines: {}, loading: false };
let ts = 0;
let inflight = false;
const listeners = new Set<() => void>();

function set(patch: Partial<DiscoverData>) {
  state = {
    ...state,
    ...patch,
    // maps accumulate as per-pool responses trickle in
    priceChange: patch.priceChange ? { ...state.priceChange, ...patch.priceChange } : state.priceChange,
    sparklines: patch.sparklines ? { ...state.sparklines, ...patch.sparklines } : state.sparklines,
  };
  listeners.forEach(l => l());
}

/**
 * Load (or refresh) the Discover pool list. Safe to call repeatedly — it
 * no-ops while a fetch is in flight or while the data is fresher than the TTL,
 * so both the app-shell warmup and the screen itself can call it blindly.
 */
export function prefetchDiscoverPools(client?: PublicClient) {
  if (inflight || (ts && Date.now() - ts < TTL)) return;
  inflight = true;
  // Spinner only for a truly cold load; a stale refresh keeps old rows visible.
  if (state.pools.length === 0) set({ loading: true });
  getEarnPools(undefined, client)
    .then(p => {
      ts = Date.now();
      set({ pools: p });
      if (client) addRangeAprs(client, p).then(ep => set({ pools: ep })).catch(() => {});

      // 24h % and volume/fees come bundled with the pool list itself
      // (DeFiLlama's `apyPct1D`/`volumeUsd1d`, or the indexer's own 24h
      // figures). The sparkline curve still needs one request per pool, so
      // it's capped to the top rows by TVL.
      const byTvl = [...p].sort((a, b) => b.tvlUsd - a.tvlUsd);
      const addressable = byTvl.filter(x => x.source === 'uniswap');
      const llamaSourced = byTvl.filter(x => x.source === 'defillama');

      if (addressable.length > 0) {
        fetchPoolPriceChanges(addressable.map(x => x.id)).then(m => set({ priceChange: m })).catch(() => {});
        addressable.slice(0, SPARKLINE_ROW_LIMIT).forEach(pool => {
          fetchPoolSparkline(pool.id).then(s => { if (s.length > 1) set({ sparklines: { [pool.id]: s } }); }).catch(() => {});
        });
      }
      llamaSourced.slice(0, SPARKLINE_ROW_LIMIT).forEach(pool => {
        fetchPoolChart(pool.id).then(chart => {
          if (chart.length > 1) set({ sparklines: { [pool.id]: chart.slice(-14).map(c => c.tvlUsd) } });
        }).catch(() => {});
      });
    })
    .catch(() => {})
    .finally(() => { inflight = false; set({ loading: false }); });
}

const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
const getSnapshot = () => state;

export function useDiscoverPools(): DiscoverData {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
