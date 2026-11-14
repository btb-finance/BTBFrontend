/**
 * Smart LPs, storage and read side. The job is smartLpsActions.ts and the
 * method src/lib/smartLps.ts.
 *
 * One row per chain: `stateFile` holds the tracked positions and their
 * snapshots (gzip JSON in storage), `results` each pool's ranking.
 */
import { internalMutation, internalQuery, query } from "./_generated/server";
import { v } from "convex/values";
import type { PoolSmartLps } from "../src/lib/smartLps";

export const getChain = internalQuery({
  args: { chainId: v.float64() },
  handler: async (ctx, { chainId }) => ctx.db.query("smartLps").withIndex("by_chain", (q) => q.eq("chainId", chainId)).first(),
});

export const saveChain = internalMutation({
  args: { chainId: v.float64(), stateFile: v.id("_storage"), results: v.string() },
  handler: async (ctx, { chainId, stateFile, results }) => {
    const row = await ctx.db.query("smartLps").withIndex("by_chain", (q) => q.eq("chainId", chainId)).first();
    if (row) {
      if (row.stateFile !== stateFile) await ctx.storage.delete(row.stateFile).catch(() => {});
      await ctx.db.patch(row._id, { stateFile, results, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("smartLps", { chainId, stateFile, results, updatedAt: Date.now() });
    }
  },
});

/** One pool's smart LPs for the Add LP and Simulate sheet; null until the job has covered it. */
export const forPool = query({
  args: { chainId: v.float64(), pool: v.string() },
  handler: async (ctx, { chainId, pool }) => {
    const row = await ctx.db.query("smartLps").withIndex("by_chain", (q) => q.eq("chainId", chainId)).first();
    if (!row) return null;
    const all = JSON.parse(row.results) as Record<string, PoolSmartLps>;
    const hit = all[pool.toLowerCase()];
    return hit ? { ...hit, updatedAt: row.updatedAt } : null;
  },
});

/** Smart LP count per pool (`chainId:pool`), so Discover shows its Smart LPs button only where there are some. */
export const counts = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("smartLps").collect();
    const out: Record<string, number> = {};
    for (const row of rows) {
      for (const [pool, r] of Object.entries(JSON.parse(row.results) as Record<string, PoolSmartLps>)) {
        if (r.smart > 0) out[`${row.chainId}:${pool}`] = r.smart;
      }
    }
    return out;
  },
});

/** Drop every chain's tracked positions and rankings so the next run backfills from scratch (after a method fix). */
export const clearAll = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("smartLps").collect();
    for (const row of rows) {
      await ctx.storage.delete(row.stateFile).catch(() => {});
      await ctx.db.delete(row._id);
    }
    return rows.length;
  },
});

/** The same for one chain. */
export const clearChain = internalMutation({
  args: { chainId: v.float64() },
  handler: async (ctx, { chainId }) => {
    const row = await ctx.db.query("smartLps").withIndex("by_chain", (q) => q.eq("chainId", chainId)).first();
    if (!row) return false;
    await ctx.storage.delete(row.stateFile).catch(() => {});
    await ctx.db.delete(row._id);
    return true;
  },
});

/** The best smart LPs across every pool and chain, for the Smart LPs page; best result against holding first. */
export const top = query({
  args: { limit: v.optional(v.float64()) },
  handler: async (ctx, { limit }) => {
    const rows = await ctx.db.query("smartLps").collect();
    const all: (PoolSmartLps["top"][number] & { chainId: number; pool: string })[] = [];
    let updatedAt = 0;
    for (const row of rows) {
      updatedAt = Math.max(updatedAt, row.updatedAt);
      for (const [pool, r] of Object.entries(JSON.parse(row.results) as Record<string, PoolSmartLps>)) {
        for (const x of r.top) all.push({ ...x, chainId: row.chainId, pool });
      }
    }
    all.sort((a, b) => b.netApr - a.netApr);
    return { updatedAt, lps: all.slice(0, Math.min(200, limit ?? 100)) };
  },
});
