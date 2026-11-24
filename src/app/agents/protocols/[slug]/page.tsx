import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { buildMetadata } from '@/lib/seo/metadata';
import { PROTOCOLS } from '@/lib/mcp/registryData';
import { AgentsShell, styles } from '../../shell';

export function generateStaticParams() {
  return PROTOCOLS.map((p) => ({ slug: p.slug }));
}
export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = PROTOCOLS.find((x) => x.slug === slug);
  return buildMetadata({
    title: p ? `${p.name} contracts and functions for AI agents` : 'Protocol',
    description: p ? `${p.description} Official ${p.name} contract addresses per chain, key functions, APIs and risks.` : '',
    path: `/agents/protocols/${slug}`,
  });
}

const playground = (tool: string, args: Record<string, unknown>) =>
  `/agents/playground?tool=${tool}&args=${encodeURIComponent(JSON.stringify(args))}`;

export default async function ProtocolPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = PROTOCOLS.find((x) => x.slug === slug);
  if (!p) notFound();
  const byChain = new Map<string, typeof p.contracts>();
  for (const c of p.contracts) byChain.set(c.chain, [...(byChain.get(c.chain) ?? []), c]);
  return (
    <AgentsShell active="/agents/protocols" wide>
      <p style={styles.eyebrow}><Link href="/agents/protocols" style={{ color: 'inherit', textDecoration: 'none' }}>Protocols</Link> / {p.category}</p>
      <h1 style={styles.h1}>{p.name}</h1>
      <p style={styles.lead}>{p.description}</p>
      <p style={styles.body}>
        <span style={styles.pill}>{p.agentAccess === 'onchain' ? 'On-chain' : p.agentAccess === 'api' ? 'API' : 'On-chain + API'}</span>
        <span style={styles.pillMuted}>{p.vm.toUpperCase()}</span>
        <span style={styles.pillMuted}>{p.contracts.length} contracts</span>
        {p.website && <a href={p.website} style={{ ...styles.link, marginLeft: 8 }} rel="noopener noreferrer" target="_blank">Website</a>}
        {p.docs && <> · <a href={p.docs} style={styles.link} rel="noopener noreferrer" target="_blank">Docs</a></>}
      </p>
      <code style={styles.code}>{`get_protocol({ "protocol": "${p.slug}" })`}</code>

      {p.risks?.length ? (<>
        <h2 style={styles.h2}>Risks an agent should know</h2>
        <ul style={{ ...styles.body, paddingLeft: 20 }}>{p.risks.map((r, i) => <li key={i} style={{ marginBottom: 6 }}>{r}</li>)}</ul>
      </>) : null}

      {p.actions?.length ? (<>
        <h2 style={styles.h2}>What an agent can do</h2>
        <div style={styles.tableWrap}><table style={styles.table}><tbody>
          {p.actions.map((a) => (
            <tr key={a.name}><td style={{ ...styles.td, fontWeight: 700, width: 200 }}>{a.name}</td><td style={styles.tdMuted}>{a.description}{a.how ? <><br/><span style={styles.mono}>{a.how}</span></> : null}</td></tr>
          ))}
        </tbody></table></div>
      </>) : null}

      <h2 style={styles.h2}>Contracts</h2>
      {byChain.size === 0 && <p style={styles.body}>No contracts recorded. {p.notes}</p>}
      {[...byChain.entries()].map(([chain, list]) => (
        <section key={chain} style={{ margin: '0 0 22px' }}>
          <h3 style={{ ...styles.h3, textTransform: 'capitalize' }}>{chain}{list[0].chainId ? <span style={styles.muted}> · chain id {list[0].chainId}</span> : null}</h3>
          <div style={styles.tableWrap}><table style={styles.table}>
            <thead><tr><th style={styles.th}>Contract</th><th style={styles.th}>Address</th><th style={styles.th}>Key functions</th><th style={styles.th}>Try</th></tr></thead>
            <tbody>
              {list.map((c) => (
                <tr key={`${c.chain}:${c.address}:${c.name}`}>
                  <td style={styles.td}><strong>{c.name}</strong>{c.role ? <><br/><span style={styles.muted}>{c.role}{c.proxy ? ' · proxy' : ''}</span></> : null}</td>
                  <td style={styles.td}><span style={styles.mono}>{c.address}</span><br/><a href={c.source} style={{ ...styles.link, fontSize: 12 }} rel="noopener noreferrer" target="_blank">source</a></td>
                  <td style={styles.tdMuted}>
                    {(c.keyFunctions ?? []).slice(0, 8).map((f) => (
                      <div key={f.signature} style={{ marginBottom: 4 }}>
                        <span style={f.kind === 'write' ? styles.pill : styles.pillMuted}>{f.kind}</span>
                        <span style={styles.mono}>{f.signature}</span>
                      </div>
                    ))}
                    {(c.keyFunctions?.length ?? 0) > 8 && <span style={styles.muted}>+{(c.keyFunctions?.length ?? 0) - 8} more via get_protocol</span>}
                  </td>
                  <td style={styles.td}>
                    {c.chainId ? <Link href={playground('get_abi', { chain: String(c.chainId), address: c.address })} style={{ color: '#52E3A4', fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}>Full ABI</Link> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </section>
      ))}

      {p.offchainApis?.length ? (<>
        <h2 style={styles.h2}>APIs</h2>
        <div style={styles.tableWrap}><table style={styles.table}><tbody>
          {p.offchainApis.map((a) => (
            <tr key={`${a.name}${a.url}`}><td style={{ ...styles.td, fontWeight: 700, width: 220 }}>{a.name}{a.auth ? <><br/><span style={styles.muted}>auth: {a.auth}</span></> : null}</td>
              <td style={styles.tdMuted}><span style={styles.mono}>{a.url}</span>{a.use ? <><br/>{a.use}</> : null}</td></tr>
          ))}
        </tbody></table></div>
      </>) : null}

      {p.notes && byChain.size > 0 ? (<><h2 style={styles.h2}>Notes</h2><p style={styles.body}>{p.notes}</p></>) : null}
      {p.sources?.length ? (<>
        <h2 style={styles.h2}>Sources</h2>
        <ul style={{ ...styles.muted, paddingLeft: 20 }}>{p.sources.map((s) => <li key={s} style={{ marginBottom: 4 }}><a href={s} style={styles.link} rel="noopener noreferrer" target="_blank">{s}</a></li>)}</ul>
      </>) : null}
      <p style={styles.footnote}>Researched {p.researchedAt ?? 'recently'}. Addresses are copied from the official sources above; check them before moving large amounts.</p>
    </AgentsShell>
  );
}
