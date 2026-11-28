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

const URL_ = 'https://btb.finance/api/mcp';

/** What a person sees when they open the connector link in a browser (assistants never get this page). */
const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>BTB connector</title><meta name="description" content="Add BTB to Claude, ChatGPT or any AI assistant.">
<style>
:root{--bg:#f6f1e7;--card:#fffaf0;--ink:#2b2a3a;--soft:#6b6878;--red:#e5483d;--line:#e6dccb;--green:#2f9e6a}
@media (prefers-color-scheme:dark){:root{--bg:#17161d;--card:#211f29;--ink:#f1ede6;--soft:#a7a3b3;--line:#34313f;--green:#4cc38a}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
main{max-width:680px;margin:0 auto;padding:40px 16px 56px}h1{font-size:30px;margin:0 0 6px}p.lead{color:var(--soft);margin:0 0 24px}
.card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:20px;margin:0 0 16px}
.url{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.url code{flex:1;min-width:220px;font:15px ui-monospace,Menlo,monospace;background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:10px 12px;word-break:break-all}
button{font:600 15px system-ui;background:var(--red);color:#fff;border:0;border-radius:10px;padding:10px 16px;cursor:pointer}
h2{font-size:18px;margin:0 0 10px}ol,ul{margin:0;padding-left:20px}li{margin:4px 0}.ok{color:var(--green);font-weight:600}a{color:var(--red)}
</style></head><body><main>
<h1>BTB connector</h1>
<p class="lead">Add BTB to your AI assistant and do DeFi just by asking: 100 protocols across 70+ chains. You sign every transaction in your own wallet.</p>
<div class="card"><h2>Connector URL</h2><div class="url"><code id="u">${URL_}</code><button id="b" type="button">Copy</button></div>
<p class="ok" style="margin:12px 0 0">Free. No sign up, no API key.</p></div>
<div class="card"><h2>Add it to Claude</h2><ol><li>Open Settings, then Connectors.</li><li>Choose Add custom connector.</li><li>Name it BTB, paste the URL above, and add it.</li></ol>
<p style="margin:12px 0 0;color:var(--soft)">Claude Code: <code>claude mcp add --transport http btb ${URL_}</code></p></div>
<div class="card"><h2>Other assistants</h2><ul><li>ChatGPT: add a custom MCP server with this URL (paid plans).</li><li>Grok, Perplexity, Le Chat, Gemini: add a custom connector with this URL where available.</li></ul></div>
<div class="card"><h2>Then just ask</h2><ul><li>Where can I get the best rate on my USDC?</li><li>Check my portfolio.</li><li>Swap, bridge, lend, or launch a coin.</li></ul></div>
<p style="color:var(--soft)">More at <a href="https://btb.finance/agents/docs">btb.finance/agents/docs</a>. Not financial advice.</p>
</main><script>document.getElementById('b').onclick=function(){var t=document.getElementById('u').textContent;navigator.clipboard&&navigator.clipboard.writeText(t).then(function(){var b=document.getElementById('b');b.textContent='Copied';setTimeout(function(){b.textContent='Copy'},1500)})}</script></body></html>`;

/** Browsers (no event-stream Accept) get the page; MCP clients keep the protocol answer. */
export async function GET(request: Request): Promise<Response> {
  const accept = request.headers.get('accept') ?? '';
  if (!accept.includes('text/event-stream') && !request.headers.get('mcp-session-id')) {
    return new Response(PAGE, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' } });
  }
  return serve(request);
}
export const POST = serve;
export const DELETE = serve;
export const OPTIONS = () => new Response(null, { status: 204, headers: cors });
