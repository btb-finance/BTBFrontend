import type { Metadata } from 'next';
import Link from 'next/link';
import { buildMetadata } from '@/lib/seo/metadata';
import { PROTOCOLS } from '@/lib/mcp/registryData';
import { AgentsShell, styles } from '../shell';

export const metadata: Metadata = buildMetadata({
  title: 'DeFi protocol registry for agents: official contracts and functions',
  description: 'Official, source-linked contract addresses, key functions, APIs and risks for DeFi protocols, served to AI agents through the BTB MCP server.',
  path: '/agents/protocols',
});

export default function ProtocolsPage() {
  const rows = [...PROTOCOLS].sort((a, b) => b.contracts.length - a.contracts.length);
  return (
    <AgentsShell active="/agents/protocols" wide>
      <p style={styles.eyebrow}>Protocol registry</p>
      <h1 style={styles.h1}>Official contracts, functions and risks, for agents.</h1>
      <p style={styles.lead}>
        Agents read this through <code style={styles.inlineCode}>list_protocols</code> and <code style={styles.inlineCode}>get_protocol</code>.
        Every address links to the official page it came from; anything that could not be confirmed is left out.
      </p>
      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Protocol</th><th style={styles.th}>Category</th><th style={styles.th}>Chains</th>
              <th style={styles.th}>Contracts</th><th style={styles.th}>Access</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const chains = [...new Set(p.contracts.map((c) => c.chain))];
              return (
                <tr key={p.slug}>
                  <td style={styles.td}><Link href={`/agents/protocols/${p.slug}`} style={{ color: '#52E3A4', fontWeight: 700, textDecoration: 'none' }}>{p.name}</Link></td>
                  <td style={styles.tdMuted}>{p.category}</td>
                  <td style={styles.tdMuted}>{chains.length ? `${chains.slice(0, 4).join(', ')}${chains.length > 4 ? ` +${chains.length - 4}` : ''}` : (p.chains ?? []).join(', ') || '—'}</td>
                  <td style={styles.tdMuted}>{p.contracts.length}</td>
                  <td style={styles.tdMuted}>{p.agentAccess === 'onchain' ? 'On-chain' : p.agentAccess === 'api' ? 'API' : 'On-chain + API'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p style={styles.footnote}>Researched {[...new Set(PROTOCOLS.map((p) => p.researchedAt).filter(Boolean))].join(', ')}. Missing a protocol? Agents can still use any contract with <code style={styles.inlineCode}>get_abi</code>.</p>
    </AgentsShell>
  );
}
