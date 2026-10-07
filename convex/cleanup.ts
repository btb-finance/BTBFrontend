import { internalAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { epochIdAt } from "./xpRules";

/**
 * Daily cleanup of the tables that would otherwise grow forever. Balances, payouts and weekly XP history are kept for
 * good; a wallet's own record goes only after 90 days with no check-in and no XP (dropInactiveWallets). Each mutation deletes at most BATCH rows and says whether there is more, and the
 * action calls it again until it is done, so no single transaction gets large.
 */

/** Notifications (the bell and the alert inbox) older than this are deleted. */
export const ALERT_EVENTS_KEEP_MS = 90 * 86_400_000;
/** A wallet with no check-in and no XP of any kind for this long is forgotten (see dropInactiveWallets). */
export const INACTIVE_WALLET_MS = 90 * 86_400_000;
/** Payout states that are finished; anything else (claimable, queued, sending, failed…) keeps the wallet. */
const PAYOUT_DONE = new Set(["confirmed", "expired", "alerts"]);

/** The most recent this many BTB Agent chat messages per wallet are kept. */
export const AGENT_MESSAGES_KEEP = 200;
const BATCH = 500;
const MAX_ROUNDS = 200;

export const dropOldAlertEvents = internalMutation({
  args: {},
  handler: async (ctx) => {
    const old = await ctx.db.query("alertEvents").withIndex("by_created", (q) => q.lt("createdAt", Date.now() - ALERT_EVENTS_KEEP_MS)).take(BATCH);
    for (const r of old) await ctx.db.delete(r._id);
    return { deleted: old.length, more: old.length === BATCH };
  },
});

/**
 * Forgets wallets that have been gone for 90 days: no check-in (or, never checked in, joined over 90 days ago) and no
 * XP of any kind in the last 13 weekly epochs. Removes the wallet's record (its XP total, streak and who invited it),
 * its once-a-day award markers and its cached token balances. A returning wallet simply starts fresh.
 *
 * Never removed, whatever the dates: a wallet with BTB in the app, a Friday share not yet claimed or still being sent,
 * an active auto-rebalance or alert, or a quest waiting for review. Weekly XP and payout history stay for good.
 * `dryRun` counts without deleting.
 */
export const dropInactiveWallets = internalMutation({
  args: { cursor: v.union(v.string(), v.null()), dryRun: v.optional(v.boolean()) },
  handler: async (ctx, { cursor, dryRun }) => {
    const now = Date.now(), cutoff = now - INACTIVE_WALLET_MS, epochNow = epochIdAt(now);
    const page = await ctx.db.query("users").paginate({ cursor, numItems: 100 });
    let deleted = 0, kept = 0;
    for (const u of page.page) {
      if ((u.lastCheckIn ?? u.joinedAt) >= cutoff) continue;
      const addr = u.walletAddress;
      let recentXp = false;
      for (let e = epochNow - 12; e <= epochNow && !recentXp; e++) {
        const row = await ctx.db.query("epochPoints").withIndex("by_epoch_wallet", (q) => q.eq("epochId", e).eq("walletAddress", addr)).unique();
        recentXp = !!row && row.points > 0;
      }
      if (recentXp) continue;
      const credit = await ctx.db.query("alertCredits").withIndex("by_address", (q) => q.eq("address", addr)).first();
      const payouts = await ctx.db.query("rewardPayouts").withIndex("by_wallet", (q) => q.eq("walletAddress", addr)).collect();
      const jobs = await ctx.db.query("autoRebalances").withIndex("by_address", (q) => q.eq("address", addr)).collect();
      const alerts = await ctx.db.query("positionAlerts").withIndex("by_address", (q) => q.eq("address", addr)).collect();
      const quests = await ctx.db.query("questSubmissions").withIndex("by_wallet", (q) => q.eq("walletAddress", addr)).collect();
      if ((credit?.balance ?? 0) > 0 || payouts.some((p) => !PAYOUT_DONE.has(p.state)) || jobs.some((j) => j.active)
        || alerts.some((a) => a.active) || quests.some((s) => s.status === "pending")) { kept++; continue; }
      deleted++;
      if (dryRun) continue;
      for (const r of await ctx.db.query("dailyAwards").withIndex("by_wallet_day_key", (q) => q.eq("walletAddress", addr)).collect()) await ctx.db.delete(r._id);
      for (const r of await ctx.db.query("userTokenBalances").withIndex("by_wallet", (q) => q.eq("walletAddress", addr)).collect()) await ctx.db.delete(r._id);
      await ctx.db.delete(u._id);
    }
    return { deleted, kept, cursor: page.isDone ? null : page.continueCursor };
  },
});

export const dropExpiredSessions = internalMutation({
  args: {},
  handler: async (ctx) => {
    const old = await ctx.db.query("sessions").withIndex("by_expires", (q) => q.lt("expiresAt", Date.now())).take(BATCH);
    for (const r of old) await ctx.db.delete(r._id);
    return { deleted: old.length, more: old.length === BATCH };
  },
});

/**
 * Walks the chat history newest first, wallet by wallet (the by_wallet index in descending order), keeping each
 * wallet's first AGENT_MESSAGES_KEEP rows and deleting the rest. `wallet` and `kept` carry the count across pages.
 */
export const trimAgentMessages = internalMutation({
  args: { cursor: v.union(v.string(), v.null()), wallet: v.union(v.string(), v.null()), kept: v.float64() },
  handler: async (ctx, a) => {
    const page = await ctx.db.query("agentMessages").withIndex("by_wallet").order("desc").paginate({ cursor: a.cursor, numItems: BATCH });
    let { wallet, kept } = a;
    let deleted = 0;
    for (const r of page.page) {
      if (r.walletAddress !== wallet) { wallet = r.walletAddress; kept = 0; }
      if (kept < AGENT_MESSAGES_KEEP) kept++;
      else { await ctx.db.delete(r._id); deleted++; }
    }
    return { deleted, cursor: page.isDone ? null : page.continueCursor, wallet, kept };
  },
});

export const daily = internalAction({
  args: {},
  handler: async (ctx) => {
    let alerts = 0, sessions = 0, messages = 0, wallets = 0;
    for (let i = 0; i < MAX_ROUNDS; i++) {
      const r = await ctx.runMutation(internal.cleanup.dropOldAlertEvents, {});
      alerts += r.deleted;
      if (!r.more) break;
    }
    for (let i = 0; i < MAX_ROUNDS; i++) {
      const r = await ctx.runMutation(internal.cleanup.dropExpiredSessions, {});
      sessions += r.deleted;
      if (!r.more) break;
    }
    let state: { cursor: string | null; wallet: string | null; kept: number } = { cursor: null, wallet: null, kept: 0 };
    for (let i = 0; i < MAX_ROUNDS; i++) {
      const r = await ctx.runMutation(internal.cleanup.trimAgentMessages, state);
      messages += r.deleted;
      if (!r.cursor) break;
      state = { cursor: r.cursor, wallet: r.wallet, kept: r.kept };
    }
    let walletCursor: string | null = null;
    for (let i = 0; i < MAX_ROUNDS; i++) {
      const r: { deleted: number; cursor: string | null } = await ctx.runMutation(internal.cleanup.dropInactiveWallets, { cursor: walletCursor });
      wallets += r.deleted;
      if (!r.cursor) break;
      walletCursor = r.cursor;
    }
    console.log(`cleanup: ${alerts} old notifications, ${sessions} expired sessions, ${messages} old chat messages, ${wallets} wallets inactive 90 days deleted`);
  },
});
