import { callTool, listTools, type JsonSchema } from '@/lib/api/v1';

/**
 * The Ask box: a person writes what they want in plain English, a language model picks from the same tools the BTB
 * connector gives outside agents (src/lib/mcp), and answers in a few sentences with buttons that open the right
 * screen. The model never signs anything: actions end in a link to the screen where the user confirms in their wallet.
 */

// Same model and account as the BTB Agent chat (convex/agentChat.ts): z.ai's coding endpoint covers the plan.
const GLM_URL = 'https://api.z.ai/api/coding/paas/v4/chat/completions';
const GLM_MODEL = 'glm-5.3-flash';

/** Transaction builders return raw calldata for outside agents; people get a button to the screen instead. */
const HIDDEN_TOOLS = new Set(['build_swap', 'build_add_liquidity', 'build_tx']);

/** What the person sees while each tool runs, and after, above the answer. */
export const STEP_LABELS: Record<string, string> = {
  top_pools: 'Ranked top pools',
  search_pools: 'Searched pools',
  pool_details: 'Read pool details',
  compare_pools: 'Compared pools',
  best_pools_for: 'Matched pools to your amount',
  chain_summary: 'Summarised chains',
  estimate_lp_earnings: 'Estimated earnings',
  token_safety: 'Checked token safety',
  lp_plan: 'Built an LP plan',
  add_liquidity_link: 'Prepared the deposit',
  wallet_positions: 'Read your positions',
  auto_manage_status: 'Checked auto-management',
  auto_manage_setup: 'Looked up auto-management',
  get_abi: 'Read the contract',
  read_contract: 'Called the contract',
  list_protocols: 'Searched protocols',
  get_protocol: 'Read the protocol',
  find_token: 'Looked up the token',
};

const CHAIN_IDS = 'Ethereum 1, Base 8453, BNB Chain 56, Arbitrum 42161, Optimism 10, Polygon 137, Unichain 130, Robinhood Chain 4663';

function systemPrompt(wallet: string | null): string {
  return [
    'You are the BTB Agent inside btb.finance, a DeFi app for liquidity pools, swaps and positions across many chains. People type what they want in plain English; you work it out with your tools and answer briefly.',
    'Identity: you are the BTB Agent, built by BTB Finance. Never name an AI company or model. Only help with DeFi and the BTB app; politely decline anything else.',
    'Tools are the source of truth. Never invent a pool, APR, price, address or number: call a tool first. Pass chain names the tools accept (base, ethereum, bnb, robinhood and so on).',
    wallet
      ? `The person's connected wallet is ${wallet}. Use it for anything about "my" positions, wallet or holdings.`
      : 'No wallet is connected. For questions about their own positions, ask them to connect a wallet (the Connect button) or to paste an address.',
    '',
    'ANSWER STYLE: plain English, short. Lead with the answer in one or two sentences, then at most five short lines of detail (use "- " bullets for lists of pools or facts, with the key number in **bold**). No tables, no headings, no code. Never use the em dash or en dash; use commas or full stops. No emojis. When suggesting where to put money, add once that this is not financial advice.',
    '',
    'BUTTONS: end with one to three action buttons, each on its own line, written exactly as a markdown link: [Label](URL). Labels are 1 to 4 words, like [Add liquidity](...), [Swap now](...), [Open pool](...). Use only these URLs:',
    '- a pool: the exact btb.finance link that add_liquidity_link or another tool returned. Never build a pool link yourself.',
    `- a swap: https://btb.finance/swap?chain=<chainId>&from=<symbol or token address>&to=<symbol or token address>&amount=<amount to sell, optional>. Chain ids: ${CHAIN_IDS}. The symbol ETH in a swap link means the chain's native coin (ETH on Ethereum, Base, Arbitrum and the other ETH chains, BNB on BNB Chain): use it for those. On BNB Chain, ETH itself is a token, so look it up. For every other token use the contract address that find_token (or another tool) returned for that chain; never write an address from memory. The person confirms the swap on that screen.`,
    '- pages: https://btb.finance/discover (all pools), /portfolio (their tokens and positions), /simulate (backtest a range), /smart-lps (copy the best LPs), /dashboard (daily check-in and Friday BTB rewards), /docs (the manual), /agents (API and MCP for developers).',
    'BTB facts you may state: the app is free to use. Checking in daily on /dashboard earns XP; every Friday 100% of BTB\'s revenue is shared in BTB with everyone who earned points that week. Positions can be auto-rebalanced on Base and Robinhood Chain (1 BTB per check, first rebalances free). The classic app at https://btb.finance/dashboard has every screen.',
    'BTB token on Ethereum: 0x88888888c90CD71B35830daBFD24743DbC135B51. To buy BTB: https://btb.finance/swap?chain=1&from=ETH&to=0x88888888c90cd71b35830dabfd24743dbc135b51',
  ].join('\n');
}

type ChatMsg = { role: 'system' | 'user' | 'assistant' | 'tool'; content: string; tool_calls?: ToolCall[]; tool_call_id?: string };
type ToolCall = { id?: string; type?: string; function?: { name?: string; arguments?: string } };

export type AskTurn = { role: 'user' | 'assistant'; content: string };
export type AskResult = { reply: string; steps: string[] };

// ---- token lookup: the model must never write a contract address from memory ----

/** DEX Screener's chain names for the chain ids swap links use. */
const DS_CHAIN: Record<number, string> = { 1: 'ethereum', 8453: 'base', 56: 'bsc', 42161: 'arbitrum', 10: 'optimism', 137: 'polygon', 130: 'unichain', 4663: 'robinhood' };

const FIND_TOKEN = {
  type: 'function',
  function: {
    name: 'find_token',
    description: 'Look up a token\'s contract address on one chain by symbol or name, with price and liquidity. Call this before any swap button for a token other than ETH, so the link carries the right address.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Symbol or name, e.g. ezETH, PEPE, cbBTC' },
        chainId: { type: 'number', description: `Chain id: ${CHAIN_IDS}` },
      },
      required: ['query', 'chainId'],
    },
  },
};

async function findToken(args: Record<string, unknown>): Promise<string> {
  const query = (typeof args.query === 'string' ? args.query : '').trim().slice(0, 60);
  const chainId = Number(args.chainId);
  const chain = DS_CHAIN[chainId];
  if (!query) return 'Error: missing query';
  if (!chain) return `Error: unknown chainId. Use one of: ${CHAIN_IDS}`;
  // First the swap screen's own catalog (LI.FI): exact symbol on that chain, with flagged tokens refused.
  try {
    const r = await fetch(`https://li.quest/v1/token?chain=${chainId}&token=${encodeURIComponent(query)}`, { signal: AbortSignal.timeout(5_000) });
    if (r.ok) {
      const t = await r.json() as { address?: string; symbol?: string; name?: string; priceUSD?: string; verificationStatus?: string };
      if (t.address && t.verificationStatus !== 'flagged') {
        const address = /^0x0{40}$/.test(t.address) ? 'ETH' : t.address.toLowerCase();
        return JSON.stringify({ tokens: [{ address, symbol: t.symbol, name: t.name, priceUsd: t.priceUSD }] });
      }
    }
  } catch { /* fall back to DEX Screener */ }
  const res = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`, { headers: { 'user-agent': 'curl/8.4.0' }, signal: AbortSignal.timeout(6_000) });
  if (!res.ok) return `Error: lookup failed (HTTP ${res.status})`;
  type Side = { address?: string; symbol?: string; name?: string };
  const d = await res.json() as { pairs?: { chainId?: string; baseToken?: Side; quoteToken?: Side; priceUsd?: string; liquidity?: { usd?: number } }[] };
  const q = query.toLowerCase();
  const found = new Map<string, { address: string; symbol: string; name: string; liquidityUsd: number; priceUsd?: string }>();
  for (const p of d.pairs ?? []) {
    if (p.chainId !== chain) continue;
    for (const [t, price] of [[p.baseToken, p.priceUsd], [p.quoteToken, undefined]] as [Side | undefined, string | undefined][]) {
      if (!t?.address || !(t.symbol?.toLowerCase() === q || t.name?.toLowerCase() === q)) continue;
      const k = t.address.toLowerCase();
      const row = found.get(k) ?? { address: k, symbol: t.symbol ?? '', name: t.name ?? '', liquidityUsd: 0, priceUsd: undefined };
      row.liquidityUsd += p.liquidity?.usd ?? 0;
      row.priceUsd ??= price;
      found.set(k, row);
    }
  }
  const rows = [...found.values()].sort((a, b) => b.liquidityUsd - a.liquidityUsd).slice(0, 3).map((r) => ({ ...r, liquidityUsd: Math.round(r.liquidityUsd) }));
  if (!rows.length) return `No token called "${query}" trades on chain ${chainId}. Say so; do not guess an address.`;
  return JSON.stringify({ note: 'Use the first (most liquid) unless the person names another. Copies with tiny liquidity may be fakes.', tokens: rows });
}

/** Addresses that may appear in a link without coming from a tool. */
const KNOWN = new Set(['0x88888888c90cd71b35830dabfd24743dbc135b51']);

/**
 * A swap link whose token address never appeared in a tool result was written from memory and may be wrong (it once
 * sent "ezETH" to USDC's address). Such a side is dropped, so the Swap screen asks instead of picking a wrong token.
 */
function checkSwapLinks(reply: string, seen: string): string {
  return reply.replace(/https:\/\/btb\.finance\/swap\?[^\s)]+/g, (link) => {
    const u = new URL(link);
    for (const side of ['from', 'to']) {
      const v = u.searchParams.get(side);
      if (v && /^0x[0-9a-fA-F]{40}$/.test(v) && !KNOWN.has(v.toLowerCase()) && !seen.includes(v.toLowerCase())) u.searchParams.delete(side);
    }
    return u.toString();
  });
}

let toolDefs: Promise<unknown[]> | null = null;
function modelTools(): Promise<unknown[]> {
  toolDefs ??= listTools().then((tools) => tools.filter((t) => !HIDDEN_TOOLS.has(t.name)).map((t) => {
    const { $schema: _drop, ...params } = t.inputSchema as JsonSchema & { $schema?: string };
    return { type: 'function', function: { name: t.name, description: (t.description ?? t.title ?? t.name).slice(0, 1000), parameters: params } } as unknown;
  }).concat([FIND_TOKEN])).catch((e) => { toolDefs = null; throw e; });
  return toolDefs;
}

async function glm(key: string, messages: ChatMsg[], tools: unknown[] | null, timeoutMs: number) {
  const res = await fetch(GLM_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'accept-language': 'en-US,en',
      authorization: `Bearer ${key}`,
      // z.ai's firewall turns away the default Node fetch user agent.
      'user-agent': 'curl/8.4.0',
    },
    body: JSON.stringify({
      model: GLM_MODEL, messages, max_tokens: 1200, temperature: 0.3, thinking: { type: 'disabled' },
      ...(tools ? { tools } : {}),
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const body = await res.json().catch(() => ({})) as { choices?: { message?: { content?: string; tool_calls?: ToolCall[] } }[]; error?: { message?: string } };
  if (!res.ok) throw new Error(body?.error?.message ?? `model HTTP ${res.status}`);
  return body.choices?.[0]?.message ?? {};
}

const LEAK = /\b(zhipu|z\.ai|glm|chatglm|openai|chatgpt|gpt-?\d|anthropic|claude|gemini|deepmind|llama|mistral|deepseek|qwen|grok)\b/i;

/** Answers one message, given the earlier turns of the conversation. Finishes within about 21 seconds. */
export async function ask(message: string, history: AskTurn[], wallet: string | null): Promise<AskResult> {
  const key = process.env.GLM_API_KEY;
  if (!key) throw new Error('The agent is not configured on this server yet.');
  const started = Date.now();
  const left = () => 21_000 - (Date.now() - started);
  const tools = await modelTools();
  const messages: ChatMsg[] = [
    { role: 'system', content: systemPrompt(wallet) },
    ...history.slice(-10),
    { role: 'user', content: message },
  ];
  const steps: string[] = [];
  let reply = '';
  for (let round = 0; round < 5; round++) {
    // Short on time, or many rounds in: answer with what it has.
    const final = round === 4 || left() < 7_000;
    const m = await glm(key, messages, final ? null : tools, Math.max(4_000, left() - 500));
    const calls = (m.tool_calls ?? []).slice(0, 4);
    if (calls.length === 0 || final) { reply = m.content ?? ''; break; }
    messages.push({ role: 'assistant', content: m.content ?? '', tool_calls: calls });
    const results = await Promise.all(calls.map(async (c) => {
      const name = c.function?.name ?? '';
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(c.function?.arguments || '{}'); } catch { /* none */ }
      if (HIDDEN_TOOLS.has(name)) return 'Not available here: give the person a swap or pool button instead.';
      const label = STEP_LABELS[name] ?? name.replace(/_/g, ' ');
      if (!steps.includes(label)) steps.push(label);
      try {
        // A slow tool must not run the whole request past the host's limit.
        const out = await Promise.race([
          name === 'find_token' ? findToken(args) : callTool(name, args),
          new Promise((_, no) => setTimeout(() => no(new Error('this lookup took too long; answer without it or suggest the matching page')), Math.max(3_000, Math.min(12_000, left() - 6_000)))),
        ]);
        return (typeof out === 'string' ? out : JSON.stringify(out)).slice(0, 7_000);
      } catch (e) {
        return `Error: ${(e as Error).message}`.slice(0, 500);
      }
    }));
    calls.forEach((c, i) => messages.push({ role: 'tool', tool_call_id: c.id ?? '', content: results[i] }));
  }
  reply = reply.trim();
  if (!reply) reply = 'I could not finish that one. Try asking again, a little more specifically.';
  if (LEAK.test(reply)) reply = 'I am the BTB Agent, built by BTB Finance. Ask me about pools, swaps, tokens or your positions.';
  reply = reply.replace(/\s*[—–]\s*/g, ', ').replace(/, ,/g, ',');
  const seen = messages.filter((m) => m.role === 'tool' || m.role === 'assistant').map((m) => m.content).join(' ').toLowerCase();
  reply = checkSwapLinks(reply, seen);
  return { reply, steps };
}
