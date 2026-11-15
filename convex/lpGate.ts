/**
 * The $1 LP rule: daily check-in XP and Simulate XP go only to wallets with an open LP position worth at least $1, so
 * a farm of empty wallets earns nothing. Swaps, mints and rebalances already cost gas and are not gated.
 *
 * Where a position can be:
 *  - in an auto wallet: a live auto-rebalance job counts as an open position;
 *  - on any chain Krystal indexes (Ethereum, Base, BNB and more): its open positions and their USD value;
 *  - on Robinhood Chain or Arc, which Krystal does not index: V3-style positions the wallet holds, read on-chain and
 *    priced through their own pool against a stablecoin or WETH.
 * Not seen: positions staked in a Robinhood gauge or farm, V4 positions on Robinhood or Arc, and Metric bins.
 *
 * When nothing could be read at all (Krystal and every RPC down), the wallet is let through rather than punished for
 * our outage. Answers are cached: a yes for 6 hours, a no for 10 minutes so a new position counts soon.
 */
import { internalMutation, internalQuery, type ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { formatUnits, type PublicClient } from "viem";
import { getChainClient } from "../src/lib/chainClient";
import { fetchV3Positions } from "../src/protocols/dexs/uniswap";
import { v3DeploymentFor, type LpDex } from "../src/protocols/lpChains";
import { ROBINHOOD_WETH, ARC_WUSDC } from "../src/protocols/dexs/uniswap/v3/addresses";
import { STABLES } from "../src/lib/pools";

export const LP_MIN_USD = 1;
const YES_TTL_MS = 6 * 3600_000;
const NO_TTL_MS = 10 * 60_000;

const KRYSTAL = "https://api.krystal.app/all/v1/lp/userPositions";
const KRYSTAL_CHAINS = "1,10,56,130,137,2020,324,42161,43114,59144,80094,81457,8453,999";
const ONCHAIN_CHAINS = [4663, 5042] as const;
const DEXES: LpDex[] = ["uniswap", "pancakeswap", "sushiswap", "aero", "aerodrome", "giga", "ramses", "up", "alandale"];

export type LpGate = { ok: boolean; usd: number };

export const cached = internalQuery({
  args: { wallet: v.string() },
  handler: async (ctx, { wallet }) => {
    const row = await ctx.db.query("lpGateCache").withIndex("by_wallet", (q) => q.eq("walletAddress", wallet)).unique();
    if (!row) return null;
    const ttl = row.ok ? YES_TTL_MS : NO_TTL_MS;
    return Date.now() - row.checkedAt < ttl ? { ok: row.ok, usd: row.usd } : null;
  },
});

export const save = internalMutation({
  args: { wallet: v.string(), ok: v.boolean(), usd: v.float64() },
  handler: async (ctx, { wallet, ok, usd }) => {
    const row = await ctx.db.query("lpGateCache").withIndex("by_wallet", (q) => q.eq("walletAddress", wallet)).unique();
    const fields = { ok, usd, checkedAt: Date.now() };
    if (row) await ctx.db.patch(row._id, fields);
    else await ctx.db.insert("lpGateCache", { walletAddress: wallet, ...fields });
  },
});

export const hasLiveJob = internalQuery({
  args: { wallet: v.string() },
  handler: async (ctx, { wallet }) =>
    (await ctx.db.query("autoRebalances").withIndex("by_address", (q) => q.eq("address", wallet)).collect())
      .some((j) => j.status !== "stopped"),
});

/** USD value of the wallet's open positions on Krystal's chains; null when Krystal could not be read. */
async function krystalUsd(wallet: string): Promise<number | null> {
  try {
    const q = new URLSearchParams({ addresses: wallet, chainIds: KRYSTAL_CHAINS, positionStatus: "open", orderBy: "lastAction", orderASC: "false", limit: "100", offset: "0" });
    const res = await fetch(`${KRYSTAL}?${q}`, { headers: { accept: "application/json", "user-agent": "BTB-Finance/1.0" }, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    const body = (await res.json()) as { positions?: { currentPositionValue?: unknown }[] };
    return (body.positions ?? []).reduce((sum, p) => sum + (typeof p.currentPositionValue === "number" && p.currentPositionValue > 0 ? p.currentPositionValue : 0), 0);
  } catch {
    return null;
  }
}

async function ethUsd(): Promise<number | null> {
  try {
    const usd = (await (await fetch("https://coins.llama.fi/prices/current/coingecko:ethereum", { signal: AbortSignal.timeout(8_000) })).json())?.coins?.["coingecko:ethereum"]?.price;
    return typeof usd === "number" && usd > 0 ? usd : null;
  } catch { return null; }
}

/** USD price of a token we can price without an API: stablecoins, and WETH (or Arc's wrapped USDC). */
function knownPrice(chainId: number, token: string, symbol: string, eth: number | null): number | null {
  const t = token.toLowerCase();
  if (STABLES.has(symbol.toUpperCase()) || (chainId === 5042 && t === ARC_WUSDC.toLowerCase())) return 1;
  if (chainId === 4663 && t === ROBINHOOD_WETH.toLowerCase()) return eth;
  return null;
}

/** USD value of the V3-style positions the wallet holds on one chain; null when the chain could not be read. */
async function onChainUsd(client: PublicClient, chainId: number, wallet: `0x${string}`, eth: number | null): Promise<number | null> {
  const seen = new Set<string>();
  const deployments = DEXES.map((d) => v3DeploymentFor(d, chainId)).filter((d) => d && !seen.has(d.positionManager.toLowerCase()) && seen.add(d.positionManager.toLowerCase()));
  const reads = await Promise.allSettled(deployments.map((d) => fetchV3Positions(client, wallet, d!)));
  if (reads.every((r) => r.status === "rejected")) return null;
  let usd = 0;
  for (const r of reads) {
    if (r.status !== "fulfilled") continue;
    for (const p of r.value) {
      if (p.liquidity === 0n) continue;
      const a0 = Number(formatUnits(p.amount0, p.decimals0));
      const a1 = Number(formatUnits(p.amount1, p.decimals1));
      // Pool price of token0 in token1, in whole tokens.
      const sp = Number(p.sqrtPriceX96) / 2 ** 96;
      const price0In1 = sp * sp * 10 ** (p.decimals0 - p.decimals1);
      let p0 = knownPrice(chainId, p.token0, p.symbol0, eth);
      let p1 = knownPrice(chainId, p.token1, p.symbol1, eth);
      if (p0 == null && p1 != null) p0 = p1 * price0In1;
      if (p1 == null && p0 != null && price0In1 > 0) p1 = p0 / price0In1;
      if (p0 == null || p1 == null) continue;
      usd += a0 * p0 + a1 * p1;
      if (usd >= LP_MIN_USD) return usd;
    }
  }
  return usd;
}

/** Whether `wallet` has an open LP position worth at least $1. */
export async function lpGate(ctx: ActionCtx, walletAddress: string): Promise<LpGate> {
  const wallet = walletAddress.toLowerCase();
  const hit = await ctx.runQuery(internal.lpGate.cached, { wallet });
  if (hit) return hit;
  const done = async (ok: boolean, usd: number) => { await ctx.runMutation(internal.lpGate.save, { wallet, ok, usd }); return { ok, usd }; };

  if (await ctx.runQuery(internal.lpGate.hasLiveJob, { wallet })) return done(true, LP_MIN_USD);

  let usd = 0;
  let read = false;
  const k = await krystalUsd(wallet);
  if (k != null) { read = true; usd += k; if (usd >= LP_MIN_USD) return done(true, usd); }

  const eth = await ethUsd();
  for (const chainId of ONCHAIN_CHAINS) {
    const client = getChainClient(chainId);
    if (!client) continue;
    const c = await onChainUsd(client as PublicClient, chainId, wallet as `0x${string}`, eth).catch(() => null);
    if (c == null) continue;
    read = true;
    usd += c;
    if (usd >= LP_MIN_USD) return done(true, usd);
  }
  // Nothing could be read: our outage, not the wallet's fault. Let it through and do not cache the guess.
  if (!read) return { ok: true, usd: 0 };
  return done(false, usd);
}
