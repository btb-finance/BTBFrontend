/**
 * Generic cron-driven snapshot store.
 *
 * Anything identical for every visitor (vault catalogs, global contract stats,
 * pool lists) is computed once per cron tick by an action and stored here, so
 * a browser reads one row instead of repeating the upstream API and RPC work.
 * The refreshers live in `globalRefresh.ts`; storage and reads stay here
 * because Convex requires queries/mutations outside `"use node"` files.
 */
import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";

export const save = internalMutation({
  args: { key: v.string(), json: v.string() },
  handler: async (ctx, { key, json }) => {
    const existing = await ctx.db
      .query("snapshots")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { json, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("snapshots", { key, json, updatedAt: Date.now() });
    }
  },
});

/** Latest snapshot for one dataset, or null before the first cron tick. */
export const get = query({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const row = await ctx.db
      .query("snapshots")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    return row ? { json: row.json, updatedAt: row.updatedAt } : null;
  },
});
