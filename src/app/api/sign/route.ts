export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { openSignToken } from '@/lib/signLink';

/** POST /api/sign {token} → {plan}: checks a sign link (src/lib/signLink.ts) for the /sign page. */
export async function POST(req: Request): Promise<Response> {
  const body = await req.json().catch(() => null) as { token?: unknown } | null;
  const token = typeof body?.token === 'string' ? body.token : '';
  const r = openSignToken(token);
  const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
  if (r.ok) return new Response(JSON.stringify({ plan: r.plan }), { headers });
  const message = r.reason === 'expired'
    ? 'This link has expired (links last 15 minutes). Ask your assistant to build it again.'
    : r.reason === 'unavailable'
      ? 'Signing links are not available on this server.'
      : 'This link was not made by BTB, or it was changed. Do not sign anything from it.';
  return new Response(JSON.stringify({ error: message, reason: r.reason }), { status: r.reason === 'unavailable' ? 503 : 400, headers });
}
