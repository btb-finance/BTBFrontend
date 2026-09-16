import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

/** Wallets below this BTB balance cannot hold alerts: every check is an RPC read. */
export const ALERT_MIN_BTB = 10_000;

export const listForAddress = query({
  args: { address: v.string() },
  handler: async (ctx, { address }) => {
    const rows = await ctx.db.query("positionAlerts").withIndex("by_address", q => q.eq("address", address.toLowerCase())).collect();
    return rows.filter(r => r.active).map(r => ({ chainId: r.chainId, protocol: r.protocol, tokenId: r.tokenId, label: r.label, lastInRange: r.lastInRange }));
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
  args: { id: v.id("positionAlerts"), inRange: v.optional(v.boolean()), deactivate: v.optional(v.boolean()) },
  handler: async (ctx, { id, inRange, deactivate }) => {
    await ctx.db.patch(id, { lastCheckedAt: Date.now(), ...(inRange != null ? { lastInRange: inRange } : {}), ...(deactivate ? { active: false } : {}) });
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
