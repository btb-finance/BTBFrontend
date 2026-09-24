/**
 * Agent chat: storage and read side. The model call lives in `agentChat.ts`
 * (a Node action). Every wallet gets AGENT_FREE_PER_DAY messages a day; each
 * one after that costs AGENT_MESSAGE_BTB from the wallet's BTB balance. Reads
 * and writes need a signed session, so nobody can read or spend as another
 * wallet by typing its address.
 */
import { internalMutation, internalQuery, query } from "./_generated/server";
import { v } from "convex/values";
import { sessionWallet } from "./sessions";
import { availableFor, spendCredit } from "./credit";
import { autoSummaryFor } from "./autoRebalance";

export const history = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, { sessionToken }) => {
    const wallet = await sessionWallet(ctx, sessionToken);
    if (!wallet) return [];
    return await ctx.db
      .query("agentMessages")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", wallet))
      .order("asc")
      .take(200);
  },
});

/** Take one paid message's BTB. Called by the chat action after a reply. */
export const chargeMessage = internalMutation({
  args: { walletAddress: v.string(), amount: v.float64() },
  handler: async (ctx, { walletAddress, amount }) => ({ ok: await spendCredit(ctx, walletAddress, amount) }),
});

export const saveMessage = internalMutation({
  args: { walletAddress: v.string(), role: v.string(), content: v.string() },
  handler: async (ctx, { walletAddress, role, content }) => {
    await ctx.db.insert("agentMessages", {
      walletAddress: walletAddress.toLowerCase(),
      role,
      content,
      createdAt: Date.now(),
    });
  },
});

/** Everything the chat action needs in one query: balances (portfolio
 * context), the Discover pool snapshot, recent history for the model, today's
 * message count (free allowance) and what the wallet can pay with. */
export const contextData = internalQuery({
  args: { walletAddress: v.string() },
  handler: async (ctx, { walletAddress }) => {
    const wallet = walletAddress.toLowerCase();
    const balances = await ctx.db
      .query("userTokenBalances")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", wallet))
      .collect();
    const poolsRow = await ctx.db.query("discoverPools").first();
    const history = await ctx.db
      .query("agentMessages")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", wallet))
      .order("desc")
      .take(12);
    const dayAgo = Date.now() - 24 * 3600 * 1000;
    const today = await ctx.db
      .query("agentMessages")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", wallet).gt("createdAt", dayAgo))
      .collect();
    const userMsgsToday = today.filter((m) => m.role === "user").length;
    const { total: btbAvailable, balance: btbBalance, rewards: btbRewards } = await availableFor(ctx, wallet);
    const auto = await autoSummaryFor(ctx, wallet);
    return {
      btbAvailable,
      btbBalance,
      btbRewards,
      auto,
      balances: balances.map((b) => ({
        symbol: b.symbol,
        tokenAddress: b.tokenAddress,
        balanceFormatted: b.balanceFormatted,
        valueUsd: b.valueUsd,
      })),
      poolsJson: poolsRow?.json ?? null,
      history: history.reverse().map((m) => ({ role: m.role, content: m.content })),
      userMsgsToday,
    };
  },
});
