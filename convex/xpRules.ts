// Every XP number and formula, and the weekly schedule, in one place.
// Imported by the Convex functions that award XP and settle weeks, and by the
// screens that preview them, so the two can never drift. No Convex functions
// live here.

// Weeks run Friday 00:00 UTC to Friday 00:00 UTC. Unix time starts on a
// Thursday, so the first Friday midnight is exactly one day in; that offset is
// the whole anchor.
const WEEK_MS = 604_800_000;
const FIRST_FRIDAY_MS = 86_400_000;

/** Index of the weekly epoch containing `at` (default: now). */
export function epochIdAt(at: number = Date.now()): number {
  return Math.floor((at - FIRST_FRIDAY_MS) / WEEK_MS);
}

export function epochWindow(epochId: number) {
  const startsAt = FIRST_FRIDAY_MS + epochId * WEEK_MS;
  return { startsAt, endsAt: startsAt + WEEK_MS };
}

/** Daily check-in XP grows with the streak: day 1 = 10, +2 each day, capped at 50. */
export function dailyXpForStreak(streak: number): number {
  return Math.min(10 + (streak - 1) * 2, 50);
}

/** Every 7th streak day pays a bonus that grows each week: +50, +100, … */
export function weekMilestoneXp(streak: number): number {
  return streak > 0 && streak % 7 === 0 ? (streak / 7) * 50 : 0;
}

/** Holder bonus: 1 XP per this many BTB held, on every check-in. */
export const BTB_PER_BONUS_XP = 100;
/** Most bonus XP one check-in can pay, so a single large holder cannot take the whole weekly split. */
export const HOLD_BONUS_CAP = 10_000;

/** Bonus XP for BTB held since the previous check-in (the lower of then and now). */
export function holdBonusXp(previousBtb: number | undefined, currentBtb: number | undefined): number {
  if (previousBtb == null || currentBtb == null) return 0;
  return Math.min(HOLD_BONUS_CAP, Math.floor(Math.min(previousBtb, currentBtb) / BTB_PER_BONUS_XP));
}

/** XP for one verified swap or bridge. */
export const SWAP_XP = 100;
/** Swap and bridge awards a wallet can earn per UTC day; each needs its own verified transaction. */
export const TX_XP_DAILY_CAP = 20;
/** XP per BTB Bear minted. */
export const MINT_XP = 1000;
/** Simulate: first pool checked each day, and each chain researched each day. */
export const SIMULATE_XP = 100;
/** Distinct chains a wallet can be paid for researching per day. */
export const SIMULATE_CHAINS_PER_DAY = 8;
