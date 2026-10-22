'use client';
import { unpackSnapshotBrowser } from './snapshotCodec';
import { useSyncExternalStore } from 'react';
import type { PublicClient } from 'viem';
import { fetchDiscoverSource, fetchChainPools, queryConvex } from './discoverSnapshot';
import { getEarnPools, addRangeAprs, isConcentratedPool, EarnPool } from './pools';
import { fetchPoolPriceChanges } from './geckoterminal';

// ─── Discover pool data store ────────────────────────────────────────────────
// Lives at module level so the data survives the screen unmounting, and so the
// app shell can start loading it in the background before the user ever opens
// the Discover tab. The screen subscribes via useDiscoverPools().
//
// Sparkline history was dropped deliberately: it cost one rate-limited request
// per pool (no batch endpoint exists), rarely loaded fully, and ate a table
// column. The 24h % change (one batched call) covers the trend signal.

// The snapshot is rebuilt every 6 hours (convex/crons.ts). Re-checking hourly
// is one small read and means a tab opened just before a rebuild picks up the
// new list within the hour instead of up to 6 hours later.
const TTL = 60 * 60_000;

export type DiscoverData = {
  pools: EarnPool[];
  priceChange: Record<string, number>;
  loading: boolean;
  /** False while only the first screen (the busiest pools) is in and the full per-chain lists are still loading. */
  complete: boolean;
};

let state: DiscoverData = { pools: [], priceChange: {}, loading: false, complete: false };
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
    // fee/range-APR multicalls). A cron refreshes it every 6 hours, so age
    // is the cron's problem — the browser never recomputes just because the row
    // got old, it only falls back when there is no row at all.
    try {
      const source = await fetchDiscoverSource();
      if (source.kind === 'index') {
        // First screen at once: the busiest pools, packed in the index itself (about 40 KB instead of 792 KB).
        const top = await unpackSnapshotBrowser<{ version?: number; pools: EarnPool[]; priceChange?: Record<string, number> }>(source.index.top);
        if (top.pools?.length > 0) {
          ts = Date.now();
          if (state.pools.length === 0) set({ pools: top.pools.filter(isConcentratedPool), priceChange: top.priceChange ?? {}, loading: false });
          // Then every chain's full list in parallel; one chain failing keeps the others.
          let lists = await Promise.all(source.index.chains.map((c) => fetchChainPools<EarnPool>(c.url).catch(() => null)));
          // A CDN copy of the index can point at a chain file Convex has since replaced: ask Convex once and retry.
          if (lists.some((l) => l == null)) {
            const fresh = await queryConvex().catch(() => null);
            if (fresh?.kind === 'index') lists = await Promise.all(fresh.index.chains.map((c) => fetchChainPools<EarnPool>(c.url).catch(() => null)));
          }
          const full = lists.flatMap((l) => l ?? []);
          const failed = lists.some((l) => l == null);
          // A chain that failed keeps whatever the first screen had for it.
          const keep = failed ? top.pools.filter((p) => !full.some((f) => f.chain === p.chain && f.id === p.id)) : [];
          set({ pools: [...full, ...keep].filter(isConcentratedPool), complete: !failed, loading: false });
          return;
        }
      } else if (source.row) {
        const snap = await unpackSnapshotBrowser<{ version?: number; pools: EarnPool[]; priceChange?: Record<string, number> }>(source.row.json);
        if (snap.pools?.length > 0) {
          ts = Date.now();
          // Older snapshots may still carry full-range rows; drop them here too.
          set({ pools: snap.pools.filter(isConcentratedPool), priceChange: snap.priceChange ?? {}, loading: false, complete: true });
          return;
        }
      }
    } catch { /* snapshot unavailable — cold-start path below */ }

    // Cold start only: a deployment whose cron has never run has no row yet,
    // and an empty Discover tab is worse than one slow first load.
    const p = await getEarnPools(undefined, client);
    ts = Date.now();
    set({ pools: p, complete: true });
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
  if (state.complete && state.pools.length > 0) return Promise.resolve(state.pools);
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
      // The full list when it lands in time; on timeout, whatever is in (the first screen at least).
      if ((state.complete && state.pools.length > 0) || (!state.loading && !inflight)) finish();
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
