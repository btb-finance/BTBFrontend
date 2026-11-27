import { createMcpHandler } from '@modelcontextprotocol/server';
import { buildServer } from '@/lib/mcp/server';

// The REST API (src/app/api/v1) is a thin layer over the BTB connector's tools: each endpoint runs the same MCP
// tool in-process, so REST and MCP always give the same answer, and a tool added to the connector is reachable at
// /api/v1/tools/<name> at once. ROUTES below adds readable paths for the common ones and drives the OpenAPI spec.

const handler = createMcpHandler(() => buildServer(), { responseMode: 'json', onerror: (e) => console.error('[api/v1]', e) });

export interface ToolInfo {
  name: string;
  title?: string;
  description?: string;
  inputSchema: JsonSchema;
  annotations?: { readOnlyHint?: boolean };
}
export interface JsonSchema {
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  anyOf?: JsonSchema[];
  description?: string;
  enum?: unknown[];
  [k: string]: unknown;
}

let id = 0;
async function rpc(method: string, params: unknown): Promise<{ result?: unknown; error?: { message: string } }> {
  const res = await handler.fetch(new Request('http://local/api/mcp', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }),
  }));
  // Plain JSON, or one Server-Sent Event carrying it ("event: message\ndata: {…}"), depending on the SDK's choice.
  const text = await res.text();
  if (text.trimStart().startsWith('{')) return JSON.parse(text);
  const data = text.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim()).filter(Boolean).pop();
  if (!data) throw new Error(`MCP gave no answer (HTTP ${res.status})`);
  return JSON.parse(data);
}

let toolsCache: Promise<ToolInfo[]> | null = null;
export function listTools(): Promise<ToolInfo[]> {
  toolsCache ??= rpc('tools/list', {}).then((r) => {
    if (!r.result) throw new Error(r.error?.message ?? 'tools/list failed');
    return (r.result as { tools: ToolInfo[] }).tools;
  }).catch((e) => { toolsCache = null; throw e; });
  return toolsCache;
}

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

/** Runs one tool and returns its JSON result. Tool errors become 400s with the tool's own message. */
export async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const tools = await listTools();
  if (!tools.some((t) => t.name === name)) throw new ApiError(404, 'unknown_tool', `No tool "${name}". GET /api/v1 lists them.`);
  const r = await rpc('tools/call', { name, arguments: args });
  if (r.error) throw new ApiError(400, 'invalid_arguments', r.error.message);
  const out = r.result as { content?: { type: string; text?: string }[]; isError?: boolean };
  const text = out.content?.find((c) => c.type === 'text')?.text ?? '';
  if (out.isError) {
    const msg = text.replace(/^MCP error -?\d+: /, '');
    const notFound = /not found|not in the BTB registry|No function/i.test(msg);
    const invalid = /^Input validation error/i.test(msg);
    throw new ApiError(notFound ? 404 : 400, notFound ? 'not_found' : invalid ? 'invalid_arguments' : 'tool_error', msg);
  }
  try { return JSON.parse(text); } catch { return { text }; }
}

// ---- readable routes ----

export interface Route {
  method: 'GET' | 'POST';
  /** With {params}, e.g. /pools/{chain}/{pool}. */
  path: string;
  tool: string;
  summary: string;
  /** Fixed arguments, or renames from query/path names to tool argument names. */
  fixed?: Record<string, unknown>;
  rename?: Record<string, string>;
  tag: string;
}

export const ROUTES: Route[] = [
  { method: 'GET', path: '/pools', tool: 'top_pools', tag: 'Pools', summary: 'Top liquidity pools, ranked by APR, TVL, volume or fees, with risk grades.' },
  { method: 'GET', path: '/pools/search', tool: 'search_pools', tag: 'Pools', summary: 'Find pools by token symbol, pair or address.', rename: { q: 'query' } },
  { method: 'GET', path: '/pools/best', tool: 'best_pools_for', tag: 'Pools', summary: 'Best pools for an amount in USD and a risk limit.' },
  { method: 'GET', path: '/pools/compare', tool: 'compare_pools', tag: 'Pools', summary: 'Compare 2 to 6 pools side by side (pools=base:0x…,ethereum:0x…).' },
  { method: 'GET', path: '/pools/{chain}/{pool}', tool: 'pool_details', tag: 'Pools', summary: 'One pool in full: APRs, measured range APR, TVL, volume, fees, risk and tokens.' },
  { method: 'GET', path: '/pools/{chain}/{pool}/earnings', tool: 'estimate_lp_earnings', tag: 'Pools', summary: 'Estimated earnings for an amount over some days.' },
  { method: 'GET', path: '/pools/{chain}/{pool}/link', tool: 'add_liquidity_link', tag: 'Pools', summary: 'A btb.finance link where a person adds liquidity to this pool with their own wallet.' },
  { method: 'GET', path: '/plan', tool: 'lp_plan', tag: 'Pools', summary: 'An LP plan: an amount in USD spread over several pools.' },
  { method: 'GET', path: '/chains', tool: 'chain_summary', tag: 'Pools', summary: 'Every chain BTB tracks, with pool counts, TVL and median APRs.' },
  { method: 'GET', path: '/chains/{chain}', tool: 'chain_summary', tag: 'Pools', summary: 'One chain: pool counts, TVL, median APRs and its top DEXes.' },
  { method: 'GET', path: '/tokens/{chain}/{token}/safety', tool: 'token_safety', tag: 'Tokens', summary: 'Token safety grade: honeypot, taxes, proxy, owner powers, locked liquidity.' },
  { method: 'GET', path: '/tokens/find', tool: 'find_token', tag: 'Tokens', summary: 'A token\'s contract address on a chain by symbol or name (q=USDC&chain=base).', rename: { q: 'query' } },
  { method: 'GET', path: '/quote', tool: 'quote_swap', tag: 'Tokens', summary: 'Live swap quote after the BTB fee, in USD, with a thin-pool warning (chain, tokenIn, tokenOut, amount).' },
  { method: 'GET', path: '/wallets/{address}/tokens', tool: 'wallet_tokens', tag: 'Wallets', summary: 'Token balances a wallet holds on every main chain, with USD values; search finds one token.', rename: { address: 'wallet' } },
  { method: 'GET', path: '/yield', tool: 'compare_yield', tag: 'Tokens', summary: 'Every way to earn on a token ranked side by side: lending, vaults, savings, staking, stable LPs (token=USDC&chain=base).' },
  { method: 'GET', path: '/lending', tool: 'lending_rates', tag: 'Tokens', summary: 'Live lending and savings APYs (Aave, Compound, Morpho, Spark…) by token and chain.' },
  { method: 'GET', path: '/staking', tool: 'staking_rates', tag: 'Tokens', summary: 'ETH staking yields per liquid-staking token (stETH, weETH, rETH, cbETH...).' },
  { method: 'GET', path: '/tokens/{chain}/{token}/quick-check', tool: 'quick_token_check', tag: 'Tokens', summary: 'Free basic token safety check (honeypot, taxes, owner powers).' },
  { method: 'GET', path: '/tx/{chain}/{hash}', tool: 'tx_status', tag: 'Wallets', summary: 'Whether a transaction confirmed, its fee, and the tokens that moved.' },
  { method: 'GET', path: '/wallets/{address}/positions', tool: 'wallet_positions', tag: 'Wallets', summary: 'Every LP position a wallet holds, with value, range and unclaimed fees.' },
  { method: 'GET', path: '/wallets/{address}/auto-manage', tool: 'auto_manage_status', tag: 'Wallets', summary: 'Positions BTB auto-manages for this wallet.' },
  { method: 'GET', path: '/auto-manage/setup', tool: 'auto_manage_setup', tag: 'Wallets', summary: 'How to turn on BTB auto-management, with the link.' },
  { method: 'GET', path: '/protocols', tool: 'list_protocols', tag: 'Protocols', summary: 'Protocols in the BTB registry, by category, chain or text.' },
  { method: 'GET', path: '/protocols/{protocol}', tool: 'get_protocol', tag: 'Protocols', summary: 'One protocol: official contracts per chain, key functions, APIs and risks.' },
  { method: 'GET', path: '/contracts/{chain}/{address}/abi', tool: 'get_abi', tag: 'Contracts', summary: 'What any contract can do: functions, inputs, outputs and warning flags.' },
  { method: 'POST', path: '/contracts/{chain}/{address}/read', tool: 'read_contract', tag: 'Contracts', summary: 'Call a read function on any contract. Body: {"function": "balanceOf", "args": ["0x…"]}.' },
  { method: 'POST', path: '/build/swap', tool: 'build_swap', tag: 'Build', summary: 'Unsigned swap transactions (approval if needed, then the swap) with a quote and a dry run.' },
  { method: 'POST', path: '/build/liquidity', tool: 'build_add_liquidity', tag: 'Build', summary: 'Unsigned transactions to open a concentrated-liquidity position, with a dry run.' },
  { method: 'POST', path: '/build/lend', tool: 'build_lend', tag: 'Build', summary: 'Lend a token on Aave V3: the approval only if needed, then the supply, with the live rate, health factor and a signLink.' },
  { method: 'POST', path: '/build/withdraw', tool: 'build_withdraw', tag: 'Build', summary: 'Withdraw a lent token from Aave V3 ("max" for all), with what is withdrawable now and a signLink.' },
  { method: 'POST', path: '/build/zap', tool: 'build_zap_liquidity', tag: 'Build', summary: 'Add liquidity from one token: swap the right share, then open the position, as one signLink.' },
  { method: 'POST', path: '/sign/status', tool: 'sign_status', tag: 'Build', summary: 'Which steps of a signLink the person signed, each checked on chain. Body: {"signLink": "https://btb.finance/sign#…"}.' },
  { method: 'POST', path: '/build/vault-deposit', tool: 'build_vault_deposit', tag: 'Build', summary: 'Deposit into a Morpho vault (ERC-4626): exact approval if needed, then the deposit, as one signLink.' },
  { method: 'POST', path: '/build/vault-withdraw', tool: 'build_vault_withdraw', tag: 'Build', summary: 'Withdraw from a Morpho vault ("max" redeems everything), as a signLink.' },
  { method: 'POST', path: '/build/bridge', tool: 'build_bridge', tag: 'Build', summary: 'Sell a token on one chain, receive any token on another (LI.FI), as one signLink.' },
  { method: 'GET', path: '/bridge/status/{hash}', tool: 'bridge_status', tag: 'Build', summary: 'Whether a cross-chain transfer arrived, with the receiving transaction.' },
  { method: 'POST', path: '/build/tx', tool: 'build_tx', tag: 'Build', summary: 'Encode any contract function into an unsigned transaction, with a dry run and warnings.' },
];

/** Matches a path (after /api/v1) to a route, returning its path parameters. */
export function matchRoute(method: string, path: string): { route: Route; params: Record<string, string> } | null {
  const parts = path.split('/').filter(Boolean);
  let fallback: { route: Route; params: Record<string, string> } | null = null;
  for (const route of ROUTES) {
    const want = route.path.split('/').filter(Boolean);
    if (want.length !== parts.length) continue;
    const params: Record<string, string> = {};
    let ok = true;
    let literal = true;
    for (let i = 0; i < want.length && ok; i++) {
      const w = want[i];
      if (w.startsWith('{')) { params[w.slice(1, -1)] = decodeURIComponent(parts[i]); literal = false; }
      else ok = w === parts[i];
    }
    if (!ok) continue;
    // GET routes also answer POST with a JSON body, so agents can always POST.
    if (route.method !== method && !(route.method === 'GET' && method === 'POST')) continue;
    if (literal) return { route, params };
    fallback ??= { route, params };
  }
  return fallback;
}

// ---- query strings → typed arguments, from each tool's JSON schema ----

function typesOf(s: JsonSchema | undefined): string[] {
  if (!s) return [];
  if (Array.isArray(s.type)) return s.type;
  if (s.type) return [s.type];
  return (s.anyOf ?? []).flatMap(typesOf);
}

function coerce(value: string, schema: JsonSchema | undefined): unknown {
  const types = typesOf(schema);
  if (value === 'null' && types.includes('null')) return null;
  if (types.includes('array')) {
    if (value.trim().startsWith('[')) { try { return JSON.parse(value); } catch { /* fall through */ } }
    return value.split(',').map((x) => x.trim()).filter(Boolean);
  }
  if ((types.includes('number') || types.includes('integer')) && !types.includes('string')) {
    const n = Number(value);
    return Number.isFinite(n) ? n : value;
  }
  if (types.includes('boolean') && !types.includes('string')) return value === 'true' || value === '1';
  if (types.includes('object')) { try { return JSON.parse(value); } catch { return value; } }
  return value;
}

/** Builds a tool's arguments from path parameters, the query string and (for POST) the JSON body. */
export function toolArgs(tool: ToolInfo, route: Route | null, params: Record<string, string>, query: URLSearchParams, body: Record<string, unknown> | null) {
  const props = tool.inputSchema.properties ?? {};
  const rename = route?.rename ?? {};
  const args: Record<string, unknown> = {};
  for (const [k, v] of query) {
    if (k === 'api_key') continue;
    const name = rename[k] ?? k;
    args[name] = coerce(v, props[name]);
  }
  for (const [k, v] of Object.entries(params)) {
    const name = rename[k] ?? k;
    args[name] = coerce(v, props[name]);
  }
  if (body) for (const [k, v] of Object.entries(body)) args[rename[k] ?? k] = v;
  return { ...args, ...(route?.fixed ?? {}) };
}
