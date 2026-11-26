export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 26;

import { createHash, randomBytes } from 'node:crypto';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../../../convex/_generated/api';
import { ApiError, ROUTES, callTool, listTools, matchRoute, toolArgs } from '@/lib/api/v1';
import { openApi } from '@/lib/api/openapi';

/**
 * BTB's public REST API: https://btb.finance/api/v1. The connector's tools as plain JSON over HTTP (src/lib/api/v1.ts),
 * an OpenAPI spec at /openapi.json, and free keys at POST /keys. Limits: 20 calls a minute per IP without a key,
 * 120 with one; counted in Convex (convex/apiGate.ts), which only this route can write to (BTB_API_SECRET).
 */

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL ?? 'https://grateful-oyster-780.convex.cloud';
const SECRET = process.env.BTB_API_SECRET;
const convex = new ConvexHttpClient(CONVEX_URL);

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type, authorization, x-api-key',
  'access-control-expose-headers': 'x-ratelimit-limit, x-ratelimit-remaining, x-ratelimit-reset, retry-after',
};

function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body, null, 1), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...CORS, ...extra },
  });
}
const fail = (status: number, code: string, message: string, extra: Record<string, string> = {}) => json({ error: { code, message } }, status, extra);

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

function clientIp(req: Request): string {
  const h = req.headers;
  return h.get('cf-connecting-ip') ?? h.get('x-nf-client-connection-ip') ?? h.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
}

function apiKey(req: Request, url: URL): string | null {
  const auth = req.headers.get('authorization');
  const bearer = auth?.match(/^Bearer\s+(\S+)$/i)?.[1];
  return bearer ?? req.headers.get('x-api-key') ?? url.searchParams.get('api_key');
}

/** Counts the call. Returns headers to add, or a ready error response. Open when the store is down or unset. */
async function gate(req: Request, url: URL): Promise<{ headers: Record<string, string> } | { response: Response }> {
  const key = apiKey(req, url);
  if (!SECRET) return { headers: {} }; // local development without the secret: no limits
  try {
    const r = await convex.mutation(api.apiGate.hit, { secret: SECRET, keyHash: key ? sha256(key) : undefined, ip: clientIp(req) });
    const headers = {
      'x-ratelimit-limit': String(r.limit),
      'x-ratelimit-remaining': String(r.remaining),
      'x-ratelimit-reset': String(Math.ceil(r.resetAt / 1000)),
    };
    if (!r.ok && r.reason === 'invalid_key') return { response: fail(401, 'invalid_key', 'This API key is unknown or turned off. Get one with POST /api/v1/keys, or call without a key.') };
    if (!r.ok) {
      const wait = Math.max(1, Math.ceil((r.resetAt - Date.now()) / 1000));
      return { response: fail(429, 'rate_limited', `Limit of ${r.limit} calls a minute reached. Retry in ${wait}s${key ? '' : ', or get a free key (POST /api/v1/keys) for 120 a minute'}.`, { ...headers, 'retry-after': String(wait) }) };
    }
    return { headers };
  } catch (e) {
    console.error('[api/v1] gate', e);
    return { headers: {} };
  }
}

async function index(): Promise<Response> {
  const tools = await listTools();
  return json({
    name: 'BTB Finance API',
    version: 'v1',
    docs: 'https://btb.finance/agents/docs',
    openapi: 'https://btb.finance/api/v1/openapi.json',
    mcp: 'https://btb.finance/api/mcp',
    auth: 'Optional. 20 calls a minute per IP without a key; POST /api/v1/keys for a free key with 120. Send it as "Authorization: Bearer <key>" or "X-API-Key: <key>".',
    signing: 'Nothing here signs or sends. /build endpoints return unsigned transactions for your own wallet.',
    routes: ROUTES.map((r) => ({ method: r.method, path: `/api/v1${r.path}`, tool: r.tool, summary: r.summary })),
    tools: tools.map((t) => ({ name: t.name, path: `/api/v1/tools/${t.name}`, method: 'POST', title: t.title, readOnly: t.annotations?.readOnlyHint ?? null })),
  }, 200, { 'cache-control': 'public, max-age=300' });
}

async function createKey(req: Request): Promise<Response> {
  if (!SECRET) return fail(503, 'keys_off', 'Keys are not available on this server.');
  const body = (await req.json().catch(() => ({}))) as { name?: unknown; contact?: unknown };
  const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim().slice(0, 80) : 'unnamed';
  const contact = typeof body.contact === 'string' && body.contact.trim() ? body.contact.trim().slice(0, 200) : undefined;
  const key = `btb_${randomBytes(24).toString('base64url')}`;
  const prefix = key.slice(0, 12);
  const r = await convex.mutation(api.apiGate.createKey, { secret: SECRET, hash: sha256(key), prefix, name, contact, ip: clientIp(req) });
  if (!r.ok) return fail(429, 'too_many_keys', 'This address made too many keys today. Try again tomorrow, or reuse one you have.');
  return json({
    key, prefix, name, tier: r.tier, limitPerMinute: r.limitPerMinute,
    use: 'Send it as "Authorization: Bearer <key>" or "X-API-Key: <key>". It is shown only once: store it now.',
  }, 201);
}

async function keyMe(req: Request, url: URL): Promise<Response> {
  const key = apiKey(req, url);
  if (!key || !SECRET) return fail(401, 'no_key', 'Send your key as "Authorization: Bearer <key>".');
  const info = await convex.query(api.apiGate.keyInfo, { secret: SECRET, hash: sha256(key) });
  return info ? json(info) : fail(401, 'invalid_key', 'This API key is unknown.');
}

async function handle(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api\/v1/, '').replace(/\/+$/, '') || '/';
  const method = req.method.toUpperCase();
  try {
    if (path === '/' && method === 'GET') return await index();
    if (path === '/openapi.json' && method === 'GET') return json(await openApi(), 200, { 'cache-control': 'public, max-age=300' });
    if (path === '/keys' && method === 'POST') return await createKey(req);
    if (path === '/keys/me' && method === 'GET') return await keyMe(req, url);

    const toolMatch = path.match(/^\/tools\/([a-z_]+)$/);
    const routeMatch = toolMatch ? null : matchRoute(method, path);
    if (!toolMatch && !routeMatch) return fail(404, 'not_found', `No endpoint ${method} /api/v1${path}. GET /api/v1 lists them; the spec is at /api/v1/openapi.json.`);
    if (toolMatch && method !== 'POST' && method !== 'GET') return fail(405, 'method_not_allowed', 'Use POST with a JSON body (or GET with query parameters).');

    const g = await gate(req, url);
    if ('response' in g) return g.response;

    const name = toolMatch ? toolMatch[1] : routeMatch!.route.tool;
    const tool = (await listTools()).find((t) => t.name === name);
    if (!tool) return fail(404, 'unknown_tool', `No tool "${name}". GET /api/v1 lists them.`);
    let body: Record<string, unknown> | null = null;
    if (method === 'POST') {
      const text = await req.text();
      if (text.trim()) {
        try { body = JSON.parse(text); } catch { return fail(400, 'bad_json', 'The body is not valid JSON.', g.headers); }
        if (!body || typeof body !== 'object' || Array.isArray(body)) return fail(400, 'bad_json', 'The body must be a JSON object of arguments.', g.headers);
      }
    }
    const args = toolArgs(tool, routeMatch?.route ?? null, routeMatch?.params ?? {}, url.searchParams, body);
    return json(await callTool(name, args), 200, g.headers);
  } catch (e) {
    if (e instanceof ApiError) return fail(e.status, e.code, e.message);
    console.error('[api/v1]', e);
    return fail(500, 'internal', 'Something went wrong on our side. Try again in a moment.');
  }
}

export const GET = handle;
export const POST = handle;
export const OPTIONS = () => new Response(null, { status: 204, headers: CORS });
