/**
 * Discover pool cache — storage + read side.
 *
 * The hourly pipeline that fills this lives in `discoverRefresh.ts` (a Node
 * action — Convex requires queries/mutations to live outside "use node"
 * files). The frontend (`src/lib/discoverPools.ts`) reads the snapshot with
 * one query and only computes client-side when it's missing or stale.
 */
import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";

export const save = internalMutation({
  args: { json: v.string() },
  handler: async (ctx, { json }) => {
    const existing = await ctx.db.query("discoverPools").first();
    if (existing) {
      await ctx.db.patch(existing._id, { json, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("discoverPools", { json, updatedAt: Date.now() });
    }
  },
});

/** The latest snapshot — `json` is `{ pools: EarnPool[], priceChange: Record<string, number> }`. */
export const get = query({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db.query("discoverPools").first();
    return row ? { json: row.json, updatedAt: row.updatedAt } : null;
  },
});
