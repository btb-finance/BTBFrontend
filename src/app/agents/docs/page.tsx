import type { Metadata } from 'next';
import Link from 'next/link';
import { buildMetadata } from '@/lib/seo/metadata';
import { listTools, MCP_PUBLIC_URL, TOOL_GROUPS } from '@/lib/mcp/catalog';
import { MCP_SWAP_FEE_BPS } from '@/lib/mcp/build';
import { ROUTES } from '@/lib/api/v1';
import { AgentsShell, styles } from '../shell';

export const metadata: Metadata = buildMetadata({
  title: 'Connect an AI agent to BTB: MCP setup and tool reference',
  description: 'Add the BTB MCP server to Claude, Claude Code, Cursor or any MCP client, and see every tool with its arguments, safety model and fees.',
  path: '/agents/docs',
});

export const revalidate = 3600;

interface Schema { properties?: Record<string, { type?: string | string[]; description?: string }>; required?: string[] }

const JSON_CONFIG = `{
  "mcpServers": {
    "btb": { "type": "http", "url": "${MCP_PUBLIC_URL}" }
  }
}`;

const API = 'https://btb.finance/api/v1';

const REST_CURL = `curl -s '${API}/pools?chain=base&maxRisk=B&limit=5'

curl -s -X POST ${API}/build/swap \\
  -H 'content-type: application/json' \\
  -H 'authorization: Bearer <your key>' \\
  -d '{"chain":"base","tokenIn":"ETH","amount":"0.1",
       "tokenOut":"0x833589fCD6eDb6E08f4c7C32D04c4E3a2a1B2913",
       "wallet":"0xYourWallet"}'`;

const KEY_CURL = `curl -s -X POST ${API}/keys \\
  -H 'content-type: application/json' \\
  -d '{"name":"my-agent","contact":"you@example.com"}'`;

const CURL = `curl -s ${MCP_PUBLIC_URL} \\
  -H 'content-type: application/json' \\
  -H 'accept: application/json, text/event-stream' \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call",
       "params":{"name":"top_pools","arguments":{"chain":"base","limit":5}}}'`;

export default async function DocsPage() {
  const tools = await listTools();
  const feePct = (MCP_SWAP_FEE_BPS / 100).toFixed(2).replace(/\.?0+$/, '');
  return (
    <AgentsShell active="/agents/docs">
      <p style={styles.eyebrow}>Docs</p>
      <h1 style={styles.h1}>Connect your agent</h1>
      <p style={styles.lead}>
        BTB is a remote MCP server over Streamable HTTP. No sign-up and no API key: point your client at the URL below. Prefer plain HTTP? See the <a href="#rest-api" style={styles.link}>REST API</a>.
      </p>
      <code style={styles.code}>{MCP_PUBLIC_URL}</code>

      <h2 style={styles.h2}>Claude (web and desktop)</h2>
      <p style={styles.body}>Settings → Connectors → <strong>Add custom connector</strong>, name it BTB and paste the URL above.</p>

      <h2 style={styles.h2}>Claude Code</h2>
      <code style={styles.code}>{`claude mcp add --transport http btb ${MCP_PUBLIC_URL}`}</code>

      <h2 style={styles.h2}>Cursor, Windsurf and other MCP clients</h2>
      <p style={styles.body}>Add this to the client’s MCP config file (the key name varies slightly between clients):</p>
      <code style={styles.code}>{JSON_CONFIG}</code>

      <h2 style={styles.h2}>Your own agent (plain HTTP)</h2>
      <p style={styles.body}>Any MCP SDK works. Or call it directly with JSON-RPC:</p>
      <code style={styles.code}>{CURL}</code>

      <h2 id="rest-api" style={styles.h2}>REST API</h2>
      <p style={styles.body}>
        Every tool is also plain JSON over HTTP at <code style={styles.inlineCode}>{API}</code>, with the same answers as the MCP server.
        The OpenAPI spec at <a href={`${API}/openapi.json`} style={styles.link}>{`${API}/openapi.json`}</a> works with SDK generators and
        function-calling agents. Any tool can also be called by name: <code style={styles.inlineCode}>POST /api/v1/tools/&lt;name&gt;</code> with its arguments as the body.
      </p>
      <code style={styles.code}>{REST_CURL}</code>
      <ul style={{ ...styles.muted, paddingLeft: 18, margin: '12px 0 0' }}>
        {ROUTES.map((r) => (
          <li key={`${r.method} ${r.path}`} style={{ marginBottom: 4 }}>
            <code style={styles.inlineCode}>{`${r.method} ${r.path}`}</code>: {r.summary}
          </li>
        ))}
      </ul>
      <h3 style={{ ...styles.h3, marginTop: 20 }}>Keys and limits</h3>
      <p style={styles.body}>
        No key needed for 20 calls a minute per IP. A free key gives 120 a minute: create one below, keep it (it is shown once), and send it as
        {' '}<code style={styles.inlineCode}>Authorization: Bearer &lt;key&gt;</code> or <code style={styles.inlineCode}>X-API-Key</code>.
        Every answer carries <code style={styles.inlineCode}>X-RateLimit-Remaining</code>; a 429 says when to retry. <code style={styles.inlineCode}>GET /api/v1/keys/me</code> shows your usage.
      </p>
      <code style={styles.code}>{KEY_CURL}</code>

      <h2 style={styles.h2}>How a transaction works</h2>
      <ol style={{ ...styles.body, paddingLeft: 20 }}>
        <li style={{ marginBottom: 8 }}>Your agent calls a build tool (<code style={styles.inlineCode}>build_swap</code>, <code style={styles.inlineCode}>build_add_liquidity</code> or <code style={styles.inlineCode}>build_tx</code>) with its own wallet address.</li>
        <li style={{ marginBottom: 8 }}>BTB returns numbered steps: any approvals first (exact amounts only), then the action, each with <code style={styles.inlineCode}>to</code>, <code style={styles.inlineCode}>data</code>, <code style={styles.inlineCode}>value</code> and <code style={styles.inlineCode}>chainId</code>, plus a dry run of the final step.</li>
        <li style={{ marginBottom: 8 }}>Your agent checks the simulation and warnings, then signs and sends each step in order from its own wallet.</li>
      </ol>
      <p style={styles.body}>
        BTB never sees a private key and never sends anything. If your agent has no wallet, use <code style={styles.inlineCode}>add_liquidity_link</code> or
        {' '}<code style={styles.inlineCode}>auto_manage_setup</code>: they return a btb.finance link where a person reviews and signs.
      </p>

      <h2 style={styles.h2}>Fees and limits</h2>
      <ul style={{ ...styles.body, paddingLeft: 20 }}>
        <li style={{ marginBottom: 8 }}>Reading is free: pools, protocols, ABIs, contract reads and wallet positions.</li>
        <li style={{ marginBottom: 8 }}>Swaps built by <code style={styles.inlineCode}>build_swap</code> carry a {feePct}% BTB fee on the output, shown in every quote. It is shared with BTB users every Friday.</li>
        <li style={{ marginBottom: 8 }}><code style={styles.inlineCode}>build_tx</code> and <code style={styles.inlineCode}>build_add_liquidity</code> add no fee.</li>
        <li style={{ marginBottom: 8 }}>REST API: 20 calls a minute per IP without a key, 120 with a free key. Higher limits for partners on request.</li>
      </ul>

      <h2 style={styles.h2}>Tool reference</h2>
      <p style={styles.body}>{tools.length} tools, read live from the server. Click a name to try it in the <Link href="/agents/playground" style={styles.link}>playground</Link>.</p>
      {TOOL_GROUPS.map((g) => {
        const list = tools.filter((t) => t.group === g);
        if (!list.length) return null;
        return (
          <section key={g}>
            <h3 style={{ ...styles.h3, marginTop: 28 }}>{g}</h3>
            {list.map((t) => {
              const s = (t.inputSchema ?? {}) as Schema;
              const props = Object.entries(s.properties ?? {});
              return (
                <div key={t.name} id={t.name} style={{ ...styles.card, margin: '0 0 12px' }}>
                  <p style={{ margin: '0 0 6px' }}>
                    <Link href={`/agents/playground?tool=${t.name}`} style={{ ...styles.mono, fontSize: 14, color: '#52E3A4', fontWeight: 800, textDecoration: 'none' }}>{t.name}</Link>
                    {' '}<span style={t.readOnly ? styles.pillMuted : styles.pill}>{t.readOnly ? 'read' : 'builds tx'}</span>
                  </p>
                  <p style={{ ...styles.body, margin: '0 0 8px' }}>{t.description}</p>
                  {props.length > 0 && (
                    <ul style={{ ...styles.muted, paddingLeft: 18, margin: 0 }}>
                      {props.map(([k, p]) => (
                        <li key={k} style={{ marginBottom: 4 }}>
                          <code style={styles.inlineCode}>{k}</code>
                          {(s.required ?? []).includes(k) ? <strong> required</strong> : null}
                          {p.description ? ` — ${p.description}` : ''}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </section>
        );
      })}
    </AgentsShell>
  );
}
