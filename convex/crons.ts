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

  // Precompute the Discover pool list hourly — the frontend reads the snapshot
  // instead of running the slow multi-API pipeline per visitor
  crons.interval("refresh discover pools", { hours: 1 }, internal.discoverRefresh.refresh);

  // One shared hourly snapshot replaces every visitor polling the explorer
  // and DexScreener independently, keeping Convex/upstream usage bounded.
  crons.interval("refresh dashboard markets", { hours: 1 }, internal.marketsRefresh.refresh);

  // Verify managed LP custody, policy and live range on-chain. This queues
  // work only; the restricted smart account remains the security boundary.
  crons.interval("monitor managed LP ranges", { minutes: 1 }, internal.managedPositionMonitor.check);
  // Process at most one durable job per minute. A broadcast job is always
  // reconciled before another EOA nonce is used.
  crons.interval("execute managed LP rebalances", { minutes: 1 }, internal.rebalanceWorker.run);

  // Fire due recurring ("DCA") buys — enqueues a normal spot order per schedule.
  crons.interval("run recurring buys", { minutes: 1 }, internal.dca.tick);
}

export default crons;
