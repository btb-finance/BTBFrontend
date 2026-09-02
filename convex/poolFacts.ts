import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Shared pool-fact cache for the enrichment pipeline.
 *
 * TRUST MODEL: rows are written only by the server enrichment route, which
 * computes them itself from chain reads. The write mutation checks a secret
 * (POOL_FACTS_SECRET Convex env var) so a client can never poison what other
 * users see — clients call this table read-only.
 *
 * Set it once with:
 *   npx convex env set POOL_FACTS_SECRET <random-string>
 * and set the same value in the web app's environment. While the env var is
 * unset, writes are rejected (cache stays cold; the app still works by
 * probing live).
 */

const TTL = 15 * 60_000;

const secretMatches = (provided: string) => {
  const expected = process.env.POOL_FACTS_SECRET;
  // No secret configured → caching is disabled rather than trust-on-first-use.
  return !!expected && provided === expected;
};

export const get = query({
  args: { chainId: v.float64(), addresses: v.array(v.string()) },
  handler: async (ctx, { chainId, addresses }) => {
    const now = Date.now();
    const out: { address: string; feePct: number | null; ammClass: string; rangeApr: number | null }[] = [];
    for (const address of addresses.slice(0, 80)) {
      const row = await ctx.db
        .query("poolFacts")
        .withIndex("by_chain_address", (q) => q.eq("chainId", chainId).eq("address", address.toLowerCase()))
        .unique();
      if (!row || row.expiresAt < now) continue;
      out.push({ address: row.address, feePct: row.feePct ?? null, ammClass: row.ammClass, rangeApr: row.rangeApr ?? null });
    }
    return out;
  },
});

export const put = mutation({
  args: {
    secret: v.string(),
    chainId: v.float64(),
    facts: v.array(v.object({
      address: v.string(),
      feePct: v.optional(v.float64()),
      ammClass: v.string(),
      rangeApr: v.optional(v.float64()),
    })),
  },
  handler: async (ctx, { secret, chainId, facts }) => {
    if (!secretMatches(secret)) return { stored: 0 };
    const now = Date.now();
    let stored = 0;
    for (const fact of facts.slice(0, 80)) {
      const address = fact.address.toLowerCase();
      const existing = await ctx.db
        .query("poolFacts")
        .withIndex("by_chain_address", (q) => q.eq("chainId", chainId).eq("address", address))
        .unique();
      const row = {
        chainId,
        address,
        feePct: fact.feePct ?? undefined,
        ammClass: fact.ammClass,
        rangeApr: fact.rangeApr ?? undefined,
        updatedAt: now,
        expiresAt: now + TTL,
      };
      if (existing) await ctx.db.patch(existing._id, row);
      else await ctx.db.insert("poolFacts", row);
      stored++;
    }
    return { stored };
  },
});
