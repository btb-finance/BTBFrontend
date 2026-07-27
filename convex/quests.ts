import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { QUEST_BY_ID } from "./questCatalog";
import { addEpochPoints, epochIdAt } from "./rewards";
import type { Doc } from "./_generated/dataModel";

const MS_PER_DAY = 86_400_000;
const MAX_PROOF_LENGTH = 500;

/**
 * A submission blocks the same quest again while it is pending or approved.
 * A rejection does not — the user is meant to fix the proof and resubmit.
 */
function blocking(rows: Doc<"questSubmissions">[]) {
  return rows.filter((row) => row.status !== "rejected");
}

/** Start of the window a quest's cadence allows one submission in. */
function windowStart(cadence: string, now: number) {
  if (cadence === "daily") return now - (now % MS_PER_DAY);
  if (cadence === "weekly") return 0; // handled by epoch id, not a timestamp
  return 0;
}

/** Everything the /token quest board needs for one wallet. */
export const listForWallet = query({
  args: { walletAddress: v.optional(v.string()) },
  handler: async (ctx, { walletAddress }) => {
    if (!walletAddress) return [];
    return ctx.db
      .query("questSubmissions")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", walletAddress.toLowerCase()))
      .order("desc")
      .take(200);
  },
});

/**
 * Submit proof for a quest. Nothing is awarded here — every quest in the
 * catalog that accepts a submission is off-chain and unverifiable, so XP is
 * granted only when a reviewer approves it.
 */
export const submit = mutation({
  args: { walletAddress: v.string(), questId: v.string(), proof: v.string() },
  handler: async (ctx, { walletAddress, questId, proof }) => {
    const addr = walletAddress.toLowerCase();
    const quest = QUEST_BY_ID[questId];
    if (!quest) throw new Error("Unknown quest");
    if (quest.verify === "auto") throw new Error("This quest is credited automatically");

    const trimmed = proof.trim();
    if (trimmed.length === 0) throw new Error("Add your proof first");
    if (trimmed.length > MAX_PROOF_LENGTH) throw new Error("Proof is too long");
    if (quest.proof === "url" && !/^https?:\/\/\S+$/i.test(trimmed)) throw new Error("Paste a full link starting with https://");

    const user = await ctx.db
      .query("users")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", addr))
      .unique();
    if (!user) throw new Error("User not registered");

    const now = Date.now();
    const previous = await ctx.db
      .query("questSubmissions")
      .withIndex("by_wallet_quest", (q) => q.eq("walletAddress", addr).eq("questId", questId))
      .collect();
    const open = blocking(previous);

    if (quest.cadence === "once" && open.length > 0) {
      throw new Error(open[0].status === "pending" ? "Already submitted — waiting on review" : "Already completed");
    }
    if (quest.cadence === "daily") {
      const since = windowStart("daily", now);
      if (open.some((row) => row.submittedAt >= since)) throw new Error("Already submitted today");
    }
    if (quest.cadence === "weekly") {
      const epochId = epochIdAt(now);
      if (open.some((row) => epochIdAt(row.submittedAt) === epochId)) throw new Error("Already submitted this week");
    }

    const id = await ctx.db.insert("questSubmissions", {
      walletAddress: addr, questId, proof: trimmed,
      xp: quest.xp, status: "pending", submittedAt: now,
    });
    return { id, status: "pending" as const };
  },
});

/**
 * Approve or reject a submission. Internal only — call it from the Convex
 * dashboard; there is no admin UI and no client path to it.
 *
 * Approval credits both the lifetime counter and the current epoch ledger, so
 * XP lands in the week it is reviewed, not the week it was submitted.
 */
export const review = internalMutation({
  args: {
    submissionId: v.id("questSubmissions"),
    approve: v.boolean(),
    note: v.optional(v.string()),
    xpOverride: v.optional(v.float64()),
  },
  handler: async (ctx, { submissionId, approve, note, xpOverride }) => {
    const submission = await ctx.db.get(submissionId);
    if (!submission) throw new Error("Submission not found");
    if (submission.status !== "pending") return { skipped: true, status: submission.status };

    const now = Date.now();
    if (!approve) {
      await ctx.db.patch(submissionId, { status: "rejected", reviewedAt: now, reviewNote: note });
      return { skipped: false, status: "rejected" as const };
    }

    const xp = Math.max(0, Math.round(xpOverride ?? submission.xp));
    const user = await ctx.db
      .query("users")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", submission.walletAddress))
      .unique();
    if (user) await ctx.db.patch(user._id, { points: user.points + xp });
    await addEpochPoints(ctx, submission.walletAddress, xp);

    await ctx.db.patch(submissionId, {
      status: "approved", xp, reviewedAt: now, reviewNote: note, awardedEpochId: epochIdAt(now),
    });
    return { skipped: false, status: "approved" as const, xp };
  },
});

/** The review queue, oldest first. */
export const pending = query({
  args: { limit: v.optional(v.float64()) },
  handler: async (ctx, { limit }) =>
    ctx.db
      .query("questSubmissions")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .order("asc")
      .take(limit ?? 100),
});
