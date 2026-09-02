'use client';
/**
 * Client read side for the two shared Convex caches.
 *
 * `useSnapshot` reads a cron-refreshed global dataset (one row, identical for
 * everyone). `useCachedJson` reads the on-demand memo cache and asks Convex to
 * fill the key on a miss. Both are Convex live queries, so when a cron tick or
 * another visitor's fill lands, every open tab updates without polling.
 *
 * Write sides: `convex/globalRefresh.ts` and `convex/cacheFill.ts`.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAction, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { cacheKey, type CacheArgs } from './cacheKeys';

export type Cached<T> = { data: T | null; loading: boolean };

/** A cron-refreshed global snapshot, parsed. `null` before the first tick. */
export function useSnapshot<T>(key: string): Cached<T> {
  const row = useQuery(api.snapshots.get, { key });
  const data = useMemo(() => {
    if (!row) return null;
    try { return JSON.parse(row.json) as T; } catch { return null; }
  }, [row]);
  return { data, loading: row === undefined };
}

/**
 * Shared third-party data for one key, fetched server-side on first request.
 *
 * Pass `null` to skip (the pool or token isn't chosen yet). On a miss the fill
 * action runs once per key per mount; its result is used directly so the value
 * shows even in the moment before the live query catches up.
 */
export function useCachedJson<T>(args: CacheArgs | null): Cached<T> {
  const key = args ? cacheKey(args) : null;
  const row = useQuery(api.cache.get, key ? { key } : 'skip');
  const fill = useAction(api.cacheFill.fill);

  // Result of our own fill call, kept only for the key that produced it so a
  // changed pool never renders the previous pool's data.
  const [filled, setFilled] = useState<{ key: string; json: string | null } | null>(null);
  const requested = useRef(new Set<string>());

  useEffect(() => {
    if (!args || !key) return;
    if (row === undefined) return;            // query still resolving
    if (row !== null) return;                 // cache hit — nothing to do
    if (requested.current.has(key)) return;   // already asked for this key
    requested.current.add(key);
    let live = true;
    fill(args)
      .then((json) => { if (live) setFilled({ key, json }); })
      .catch(() => { if (live) setFilled({ key, json: null }); });
    return () => { live = false; };
    // `args` is rebuilt every render by callers; `key` is its stable identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, row === undefined, row === null]);

  const json = row?.json ?? (filled?.key === key ? filled.json : null);
  const data = useMemo(() => {
    if (!json) return null;
    try { return JSON.parse(json) as T; } catch { return null; }
  }, [json]);

  // Settled once we have a row, or once our own fill has come back either way.
  const settled = !key || row != null || filled?.key === key;
  return { data, loading: !settled };
}
