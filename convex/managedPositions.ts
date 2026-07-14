import { internalMutation, internalQuery, query } from "./_generated/server";
import { v } from "convex/values";

const registration = {
  chainId: v.float64(), owner: v.string(), account: v.string(), positionManager: v.string(),
  positionId: v.string(), pool: v.string(), token0: v.string(), token1: v.string(), fee: v.float64(),
  tickLower: v.float64(), tickUpper: v.float64(), targetTickWidth: v.float64(),
  minimumAllowedTick: v.float64(), maximumAllowedTick: v.float64(), maxSlippageBps: v.float64(),
  maxSwapBps: v.float64(), twapSeconds: v.float64(), minRebalanceInterval: v.float64(),
  expiresAt: v.float64(), source: v.string(),
};

const normalize = (value: string) => value.toLowerCase();
const positionKey = (chainId: number, manager: string, positionId: string) =>
  `${chainId}:${normalize(manager)}:${positionId}`;

export const upsert = internalMutation({
  args: registration,
  handler: async (ctx, args) => {
    const now = Date.now();
    const key = positionKey(args.chainId, args.positionManager, args.positionId);
    const existing = await ctx.db.query("managedLpPositions").withIndex("by_key", q => q.eq("key", key)).unique();
    const row = {
      ...args,
      owner: normalize(args.owner), account: normalize(args.account), positionManager: normalize(args.positionManager),
      pool: normalize(args.pool), token0: normalize(args.token0), token1: normalize(args.token1),
      key, status: "pending_verification", enabled: true, updatedAt: now, nextCheckAt: now,
      lastError: undefined,
    };
    if (existing) {
      // Reconciliation refreshes the trusted static snapshot without erasing
      // the monitor's live status, retry schedule or last on-chain result.
      const { status: _status, enabled: _enabled, nextCheckAt: _nextCheckAt, lastError: _lastError, ...staticRow } = row;
      await ctx.db.patch(existing._id, staticRow);
    } else {
      await ctx.db.insert("managedLpPositions", { ...row, registeredAt: now });
    }
    return key;
  },
});

export const listMine = query({
  args: { owner: v.string() },
  handler: async (ctx, { owner }) => ctx.db.query("managedLpPositions")
    .withIndex("by_owner", q => q.eq("owner", normalize(owner))).collect(),
});

export const due = internalQuery({
  args: { now: v.float64(), limit: v.float64() },
  handler: async (ctx, { now, limit }) => (await ctx.db.query("managedLpPositions")
    .withIndex("by_due", q => q.lte("nextCheckAt", now)).take(limit))
    .filter(row => row.enabled),
});

export const saveCheck = internalMutation({
  args: {
    key: v.string(), positionId: v.optional(v.string()), tickLower: v.optional(v.float64()),
    tickUpper: v.optional(v.float64()), currentTick: v.optional(v.float64()), status: v.string(),
    enabled: v.boolean(), nextCheckAt: v.float64(), lastRebalanceAt: v.optional(v.float64()),
    error: v.optional(v.string()), queueRebalance: v.boolean(),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.query("managedLpPositions").withIndex("by_key", q => q.eq("key", args.key)).unique();
    if (!row) return;
    const now = Date.now();
    await ctx.db.patch(row._id, {
      ...(args.positionId ? { positionId: args.positionId } : {}),
      ...(args.tickLower != null ? { tickLower: args.tickLower } : {}),
      ...(args.tickUpper != null ? { tickUpper: args.tickUpper } : {}),
      ...(args.currentTick != null ? { currentTick: args.currentTick } : {}),
      status: args.status, enabled: args.enabled, nextCheckAt: args.nextCheckAt,
      lastCheckedAt: now, updatedAt: now, lastRebalanceAt: args.lastRebalanceAt, lastError: args.error,
    });
    if (!args.queueRebalance) return;
    const jobs = await ctx.db.query("rebalanceJobs").withIndex("by_position", q => q.eq("positionKey", args.key)).collect();
    if (jobs.some(job => job.state === "pending" || job.state === "running")) return;
    await ctx.db.insert("rebalanceJobs", {
      positionKey: args.key, chainId: row.chainId, account: row.account,
      positionManager: row.positionManager, positionId: args.positionId ?? row.positionId,
      state: "pending", requestedAt: now, updatedAt: now, attempts: 0,
    });
  },
});
