import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { MutationCtx } from "./_generated/server";

// Epochs run Friday 00:00 UTC → Friday 00:00 UTC. Unix time starts on a
// Thursday, so the first Friday midnight is exactly one day in — that offset is
// the whole anchor, no magic timestamp needed.
const WEEK_MS = 604_800_000;
const FIRST_FRIDAY_MS = 86_400_000;

/** Index of the epoch containing `at` (default: now). */
export function epochIdAt(at: number = Date.now()): number {
  return Math.floor((at - FIRST_FRIDAY_MS) / WEEK_MS);
}

export function epochWindow(epochId: number) {
  const startsAt = FIRST_FRIDAY_MS + epochId * WEEK_MS;
  return { startsAt, endsAt: startsAt + WEEK_MS };
}

/**
 * Credit XP to the current epoch's ledger. Called alongside every write to
 * `users.points` — the lifetime counter is cosmetic, this is what pays.
 */
export async function addEpochPoints(ctx: MutationCtx, walletAddress: string, amount: number) {
  if (!(amount > 0)) return;
  const addr = walletAddress.toLowerCase();
  const epochId = epochIdAt();
  const row = await ctx.db
    .query("epochPoints")
    .withIndex("by_epoch_wallet", (q) => q.eq("epochId", epochId).eq("walletAddress", addr))
    .unique();
  const now = Date.now();
  if (row) await ctx.db.patch(row._id, { points: row.points + amount, updatedAt: now });
  else await ctx.db.insert("epochPoints", { epochId, walletAddress: addr, points: amount, updatedAt: now });
}

async function ensureEpoch(ctx: MutationCtx, epochId: number) {
  const existing = await ctx.db
    .query("rewardEpochs")
    .withIndex("by_epoch", (q) => q.eq("epochId", epochId))
    .unique();
  if (existing) return existing;
  const { startsAt, endsAt } = epochWindow(epochId);
  // carryInRaw is kept for display only; the real carry is whatever BTB is
  // physically left in the treasury when settlement measures it.
  const id = await ctx.db.insert("rewardEpochs", {
    epochId, state: "open", startsAt, endsAt, carryInRaw: "0",
  });
  return (await ctx.db.get(id))!;
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Opt into this week's split. One request per wallet per epoch — a second call
 * inside the same Friday→Friday window is a no-op, not an error, so a
 * double-clicked button doesn't look like a failure.
 */
export const requestPayout = mutation({
  args: { walletAddress: v.string() },
  handler: async (ctx, { walletAddress }) => {
    const addr = walletAddress.toLowerCase();
    const user = await ctx.db
      .query("users")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", addr))
      .unique();
    if (!user) throw new Error("User not registered");

    const epochId = epochIdAt();
    await ensureEpoch(ctx, epochId);

    const existing = await ctx.db
      .query("rewardRequests")
      .withIndex("by_epoch_wallet", (q) => q.eq("epochId", epochId).eq("walletAddress", addr))
      .unique();
    if (existing) return { alreadyRequested: true, epochId, request: existing };

    const points = await ctx.db
      .query("epochPoints")
      .withIndex("by_epoch_wallet", (q) => q.eq("epochId", epochId).eq("walletAddress", addr))
      .unique();
    // Requesting with zero points would just add a row that settles to nothing.
    if (!points || points.points <= 0) throw new Error("No points earned this week yet");

    const id = await ctx.db.insert("rewardRequests", {
      epochId, walletAddress: addr,
      pointsAtRequest: points.points,
      requestedAt: Date.now(),
    });
    return { alreadyRequested: false, epochId, request: await ctx.db.get(id) };
  },
});

/** Everything the weekly-rewards panel needs for one wallet, in one round trip. */
export const getStatus = query({
  args: { walletAddress: v.string() },
  handler: async (ctx, { walletAddress }) => {
    const addr = walletAddress.toLowerCase();
    const epochId = epochIdAt();
    const { startsAt, endsAt } = epochWindow(epochId);

    const [points, request, epoch, lastSettled] = await Promise.all([
      ctx.db.query("epochPoints")
        .withIndex("by_epoch_wallet", (q) => q.eq("epochId", epochId).eq("walletAddress", addr)).unique(),
      ctx.db.query("rewardRequests")
        .withIndex("by_epoch_wallet", (q) => q.eq("epochId", epochId).eq("walletAddress", addr)).unique(),
      ctx.db.query("rewardEpochs").withIndex("by_epoch", (q) => q.eq("epochId", epochId)).unique(),
      ctx.db.query("rewardRequests")
        .withIndex("by_epoch_wallet", (q) => q.eq("epochId", epochId - 1).eq("walletAddress", addr)).unique(),
    ]);

    const openRequests = await ctx.db
      .query("rewardRequests").withIndex("by_epoch", (q) => q.eq("epochId", epochId)).collect();
    let totalPoints = 0;
    for (const row of openRequests) {
      const p = await ctx.db.query("epochPoints")
        .withIndex("by_epoch_wallet", (q) => q.eq("epochId", epochId).eq("walletAddress", row.walletAddress)).unique();
      totalPoints += p?.points ?? 0;
    }

    return {
      epochId, startsAt, endsAt,
      myPoints: points?.points ?? 0,
      hasRequested: request !== null,
      requestedAt: request?.requestedAt ?? null,
      // Live denominator so the UI can show a running "your share ≈ x%".
      requestedPointsTotal: totalPoints,
      requesterCount: openRequests.length,
      epochState: epoch?.state ?? "open",
      lastEpoch: lastSettled ? { epochId: epochId - 1, awardedRaw: lastSettled.awardedRaw ?? null } : null,
    };
  },
});

/** Settled epochs, newest first — for a public "past weeks" table. */
export const listEpochs = query({
  args: { limit: v.optional(v.float64()) },
  handler: async (ctx, { limit }) =>
    ctx.db.query("rewardEpochs").withIndex("by_epoch").order("desc").take(limit ?? 12),
});

/** A wallet's payout history across epochs. */
export const listPayouts = query({
  args: { walletAddress: v.string(), limit: v.optional(v.float64()) },
  handler: async (ctx, { walletAddress, limit }) =>
    ctx.db.query("rewardPayouts")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", walletAddress.toLowerCase()))
      .order("desc").take(limit ?? 25),
});

// ── Settlement ──────────────────────────────────────────────────────────────

/**
 * Closes the most recently ended epoch and hands the on-chain half (burn OPOS
 * → BTB) to an action.
 *
 * Runs hourly rather than once on Friday so it is self-healing: a settlement
 * that fails resets the epoch to "open" and the next tick retries it, instead
 * of stranding a week of tax until the following Friday.
 */
export const closeEpoch = internalMutation({
  args: {},
  handler: async (ctx) => {
    const epochId = epochIdAt() - 1;
    const epoch = await ensureEpoch(ctx, epochId);
    if (epoch.state !== "open") return { skipped: true, epochId, state: epoch.state };

    // Carry-in is a display field now — the real carry is the BTB physically
    // left in the treasury, which settlement measures directly.
    await ctx.db.patch(epoch._id, { state: "burning", carryInRaw: "0", error: undefined });
    await ctx.scheduler.runAfter(0, internal.rewardsActions.settle, { epochId });
    return { skipped: false, epochId };
  },
});

export const getEpoch = internalQuery({
  args: { epochId: v.float64() },
  handler: (ctx, { epochId }) =>
    ctx.db.query("rewardEpochs").withIndex("by_epoch", (q) => q.eq("epochId", epochId)).unique(),
});

export const markEpochFailed = internalMutation({
  args: { epochId: v.float64(), error: v.string() },
  handler: async (ctx, { epochId, error }) => {
    const epoch = await ctx.db
      .query("rewardEpochs").withIndex("by_epoch", (q) => q.eq("epochId", epochId)).unique();
    // Back to "open" so the next Friday tick — or a manual re-run — retries the
    // burn instead of stranding a week of tax in the treasury.
    if (epoch) await ctx.db.patch(epoch._id, { state: "open", error: error.slice(0, 600) });
  },
});

/**
 * Split the pot pro-rata and queue one transfer per requester.
 *
 * `potRaw` is the treasury's entire BTB balance measured after the burn, not
 * just the burn proceeds. That one choice makes the accounting self-healing:
 * rounding dust, a burn that confirmed after we stopped watching, and BTB from
 * a payout that permanently failed all stay in the wallet and are simply part
 * of next week's pot. Nothing has to be tracked forward to be recovered.
 *
 * Shares use integer wei math, so the floors always sum to <= the pot.
 */
export const settleEpoch = internalMutation({
  args: {
    epochId: v.float64(),
    oposBurnedRaw: v.string(),
    potRaw: v.string(),
    burnTxHash: v.optional(v.string()),
  },
  handler: async (ctx, { epochId, oposBurnedRaw, potRaw, burnTxHash }) => {
    const epoch = await ctx.db
      .query("rewardEpochs").withIndex("by_epoch", (q) => q.eq("epochId", epochId)).unique();
    if (!epoch) throw new Error(`Epoch ${epochId} not found`);
    if (epoch.state !== "burning") return { skipped: true, state: epoch.state };

    const pot = BigInt(potRaw);
    const requests = await ctx.db
      .query("rewardRequests").withIndex("by_epoch", (q) => q.eq("epochId", epochId)).collect();

    const weighted: { id: (typeof requests)[number]["_id"]; wallet: string; points: bigint; raw: number }[] = [];
    let totalPoints = 0n;
    for (const request of requests) {
      const row = await ctx.db.query("epochPoints")
        .withIndex("by_epoch_wallet", (q) => q.eq("epochId", epochId).eq("walletAddress", request.walletAddress))
        .unique();
      const raw = row?.points ?? 0;
      const points = BigInt(Math.max(0, Math.round(raw)));
      if (points === 0n) continue;
      weighted.push({ id: request._id, wallet: request.walletAddress, points, raw });
      totalPoints += points;
    }

    const now = Date.now();
    // No requesters (or no tax collected) — the whole pot rolls forward.
    if (totalPoints === 0n || pot === 0n) {
      await ctx.db.patch(epoch._id, {
        state: "paid", oposBurnedRaw, btbPotRaw: pot.toString(), carryOutRaw: pot.toString(),
        totalPoints: 0, requesterCount: weighted.length, burnTxHash, settledAt: now, error: undefined,
      });
      return { skipped: false, queued: 0, potRaw: pot.toString() };
    }

    let distributed = 0n;
    let queued = 0;
    for (const entry of weighted) {
      const amount = (pot * entry.points) / totalPoints;
      await ctx.db.patch(entry.id, { pointsAtSettle: entry.raw, awardedRaw: amount.toString() });
      if (amount === 0n) continue;
      distributed += amount;
      queued += 1;
      await ctx.db.insert("rewardPayouts", {
        epochId, walletAddress: entry.wallet, amountRaw: amount.toString(),
        state: "queued", attempts: 0, createdAt: now, updatedAt: now,
      });
    }

    await ctx.db.patch(epoch._id, {
      state: queued > 0 ? "paying" : "paid",
      oposBurnedRaw, btbPotRaw: pot.toString(), carryOutRaw: (pot - distributed).toString(),
      totalPoints: Number(totalPoints), requesterCount: weighted.length,
      burnTxHash, settledAt: now, error: undefined,
    });
    if (queued > 0) await ctx.scheduler.runAfter(0, internal.rewardsActions.drain, {});
    return { skipped: false, queued, potRaw: pot.toString() };
  },
});

// ── Payout queue ────────────────────────────────────────────────────────────

// Longer than the 300s mainnet confirmation wait in rewardsActions.send, so a
// transfer that is merely slow is never reclaimed and broadcast a second time.
const ACTIVE_LEASE_MS = 360_000;
const MAX_ATTEMPTS = 6;

/**
 * Hand out at most one payout at a time. The treasury is a single EOA, so a
 * live lease on any in-flight transfer is what keeps two workers from picking
 * the same nonce.
 */
export const claimPayout = internalMutation({
  args: { workerId: v.string() },
  handler: async (ctx, { workerId }) => {
    const now = Date.now();
    for (const state of ["sending", "submitted"] as const) {
      const active = await ctx.db
        .query("rewardPayouts").withIndex("by_state_created", (q) => q.eq("state", state)).collect();
      const leased = active.find((row) => (row.leaseUntil ?? 0) > now);
      if (leased) return { locked: true, retryAfter: Math.max(1_000, (leased.leaseUntil ?? now) - now), payout: null };
      // Lease expired mid-flight — retry that row before starting new work.
      if (active.length > 0) {
        const stale = active[0];
        await ctx.db.patch(stale._id, {
          state: "sending", workerId, leaseUntil: now + ACTIVE_LEASE_MS,
          attempts: stale.attempts + 1, updatedAt: now,
        });
        return { locked: false, retryAfter: 0, payout: { ...stale, state: "sending", workerId, attempts: stale.attempts + 1 } };
      }
    }

    const queued = await ctx.db
      .query("rewardPayouts").withIndex("by_state_created", (q) => q.eq("state", "queued")).order("asc").collect();
    const next = queued.find((row) => (row.nextAttemptAt ?? 0) <= now) ?? null;
    if (!next) return { locked: false, retryAfter: 0, payout: null };
    await ctx.db.patch(next._id, {
      state: "sending", workerId, leaseUntil: now + ACTIVE_LEASE_MS,
      attempts: next.attempts + 1, updatedAt: now, error: undefined,
    });
    return { locked: false, retryAfter: 0, payout: { ...next, state: "sending", workerId, attempts: next.attempts + 1 } };
  },
});

export const markPayoutSubmitted = internalMutation({
  args: { payoutId: v.id("rewardPayouts"), workerId: v.string(), txHash: v.string() },
  handler: async (ctx, { payoutId, workerId, txHash }) => {
    const payout = await ctx.db.get(payoutId);
    if (!payout || payout.workerId !== workerId) throw new Error("Payout lease was lost");
    const now = Date.now();
    await ctx.db.patch(payoutId, {
      state: "submitted", txHash: txHash.toLowerCase(), updatedAt: now, leaseUntil: now + ACTIVE_LEASE_MS,
    });
  },
});

export const completePayout = internalMutation({
  args: { payoutId: v.id("rewardPayouts"), workerId: v.string(), txHash: v.string() },
  handler: async (ctx, { payoutId, workerId, txHash }) => {
    const payout = await ctx.db.get(payoutId);
    if (!payout || payout.workerId !== workerId) throw new Error("Payout lease was lost");
    await ctx.db.patch(payoutId, {
      state: "confirmed", txHash: txHash.toLowerCase(),
      updatedAt: Date.now(), leaseUntil: undefined, workerId: undefined, error: undefined,
    });
    await closeEpochIfDrained(ctx, payout.epochId);
  },
});

export const releasePayout = internalMutation({
  args: { payoutId: v.id("rewardPayouts"), workerId: v.string(), error: v.string(), terminal: v.boolean() },
  handler: async (ctx, { payoutId, workerId, error, terminal }) => {
    const payout = await ctx.db.get(payoutId);
    if (!payout || payout.workerId !== workerId) return;
    const now = Date.now();
    const dead = terminal || payout.attempts >= MAX_ATTEMPTS;
    await ctx.db.patch(payoutId, {
      state: dead ? "failed" : "queued",
      error: error.slice(0, 600), updatedAt: now,
      leaseUntil: undefined, workerId: undefined,
      nextAttemptAt: dead ? undefined : now + Math.min(300_000, 5_000 * 2 ** Math.max(0, payout.attempts - 1)),
    });
    // A dead payout needs no bookkeeping: its BTB never left the treasury, so
    // next week's on-chain pot measurement picks it up automatically.
    if (dead) await closeEpochIfDrained(ctx, payout.epochId);
  },
});

async function closeEpochIfDrained(ctx: MutationCtx, epochId: number) {
  const remaining = await ctx.db
    .query("rewardPayouts").withIndex("by_epoch", (q) => q.eq("epochId", epochId)).collect();
  if (remaining.some((row) => row.state !== "confirmed" && row.state !== "failed")) return;
  const epoch = await ctx.db
    .query("rewardEpochs").withIndex("by_epoch", (q) => q.eq("epochId", epochId)).unique();
  if (epoch && epoch.state === "paying") await ctx.db.patch(epoch._id, { state: "paid" });
}

/**
 * True while any payout is still queued or in flight. Settlement must not run
 * in this state — it measures the treasury's whole BTB balance, which would
 * still include BTB that last week's requesters are owed.
 */
export const hasUnfinishedPayouts = internalQuery({
  args: {},
  handler: async (ctx) => {
    for (const state of ["queued", "sending", "submitted"] as const) {
      const row = await ctx.db
        .query("rewardPayouts").withIndex("by_state_created", (q) => q.eq("state", state)).first();
      if (row) return true;
    }
    return false;
  },
});

export const getPayout = internalQuery({
  args: { payoutId: v.id("rewardPayouts") },
  handler: (ctx, { payoutId }) => ctx.db.get(payoutId),
});
