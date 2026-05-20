import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const MS_PER_DAY = 86_400_000;

/** Daily XP grows with the streak: day 1 = 10, +2 each day, capped at 50. */
function dailyXpForStreak(streak: number): number {
  return Math.min(10 + (streak - 1) * 2, 50);
}

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
 * Records a daily check-in. Handles streak logic:
 * - Same day → no-op (returns existing record)
 * - Next day → streak +1
 * - Missed day → streak resets to 1
 */
export const checkIn = mutation({
  args: { walletAddress: v.string() },
  handler: async (ctx, { walletAddress }) => {
    const addr = walletAddress.toLowerCase();
    const user = await ctx.db
      .query("users")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", addr))
      .unique();
    if (!user) throw new Error("User not registered");

    const now = Date.now();
    const todayStart = now - (now % MS_PER_DAY);

    if (user.lastCheckIn && user.lastCheckIn >= todayStart) {
      return { alreadyCheckedIn: true, user };
    }

    const yesterday = todayStart - MS_PER_DAY;
    const isConsecutive = user.lastCheckIn ? user.lastCheckIn >= yesterday : false;
    const newStreak = isConsecutive ? user.currentStreak + 1 : 1;
    const newLongest = Math.max(user.longestStreak, newStreak);

    // Escalating daily XP: day 1 = 10, +2 per consecutive day, capped at 50.
    const dailyXp = dailyXpForStreak(newStreak);
    // Weekly milestone: hitting a 7/14/21… day streak pays a growing bonus
    // (week 1 = +50, week 2 = +100, …). No separate timer — earned by streak.
    const weekMilestone = newStreak % 7 === 0 ? (newStreak / 7) * 50 : 0;
    const newPoints = user.points + dailyXp + weekMilestone;

    await ctx.db.patch(user._id, {
      lastCheckIn: now,
      currentStreak: newStreak,
      longestStreak: newLongest,
      totalCheckIns: user.totalCheckIns + 1,
      points: newPoints,
    });

    return { alreadyCheckedIn: false, dailyXp, weekMilestone, newStreak, newPoints };
  },
});

/**
 * Award XP for completing an in-app action (swap, mint, etc). Lightweight —
 * just bumps the points counter on the user row, no activity table insert.
 * Called from the client after a tx confirms.
 */
export const awardXp = mutation({
  args: { walletAddress: v.string(), amount: v.float64(), reason: v.optional(v.string()) },
  handler: async (ctx, { walletAddress, amount }) => {
    const addr = walletAddress.toLowerCase();
    const user = await ctx.db
      .query("users")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", addr))
      .unique();
    // Clamp so a bad client can't send absurd values.
    const safe = Math.max(0, Math.min(amount, 5000));
    if (!user) return { ok: false };
    await ctx.db.patch(user._id, { points: user.points + safe });
    return { ok: true, awarded: safe, newPoints: user.points + safe };
  },
});

// ── DeFi activity ──────────────────────────────────────────────────────────

/**
 * Append a DeFi activity event (swap, supply, stake, etc.)
 * Also awards points based on action type.
 */
export const recordActivity = mutation({
  args: {
    walletAddress: v.string(),
    protocol: v.string(),
    action: v.string(),
    tokenIn: v.optional(v.string()),
    tokenOut: v.optional(v.string()),
    valueUsd: v.optional(v.float64()),
    txHash: v.optional(v.string()),
    timestamp: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const addr = args.walletAddress.toLowerCase();

    await ctx.db.insert("userActivity", {
      walletAddress: addr,
      protocol: args.protocol,
      action: args.action,
      tokenIn: args.tokenIn,
      tokenOut: args.tokenOut,
      valueUsd: args.valueUsd,
      txHash: args.txHash,
      timestamp: args.timestamp ?? Date.now(),
    });

    // Award points per action
    const pts: Record<string, number> = {
      swap: 5, supply: 8, borrow: 8, stake: 10, transfer: 2,
    };
    const earned = pts[args.action] ?? 3;

    const user = await ctx.db
      .query("users")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", addr))
      .unique();
    if (user) await ctx.db.patch(user._id, { points: user.points + earned });
  },
});

export const getActivity = query({
  args: { walletAddress: v.string(), limit: v.optional(v.float64()) },
  handler: async (ctx, { walletAddress, limit }) => {
    const items = await ctx.db
      .query("userActivity")
      .withIndex("by_wallet_time", (q) =>
        q.eq("walletAddress", walletAddress.toLowerCase())
      )
      .order("desc")
      .take(limit ?? 50);
    return items;
  },
});

// ── Token balances snapshot ────────────────────────────────────────────────

/**
 * Saves a fresh token balance snapshot for a user.
 * Overwrites any previous entry for the same wallet+token pair.
 */
export const saveBalanceSnapshot = mutation({
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

