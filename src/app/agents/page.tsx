import type { Metadata } from 'next';
import Link from 'next/link';
import { buildMetadata } from '@/lib/seo/metadata';
import { listTools, MCP_PUBLIC_URL, TOOL_GROUPS } from '@/lib/mcp/catalog';
import { PROTOCOLS } from '@/lib/mcp/registryData';
import { AgentsShell, styles } from './shell';

export const metadata: Metadata = buildMetadata({
  title: 'BTB for AI agents: one MCP for DeFi',
  description: 'Connect any AI agent to DeFi with one MCP server: live pools, official protocol contracts, any contract ABI, and unsigned swap, liquidity and contract transactions with a dry run. Free to connect.',
  path: '/agents',
  keywords: ['DeFi MCP server', 'AI agent DeFi', 'MCP crypto', 'agent swap tool', 'contract ABI API', 'Claude DeFi connector'],
});

export const revalidate = 3600;

const STEPS = [
  { title: 'Find', body: 'Live pools with risk grades, official protocol contracts per chain, and any contract’s functions.' },
  { title: 'Read', body: 'Balances, positions, prices and settings from any contract, decoded. Free, nothing is sent.' },
  { title: 'Build', body: 'Unsigned swaps, LP deposits and any contract call, with approvals in order and a dry run.' },
  { title: 'Sign', body: 'Your agent signs with its own wallet. BTB never holds keys or funds.' },
];

export default async function AgentsPage() {
  const tools = await listTools();
  const chains = new Set(PROTOCOLS.flatMap((p) => p.contracts.map((c) => c.chain)));
  const contracts = PROTOCOLS.reduce((n, p) => n + p.contracts.length, 0);
  return (
    <AgentsShell active="/agents">
      <p style={styles.eyebrow}>BTB Finance for AI agents</p>
      <h1 style={styles.h1}>One MCP server for DeFi. Your agent finds it, reads it, and builds the transaction.</h1>
      <p style={styles.lead}>
        Add one URL to Claude, ChatGPT, Cursor or your own agent. It gets {tools.length} tools: live liquidity pools across chains,
        official contracts for {PROTOCOLS.length} protocols ({contracts} contracts on {chains.size} chains), the ABI of any contract,
        and ready-to-sign transactions with a dry run. Your agent keeps its own wallet.
      </p>
      <code style={styles.code}>{MCP_PUBLIC_URL}</code>
      <div style={styles.ctaRow}>
        <Link href="/agents/docs" style={styles.ctaPrimary}>Connect your agent</Link>
        <Link href="/agents/playground" style={styles.ctaGhost}>Try the tools</Link>
        <Link href="/agents/protocols" style={styles.ctaGhost}>Browse protocols</Link>
      </div>

      <h2 style={styles.h2}>How it works</h2>
      <div style={styles.grid}>
        {STEPS.map((s, i) => (
          <div key={s.title} style={styles.card}>
            <p style={{ ...styles.eyebrow, margin: '0 0 6px' }}>{i + 1}. {s.title}</p>
            <p style={{ ...styles.body, margin: 0 }}>{s.body}</p>
          </div>
        ))}
      </div>

      <h2 style={styles.h2}>The tools</h2>
      <p style={styles.body}>Read straight from the server, so this list is always what agents get.</p>
      {TOOL_GROUPS.map((g) => {
        const list = tools.filter((t) => t.group === g);
        if (!list.length) return null;
        return (
          <section key={g} style={{ margin: '0 0 18px' }}>
            <h3 style={styles.h3}>{g}</h3>
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <tbody>
                  {list.map((t) => (
                    <tr key={t.name}>
                      <td style={{ ...styles.td, width: 200 }}>
                        <Link href={`/agents/playground?tool=${t.name}`} style={{ ...styles.mono, color: '#52E3A4', textDecoration: 'none', fontWeight: 700 }}>{t.name}</Link>
                      </td>
                      <td style={styles.tdMuted}>{t.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      <h2 style={styles.h2}>Protocols with official contracts</h2>
      <p style={styles.body}>Every address comes from the protocol’s own docs or GitHub, linked next to it. More are added every week.</p>
      <div style={styles.grid}>
        {PROTOCOLS.map((p) => (
          <Link key={p.slug} href={`/agents/protocols/${p.slug}`} style={{ ...styles.card, textDecoration: 'none', color: '#F2F2F5' }}>
            <p style={{ ...styles.h3, margin: '0 0 4px' }}>{p.name}</p>
            <p style={{ ...styles.muted, margin: 0 }}>{p.category} · {p.contracts.length} contracts</p>
          </Link>
        ))}
      </div>

      <h2 style={styles.h2}>Safe by design</h2>
      <ul style={{ ...styles.body, paddingLeft: 20 }}>
        <li style={{ marginBottom: 8 }}>No keys, no custody: every write tool returns unsigned transactions for your agent to sign.</li>
        <li style={{ marginBottom: 8 }}>Approvals for the exact amount, never unlimited, and only when the allowance is short.</li>
        <li style={{ marginBottom: 8 }}>A dry run of the final transaction from your wallet, and warnings for unverified contracts, admin-only functions, proxies and arbitrary calls.</li>
        <li style={{ marginBottom: 8 }}>Swaps built through BTB carry the BTB fee shown in each quote; it is shared with BTB users every Friday.</li>
      </ul>
    </AgentsShell>
  );
}
