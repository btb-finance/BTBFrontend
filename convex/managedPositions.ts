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
    const policyChanged = existing && (
      existing.targetTickWidth !== args.targetTickWidth || existing.minimumAllowedTick !== args.minimumAllowedTick
      || existing.maximumAllowedTick !== args.maximumAllowedTick || existing.maxSlippageBps !== args.maxSlippageBps
      || existing.maxSwapBps !== args.maxSwapBps || existing.twapSeconds !== args.twapSeconds
      || existing.minRebalanceInterval !== args.minRebalanceInterval || existing.expiresAt !== args.expiresAt
    );
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
      if (policyChanged) {
        const jobs = await ctx.db.query("rebalanceJobs").withIndex("by_position", q => q.eq("positionKey", key)).collect();
        for (const job of jobs) {
          if (job.state === "blocked" || job.state === "failed") {
            await ctx.db.patch(job._id, { state: "superseded", updatedAt: now });
          }
        }
      }
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
    if (!row) return false;
    const now = Date.now();
    await ctx.db.patch(row._id, {
      ...(args.positionId ? { positionId: args.positionId } : {}),
      ...(args.tickLower != null ? { tickLower: args.tickLower } : {}),
      ...(args.tickUpper != null ? { tickUpper: args.tickUpper } : {}),
      ...(args.currentTick != null ? { currentTick: args.currentTick } : {}),
      status: args.status, enabled: args.enabled, nextCheckAt: args.nextCheckAt,
      lastCheckedAt: now, updatedAt: now, lastRebalanceAt: args.lastRebalanceAt, lastError: args.error,
    });
    if (!args.queueRebalance) return false;
    const jobs = await ctx.db.query("rebalanceJobs").withIndex("by_position", q => q.eq("positionKey", args.key)).collect();
    if (jobs.some(job => ["pending", "running", "broadcast", "blocked", "failed"].includes(job.state))) return false;
    await ctx.db.insert("rebalanceJobs", {
      positionKey: args.key, chainId: row.chainId, account: row.account,
      positionManager: row.positionManager, positionId: args.positionId ?? row.positionId,
      state: "pending", requestedAt: now, updatedAt: now, attempts: 0,
      nextAttemptAt: now,
    });
    return true;
  },
});

export const claimNextJob = internalMutation({
  args: { now: v.float64() },
  handler: async (ctx, { now }) => {
    const active = await ctx.db.query("rebalanceJobs").withIndex("by_state", q => q.eq("state", "broadcast")).take(1);
    if (active[0]) return active[0];
    const pending = await ctx.db.query("rebalanceJobs").withIndex("by_state", q => q.eq("state", "pending")).take(50);
    const job = pending.find(item => (item.nextAttemptAt ?? 0) <= now);
    if (!job) return null;
    await ctx.db.patch(job._id, { state: "running", attempts: job.attempts + 1, updatedAt: now, error: undefined });
    return { ...job, state: "running", attempts: job.attempts + 1, updatedAt: now };
  },
});

export const positionForJob = internalQuery({
  args: { key: v.string() },
  handler: async (ctx, { key }) => ctx.db.query("managedLpPositions").withIndex("by_key", q => q.eq("key", key)).unique(),
});

export const recordBroadcast = internalMutation({
  args: { jobId: v.id("rebalanceJobs"), txHash: v.string(), signedTransaction: v.string(), newPositionId: v.string(), now: v.float64() },
  handler: async (ctx, args) => ctx.db.patch(args.jobId, {
    state: "broadcast", txHash: args.txHash, signedTransaction: args.signedTransaction,
    newPositionId: args.newPositionId, updatedAt: args.now,
  }),
});

export const completeJob = internalMutation({
  args: {
    jobId: v.id("rebalanceJobs"), oldKey: v.string(), newPositionId: v.string(),
    tickLower: v.float64(), tickUpper: v.float64(), txHash: v.string(), now: v.float64(),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    const row = await ctx.db.query("managedLpPositions").withIndex("by_key", q => q.eq("key", args.oldKey)).unique();
    if (row) {
      const newKey = positionKey(row.chainId, row.positionManager, args.newPositionId);
      await ctx.db.patch(row._id, {
        key: newKey, positionId: args.newPositionId, tickLower: args.tickLower, tickUpper: args.tickUpper,
        status: "pending_verification", enabled: true, nextCheckAt: args.now,
        lastRebalanceAt: args.now, lastCheckedAt: args.now, updatedAt: args.now, lastError: undefined,
      });
    }
    if (job) await ctx.db.patch(job._id, {
      state: "succeeded", txHash: args.txHash, signedTransaction: undefined, updatedAt: args.now, error: undefined,
    });
  },
});

export const skipJob = internalMutation({
  args: { jobId: v.id("rebalanceJobs"), positionKey: v.string(), status: v.string(), now: v.float64() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, { state: "skipped", updatedAt: args.now, error: undefined });
    const row = await ctx.db.query("managedLpPositions").withIndex("by_key", q => q.eq("key", args.positionKey)).unique();
    if (row) await ctx.db.patch(row._id, { status: args.status, nextCheckAt: args.now + 60_000, updatedAt: args.now });
  },
});

export const failJob = internalMutation({
  args: { jobId: v.id("rebalanceJobs"), positionKey: v.string(), error: v.string(), retryable: v.boolean(), now: v.float64() },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return;
    // Pre-broadcast failures remain retryable with capped backoff. Once a
    // signed transaction was broadcast, a revert is terminal for those exact
    // bytes and requires a fresh monitor cycle or an owner rule change.
    const retry = args.retryable && !job.txHash;
    const delay = Math.min(60_000 * (2 ** Math.max(job.attempts - 1, 0)), 15 * 60_000);
    await ctx.db.patch(job._id, {
      state: retry ? "pending" : args.retryable ? "failed" : "blocked",
      nextAttemptAt: retry ? args.now + delay : undefined,
      signedTransaction: retry ? job.signedTransaction : undefined,
      updatedAt: args.now, error: args.error,
    });
    const row = await ctx.db.query("managedLpPositions").withIndex("by_key", q => q.eq("key", args.positionKey)).unique();
    if (row) await ctx.db.patch(row._id, {
      status: retry ? "rebalance_retrying" : args.retryable ? "rebalance_failed" : "policy_action_required",
      lastError: args.error, nextCheckAt: args.now + (retry ? delay : 5 * 60_000), updatedAt: args.now,
    });
  },
});
