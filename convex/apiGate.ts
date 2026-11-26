/**
 * Keys and rate limits for the public REST API (src/app/api/v1). The API route is the only caller: every function
 * here takes BTB_API_SECRET, set on both Netlify and Convex, so nobody can mint keys or burn someone's quota by
 * calling Convex directly. Keys are stored only as SHA-256 hashes; the plain key is shown once, at creation.
 *
 * Limits use fixed one-minute windows, one row per bucket ("key:<hash>" or "ip:<address>").
 */
import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

const WINDOW_MS = 60_000;
/** Calls per minute. */
export const LIMITS = { anon: 20, free: 120, partner: 600 } as const;
const KEYS_PER_IP_PER_DAY = 5;

function checkSecret(secret: string) {
  const want = process.env.BTB_API_SECRET;
  if (!want || secret !== want) throw new Error("forbidden");
}

/**
 * Counts one call against a bucket and says whether it is allowed. With a key hash, the key must exist and be on;
 * its tier sets the limit. Without one, the caller's IP gets the anonymous limit.
 */
export const hit = mutation({
  args: { secret: v.string(), keyHash: v.optional(v.string()), ip: v.string() },
  handler: async (ctx, { secret, keyHash, ip }) => {
    checkSecret(secret);
    const now = Date.now();
    let limit: number = LIMITS.anon;
    let bucket = `ip:${ip}`;
    let keyName: string | null = null;
    if (keyHash) {
      const key = await ctx.db.query("apiKeys").withIndex("by_hash", (q) => q.eq("hash", keyHash)).unique();
      if (!key || key.disabled) return { ok: false as const, reason: "invalid_key" as const, limit: 0, remaining: 0, resetAt: now };
      limit = LIMITS[key.tier];
      bucket = `key:${keyHash}`;
      keyName = key.name;
      await ctx.db.patch(key._id, { calls: key.calls + 1, lastUsedAt: now });
    }
    const windowStart = now - (now % WINDOW_MS);
    const row = await ctx.db.query("apiRate").withIndex("by_bucket", (q) => q.eq("bucket", bucket)).unique();
    let count = 1;
    if (!row) await ctx.db.insert("apiRate", { bucket, windowStart, count });
    else if (row.windowStart !== windowStart) await ctx.db.patch(row._id, { windowStart, count });
    else {
      count = row.count + 1;
      if (count > limit) return { ok: false as const, reason: "rate_limited" as const, limit, remaining: 0, resetAt: windowStart + WINDOW_MS, keyName };
      await ctx.db.patch(row._id, { count });
    }
    return { ok: true as const, limit, remaining: Math.max(0, limit - count), resetAt: windowStart + WINDOW_MS, keyName };
  },
});

/** A new free key. The route hashes the key it generated and passes only the hash. */
export const createKey = mutation({
  args: { secret: v.string(), hash: v.string(), prefix: v.string(), name: v.string(), contact: v.optional(v.string()), ip: v.string() },
  handler: async (ctx, { secret, hash, prefix, name, contact, ip }) => {
    checkSecret(secret);
    const now = Date.now();
    const day = Math.floor(now / 86_400_000);
    const bucket = `mk:${ip}:${day}`;
    const row = await ctx.db.query("apiRate").withIndex("by_bucket", (q) => q.eq("bucket", bucket)).unique();
    if (row && row.count >= KEYS_PER_IP_PER_DAY) return { ok: false as const, reason: "too_many_keys" as const };
    if (row) await ctx.db.patch(row._id, { count: row.count + 1 });
    else await ctx.db.insert("apiRate", { bucket, windowStart: day * 86_400_000, count: 1 });
    await ctx.db.insert("apiKeys", { hash, prefix, name, contact, tier: "free", calls: 0, createdAt: now, createdIp: ip, disabled: false });
    return { ok: true as const, tier: "free" as const, limitPerMinute: LIMITS.free };
  },
});

/** Usage for one key, for GET /api/v1/keys/me. */
export const keyInfo = query({
  args: { secret: v.string(), hash: v.string() },
  handler: async (ctx, { secret, hash }) => {
    checkSecret(secret);
    const key = await ctx.db.query("apiKeys").withIndex("by_hash", (q) => q.eq("hash", hash)).unique();
    if (!key) return null;
    return { prefix: key.prefix, name: key.name, tier: key.tier, limitPerMinute: LIMITS[key.tier], calls: key.calls, createdAt: key.createdAt, lastUsedAt: key.lastUsedAt ?? null, disabled: key.disabled };
  },
});

/** Dashboard tools: `npx convex run apiGate:setKey '{"prefix":"btb_abcd1234","tier":"partner"}'`. */
export const setKey = internalMutation({
  args: { prefix: v.string(), tier: v.optional(v.union(v.literal("free"), v.literal("partner"))), disabled: v.optional(v.boolean()) },
  handler: async (ctx, { prefix, tier, disabled }) => {
    const keys = await ctx.db.query("apiKeys").withIndex("by_prefix", (q) => q.eq("prefix", prefix)).collect();
    for (const k of keys) await ctx.db.patch(k._id, { ...(tier ? { tier } : {}), ...(disabled !== undefined ? { disabled } : {}) });
    return keys.length;
  },
});

/** Old windows are dead weight; a daily cron clears rows untouched for two days. */
export const sweep = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 2 * 86_400_000;
    const old = await ctx.db.query("apiRate").withIndex("by_window", (q) => q.lt("windowStart", cutoff)).take(2000);
    for (const r of old) await ctx.db.delete(r._id);
    return old.length;
  },
});
