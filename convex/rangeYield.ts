/**
 * Measured ±5% range APR, storage side. The job lives in rangeYieldActions.ts
 * and the reading and math in src/lib/rangeYield.ts.
 *
 * One row per chain: `bandsFile` is the open bands of every pool (gzip JSON
 * in storage, too big for a document), `yields` the latest measurement per
 * pool, which saveDiscover (discoverStore.ts) copies onto the Discover rows,
 * and `lpShares` the share of swap fees each pool's LPs keep after the DEX's
 * own cut, used to lower the APR of rows nothing measured.
 */
import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

/** Per pool id: [fee APR %, net % vs holding over the window, days, in range % or -1, scaled 0/1, measured at ms]. */
export type YieldEntry = [number, number, number, number, number, number];

export const getChain = internalQuery({
  args: { chainId: v.float64() },
  handler: async (ctx, { chainId }) => ctx.db.query("rangeYield").withIndex("by_chain", (q) => q.eq("chainId", chainId)).first(),
});

export const allYields = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("rangeYield").collect();
    return rows.map((r) => ({ chainId: r.chainId, yields: r.yields, lpShares: r.lpShares ?? "{}" }));
  },
});

export const saveChain = internalMutation({
  args: { chainId: v.float64(), bandsFile: v.id("_storage"), yields: v.string(), lpShares: v.optional(v.string()) },
  handler: async (ctx, { chainId, bandsFile, yields, lpShares }) => {
    const row = await ctx.db.query("rangeYield").withIndex("by_chain", (q) => q.eq("chainId", chainId)).first();
    if (row) {
      if (row.bandsFile !== bandsFile) await ctx.storage.delete(row.bandsFile).catch(() => {});
      await ctx.db.patch(row._id, { bandsFile, yields, ...(lpShares ? { lpShares } : {}), updatedAt: Date.now() });
    } else {
      await ctx.db.insert("rangeYield", { chainId, bandsFile, yields, ...(lpShares ? { lpShares } : {}), updatedAt: Date.now() });
    }
  },
});
