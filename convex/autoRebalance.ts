import { query, mutation, internalMutation, internalQuery, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { availableFor, spendCredit } from "./credit";
import { sessionWallet } from "./sessions";
import { CHECK_INTERVALS, CHECK_BTB, rebalanceBtb } from "./autoRebalanceConfig";

/**
 * Auto-rebalance bookkeeping. A row is one position the owner moved into their
 * V6 wallet. Each row's next check is scheduled on its own (no polling), and
 * every reschedule bumps `gen` so an older scheduled check for the row does
 * nothing. Checks and rebalances are charged from the BTB balance only after
 * they succeed.
 */

const validInterval = (min: number) => (CHECK_INTERVALS as readonly number[]).includes(min);

/** Point the row at its next check and schedule it; any earlier schedule becomes a no-op. */
async function schedule(ctx: MutationCtx, row: Doc<"autoRebalances">, at: number, patch: Partial<Doc<"autoRebalances">> = {}) {
  const gen = row.gen + 1;
  await ctx.db.patch(row._id, { ...patch, nextCheckAt: at, gen, updatedAt: Date.now() });
  await ctx.scheduler.runAt(at, internal.autoRebalanceActions.check, { id: row._id, gen });
}

async function ownedRow(ctx: MutationCtx, sessionToken: string, id: Id<"autoRebalances">) {
  const wallet = await sessionWallet(ctx, sessionToken);
  if (!wallet) return { error: "Your sign-in expired. Sign in again." } as const;
  const row = await ctx.db.get(id);
  if (!row || row.address !== wallet) return { error: "Not found." } as const;
  return { row } as const;
}

// ── Reads for the app ───────────────────────────────────────────────────────

export const listForAddress = query({
  args: { address: v.string() },
  handler: async (ctx, { address }) => {
    const a = address.toLowerCase();
    const rows = await ctx.db.query("autoRebalances").withIndex("by_address", (q) => q.eq("address", a)).collect();
    const { total } = await availableFor(ctx, a);
    return {
      balance: total,
      jobs: rows.filter((r) => r.status !== "stopped").map((r) => ({
        id: r._id, chainId: r.chainId, wallet: r.wallet, positionManager: r.positionManager, tokenId: r.tokenId,
        label: r.label, gauge: r.gauge ?? null, intervalMin: r.intervalMin, active: r.active, status: r.status,
        note: r.note ?? null, lastInRange: r.lastInRange ?? null, lastCheckedAt: r.lastCheckedAt ?? null,
        lastRebalancedAt: r.lastRebalancedAt ?? null, nextCheckAt: r.active ? r.nextCheckAt : null,
        checks: r.checks, rebalances: r.rebalances, spentBtb: r.spentBtb, rebalanceBtb: rebalanceBtb(r.chainId),
      })),
    };
  },
});

// ── Owner controls (session-signed) ─────────────────────────────────────────

export const changeInterval = mutation({
  args: { sessionToken: v.string(), id: v.id("autoRebalances"), intervalMin: v.float64() },
  handler: async (ctx, a) => {
    if (!validInterval(a.intervalMin)) return { ok: false as const, reason: "Pick one of the listed intervals." };
    const r = await ownedRow(ctx, a.sessionToken, a.id);
    if ("error" in r) return { ok: false as const, reason: r.error };
    if (!r.row.active) { await ctx.db.patch(r.row._id, { intervalMin: a.intervalMin, updatedAt: Date.now() }); return { ok: true as const }; }
    const from = r.row.lastCheckedAt ?? Date.now();
    await schedule(ctx, r.row, Math.max(Date.now() + 5_000, from + a.intervalMin * 60_000), { intervalMin: a.intervalMin });
    return { ok: true as const };
  },
});

export const setActive = mutation({
  args: { sessionToken: v.string(), id: v.id("autoRebalances"), active: v.boolean() },
  handler: async (ctx, a) => {
    const r = await ownedRow(ctx, a.sessionToken, a.id);
    if ("error" in r) return { ok: false as const, reason: r.error };
    if (!a.active) {
      await ctx.db.patch(r.row._id, { active: false, status: "paused", note: undefined, gen: r.row.gen + 1, updatedAt: Date.now() });
      return { ok: true as const };
    }
    await schedule(ctx, r.row, Date.now() + 5_000, { active: true, status: "watching", note: undefined, failures: 0 });
    return { ok: true as const };
  },
});

/**
 * Keep the position staked in `gauge` across rebalances (the owner just staked
 * it from the wallet), or stop restaking it (null, after an unstake). The
 * adapter only ever stakes into the live gauge of the position's own pool, so
 * a wrong address here can only make a restake fail, never move anything.
 */
export const setGauge = mutation({
  args: { sessionToken: v.string(), id: v.id("autoRebalances"), gauge: v.union(v.string(), v.null()) },
  handler: async (ctx, a) => {
    if (a.gauge !== null && !/^0x[0-9a-fA-F]{40}$/.test(a.gauge)) return { ok: false as const, reason: "Invalid gauge." };
    const r = await ownedRow(ctx, a.sessionToken, a.id);
    if ("error" in r) return { ok: false as const, reason: r.error };
    await ctx.db.patch(r.row._id, { gauge: a.gauge?.toLowerCase() ?? undefined, updatedAt: Date.now() });
    return { ok: true as const };
  },
});

/** The owner took the position out of the wallet: stop for good. */
export const stop = mutation({
  args: { sessionToken: v.string(), id: v.id("autoRebalances") },
  handler: async (ctx, a) => {
    const r = await ownedRow(ctx, a.sessionToken, a.id);
    if ("error" in r) return { ok: false as const, reason: r.error };
    await ctx.db.patch(r.row._id, { active: false, status: "stopped", gen: r.row.gen + 1, updatedAt: Date.now() });
    return { ok: true as const };
  },
});

// ── Written by the verified enable action ───────────────────────────────────

export const upsertVerified = internalMutation({
  args: {
    address: v.string(), wallet: v.string(), chainId: v.float64(), positionManager: v.string(), tokenId: v.string(),
    label: v.string(), gauge: v.optional(v.string()), intervalMin: v.float64(),
  },
  handler: async (ctx, a) => {
    const address = a.address.toLowerCase();
    const pm = a.positionManager.toLowerCase();
    const now = Date.now();
    const rows = await ctx.db.query("autoRebalances").withIndex("by_address", (q) => q.eq("address", address)).collect();
    const existing = rows.find((r) => r.chainId === a.chainId && r.positionManager === pm && r.tokenId === a.tokenId);
    const fields = {
      wallet: a.wallet.toLowerCase(), label: a.label, gauge: a.gauge?.toLowerCase(), intervalMin: a.intervalMin,
      active: true, status: "watching", note: undefined, failures: 0,
    };
    if (existing) { await schedule(ctx, existing, now + 5_000, fields); return existing._id; }
    const id = await ctx.db.insert("autoRebalances", {
      address, chainId: a.chainId, positionManager: pm, tokenId: a.tokenId, ...fields,
      nextCheckAt: now + 5_000, gen: 0, checks: 0, rebalances: 0, spentBtb: 0, createdAt: now, updatedAt: now,
    });
    const row = (await ctx.db.get(id))!;
    await schedule(ctx, row, now + 5_000);
    return id;
  },
});

// ── Checker plumbing ────────────────────────────────────────────────────────

export const get = internalQuery({
  args: { id: v.id("autoRebalances") },
  handler: (ctx, { id }) => ctx.db.get(id),
});

export const available = internalQuery({
  args: { address: v.string() },
  handler: async (ctx, { address }) => (await availableFor(ctx, address)).total,
});

/**
 * A check read the position. Charges CHECK_BTB unless this is a retry of a
 * check already paid for. Pauses the row, and returns false, when the balance
 * cannot pay for the check.
 */
export const recordCheck = internalMutation({
  args: { id: v.id("autoRebalances"), gen: v.float64(), inRange: v.boolean(), charge: v.boolean() },
  handler: async (ctx, a) => {
    const row = await ctx.db.get(a.id);
    if (!row || row.gen !== a.gen || !row.active) return { ok: false, stale: true };
    if (a.charge && !(await spendCredit(ctx, row.address, CHECK_BTB))) {
      await ctx.db.patch(row._id, { active: false, status: "paused", note: "Your BTB balance ran out. Top up to resume.", updatedAt: Date.now() });
      return { ok: false, stale: false, broke: true };
    }
    await ctx.db.patch(row._id, {
      lastInRange: a.inRange, lastCheckedAt: Date.now(), failures: 0, updatedAt: Date.now(),
      ...(a.charge ? { checks: row.checks + 1, spentBtb: row.spentBtb + CHECK_BTB } : {}),
    });
    return { ok: true, stale: false };
  },
});

/** Where the row stands after a check, and when it is checked next. */
export const settle = internalMutation({
  args: { id: v.id("autoRebalances"), gen: v.float64(), status: v.string(), note: v.optional(v.string()), nextInMs: v.float64(), retry: v.optional(v.boolean()) },
  handler: async (ctx, a) => {
    const row = await ctx.db.get(a.id);
    if (!row || row.gen !== a.gen || !row.active) return;
    const at = Date.now() + a.nextInMs;
    const gen = row.gen + 1;
    await ctx.db.patch(row._id, { status: a.status, note: a.note, nextCheckAt: at, gen, updatedAt: Date.now() });
    await ctx.scheduler.runAt(at, internal.autoRebalanceActions.check, { id: row._id, gen, retry: a.retry });
  },
});

/** A read or transaction failed. Pauses after `max` in a row. */
export const recordFailure = internalMutation({
  args: { id: v.id("autoRebalances"), gen: v.float64(), note: v.string(), max: v.float64(), nextInMs: v.float64() },
  handler: async (ctx, a) => {
    const row = await ctx.db.get(a.id);
    if (!row || row.gen !== a.gen || !row.active) return { paused: false };
    const failures = row.failures + 1;
    if (failures >= a.max) {
      await ctx.db.patch(row._id, { failures, active: false, status: "paused", note: a.note, gen: row.gen + 1, updatedAt: Date.now() });
      return { paused: true };
    }
    const at = Date.now() + a.nextInMs;
    const gen = row.gen + 1;
    await ctx.db.patch(row._id, { failures, note: a.note, nextCheckAt: at, gen, updatedAt: Date.now() });
    await ctx.scheduler.runAt(at, internal.autoRebalanceActions.check, { id: row._id, gen });
    return { paused: false };
  },
});

/** The position left the wallet (the owner took it out): stop quietly. */
export const markGone = internalMutation({
  args: { id: v.id("autoRebalances"), note: v.string() },
  handler: async (ctx, { id, note }) => {
    const row = await ctx.db.get(id);
    if (row) await ctx.db.patch(id, { active: false, status: "stopped", note, gen: row.gen + 1, updatedAt: Date.now() });
  },
});

/** A rebalance landed on-chain: follow the new position and charge for it. */
export const recordRebalance = internalMutation({
  args: { id: v.id("autoRebalances"), newTokenId: v.string(), staked: v.boolean() },
  handler: async (ctx, a) => {
    const row = await ctx.db.get(a.id);
    if (!row) return;
    const cost = rebalanceBtb(row.chainId);
    // Checked before sending; if the balance moved meanwhile, take what is there and pause.
    const paid = await spendCredit(ctx, row.address, cost);
    await ctx.db.patch(row._id, {
      tokenId: a.newTokenId, lastRebalancedAt: Date.now(), lastInRange: true, rebalances: row.rebalances + 1,
      spentBtb: row.spentBtb + (paid ? cost : 0), gauge: a.staked ? row.gauge : undefined, updatedAt: Date.now(),
      ...(paid ? {} : { active: false, status: "paused", note: "Your BTB balance ran out. Top up to resume.", gen: row.gen + 1 }),
    });
  },
});

/** One agent transaction per chain at a time. */
export const acquireLock = internalMutation({
  args: { chainId: v.float64(), ms: v.float64() },
  handler: async (ctx, { chainId, ms }) => {
    const now = Date.now();
    const lock = await ctx.db.query("rebalanceLocks").withIndex("by_chain", (q) => q.eq("chainId", chainId)).unique();
    if (lock && lock.until > now) return false;
    if (lock) await ctx.db.patch(lock._id, { until: now + ms });
    else await ctx.db.insert("rebalanceLocks", { chainId, until: now + ms });
    return true;
  },
});

export const releaseLock = internalMutation({
  args: { chainId: v.float64() },
  handler: async (ctx, { chainId }) => {
    const lock = await ctx.db.query("rebalanceLocks").withIndex("by_chain", (q) => q.eq("chainId", chainId)).unique();
    if (lock) await ctx.db.patch(lock._id, { until: 0 });
  },
});

/** Safety net: an active row whose scheduled check never ran (a restart) is checked again. */
export const sweep = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const overdue = await ctx.db.query("autoRebalances")
      .withIndex("by_active_next", (q) => q.eq("active", true).lt("nextCheckAt", now - 15 * 60_000)).take(200);
    for (const row of overdue) await schedule(ctx, row, now + Math.floor(Math.random() * 60_000));
  },
});
