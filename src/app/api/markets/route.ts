import { buildRobinhoodMarketFeed } from '@/lib/robinhoodMarkets';

/** Compatibility endpoint. The Dashboard reads the Convex snapshot directly;
 * this route reuses the same builder for external callers. */
export async function GET() {
  try {
    const markets = await buildRobinhoodMarketFeed();
    return Response.json({ updatedAt: Date.now(), markets }, {
      headers: { 'cache-control': 'public, s-maxage=60, stale-while-revalidate=300' },
    });
  } catch {
    return Response.json({ error: 'market feed unavailable', markets: [] }, { status: 502 });
  }
}
