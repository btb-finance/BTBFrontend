'use client';
import { useEffect, useRef, useState } from 'react';
import { useConvex } from 'convex/react';
import type { FunctionReference, FunctionReturnType, OptionalRestArgs } from 'convex/server';

/**
 * A Convex query fetched once and re-fetched on a timer, instead of a live
 * subscription.
 *
 * Reactive `useQuery` re-runs the query on the server for every open client
 * each time any document it read changes. For the big cron-written tables
 * (token prices every five minutes, the token list, market and pool
 * snapshots) that meant every visitor re-read hundreds of kilobytes hundreds
 * of times a day, which is what the database bandwidth bill was. Those
 * datasets only change on a cron cadence, so polling at that cadence gives
 * the same freshness for a small fraction of the reads.
 *
 * Returns `undefined` until the first result, like useQuery.
 */
export function usePolledQuery<Q extends FunctionReference<'query'>>(
  query: Q,
  args: OptionalRestArgs<Q>[0] | 'skip',
  intervalMs: number,
): FunctionReturnType<Q> | undefined {
  const convex = useConvex();
  const [data, setData] = useState<FunctionReturnType<Q> | undefined>(undefined);
  const argsKey = args === 'skip' ? 'skip' : JSON.stringify(args ?? {});
  const argsRef = useRef(args);
  argsRef.current = args;

  useEffect(() => {
    if (args === 'skip') { setData(undefined); return; }
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      try {
        const result = await convex.query(query, (argsRef.current === 'skip' ? {} : argsRef.current ?? {}) as OptionalRestArgs<Q>[0]);
        if (live) setData(result);
      } catch { /* keep the last good value; the next tick retries */ }
      if (live) timer = setTimeout(tick, document.visibilityState === 'hidden' ? intervalMs * 3 : intervalMs);
    };
    void tick();
    return () => { live = false; if (timer) clearTimeout(timer); };
  // argsKey stands in for args so a new object with the same content does not restart the loop.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convex, query, argsKey, intervalMs]);

  return data;
}
