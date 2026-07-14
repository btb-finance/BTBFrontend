"use node";

/**
 * The BTB Agent — GLM 5.2 (z.ai) chat with full portfolio + market context.
 *
 * Context assembled per message:
 *  - the wallet's token balances (server-side snapshot, also used for the gate)
 *  - the Discover pool list (precomputed hourly by discoverRefresh.ts)
 *  - client-provided extras: LP positions and Yearn Earn positions (compact JSON)
 *
 * Access is enforced HERE, not just in the UI: the wallet must hold 10M BTB
 * per its balance snapshot. API key lives in the GLM_API_KEY env var.
 */

import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

// The account is on z.ai's Coding Plan, which only covers the /api/coding/
// endpoint — the generic /api/paas/ endpoint answers "insufficient balance"
// even with an active plan.
const GLM_URL = "https://api.z.ai/api/coding/paas/v4/chat/completions";
const GLM_MODEL = "glm-5.2";
const BTB_ADDRESS = "0x88888888c90cd71b35830dabfd24743dbc135b51";
const REQUIRED_BTB = 10_000_000;
// Everyone gets a free daily allowance; 10M BTB holders get the full quota.
const FREE_DAILY_LIMIT = 5;
const HOLDER_DAILY_LIMIT = 50;

type Pool = {
  pair: string; dex: string; version?: string; feeTier?: number;
  tvlUsd: number; apy: number; aprRange?: number; volume24hUsd?: number; stablecoin: boolean;
};

function buildSystemPrompt(
  balances: { symbol: string; balanceFormatted: string; valueUsd: number }[],
  poolsJson: string | null,
  extras: string | undefined,
): string {
  const held = balances
    .filter((b) => b.valueUsd > 1)
    .sort((a, b) => b.valueUsd - a.valueUsd)
    .slice(0, 25)
    .map((b) => `${b.symbol}: ${b.balanceFormatted} ($${b.valueUsd.toFixed(2)})`)
    .join("\n");

  let poolLines = "unavailable";
  try {
    if (poolsJson) {
      const pools = (JSON.parse(poolsJson).pools as Pool[])
        .sort((a, b) => b.tvlUsd - a.tvlUsd)
        .slice(0, 30);
      poolLines = pools
        .map((p) => {
          const fee = p.feeTier != null ? (p.feeTier & 0x800000 ? "dynamic" : `${p.feeTier / 10000}%`) : "?";
          const apr = p.aprRange ?? p.apy;
          return `${p.pair} · ${p.dex} ${p.version ?? ""} · fee ${fee} · TVL $${Math.round(p.tvlUsd / 1e6)}M · APR ${apr.toFixed(1)}%${p.stablecoin ? " · stable pair" : ""}`;
        })
        .join("\n");
    }
  } catch { /* keep "unavailable" */ }

  return [
    "You are the BTB Agent, the in app assistant of BTB Finance (btb.finance), a DeFi app on Ethereum mainnet with swaps, concentrated liquidity LPing (Uniswap V3/V4, PancakeSwap V3), and Yearn vault deposits.",
    "You help the user decide where to deploy their capital: suggest concrete LP pools or vaults that match the tokens they already hold, sized to their balances. Always cover risk honestly: impermanent loss for volatile pairs, out of range risk for concentrated positions, low TVL or low volume pools being unreliable, and that APRs move constantly.",
    "Ground every suggestion in the data below. If the user holds both sides of a pool pair, say so. Prefer high TVL pools for beginners and stable pairs for low risk. For low risk or stablecoin yield questions, ALWAYS compare LP pools against the Yearn vaults in vaultList: vaults take one token, auto compound, and have no impermanent loss, so when a stable vault pays more APY than a stable LP, recommend the vault (deposits happen in the app's Earn tab). When the user mentions a token that is not in the data, call the search_token tool to get its live price, liquidity, volume, and pools before answering; flag thin liquidity, brand new pairs, and big 24h moves as risks. Never invent pools, vaults, or numbers that are not in the data. Keep replies short and scannable, and do not use em dashes. You are not a licensed financial advisor and say so once when giving allocation advice.",
    "",
    "USER TOKEN BALANCES:",
    held || "none on record (ask them to open the Portfolio tab once so balances sync)",
    "",
    "APP DATA JSON — lps: the user's LP positions · yearn: the user's vault deposits · vaultList: Yearn vaults available in the Earn tab (apyPct, tvlUsd, stable flag):",
    extras && extras.length > 2 ? extras.slice(0, 8000) : "none provided",
    "",
    "TOP POOLS RIGHT NOW (pair · dex · fee · TVL · APR):",
    poolLines,
  ].join("\n");
}

// ─── Tool: live token lookup (DexScreener, keyless) ─────────────────────────
// Lets the agent answer about ANY token, not just what the app tracks.

const TOOLS = [{
  type: "function" as const,
  function: {
    name: "search_token",
    description: "Live market lookup for any token by symbol, name, or contract address: price, liquidity, 24h volume and change, and the pools it trades in. Use whenever the user asks about a token that is not in the app data.",
    parameters: {
      type: "object",
      properties: { query: { type: "string", description: "Token symbol, name, or 0x address" } },
      required: ["query"],
    },
  },
}];

async function searchToken(query: string): Promise<string> {
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query.slice(0, 80))}`, {
      headers: { "User-Agent": "curl/8.4.0" },
    });
    if (!res.ok) return `lookup failed (HTTP ${res.status})`;
    const d = await res.json() as { pairs?: Record<string, any>[] };
    const pairs = (d.pairs ?? [])
      .sort((a, b) => (b?.liquidity?.usd ?? 0) - (a?.liquidity?.usd ?? 0))
      .slice(0, 5)
      .map((p) => ({
        chain: p.chainId,
        dex: p.dexId,
        pair: `${p.baseToken?.symbol}/${p.quoteToken?.symbol}`,
        tokenAddress: p.baseToken?.address,
        priceUsd: p.priceUsd,
        liquidityUsd: Math.round(p.liquidity?.usd ?? 0),
        volume24hUsd: Math.round(p.volume?.h24 ?? 0),
        change24hPct: p.priceChange?.h24 ?? null,
        pairCreated: p.pairCreatedAt ? new Date(p.pairCreatedAt).toISOString().slice(0, 10) : null,
      }));
    if (pairs.length === 0) return "no results: this token was not found on any tracked DEX (possibly fake or unlaunched)";
    return JSON.stringify(pairs);
  } catch (e) {
    return `lookup failed (${(e as Error).message})`;
  }
}

type ChatMsg = { role: string; content: string; tool_calls?: unknown; tool_call_id?: string };

export const chat = action({
  args: {
    walletAddress: v.string(),
    message: v.string(),
    /** Compact JSON from the client: LP positions + Yearn positions. */
    extras: v.optional(v.string()),
  },
  handler: async (ctx, { walletAddress, message, extras }): Promise<string> => {
    const key = process.env.GLM_API_KEY;
    if (!key) throw new Error("Agent is not configured yet (missing GLM_API_KEY)");
    const trimmed = message.trim().slice(0, 2000);
    if (!trimmed) throw new Error("Empty message");

    const data = await ctx.runQuery(internal.agent.contextData, { walletAddress });

    // Tiering is decided server-side from the balance snapshot — the client
    // is never trusted. Free users get 5 messages a day, holders get 50.
    const btbRow = data.balances.find((b) => b.tokenAddress?.toLowerCase() === BTB_ADDRESS);
    const btbBalance = parseFloat(btbRow?.balanceFormatted ?? "0");
    const isHolder = btbBalance >= REQUIRED_BTB;
    const limit = isHolder ? HOLDER_DAILY_LIMIT : FREE_DAILY_LIMIT;
    if (data.userMsgsToday >= limit) {
      throw new Error(isHolder
        ? `Daily limit of ${HOLDER_DAILY_LIMIT} messages reached. The agent resets tomorrow.`
        : `You used your ${FREE_DAILY_LIMIT} free messages for today. Hold 10M BTB to unlock ${HOLDER_DAILY_LIMIT} per day.`);
    }

    const messages: ChatMsg[] = [
      { role: "system", content: buildSystemPrompt(data.balances, data.poolsJson, extras) },
      ...data.history,
      { role: "user", content: trimmed },
    ];

    // Agentic loop: the model may call search_token before answering.
    let reply: string | undefined;
    for (let round = 0; round < 3; round++) {
      const res = await fetch(GLM_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept-Language": "en-US,en",
          Authorization: `Bearer ${key}`,
          // z.ai's WAF answers 429 "temporarily overloaded" to the default
          // Node fetch User-Agent — any ordinary UA passes.
          "User-Agent": "curl/8.4.0",
        },
        // GLM 5.2 is a reasoning model — without thinking disabled it spends
        // the token budget on hidden reasoning and can return an empty reply.
        body: JSON.stringify({ model: GLM_MODEL, messages, max_tokens: 1200, thinking: { type: "disabled" }, tools: TOOLS }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Billing problems are ours, not the user's — don't surface recharge talk.
        if (body?.error?.code === "1113" || /recharge|insufficient balance/i.test(body?.error?.message ?? "")) {
          throw new Error("The agent is temporarily out of capacity. The team has been notified, try again soon.");
        }
        throw new Error(`Agent brain is unavailable right now (${body?.error?.message ?? `HTTP ${res.status}`})`);
      }
      const m = body?.choices?.[0]?.message;
      const toolCalls = m?.tool_calls as { id?: string; function?: { name?: string; arguments?: string } }[] | undefined;
      if (toolCalls && toolCalls.length > 0) {
        messages.push({ role: "assistant", content: m?.content ?? "", tool_calls: toolCalls });
        for (const tc of toolCalls) {
          let result = "unknown tool";
          if (tc.function?.name === "search_token") {
            let q = "";
            try { q = JSON.parse(tc.function.arguments ?? "{}").query ?? ""; } catch { /* missing query */ }
            result = q ? await searchToken(q) : "missing query";
          }
          messages.push({ role: "tool", tool_call_id: tc.id ?? "", content: result });
        }
        continue;
      }
      reply = m?.content;
      break;
    }
    if (!reply) throw new Error("Agent brain is unavailable right now (no reply after tool use)");

    await ctx.runMutation(internal.agent.saveMessage, { walletAddress, role: "user", content: trimmed });
    await ctx.runMutation(internal.agent.saveMessage, { walletAddress, role: "assistant", content: reply });
    return reply;
  },
});
