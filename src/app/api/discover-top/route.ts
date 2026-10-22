export const maxDuration = 15;
export const dynamic = 'force-dynamic';

import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../../convex/_generated/api';

// Same fallback as Providers.tsx — keep in sync.
const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL ?? 'https://grateful-oyster-780.convex.cloud';

/**
 * Discover's first screen (the busiest pools) and the per-chain file URLs, from Netlify's CDN. The same data as
 * Convex's `discover.index` query, which refreshes hourly; served from an edge near the visitor it skips the round
 * trip to Convex (about a second) for almost every page load. The CDN keeps a copy for 5 minutes and serves a stale
 * one for up to 30 more while it refetches in the background. Convex keeps replaced chain files for 2 hours, so a
 * cached index never points at a deleted file. On any failure the page asks Convex directly.
 */
export async function GET() {
  try {
    const index = await new ConvexHttpClient(CONVEX_URL).query(api.discover.index, {});
    if (!index) return Response.json({ error: 'No snapshot yet' }, { status: 404, headers: { 'cache-control': 'no-store' } });
    return Response.json(index, {
      headers: {
        // Browsers re-ask after a minute; Netlify's edges hold it longer and refresh in the background.
        'cache-control': 'public, max-age=60',
        'netlify-cdn-cache-control': 'public, s-maxage=300, stale-while-revalidate=1800, durable',
      },
    });
  } catch {
    return Response.json({ error: 'Snapshot unavailable' }, { status: 502, headers: { 'cache-control': 'no-store' } });
  }
}
