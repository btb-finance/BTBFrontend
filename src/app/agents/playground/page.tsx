import type { Metadata } from 'next';
import { Suspense } from 'react';
import { buildMetadata } from '@/lib/seo/metadata';
import { listTools } from '@/lib/mcp/catalog';
import { AgentsShell, styles } from '../shell';
import { Playground } from './Playground';

export const metadata: Metadata = buildMetadata({
  title: 'MCP playground: try BTB agent tools in the browser',
  description: 'Run any BTB MCP tool from the browser and see exactly what an AI agent gets back: pools, protocol contracts, ABIs, contract reads and unsigned transactions.',
  path: '/agents/playground',
});

export const revalidate = 3600;

export default async function PlaygroundPage() {
  const tools = await listTools();
  return (
    <AgentsShell active="/agents/playground" wide>
      <p style={styles.eyebrow}>Playground</p>
      <h1 style={styles.h1}>Call a tool, see what your agent sees.</h1>
      <p style={styles.lead}>
        Pick a tool, fill in the arguments as JSON and run it against the live server. Build tools only return unsigned
        transactions: nothing is signed or sent from here.
      </p>
      <Suspense fallback={<p style={styles.muted}>Loading…</p>}>
        <Playground tools={tools.map(({ name, title, description, readOnly, group, inputSchema }) => ({ name, title, description, readOnly, group, inputSchema }))} />
      </Suspense>
    </AgentsShell>
  );
}
