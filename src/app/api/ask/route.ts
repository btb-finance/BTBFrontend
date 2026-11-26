export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 26;

import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../../convex/_generated/api';
import { ask, type AskTurn } from '@/lib/ask/agent';

/**
 * POST /api/ask {message, history?, wallet?} → {reply, steps}. Powers the Ask box on btb.finance's home page.
 * No sign-in: limited per IP (convex/apiGate.ts askHit), since every question runs the language model.
 */

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL ?? 'https://grateful-oyster-780.convex.cloud';
const SECRET = process.env.BTB_API_SECRET;
const convex = new ConvexHttpClient(CONVEX_URL);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

function clientIp(req: Request): string {
  const h = req.headers;
  return h.get('cf-connecting-ip') ?? h.get('x-nf-client-connection-ip') ?? h.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
}

export async function POST(req: Request): Promise<Response> {
  const body = await req.json().catch(() => null) as { message?: unknown; history?: unknown; wallet?: unknown } | null;
  const message = typeof body?.message === 'string' ? body.message.trim().slice(0, 1500) : '';
  if (!message) return json({ error: 'Type a question first.' }, 400);
  const history: AskTurn[] = Array.isArray(body?.history)
    ? (body.history as unknown[]).flatMap((t) => {
        const r = t as { role?: unknown; content?: unknown };
        return (r.role === 'user' || r.role === 'assistant') && typeof r.content === 'string' ? [{ role: r.role as AskTurn['role'], content: r.content.slice(0, 3000) }] : [];
      }).slice(-10)
    : [];
  const wallet = typeof body?.wallet === 'string' && /^0x[0-9a-fA-F]{40}$/.test(body.wallet) ? body.wallet : null;

  if (SECRET) {
    try {
      const r = await convex.mutation(api.apiGate.askHit, { secret: SECRET, ip: clientIp(req) });
      if (!r.ok) return json({ error: r.reason === 'minute' ? 'That is a lot of questions in a minute. Wait a moment and ask again.' : 'You have reached today\'s limit for questions. It resets at midnight UTC.' }, 429);
    } catch (e) {
      console.error('[ask] limit check', e);
    }
  }

  try {
    return json(await ask(message, history, wallet));
  } catch (e) {
    console.error('[ask]', e);
    const msg = (e as Error).message;
    return json({ error: /recharge|insufficient|balance/i.test(msg) ? 'The agent is busy right now. Try again in a little while.' : 'The agent could not answer just now. Try again in a moment.' }, 502);
  }
}
