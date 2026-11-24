/**
 * The BTB MCP connector as a standalone Node server, for hosting outside Next.js (Flux, any Docker host).
 * Same tools as src/app/api/mcp/route.ts; served at /mcp (and /api/mcp, so existing client URLs keep working).
 * Stateless and keyless: it holds no private keys and no user data, so it can run on untrusted nodes.
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { buildServer } from '@/lib/mcp/server';

const PORT = Number(process.env.PORT ?? 8080);

const handler = createMcpHandler(() => buildServer(), { responseMode: 'json', onerror: (e) => console.error('[mcp]', e) });

const cors: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
  'access-control-allow-headers': 'content-type, accept, authorization, mcp-protocol-version, mcp-session-id, last-event-id',
  'access-control-expose-headers': 'mcp-session-id, mcp-protocol-version',
};

function toRequest(req: IncomingMessage): Request {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (Array.isArray(v)) v.forEach((x) => headers.append(k, x));
    else if (v !== undefined) headers.set(k, v);
  }
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  return new Request(url, {
    method: req.method,
    headers,
    body: hasBody ? (Readable.toWeb(req) as ReadableStream) : undefined,
    // Node's fetch requires this for streamed request bodies.
    ...(hasBody ? { duplex: 'half' } : {}),
  } as RequestInit);
}

async function send(res: ServerResponse, r: Response) {
  const headers: Record<string, string> = {};
  r.headers.forEach((v, k) => { headers[k] = v; });
  res.writeHead(r.status, { ...headers, ...cors, 'cache-control': 'no-store' });
  if (!r.body) return res.end();
  for await (const chunk of r.body as unknown as AsyncIterable<Uint8Array>) res.write(chunk);
  res.end();
}

const server = createServer(async (req, res) => {
  try {
    const path = (req.url ?? '/').split('?')[0];
    if (path === '/health' || path === '/') {
      res.writeHead(200, { 'content-type': 'application/json', ...cors });
      return res.end(JSON.stringify({ ok: true, service: 'btb-mcp', mcp: '/mcp' }));
    }
    if (path !== '/mcp' && path !== '/api/mcp') {
      res.writeHead(404, cors);
      return res.end();
    }
    if (req.method === 'OPTIONS') {
      res.writeHead(204, cors);
      return res.end();
    }
    await send(res, await handler.fetch(toRequest(req)));
  } catch (e) {
    console.error('[mcp] request failed', e);
    if (!res.headersSent) res.writeHead(500, { 'content-type': 'application/json', ...cors });
    res.end(JSON.stringify({ error: 'internal error' }));
  }
});

// Long tool calls (wallet_positions, simulations) are fine here: no serverless time limit.
server.requestTimeout = 120_000;
server.listen(PORT, () => console.log(`[mcp] BTB MCP listening on :${PORT} (/mcp, /health)`));

for (const sig of ['SIGTERM', 'SIGINT'] as const) {
  process.on(sig, () => server.close(() => process.exit(0)));
}
