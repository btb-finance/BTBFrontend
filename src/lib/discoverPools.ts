'use client';
import { useSyncExternalStore } from 'react';
import type { PublicClient } from 'viem';
import { getEarnPools, addRangeAprs, EarnPool } from './pools';
import { fetchPoolPriceChanges } from './geckoterminal';

// ─── Discover pool data store ────────────────────────────────────────────────
// Lives at module level so the data survives the screen unmounting, and so the
// app shell can start loading it in the background before the user ever opens
// the Discover tab. The screen subscribes via useDiscoverPools().
//
// Sparkline history was dropped deliberately: it cost one rate-limited request
// per pool (no batch endpoint exists), rarely loaded fully, and ate a table
// column. The 24h % change (one batched call) covers the trend signal.

const TTL = 5 * 60_000;

export type DiscoverData = {
  pools: EarnPool[];
  priceChange: Record<string, number>;
  loading: boolean;
};

let state: DiscoverData = { pools: [], priceChange: {}, loading: false };
let ts = 0;
let inflight = false;
const listeners = new Set<() => void>();

function set(patch: Partial<DiscoverData>) {
  state = {
    ...state,
    ...patch,
    // map accumulates as responses trickle in
    priceChange: patch.priceChange ? { ...state.priceChange, ...patch.priceChange } : state.priceChange,
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
      // figures); indexer-sourced rows get their 24h price change from one
      // batched GeckoTerminal call.
      const addressable = p.filter(x => x.source === 'uniswap');
      if (addressable.length > 0) {
        fetchPoolPriceChanges(addressable.map(x => x.id)).then(m => set({ priceChange: m })).catch(() => {});
      }
    })
    .catch(() => {})
    .finally(() => { inflight = false; set({ loading: false }); });
}

const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
const getSnapshot = () => state;

export function useDiscoverPools(): DiscoverData {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
