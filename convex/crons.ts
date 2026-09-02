import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Crons run on EVERY deployment they're pushed to — including dev, 24/7,
// which double-bills all the background refreshes. Dev has DISABLE_CRONS=1
// set (`npx convex env set DISABLE_CRONS 1`); prod leaves it unset.
if (process.env.DISABLE_CRONS !== "1") {
  // Refresh token list from DEX lists every hour
  crons.interval("refresh token list", { hours: 1 }, internal.tokens.fetchTokenLists);

  // Refresh USD prices every 5 minutes via DexScreener
  crons.interval("refresh token prices", { minutes: 5 }, internal.prices.fetchPrices);

  // ── Shared 30-minute snapshots ──────────────────────────────────────────
  // Everything below is identical for every visitor, so it is computed once
  // per tick server-side and read from a single row in the browser. 30 minutes
  // is the standard staleness budget for shared data (see src/lib/cacheKeys.ts
  // for the matching client-side TTLs); anything that must be fresher —
  // prices, quotes, receipts, per-wallet balances — is deliberately not here.

  // Precompute the Discover pool list — the frontend reads the snapshot
  // instead of running the slow multi-API pipeline per visitor
  crons.interval("refresh discover pools", { minutes: 30 }, internal.discoverRefresh.refresh);

  // One shared snapshot replaces every visitor polling the explorer
  // and DexScreener independently, keeping Convex/upstream usage bounded.
  crons.interval("refresh dashboard markets", { minutes: 30 }, internal.marketsRefresh.refresh);

  // The Yearn vault catalog — one ydaemon call for the whole app instead of
  // one per visitor who opens Earn, Portfolio, or Stake.
  crons.interval("refresh yearn vaults", { minutes: 30 }, internal.globalRefresh.refreshYearnVaults);

  // Global BearNFT/BearStaking numbers. These were polled every 15-20s by the
  // app shell of every visitor, connected or not; per-wallet reads stay live
  // on the client.
  crons.interval("refresh bear stats", { minutes: 30 }, internal.globalRefresh.refreshBearStats);

  // Drop expired memo-cache rows (simulator pool/token lookups) so the table
  // stays bounded — the sweep is batched, so it runs often.
  crons.interval("purge expired cache", { minutes: 30 }, internal.cacheFill.purge);

  // Verify managed LP custody, policy and live range on-chain. This queues
  // work only; the restricted smart account remains the security boundary.
  crons.interval("monitor managed LP ranges", { minutes: 1 }, internal.managedPositionMonitor.check);
  // Process at most one durable job per minute. A broadcast job is always
  // reconciled before another EOA nonce is used.
  crons.interval("execute managed LP rebalances", { minutes: 1 }, internal.rebalanceWorker.run);

  // Fire due recurring ("DCA") buys — enqueues a normal spot order per schedule.
  crons.interval("run recurring buys", { minutes: 1 }, internal.dca.tick);

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
