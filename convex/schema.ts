import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ── Token data ────────────────────────────────────────────────────────────

  // Merged token list from Uniswap, CoinGecko, Sushiswap — Ethereum mainnet only
  tokens: defineTable({
    address: v.string(),      // lowercase 0x…
    symbol: v.string(),
    name: v.string(),
    decimals: v.float64(),
    logoURI: v.optional(v.string()),
    source: v.string(),       // "core" | "uniswap" | "coingecko" | "sushiswap" | "gemini"
  }).index("by_address", ["address"]),

  // One row per wallet in a profile. `profileId` is the lowercase address of
  // the wallet that started the profile; every linked wallet shares it, so a
  // login with any of them resolves the whole set in one indexed read.
  profileLinks: defineTable({
    address: v.string(),        // lowercase 0x…
    profileId: v.string(),      // lowercase anchor address
    label: v.optional(v.string()),
    linkedAt: v.float64(),
    // Imported by address without a signature from that wallet: view only,
    // never treated as ownership, so the wallet can still start its own profile.
    watched: v.optional(v.boolean()),
  }).index("by_address", ["address"]).index("by_profile", ["profileId"]),

  // Agent chat history — one row per message, gated to 10M BTB holders.
  agentMessages: defineTable({
    walletAddress: v.string(),   // lowercase
    role: v.string(),            // "user" | "assistant"
    content: v.string(),
    createdAt: v.float64(),
  }).index("by_wallet", ["walletAddress", "createdAt"]),

  // Discover pool list, precomputed hourly by convex/discover.ts (single row).
  // `json` = { version, pools: EarnPool[], priceChange: Record<poolId, pct> }.
  discoverPools: defineTable({
    json: v.string(),
    updatedAt: v.float64(),
  }),

  // Token logo per chain and address, filled from GeckoTerminal after each
  // Discover refresh so pool rows on every chain carry both token images.
  tokenLogos: defineTable({
    key: v.string(),            // `${chainId}:${lowercase address}`
    logoURI: v.string(),
    updatedAt: v.float64(),
  }).index("by_key", ["key"]),

  // Robinhood market feed, refreshed once server-side and read by every
  // Dashboard visitor without repeating the explorer/DexScreener scan.
  marketSnapshots: defineTable({
    json: v.string(),
    updatedAt: v.float64(),
  }),

  // ── Shared server-computed caches ─────────────────────────────────────────
  // Two generic stores replace the "one bespoke table per dataset" pattern
  // (discoverPools/marketSnapshots above predate them and are left in place).

  // Cron-driven global snapshots — data identical for every visitor, recomputed
  // on a schedule and read with one query instead of per-visitor API work.
  // `key` is the dataset name (e.g. "bear-stats").
  snapshots: defineTable({
    key: v.string(),
    json: v.string(),
    updatedAt: v.float64(),
  }).index("by_key", ["key"]),

  // On-demand memo cache for data keyed by user input (a pool address, a token
  // pair) — too many combinations to precompute, but identical across everyone
  // who asks for the same key. Filled lazily by convex/cacheFill.ts and read
  // straight from the table on every later hit until `expiresAt`.
  cacheEntries: defineTable({
    key: v.string(),
    json: v.string(),
    updatedAt: v.float64(),
    expiresAt: v.float64(),
  }).index("by_key", ["key"])
    .index("by_expires", ["expiresAt"]),

  // Prices refreshed every 5 min via cron
  tokenPrices: defineTable({
    address: v.string(),
    priceUsd: v.float64(),
    liquidityUsd: v.float64(),
    updatedAt: v.float64(),
  }).index("by_address", ["address"]),

  // ── User profiles ─────────────────────────────────────────────────────────

  users: defineTable({
    walletAddress: v.string(),         // lowercase — primary key
    joinedAt: v.float64(),             // ms timestamp when first connected
    lastCheckIn: v.optional(v.float64()),
    lastWeeklyClaim: v.optional(v.float64()), // ms timestamp of last weekly bonus
    currentStreak: v.float64(),        // consecutive daily check-ins
    longestStreak: v.float64(),
    totalCheckIns: v.float64(),
    points: v.float64(),               // XP — convertible to BTB later
    portfolioValueUsd: v.optional(v.float64()),
    portfolioUpdatedAt: v.optional(v.float64()),
  }).index("by_wallet", ["walletAddress"]),

  // Quest proof submissions (tweets, articles, installs…). XP is only credited
  // on approval — nothing here awards points at submission time, because none
  // of these proofs can be verified by the server.
  questSubmissions: defineTable({
    walletAddress: v.string(),         // lowercase
    questId: v.string(),               // key into convex/questCatalog.ts
    proof: v.string(),                 // link, handle, or free text per quest.proof
    xp: v.float64(),                   // snapshotted from the catalog at submit time
    status: v.string(),                // "pending" | "approved" | "rejected"
    submittedAt: v.float64(),
    reviewedAt: v.optional(v.float64()),
    reviewNote: v.optional(v.string()),
    awardedEpochId: v.optional(v.float64()),
  }).index("by_wallet", ["walletAddress"])
    .index("by_wallet_quest", ["walletAddress", "questId"])
    .index("by_status", ["status", "submittedAt"]),

  // Once-a-day XP awards (Simulate: first pool checked, cross-chain research
  // per chain). `day` is UTC midnight ms; `key` names the action so a second
  // hit the same day is a no-op instead of a second payout.
  dailyAwards: defineTable({
    walletAddress: v.string(),         // lowercase
    day: v.float64(),
    key: v.string(),                   // "simulate:pool" | "simulate:chain:<chainId>"
    xp: v.float64(),
    createdAt: v.float64(),
  }).index("by_wallet_day_key", ["walletAddress", "day", "key"]),

  // Per-epoch XP ledger. `users.points` stays a lifetime vanity counter; the
  // weekly BTB split is decided purely by what a wallet earned inside one
  // Friday→Friday window, so every award site writes here too.
  epochPoints: defineTable({
    epochId: v.float64(),
    walletAddress: v.string(),         // lowercase
    points: v.float64(),
    updatedAt: v.float64(),
  }).index("by_epoch_wallet", ["epochId", "walletAddress"])
    .index("by_epoch", ["epochId"]),

  // One row per weekly reward epoch. Created lazily when the first user
  // requests a payout, closed by the Friday cron.
  rewardEpochs: defineTable({
    epochId: v.float64(),
    state: v.string(),                 // "open" | "burning" | "paying" | "paid" | "failed"
    startsAt: v.float64(),
    endsAt: v.float64(),
    carryInRaw: v.string(),            // BTB wei rolled over from the previous epoch
    oposBurnedRaw: v.optional(v.string()),
    btbPotRaw: v.optional(v.string()), // burn proceeds + carry-in — the whole pot
    carryOutRaw: v.optional(v.string()), // pro-rata remainder, rolls into next epoch
    totalPoints: v.optional(v.float64()),
    requesterCount: v.optional(v.float64()),
    burnTxHash: v.optional(v.string()),
    settledAt: v.optional(v.float64()),
    error: v.optional(v.string()),
  }).index("by_epoch", ["epochId"])
    .index("by_state", ["state"]),

  // A wallet's opt-in to one epoch's split. The by_epoch_wallet index is what
  // enforces "one request per user per week" — insertion checks it first.
  rewardRequests: defineTable({
    epochId: v.float64(),
    walletAddress: v.string(),         // lowercase
    pointsAtRequest: v.float64(),      // informational; settlement re-reads epochPoints
    requestedAt: v.float64(),
    pointsAtSettle: v.optional(v.float64()),
    awardedRaw: v.optional(v.string()),
  }).index("by_epoch_wallet", ["epochId", "walletAddress"])
    .index("by_epoch", ["epochId"])
    .index("by_wallet", ["walletAddress"]),

  // Durable BTB payout queue. Rows are only ever created by settlement, never
  // by a client, and the worker sends at most one transfer at a time so the
  // treasury EOA never races its own nonce.
  rewardPayouts: defineTable({
    epochId: v.float64(),
    walletAddress: v.string(),         // lowercase
    amountRaw: v.string(),             // BTB wei
    // "claimable" — settled and waiting for the user to press Claim. Expires
    // into "expired" when the next epoch settles; its BTB rejoins the pot.
    state: v.string(),                 // "claimable" | "queued" | "sending" | "submitted" | "confirmed" | "failed" | "expired"
    attempts: v.float64(),
    createdAt: v.float64(),
    updatedAt: v.float64(),
    nextAttemptAt: v.optional(v.float64()),
    leaseUntil: v.optional(v.float64()),
    workerId: v.optional(v.string()),
    txHash: v.optional(v.string()),
    error: v.optional(v.string()),
  }).index("by_state_created", ["state", "createdAt"])
    .index("by_epoch", ["epochId"])
    .index("by_wallet", ["walletAddress"]),

  // DeFi activity feed — append only, one row per on-chain event
  userActivity: defineTable({
    walletAddress: v.string(),
    protocol: v.string(),              // "uniswap" | "aave" | "curve" | "btb" | …
    action: v.string(),                // "swap" | "supply" | "borrow" | "stake" | "transfer"
    tokenIn: v.optional(v.string()),   // token address
    tokenOut: v.optional(v.string()),
    valueUsd: v.optional(v.float64()),
    txHash: v.optional(v.string()),
    timestamp: v.float64(),
  }).index("by_wallet", ["walletAddress"])
    .index("by_wallet_time", ["walletAddress", "timestamp"]),

  // Latest token balance snapshot per user (upserted on each portfolio refresh)
  userTokenBalances: defineTable({
    walletAddress: v.string(),
    tokenAddress: v.string(),
    symbol: v.string(),
    name: v.string(),
    decimals: v.float64(),
    logoURI: v.optional(v.string()),
    balanceFormatted: v.string(),
    balanceRaw: v.string(),
    valueUsd: v.float64(),
    updatedAt: v.float64(),
  }).index("by_wallet", ["walletAddress"])
    .index("by_wallet_token", ["walletAddress", "tokenAddress"]),


  // Durable audit/worker queue. Only the on-chain monitor creates jobs.
  rebalanceJobs: defineTable({
    positionKey: v.string(),
    chainId: v.float64(),
    account: v.string(),
    positionManager: v.string(),
    positionId: v.string(),
    state: v.string(),
    requestedAt: v.float64(),
    updatedAt: v.float64(),
    attempts: v.float64(),
    nextAttemptAt: v.optional(v.float64()),
    newPositionId: v.optional(v.string()),
    txHash: v.optional(v.string()),
    signedTransaction: v.optional(v.string()),
    error: v.optional(v.string()),
  }).index("by_position", ["positionKey"])
    .index("by_state", ["state"]),


  // ── Shared pool-fact cache (server-written only) ───────────────────────────
  // Enrichment results (fee tier, AMM class, ±5% range APR) probed by the
  // server route. Clients READ these but can never write them — writes carry a
  // secret checked against the POOL_FACTS_SECRET Convex env var, so one user
  // cannot poison another user's view.
  poolFacts: defineTable({
    chainId: v.float64(),
    address: v.string(),       // lowercase pool address
    feePct: v.optional(v.float64()),   // fraction (0.0005 = 0.05%)
    ammClass: v.string(),      // 'v3' | 'v2' | 'algebra' | 'unknown'
    rangeApr: v.optional(v.float64()), // ±5% range APR % when priceable
    updatedAt: v.float64(),
    expiresAt: v.float64(),
  }).index("by_chain_address", ["chainId", "address"]),
});
