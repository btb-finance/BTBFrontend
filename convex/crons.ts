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
}

export default crons;
