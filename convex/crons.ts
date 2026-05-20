import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Refresh token list from DEX lists every hour
crons.interval("refresh token list", { hours: 1 }, internal.tokens.fetchTokenLists);

// Refresh USD prices every 5 minutes via DexScreener
crons.interval("refresh token prices", { minutes: 5 }, internal.prices.fetchPrices);

export default crons;
