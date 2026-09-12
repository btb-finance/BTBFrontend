/**
 * Discover pool cache — storage + read side.
 *
 * The hourly pipeline that fills this lives in `discoverRefresh.ts` (a Node
 * action — Convex requires queries/mutations to live outside "use node"
 * files). The frontend (`src/lib/discoverPools.ts`) reads the snapshot with
 * one query and only computes client-side when it's missing or stale.
 */
import { internalMutation, internalQuery, query } from "./_generated/server";
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

/** The latest snapshot — `json` is `{ version, pools: EarnPool[], priceChange: Record<string, number> }`. */
/** Same row for server-side actions (the DEX coverage step reads and merges). */
export const getInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db.query("discoverPools").first();
    return row ? { json: row.json, updatedAt: row.updatedAt } : null;
  },
});

export const get = query({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db.query("discoverPools").first();
    return row ? { json: row.json, updatedAt: row.updatedAt } : null;
  },
});

/** Operator view: recent scheduled functions and their state (debugging the
 * DEX coverage steps). */
export const listScheduled = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.system.query("_scheduled_functions").order("desc").take(20);
    return rows.map((r) => ({ name: r.name, args: r.args, scheduledTime: new Date(r.scheduledTime).toISOString(), state: r.state, completedTime: r.completedTime ? new Date(r.completedTime).toISOString() : null }));
  },
});
