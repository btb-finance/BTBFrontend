import { ConvexHttpClient } from 'convex/browser';
import { NextResponse } from 'next/server';
import { probePoolsOnChain, type MarketPool } from '@/lib/dexSearch';
import { getChainClient } from '@/lib/chainClient';
import { api } from '../../../../../convex/_generated/api';

export const maxDuration = 25;
export const dynamic = 'force-dynamic';

/**
 * Shared server-side enrichment for pool searches.
 *
 * POST { chainId, llamaNetwork?, pools: [...] } → enriched MarketPool[].
 *
 * The server reads the pool facts from the chain itself and stores them in
 * the Convex poolFacts cache — clients are read-only consumers, so one bad
 * actor cannot poison what other users see (see the trust note in
 * convex/poolFacts.ts). Requires POOL_FACTS_SECRET to be set both here and
 * in the Convex deployment for caching to activate.
 */

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL ?? 'https://grateful-oyster-780.convex.cloud';
const MAX_POOLS = 80;

type IncomingPool = {
  address?: unknown;
  dexId?: unknown;
  tvlUsd?: unknown;
  volume24hUsd?: unknown;
  feePct?: unknown;
  ammClass?: unknown;
  aprIsRange?: unknown;
  aprPct?: unknown;
};

function sanitizePool(raw: IncomingPool): MarketPool | null {
  if (typeof raw.address !== 'string' || !/^0x[0-9a-f]{40}$/i.test(raw.address)) return null;
  const num = (v: unknown, fallback: number) => (typeof v === 'number' && isFinite(v) ? v : fallback);
  const feePct = typeof raw.feePct === 'number' && isFinite(raw.feePct) && raw.feePct >= 0 ? raw.feePct : null;
  const ammClass = raw.ammClass === 'v3' || raw.ammClass === 'v2' || raw.ammClass === 'algebra' ? raw.ammClass : 'unknown';
  return {
    address: raw.address.toLowerCase(),
    dexId: typeof raw.dexId === 'string' ? raw.dexId.slice(0, 80) : 'unknown',
    dexLabel: 'DEX',
    name: '',
    feePct,
    tvlUsd: num(raw.tvlUsd, 0),
    volume24hUsd: num(raw.volume24hUsd, 0),
    aprPct: typeof raw.aprPct === 'number' && isFinite(raw.aprPct) ? raw.aprPct : null,
    aprIsRange: raw.aprIsRange === true,
    ammClass,
    url: '',
  };
}

export async function POST(request: Request) {
  let body: { chainId?: unknown; llamaNetwork?: unknown; pools?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  const chainId = typeof body.chainId === 'number' ? Math.round(body.chainId) : 0;
  const client = getChainClient(chainId);
  if (!client) {
    return NextResponse.json({ error: 'unsupported chain' }, { status: 400 });
  }
  if (!Array.isArray(body.pools) || body.pools.length === 0 || body.pools.length > MAX_POOLS) {
    return NextResponse.json({ pools: [] });
  }
  const pools = body.pools
    .map(p => sanitizePool(p as IncomingPool))
    .filter((p): p is MarketPool => p !== null);
  const llamaNetwork = typeof body.llamaNetwork === 'string' ? body.llamaNetwork : undefined;

  // 1) Serve whatever the shared Convex cache already knows (fresh rows only).
  const convex = new ConvexHttpClient(CONVEX_URL);
  let merged = pools;
  try {
    const cached = await convex.query(api.poolFacts.get, {
      chainId,
      addresses: pools.map(p => p.address),
    });
    const byAddress = new Map(cached.map(f => [f.address, f]));
    merged = pools.map(pool => {
      const hit = byAddress.get(pool.address);
      if (!hit) return pool;
      const patched = { ...pool };
      if (patched.feePct == null && hit.feePct != null) patched.feePct = hit.feePct;
      if (patched.ammClass === 'unknown' && hit.ammClass !== 'unknown') patched.ammClass = hit.ammClass as MarketPool['ammClass'];
      if (hit.rangeApr != null) { patched.aprPct = hit.rangeApr; patched.aprIsRange = true; }
      return patched;
    });
  } catch {
    // Cache read failed (table not pushed yet, Convex hiccup) — probe live.
  }

  // 2) Probe what's still missing, straight from the server's own connection.
  let enriched: MarketPool[];
  try {
    enriched = await probePoolsOnChain(client, merged, llamaNetwork);
  } catch {
    return NextResponse.json({ pools: merged });
  }

  // 3) Share the facts back into the cache (server-only write).
  const facts = enriched
    .filter(p => p.ammClass !== 'unknown' || p.feePct != null)
    .map(p => ({
      address: p.address,
      feePct: p.feePct ?? undefined,
      ammClass: p.ammClass,
      rangeApr: p.aprIsRange ? p.aprPct ?? undefined : undefined,
    }));
  if (facts.length > 0) {
    try {
      await convex.mutation(api.poolFacts.put, {
        secret: process.env.POOL_FACTS_SECRET ?? '',
        chainId,
        facts,
      });
    } catch {
      // Cache write failed — the response is still correct, just uncached.
    }
  }

  return NextResponse.json({ pools: enriched });
}
