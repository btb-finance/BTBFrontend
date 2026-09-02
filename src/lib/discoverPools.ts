'use client';
import { useSyncExternalStore } from 'react';
import type { PublicClient } from 'viem';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../convex/_generated/api';
import { getEarnPools, addRangeAprs, EarnPool } from './pools';
import { fetchPoolPriceChanges } from './geckoterminal';

// Same fallback as Providers.tsx — keep in sync.
const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL ?? 'https://grateful-oyster-780.convex.cloud';

// ─── Discover pool data store ────────────────────────────────────────────────
// Lives at module level so the data survives the screen unmounting, and so the
// app shell can start loading it in the background before the user ever opens
// the Discover tab. The screen subscribes via useDiscoverPools().
//
// Sparkline history was dropped deliberately: it cost one rate-limited request
// per pool (no batch endpoint exists), rarely loaded fully, and ate a table
// column. The 24h % change (one batched call) covers the trend signal.

// Matches the Convex cron cadence — re-reading the snapshot faster than it is
// written buys nothing. See convex/crons.ts.
const TTL = 30 * 60_000;

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
  (async () => {
    // The Convex snapshot is the source of truth: one query instead of the
    // whole multi-API pipeline (DeFiLlama + DexPaprika + DexScreener + on-chain
    // fee/range-APR multicalls). A cron refreshes it every 30 minutes, so age
    // is the cron's problem — the browser never recomputes just because the row
    // got old, it only falls back when there is no row at all.
    try {
      const convex = new ConvexHttpClient(CONVEX_URL);
      const row = await convex.query(api.discover.get, {});
      if (row) {
        const snap = JSON.parse(row.json) as { version?: number; pools: EarnPool[]; priceChange?: Record<string, number> };
        if (snap.pools?.length > 0) {
          ts = Date.now();
          set({ pools: snap.pools, priceChange: snap.priceChange ?? {}, loading: false });
          return;
        }
      }
    } catch { /* snapshot unavailable — cold-start path below */ }

    // Cold start only: a deployment whose cron has never run has no row yet,
    // and an empty Discover tab is worse than one slow first load.
    const p = await getEarnPools(undefined, client);
    ts = Date.now();
    set({ pools: p });
    if (client) addRangeAprs(client, p).then(ep => set({ pools: ep })).catch(() => {});
    const addressable = p.filter(x => x.source === 'uniswap');
    if (addressable.length > 0) {
      fetchPoolPriceChanges(addressable.map(x => x.id)).then(m => set({ priceChange: m })).catch(() => {});
    }
  })()
    .catch(() => {})
    .finally(() => { inflight = false; set({ loading: false }); });
}

/**
 * Resolve the already-shared hourly pool catalog for consumers that start
 * before Convex's first response arrives (for example a deep-linked Simulate
 * search). This subscribes to the same module store; it does not start a
 * second request while prefetch is already in flight.
 */
export function waitForDiscoverPools(timeoutMs = 3_000): Promise<EarnPool[]> {
  if (state.pools.length > 0) return Promise.resolve(state.pools);
  prefetchDiscoverPools();
  return new Promise(resolve => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      listeners.delete(onChange);
      clearTimeout(timer);
      resolve(state.pools);
    };
    const onChange = () => {
      if (state.pools.length > 0 || (!state.loading && !inflight)) finish();
    };
    const timer = setTimeout(finish, timeoutMs);
    listeners.add(onChange);
    onChange();
  });
}

const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
const getSnapshot = () => state;

export function useDiscoverPools(): DiscoverData {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
