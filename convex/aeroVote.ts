import { internalAction, internalMutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { erc20Abi, type PublicClient } from "viem";
import { getChainClient } from "../src/lib/chainClient";
import {
  AERO, AERO_ROOT_CHAIN, GAUGE_FACTORY_ABI, GAUGE_STATES_ABI, POOL_ABI, POOL_FACTORY_ABI, votesNow, type AeroVotePool,
} from "../src/lib/aero";
import { loadLiveRpcs } from "./liveRpcs";

/**
 * Ranks the pools sAERO holders can vote for on Aero, once an hour, so the vote page reads one row instead of every
 * visitor scanning thousands of pools. For each pool with an activated gauge: its pair, swap fee, 24h volume
 * (DexScreener), the AERO already voted on it, and yearly fees per vote. A pool whose fees are high for the votes it
 * already has pays the most for one more vote. Nothing runs until Aero's Base addresses are set in src/lib/aero.ts.
 */

const KEEP = 400;
const VOTER_TOKEN_ABI = [{ type: "function", name: "TOKEN", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] }] as const;

async function chunks<T, R>(items: T[], size: number, fn: (part: T[]) => Promise<R[]>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) out.push(...await fn(items.slice(i, i + size)));
  return out;
}

/** 24h volume per pool from DexScreener, 30 pools a request. Missing pools read as 0. */
async function volumes(pools: string[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  await chunks(pools, 30, async (part) => {
    try {
      const res = await fetch(`https://api.dexscreener.com/latest/dex/pairs/base/${part.join(",")}`, { signal: AbortSignal.timeout(15_000) });
      const j = await res.json() as { pairs?: { pairAddress: string; volume?: { h24?: number } }[] };
      for (const p of j.pairs ?? []) out[p.pairAddress.toLowerCase()] = p.volume?.h24 ?? 0;
    } catch { /* that batch reads as no volume */ }
    return [];
  });
  return out;
}

export const refresh = internalAction({
  args: {},
  handler: async (ctx) => {
    await loadLiveRpcs(ctx);
    const d = AERO[AERO_ROOT_CHAIN];
    const client = getChainClient(AERO_ROOT_CHAIN) as PublicClient | null;
    if (!d || !client) return { skipped: "Aero addresses not set" };

    // Every pool: normal pools (volatile first, then stable) and concentrated pools.
    const kinds: { pool: `0x${string}`; kind: AeroVotePool["kind"]; feeFrom: `0x${string}` }[] = [];
    for (const [i, f] of d.poolFactories.entries()) {
      const list = await client.readContract({ address: f, abi: POOL_FACTORY_ABI, functionName: "allPools" });
      for (const pool of list) kinds.push({ pool, kind: i === 0 ? "volatile" : "stable", feeFrom: f });
    }
    const clCount = Number(await client.readContract({ address: d.clFactory, abi: POOL_FACTORY_ABI, functionName: "allPoolsLength" }));
    const clPools = await chunks(Array.from({ length: clCount }, (_, i) => BigInt(i)), 500, (part) =>
      client.multicall({ contracts: part.map((i) => ({ address: d.clFactory, abi: POOL_FACTORY_ABI, functionName: "allPools" as const, args: [i] as const })), allowFailure: false }));
    for (const pool of clPools) kinds.push({ pool: pool as `0x${string}`, kind: "cl", feeFrom: pool as `0x${string}` });

    // Gauge per pool, and its state on the leaf voter; keep activated gauges only.
    const gauges = await chunks(kinds, 300, (part) => client.multicall({ allowFailure: true, contracts: part.map((k) => ({
      address: k.kind === "cl" ? d.clGaugeFactory : d.gaugeFactory, abi: GAUGE_FACTORY_ABI, functionName: "computeGaugeAddress" as const, args: [k.pool] as const,
    })) }));
    const withGauge = kinds.map((k, i) => ({ ...k, gauge: gauges[i].status === "success" ? gauges[i].result as `0x${string}` : null })).filter((k) => k.gauge);
    const states = await chunks(withGauge, 300, (part) => client.multicall({ allowFailure: true, contracts: part.map((k) => ({
      address: d.leafVoter, abi: GAUGE_STATES_ABI, functionName: "gaugeStates" as const, args: [k.gauge!] as const,
    })) }));
    const now = Math.floor(Date.now() / 1000);
    const live = withGauge.map((k, i) => {
      const s = states[i];
      if (s.status !== "success" || !s.result[4]) return null;
      const p = s.result[8];
      return { ...k, votesWei: votesNow({ bias: p.bias, slope: p.slope, ts: Number(p.ts), permanentStakeBalance: p.permanentStakeBalance }, now) };
    }).filter((x): x is NonNullable<typeof x> => !!x);
    if (live.length === 0) return { pools: 0 };

    // Pair names, fees, volume, AERO price.
    const tokens = await chunks(live, 300, (part) => client.multicall({ allowFailure: true, contracts: part.flatMap((k) => [
      { address: k.pool, abi: POOL_ABI, functionName: "token0" as const }, { address: k.pool, abi: POOL_ABI, functionName: "token1" as const },
    ]) }));
    const tokenAddrs = [...new Set(tokens.filter((t) => t.status === "success").map((t) => (t.result as string).toLowerCase()))] as `0x${string}`[];
    const symbols = await chunks(tokenAddrs, 300, (part) => client.multicall({ allowFailure: true, contracts: part.map((t) => ({ address: t, abi: erc20Abi, functionName: "symbol" as const })) }));
    const sym = Object.fromEntries(tokenAddrs.map((t, i) => [t, symbols[i].status === "success" ? String(symbols[i].result) : "?"]));
    const clFees = await chunks(live.filter((k) => k.kind === "cl"), 300, (part) => client.multicall({ allowFailure: true, contracts: part.map((k) => ({ address: k.pool, abi: POOL_ABI, functionName: "fee" as const })) }));
    const clFee = Object.fromEntries(live.filter((k) => k.kind === "cl").map((k, i) => [k.pool.toLowerCase(), clFees[i].status === "success" ? Number(clFees[i].result) / 1_000_000 : 0]));
    const factoryFee: Record<string, number> = {};
    for (const f of d.poolFactories) {
      // Normal pools: the factory default in basis points.
      factoryFee[f.toLowerCase()] = Number(await client.readContract({ address: f, abi: POOL_FACTORY_ABI, functionName: "defaultFee" }).catch(() => 0n)) / 10_000;
    }
    const vol = await volumes(live.map((k) => k.pool.toLowerCase()));
    const aero = await client.readContract({ address: d.voter, abi: VOTER_TOKEN_ABI, functionName: "TOKEN" });
    const priced = await fetch(`https://coins.llama.fi/prices/current/base:${aero}`).then((r) => r.json()).catch(() => null) as { coins?: Record<string, { price?: number }> } | null;
    const aeroUsd = Object.values(priced?.coins ?? {})[0]?.price ?? 0;

    const pools: AeroVotePool[] = live.map((k, i) => {
      const t0 = tokens[i * 2], t1 = tokens[i * 2 + 1];
      const pair = `${t0.status === "success" ? sym[(t0.result as string).toLowerCase()] : "?"} / ${t1.status === "success" ? sym[(t1.result as string).toLowerCase()] : "?"}`;
      const fee = k.kind === "cl" ? clFee[k.pool.toLowerCase()] ?? 0 : factoryFee[k.feeFrom.toLowerCase()] ?? 0;
      const volume24hUsd = vol[k.pool.toLowerCase()] ?? 0;
      const fees24hUsd = volume24hUsd * fee;
      const votes = Number(k.votesWei / 10n ** 14n) / 10_000;
      const aprPerVote = votes > 0 && aeroUsd > 0 ? (fees24hUsd * 365) / (votes * aeroUsd) * 100 : null;
      return { pool: k.pool, gauge: k.gauge!, pair, kind: k.kind, fee, volume24hUsd, fees24hUsd, votes, aprPerVote };
    })
      // Best return per vote first; gauges with fees but no votes yet lead, then by fees.
      .sort((a, b) => (b.aprPerVote ?? (b.fees24hUsd > 0 ? Infinity : -1)) - (a.aprPerVote ?? (a.fees24hUsd > 0 ? Infinity : -1)) || b.fees24hUsd - a.fees24hUsd)
      .slice(0, KEEP);
    await ctx.runMutation(internal.aeroVote.save, { chainId: AERO_ROOT_CHAIN, pools: JSON.stringify(pools), aeroUsd });
    return { pools: pools.length };
  },
});

export const save = internalMutation({
  args: { chainId: v.float64(), pools: v.string(), aeroUsd: v.float64() },
  handler: async (ctx, a) => {
    const row = await ctx.db.query("aeroVotePools").withIndex("by_chain", (q) => q.eq("chainId", a.chainId)).unique();
    const doc = { ...a, updatedAt: Date.now() };
    if (row) await ctx.db.replace(row._id, doc); else await ctx.db.insert("aeroVotePools", doc);
  },
});

/** The ranked pools for the vote page. Public: nothing here is private. */
export const list = query({
  args: { chainId: v.float64() },
  handler: async (ctx, { chainId }) => {
    const row = await ctx.db.query("aeroVotePools").withIndex("by_chain", (q) => q.eq("chainId", chainId)).unique();
    return row ? { pools: JSON.parse(row.pools) as AeroVotePool[], aeroUsd: row.aeroUsd, updatedAt: row.updatedAt } : null;
  },
});
