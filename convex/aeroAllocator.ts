/**
 * Aero allocator data (2026-10-27): every Aero gauge on Base with what it pays per day, rebuilt hourly so the Allocate page
 * reads one row instead of every visitor making a few hundred chain reads. The work is in src/lib/aero/allocatorSnapshot.ts.
 */
import { type ActionCtx, internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { addCredit, spendCredit } from "./credit";
import { sessionWallet } from "./sessions";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { PublicClient } from "viem";
import { loadLiveRpcs } from "./liveRpcs";
import { getChainClient } from "../src/lib/chainClient";
import { AERO_CHAIN_ID, REFRESH_BTB, REFRESH_MIN_AGE_MS, type FeeLedger } from "../src/lib/aero/allocator";
import { baseLogClient, buildSnapshot } from "../src/lib/aero/allocatorSnapshot";

/** The page's data: `json` is an AllocatorSnapshot. */
export const snapshot = query({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db.query("aeroAllocator").withIndex("by_key", (q) => q.eq("key", "snapshot")).first();
    return row ? { json: row.json, updatedAt: row.updatedAt } : null;
  },
});

export const getLedger = internalQuery({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db.query("aeroAllocator").withIndex("by_key", (q) => q.eq("key", "ledger")).first();
    return row?.json ?? null;
  },
});

export const save = internalMutation({
  args: { key: v.string(), json: v.string() },
  handler: async (ctx, { key, json }) => {
    const row = await ctx.db.query("aeroAllocator").withIndex("by_key", (q) => q.eq("key", key)).first();
    if (row) await ctx.db.patch(row._id, { json, updatedAt: Date.now() });
    else await ctx.db.insert("aeroAllocator", { key, json, updatedAt: Date.now() });
  },
});

/** A paid refresh in progress: who paid and when, so a second payment waits and a failure is refunded. */
type RefreshState = { by: string; startedAt: number } | null;
const RUN_TIMEOUT_MS = 10 * 60_000;

/** When the data was built and whether a paid refresh is running, for the line at the top of the page. */
export const status = query({
  args: {},
  handler: async (ctx) => {
    const snap = await ctx.db.query("aeroAllocator").withIndex("by_key", (q) => q.eq("key", "snapshot")).first();
    const run = await ctx.db.query("aeroAllocator").withIndex("by_key", (q) => q.eq("key", "refresh")).first();
    const state = run ? (JSON.parse(run.json) as RefreshState) : null;
    return {
      updatedAt: snap?.updatedAt ?? null,
      refreshing: !!state && Date.now() - state.startedAt < RUN_TIMEOUT_MS,
      price: REFRESH_BTB,
    };
  },
});

/**
 * Pay REFRESH_BTB from the in-app balance to rebuild the data now. Acts only for the wallet of the caller's signed
 * session. Refused, with nothing taken, while a refresh is running or when the data is only minutes old.
 */
export const payRefresh = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }): Promise<{ ok: true } | { ok: false; reason: string }> => {
    const wallet = await sessionWallet(ctx, sessionToken);
    if (!wallet) return { ok: false, reason: "Your sign-in expired. Sign in again." };
    const snap = await ctx.db.query("aeroAllocator").withIndex("by_key", (q) => q.eq("key", "snapshot")).first();
    if (snap && Date.now() - snap.updatedAt < REFRESH_MIN_AGE_MS) return { ok: false, reason: "The data was refreshed minutes ago. Nothing newer to get yet." };
    const run = await ctx.db.query("aeroAllocator").withIndex("by_key", (q) => q.eq("key", "refresh")).first();
    const state = run ? (JSON.parse(run.json) as RefreshState) : null;
    if (state && Date.now() - state.startedAt < RUN_TIMEOUT_MS) return { ok: false, reason: "A refresh is already running. It takes about a minute." };
    if (!(await spendCredit(ctx, wallet, REFRESH_BTB))) {
      return { ok: false, reason: `Not enough BTB in your app balance. A refresh costs ${REFRESH_BTB.toLocaleString("en-US")} BTB.` };
    }
    const next: RefreshState = { by: wallet, startedAt: Date.now() };
    if (run) await ctx.db.patch(run._id, { json: JSON.stringify(next), updatedAt: Date.now() });
    else await ctx.db.insert("aeroAllocator", { key: "refresh", json: JSON.stringify(next), updatedAt: Date.now() });
    await ctx.scheduler.runAfter(0, internal.aeroAllocator.refresh, { paidBy: wallet, startedAt: next.startedAt });
    return { ok: true };
  },
});

/** Ends a paid refresh; a failed one gives the BTB back, once. */
export const finishPaid = internalMutation({
  args: { by: v.string(), startedAt: v.float64(), failed: v.boolean() },
  handler: async (ctx, { by, startedAt, failed }) => {
    const run = await ctx.db.query("aeroAllocator").withIndex("by_key", (q) => q.eq("key", "refresh")).first();
    if (run) await ctx.db.patch(run._id, { json: "null", updatedAt: Date.now() });
    if (failed) await addCredit(ctx, by, REFRESH_BTB, `aeroRefresh:${by}:${startedAt}`, "payment");
  },
});

export const refresh = internalAction({
  args: { paidBy: v.optional(v.string()), startedAt: v.optional(v.float64()) },
  handler: async (ctx, { paidBy, startedAt }) => {
    if (!paidBy) return build(ctx);
    let failed = false;
    try { await build(ctx); } catch (e) { failed = true; throw e; } finally {
      await ctx.runMutation(internal.aeroAllocator.finishPaid, { by: paidBy, startedAt: startedAt ?? 0, failed });
    }
  },
});

async function build(ctx: ActionCtx) {
    await loadLiveRpcs(ctx);
    const client = getChainClient(AERO_CHAIN_ID);
    if (!client) throw new Error("No Base client");
    const raw = await ctx.runQuery(internal.aeroAllocator.getLedger, {});
    const ledger = raw ? (JSON.parse(raw) as FeeLedger) : null;
    const built = await buildSnapshot(client as PublicClient, baseLogClient(), ledger);
    await ctx.runMutation(internal.aeroAllocator.save, { key: "ledger", json: JSON.stringify(built.ledger) });
    await ctx.runMutation(internal.aeroAllocator.save, { key: "snapshot", json: JSON.stringify(built.snapshot) });
}
