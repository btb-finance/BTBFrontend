import { callTool, listTools, type JsonSchema } from '@/lib/api/v1';

/**
 * The Ask box: a person writes what they want in plain English, a language model picks from the same tools the BTB
 * connector gives outside agents (src/lib/mcp), and answers in a few sentences with buttons that open the right
 * screen. The model never signs anything: actions end in a link to the screen where the user confirms in their
 * wallet, or, for protocol calls (Aave supply, Lido stake...), in transactions built here that the page shows as
 * numbered steps for the person's own wallet to sign.
 */

// Same model and account as the BTB Agent chat (convex/agentChat.ts): z.ai's coding endpoint covers the plan.
const GLM_URL = 'https://api.z.ai/api/coding/paas/v4/chat/completions';
const GLM_MODEL = 'glm-5.3-flash';

/** LP deposits have their own screen (range picker), so people get a button there instead of raw transactions. */
const HIDDEN_TOOLS = new Set(['build_add_liquidity']);
/** Tools that build transactions: only with a connected wallet, and only through the checks below. */
const BUILD_TOOLS = new Set(['build_tx', 'build_swap']);

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
  quote_swap: 'Got a live quote',
  build_tx: 'Built a transaction',
  build_swap: 'Built the swap',
  build_bridge: 'Built the bridge',
  bridge_status: 'Checked the bridge',
  build_lend: 'Built the deposit',
  build_withdraw: 'Built the withdrawal',
  build_zap_liquidity: 'Built the deposit',
  build_vault_deposit: 'Built the vault deposit',
  build_vault_withdraw: 'Built the withdrawal',
  sign_status: 'Checked what you signed',
  compare_yield: 'Compared yields',
  lending_rates: 'Checked lending rates',
  staking_rates: 'Checked staking rates',
  quick_token_check: 'Checked the token',
  wallet_tokens: 'Checked your tokens',
  tx_status: 'Checked the transaction',
};

const CHAIN_IDS = 'Ethereum 1, Base 8453, BNB Chain 56, Arbitrum 42161, Optimism 10, Polygon 137, Unichain 130, Robinhood Chain 4663';

function systemPrompt(wallet: string | null): string {
  return [
    'You are the BTB Agent inside btb.finance, a DeFi app for liquidity pools, swaps and positions across many chains. People type what they want in plain English; you work it out with your tools and answer briefly.',
    'Identity: you are the BTB Agent, built by BTB Finance. Never name an AI company or model. Only help with DeFi and the BTB app; politely decline anything else.',
    'Tools are the source of truth. Never invent a pool, APR, price, address or number: call a tool first. Never do your own price or USD arithmetic: quote the numbers the tools return (priceUsd, getUsd, rate). Pass chain names the tools accept (base, ethereum, bnb, robinhood and so on).',
    wallet
      ? `The person's connected wallet is ${wallet}. Use it for anything about "my" positions, wallet or holdings.`
      : 'No wallet is connected. For questions about their own positions, ask them to connect a wallet (the Connect button) or to paste an address.',
    '',
    'ANSWER STYLE: plain English, short. Lead with the answer in one or two sentences, then at most five short lines of detail (use "- " bullets for lists of pools or facts, with the key number in **bold**). No tables, no headings, no code. Never use the em dash or en dash; use commas or full stops. No emojis. When suggesting where to put money, add once that this is not financial advice.',
    '',
    'BUTTONS: end with one to three action buttons, each on its own line, written exactly as a markdown link: [Label](URL). Labels are 1 to 4 words, like [Add liquidity](...), [Swap now](...), [Open pool](...). Use only these URLs:',
    '- a pool: the exact btb.finance link that add_liquidity_link or another tool returned. Never build a pool link yourself.',
    wallet
      ? '- "Sell all my X" or "my X": call wallet_tokens with search X to see which chain it is on and how much; then build_swap with amount "max" on that chain. Never assume the chain.'
      : '',
    wallet
      ? '- SWAPS with a wallet connected: any request to swap, buy, sell or convert (even "quote" or "try again") means find_token for each token that is not ETH, then build_swap, which includes the quote; use quote_swap only for questions like "how much would I get" or "what is the price" with no wish to swap. build_swap and the page shows Approve and Swap buttons to sign right here. Mention only the steps that were built (selling ETH needs no approval). Add no other buttons except optionally one [Open in Swap](link) using the swap link below.'
      : '- SWAPS without a wallet: give the swap link below; the person connects and confirms there.',
    `- a swap: https://btb.finance/swap?chain=<chainId>&from=<symbol or token address>&to=<symbol or token address>&amount=<amount to sell, optional>. Chain ids: ${CHAIN_IDS}. The symbol ETH in a swap link means the chain's native coin (ETH on Ethereum, Base, Arbitrum and the other ETH chains, BNB on BNB Chain): use it for those. On BNB Chain, ETH itself is a token, so look it up. For every other token use the contract address that find_token (or another tool) returned for that chain; never write an address from memory. The person confirms the swap on that screen.`,
    '- pages: https://btb.finance/discover (all pools), /portfolio (their tokens and positions), /simulate (backtest a range), /smart-lps (copy the best LPs), /dashboard (daily check-in and Friday BTB rewards), /docs (the manual), /agents (API and MCP for developers).',
    wallet
      ? 'VAULTS (Morpho, "stake" or "deposit" into a vault): compare_yield gives the vault address; then build_vault_deposit (or build_vault_withdraw) with it. Never build vault deposits with build_tx.'
      : '',
    wallet
      ? 'DOING THINGS ON A PROTOCOL (supply or withdraw on Aave, stake on Lido, deposit in a vault and so on): build the transactions with build_tx, and the page shows them as numbered buttons the person signs in their own wallet. Never send them to another app or tell them to do it themselves when you can build it. Be quick: in your first round call get_protocol (official contract on that chain; never use an address from memory) and find_token (the token and its decimals) together. Skip get_abi for well-known functions (ERC-20 approve, Aave supply and withdraw, Lido submit). Then, in the very next round, call build_tx for each step in order (write no text before they are built): first approve(spender, exact amount) on the token when an ERC-20 is spent, then the action. Amounts are integers in base units (100 USDC with 6 decimals is "100000000"). Never approve an unlimited amount. For Aave V3 supply the arguments are (asset, amount, onBehalfOf = the connected wallet, referralCode 0). After building, write one short line per step and do not paste calldata. A dry run that reverts only because the approval is not on chain yet is normal; say step 2 works once step 1 is confirmed. The page already shows the steps: no link buttons are needed for them.'
      : 'DOING THINGS ON A PROTOCOL (supply, stake, deposit): you can build the transactions for the person to sign, but only with a connected wallet. Ask them to connect one first (the Connect wallet button), then ask again.',
    'When a build tool returns a signLink, end your answer with it as a button on its own line: [Sign now](the signLink exactly).',
    'BTB facts you may state: the app is free to use. Checking in daily on /dashboard earns XP; every Friday 100% of BTB\'s revenue is shared in BTB with everyone who earned points that week. Positions can be auto-rebalanced on Base and Robinhood Chain (1 BTB per check, first rebalances free). The classic app at https://btb.finance/dashboard has every screen.',
    'BTB token on Ethereum: 0x88888888c90CD71B35830daBFD24743DbC135B51. To buy BTB: https://btb.finance/swap?chain=1&from=ETH&to=0x88888888c90cd71b35830dabfd24743dbc135b51',
  ].join('\n');
}

type ChatMsg = { role: 'system' | 'user' | 'assistant' | 'tool'; content: string; tool_calls?: ToolCall[]; tool_call_id?: string };
type ToolCall = { id?: string; type?: string; function?: { name?: string; arguments?: string } };

export type AskTurn = { role: 'user' | 'assistant'; content: string };
/** One transaction for the person's wallet, built by build_tx. */
export type TxStep = {
  label: string; chainId: number; to: string; data: string; value: string; fn: string;
  dryRun: 'passed' | 'after-previous' | 'reverted' | 'skipped' | 'none'; dryRunNote?: string; warnings: string[];
  /** Swaps: when it was built, and what to rebuild it from at signing time so the quote is fresh. */
  builtAt?: number;
  swap?: SwapParams;
  /** The wallet the step was built for: only it can sign (the dry run and approvals are for this address). */
  from?: string;
};
export type SwapParams = { chainId: number; tokenIn: string; tokenOut: string; amount: string; slippageBps: number };
export type AskResult = { reply: string; steps: string[]; txs?: TxStep[] };

// Token lookup, quotes and balances are BTB connector tools (src/lib/mcp/tokens.ts), shared with every outside agent.

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
function allModelTools(): Promise<unknown[]> {
  toolDefs ??= listTools().then((tools) => tools.filter((t) => !HIDDEN_TOOLS.has(t.name)).map((t) => {
    const { $schema: _drop, ...params } = t.inputSchema as JsonSchema & { $schema?: string };
    if (t.name === 'build_swap') {
      // Always for and to the connected wallet.
      const { wallet: _w, recipient: _r, ...props } = params.properties ?? {};
      params.properties = props;
      params.required = (params.required ?? []).filter((r) => r !== 'wallet');
      return { type: 'function', function: { name: t.name, description: 'Build a swap for the connected wallet to sign right here: the exact approval if needed, then the swap at the best KyberSwap price, with the quote and a dry run. The page shows it as step buttons.', parameters: params } } as unknown;
    }
    if (t.name === 'build_tx') {
      // The wallet is always the connected one (filled in here, never by the model); the label names the button.
      const { wallet: _w, ...props } = params.properties ?? {};
      params.properties = { ...props, label: { type: 'string', description: 'Button text, 2 to 4 words, e.g. "Approve USDC", "Supply to Aave".' } };
      params.required = [...(params.required ?? []).filter((r) => r !== 'wallet'), 'label'];
      return { type: 'function', function: { name: t.name, description: 'Build one transaction for the connected wallet to sign: any write function of a contract, with a dry run. The page shows it to the person as a numbered step button.', parameters: params } } as unknown;
    }
    return { type: 'function', function: { name: t.name, description: (t.description ?? t.title ?? t.name).slice(0, 1000), parameters: params } } as unknown;
  })).catch((e) => { toolDefs = null; throw e; });
  return toolDefs;
}
/** build_tx only with a connected wallet to build for. */
async function modelTools(wallet: string | null): Promise<unknown[]> {
  const all = await allModelTools();
  return wallet ? all : all.filter((t) => !BUILD_TOOLS.has((t as { function: { name: string } }).function.name));
}

const MAX_UINT_HALF = 2n ** 255n;

/** Turns a build tool's answer (transactions, dry run, signLink) into the page's sign card steps. */
function collectSteps(out: unknown, txs: TxStep[], signLinks: string[]) {
  const r = out as { wallet?: string; chainId?: number; transactions?: { label: string; to: string; data: string; value: string }[]; simulation?: { status: string; reason?: string }; warnings?: string[]; signLink?: string };
  if (!r || !Array.isArray(r.transactions) || !r.chainId) return;
  const n = r.transactions.length;
  r.transactions.forEach((t, i) => {
    const last = i === n - 1;
    const sim = last ? r.simulation : undefined;
    txs.push({
      label: t.label, chainId: r.chainId!, to: t.to, data: t.data, value: t.value, fn: t.label,
      dryRun: !sim ? 'none' : sim.status === 'passed' ? 'passed' : n > 1 && sim.status !== 'reverted' ? 'after-previous' : sim.status === 'skipped' && n > 1 ? 'after-previous' : 'reverted',
      dryRunNote: sim?.reason, warnings: last ? r.warnings ?? [] : [], ...(r.wallet ? { from: r.wallet } : {}),
    });
  });
  if (r.signLink) signLinks.push(r.signLink);
}
const isTokenArg = (v: string) => /^eth$/i.test(v) || /^0x[0-9a-fA-F]{40}$/.test(v);

type BuiltSwap = {
  chainId: number; balanceOk: boolean;
  quote: { amountIn: string; symbolIn: string; amountOut: string; symbolOut: string; amountOutUsd: number; priceImpactPct: number; gasUsd: number; route: string };
  tokenOutSafety: { score: number; honeypot: boolean; flags: string[] } | null;
  simulation: { status: 'passed' | 'reverted' | 'skipped'; reason?: string };
  transactions: { to: string; data: string; value: string; label: string }[];
};

/** build_swap for the wallet, as page steps. Also used to rebuild a swap with a fresh quote when it is signed. */
export async function swapSteps(p: SwapParams, wallet: string): Promise<{ steps: TxStep[]; built: BuiltSwap }> {
  const built = await callTool('build_swap', {
    chain: String(p.chainId), tokenIn: p.tokenIn, tokenOut: p.tokenOut, amount: p.amount, wallet, slippageBps: p.slippageBps,
  }) as BuiltSwap;
  const n = built.transactions.length;
  const now = Date.now();
  const steps = built.transactions.map((t, i): TxStep => {
    const last = i === n - 1;
    const sim = built.simulation;
    return {
      from: wallet,
      label: last ? `Swap ${built.quote.amountIn} ${built.quote.symbolIn} for ${built.quote.amountOut} ${built.quote.symbolOut}` : t.label.replace(/ for the KyberSwap router$/, ''),
      chainId: built.chainId, to: t.to, data: t.data, value: t.value,
      fn: last ? `KyberSwap via ${built.quote.route}` : 'approve(address,uint256)',
      // Skipped with a balance means it waits for the approval; skipped without one means the wallet is short.
      dryRun: !last ? 'none' : sim.status === 'passed' ? 'passed' : n > 1 && sim.status === 'skipped' && built.balanceOk ? 'after-previous' : 'reverted',
      dryRunNote: last ? sim.reason : undefined,
      warnings: last && built.tokenOutSafety?.honeypot ? ['The token you buy looks like a honeypot: you may not be able to sell it.'] : [],
      ...(last ? { builtAt: now, swap: p } : {}),
    };
  });
  return { steps, built };
}

async function buildSwapStep(args: Record<string, unknown>, wallet: string, seen: string, txs: TxStep[]): Promise<string> {
  const tokenIn = typeof args.tokenIn === 'string' ? args.tokenIn.trim() : '';
  const tokenOut = typeof args.tokenOut === 'string' ? args.tokenOut.trim() : '';
  const amount = typeof args.amount === 'string' || typeof args.amount === 'number' ? String(args.amount).trim() : '';
  const chainArg = typeof args.chain === 'string' || typeof args.chain === 'number' ? String(args.chain) : '';
  const chainId = Number(chainArg) || ({ ethereum: 1, base: 8453, bnb: 56, bsc: 56, arbitrum: 42161, optimism: 10, polygon: 137, unichain: 130, robinhood: 4663 } as Record<string, number>)[chainArg.toLowerCase().split(' ')[0]];
  if (!chainId) return `Error: chain must be one of: ${CHAIN_IDS}`;
  if (!isTokenArg(tokenIn) || !isTokenArg(tokenOut)) return 'Error: tokenIn and tokenOut must be "ETH" or a contract address from find_token.';
  for (const t of [tokenIn, tokenOut]) {
    if (!/^eth$/i.test(t) && !KNOWN.has(t.toLowerCase()) && !seen.includes(t.toLowerCase())) return 'Error: that token address did not come from a tool. Look it up with find_token first.';
  }
  if (!/^(\d+(\.\d+)?|max)$/.test(amount)) return 'Error: amount must be a plain number like "1" or "0.25", or "max" for the whole balance of a token.';
  // The model may ask for more slippage, never past 3%.
  const slippageBps = Math.min(300, Math.max(10, Number(args.slippageBps) || 50));
  const { steps, built } = await swapSteps({ chainId, tokenIn, tokenOut, amount, slippageBps }, wallet);
  txs.push(...steps);
  return JSON.stringify({
    built: steps.length > 1 ? `2 steps shown to the person: approve the token, then swap` : '1 step shown to the person: the swap (no approval needed)',
    quote: built.quote, balanceOk: built.balanceOk, dryRun: built.simulation, tokenOutSafety: built.tokenOutSafety,
    note: 'Do not paste calldata. Summarise the quote in one or two lines and mention only the steps listed in "built". If balanceOk is false, say they do not hold enough. Add no link buttons except optionally [Open in Swap](swap link).',
  });
}

/** Runs build_tx for the connected wallet, after checks the model cannot talk its way past. */
async function buildStep(args: Record<string, unknown>, wallet: string, seen: string, txs: TxStep[]): Promise<string> {
  const address = typeof args.address === 'string' ? args.address.toLowerCase() : '';
  if (!/^0x[0-9a-f]{40}$/.test(address)) return 'Error: address must be the contract\'s 0x address.';
  if (!KNOWN.has(address) && !seen.includes(address)) {
    return 'Error: that contract address did not come from a tool. Get the official address with get_protocol (or find_token for a token) first, then build again.';
  }
  const fn = typeof args.function === 'string' ? args.function : '';
  const list = Array.isArray(args.args) ? args.args : [];
  if (/^(approve|increaseAllowance)\b/i.test(fn) && list.some((x) => { try { return BigInt(String(x)) >= MAX_UINT_HALF; } catch { return false; } })) {
    return 'Error: unlimited approvals are not allowed. Approve the exact amount in base units.';
  }
  const label = (typeof args.label === 'string' && args.label.trim() ? args.label.trim() : fn).slice(0, 40);
  const { label: _l, ...rest } = args;
  const out = await callTool('build_tx', { ...rest, wallet }) as {
    chainId: number; function: string; simulation: { status: TxStep['dryRun']; reason?: string };
    transactions: { to: string; data: string; value: string }[]; warnings: string[];
  };
  const tx = out.transactions[0];
  const afterApproval = out.simulation.status === 'reverted' && txs.some((t) => /^approve|increaseAllowance/i.test(t.fn));
  txs.push({
    from: wallet, label, chainId: out.chainId, to: tx.to, data: tx.data, value: tx.value, fn: out.function,
    dryRun: afterApproval ? 'after-previous' : out.simulation.status,
    dryRunNote: out.simulation.reason,
    // The generic "review it" line is shown once by the page itself.
    warnings: out.warnings.filter((w) => !w.startsWith('Generic call')),
  });
  return JSON.stringify({
    built: `step ${txs.length}: ${label}`, function: out.function, chainId: out.chainId,
    dryRun: out.simulation.status, dryRunReason: out.simulation.reason ?? null, warnings: out.warnings.slice(1),
    note: 'Shown to the person as a step button. Do not paste calldata.',
  });
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
  const tools = await modelTools(wallet);
  const txs: TxStep[] = [];
  // Earlier answers were checked when given, so addresses in them count as known.
  const seenText = () => messages.filter((m) => m.role === 'tool' || m.role === 'assistant').map((m) => m.content).join(' ').toLowerCase();
  const messages: ChatMsg[] = [
    { role: 'system', content: systemPrompt(wallet) },
    ...history.slice(-10),
    { role: 'user', content: message },
  ];
  const steps: string[] = [];
  const signLinks: string[] = [];
  let reply = '';
  let nudged = false;
  for (let round = 0; round < 5; round++) {
    // Short on time, or many rounds in: answer with what it has.
    const final = round === 4 || left() < 7_000;
    let m: Awaited<ReturnType<typeof glm>>;
    try {
      m = await glm(key, messages, final ? null : tools, Math.max(4_000, left() - 500));
    } catch (e) {
      // Out of time after real work was done: finish with what exists instead of failing.
      if (round > 0 && (e as Error).name === 'TimeoutError') break;
      throw e;
    }
    const calls = (m.tool_calls ?? []).slice(0, 5);
    // It announced transactions, or gave up, before building them: send it back once to build.
    if (calls.length === 0 && !final && !nudged && wallet && !txs.length && round > 0 && /\b(build|building|prepar|step 1|approve|can't assist|cannot assist)/i.test(m.content ?? '') && left() > 9_000) {
      nudged = true;
      messages.push({ role: 'assistant', content: m.content ?? '' }, { role: 'user', content: 'Build them now: call build_tx for each step in order, in this round. The page shows them to me to sign in my own wallet.' });
      continue;
    }
    if (calls.length === 0 || final) { reply = m.content ?? ''; break; }
    messages.push({ role: 'assistant', content: m.content ?? '', tool_calls: calls });
    const run = async (c: ToolCall) => {
      const name = c.function?.name ?? '';
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(c.function?.arguments || '{}'); } catch { /* none */ }
      if (HIDDEN_TOOLS.has(name)) return 'Not available here: give the person a swap or pool button instead.';
      if (BUILD_TOOLS.has(name) && !wallet) return 'Error: no wallet connected. Ask the person to connect one first.';
      // On this page only the connected wallet can sign: build for it, whatever address was typed.
      if (wallet && name.startsWith('build_') && 'wallet' in args) args.wallet = wallet;
      const label = STEP_LABELS[name] ?? name.replace(/_/g, ' ');
      if (!steps.includes(label)) steps.push(label);
      try {
        // A slow tool must not run the whole request past the host's limit.
        const out = await Promise.race([
          name === 'build_tx' ? buildStep(args, wallet!, seenText(), txs)
            : name === 'build_swap' ? buildSwapStep(args, wallet!, seenText(), txs) : callTool(name, args),
          new Promise((_, no) => setTimeout(() => no(new Error('this lookup took too long; answer without it or suggest the matching page')), Math.max(3_000, Math.min(12_000, left() - 6_000)))),
        ]);
        // Any other build tool (bridge, lend, withdraw, one-token deposit): its steps go on the page as the sign card,
        // so signing never depends on the model remembering to paste the link.
        if (name.startsWith('build_') && name !== 'build_tx' && name !== 'build_swap') collectSteps(out, txs, signLinks);
        return (typeof out === 'string' ? out : JSON.stringify(out)).slice(0, 7_000);
      } catch (e) {
        return `Error: ${(e as Error).message}`.slice(0, 500);
      }
    };
    // Lookups run together; transactions are built one after another so their steps keep the model's order.
    const results: string[] = new Array(calls.length);
    const builds = (c: ToolCall) => BUILD_TOOLS.has(c.function?.name ?? '');
    await Promise.all(calls.map(async (c, i) => { if (!builds(c)) results[i] = await run(c); }));
    for (let i = 0; i < calls.length; i++) if (builds(calls[i])) results[i] = await run(calls[i]);
    calls.forEach((c, i) => messages.push({ role: 'tool', tool_call_id: c.id ?? '', content: results[i] }));
  }
  reply = reply.trim();
  if (!reply && txs.length) reply = `I built ${txs.length === 1 ? 'the transaction' : `${txs.length} transactions`} below. Sign them in order in your wallet; each one unlocks after the one before it confirms.`;
  if (!reply) reply = 'I ran out of time on that one. Try asking again, a little more specifically.';
  if (LEAK.test(reply)) reply = 'I am the BTB Agent, built by BTB Finance. Ask me about pools, swaps, tokens or your positions.';
  reply = reply.replace(/\s*[—–]\s*/g, ', ').replace(/, ,/g, ',');
  reply = checkSwapLinks(reply, seenText());
  // The answer mentions signing but carries no sign link: add the button.
  if (signLinks.length && !reply.includes('/sign#')) reply += `\n\n[Open sign page](${signLinks[signLinks.length - 1]})`;
  // A wallet is connected but the answer only links to the Swap screen: build that exact swap here as well.
  if (wallet && !txs.length && left() > 4_000) {
    const link = reply.match(/https:\/\/btb\.finance\/swap\?[^\s)]+/)?.[0];
    if (link) {
      const q = new URL(link).searchParams;
      const p = { chainId: Number(q.get('chain')), tokenIn: q.get('from') ?? '', tokenOut: q.get('to') ?? '', amount: q.get('amount') ?? '', slippageBps: 50 };
      if (p.chainId && isTokenArg(p.tokenIn) && isTokenArg(p.tokenOut) && /^\d+(\.\d+)?$/.test(p.amount)) {
        try {
          const built = await Promise.race([swapSteps(p, wallet), new Promise<never>((_, no) => setTimeout(() => no(new Error('slow')), left() - 1_500))]);
          txs.push(...built.steps);
          if (!steps.includes(STEP_LABELS.build_swap)) steps.push(STEP_LABELS.build_swap);
          if (!built.built.balanceOk) reply += `\n\nYour wallet does not hold enough to cover this swap yet.`;
        } catch { /* the link still works */ }
      }
    }
  }
  return { reply, steps, ...(txs.length ? { txs } : {}) };
}
