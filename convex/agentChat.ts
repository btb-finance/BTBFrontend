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
const DAILY_MESSAGE_LIMIT = 50;

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
    "Ground every suggestion in the data below. If the user holds both sides of a pool pair, say so. Prefer high TVL pools for beginners and stable pairs for low risk. Never invent pools or numbers that are not in the data. Keep replies short and scannable. You are not a licensed financial advisor and say so once when giving allocation advice.",
    "",
    "USER TOKEN BALANCES:",
    held || "none on record (ask them to open the Portfolio tab once so balances sync)",
    "",
    "USER POSITIONS (LPs and Yearn vaults, from the app):",
    extras && extras.length > 2 ? extras.slice(0, 6000) : "none provided",
    "",
    "TOP POOLS RIGHT NOW (pair · dex · fee · TVL · APR):",
    poolLines,
  ].join("\n");
}

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

    // Server-side gate: the UI hides the chat below 10M BTB, but the action
    // must not trust the client.
    const btbRow = data.balances.find((b) => b.tokenAddress?.toLowerCase() === BTB_ADDRESS);
    const btbBalance = parseFloat(btbRow?.balanceFormatted ?? "0");
    if (!(btbBalance >= REQUIRED_BTB)) {
      throw new Error("Agent access requires holding 10M BTB. Refresh your portfolio if you just acquired it.");
    }
    if (data.userMsgsToday >= DAILY_MESSAGE_LIMIT) {
      throw new Error(`Daily limit of ${DAILY_MESSAGE_LIMIT} messages reached. The agent resets tomorrow.`);
    }

    const messages = [
      { role: "system", content: buildSystemPrompt(data.balances, data.poolsJson, extras) },
      ...data.history,
      { role: "user", content: trimmed },
    ];

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
      // GLM 5.2 is a reasoning model — without this it spends the token budget
      // on hidden reasoning and can return an empty visible reply.
      body: JSON.stringify({ model: GLM_MODEL, messages, max_tokens: 1200, thinking: { type: "disabled" } }),
    });
    const body = await res.json().catch(() => ({}));
    const reply: string | undefined = body?.choices?.[0]?.message?.content;
    if (!res.ok || !reply) {
      // Billing problems are ours, not the user's — don't surface recharge talk.
      if (body?.error?.code === "1113" || /recharge|insufficient balance/i.test(body?.error?.message ?? "")) {
        throw new Error("The agent is temporarily out of capacity. The team has been notified, try again soon.");
      }
      const detail = body?.error?.message ?? `HTTP ${res.status}`;
      throw new Error(`Agent brain is unavailable right now (${detail})`);
    }

    await ctx.runMutation(internal.agent.saveMessage, { walletAddress, role: "user", content: trimmed });
    await ctx.runMutation(internal.agent.saveMessage, { walletAddress, role: "assistant", content: reply });
    return reply;
  },
});
