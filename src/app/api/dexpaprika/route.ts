/**
 * Server-side proxy for DexPaprika's free DEX data API.
 *
 * DexPaprika's API has no CORS headers (confirmed: no
 * Access-Control-Allow-Origin on any response), so a direct browser fetch()
 * to it fails with "Failed to fetch" for every user — it can only be called
 * server-to-server. This route forwards a restricted set of paths so the
 * client-side lib (`src/lib/dexpaprika.ts`) can keep calling a same-origin
 * URL.
 */
import { NextRequest } from 'next/server';

const UPSTREAM = 'https://api.dexpaprika.com';
// Only pool-data paths this app actually uses — never an open proxy.
const ALLOWED_PATH = /^networks\/[a-z0-9-]+\/(pools\/0x[a-fA-F0-9]+|dexes\/[a-z0-9_-]+\/pools)$/;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const path = searchParams.get('path') ?? '';
  if (!ALLOWED_PATH.test(path)) {
    return Response.json({ error: 'invalid path' }, { status: 400 });
  }
  const qs = new URLSearchParams(searchParams);
  qs.delete('path');
  const qsStr = qs.toString();

  try {
    const res = await fetch(`${UPSTREAM}/${path}${qsStr ? `?${qsStr}` : ''}`, {
      // Pool data changes constantly — don't let Next.js cache a stale response.
      cache: 'no-store',
    });
    const body = await res.text();
    return new Response(body, {
      status: res.status,
      headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
    });
  } catch {
    return Response.json({ error: 'upstream fetch failed' }, { status: 502 });
  }
}
