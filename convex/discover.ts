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

/** A token GeckoTerminal had no image for is asked about again after this long. */
const NO_LOGO_RETRY_MS = 7 * 24 * 60 * 60_000;

/**
 * Logos already stored for `keys`, plus the keys checked recently and found to
 * have no logo (stored as an empty logoURI). Both are skipped by the next
 * lookup, so a token without an image costs one request a week, not one every
 * refresh.
 */
export const tokenLogosFor = internalQuery({
  args: { keys: v.array(v.string()) },
  handler: async (ctx, { keys }) => {
    const known: Record<string, string> = {};
    const noLogo: string[] = [];
    const now = Date.now();
    for (const key of keys) {
      const row = await ctx.db.query("tokenLogos").withIndex("by_key", q => q.eq("key", key)).unique();
      if (!row) continue;
      if (row.logoURI) known[key] = row.logoURI;
      else if (now - row.updatedAt < NO_LOGO_RETRY_MS) noLogo.push(key);
    }
    return { known, noLogo };
  },
});

/** An empty logoURI records "checked, no logo" (see tokenLogosFor). */
export const saveTokenLogos = internalMutation({
  args: { entries: v.array(v.object({ key: v.string(), logoURI: v.string() })) },
  handler: async (ctx, { entries }) => {
    const now = Date.now();
    for (const e of entries) {
      const row = await ctx.db.query("tokenLogos").withIndex("by_key", q => q.eq("key", e.key)).unique();
      if (row) await ctx.db.patch(row._id, { logoURI: e.logoURI, updatedAt: now });
      else await ctx.db.insert("tokenLogos", { ...e, updatedAt: now });
    }
  },
});
