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

  // Robinhood market feed, refreshed once server-side and read by every
  // Dashboard visitor without repeating the explorer/DexScreener scan.
  marketSnapshots: defineTable({
    json: v.string(),
    updatedAt: v.float64(),
  }),

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

  // Off-chain index of owner-custodied BTB smart-account LPs. Every row is
  // re-verified against the chain by the monitor; client writes are never
  // treated as authorization to rebalance.
  managedLpPositions: defineTable({
    key: v.string(),
    chainId: v.float64(),
    owner: v.string(),
    account: v.string(),
    positionManager: v.string(),
    positionId: v.string(),
    pool: v.string(),
    token0: v.string(),
    token1: v.string(),
    fee: v.float64(),
    tickLower: v.float64(),
    tickUpper: v.float64(),
    currentTick: v.optional(v.float64()),
    targetTickWidth: v.float64(),
    minimumAllowedTick: v.float64(),
    maximumAllowedTick: v.float64(),
    maxSlippageBps: v.float64(),
    maxSwapBps: v.float64(),
    twapSeconds: v.float64(),
    minRebalanceInterval: v.float64(),
    expiresAt: v.float64(),
    status: v.string(),
    enabled: v.boolean(),
    source: v.string(),
    registeredAt: v.float64(),
    updatedAt: v.float64(),
    nextCheckAt: v.float64(),
    lastCheckedAt: v.optional(v.float64()),
    lastRebalanceAt: v.optional(v.float64()),
    lastError: v.optional(v.string()),
  }).index("by_key", ["key"])
    .index("by_owner", ["owner"])
    .index("by_due", ["nextCheckAt"])
    .index("by_status", ["status"]),

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

  // Durable instant-trade queue. Device authorization is verified before
  // insertion; the secret request key is intentionally never persisted.
  spotTradeOrders: defineTable({
    orderKey: v.string(),
    chainId: v.float64(),
    account: v.string(),
    router: v.optional(v.string()),
    tokenIn: v.string(),
    tokenOut: v.string(),
    amountIn: v.string(),
    minimumGrossOutput: v.optional(v.string()),
    minimumProtocolFee: v.optional(v.string()),
    nonce: v.optional(v.string()),
    deadline: v.optional(v.float64()),
    sessionSignature: v.optional(v.string()),
    state: v.string(),
    requestedAt: v.float64(),
    updatedAt: v.float64(),
    attempts: v.float64(),
    nextAttemptAt: v.optional(v.float64()),
    leaseUntil: v.optional(v.float64()),
    workerId: v.optional(v.string()),
    txHash: v.optional(v.string()),
    signedTransaction: v.optional(v.string()),
    submittedAt: v.optional(v.float64()),
    netAmountOut: v.optional(v.string()),
    grossAmountOut: v.optional(v.string()),
    protocolFee: v.optional(v.string()),
    amountInUsd: v.optional(v.float64()),
    error: v.optional(v.string()),
  }).index("by_order_key", ["orderKey"])
    .index("by_account_time", ["account", "requestedAt"])
    .index("by_state_time", ["state", "requestedAt"]),

  // Recurring ("DCA") buys. Device authorization is verified at creation; only
  // the request-key hash is persisted so pause/delete can re-check ownership.
  // A minute cron enqueues a normal spotTradeOrder for each due schedule.
  spotTradeSchedules: defineTable({
    account: v.string(),
    owner: v.string(),
    chainId: v.float64(),
    tokenIn: v.string(),
    tokenOut: v.string(),
    tokenInSymbol: v.string(),
    tokenOutSymbol: v.string(),
    tokenOutImage: v.optional(v.string()),
    amountIn: v.string(),          // token units, re-sized from amountUsd each run
    amountUsd: v.float64(),        // the dollar target the user set
    intervalMs: v.float64(),
    requestKeyHash: v.string(),
    enabled: v.boolean(),
    nextRunAt: v.float64(),
    lastRunAt: v.optional(v.float64()),
    runsCompleted: v.float64(),
    maxRuns: v.optional(v.float64()),
    createdAt: v.float64(),
    updatedAt: v.float64(),
    lastError: v.optional(v.string()),
  }).index("by_account", ["account"])
    .index("by_enabled_next", ["enabled", "nextRunAt"]),
});
