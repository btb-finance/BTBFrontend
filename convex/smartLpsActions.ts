"use node";

/**
 * Daily job: find each busy pool's positions and rank the ones that stayed in
 * range and beat holding (src/lib/smartLps.ts has the method).
 *
 * Per chain, from a saved block cursor: discover positions one day of blocks
 * at a time, snapshot each new one at the end of the day it was found (a past
 * block where the chain's RPCs keep history, otherwise today), then measure
 * every tracked position against its snapshot. A first run reaches back
 * BACKFILL_DAYS; a run that hits its time budget saves the cursor and
 * schedules the rest.
 */
import { internalAction, type ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { PublicClient } from "viem";
import { gzipSync, gunzipSync, strToU8, strFromU8 } from "fflate";
import { getChainClient } from "../src/lib/chainClient";
import { CHAIN_DATA_NETWORKS } from "../src/lib/chainDataNetworks";
import { DISCOVERY_CHAINS, type EarnPool } from "../src/lib/pools";
import { readPoolsNow, readGlobals, readInside, type PoolNow } from "../src/lib/rangeYield";
import {
  discoverPositions, readPositions, snapshot, measurePosition, poolUsd, rankPool, tooSmall, usesBlockscout,
  type Tracked, type SmartLp, type PoolSmartLps,
} from "../src/lib/smartLps";
import { atBlock, blockDaysBack } from "./rangeYieldActions";
import { loadLiveRpcs } from "./liveRpcs";
import { loadDiscover } from "./discoverStore";

const POOLS_PER_CHAIN = 20;
/** How far a chain's first run looks back: further where Blockscout reads any range in one call. */
const BACKFILL_DAYS_BLOCKSCOUT = 30;
const BACKFILL_DAYS_RPC = 7;
/** BNB's log RPCs keep about 5 days: a start further back would fail every pass and never move. */
const BACKFILL_DAYS_CHAIN: Record<number, number> = { 56: 4 };
/** Stop discovering and save well inside the 10 minute action limit. */
const TIME_BUDGET_MS = 4 * 60_000;

export type SmartState = { cursor?: number; tracked: Record<string, Tracked> };
const keyOf = (t: { npm: string; id: string }) => `${t.npm}:${t.id}`;
const chainIdOf = (p: EarnPool) => p.chainId ?? DISCOVERY_CHAINS.find((c) => c.chain === p.chain)?.chainId;

/** The busiest V3-style pools on a chain (contract pools on DEXes whose positions are NFTs). */
function poolsFor(all: EarnPool[], chainId: number): string[] {
  const seen = new Set<string>();
  return all
    .filter((p) => chainIdOf(p) === chainId && p.liquidityModel === "CLMM" && /^0x[0-9a-f]{40}$/i.test(p.id))
    .filter((p) => !/metric|algebra|fluid|balancer|thena|hydrex|integral|alandale/i.test(p.project))
    .sort((a, b) => (b.volume24hUsd ?? 0) - (a.volume24hUsd ?? 0))
    .map((p) => p.id.toLowerCase())
    .filter((id) => !seen.has(id) && !!seen.add(id))
    .slice(0, POOLS_PER_CHAIN);
}

/**
 * One run on one chain, kept apart from storage so it can run anywhere.
 * Mutates `state`; returns the ranking per pool and whether discovery caught up.
 */
export async function runChain(
  client: PublicClient, chainId: number, apiKey: string | undefined, pools: string[], state: SmartState, started = Date.now(),
): Promise<{ results: Record<string, PoolSmartLps>; caughtUp: boolean; found: number; tracked: number }> {
  const head = await client.getBlock();
  const headNo = Number(head.number);
  const ref = await client.getBlock({ blockNumber: head.number - 10_000n });
  const perDay = Math.max(1, Math.round((10_000 / Number(head.timestamp - ref.timestamp)) * 86_400));
  if (state.cursor == null) {
    const days = BACKFILL_DAYS_CHAIN[chainId] ?? (usesBlockscout(chainId, apiKey) ? BACKFILL_DAYS_BLOCKSCOUT : BACKFILL_DAYS_RPC);
    // The timestamp search needs old blocks, which flaky RPCs (BNB) sometimes fail to serve: estimate from the
    // recent block rate then, rather than start at the tip and scan nothing.
    const back = await blockDaysBack(client, head, days).catch(() => null);
    state.cursor = back ? Number(back.number) : Math.max(0, headNo - days * perDay);
  }

  // ── Discover, one day of blocks per step ──────────────────────────────────
  // RPC chains read in block chunks, so a day of Base or BNB blocks is slow: step a quarter day at a time
  // so the time budget is checked often enough to save before the 10 minute limit.
  const step = usesBlockscout(chainId, apiKey) ? perDay : Math.max(1, Math.round(perDay / 4));
  let found = 0;
  let caughtUp = true;
  // RPC chains stay a day behind the tip, so every step has a day of Burns to drop short-lived bot positions.
  const rpc = !usesBlockscout(chainId, apiKey);
  const scanTo = rpc ? headNo - perDay : headNo;
  while (state.cursor < scanTo) {
    if (Date.now() - started > TIME_BUDGET_MS) { caughtUp = false; break; }
    const from = state.cursor + 1;
    const to = Math.min(scanTo, from + step - 1);
    // A step whose logs cannot be read stops discovery here with progress kept;
    // the next daily run starts again from this block.
    let discovered: Awaited<ReturnType<typeof discoverPositions>>;
    try {
      discovered = await discoverPositions(chainId, client, apiKey, pools, from, to, rpc ? Math.min(headNo, to + perDay) : undefined);
    } catch (e) {
      console.warn(`smart lps ${chainId}: logs ${from}..${to} failed`, e instanceof Error ? e.message.slice(0, 200) : e);
      break;
    }
    const fresh = discovered.filter((p) => !state.tracked[keyOf(p)]);
    const stepStarted = Date.now();
    if (fresh.length > 0) {
      // Snapshot at the end of this day of blocks where the chain keeps history.
      // Anything that read fails for (no history, a flaky RPC) is snapshotted
      // today instead: the cursor moves on, so a position dropped here is lost.
      const historic = to < headNo;
      const past = historic ? atBlock(client, BigInt(to)) : client;
      // A past block's timestamp, or an estimate from the block rate when a flaky RPC (BNB) cannot serve it.
      const estimate = (Number(head.timestamp) - (headNo - to) / (perDay / 86_400)) * 1000;
      const atMs = historic ? await client.getBlock({ blockNumber: BigInt(to) }).then((b) => Number(b.timestamp) * 1000).catch(() => estimate) : Date.now();
      const pastReads = historic ? await readPositions(past, fresh).catch(() => fresh.map(() => null)) : fresh.map(() => null);
      const pastItems = fresh.flatMap((p, i) => { const r = pastReads[i]; return r && r.L > 0n ? [{ ...p, ...r }] : []; });
      const pastSnaps = pastItems.length > 0 ? await snapshot(past, pastItems, atMs).catch(() => pastItems.map(() => null)) : [];
      const done = new Set<string>();
      for (const s of pastSnaps) if (s) { state.tracked[keyOf(s)] = s; done.add(keyOf(s)); found++; }
      const retry = fresh.filter((p) => !done.has(keyOf(p)));
      if (retry.length > 0) {
        const nowReads = await readPositions(client, retry).catch(() => retry.map(() => null));
        const nowItems = retry.flatMap((p, i) => { const r = nowReads[i]; return r && r.L > 0n ? [{ ...p, ...r }] : []; });
        const nowSnaps = nowItems.length > 0 ? await snapshot(client, nowItems, Date.now()).catch(() => nowItems.map(() => null)) : [];
        for (const s of nowSnaps) if (s) { state.tracked[keyOf(s)] = s; found++; }
      }
    }
    state.cursor = to;
    if (process.env.SMART_LPS_DEBUG) console.log(`step ${from}..${to}: ${discovered.length} positions, ${fresh.length} new, snapshot ${Math.round((Date.now() - stepStarted) / 1000)}s, total ${Math.round((Date.now() - started) / 1000)}s`);
  }

  // ── Today: drop closed positions, restart changed ones, measure the rest ──
  const list = Object.values(state.tracked);
  const reads = await readPositions(client, list);
  const restart: Parameters<typeof snapshot>[1] = [];
  list.forEach((t, i) => {
    const r = reads[i];
    if (!r) return;
    if (r.L === 0n) { delete state.tracked[keyOf(t)]; return; }
    if (r.L.toString() !== t.L) restart.push({ ...t, tl: r.tl, tu: r.tu, L: r.L, owner: r.owner });
    else if (r.owner && r.owner !== t.owner) t.owner = r.owner;
  });
  for (const s of await snapshot(client, restart, Date.now())) if (s) state.tracked[keyOf(s)] = s;

  const tracked = Object.values(state.tracked);
  const poolIds = [...new Set(tracked.map((t) => t.pool))];
  const nowArr = await readPoolsNow(client, poolIds.map((id) => ({ id })));
  const now = new Map<string, PoolNow | null>(poolIds.map((id, i) => [id, nowArr[i]]));
  const globals = await readGlobals(client, poolIds.map((id) => ({ id })));
  const live = tracked.filter((t) => now.get(t.pool));
  const inside = await readInside(client, live.map((t) => ({ pool: { id: t.pool }, now: now.get(t.pool)!, lo: t.tl, hi: t.tu })), globals);
  const llama = CHAIN_DATA_NETWORKS[chainId]?.llama;
  const usd = llama ? await poolUsd(client, llama, poolIds, now).catch(() => new Map<string, { usdPerRaw1: number }>()) : new Map<string, { usdPerRaw1: number }>();

  const at = Date.now();
  const byPool = new Map<string, SmartLp[]>();
  const countByPool = new Map<string, number>();
  live.forEach((t, j) => {
    countByPool.set(t.pool, (countByPool.get(t.pool) ?? 0) + 1);
    const usdPerRaw1 = usd.get(t.pool)?.usdPerRaw1;
    if (tooSmall(t, usdPerRaw1)) { delete state.tracked[keyOf(t)]; return; }
    const r = inside[j];
    if (!r) return;
    const m = measurePosition(t, now.get(t.pool)!, r, at, usdPerRaw1);
    if (m) byPool.set(t.pool, [...(byPool.get(t.pool) ?? []), m]);
  });
  const results: Record<string, PoolSmartLps> = {};
  for (const pool of new Set([...countByPool.keys(), ...byPool.keys()])) {
    const ranked = rankPool(byPool.get(pool) ?? []);
    const round = (n: number, d = 1) => Number(n.toFixed(d));
    results[pool] = {
      tracked: countByPool.get(pool) ?? 0,
      measured: ranked.measured,
      smart: ranked.smart,
      top: ranked.top.map((x) => ({
        ...x, lowPct: round(x.lowPct, 2), highPct: round(x.highPct, 2), days: round(x.days), feeApr: round(x.feeApr), netPct: round(x.netPct, 2), netApr: round(x.netApr),
        ...(x.inRangePct != null ? { inRangePct: Math.round(x.inRangePct) } : {}), ...(x.valueUsd != null ? { valueUsd: Math.round(x.valueUsd) } : {}),
      })),
    };
  }
  return { results, caughtUp, found, tracked: Object.keys(state.tracked).length };
}

async function loadState(ctx: ActionCtx, chainId: number): Promise<SmartState> {
  const row = await ctx.runQuery(internal.smartLps.getChain, { chainId });
  if (!row) return { tracked: {} };
  const blob = await ctx.storage.get(row.stateFile);
  return blob ? JSON.parse(strFromU8(gunzipSync(new Uint8Array(await blob.arrayBuffer())))) as SmartState : { tracked: {} };
}

export const refreshChain = internalAction({
  args: { chainId: v.float64() },
  handler: async (ctx, { chainId }) => {
    const started = Date.now();
    await loadLiveRpcs(ctx);
    const client = getChainClient(chainId);
    const snap = await loadDiscover(ctx);
    if (!client || !snap) return;
    const pools = poolsFor(snap.pools, chainId);
    if (pools.length === 0) return;
    const state = await loadState(ctx, chainId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { results, caughtUp, found, tracked } = await runChain(client as any, chainId, process.env.BLOCKSCOUT_API_KEY, pools, state, started);
    const bytes = gzipSync(strToU8(JSON.stringify(state)), { level: 9 });
    const stateFile = await ctx.storage.store(new Blob([bytes as BlobPart], { type: "application/gzip" }));
    await ctx.runMutation(internal.smartLps.saveChain, { chainId, stateFile, results: JSON.stringify(results) });
    const smart = Object.values(results).reduce((n, r) => n + r.smart, 0);
    console.log(`smart lps ${chainId}: ${pools.length} pools, ${found} new, ${tracked} tracked, ${smart} smart, ${caughtUp ? "caught up" : "more to scan"}, ${Math.round((Date.now() - started) / 1000)}s`);
    // A first backfill longer than one action continues right away.
    if (!caughtUp) await ctx.scheduler.runAfter(0, internal.smartLpsActions.refreshChain, { chainId });
  },
});

/** Daily entry point: one staggered action per chain with V3-style pools. */
export const refresh = internalAction({
  args: {},
  handler: async (ctx) => {
    const snap = await loadDiscover(ctx);
    if (!snap) return;
    const chains = [...new Set(snap.pools.map(chainIdOf).filter((c): c is number => c != null && !!getChainClient(c)))];
    for (let i = 0; i < chains.length; i++) {
      await ctx.scheduler.runAfter(i * 30_000, internal.smartLpsActions.refreshChain, { chainId: chains[i] });
    }
  },
});
