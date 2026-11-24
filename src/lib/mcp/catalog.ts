import { createMcpHandler } from '@modelcontextprotocol/server';
import { buildServer } from './server';

/** The public address agents connect to. One place, so every page and snippet stays in step. */
export const MCP_PUBLIC_URL = 'https://btb.finance/api/mcp';

export interface ToolInfo {
  name: string;
  title: string;
  description: string;
  readOnly: boolean;
  group: string;
  inputSchema: unknown;
}

export const TOOL_GROUPS = ['Pools & research', 'Wallets & positions', 'Protocols', 'Any contract', 'Build transactions'] as const;

function groupFor(name: string): string {
  if (name.startsWith('build_')) return 'Build transactions';
  if (name === 'get_abi' || name === 'read_contract') return 'Any contract';
  if (name === 'list_protocols' || name === 'get_protocol') return 'Protocols';
  if (name === 'wallet_positions' || name.startsWith('auto_manage')) return 'Wallets & positions';
  return 'Pools & research';
}

/** The live tool list, read from the MCP server itself in-process, so pages never drift from what agents get. */
export async function listTools(): Promise<ToolInfo[]> {
  const handler = createMcpHandler(() => buildServer(), { responseMode: 'json' });
  const res = await handler.fetch(new Request('http://localhost/mcp', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
  }));
  const raw = await res.text();
  const line = raw.split('\n').find((l) => l.startsWith('data:'));
  const json = JSON.parse(line ? line.slice(5) : raw) as { result?: { tools?: Record<string, unknown>[] } };
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  return (json.result?.tools ?? []).map((t) => ({
    name: str(t.name),
    title: str(t.title) || str(t.name),
    description: str(t.description),
    readOnly: (t.annotations as { readOnlyHint?: boolean } | undefined)?.readOnlyHint !== false,
    group: groupFor(String(t.name)),
    inputSchema: t.inputSchema ?? {},
  }));
}
