"use node";

/**
 * Fills the memo cache (`cache.ts`) on demand.
 *
 * The simulator's supporting data — day history, pool stats, token safety,
 * USD prices — is keyed by whichever pool or pair the user picked, so it can't
 * be precomputed on a cron. It is still identical for everyone who opens that
 * pool, so the first request pays the upstream round trip here and writes the
 * row; every later visitor reads it straight from Convex until it expires.
 *
 * Running it here rather than in the browser also means one shared rate limit
 * against GeckoTerminal/DeFiLlama/The Graph instead of one per visitor.
 */

import { action, internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";
import { cacheKey, CACHE_TTL_MS, type CacheArgs, type CacheKind } from "../src/lib/cacheKeys";
import { getPoolHistory } from "../src/protocols/dexs/uniswap/graph";
import { fetchPoolDailyHistory, fetchPoolStats } from "../src/lib/geckoterminal";
import { fetchTokenSafety } from "../src/lib/tokenSafety";
import { getTokenPricesUsd } from "../src/lib/defillama";

const KINDS: CacheKind[] = ["pool-history", "pool-daily", "pool-stats", "token-safety", "token-prices"];

async function compute(a: CacheArgs): Promise<unknown> {
  switch (a.kind) {
    case "pool-history":
      return getPoolHistory(a.subgraphId ?? "", a.id, a.days ?? 30);
    case "pool-daily":
      return fetchPoolDailyHistory(a.id, a.days ?? 30, a.network ?? "eth");
    case "pool-stats":
      return fetchPoolStats(a.id.split(","), a.network ?? "eth");
    case "token-safety":
      return fetchTokenSafety(a.id, a.chainId ?? 1, a.explorerBase);
    case "token-prices":
      return getTokenPricesUsd(a.id.split(","), a.network ?? "ethereum");
  }
}

/**
 * Public because the browser calls it directly on a cache miss. It only ever
 * reads third-party data under a key the caller already knows and writes it to
 * a shared row — there is nothing user-scoped or privileged to protect.
 */
export const fill = action({
  args: {
    kind: v.string(),
    id: v.string(),
    network: v.optional(v.string()),
    chainId: v.optional(v.float64()),
    days: v.optional(v.float64()),
    subgraphId: v.optional(v.string()),
    explorerBase: v.optional(v.string()),
  },
  handler: async (ctx, raw): Promise<string | null> => {
    if (!KINDS.includes(raw.kind as CacheKind)) return null;
    const args = raw as CacheArgs;
    const key = cacheKey(args);

    // Another visitor may have filled this key while we were queued.
    const hit = await ctx.runQuery(api.cache.get, { key });
    if (hit) return hit.json;

    let json: string;
    try {
      json = JSON.stringify(await compute(args));
    } catch {
      // Upstream failed — cache nothing so the next caller retries rather than
      // pinning an error for the whole TTL. Callers degrade on null.
      return null;
    }

    await ctx.runMutation(internal.cache.put, { key, json, ttlMs: CACHE_TTL_MS[args.kind] });
    return json;
  },
});

/** Cron hook — keeps the memo table from growing without bound. */
export const purge = internalAction({
  args: {},
  handler: async (ctx) => {
    await ctx.runMutation(internal.cache.purgeExpired, {});
  },
});
