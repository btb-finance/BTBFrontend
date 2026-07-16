import { internalMutation, internalQuery, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

const ACTIVE_LEASE_MS = 90_000;

export const insert = internalMutation({
  args: {
    orderKey: v.string(), chainId: v.float64(), account: v.string(),
    tokenIn: v.string(), tokenOut: v.string(), amountIn: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("spotTradeOrders").withIndex("by_order_key", q => q.eq("orderKey", args.orderKey)).unique();
    if (existing) return { id: existing._id, state: existing.state, duplicate: true };
    const now = Date.now();
    const id = await ctx.db.insert("spotTradeOrders", {
      ...args,
      account: args.account.toLowerCase(), tokenIn: args.tokenIn.toLowerCase(), tokenOut: args.tokenOut.toLowerCase(),
      state: "queued", requestedAt: now, updatedAt: now, attempts: 0,
    });
    await ctx.scheduler.runAfter(0, internal.spotTradeWorker.drain, {});
    return { id, state: "queued", duplicate: false };
  },
});

export const claim = internalMutation({
  args: { workerId: v.string() },
  handler: async (ctx, { workerId }) => {
    const now = Date.now();
    for (const state of ["preparing", "submitted"] as const) {
      const active = await ctx.db.query("spotTradeOrders").withIndex("by_state_time", q => q.eq("state", state)).collect();
      const leased = active.find(order => (order.leaseUntil ?? 0) > now);
      if (leased) return { locked: true, retryAfter: Math.max(1_000, (leased.leaseUntil ?? now) - now), order: null };
    }

    const submitted = await ctx.db.query("spotTradeOrders").withIndex("by_state_time", q => q.eq("state", "submitted")).order("asc").first();
    const queued = submitted ? null : (await ctx.db.query("spotTradeOrders").withIndex("by_state_time", q => q.eq("state", "queued")).order("asc").collect())
      .find(order => (order.nextAttemptAt ?? 0) <= now) ?? null;
    const order = submitted ?? queued;
    if (!order) return { locked: false, retryAfter: 0, order: null };
    await ctx.db.patch(order._id, {
      state: order.txHash ? "submitted" : "preparing",
      workerId, leaseUntil: now + ACTIVE_LEASE_MS, updatedAt: now,
      attempts: order.txHash ? order.attempts : order.attempts + 1,
      error: undefined,
    });
    return { locked: false, retryAfter: 0, order: { ...order, state: order.txHash ? "submitted" : "preparing", workerId, leaseUntil: now + ACTIVE_LEASE_MS, attempts: order.txHash ? order.attempts : order.attempts + 1 } };
  },
});

export const markSubmitted = internalMutation({
  args: { orderId: v.id("spotTradeOrders"), workerId: v.string(), txHash: v.string(), signedTransaction: v.string(), amountInUsd: v.float64() },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order || order.workerId !== args.workerId) throw new Error("Spot order lease was lost");
    const now = Date.now();
    await ctx.db.patch(order._id, { state: "submitted", txHash: args.txHash.toLowerCase(), signedTransaction: args.signedTransaction, submittedAt: now, amountInUsd: args.amountInUsd, updatedAt: now, leaseUntil: now + ACTIVE_LEASE_MS });
  },
});

export const complete = internalMutation({
  args: { orderId: v.id("spotTradeOrders"), workerId: v.string(), txHash: v.string(), netAmountOut: v.string(), amountInUsd: v.float64() },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order || order.workerId !== args.workerId) throw new Error("Spot order lease was lost");
    await ctx.db.patch(order._id, { state: "confirmed", txHash: args.txHash.toLowerCase(), signedTransaction: undefined, netAmountOut: args.netAmountOut, amountInUsd: args.amountInUsd, updatedAt: Date.now(), leaseUntil: undefined, workerId: undefined, error: undefined });
  },
});

export const release = internalMutation({
  args: { orderId: v.id("spotTradeOrders"), workerId: v.string(), error: v.string(), terminal: v.boolean() },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order || order.workerId !== args.workerId) return;
    const now = Date.now();
    const nonceConsumed = /nonce too low|nonce has already been used|replacement transaction underpriced/i.test(args.error);
    if (order.txHash && nonceConsumed && !args.terminal && now - (order.submittedAt ?? now) >= 15_000) {
      await ctx.db.patch(order._id, { state: "queued", txHash: undefined, signedTransaction: undefined, submittedAt: undefined, error: args.error, updatedAt: now, nextAttemptAt: now + 1_000, leaseUntil: undefined, workerId: undefined });
      return;
    }
    if (order.txHash && !args.terminal) {
      await ctx.db.patch(order._id, { state: "submitted", error: args.error, updatedAt: now, leaseUntil: undefined, workerId: undefined });
      return;
    }
    const terminal = args.terminal || order.attempts >= 6;
    const delay = Math.min(30_000, 1_000 * 2 ** Math.max(0, order.attempts - 1));
    await ctx.db.patch(order._id, {
      state: terminal ? "failed" : "queued", error: args.error, updatedAt: now,
      nextAttemptAt: terminal ? undefined : now + delay, leaseUntil: undefined, workerId: undefined,
    });
  },
});

export const getInternal = internalQuery({
  args: { orderId: v.id("spotTradeOrders") },
  handler: (ctx, args) => ctx.db.get(args.orderId),
});

export const listForAccount = query({
  args: { account: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db.query("spotTradeOrders").withIndex("by_account_time", q => q.eq("account", args.account.toLowerCase())).order("desc").take(30);
    return rows.map(({ orderKey: _orderKey, workerId: _workerId, leaseUntil: _leaseUntil, signedTransaction: _signedTransaction, ...order }) => order);
  },
});
