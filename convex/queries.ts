import { query } from "./_generated/server";
import { v } from "convex/values";

export const listAllPrices = query({
  handler: async (ctx) => ctx.db.query("tokenPrices").collect(),
});

export const getPrice = query({
  args: { address: v.string() },
  handler: async (ctx, { address }) =>
    ctx.db
      .query("tokenPrices")
      .withIndex("by_address", (q) => q.eq("address", address.toLowerCase()))
      .unique(),
});

export const getPrices = query({
  args: { addresses: v.array(v.string()) },
  handler: async (ctx, { addresses }) => {
    const results: Record<string, number> = {};
    for (const addr of addresses) {
      const entry = await ctx.db
        .query("tokenPrices")
        .withIndex("by_address", (q) => q.eq("address", addr.toLowerCase()))
        .unique();
      if (entry) results[addr.toLowerCase()] = entry.priceUsd;
    }
    return results;
  },
});
