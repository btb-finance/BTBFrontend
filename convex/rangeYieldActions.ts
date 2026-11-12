"use node";

/**
 * Daily job: measure what a ±5% position really earned on every concentrated
 * pool Discover lists (the method is in src/lib/rangeYield.ts).
 *
 * Each run, per pool: measure yesterday's ±5% band and close it, then open a
 * new one around today's price. The headline is the last 7 such days: what a
 * ±5% range reset once a day earned, which is how a rebalanced position runs.
 * (One band held for the whole week mostly measures which way the price went:
 * USDC/WETH was in range 4% of one such week.) The net figure adds the price
 * loss each daily reset locks in, against just holding.
 *
 * A chain's first run also fills in the past week from historical blocks,
 * where its RPCs keep history, so a full week shows at once.
 *
 * Node runtime: Ethereum's bands plus the Discover snapshot outgrew the
 * default runtime's 64 MB on the first seed.
 *
 * One action per chain, staggered, then the Discover snapshot is re-saved so
 * saveDiscover copies the new figures onto its rows.
 */
import { internalAction, type ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { PublicClient } from "viem";
import { gzipSync, gunzipSync, strToU8, strFromU8 } from "fflate";
import { getChainClient } from "../src/lib/chainClient";
import { v4DeploymentFor } from "../src/protocols/lpChains";
import { DISCOVERY_CHAINS, type EarnPool } from "../src/lib/pools";
import {
  readPoolsNow, findV4Spacing, pickBands, readGlobals, readInside, measure,
  type Band, type YieldPool, type PoolNow,
} from "../src/lib/rangeYield";
import { loadLiveRpcs } from "./liveRpcs";
import { loadDiscover, saveDiscover } from "./discoverStore";
import type { YieldEntry } from "./rangeYield";

const DAY = 86_400_000;
/** Daily results inside this window make up the headline figure. */
const WINDOW = 7.4 * DAY;
/** A band is measured and closed, and a new one opened, once it is this old. */
const MIN_BAND_AGE = 0.9 * DAY;
/** An open band that could not be read for this long is given up. */
const MAX_OPEN_AGE = 3 * DAY;
/** A measurement that could not be refreshed is shown for this long. */
const KEEP_YIELD = 3 * DAY;
const MAX_POOLS_PER_CHAIN = 1500;
/** A chain's first run also opens bands this many days back, then each day after. */
const SEED_FROM_DAYS = 7;

/** One day of a ±5% band: fee APR %, net % vs holding, in-range %, scaled. */
type DayResult = { t: number; d: number; a: number; n: number; i?: number; x?: 1 };
/** Per pool: tick spacing, the open band(s), and the daily results of the last week. */
type PoolBands = { s?: number; b: Band[]; r?: DayResult[] };
export type BandsFile = Record<string, PoolBands>;

const chainIdOf = (p: EarnPool) => p.chainId ?? DISCOVERY_CHAINS.find((c) => c.chain === p.chain)?.chainId;

/** Concentrated pools on this chain the reader can address, busiest first, one row per pool. */
function poolsFor(all: EarnPool[], chainId: number): YieldPool[] {
  const dep = v4DeploymentFor(chainId);
  const seen = new Set<string>();
  const rows = all
    .filter((p) => chainIdOf(p) === chainId && p.liquidityModel === "CLMM" && p.project !== "metric")
    .filter((p) => /^0x[0-9a-f]{40}$/i.test(p.id) || (/^0x[0-9a-f]{64}$/i.test(p.id) && /uniswap/i.test(p.project) && !!dep))
    .sort((a, b) => (b.volume24hUsd ?? 0) - (a.volume24hUsd ?? 0));
  const out: YieldPool[] = [];
  for (const p of rows) {
    const id = p.id.toLowerCase();
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      feeTier: p.feeTier,
      ...(id.length === 66 ? { v4: { stateView: dep!.stateView as `0x${string}`, positionManager: dep!.positionManager as `0x${string}` } } : {}),
    });
    if (out.length >= MAX_POOLS_PER_CHAIN) break;
  }
  return out;
}

/** Open a band on each pool, reading through `client` (today, or a past block). */
async function openBands(client: PublicClient, pools: YieldPool[], now: (PoolNow | null)[], at: number): Promise<(Band | null)[]> {
  const picks = await pickBands(client, pools, now);
  const globals = await readGlobals(client, pools);
  const idx = pools.map((_, i) => i).filter((i) => now[i] && picks[i]);
  const inside = await readInside(client, idx.map((i) => ({ pool: pools[i], now: now[i]!, ...picks[i]! })), globals);
  const out: (Band | null)[] = pools.map(() => null);
  idx.forEach((i, j) => {
    const r = inside[j];
    if (!r || !r.ok) return;
    out[i] = { t: at, lo: picks[i]!.lo, hi: picks[i]!.hi, f0: r.f0.toString(), f1: r.f1.toString(), sp: now[i]!.sqrtP, ...(r.s != null ? { s: r.s } : {}) };
  });
  return out;
}

/** A client that reads state as of `blockNumber`. Only readContract is used by the reader. */
function atBlock(client: PublicClient, blockNumber: bigint): PublicClient {
  return { readContract: (a: Parameters<PublicClient["readContract"]>[0]) => client.readContract({ ...a, blockNumber }) } as unknown as PublicClient;
}

const round = (n: number, d: number) => Number(n.toFixed(d));

/**
 * Measure and close each pool's oldest open band that is at least `minAge`
 * old, reading through `client` at time `at`; the result joins the pool's
 * daily results. A band whose reads failed outright stays for the next try.
 */
async function closeBands(client: PublicClient, pools: YieldPool[], now: (PoolNow | null)[], state: BandsFile, at: number, minAge: number): Promise<number> {
  const toRead: { i: number; band: Band }[] = [];
  pools.forEach((p, i) => {
    const band = [...(state[p.id]?.b ?? [])].sort((x, y) => x.t - y.t).find((x) => at - x.t >= minAge);
    if (band && now[i]) toRead.push({ i, band });
  });
  if (toRead.length === 0) return 0;
  const globals = await readGlobals(client, toRead.map(({ i }) => pools[i]));
  const inside = await readInside(client, toRead.map(({ i, band }) => ({ pool: pools[i], now: now[i]!, lo: band.lo, hi: band.hi })), globals);
  let closed = 0;
  toRead.forEach(({ i, band }, j) => {
    const entry = state[pools[i].id];
    const r = inside[j];
    if (!r) return;
    entry.b = entry.b.filter((x) => x !== band);
    const m = measure(band, now[i]!, r, at);
    if (!m) return;
    const day: DayResult = { t: at, d: round(m.days, 3), a: round(m.feeApr, 2), n: round(m.netPct, 3) };
    if (m.inRangePct != null) day.i = Math.round(m.inRangePct);
    if (m.scaled) day.x = 1;
    entry.r = [...(entry.r ?? []).filter((x) => x.t !== at), day];
    closed++;
  });
  return closed;
}

/**
 * The block about `daysBack` days before `head`. Starts from the recent block
 * rate, then corrects against real timestamps: block times change (Base got
 * faster mid-week), and a fixed rate put "7 days back" at 10.
 */
async function blockDaysBack(client: PublicClient, head: { number: bigint; timestamp: bigint }, daysBack: number) {
  const target = Number(head.timestamp) - 86_400 * daysBack;
  const ref = await client.getBlock({ blockNumber: head.number - 10_000n });
  let perSec = 10_000 / Number(head.timestamp - ref.timestamp);
  let guess = head.number - BigInt(Math.round(perSec * 86_400 * daysBack));
  for (let step = 0; step < 4; step++) {
    if (guess <= 0n) return null;
    const block = await client.getBlock({ blockNumber: guess }).catch(() => null);
    if (!block) return null;
    const off = Number(block.timestamp) - target;
    if (Math.abs(off) < 900) return block;
    // Rate over the span just measured, then step by the time still off.
    perSec = Number(head.number - guess) / Math.max(1, Number(head.timestamp - block.timestamp));
    guess -= BigInt(Math.round(off * perSec));
  }
  return client.getBlock({ blockNumber: guess }).catch(() => null);
}

/**
 * One past day for a chain's first week: open a band as of `daysBack` days
 * ago and measure it a day later (today for the last one). Returns the days
 * measured, or null when the chain's RPCs keep no history that far.
 */
export async function seedDay(client: PublicClient, pools: YieldPool[], state: BandsFile, daysBack: number): Promise<number | null> {
  const head = await client.getBlock();
  const open = await blockDaysBack(client, head, daysBack);
  const close = daysBack > 1 ? await blockDaysBack(client, head, daysBack - 1) : head;
  if (!open || !close) return null;
  const known = pools.map((p) => ({ ...p, tickSpacing: state[p.id]?.s }));
  const past = atBlock(client, open.number);
  const then = await readPoolsNow(past, known).catch(() => null);
  if (!then || then.filter(Boolean).length < pools.length * 0.3) return null;
  await findV4Spacing(past, known, then);
  // An RPC that ignores the block number answers with today's counters,
  // which would read as zero fees. Busy pools always move their global
  // counters within a day, so mostly unchanged counters mean no history.
  const [pastGlobals, todayGlobals] = await Promise.all([readGlobals(past, known), readGlobals(client, known)]);
  let same = 0, compared = 0;
  for (const [id, g] of pastGlobals) {
    const t = todayGlobals.get(id);
    if (!t) continue;
    compared++;
    if (t[0] === g[0] && t[1] === g[1]) same++;
  }
  if (compared > 0 && same / compared > 0.5) return null;
  const bands = await openBands(past, known, then, Number(open.timestamp) * 1000);
  bands.forEach((band, i) => {
    if (!band) return;
    const id = known[i].id;
    state[id] = { ...(state[id] ?? { b: [] }), s: state[id]?.s ?? then[i]?.tickSpacing, b: [...(state[id]?.b ?? []), band] };
  });
  const closeClient = daysBack > 1 ? atBlock(client, close.number) : client;
  const closeNow = await readPoolsNow(closeClient, known.map((p, i) => ({ ...p, tickSpacing: then[i]?.tickSpacing || p.tickSpacing })));
  return closeBands(closeClient, known, closeNow, state, Number(close.timestamp) * 1000, 0.5 * DAY);
}

/** A pool's figure from its daily results: days-weighted fee APR, summed net, weighted in-range share. */
function summarize(days: DayResult[], at: number): YieldEntry | null {
  const total = days.reduce((n, x) => n + x.d, 0);
  if (!(total > 0)) return null;
  const feeApr = days.reduce((n, x) => n + x.a * x.d, 0) / total;
  const net = days.reduce((n, x) => n + x.n, 0);
  const inRange = days.every((x) => x.i != null) ? days.reduce((n, x) => n + x.i! * x.d, 0) / total : -1;
  return [round(feeApr, 2), round(net, 2), round(total, 1), inRange >= 0 ? Math.round(inRange) : -1, days.some((x) => x.x) ? 1 : 0, at];
}

/**
 * One run on one chain, kept apart from storage so it can be run anywhere.
 * Closes yesterday's band, opens today's, and returns each pool's figure
 * over its last week of daily results. Mutates `state`.
 */
export async function measureChain(
  client: PublicClient,
  pools: YieldPool[],
  state: BandsFile,
  previous: Record<string, YieldEntry>,
): Promise<{ yields: Record<string, YieldEntry>; shares: Record<string, number>; opened: number; closed: number }> {
  const known = pools.map((p) => ({ ...p, tickSpacing: state[p.id]?.s }));
  const now = await readPoolsNow(client, known);
  await findV4Spacing(client, known, now);
  known.forEach((p, i) => { if (now[i]?.tickSpacing) state[p.id] = { ...(state[p.id] ?? { b: [] }), s: now[i]!.tickSpacing }; });

  const at = Date.now();
  const closed = await closeBands(client, known, now, state, at, MIN_BAND_AGE);
  // Each pool's LP share of swap fees after the DEX's cut, for rows the
  // measurement does not cover (their APR is still volume times fee tier).
  const shares: Record<string, number> = {};
  known.forEach((p, i) => { const sh = now[i]?.lpShare; if (sh != null) shares[p.id] = Number(sh.toFixed(4)); });

  const yields: Record<string, YieldEntry> = {};
  for (const p of known) {
    const entry = state[p.id];
    if (!entry) continue;
    entry.b = entry.b.filter((x) => at - x.t <= MAX_OPEN_AGE);
    entry.r = (entry.r ?? []).filter((x) => at - x.t <= WINDOW);
    const y = summarize(entry.r, entry.r.length ? Math.max(...entry.r.map((x) => x.t)) : at);
    if (y) yields[p.id] = y;
  }
  // Keep a recent figure for a pool that could not be measured this time.
  for (const [id, y] of Object.entries(previous)) if (!yields[id] && at - y[5] < KEEP_YIELD) yields[id] = y;

  // Open today's band where no band younger than a day is open.
  const due = known.map((_, i) => i).filter((i) => now[i] && !(state[known[i].id]?.b ?? []).some((x) => at - x.t < MIN_BAND_AGE));
  const fresh = await openBands(client, due.map((i) => known[i]), due.map((i) => now[i]), at);
  let opened = 0;
  fresh.forEach((band, j) => {
    if (!band) return;
    const id = known[due[j]].id;
    state[id] = { ...(state[id] ?? { b: [] }), b: [...(state[id]?.b ?? []), band] };
    opened++;
  });

  // Forget pools Discover no longer lists.
  const listed = new Set(known.map((p) => p.id));
  for (const id of Object.keys(state)) if (!listed.has(id)) delete state[id];

  return { yields, shares, opened, closed };
}

type Ctx = ActionCtx;

/** The chain's stored bands and last measurements; `row` is null before the first run. */
async function loadChain(ctx: Ctx, chainId: number) {
  const row = await ctx.runQuery(internal.rangeYield.getChain, { chainId });
  let state: BandsFile = {};
  let previous: Record<string, YieldEntry> = {};
  if (row) {
    const blob = await ctx.storage.get(row.bandsFile);
    if (blob) state = JSON.parse(strFromU8(gunzipSync(new Uint8Array(await blob.arrayBuffer())))) as BandsFile;
    previous = JSON.parse(row.yields) as Record<string, YieldEntry>;
  }
  return { row, state, previous };
}

async function saveChain(ctx: Ctx, chainId: number, state: BandsFile, yields: Record<string, YieldEntry>, shares?: Record<string, number>) {
  const bytes = gzipSync(strToU8(JSON.stringify(state)), { level: 9 });
  const bandsFile = await ctx.storage.store(new Blob([bytes as BlobPart], { type: "application/gzip" }));
  await ctx.runMutation(internal.rangeYield.saveChain, { chainId, bandsFile, yields: JSON.stringify(yields), ...(shares ? { lpShares: JSON.stringify(shares) } : {}) });
}

/** The chain's client and the pools to measure, or null when there is nothing to do. */
async function chainSetup(ctx: Ctx, chainId: number) {
  await loadLiveRpcs(ctx);
  const client = getChainClient(chainId);
  if (!client) return null;
  const snap = await loadDiscover(ctx);
  if (!snap) return null;
  const pools = poolsFor(snap.pools, chainId);
  return pools.length > 0 ? { client, pools } : null;
}

export const refreshChain = internalAction({
  args: { chainId: v.float64() },
  handler: async (ctx, { chainId }) => {
    const setup = await chainSetup(ctx, chainId);
    if (!setup) return;
    const started = Date.now();
    const { row, state, previous } = await loadChain(ctx, chainId);
    const { yields, shares, opened, closed } = await measureChain(setup.client, setup.pools, state, previous);
    await saveChain(ctx, chainId, state, yields, shares);
    const scaled = Object.values(yields).filter((y) => y[4] === 1).length;
    console.log(`range yield ${chainId}: ${setup.pools.length} pools, ${Object.keys(yields).length} measured (${scaled} scaled), ${closed} days closed, ${opened} bands opened, ${Math.round((Date.now() - started) / 1000)}s`);
    // First run on this chain: fill in the past week where the RPCs keep
    // history, one day per action so none nears the action time limit.
    if (!row) await ctx.scheduler.runAfter(0, internal.rangeYieldActions.seedChain, { chainId, daysBack: SEED_FROM_DAYS });
  },
});

/** One past day of bands for a chain's first week; walks toward today, then measures and refreshes Discover. */
export const seedChain = internalAction({
  args: { chainId: v.float64(), daysBack: v.float64(), seeded: v.optional(v.float64()) },
  handler: async (ctx, { chainId, daysBack, seeded = 0 }) => {
    const setup = await chainSetup(ctx, chainId);
    if (!setup) return;
    const { state, previous } = await loadChain(ctx, chainId);
    // A chain whose RPCs keep no history answers null quickly at every step.
    const opened = await seedDay(setup.client, setup.pools, state, daysBack).catch((e) => { console.warn("seed", chainId, daysBack, e); return null; });
    console.log(`range yield seed ${chainId} ${daysBack}d back: ${opened ?? "no history"}`);
    if (opened) await saveChain(ctx, chainId, state, previous);
    const total = seeded + (opened ?? 0);
    if (daysBack > 1) {
      await ctx.scheduler.runAfter(0, internal.rangeYieldActions.seedChain, { chainId, daysBack: daysBack - 1, seeded: total });
    } else if (total > 0) {
      // Measure the seeded bands now rather than at tomorrow's run.
      await ctx.scheduler.runAfter(0, internal.rangeYieldActions.refreshChain, { chainId });
      await ctx.scheduler.runAfter(5 * 60_000, internal.rangeYieldActions.applyToDiscover, {});
    }
  },
});

/** Re-save Discover so its rows pick up the new figures (saveDiscover applies them). */
export const applyToDiscover = internalAction({
  args: {},
  handler: async (ctx) => {
    await loadLiveRpcs(ctx);
    const snap = await loadDiscover(ctx);
    if (snap) await saveDiscover(ctx, snap);
  },
});

/** Daily entry point: one staggered action per chain, then one Discover re-save. */
export const refresh = internalAction({
  args: {},
  handler: async (ctx) => {
    const snap = await loadDiscover(ctx);
    if (!snap) return;
    const chains = [...new Set(snap.pools.map(chainIdOf).filter((c): c is number => c != null && !!getChainClient(c)))];
    for (let i = 0; i < chains.length; i++) {
      await ctx.scheduler.runAfter(i * 20_000, internal.rangeYieldActions.refreshChain, { chainId: chains[i] });
    }
    // Each chain takes a few minutes; the re-save runs once all have had time.
    await ctx.scheduler.runAfter(15 * 60_000, internal.rangeYieldActions.applyToDiscover, {});
  },
});
