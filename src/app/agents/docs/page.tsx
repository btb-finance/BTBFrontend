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

const REST_CURL = `curl -s '${API}/yield?token=USDC&chain=base&limit=5'

curl -s '${API}/pools?chain=base&maxRisk=B&limit=5'

curl -s -X POST ${API}/build/swap \\
  -H 'content-type: application/json' \\
  -H 'authorization: Bearer <your key>' \\
  -d '{"chain":"base","tokenIn":"ETH","amount":"0.1",
       "tokenOut":"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
       "wallet":"0xYourWallet"}'`;

const KEY_CURL = `curl -s -X POST ${API}/keys \\
  -H 'content-type: application/json' \\
  -d '{"name":"my-agent","contact":"you@example.com"}'`;

/** An agent with its own wallet, no human: build, check, sign each step, confirm. viem; any library works. */
const AGENT_TS = `import { createWalletClient, createPublicClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

const API = '${API}';
// A wallet only for the agent, holding only what it may spend. Never your main wallet.
const account = privateKeyToAccount(process.env.AGENT_KEY as \`0x\${string}\`);
const wallet = createWalletClient({ account, chain: base, transport: http() });
const chain = createPublicClient({ chain: base, transport: http() });

async function call(path: string, body: object) {
  const r = await fetch(API + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + process.env.BTB_KEY },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error((await r.json()).error.message);
  return r.json();
}

// 1. Build: lend 100 USDC on Aave on Base (approval only if needed, then the supply).
const plan = await call('/build/lend', { chain: 'base', token: 'USDC', amount: '100', wallet: account.address });

// 2. Check: stop on a failed dry run (a later step may wait for an earlier approval) or any warning you do not accept.
if (plan.simulation.status === 'reverted') throw new Error('dry run failed: ' + plan.simulation.reason);
if (plan.warnings?.length) console.warn(plan.warnings);

// 3. Sign and send each step in order, waiting for each to confirm.
for (const tx of plan.transactions) {
  const hash = await wallet.sendTransaction({ to: tx.to, data: tx.data, value: BigInt(tx.value) });
  const receipt = await chain.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error('step ' + tx.step + ' failed: ' + hash);
}

// 4. Confirm what moved (any hash): GET /api/v1/tx/base/<hash>`;

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
        BTB is a remote MCP server over Streamable HTTP. No sign-up and no API key: point your client at the URL below. It works in Claude, ChatGPT, Grok, Gemini, Perplexity, Le Chat and any MCP client. Prefer plain HTTP? See the <a href="#rest-api" style={styles.link}>REST API</a>; building an agent with its own wallet? See <a href="#autonomous" style={styles.link}>autonomous agents</a>.
      </p>
      <code style={styles.code}>{MCP_PUBLIC_URL}</code>

      <h2 style={styles.h2}>Claude (web and desktop)</h2>
      <p style={styles.body}>Settings → Connectors → <strong>Add custom connector</strong>, name it BTB and paste the URL above.</p>

      <h2 style={styles.h2}>Claude Code</h2>
      <code style={styles.code}>{`claude mcp add --transport http btb ${MCP_PUBLIC_URL}`}</code>

      <h2 style={styles.h2}>ChatGPT, Grok, Gemini, Perplexity, Le Chat</h2>
      <p style={styles.body}>
        ChatGPT: <strong>+ → Plugins → Add custom MCP server</strong> (paid plans). Grok: grok.com/connectors → <strong>Add a custom connector</strong>.
        Gemini web app: add a custom app by its MCP URL (where available). Perplexity: Connectors → <strong>Add MCP connector</strong>. Le Chat: Connectors →
        {' '}<strong>Custom MCP Connector</strong>. Paste the URL above; no sign-in needed.
      </p>

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
        <li style={{ marginBottom: 8 }}>The agent calls a build tool: <code style={styles.inlineCode}>build_swap</code>, <code style={styles.inlineCode}>build_lend</code>, <code style={styles.inlineCode}>build_withdraw</code>, <code style={styles.inlineCode}>build_zap_liquidity</code>, <code style={styles.inlineCode}>build_add_liquidity</code> or <code style={styles.inlineCode}>build_tx</code> (any contract; pass <code style={styles.inlineCode}>steps</code> for approve plus action), with the wallet that will sign.</li>
        <li style={{ marginBottom: 8 }}>BTB returns numbered steps: approvals first (exact amounts only), then the action, each with <code style={styles.inlineCode}>to</code>, <code style={styles.inlineCode}>data</code>, <code style={styles.inlineCode}>value</code> and <code style={styles.inlineCode}>chainId</code>, a dry run, warnings, and a <code style={styles.inlineCode}>signLink</code>.</li>
        <li style={{ marginBottom: 8 }}>Then either a person signs, or the agent does (below).</li>
      </ol>

      <h3 style={{ ...styles.h3, marginTop: 20 }}>A person signs (chat assistants)</h3>
      <p style={styles.body}>
        Chat assistants (Claude, ChatGPT, Grok, Gemini) have no wallet, by design. They give the person the <code style={styles.inlineCode}>signLink</code>:
        it opens btb.finance with the steps to sign in their own wallet, in order. Links are sealed by BTB (an edited link is refused), last 15 minutes and only
        sign from the wallet they were built for. Afterwards the assistant calls <code style={styles.inlineCode}>sign_status</code> with the link: each signed
        step, checked on chain, with the tokens that moved. No need to ask the person for hashes.
      </p>

      <h3 id="autonomous" style={{ ...styles.h3, marginTop: 20 }}>The agent signs (autonomous agents)</h3>
      <p style={styles.body}>
        An agent with its own wallet, running with no human present, signs and sends the steps itself. BTB never sees the key. Give the agent a wallet of its own
        that holds only what it may spend: a plain key on its server is simplest; a wallet service (Coinbase CDP / AgentKit, Privy or Turnkey server wallets)
        adds spending limits and allowlists; a smart wallet with limited permissions (a Safe module, or session keys) lets a user grant narrow rights, such as
        these contracts, up to this amount a day, until this date.
      </p>
      <code style={styles.code}>{AGENT_TS}</code>
      <ul style={{ ...styles.body, paddingLeft: 20 }}>
        <li style={{ marginBottom: 8 }}>Always stop on a failed dry run or a warning the agent does not understand. Build again rather than retrying an old step: quotes go stale in about two minutes.</li>
        <li style={{ marginBottom: 8 }}>Approvals from BTB are always for the exact amount. Never let an agent approve an unlimited amount.</li>
        <li style={{ marginBottom: 8 }}>Use <code style={styles.inlineCode}>compare_yield</code>, <code style={styles.inlineCode}>quote_swap</code> and <code style={styles.inlineCode}>quick_token_check</code> before deciding; they are free.</li>
      </ul>

      <h2 style={styles.h2}>Fees and limits</h2>
      <ul style={{ ...styles.body, paddingLeft: 20 }}>
        <li style={{ marginBottom: 8 }}>Reading is free: pools, protocols, ABIs, contract reads and wallet positions.</li>
        <li style={{ marginBottom: 8 }}>Swaps built by <code style={styles.inlineCode}>build_swap</code> carry a {feePct}% BTB fee on the output, shown in every quote. It is shared with BTB users every Friday.</li>
        <li style={{ marginBottom: 8 }}><code style={styles.inlineCode}>build_tx</code>, <code style={styles.inlineCode}>build_lend</code>, <code style={styles.inlineCode}>build_withdraw</code> and <code style={styles.inlineCode}>build_add_liquidity</code> add no fee. <code style={styles.inlineCode}>build_zap_liquidity</code> carries the swap fee on its swap step only.</li>
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
                          {p.description ? `: ${p.description}` : ''}
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
