import { internalAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

/**
 * Daily cleanup of the tables that would otherwise grow forever. Nothing about balances, rewards, payouts or XP is
 * touched; those are kept for good. Each mutation deletes at most BATCH rows and says whether there is more, and the
 * action calls it again until it is done, so no single transaction gets large.
 */

/** Notifications (the bell and the alert inbox) older than this are deleted. */
export const ALERT_EVENTS_KEEP_MS = 90 * 86_400_000;
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
    let alerts = 0, sessions = 0, messages = 0;
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
    console.log(`cleanup: ${alerts} old notifications, ${sessions} expired sessions, ${messages} old chat messages deleted`);
  },
});
