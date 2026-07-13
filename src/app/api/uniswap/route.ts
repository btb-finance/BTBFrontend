/**
 * Server-side proxy for the Uniswap Trading API.
 *
 * The Trading API needs an `x-api-key` header — this route keeps the key in a
 * server-only env var (UNISWAP_TRADING_API_KEY) so it never reaches the
 * browser bundle. When the key isn't configured the route answers 503 and the
 * client lib (`src/lib/uniswapTrading.ts`) silently drops Uniswap as a quote
 * source, leaving KyberSwap-only behavior.
 *
 * See UNI.md for the integration plan and the skill in
 * .agents/skills/swap-integration for API rules.
 */
import { NextRequest } from 'next/server';

const UPSTREAM = 'https://trade-api.gateway.uniswap.org/v1';
// Only the endpoints this app uses — never an open proxy.
const ALLOWED = new Set(['check_approval', 'quote', 'swap', 'order', 'orders']);

// UniswapX order-status polling (GET /orders?orderId=…) — the only upstream
// GET this app uses.
export async function GET(req: NextRequest) {
  const key = process.env.UNISWAP_TRADING_API_KEY;
  if (!key) return Response.json({ error: 'not_configured' }, { status: 503 });
  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get('orderId') ?? '';
  if (!/^0x[0-9a-fA-F]{64}$/.test(orderId)) {
    return Response.json({ error: 'invalid orderId' }, { status: 400 });
  }
  try {
    const res = await fetch(`${UPSTREAM}/orders?orderId=${orderId}`, {
      headers: { 'x-api-key': key },
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

export async function POST(req: NextRequest) {
  const key = process.env.UNISWAP_TRADING_API_KEY;
  if (!key) return Response.json({ error: 'not_configured' }, { status: 503 });

  let endpoint: string, payload: unknown;
  try {
    const body = await req.json();
    endpoint = body.endpoint;
    payload = body.payload;
  } catch {
    return Response.json({ error: 'invalid body' }, { status: 400 });
  }
  if (!ALLOWED.has(endpoint)) {
    return Response.json({ error: 'invalid endpoint' }, { status: 400 });
  }

  try {
    const res = await fetch(`${UPSTREAM}/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'x-universal-router-version': '2.0',
      },
      body: JSON.stringify(payload),
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
