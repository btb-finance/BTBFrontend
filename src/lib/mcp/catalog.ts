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

export const TOOL_GROUPS = ['Yield, lending & staking', 'Pools & research', 'Tokens & prices', 'Wallets & positions', 'Build transactions', 'Protocols', 'Any contract'] as const;

function groupFor(name: string): string {
  if (name.startsWith('build_') || name === 'sign_status' || name === 'bridge_status' || name === 'add_liquidity_link') return 'Build transactions';
  if (['compare_yield', 'lending_rates', 'staking_rates'].includes(name)) return 'Yield, lending & staking';
  if (['find_token', 'quote_swap', 'token_safety', 'quick_token_check'].includes(name)) return 'Tokens & prices';
  if (['wallet_positions', 'wallet_tokens', 'tx_status'].includes(name) || name.startsWith('auto_manage')) return 'Wallets & positions';
  if (name === 'get_abi' || name === 'read_contract') return 'Any contract';
  if (name === 'list_protocols' || name === 'get_protocol') return 'Protocols';
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
    // Build tools never send anything (so they are marked read-only for clients), but they do make transactions.
    readOnly: !String(t.name).startsWith('build_') && (t.annotations as { readOnlyHint?: boolean } | undefined)?.readOnlyHint !== false,
    group: groupFor(String(t.name)),
    inputSchema: t.inputSchema ?? {},
  }));
}
