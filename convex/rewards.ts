import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import { addCredit, closeEpochIfDrained } from "./credit";
import { epochIdAt, epochWindow } from "./xpRules";
import { sessionWallet } from "./sessions";

// Epoch timing (Friday 00:00 UTC weeks) lives in xpRules.ts so the screens use
// the same math. Re-exported for the Convex files that import it from here.
export { epochIdAt, epochWindow } from "./xpRules";

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

    const claimable = (await ctx.db
      .query("rewardPayouts").withIndex("by_wallet", (q) => q.eq("walletAddress", addr)).collect())
      .filter((row) => row.state === "claimable");

    // Everyone with points this week shares Friday's pot, so the live
    // denominator is every earner, not an opt-in list.
    const earners = (await ctx.db
      .query("epochPoints").withIndex("by_epoch", (q) => q.eq("epochId", epochId)).collect())
      .filter((row) => row.points > 0);
    const totalPoints = earners.reduce((sum, row) => sum + row.points, 0);

    return {
      epochId, startsAt, endsAt,
      myPoints: points?.points ?? 0,
      // Kept for older clients: every earner is in automatically now.
      hasRequested: (points?.points ?? 0) > 0,
      requestedAt: request?.requestedAt ?? null,
      // Live denominator so the UI can show a running "your share ≈ x%".
      requestedPointsTotal: totalPoints,
      requesterCount: earners.length,
      epochState: epoch?.state ?? "open",
      // Settled shares waiting on a Claim press. Usually one row (last week's),
      // but a user returning after a gap sees every share still inside its window.
      claimable: claimable.map((row) => ({
        payoutId: row._id, epochId: row.epochId, amountRaw: row.amountRaw,
      })),
      lastEpoch: lastSettled ? { epochId: epochId - 1, awardedRaw: lastSettled.awardedRaw ?? null } : null,
    };
  },
});

/**
 * BTB the treasury already owes: settled shares not yet claimed, and claims
 * still being sent. Home subtracts it from the treasury balance for a live
 * "pot so far"; a share that expires unclaimed rejoins the pot on Friday.
 */
export const owedRaw = query({
  args: {},
  handler: async (ctx) => {
    let owed = 0n;
    for (const state of ["claimable", "queued", "sending", "submitted"] as const) {
      const rows = await ctx.db.query("rewardPayouts").withIndex("by_state_created", (q) => q.eq("state", state)).collect();
      for (const r of rows) owed += BigInt(r.amountRaw);
    }
    return owed.toString();
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

/**
 * Claim a settled share. Flips the row from "claimable" to the send queue and
 * kicks the drain — the BTB then arrives without the user signing anything.
 *
 * The destination is the address stored on the payout row, never a caller
 * argument, so the worst a forged call can do is deliver someone their own
 * money sooner than they asked for it.
 */
export const claimReward = mutation({
  args: { payoutId: v.id("rewardPayouts") },
  handler: async (ctx, { payoutId }) => {
    const payout = await ctx.db.get(payoutId);
    if (!payout) throw new Error("Payout not found");
    // Already claimed or already expired — a double-clicked button is a no-op,
    // not an error, and must never queue a second transfer.
    if (payout.state !== "claimable") return { claimed: false, state: payout.state };

    const now = Date.now();
    await ctx.db.patch(payoutId, { state: "queued", updatedAt: now, nextAttemptAt: undefined });
    await ctx.scheduler.runAfter(0, internal.rewardsActions.drain, {});
    return { claimed: true, state: "queued", amountRaw: payout.amountRaw };
  },
});

/**
 * Move a settled share into the wallet's BTB balance instead of sending it,
 * to spend on agent messages and fast alerts. Needs the wallet's signed
 * session: unlike a claim, this makes the BTB app-only, so nobody else may
 * choose it for them. The BTB stays in the treasury and the share is done.
 */
export const addToBalance = mutation({
  args: { payoutId: v.id("rewardPayouts"), sessionToken: v.string() },
  handler: async (ctx, { payoutId, sessionToken }) => {
    const wallet = await sessionWallet(ctx, sessionToken);
    if (!wallet) return { ok: false as const, reason: "Sign in again." };
    const payout = await ctx.db.get(payoutId);
    if (!payout || payout.walletAddress !== wallet) return { ok: false as const, reason: "That reward is not this wallet's." };
    if (payout.state !== "claimable") return { ok: false as const, reason: "That reward was already claimed or has expired." };
    const amount = Number(BigInt(payout.amountRaw) / 10n ** 12n) / 1e6;
    await ctx.db.patch(payoutId, { state: "alerts", updatedAt: Date.now() });
    await addCredit(ctx, wallet, amount, `payout:${payoutId}`, "rewards");
    await closeEpochIfDrained(ctx, payout.epochId);
    return { ok: true as const, amount };
  },
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

    // Unclaimed shares expire when the next epoch settles. Their BTB never left
    // the treasury, so it is already part of the pot being priced right now —
    // leaving the row claimable would promise the same BTB to two people.
    const stale = await ctx.db
      .query("rewardPayouts").withIndex("by_state_created", (q) => q.eq("state", "claimable")).collect();
    const touched = new Set<number>();
    for (const row of stale) {
      await ctx.db.patch(row._id, { state: "expired", updatedAt: Date.now() });
      touched.add(row.epochId);
    }
    for (const id of touched) await closeEpochIfDrained(ctx, id);

    const pot = BigInt(potRaw);
    // Every wallet that earned points this week is in; nobody has to opt in.
    // The filter against spam is on the other end: a share nobody claims or
    // moves into their BTB balance expires into the next pot.
    const earners = await ctx.db
      .query("epochPoints").withIndex("by_epoch", (q) => q.eq("epochId", epochId)).collect();

    const weighted: { wallet: string; points: bigint; raw: number }[] = [];
    let totalPoints = 0n;
    for (const row of earners) {
      const points = BigInt(Math.max(0, Math.round(row.points)));
      if (points === 0n) continue;
      weighted.push({ wallet: row.walletAddress, points, raw: row.points });
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
      // One rewardRequests row per paid wallet stays the record of what it got
      // (Home reads it for "last week you were paid").
      const existing = await ctx.db.query("rewardRequests")
        .withIndex("by_epoch_wallet", (q) => q.eq("epochId", epochId).eq("walletAddress", entry.wallet)).unique();
      if (existing) await ctx.db.patch(existing._id, { pointsAtSettle: entry.raw, awardedRaw: amount.toString() });
      else await ctx.db.insert("rewardRequests", { epochId, walletAddress: entry.wallet, pointsAtRequest: entry.raw, requestedAt: now, pointsAtSettle: entry.raw, awardedRaw: amount.toString() });
      if (amount === 0n) continue;
      distributed += amount;
      queued += 1;
      await ctx.db.insert("rewardPayouts", {
        epochId, walletAddress: entry.wallet, amountRaw: amount.toString(),
        state: "claimable", attempts: 0, createdAt: now, updatedAt: now,
      });
    }

    await ctx.db.patch(epoch._id, {
      state: queued > 0 ? "paying" : "paid",
      oposBurnedRaw, btbPotRaw: pot.toString(), carryOutRaw: (pot - distributed).toString(),
      totalPoints: Number(totalPoints), requesterCount: weighted.length,
      burnTxHash, settledAt: now, error: undefined,
    });
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
