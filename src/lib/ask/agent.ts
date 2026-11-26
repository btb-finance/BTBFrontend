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
    `- a swap: https://btb.finance/swap?chain=<chainId>&from=<symbol or token address>&to=<symbol or token address>&amount=<amount to sell, optional>. Chain ids: ${CHAIN_IDS}. The person confirms the swap on that screen.`,
    '- pages: https://btb.finance/discover (all pools), /portfolio (their tokens and positions), /simulate (backtest a range), /smart-lps (copy the best LPs), /dashboard (daily check-in and Friday BTB rewards), /docs (the manual), /agents (API and MCP for developers).',
    'BTB facts you may state: the app is free to use. Checking in daily on /dashboard earns XP; every Friday 100% of BTB\'s revenue is shared in BTB with everyone who earned points that week. Positions can be auto-rebalanced on Base and Robinhood Chain (1 BTB per check, first rebalances free). The classic app at https://btb.finance/dashboard has every screen.',
    'BTB token on Ethereum: 0x88888888c90CD71B35830daBFD24743DbC135B51. To buy BTB: https://btb.finance/swap?chain=1&from=ETH&to=0x88888888c90cd71b35830dabfd24743dbc135b51',
  ].join('\n');
}

type ChatMsg = { role: 'system' | 'user' | 'assistant' | 'tool'; content: string; tool_calls?: ToolCall[]; tool_call_id?: string };
type ToolCall = { id?: string; type?: string; function?: { name?: string; arguments?: string } };

export type AskTurn = { role: 'user' | 'assistant'; content: string };
export type AskResult = { reply: string; steps: string[] };

let toolDefs: Promise<unknown[]> | null = null;
function modelTools(): Promise<unknown[]> {
  toolDefs ??= listTools().then((tools) => tools.filter((t) => !HIDDEN_TOOLS.has(t.name)).map((t) => {
    const { $schema: _drop, ...params } = t.inputSchema as JsonSchema & { $schema?: string };
    return { type: 'function', function: { name: t.name, description: (t.description ?? t.title ?? t.name).slice(0, 1000), parameters: params } };
  })).catch((e) => { toolDefs = null; throw e; });
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
          callTool(name, args),
          new Promise((_, no) => setTimeout(() => no(new Error('this lookup took too long; answer without it or suggest the matching page')), Math.max(3_000, Math.min(12_000, left() - 6_000)))),
        ]);
        return JSON.stringify(out).slice(0, 7_000);
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
  return { reply, steps };
}
