import { action, internalAction, internalMutation, internalQuery, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

// Ethereum mainnet core tokens (always present regardless of external lists)
const CORE_TOKENS = [
  { address: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", symbol: "ETH",  name: "Ethereum",           decimals: 18, logoURI: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",   source: "core" },
  { address: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", symbol: "WETH", name: "Wrapped Ether",       decimals: 18, logoURI: "https://assets.coingecko.com/coins/images/2518/small/weth.png",      source: "core" },
  { address: "0x88888888c90cd71b35830dabfd24743dbc135b51", symbol: "BTB",  name: "BTB Finance",         decimals: 18, logoURI: "",                                                                    source: "core" },
  { address: "0x88888880d5ca13018d2dc11e2e4744bd91a5656f", symbol: "BTBB", name: "BTB Bear",            decimals: 18, logoURI: "",                                                                    source: "core" },
  { address: "0x88888805e7e3d5c7fb002ad98f08250e79c298dc", symbol: "OPOS", name: "OPOSSUM",             decimals: 18, logoURI: "",                                                                    source: "core" },
  { address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", symbol: "USDC", name: "USD Coin",            decimals: 6,  logoURI: "https://assets.coingecko.com/coins/images/6319/small/usdc.png",      source: "core" },
  { address: "0xdac17f958d2ee523a2206206994597c13d831ec7", symbol: "USDT", name: "Tether USD",          decimals: 6,  logoURI: "https://assets.coingecko.com/coins/images/325/small/Tether.png",     source: "core" },
  { address: "0x6b175474e89094c44da98b954eedeac495271d0f", symbol: "DAI",  name: "Dai Stablecoin",      decimals: 18, logoURI: "https://assets.coingecko.com/coins/images/9956/small/dai-multi-collateral-mcd.png", source: "core" },
  { address: "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599", symbol: "WBTC", name: "Wrapped Bitcoin",     decimals: 8,  logoURI: "https://assets.coingecko.com/coins/images/7598/small/wrapped_bitcoin_wbtc.png", source: "core" },
  { address: "0x514910771af9ca656af840dff83e8264ecf986ca", symbol: "LINK", name: "Chainlink",           decimals: 18, logoURI: "https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png", source: "core" },
  { address: "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984", symbol: "UNI",  name: "Uniswap",             decimals: 18, logoURI: "https://assets.coingecko.com/coins/images/12504/small/uniswap-uni.png", source: "core" },
  { address: "0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9", symbol: "AAVE", name: "Aave",                decimals: 18, logoURI: "https://assets.coingecko.com/coins/images/12645/small/aave-token-round.png", source: "core" },
  { address: "0xd533a949740bb3306d119cc777fa900ba034cd52", symbol: "CRV",  name: "Curve DAO Token",     decimals: 18, logoURI: "https://assets.coingecko.com/coins/images/12124/small/Curve.png",    source: "core" },
  { address: "0xc00e94cb662c3520282e6f5717214004a7f26888", symbol: "COMP", name: "Compound",            decimals: 18, logoURI: "https://assets.coingecko.com/coins/images/10775/small/COMP.png",    source: "core" },
  { address: "0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2", symbol: "MKR",  name: "Maker",               decimals: 18, logoURI: "https://assets.coingecko.com/coins/images/1364/small/Mark_Maker.png", source: "core" },
  { address: "0x6982508145454ce325ddbe47a25d4ec3d2311933", symbol: "PEPE", name: "Pepe",                decimals: 18, logoURI: "https://assets.coingecko.com/coins/images/29850/small/pepe-token.jpeg", source: "core" },
  { address: "0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce", symbol: "SHIB", name: "Shiba Inu",           decimals: 18, logoURI: "https://assets.coingecko.com/coins/images/11939/small/shiba.png",   source: "core" },
] as const;

/**
 * Curated DEX token lists — every entry is a list of tokens that the listed
 * DEX actually routes liquidity to, so dead/scam tokens are filtered upstream.
 *
 * `format` controls how the response is parsed:
 *  - "tokenlist": standard token-list format `{ tokens: [{ chainId, address, … }] }`
 *  - "array":     plain array of token objects (chainId field on each)
 *  - "1inch":     `{ "0xaddr": { address, symbol, name, decimals, logoURI } }` map (mainnet only)
 *  - "kyberswap": `{ data: { tokens: [{ address, symbol, name, decimals, logoURI }] } }`
 */
const MAINNET_TOKEN_LISTS = [
  { url: "https://tokens.uniswap.org",                                                                  source: "uniswap",   format: "tokenlist" as const },
  { url: "https://tokens.1inch.io/v1.2/1",                                                              source: "1inch",     format: "1inch"     as const },
  { url: "https://raw.githubusercontent.com/sushiswap/default-token-list/master/tokens/mainnet.json",   source: "sushiswap", format: "array"     as const },
  { url: "https://ks-setting.kyberswap.com/api/v1/tokens?chainIds=1&isWhitelisted=true&pageSize=10000", source: "kyberswap", format: "kyberswap" as const },
];

export const listAll = query({
  handler: async (ctx) => ctx.db.query("tokens").collect(),
});

export const listAllAddresses = internalQuery({
  handler: async (ctx) => {
    const tokens = await ctx.db.query("tokens").collect();
    return tokens.map((t) => t.address);
  },
});

type RawToken = { chainId?: number; address?: string; symbol?: string; name?: string; decimals?: number; logoURI?: string };

function normalizeList(format: typeof MAINNET_TOKEN_LISTS[number]["format"], val: unknown): RawToken[] {
  if (val == null) return [];
  switch (format) {
    case "tokenlist": {
      const tokens = (val as { tokens?: unknown[] }).tokens;
      return Array.isArray(tokens) ? (tokens as RawToken[]) : [];
    }
    case "array":
      return Array.isArray(val) ? (val as RawToken[]) : [];
    case "1inch": {
      // `{ "0xaddr": { address, symbol, name, decimals, logoURI } }` — mainnet only.
      if (typeof val !== "object" || Array.isArray(val)) return [];
      return Object.values(val as Record<string, RawToken>).map((t) => ({ ...t, chainId: 1 }));
    }
    case "kyberswap": {
      // KyberSwap wraps tokens in `data.tokens`; be permissive about exact shape.
      const v = val as { data?: { tokens?: unknown[] } | unknown[] } | { tokens?: unknown[] };
      const candidates: unknown[] = [
        (v as any)?.data?.tokens,
        (v as any)?.data,
        (v as any)?.tokens,
      ];
      const tokens = candidates.find((c) => Array.isArray(c));
      return Array.isArray(tokens) ? (tokens as RawToken[]).map((t) => ({ ...t, chainId: 1 })) : [];
    }
  }
}

export const fetchTokenLists = internalAction({
  handler: async (ctx) => {
    const results = await Promise.allSettled(
      MAINNET_TOKEN_LISTS.map(({ url }) =>
        fetch(url, { signal: AbortSignal.timeout(12000) }).then((r) => r.json())
      )
    );

    const seen = new Set<string>(CORE_TOKENS.map((t) => t.address));
    const tokens: {
      address: string; symbol: string; name: string;
      decimals: number; logoURI?: string; source: string;
    }[] = [...CORE_TOKENS];

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status !== "fulfilled") continue;
      const { source, format } = MAINNET_TOKEN_LISTS[i];
      const list = normalizeList(format, r.value);

      for (const t of list) {
        if (t.chainId !== 1) continue;
        const key = (t.address ?? "").toLowerCase();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        tokens.push({
          address: key,
          symbol: t.symbol ?? "",
          name: t.name ?? "",
          decimals: t.decimals ?? 18,
          // 1inch/KyberSwap sometimes send `null` here; validator wants string or absent.
          logoURI: typeof t.logoURI === "string" && t.logoURI ? t.logoURI : undefined,
          source,
        });
      }
    }

    // Replace the table in pages — a single delete-and-reinsert of >4k rows
    // blows past Convex's 4096-read-per-transaction limit.
    const BATCH = 500;
    while (true) {
      const removed = await ctx.runMutation(internal.tokens.clearTokensBatch, { limit: BATCH });
      if (removed < BATCH) break;
    }
    for (let i = 0; i < tokens.length; i += BATCH) {
      await ctx.runMutation(internal.tokens.insertTokensBatch, { tokens: tokens.slice(i, i + BATCH) });
    }
  },
});

/**
 * Public action — called by client on first load if the token list is empty.
 * Inserts core tokens immediately so the portfolio can load, then fetches full lists.
 */
export const seedIfEmpty = action({
  handler: async (ctx) => {
    const existing = await ctx.runQuery(internal.tokens.listAllAddresses);
    if (existing.length > 0) return; // already populated
    // Insert core tokens right away so portfolio can run immediately
    await ctx.runMutation(internal.tokens.insertTokensBatch, { tokens: [...CORE_TOKENS] });
    // Then kick off full list fetch in background
    await ctx.runAction(internal.tokens.fetchTokenLists);
  },
});

const TOKEN_VALIDATOR = v.array(v.object({
  address: v.string(),
  symbol: v.string(),
  name: v.string(),
  decimals: v.float64(),
  logoURI: v.optional(v.string()),
  source: v.string(),
}));

/** Deletes up to `limit` rows; returns count so the caller can loop until 0/short. */
export const clearTokensBatch = internalMutation({
  args: { limit: v.float64() },
  handler: async (ctx, { limit }) => {
    const batch = await ctx.db.query("tokens").take(limit);
    for (const t of batch) await ctx.db.delete(t._id);
    return batch.length;
  },
});

/** Inserts a batch of tokens (kept small enough to stay under per-mutation limits). */
export const insertTokensBatch = internalMutation({
  args: { tokens: TOKEN_VALIDATOR },
  handler: async (ctx, { tokens }) => {
    for (const t of tokens) await ctx.db.insert("tokens", t);
  },
});
