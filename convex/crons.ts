import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Crons run on EVERY deployment they're pushed to — including dev, 24/7,
// which double-bills all the background refreshes. Dev has DISABLE_CRONS=1
// set (`npx convex env set DISABLE_CRONS 1`); prod leaves it unset.
if (process.env.DISABLE_CRONS !== "1") {
  // Ethereum token list from the public DEX lists. They change slowly and the
  // refresh only writes what changed, so once a week is plenty.
  crons.weekly("refresh token list", { dayOfWeek: "monday", hourUTC: 3, minuteUTC: 0 }, internal.tokens.fetchTokenLists);

  // Refresh USD prices every 5 minutes via DexScreener
  crons.interval("refresh token prices", { minutes: 5 }, internal.prices.fetchPrices);

  // ── Shared 30-minute snapshots ──────────────────────────────────────────
  // Everything below is identical for every visitor, so it is computed once
  // per tick server-side and read from a single row in the browser. 30 minutes
  // is the standard staleness budget for shared data (see src/lib/cacheKeys.ts
  // for the matching client-side TTLs); anything that must be fresher —
  // prices, quotes, receipts, per-wallet balances — is deliberately not here.

  // Precompute the Discover pool list — the frontend reads the snapshot
  // instead of running the slow multi-API pipeline per visitor. One run is a
  // ~26 minute chain of paid action steps (base pass, one DEX coverage pass per
  // chain, logos, Merkl) and was most of the action compute bill at every 30
  // minutes. Pool stats are mostly 24h figures, so every 6 hours is plenty;
  // balances, positions, prices and quotes never come from this snapshot.
  crons.interval("refresh discover pools", { hours: 6 }, internal.discoverRefresh.refresh);


  // Drop expired memo-cache rows (simulator pool/token lookups) so the table
  // stays bounded — the sweep is batched, so it runs often.
  crons.interval("purge expired cache", { minutes: 30 }, internal.cacheFill.purge);

  // Range alerts for LP positions of wallets holding 10,000 BTB or more. Each
  // tick reads only what is due: free alerts hourly, paid fast ones every tick.
  crons.interval("check LP range alerts", { minutes: 5 }, internal.alertsActions.check);

  // Auto-rebalance schedules each position's next check itself; this only
  // picks up a row whose scheduled check was lost (a restart), so it is cheap.
  crons.interval("sweep auto-rebalance schedules", { minutes: 30 }, internal.autoRebalance.sweep);

  // Settle the weekly rewards epoch: unwrap the OPOS tax the treasury collected
  // into BTB and queue a pro-rata payout per requester. Epochs end Friday 00:00
  // UTC; this ticks hourly rather than weekly so a failed settlement retries an
  // hour later instead of waiting a full week.
  crons.interval("close due rewards epoch", { hours: 1 }, internal.rewards.closeEpoch);

  // Safety net for the payout queue — the worker chains itself, but a Convex
  // restart mid-drain would otherwise leave leased rows waiting for next Friday.
  crons.interval("drain reward payouts", { minutes: 5 }, internal.rewardsActions.drain);
}

export default crons;
