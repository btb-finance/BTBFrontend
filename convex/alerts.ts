import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { addCredit, availableFor, creditRow, spendCredit } from "./credit";
import { sessionWallet } from "./sessions";

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

// Every change below acts only on the wallet of the caller's signed session, never on an address the caller names.
const NO_SESSION = { ok: false as const, reason: "Your sign-in expired. Sign in again." };

export const unsubscribe = mutation({
  args: { sessionToken: v.string(), chainId: v.float64(), protocol: v.string(), tokenId: v.string() },
  handler: async (ctx, a) => {
    const wallet = await sessionWallet(ctx, a.sessionToken);
    if (!wallet) return NO_SESSION;
    const rows = await ctx.db.query("positionAlerts").withIndex("by_address", q => q.eq("address", wallet)).collect();
    for (const r of rows) if (r.chainId === a.chainId && r.protocol === a.protocol && r.tokenId === a.tokenId) await ctx.db.patch(r._id, { active: false });
    return { ok: true as const };
  },
});

export const savePushSubscription = mutation({
  args: { sessionToken: v.string(), endpoint: v.string(), p256dh: v.string(), auth: v.string(), userAgent: v.optional(v.string()) },
  handler: async (ctx, { sessionToken, ...a }) => {
    const wallet = await sessionWallet(ctx, sessionToken);
    if (!wallet) return NO_SESSION;
    const existing = await ctx.db.query("pushSubscriptions").withIndex("by_endpoint", q => q.eq("endpoint", a.endpoint)).unique();
    if (existing) await ctx.db.patch(existing._id, { address: wallet, p256dh: a.p256dh, auth: a.auth });
    else await ctx.db.insert("pushSubscriptions", { ...a, address: wallet, createdAt: Date.now() });
    return { ok: true as const };
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
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const wallet = await sessionWallet(ctx, sessionToken);
    if (!wallet) return NO_SESSION;
    const rows = await ctx.db.query("alertEvents").withIndex("by_address", q => q.eq("address", wallet)).order("desc").take(50);
    const now = Date.now();
    for (const r of rows) if (!r.readAt) await ctx.db.patch(r._id, { readAt: now });
    return { ok: true as const };
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
    if (charge && charge > 0) await spendCredit(ctx, row.address, charge);
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

export const creditFor = query({
  args: { address: v.string() },
  handler: async (ctx, { address }) => {
    const a = address.toLowerCase();
    const { balance, rewards, total, fast } = await availableFor(ctx, a);
    const history = await ctx.db.query("alertDeposits").withIndex("by_address", q => q.eq("address", a)).order("desc").take(5);
    return { balance, rewards, total, fast, history: history.map(h => ({ amount: h.amount, source: h.source, createdAt: h.createdAt })) };
  },
});

/** Written by the verified deposit action only. */
export const creditDeposit = internalMutation({
  args: { txHash: v.string(), address: v.string(), amount: v.float64() },
  handler: async (ctx, a) => ({ ok: await addCredit(ctx, a.address, a.amount, a.txHash.toLowerCase(), "tx") }),
});

/** Written by the signed action only. */
export const setFastVerified = internalMutation({
  args: { address: v.string(), fast: v.boolean() },
  handler: async (ctx, { address, fast }) => {
    const credit = await creditRow(ctx, address);
    if (credit) await ctx.db.patch(credit._id, { fast, updatedAt: Date.now() });
    else await ctx.db.insert("alertCredits", { address: address.toLowerCase(), balance: 0, fast, updatedAt: Date.now() });
  },
});

export const turnFastOff = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const wallet = await sessionWallet(ctx, sessionToken);
    if (!wallet) return NO_SESSION;
    const credit = await creditRow(ctx, wallet);
    if (credit?.fast) await ctx.db.patch(credit._id, { fast: false, updatedAt: Date.now() });
    return { ok: true as const };
  },
});

/** Wallets with fast checks on and something to pay with (balance plus unclaimed rewards). */
export const alertPayers = internalQuery({
  args: { addresses: v.array(v.string()) },
  handler: async (ctx, { addresses }) => {
    const out: { address: string; balance: number; fast: boolean }[] = [];
    for (const address of addresses) {
      const { total, fast } = await availableFor(ctx, address);
      out.push({ address, balance: total, fast: !!fast });
    }
    return out;
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

/** Admin: move an owner's tag from one position key to another (repairs a tag left on an old position id). */
export const moveTagKey = internalMutation({
  args: { address: v.string(), from: v.string(), to: v.string() },
  handler: async (ctx, { address, from, to }) => {
    const a = address.toLowerCase();
    const row = await ctx.db.query("positionTags").withIndex("by_address_key", q => q.eq("address", a).eq("key", from)).unique();
    if (!row) return { ok: false as const };
    await ctx.db.patch(row._id, { key: to, updatedAt: Date.now() });
    return { ok: true as const };
  },
});

export const setTag = mutation({
  args: { sessionToken: v.string(), key: v.string(), tag: v.string() },
  handler: async (ctx, { sessionToken, key, tag }) => {
    const a = await sessionWallet(ctx, sessionToken);
    if (!a) return NO_SESSION;
    const clean = tag.trim().slice(0, 24);
    const row = await ctx.db.query("positionTags").withIndex("by_address_key", q => q.eq("address", a).eq("key", key)).unique();
    if (!clean) { if (row) await ctx.db.delete(row._id); return { ok: true as const }; }
    if (row) await ctx.db.patch(row._id, { tag: clean, updatedAt: Date.now() });
    else await ctx.db.insert("positionTags", { address: a, key, tag: clean, updatedAt: Date.now() });
    return { ok: true as const };
  },
});
