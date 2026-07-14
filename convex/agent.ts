/**
 * Agent chat — storage + read side. The GLM call itself lives in
 * `agentChat.ts` (a Node action). Access is gated to 10M BTB holders,
 * enforced server-side in the action against the wallet's balance snapshot.
 */
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const history = query({
  args: { walletAddress: v.string() },
  handler: async (ctx, { walletAddress }) => {
    return await ctx.db
      .query("agentMessages")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", walletAddress.toLowerCase()))
      .order("asc")
      .take(200);
  },
});

export const clear = mutation({
  args: { walletAddress: v.string() },
  handler: async (ctx, { walletAddress }) => {
    const rows = await ctx.db
      .query("agentMessages")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", walletAddress.toLowerCase()))
      .collect();
    for (const r of rows) await ctx.db.delete(r._id);
  },
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

/** Everything the chat action needs in one query: balances (for the BTB gate
 * and portfolio context), the Discover pool snapshot, recent history for the
 * model, and today's message count (rate limit). */
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
    return {
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
