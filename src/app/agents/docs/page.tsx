import type { Metadata } from 'next';
import Link from 'next/link';
import { buildMetadata } from '@/lib/seo/metadata';
import { listTools, MCP_PUBLIC_URL, TOOL_GROUPS } from '@/lib/mcp/catalog';
import { MCP_SWAP_FEE_BPS } from '@/lib/mcp/build';
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
        BTB is a remote MCP server over Streamable HTTP. No sign-up and no API key: point your client at the URL below.
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
        <li style={{ marginBottom: 8 }}>Heavy automated use may be rate limited. Paid plans with higher limits are coming.</li>
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
