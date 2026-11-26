export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 26;

import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../../../convex/_generated/api';
import { swapSteps, type SwapParams } from '@/lib/ask/agent';

/**
 * POST /api/ask/swap {swap, wallet} → {step}: the swap step of an Ask answer, rebuilt with a fresh quote right before
 * the person signs it (quotes go stale in a couple of minutes). Same tokens, amount and slippage as first built.
 */

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL ?? 'https://grateful-oyster-780.convex.cloud';
const SECRET = process.env.BTB_API_SECRET;
const convex = new ConvexHttpClient(CONVEX_URL);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

const tokenOk = (t: unknown) => typeof t === 'string' && (/^eth$/i.test(t) || /^0x[0-9a-fA-F]{40}$/.test(t));

export async function POST(req: Request): Promise<Response> {
  const body = await req.json().catch(() => null) as { swap?: Partial<SwapParams>; wallet?: unknown } | null;
  const s = body?.swap;
  const wallet = typeof body?.wallet === 'string' && /^0x[0-9a-fA-F]{40}$/.test(body.wallet) ? body.wallet : null;
  if (!s || !wallet || !Number.isInteger(s.chainId) || !tokenOk(s.tokenIn) || !tokenOk(s.tokenOut)
    || typeof s.amount !== 'string' || !/^\d+(\.\d+)?$/.test(s.amount)) {
    return json({ error: 'Bad swap.' }, 400);
  }
  if (SECRET) {
    const ip = req.headers.get('cf-connecting-ip') ?? req.headers.get('x-nf-client-connection-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
    try {
      const r = await convex.mutation(api.apiGate.askHit, { secret: SECRET, ip });
      if (!r.ok) return json({ error: 'Too many requests. Wait a moment and try again.' }, 429);
    } catch (e) { console.error('[ask/swap] limit check', e); }
  }
  try {
    const slippageBps = Math.min(300, Math.max(10, Number(s.slippageBps) || 50));
    const { steps } = await swapSteps({ chainId: s.chainId!, tokenIn: s.tokenIn!, tokenOut: s.tokenOut!, amount: s.amount, slippageBps }, wallet);
    return json({ step: steps[steps.length - 1] });
  } catch (e) {
    console.error('[ask/swap]', e);
    return json({ error: 'Could not get a fresh quote. Try again in a moment.' }, 502);
  }
}
