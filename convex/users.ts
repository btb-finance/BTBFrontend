import { mutation, query, internalMutation, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { addEpochPoints } from "./rewards";
import { dailyXpForStreak, weekMilestoneXp, holdBonusXp, TX_XP_DAILY_CAP, SIMULATE_XP, SIMULATE_CHAINS_PER_DAY } from "./xpRules";

const MS_PER_DAY = 86_400_000;


// ── Profile ────────────────────────────────────────────────────────────────

/**
 * Called when a wallet connects for the first time.
 * Returns existing profile if already registered.
 */
export const registerOrGet = mutation({
  // `ref`: the invite code this browser arrived with, if any. It only counts when this call creates the wallet.
  args: { walletAddress: v.string(), ref: v.optional(v.string()) },
  handler: async (ctx, { walletAddress, ref }) => {
    const addr = walletAddress.toLowerCase();
    const existing = await ctx.db
      .query("users")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", addr))
      .unique();
    if (existing) return existing;

    // A wallet is linked to its inviter once, when it first connects, so no click or signature is needed and an
    // existing wallet can never be moved to another inviter.
    const inviter = ref ? await walletForCode(ctx, ref) : null;
    const id = await ctx.db.insert("users", {
      walletAddress: addr,
      joinedAt: Date.now(),
      currentStreak: 0,
      longestStreak: 0,
      totalCheckIns: 0,
      points: 0,
      ...(inviter && inviter !== addr ? { referredBy: inviter } : {}),
    });
    return ctx.db.get(id);
  },
});

/**
 * Invite codes are the first 8 hex characters of the inviter's address, so nothing extra is stored: the code is
 * resolved with a prefix range on the wallet index. Two BTB wallets sharing a prefix (about 1 in 4 billion per pair)
 * make the code ambiguous, and then nobody is linked.
 */
async function walletForCode(ctx: QueryCtx, code: string): Promise<string | null> {
  const c = code.toLowerCase();
  if (!/^[0-9a-f]{8}$/.test(c)) return null;
  const hits = await ctx.db
    .query("users")
    .withIndex("by_wallet", (q) => q.gte("walletAddress", `0x${c}`).lt("walletAddress", `0x${c}g`))
    .take(2);
  return hits.length === 1 ? hits[0].walletAddress : null;
}

/**
 * Server only (npx convex run): correct the BTB balance a check-in stored, when a bad RPC read recorded the wrong
 * one. Tomorrow's holding bonus uses the lower of this and the next check-in's balance.
 */
export const fixCheckInBalance = internalMutation({
  args: { walletAddress: v.string(), btb: v.float64() },
  handler: async (ctx, { walletAddress, btb }) => {
    const user = await ctx.db.query("users").withIndex("by_wallet", (q) => q.eq("walletAddress", walletAddress.toLowerCase())).unique();
    if (!user) return { ok: false as const };
    await ctx.db.patch(user._id, { btbAtCheckIn: btb });
    return { ok: true as const };
  },
});

/**
 * Server only (npx convex run): credit XP a wallet should have earned but did not because of a bug on our side. It
 * counts toward the current week like any other XP and is recorded once per `reason`, so a repeat does nothing.
 */
export const creditMissedXp = internalMutation({
  args: { walletAddress: v.string(), xp: v.float64(), reason: v.string() },
  handler: async (ctx, { walletAddress, xp, reason }) => {
    const addr = walletAddress.toLowerCase();
    const user = await ctx.db.query("users").withIndex("by_wallet", (q) => q.eq("walletAddress", addr)).unique();
    if (!user || !(xp > 0)) return { ok: false as const, reason: "no user" };
    const key = `fix:${reason}`;
    const done = await ctx.db.query("dailyAwards").withIndex("by_wallet_day_key", (q) => q.eq("walletAddress", addr).eq("day", 0).eq("key", key)).first();
    if (done) return { ok: false as const, reason: "already credited" };
    await ctx.db.insert("dailyAwards", { walletAddress: addr, day: 0, key, xp, createdAt: Date.now() });
    await ctx.db.patch(user._id, { points: user.points + xp });
    await addEpochPoints(ctx, addr, xp, false, "XP you were owed, credited");
    return { ok: true as const, awarded: xp };
  },
});

export const getUser = query({
  args: { walletAddress: v.string() },
  handler: async (ctx, { walletAddress }) =>
    ctx.db
      .query("users")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", walletAddress.toLowerCase()))
      .unique(),
});

// ── Daily check-in ─────────────────────────────────────────────────────────

/**
 * Records a daily check-in. Called by convex/checkInActions.ts, which reads
 * the wallet's BTB balance on-chain first; `btbBalance` is undefined when that
 * read failed (no bonus, and the stored balance is left as it was).
 * - Same day → no-op
 * - Next day → streak +1
 * - Missed day → streak resets to 1, and the holder bonus waits a day
 */
export const recordCheckIn = internalMutation({
  args: { walletAddress: v.string(), btbBalance: v.optional(v.float64()) },
  handler: async (ctx, { walletAddress, btbBalance }) => {
    const addr = walletAddress.toLowerCase();
    const user = await ctx.db
      .query("users")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", addr))
      .unique();
    if (!user) throw new Error("User not registered");

    const now = Date.now();
    const todayStart = now - (now % MS_PER_DAY);

    if (user.lastCheckIn && user.lastCheckIn >= todayStart) {
      return { alreadyCheckedIn: true as const, user };
    }

    const yesterday = todayStart - MS_PER_DAY;
    const isConsecutive = user.lastCheckIn ? user.lastCheckIn >= yesterday : false;
    const newStreak = isConsecutive ? user.currentStreak + 1 : 1;
    const newLongest = Math.max(user.longestStreak, newStreak);

    // Escalating daily XP: day 1 = 10, +2 per consecutive day, capped at 50.
    const dailyXp = dailyXpForStreak(newStreak);
    // Weekly milestone: hitting a 7/14/21… day streak pays a growing bonus.
    const weekMilestone = weekMilestoneXp(newStreak);
    // Holder bonus only across consecutive days: a gap means the balance in
    // between is unknown, so the count starts again from today.
    const holdBonus = isConsecutive ? holdBonusXp(user.btbAtCheckIn, btbBalance) : 0;
    const earned = dailyXp + weekMilestone + holdBonus;
    const newPoints = user.points + earned;

    await ctx.db.patch(user._id, {
      lastCheckIn: now,
      currentStreak: newStreak,
      longestStreak: newLongest,
      totalCheckIns: user.totalCheckIns + 1,
      points: newPoints,
      ...(btbBalance != null ? { btbAtCheckIn: btbBalance } : {}),
    });
    const extras = [weekMilestone ? `+${weekMilestone} week streak bonus` : "", holdBonus ? `+${holdBonus.toLocaleString("en-US")} for holding BTB` : ""].filter(Boolean);
    await addEpochPoints(ctx, addr, earned, false, `Daily check-in, day ${newStreak}${extras.length ? ` (${extras.join(", ")})` : ""}`);

    return { alreadyCheckedIn: false as const, dailyXp, weekMilestone, holdBonus, newStreak, newPoints };
  },
});

/**
 * Credit XP for one on-chain transaction. Written only by
 * convex/xpActions.ts after it has read the transaction from the chain; the
 * client never names an amount. `key` is `tx:<chainId>:<hash>`, so a hash is
 * paid once, ever.
 */
export const creditTxXp = internalMutation({
  args: { walletAddress: v.string(), key: v.string(), xp: v.float64(), capped: v.boolean(), reason: v.optional(v.string()) },
  handler: async (ctx, { walletAddress, key, xp, capped, reason }) => {
    const addr = walletAddress.toLowerCase();
    const user = await ctx.db.query("users").withIndex("by_wallet", (q) => q.eq("walletAddress", addr)).unique();
    if (!user) return { ok: false as const, reason: "not registered", awarded: 0 };
    const used = await ctx.db.query("dailyAwards")
      .withIndex("by_wallet_day_key", (q) => q.eq("walletAddress", addr).eq("day", 0).eq("key", key)).unique();
    if (used) return { ok: false as const, reason: "already awarded", awarded: 0 };
    const now = Date.now();
    const day = now - (now % MS_PER_DAY);
    if (capped) {
      const today = await ctx.db.query("dailyAwards")
        .withIndex("by_wallet_day_key", (q) => q.eq("walletAddress", addr).eq("day", day)).collect();
      if (today.filter((r) => r.key.startsWith("swap:")).length >= TX_XP_DAILY_CAP) return { ok: false as const, reason: "daily limit", awarded: 0 };
    }
    // day 0 row: the permanent once-per-hash guard. Today's row: the swap count.
    await ctx.db.insert("dailyAwards", { walletAddress: addr, day: 0, key, xp, createdAt: now });
    if (capped) await ctx.db.insert("dailyAwards", { walletAddress: addr, day, key: `swap:${key}`, xp, createdAt: now });
    await ctx.db.patch(user._id, { points: user.points + xp });
    await addEpochPoints(ctx, addr, xp, false, reason ?? "Transaction");
    return { ok: true as const, awarded: xp };
  },
});

/** Simulate rewards: SIMULATE_XP the first time a wallet checks a pool each
 * day, and SIMULATE_XP per chain used in cross-chain research, each chain once
 * a day (at most SIMULATE_CHAINS_PER_DAY chains). */

export const awardSimulateXp = mutation({
  args: {
    walletAddress: v.string(),
    kind: v.union(v.literal("pool"), v.literal("chain")),
    chainId: v.optional(v.float64()),
  },
  handler: async (ctx, { walletAddress, kind, chainId }) => {
    const addr = walletAddress.toLowerCase();
    if (kind === "chain" && !(Number.isInteger(chainId) && chainId! > 0 && chainId! < 10_000_000)) return { ok: false, awarded: 0 };
    const key = kind === "pool" ? "simulate:pool" : `simulate:chain:${chainId}`;
    const now = Date.now();
    const day = now - (now % MS_PER_DAY);

    const user = await ctx.db
      .query("users")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", addr))
      .unique();
    if (!user) return { ok: false, awarded: 0 };

    const already = await ctx.db
      .query("dailyAwards")
      .withIndex("by_wallet_day_key", (q) => q.eq("walletAddress", addr).eq("day", day).eq("key", key))
      .unique();
    if (already) return { ok: true, awarded: 0 };
    // Each chain id pays once a day, but any integer is a "chain" to the
    // server, so cap how many a wallet can collect per day.
    if (kind === "chain") {
      const today = await ctx.db
        .query("dailyAwards")
        .withIndex("by_wallet_day_key", (q) => q.eq("walletAddress", addr).eq("day", day))
        .collect();
      if (today.filter((r) => r.key.startsWith("simulate:chain:")).length >= SIMULATE_CHAINS_PER_DAY) return { ok: true, awarded: 0 };
    }

    await ctx.db.insert("dailyAwards", { walletAddress: addr, day, key, xp: SIMULATE_XP, createdAt: now });
    await ctx.db.patch(user._id, { points: user.points + SIMULATE_XP });
    await addEpochPoints(ctx, addr, SIMULATE_XP, false, kind === "pool" ? "Simulated a pool" : "Simulated on a new chain");
    return { ok: true, awarded: SIMULATE_XP };
  },
});

// ── Token balances snapshot ────────────────────────────────────────────────

/**
 * Saves a fresh token balance snapshot for a user.
 * Overwrites any previous entry for the same wallet+token pair.
 */
// Internal: written by balances.refresh after it reads the chain. Public, it
// let anyone store a made-up balance for any wallet.
export const saveBalanceSnapshot = internalMutation({
  args: {
    walletAddress: v.string(),
    balances: v.array(v.object({
      tokenAddress: v.string(),
      symbol: v.string(),
      name: v.string(),
      decimals: v.float64(),
      logoURI: v.optional(v.string()),
      balanceFormatted: v.string(),
      balanceRaw: v.string(),
      valueUsd: v.float64(),
    })),
    totalValueUsd: v.float64(),
  },
  handler: async (ctx, { walletAddress, balances, totalValueUsd }) => {
    const addr = walletAddress.toLowerCase();
    const now = Date.now();

    // Delete old snapshot rows for this wallet
    const old = await ctx.db
      .query("userTokenBalances")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", addr))
      .collect();
    for (const row of old) await ctx.db.delete(row._id);

    // Insert fresh rows
    for (const b of balances) {
      await ctx.db.insert("userTokenBalances", {
        walletAddress: addr,
        tokenAddress: b.tokenAddress.toLowerCase(),
        symbol: b.symbol,
        name: b.name,
        decimals: b.decimals,
        logoURI: b.logoURI,
        balanceFormatted: b.balanceFormatted,
        balanceRaw: b.balanceRaw,
        valueUsd: b.valueUsd,
        updatedAt: now,
      });
    }

    // Update total portfolio value on user profile
    const user = await ctx.db
      .query("users")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", addr))
      .unique();
    if (user) {
      await ctx.db.patch(user._id, { portfolioValueUsd: totalValueUsd, portfolioUpdatedAt: now });
    }
  },
});

export const getBalanceSnapshot = query({
  args: { walletAddress: v.string() },
  handler: async (ctx, { walletAddress }) =>
    ctx.db
      .query("userTokenBalances")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", walletAddress.toLowerCase()))
      .collect(),
});


/** A wallet's invite stats: how many wallets it invited, the points it earned from them, and who invited it. */
export const referralStats = query({
  args: { walletAddress: v.string() },
  handler: async (ctx, { walletAddress }) => {
    const addr = walletAddress.toLowerCase();
    const user = await ctx.db.query("users").withIndex("by_wallet", (q) => q.eq("walletAddress", addr)).unique();
    const invited = await ctx.db.query("users").withIndex("by_referrer", (q) => q.eq("referredBy", addr)).collect();
    return {
      invited: invited.length,
      referralXp: user?.referralXp ?? 0,
      referredBy: user?.referredBy ?? null,
    };
  },
});
