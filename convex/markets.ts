import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";

export const save = internalMutation({
  args: { json: v.string() },
  handler: async (ctx, { json }) => {
    const existing = await ctx.db.query("marketSnapshots").first();
    if (existing) {
      await ctx.db.patch(existing._id, { json, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("marketSnapshots", { json, updatedAt: Date.now() });
    }
  },
});

/** Fast client read; the expensive market scan runs only in the scheduled
 * Node action and never in a visitor's browser. */
export const get = query({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db.query("marketSnapshots").first();
    return row ? { json: row.json, updatedAt: row.updatedAt } : null;
  },
});
