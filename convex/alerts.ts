import { query, mutation, internalMutation, internalQuery, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";

/** Wallets below this BTB balance cannot hold alerts: every check is an RPC read. */
export const ALERT_MIN_BTB = 10_000;

export const listForAddress = query({
  args: { address: v.string() },
  handler: async (ctx, { address }) => {
    const rows = await ctx.db.query("positionAlerts").withIndex("by_address", q => q.eq("address", address.toLowerCase())).collect();
    return rows.filter(r => r.active).map(r => ({ chainId: r.chainId, protocol: r.protocol, tokenId: r.tokenId, label: r.label, lastInRange: r.lastInRange, lastCheckedAt: r.lastCheckedAt ?? null }));
  },
});

/** Written by the verified subscribe action only. */
export const upsert = internalMutation({
  args: { address: v.string(), chainId: v.float64(), protocol: v.string(), tokenId: v.string(), label: v.string(), inRange: v.optional(v.boolean()) },
  handler: async (ctx, a) => {
    const address = a.address.toLowerCase();
    const rows = await ctx.db.query("positionAlerts").withIndex("by_address", q => q.eq("address", address)).collect();
    const existing = rows.find(r => r.chainId === a.chainId && r.protocol === a.protocol && r.tokenId === a.tokenId);
    if (existing) { await ctx.db.patch(existing._id, { active: true, label: a.label, lastInRange: a.inRange ?? existing.lastInRange }); return; }
    await ctx.db.insert("positionAlerts", { address, chainId: a.chainId, protocol: a.protocol, tokenId: a.tokenId, label: a.label, active: true, lastInRange: a.inRange, createdAt: Date.now() });
  },
});

export const unsubscribe = mutation({
  args: { address: v.string(), chainId: v.float64(), protocol: v.string(), tokenId: v.string() },
  handler: async (ctx, a) => {
    const rows = await ctx.db.query("positionAlerts").withIndex("by_address", q => q.eq("address", a.address.toLowerCase())).collect();
    for (const r of rows) if (r.chainId === a.chainId && r.protocol === a.protocol && r.tokenId === a.tokenId) await ctx.db.patch(r._id, { active: false });
  },
});

export const savePushSubscription = mutation({
  args: { address: v.string(), endpoint: v.string(), p256dh: v.string(), auth: v.string(), userAgent: v.optional(v.string()) },
  handler: async (ctx, a) => {
    const existing = await ctx.db.query("pushSubscriptions").withIndex("by_endpoint", q => q.eq("endpoint", a.endpoint)).unique();
    if (existing) { await ctx.db.patch(existing._id, { address: a.address.toLowerCase(), p256dh: a.p256dh, auth: a.auth }); return; }
    await ctx.db.insert("pushSubscriptions", { ...a, address: a.address.toLowerCase(), createdAt: Date.now() });
  },
});

export const inbox = query({
  args: { address: v.string() },
  handler: async (ctx, { address }) => {
    const rows = await ctx.db.query("alertEvents").withIndex("by_address", q => q.eq("address", address.toLowerCase())).order("desc").take(30);
    return rows.map(r => ({ id: r._id, kind: r.kind, label: r.label, message: r.message, createdAt: r.createdAt, read: !!r.readAt }));
  },
});

export const markRead = mutation({
  args: { address: v.string() },
  handler: async (ctx, { address }) => {
    const rows = await ctx.db.query("alertEvents").withIndex("by_address", q => q.eq("address", address.toLowerCase())).order("desc").take(50);
    const now = Date.now();
    for (const r of rows) if (!r.readAt) await ctx.db.patch(r._id, { readAt: now });
  },
});

// ── Checker plumbing ────────────────────────────────────────────────────────

export const activeAlerts = internalQuery({
  args: {},
  handler: async (ctx) => ctx.db.query("positionAlerts").withIndex("by_active", q => q.eq("active", true)).collect(),
});

export const subscriptionsFor = internalQuery({
  args: { address: v.string() },
  handler: async (ctx, { address }) => ctx.db.query("pushSubscriptions").withIndex("by_address", q => q.eq("address", address)).collect(),
});

export const recordCheck = internalMutation({
  args: { id: v.id("positionAlerts"), inRange: v.optional(v.boolean()), deactivate: v.optional(v.boolean()), charge: v.optional(v.float64()) },
  handler: async (ctx, { id, inRange, deactivate, charge }) => {
    const row = await ctx.db.get(id);
    if (!row) return;
    await ctx.db.patch(id, { lastCheckedAt: Date.now(), failures: 0, ...(inRange != null ? { lastInRange: inRange } : {}), ...(deactivate ? { active: false } : {}) });
    // A fast read is paid only once it has succeeded, so a flaky RPC never costs BTB.
    if (charge && charge > 0) {
      const credit = await creditRow(ctx, row.address);
      if (credit) await ctx.db.patch(credit._id, { balance: Math.max(0, credit.balance - charge), updatedAt: Date.now() });
    }
  },
});

/** A read that threw. Counts toward dropping the alert; does not move lastCheckedAt. */
export const recordFailure = internalMutation({
  args: { id: v.id("positionAlerts"), maxFailures: v.float64() },
  handler: async (ctx, { id, maxFailures }) => {
    const row = await ctx.db.get(id);
    if (!row) return;
    const failures = (row.failures ?? 0) + 1;
    await ctx.db.patch(id, { failures, ...(failures >= maxFailures ? { active: false } : {}) });
  },
});

// ── Fast-check balance ──────────────────────────────────────────────────────

async function creditRow(ctx: MutationCtx, address: string) {
  return ctx.db.query("alertCredits").withIndex("by_address", q => q.eq("address", address.toLowerCase())).unique();
}

/**
 * Credit a wallet once per `ref`. Returns false when the ref was already used,
 * which is the whole guard against a transaction hash pasted twice: the
 * lookup and the insert run in one Convex transaction.
 */
export async function addCredit(ctx: MutationCtx, address: string, amount: number, ref: string, source: "tx" | "rewards"): Promise<boolean> {
  const a = address.toLowerCase();
  const used = await ctx.db.query("alertDeposits").withIndex("by_ref", q => q.eq("ref", ref)).unique();
  if (used) return false;
  const now = Date.now();
  await ctx.db.insert("alertDeposits", { ref, address: a, amount, source, createdAt: now });
  const credit = await creditRow(ctx, a);
  if (credit) await ctx.db.patch(credit._id, { balance: credit.balance + amount, updatedAt: now });
  else await ctx.db.insert("alertCredits", { address: a, balance: amount, fast: false, updatedAt: now });
  return true;
}

export const creditFor = query({
  args: { address: v.string() },
  handler: async (ctx, { address }) => {
    const a = address.toLowerCase();
    const row = await ctx.db.query("alertCredits").withIndex("by_address", q => q.eq("address", a)).unique();
    const history = await ctx.db.query("alertDeposits").withIndex("by_address", q => q.eq("address", a)).order("desc").take(5);
    return { balance: row?.balance ?? 0, fast: row?.fast ?? false, history: history.map(h => ({ amount: h.amount, source: h.source, createdAt: h.createdAt })) };
  },
});

/** Written by the verified deposit action only. */
export const creditDeposit = internalMutation({
  args: { txHash: v.string(), address: v.string(), amount: v.float64() },
  handler: async (ctx, a) => ({ ok: await addCredit(ctx, a.address, a.amount, a.txHash.toLowerCase(), "tx") }),
});

/** Written by the signed action only; turning fast checks off needs no signature. */
export const setFastVerified = internalMutation({
  args: { address: v.string(), fast: v.boolean() },
  handler: async (ctx, { address, fast }) => {
    const credit = await creditRow(ctx, address);
    if (credit) await ctx.db.patch(credit._id, { fast, updatedAt: Date.now() });
    else await ctx.db.insert("alertCredits", { address: address.toLowerCase(), balance: 0, fast, updatedAt: Date.now() });
  },
});

export const turnFastOff = mutation({
  args: { address: v.string() },
  handler: async (ctx, { address }) => {
    const credit = await creditRow(ctx, address);
    if (credit?.fast) await ctx.db.patch(credit._id, { fast: false, updatedAt: Date.now() });
  },
});

/** Wallets with fast checks on and something to pay with, keyed by address. */
export const fastWallets = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("alertCredits").withIndex("by_fast", q => q.eq("fast", true)).collect();
    return rows.filter(r => r.balance > 0).map(r => ({ address: r.address, balance: r.balance }));
  },
});

export const pushEvent = internalMutation({
  args: { address: v.string(), kind: v.string(), label: v.string(), message: v.string() },
  handler: async (ctx, a) => { await ctx.db.insert("alertEvents", { ...a, createdAt: Date.now() }); },
});

export const dropSubscription = internalMutation({
  args: { endpoint: v.string() },
  handler: async (ctx, { endpoint }) => {
    const row = await ctx.db.query("pushSubscriptions").withIndex("by_endpoint", q => q.eq("endpoint", endpoint)).unique();
    if (row) await ctx.db.delete(row._id);
  },
});

// ── Position tags ───────────────────────────────────────────────────────────

export const tagsForAddress = query({
  args: { address: v.string() },
  handler: async (ctx, { address }) => {
    const rows = await ctx.db.query("positionTags").withIndex("by_address", q => q.eq("address", address.toLowerCase())).collect();
    return Object.fromEntries(rows.map(r => [r.key, r.tag]));
  },
});

export const setTag = mutation({
  args: { address: v.string(), key: v.string(), tag: v.string() },
  handler: async (ctx, { address, key, tag }) => {
    const a = address.toLowerCase();
    const clean = tag.trim().slice(0, 24);
    const row = await ctx.db.query("positionTags").withIndex("by_address_key", q => q.eq("address", a).eq("key", key)).unique();
    if (!clean) { if (row) await ctx.db.delete(row._id); return; }
    if (row) await ctx.db.patch(row._id, { tag: clean, updatedAt: Date.now() });
    else await ctx.db.insert("positionTags", { address: a, key, tag: clean, updatedAt: Date.now() });
  },
});
