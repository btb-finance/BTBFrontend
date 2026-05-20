import { action, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

const STABLECOINS: Record<string, number> = {
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": 1, // USDC
  "0xdac17f958d2ee523a2206206994597c13d831ec7": 1, // USDT
  "0x6b175474e89094c44da98b954eedeac495271d0f": 1, // DAI
  "0x853d955acef822db058eb8505911ed77f175b99e": 1, // FRAX
  "0x5f98805a4e8be255a32880fdec7f6728c6568ba0": 1, // LUSD
  "0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca": 1, // USDbC
};

const CORE_ADDRESSES = [
  "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", // WETH
  "0x88888888c90cd71b35830dabfd24743dbc135b51", // BTB
  "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599", // WBTC
  "0x514910771af9ca656af840dff83e8264ecf986ca", // LINK
  "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984", // UNI
  "0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9", // AAVE
  "0xd533a949740bb3306d119cc777fa900ba034cd52", // CRV
  "0x6982508145454ce325ddbe47a25d4ec3d2311933", // PEPE
  "0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce", // SHIB
];

type DexPair = {
  chainId?: string;
  baseToken?: { address?: string };
  quoteToken?: { address?: string };
  priceUsd?: string;
  priceNative?: string;
  liquidity?: { usd?: number };
};

/**
 * Walk a list of DexScreener pairs and pick, for each address we asked about,
 * the deepest Ethereum pool that prices it — whether the token sits on the
 * base side (`priceUsd` directly) or the quote side (`priceUsd / priceNative`).
 */
function harvestPrices(
  pairs: DexPair[],
  targets: Set<string>,
  bestByToken: Map<string, { price: number; liq: number }>,
) {
  for (const pair of pairs) {
    if (pair.chainId !== "ethereum") continue;
    const liq = pair.liquidity?.usd || 0;
    const baseAddr = pair.baseToken?.address?.toLowerCase();
    const quoteAddr = pair.quoteToken?.address?.toLowerCase();
    const priceUsd = parseFloat(pair.priceUsd || "0");
    const priceNative = parseFloat(pair.priceNative || "0");

    if (baseAddr && targets.has(baseAddr) && priceUsd > 0) {
      const existing = bestByToken.get(baseAddr);
      if (!existing || liq > existing.liq) bestByToken.set(baseAddr, { price: priceUsd, liq });
    }
    // Quote-side recovery: e.g. LINK/WETH credits LINK's price; derive WETH's
    // from priceUsd / priceNative so well-known quote tokens still land.
    if (quoteAddr && targets.has(quoteAddr) && priceUsd > 0 && priceNative > 0) {
      const derived = priceUsd / priceNative;
      const existing = bestByToken.get(quoteAddr);
      if (!existing || liq > existing.liq) bestByToken.set(quoteAddr, { price: derived, liq });
    }
  }
}

export const fetchPrices = internalAction({
  handler: async (ctx) => {
    const allTokens = await ctx.runQuery(internal.tokens.listAllAddresses);
    const addresses = [...new Set([...CORE_ADDRESSES, ...allTokens])];
    const now = Date.now();

    const updates: { address: string; priceUsd: number; liquidityUsd: number }[] = [];

    for (const [addr, price] of Object.entries(STABLECOINS)) {
      updates.push({ address: addr, priceUsd: price, liquidityUsd: 1e9 });
    }

    const toFetch = addresses.filter((a) => !STABLECOINS[a]);
    const bestByToken = new Map<string, { price: number; liq: number }>();

    // Pass 1 — query CORE_ADDRESSES one at a time. DexScreener caps responses
    // at ~30 pairs total; when batched, WETH-as-base pools get crowded out by
    // the long tail. Per-token queries guarantee each core token's deepest
    // pool comes back.
    for (const addr of CORE_ADDRESSES) {
      if (STABLECOINS[addr]) continue;
      try {
        const res = await fetch(
          `https://api.dexscreener.com/latest/dex/tokens/${addr}`,
          { signal: AbortSignal.timeout(10000) }
        );
        if (!res.ok) continue;
        const data = await res.json() as { pairs?: DexPair[] };
        if (data?.pairs) harvestPrices(data.pairs, new Set([addr]), bestByToken);
      } catch { /* skip */ }
    }

    // Pass 2 — batch the rest in groups of 30 for throughput.
    const restToFetch = toFetch.filter((a) => !CORE_ADDRESSES.includes(a));
    for (let i = 0; i < restToFetch.length; i += 30) {
      const batch = restToFetch.slice(i, i + 30);
      try {
        const res = await fetch(
          `https://api.dexscreener.com/latest/dex/tokens/${batch.join(",")}`,
          { signal: AbortSignal.timeout(10000) }
        );
        if (!res.ok) continue;
        const data = await res.json() as { pairs?: DexPair[] };
        if (data?.pairs) harvestPrices(data.pairs, new Set(batch), bestByToken);
      } catch { /* skip failed batch */ }
    }

    for (const addr of toFetch) {
      const entry = bestByToken.get(addr.toLowerCase());
      if (entry) updates.push({ address: addr.toLowerCase(), priceUsd: entry.price, liquidityUsd: entry.liq });
    }

    if (updates.length > 0) {
      await ctx.runMutation(internal.prices.savePrices, { updates, now });
    }
  },
});

export const countPrices = internalQuery({
  handler: async (ctx) => (await ctx.db.query("tokenPrices").collect()).length,
});

/** Public — kicks off price fetch if the prices table is empty. Safe to call on every connect. */
export const seedPricesIfEmpty = action({
  handler: async (ctx) => {
    const count = await ctx.runQuery(internal.prices.countPrices);
    if (count > 0) return;
    await ctx.runAction(internal.prices.fetchPrices);
  },
});

export const savePrices = internalMutation({
  args: {
    updates: v.array(v.object({ address: v.string(), priceUsd: v.float64(), liquidityUsd: v.float64() })),
    now: v.float64(),
  },
  handler: async (ctx, { updates, now }) => {
    for (const { address, priceUsd, liquidityUsd } of updates) {
      const existing = await ctx.db
        .query("tokenPrices")
        .withIndex("by_address", (q) => q.eq("address", address))
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, { priceUsd, liquidityUsd, updatedAt: now });
      } else {
        await ctx.db.insert("tokenPrices", { address, priceUsd, liquidityUsd, updatedAt: now });
      }
    }
  },
});
