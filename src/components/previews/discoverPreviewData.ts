import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../convex/_generated/api';
import { unpackSnapshotNode } from '../../lib/snapshotCodec';
import { isConcentratedPool, type EarnPool } from '../../lib/pools';

// Same fallback as Providers.tsx — keep in sync.
const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL ?? 'https://grateful-oyster-780.convex.cloud';

export type DiscoverPreviewData = { pools: EarnPool[]; priceChange: Record<string, number>; complete: false };

/**
 * Server only: the busiest pools from the same index the browser reads first (convex/discover.ts `index.top`), for the
 * Discover preview. Null on any failure or after 3 seconds: the page then renders without the list, never fails.
 */
export async function getDiscoverPreviewData(): Promise<DiscoverPreviewData | null> {
  try {
    const index = await Promise.race([
      new ConvexHttpClient(CONVEX_URL).query(api.discover.index, {}),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 3_000)),
    ]);
    if (!index) return null;
    const top = await unpackSnapshotNode<{ pools: EarnPool[]; priceChange?: Record<string, number> }>(index.top);
    const pools = (top.pools ?? []).filter(isConcentratedPool);
    return pools.length ? { pools, priceChange: top.priceChange ?? {}, complete: false } : null;
  } catch {
    return null;
  }
}
