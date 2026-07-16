import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { keccak256 } from "viem";
import type { Hex } from "viem";

// How many due schedules to process in a single minute tick.
const TICK_BATCH = 25;

function assertOwner(requestKeyHash: string, requestKey: string) {
  if (!/^0x[0-9a-fA-F]{64}$/.test(requestKey)) throw new Error("This device is not authorized");
  if (keccak256(requestKey as Hex).toLowerCase() !== requestKeyHash.toLowerCase()) throw new Error("This device is not authorized for this schedule");
}

// ── Internal storage used by the actions/cron ────────────────────────────────

export const insertSchedule = internalMutation({
  args: {
    account: v.string(), owner: v.string(), chainId: v.float64(),
    tokenIn: v.string(), tokenOut: v.string(), tokenInSymbol: v.string(), tokenOutSymbol: v.string(),
    tokenOutImage: v.optional(v.string()), amountIn: v.string(), amountUsd: v.float64(),
    intervalMs: v.float64(), requestKeyHash: v.string(), maxRuns: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const id = await ctx.db.insert("spotTradeSchedules", {
      ...args,
      account: args.account.toLowerCase(), owner: args.owner.toLowerCase(),
      tokenIn: args.tokenIn.toLowerCase(), tokenOut: args.tokenOut.toLowerCase(),
      enabled: true, nextRunAt: now, runsCompleted: 0, createdAt: now, updatedAt: now,
    });
    return { id };
  },
});

export const getSchedule = internalQuery({
  args: { scheduleId: v.id("spotTradeSchedules") },
  handler: (ctx, args) => ctx.db.get(args.scheduleId),
});

export const recordRun = internalMutation({
  args: { scheduleId: v.id("spotTradeSchedules") },
  handler: async (ctx, { scheduleId }) => {
    const schedule = await ctx.db.get(scheduleId);
    if (schedule) await ctx.db.patch(scheduleId, { lastError: undefined, updatedAt: Date.now() });
  },
});

export const recordError = internalMutation({
  args: { scheduleId: v.id("spotTradeSchedules"), error: v.string() },
  handler: async (ctx, { scheduleId, error }) => {
    const schedule = await ctx.db.get(scheduleId);
    if (schedule) await ctx.db.patch(scheduleId, { lastError: error, updatedAt: Date.now() });
  },
});

// Advance every due schedule and hand each run to an action (which sizes the
// trade and enqueues it). nextRunAt is advanced here, before the action runs,
// so a slow run never gets picked up twice by the next tick.
export const tick = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const due = await ctx.db.query("spotTradeSchedules")
      .withIndex("by_enabled_next", q => q.eq("enabled", true).lte("nextRunAt", now))
      .take(TICK_BATCH);
    for (const schedule of due) {
      const runIndex = schedule.runsCompleted;
      const reachedMax = schedule.maxRuns !== undefined && runIndex + 1 >= schedule.maxRuns;
      await ctx.db.patch(schedule._id, {
        nextRunAt: now + schedule.intervalMs, lastRunAt: now,
        runsCompleted: runIndex + 1, enabled: !reachedMax, updatedAt: now,
      });
      await ctx.scheduler.runAfter(0, internal.dcaActions.enqueueRun, { scheduleId: schedule._id, runIndex });
    }
    return { due: due.length };
  },
});

// ── Public API used by the panel ─────────────────────────────────────────────

export const listForAccount = query({
  args: { account: v.string() },
  handler: async (ctx, { account }) => {
    const rows = await ctx.db.query("spotTradeSchedules").withIndex("by_account", q => q.eq("account", account.toLowerCase())).collect();
    return rows
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(({ requestKeyHash: _hash, ...row }) => row);
  },
});

export const setEnabled = mutation({
  args: { scheduleId: v.id("spotTradeSchedules"), requestKey: v.string(), enabled: v.boolean() },
  handler: async (ctx, { scheduleId, requestKey, enabled }) => {
    const schedule = await ctx.db.get(scheduleId);
    if (!schedule) throw new Error("Schedule not found");
    assertOwner(schedule.requestKeyHash, requestKey);
    const now = Date.now();
    // Resuming a paused schedule runs on the next tick rather than back-firing
    // every interval it slept through.
    await ctx.db.patch(scheduleId, { enabled, nextRunAt: enabled ? now : schedule.nextRunAt, lastError: undefined, updatedAt: now });
    return { enabled };
  },
});

export const remove = mutation({
  args: { scheduleId: v.id("spotTradeSchedules"), requestKey: v.string() },
  handler: async (ctx, { scheduleId, requestKey }) => {
    const schedule = await ctx.db.get(scheduleId);
    if (!schedule) return { removed: false };
    assertOwner(schedule.requestKeyHash, requestKey);
    await ctx.db.delete(scheduleId);
    return { removed: true };
  },
});
