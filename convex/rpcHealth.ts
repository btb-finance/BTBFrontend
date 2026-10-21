import { internalAction, internalMutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { CHAIN_RPC_URLS } from "../src/lib/chainRpc";
import { ROBINHOOD_RPC_UPSTREAMS } from "../src/lib/robinhoodRpc";

/**
 * Keeps a tested, ranked list of public RPCs for every chain the app and the agent use, so a dead or rate-limited
 * endpoint drops out on its own instead of waiting for someone to edit a hardcoded list. Every few hours each chain's
 * candidates (chainlist.org's list plus our own) are tested: right chain id, batched JSON-RPC, a working eth_call, a
 * block height that keeps up with the best endpoint, speed, reads about 5,000 blocks back, the largest log range it
 * accepts, and whether a web page may call it. The ones that pass are saved fastest first.
 */

const CHAINLIST = "https://chainlist.org/rpcs.json";
const TIMEOUT_MS = 6_000;
const KEEP = 12;
const MULTICALL3 = "0xcA11bde05977b3631167028862bE2a173976CA11";
const ORIGIN = "https://btb.finance";

/** Every chain with a hardcoded list, plus Robinhood Chain (its own pool) and Sonic (read with no list of its own). */
const CHAINS = [...new Set([...Object.keys(CHAIN_RPC_URLS).map(Number), 4663, 146])];
const OURS: Record<number, readonly string[]> = { ...CHAIN_RPC_URLS, 4663: ROBINHOOD_RPC_UPSTREAMS };

type Endpoint = { url: string; latencyMs: number; archive: boolean; logRange: number; cors: boolean; tracking: string };

async function rpc(url: string, body: unknown, origin?: string): Promise<{ json: any; ms: number; cors: boolean } | null> {
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...(origin ? { origin } : {}) },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const allow = res.headers.get("access-control-allow-origin");
    return { json, ms: Date.now() - t0, cors: allow === "*" || allow === origin };
  } catch { return null; }
}

const call = (method: string, params: unknown[] = [], id = 1) => ({ jsonrpc: "2.0", id, method, params });
const hex = (n: number) => "0x" + n.toString(16);
const okResult = (r: { json: any } | null) => !!r && r.json && !Array.isArray(r.json) && r.json.result !== undefined && !r.json.error;

/** One endpoint's checks. Null when it fails any of the basics (chain id, batching, height, eth_call). */
async function probe(url: string, chainId: number, tracking: string): Promise<(Endpoint & { height: number }) | null> {
  // Batched: the app's transports send reads as JSON-RPC batches, so an endpoint that cannot answer one is no use.
  const first = await rpc(url, [call("eth_chainId", [], 1), call("eth_blockNumber", [], 2)], ORIGIN);
  if (!first || !Array.isArray(first.json)) return null;
  const byId = Object.fromEntries(first.json.map((r: any) => [r.id, r.result]));
  if (Number(byId[1]) !== chainId || !byId[2]) return null;
  const height = Number(byId[2]);
  const ethCall = await rpc(url, call("eth_call", [{ to: MULTICALL3, data: "0x42cbb15c" }, "latest"]));
  if (!okResult(ethCall)) return null;
  const second = await rpc(url, call("eth_blockNumber"));
  if (!okResult(second)) return null;
  const archive = okResult(await rpc(url, call("eth_getBalance", ["0x000000000000000000000000000000000000dEaD", hex(Math.max(0, height - 5_000))])));
  let logRange = 0;
  for (const range of [10_000, 2_000, 500]) {
    const r = await rpc(url, call("eth_getLogs", [{ address: "0x000000000000000000000000000000000000dEaD", fromBlock: hex(height - range + 1), toBlock: hex(height) }]));
    if (okResult(r)) { logRange = range; break; }
  }
  return { url, height, latencyMs: Math.round((first.ms + ethCall!.ms + second!.ms) / 3), archive, logRange, cors: first.cors, tracking };
}

/** Run `fn` over `items`, `limit` at a time. */
async function pool<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const item = items[i++]; out.push(await fn(item)); }
  }));
  return out;
}

/** Test one chain's candidates and save the ones that pass. */
export const refreshChain = internalAction({
  args: { chainId: v.float64(), candidates: v.array(v.object({ url: v.string(), tracking: v.string() })) },
  handler: async (ctx, { chainId, candidates }) => {
    const results = (await pool(candidates, 12, (c) => probe(c.url, chainId, c.tracking))).filter((r): r is NonNullable<typeof r> => !!r);
    if (results.length === 0) return { chainId, kept: 0 };
    // Keeping up: within about 30 seconds of the highest block any endpoint reported. Block time is read from the
    // freshest endpoint; a chain that cannot be timed allows 20 blocks.
    const best = results.reduce((a, b) => (b.height > a.height ? b : a));
    let lag = 20;
    const blocks = await rpc(best.url, [call("eth_getBlockByNumber", [hex(best.height), false], 1), call("eth_getBlockByNumber", [hex(Math.max(0, best.height - 1_000)), false], 2)]);
    if (blocks && Array.isArray(blocks.json)) {
      const t = Object.fromEntries(blocks.json.map((r: any) => [r.id, Number(r.result?.timestamp ?? 0)]));
      const perBlock = (t[1] - t[2]) / 1_000;
      if (perBlock > 0) lag = Math.max(5, Math.ceil(30 / perBlock));
    }
    const kept: Endpoint[] = results
      .filter((r) => r.height >= best.height - lag)
      .sort((a, b) => a.latencyMs - b.latencyMs)
      .slice(0, KEEP)
      .map(({ height: _h, ...e }) => e);
    await ctx.runMutation(internal.rpcHealth.save, { chainId, endpoints: kept, tested: candidates.length });
    return { chainId, kept: kept.length };
  },
});

/** Read chainlist once, then test each chain in its own run, spread out so no single run is large. */
export const refreshAll = internalAction({
  args: {},
  handler: async (ctx) => {
    let list: { chainId: number; rpc: (string | { url: string; tracking?: string })[] }[] = [];
    try { list = await (await fetch(CHAINLIST, { signal: AbortSignal.timeout(60_000) })).json(); } catch { /* our own lists still get tested */ }
    const byChain = new Map(list.map((c) => [c.chainId, c.rpc]));
    await Promise.all(CHAINS.map((chainId, i) => {
      const seen = new Map<string, string>();
      for (const r of byChain.get(chainId) ?? []) {
        const url = typeof r === "string" ? r : r.url;
        if (url.startsWith("https://") && !url.includes("${")) seen.set(url.replace(/\/$/, ""), typeof r === "string" ? "unknown" : (r.tracking ?? "unknown"));
      }
      for (const url of OURS[chainId] ?? []) { const u = url.replace(/\/$/, ""); if (!seen.has(u)) seen.set(u, "unknown"); }
      const candidates = [...seen].map(([url, tracking]) => ({ url, tracking }));
      return ctx.scheduler.runAfter(i * 20_000, internal.rpcHealth.refreshChain, { chainId, candidates });
    }));
  },
});

export const save = internalMutation({
  args: {
    chainId: v.float64(), tested: v.float64(),
    endpoints: v.array(v.object({ url: v.string(), latencyMs: v.float64(), archive: v.boolean(), logRange: v.float64(), cors: v.boolean(), tracking: v.string() })),
  },
  handler: async (ctx, a) => {
    const row = await ctx.db.query("rpcEndpoints").withIndex("by_chain", (q) => q.eq("chainId", a.chainId)).unique();
    const doc = { chainId: a.chainId, endpoints: a.endpoints, tested: a.tested, checkedAt: Date.now() };
    if (row) await ctx.db.replace(row._id, doc); else await ctx.db.insert("rpcEndpoints", doc);
  },
});

/** Every chain's tested list. Public: the page loads it to pick its RPCs; nothing here is private. */
export const list = query({
  args: {},
  handler: async (ctx) => (await ctx.db.query("rpcEndpoints").collect()).map((r) => ({ chainId: r.chainId, endpoints: r.endpoints, checkedAt: r.checkedAt })),
});
