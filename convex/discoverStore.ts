/**
 * Discover's pool snapshot, split for speed and size (2026-10-22).
 *
 * One row used to carry every pool: 792 KB of base64 for 3,783 pools, read by every visitor before the first row
 * showed, and nearing Convex's 1 MB document limit, past which saving would fail and Discover would stop updating.
 * Now the busiest pools (the first screen) sit packed in a small index row the page reads in one query, and each
 * chain's full list is a gzip file in storage that the page fetches in the background, so no single piece nears the
 * limit however many pools there are. Numbers are rounded to what the table shows.
 *
 * Every refresh step loads and saves through here; the agent's pool tools load through here too.
 */
import type { ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { gzipSync, gunzipSync, strToU8, strFromU8 } from "fflate";
import { packSnapshot, unpackSnapshotNode } from "../src/lib/snapshotCodec";
import { DISCOVERY_CHAINS, type EarnPool } from "../src/lib/pools";
import { dropUnbackedTvl } from "../src/lib/tvlCheck";
import { getChainClient } from "../src/lib/chainClient";
import type { YieldEntry } from "./rangeYield";

export type DiscoverSnap = { version?: number; pools: EarnPool[]; priceChange?: Record<string, number> };

/** Pools on the first screen: the busiest by 24h volume (TVL when a row has none). */
const TOP_POOLS = 300;
/** The old single row is still written while it fits, so a page from before this change keeps working. */
const LEGACY_MAX_BYTES = 900_000;

const round = (n: number | undefined, digits: number) => (n == null || !Number.isFinite(n) ? n : Number(n.toFixed(digits)));

/** Rounded to what the table shows: percentages to 2 decimals, dollar amounts to whole dollars. */
function slim(p: EarnPool): EarnPool {
  return {
    ...p,
    tvlUsd: round(p.tvlUsd, 0)!,
    apy: round(p.apy, 2)!,
    apyBase: round(p.apyBase, 2)!,
    apyReward: round(p.apyReward, 2)!,
    volume24hUsd: round(p.volume24hUsd, 0),
    fees24hUsd: round(p.fees24hUsd, 0),
    apyChange1d: round(p.apyChange1d, 2),
    aprRange: round(p.aprRange, 2),
  };
}

const busy = (p: EarnPool) => p.volume24hUsd ?? p.tvlUsd / 100;

/**
 * Put the measured ±5% range APR (convex/rangeYieldActions.ts) on each row it
 * covers: `aprRange` becomes what a ±5% band really earned, replacing the
 * volume estimate. A row whose measurement expired loses both.
 *
 * Rows nothing measured still show volume times fee tier, which ignores the
 * DEX's own cut (Uniswap's fee switch, PancakeSwap's treasury share, Ramses'
 * voters). Their fee figures are lowered to the share LPs keep, read from
 * each pool. `lpCutPct` records the cut once applied, so a row saved again
 * by a later refresh step is not cut twice.
 */
async function applyRangeYields(ctx: ActionCtx, pools: EarnPool[]): Promise<void> {
  const rows = await ctx.runQuery(internal.rangeYield.allYields, {});
  const byChain = new Map(rows.map((r) => [r.chainId, JSON.parse(r.yields) as Record<string, YieldEntry>]));
  const sharesByChain = new Map(rows.map((r) => [r.chainId, JSON.parse(r.lpShares) as Record<string, number>]));
  for (const p of pools) {
    const chainId = p.chainId ?? DISCOVERY_CHAINS.find((c) => c.chain === p.chain)?.chainId;
    const id = p.id.toLowerCase();
    const y = chainId != null ? byChain.get(chainId)?.[id] : undefined;
    if (y) {
      const [feeApr, netPct, days, inRange, scaled] = y;
      p.aprRange = feeApr;
      p.rangeYield = { days, netPct, ...(inRange >= 0 ? { inRangePct: inRange } : {}), ...(scaled ? { scaled: true } : {}) };
    } else if (p.rangeYield) {
      delete p.rangeYield;
      delete p.aprRange;
    }
    const share = chainId != null ? sharesByChain.get(chainId)?.[id] : undefined;
    if (share == null || p.lpCutPct != null || !(share >= 0 && share <= 1)) continue;
    p.lpCutPct = Math.round((1 - share) * 1000) / 10;
    // The measured figure is already net of the cut; only gross figures shrink.
    if (share === 1) continue;
    const feeOnly = !(p.apyReward > 0);
    p.apyBase *= share;
    if (feeOnly) p.apy *= share;
    if (p.fees24hUsd != null) p.fees24hUsd *= share;
    if (p.aprRange != null && !p.rangeYield) p.aprRange *= share;
  }
}

export async function saveDiscover(ctx: ActionCtx, snap: DiscoverSnap): Promise<void> {
  // Pools whose TVL no real money backs (a token priced from its own pool) are dropped here, where every refresh
  // step saves; rows already checked are skipped, and a failed check saves the list as it was.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const backed = await dropUnbackedTvl(snap.pools, (chainId) => getChainClient(chainId) as any).catch(() => snap.pools);
  await applyRangeYields(ctx, backed).catch((e) => console.warn("range yields", e));
  const pools = backed.map(slim);
  const byChain = new Map<string, EarnPool[]>();
  for (const p of pools) byChain.set(p.chain, [...(byChain.get(p.chain) ?? []), p]);
  const chains = await Promise.all([...byChain].map(async ([chain, list]) => {
    const bytes = gzipSync(strToU8(JSON.stringify({ pools: list })), { level: 9 });
    const file = await ctx.storage.store(new Blob([bytes as BlobPart], { type: "application/gzip" }));
    return { chain, file, count: list.length };
  }));
  const top = [...pools].sort((a, b) => busy(b) - busy(a)).slice(0, TOP_POOLS);
  await ctx.runMutation(internal.discover.saveIndex, {
    top: await packSnapshot({ version: snap.version ?? 2, pools: top, priceChange: snap.priceChange ?? {} }),
    chains,
    total: pools.length,
  });
  // Until every page reads the index: the old row, while it still fits.
  const legacy = await packSnapshot({ ...snap, pools });
  if (legacy.length < LEGACY_MAX_BYTES) await ctx.runMutation(internal.discover.save, { json: legacy }).catch(() => {});
}

/** The full snapshot: every chain file, merged. Falls back to the old row before the first split save. */
export async function loadDiscover(ctx: ActionCtx): Promise<DiscoverSnap | null> {
  const index = await ctx.runQuery(internal.discover.getIndexInternal, {});
  if (index) {
    const top = await unpackSnapshotNode<DiscoverSnap>(index.top).catch(() => null);
    const lists = await Promise.all(index.chains.map(async (c) => {
      const blob = await ctx.storage.get(c.file);
      if (!blob) throw new Error(`Discover file for ${c.chain} is missing`);
      return (JSON.parse(strFromU8(gunzipSync(new Uint8Array(await blob.arrayBuffer())))) as { pools: EarnPool[] }).pools;
    }));
    return { version: top?.version ?? 2, pools: lists.flat(), priceChange: top?.priceChange ?? {} };
  }
  const row = await ctx.runQuery(internal.discover.getInternal, {});
  return row ? unpackSnapshotNode<DiscoverSnap>(row.json) : null;
}
