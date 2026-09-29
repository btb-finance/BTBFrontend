'use client';
import { ConvexHttpClient } from 'convex/browser';
import type { FunctionReturnType } from 'convex/server';
import { api } from '../../convex/_generated/api';

// Same fallback as Providers.tsx — keep in sync.
const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL ?? 'https://grateful-oyster-780.convex.cloud';

// The Discover snapshot read, split out of discoverPools.ts so the entry chunk
// can start it before the wallet stack and app shell have even downloaded.
// Without this the request only left once the shell had mounted, adding the
// whole JS download time in front of the pool list.
type SnapshotRow = FunctionReturnType<typeof api.discover.get> | null;

let early: Promise<SnapshotRow> | null = null;

function query(): Promise<SnapshotRow> {
  return new ConvexHttpClient(CONVEX_URL).query(api.discover.get, {});
}

/** Fire the snapshot read now; the first fetchDiscoverRow() call picks it up. */
export function startDiscoverSnapshot() {
  if (typeof window === 'undefined' || early) return;
  early = query().catch(() => null);
}

/**
 * The snapshot row: the early in-flight read when there is one (used once, so
 * the hourly refresh still asks Convex again), otherwise a fresh query.
 */
export function fetchDiscoverRow(): Promise<SnapshotRow> {
  const p = early;
  early = null;
  return p ?? query();
}
