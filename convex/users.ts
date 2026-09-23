import { mutation, query, internalMutation } from "./_generated/server";
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
  args: { walletAddress: v.string() },
  handler: async (ctx, { walletAddress }) => {
    const addr = walletAddress.toLowerCase();
    const existing = await ctx.db
      .query("users")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", addr))
      .unique();
    if (existing) return existing;

    const id = await ctx.db.insert("users", {
      walletAddress: addr,
      joinedAt: Date.now(),
      currentStreak: 0,
      longestStreak: 0,
      totalCheckIns: 0,
      points: 0,
    });
    return ctx.db.get(id);
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
    await addEpochPoints(ctx, addr, earned);

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
  args: { walletAddress: v.string(), key: v.string(), xp: v.float64(), capped: v.boolean() },
  handler: async (ctx, { walletAddress, key, xp, capped }) => {
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
    await addEpochPoints(ctx, addr, xp);
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
    await addEpochPoints(ctx, addr, SIMULATE_XP);
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

