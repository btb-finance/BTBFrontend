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
//
// Since 2026-10-22 the snapshot is split (convex/discoverStore.ts): this small
// index carries the first screen (the busiest pools) and a URL per chain for
// the full lists. The old single row is only the fallback.

export type DiscoverIndex = NonNullable<FunctionReturnType<typeof api.discover.index>>;
type LegacyRow = FunctionReturnType<typeof api.discover.get> | null;
export type DiscoverSource = { kind: 'index'; index: DiscoverIndex } | { kind: 'legacy'; row: LegacyRow };

let early: Promise<DiscoverSource> | null = null;

/** The index from our own CDN (src/app/api/discover-top), the fast path; null on any failure. */
async function fromCdn(): Promise<DiscoverIndex | null> {
  try {
    const res = await fetch('/api/discover-top', { signal: AbortSignal.timeout(4_000) });
    if (!res.ok) return null;
    const index = await res.json() as DiscoverIndex;
    return index?.top && Array.isArray(index.chains) ? index : null;
  } catch {
    return null;
  }
}

/** The index straight from Convex (the CDN copy's source), or the old single row when there is no index. */
export async function queryConvex(): Promise<DiscoverSource> {
  const client = new ConvexHttpClient(CONVEX_URL);
  const index = await client.query(api.discover.index, {}).catch(() => null);
  if (index) return { kind: 'index', index };
  return { kind: 'legacy', row: await client.query(api.discover.get, {}).catch(() => null) };
}

async function query(): Promise<DiscoverSource> {
  const index = await fromCdn();
  return index ? { kind: 'index', index } : queryConvex();
}

/** Fire the snapshot read now; the first fetchDiscoverSource() call picks it up. */
export function startDiscoverSnapshot() {
  if (typeof window === 'undefined' || early) return;
  early = query();
}

/**
 * The index (or the old row): the early in-flight read when there is one (used once, so the hourly refresh still asks
 * Convex again), otherwise a fresh query.
 */
export function fetchDiscoverSource(): Promise<DiscoverSource> {
  const p = early;
  early = null;
  return p ?? query();
}

/** One chain's full pool list: a gzip file in Convex storage. */
export async function fetchChainPools<T>(url: string): Promise<T[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`chain file ${res.status}`);
  const body = res.body;
  if (!body) throw new Error('empty chain file');
  const text = await new Response(body.pipeThrough(new DecompressionStream('gzip'))).text();
  return (JSON.parse(text) as { pools: T[] }).pools;
}
