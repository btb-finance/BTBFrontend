export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 20;

import { timingSafeEqual } from 'node:crypto';
import { KYBER_CHAINS } from '@/lib/kyberswap';

/**
 * A narrow relay to KyberSwap's aggregator for BTB's own servers (the MCP connector on Flux), whose IPs KyberSwap
 * sometimes refuses. Not public: callers must send KYBER_PROXY_SECRET in x-btb-relay-key, and only the two
 * endpoints the swap builder uses are forwarded (GET routes, POST route/build) for the chains BTB supports.
 */
const SLUGS = new Set(Object.values(KYBER_CHAINS));
const PATH = /^([a-z0-9-]+)\/api\/v1\/(routes|route\/build)$/;

function authorized(key: string | null): boolean {
  const secret = process.env.KYBER_PROXY_SECRET;
  if (!secret || !key) return false;
  const a = Buffer.from(key);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request): Promise<Response> {
  if (!authorized(request.headers.get('x-btb-relay-key'))) return new Response('forbidden', { status: 403 });
  let input: { path?: unknown; query?: unknown; body?: unknown };
  try { input = await request.json(); } catch { return new Response('bad json', { status: 400 }); }
  const path = typeof input.path === 'string' ? input.path : '';
  const m = PATH.exec(path);
  if (!m || !SLUGS.has(m[1])) return new Response('path not allowed', { status: 400 });
  const query = typeof input.query === 'string' ? input.query : '';
  const isBuild = m[2] === 'route/build';
  if (isBuild && (input.body === undefined || typeof input.body !== 'object')) return new Response('body required', { status: 400 });

  const url = `https://aggregator-api.kyberswap.com/${path}${!isBuild && query ? `?${query}` : ''}`;
  const res = await fetch(url, isBuild
    ? { method: 'POST', headers: { 'content-type': 'application/json', 'x-client-id': 'btb-finance' }, body: JSON.stringify(input.body) }
    : { headers: { 'x-client-id': 'btb-finance' } });
  return new Response(await res.text(), {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json', 'cache-control': 'no-store' },
  });
}
