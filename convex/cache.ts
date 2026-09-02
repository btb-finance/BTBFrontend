/**
 * Generic memo cache for data keyed by user input.
 *
 * Snapshots (see `snapshots.ts`) cover datasets small enough to precompute in
 * full. This table covers the rest: pool day history, pool stats, token safety
 * — too many possible keys to enumerate, but the answer for a given key is the
 * same for everyone and moves slowly. The first visitor to ask pays the
 * upstream round trip (via `cacheFill.fill`); everyone after reads this row.
 */
import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";

/** A hit only counts while unexpired — a stale row is treated as a miss. */
export const get = query({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const row = await ctx.db
      .query("cacheEntries")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    if (!row || row.expiresAt < Date.now()) return null;
    return { json: row.json, updatedAt: row.updatedAt };
  },
});

export const put = internalMutation({
  args: { key: v.string(), json: v.string(), ttlMs: v.float64() },
  handler: async (ctx, { key, json, ttlMs }) => {
    const now = Date.now();
    const fields = { json, updatedAt: now, expiresAt: now + ttlMs };
    const existing = await ctx.db
      .query("cacheEntries")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, fields);
    } else {
      await ctx.db.insert("cacheEntries", { key, ...fields });
    }
  },
});

/**
 * Drop expired rows so the table stays bounded — the simulator can key on any
 * pool address, so entries accumulate without a sweep. Batched to keep each
 * transaction small; the cron re-runs often enough to catch the remainder.
 */
export const purgeExpired = internalMutation({
  args: {},
  handler: async (ctx) => {
    const stale = await ctx.db
      .query("cacheEntries")
      .withIndex("by_expires", (q) => q.lt("expiresAt", Date.now()))
      .take(500);
    for (const row of stale) await ctx.db.delete(row._id);
    return stale.length;
  },
});
