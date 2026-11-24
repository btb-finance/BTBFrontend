export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 26;

import { createMcpHandler } from '@modelcontextprotocol/server';
import { buildServer } from '@/lib/mcp/server';

/**
 * The BTB connector: a remote MCP server (Streamable HTTP, stateless, JSON responses) at https://btb.finance/api/mcp.
 * Add it in claude.ai under Customize → Connectors → Add custom connector, or in Claude Code with
 * `claude mcp add --transport http btb https://btb.finance/api/mcp`. Read-only: no auth, no keys, no transactions.
 */
const handler = createMcpHandler(() => buildServer(), { responseMode: 'json', onerror: (e) => console.error('[mcp]', e) });

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
  'access-control-allow-headers': 'content-type, accept, authorization, mcp-protocol-version, mcp-session-id, last-event-id',
  'access-control-expose-headers': 'mcp-session-id, mcp-protocol-version',
};

async function serve(request: Request): Promise<Response> {
  const res = await handler.fetch(request);
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(cors)) headers.set(k, v);
  headers.set('cache-control', 'no-store');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

export const GET = serve;
export const POST = serve;
export const DELETE = serve;
export const OPTIONS = () => new Response(null, { status: 204, headers: cors });
