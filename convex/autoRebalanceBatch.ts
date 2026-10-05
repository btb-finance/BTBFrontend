import { internalAction, type ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { parseAbi } from "viem";
import { getChainClient } from "../src/lib/chainClient";
import { SLOT0_HEAD_ABI } from "../src/protocols/dexs/uniswap/v3/abis";
import { BATCH_CHECKS, FULL_CHECK_EVERY_MS, unpackPosition } from "./autoRebalanceConfig";
import { deploymentFor } from "./autoRebalanceActions";

/**
 * Batched auto-rebalance checks, run once a minute.
 *
 * Most checks find the position still in range, and positions share a few pools. So instead of one action and several
 * chain reads per position, one multicall per chain reads every due position's owner and every pool's price, and an
 * in-range position is settled in a single write. Only positions that need more (out of range, compounding, Alandale
 * reward claims, a position that moved, a snapshot that is stale or older than FULL_CHECK_EVERY_MS) get the full check,
 * exactly as before. The check price and the free trial are unchanged.
 *
 * BATCH_CHECKS = 'shadow' only compares: for every position a full check read in the last 90 seconds, does the batch
 * read agree on in range or not? Each run is recorded in checkerShadow. 'live' does the work.
 */

const NFT_ABI = parseAbi(["function ownerOf(uint256 tokenId) view returns (address)"]);
const CLAIM_LIMIT = 500;

type Job = {
  id: Id<"autoRebalances">; chainId: number; positionManager: string; tokenId: string; wallet: string;
  gauge: string | null; compound: boolean; snapshot: string | null; pool: string | null; lastFullAt: number;
};

/** Whether a job can be settled from the batch read alone, and the range it needs to be inside. */
function fastShape(j: Job): { tickLower: number; tickUpper: number; pool: `0x${string}` } | null {
  if (j.compound || !j.pool || !j.snapshot) return null;
  if (Date.now() - j.lastFullAt >= FULL_CHECK_EVERY_MS) return null;
  const d = deploymentFor(j.chainId, j.positionManager);
  if (!d || d.algebra) return null; // Alandale: rewards are claimed during the full check
  try {
    const p = unpackPosition<{ id: bigint; tickLower: number; tickUpper: number; liquidity: bigint }>(j.snapshot);
    if (p.id.toString() !== j.tokenId || p.liquidity === 0n) return null;
    return { tickLower: p.tickLower, tickUpper: p.tickUpper, pool: j.pool as `0x${string}` };
  } catch { return null; }
}

/**
 * One multicall per chain: each job's owner and each pool's tick. Returns, per job id, whether it is in range and held
 * by its wallet (or its own gauge), or null when the read did not answer.
 */
async function batchRead(jobs: (Job & { shape: NonNullable<ReturnType<typeof fastShape>> })[]) {
  const verdict = new Map<string, { inRange: boolean; held: boolean } | null>();
  const byChain = new Map<number, typeof jobs>();
  for (const j of jobs) byChain.set(j.chainId, [...(byChain.get(j.chainId) ?? []), j]);
  for (const [chainId, list] of byChain) {
    const client = getChainClient(chainId);
    if (!client) { list.forEach((j) => verdict.set(j.id, null)); continue; }
    const pools = [...new Set(list.map((j) => j.shape.pool.toLowerCase()))] as `0x${string}`[];
    try {
      const res = await client.multicall({
        allowFailure: true,
        contracts: [
          ...pools.map((address) => ({ address, abi: SLOT0_HEAD_ABI, functionName: "slot0" as const })),
          ...list.map((j) => ({ address: j.positionManager as `0x${string}`, abi: NFT_ABI, functionName: "ownerOf" as const, args: [BigInt(j.tokenId)] })),
        ],
      });
      const tick = new Map<string, number>();
      pools.forEach((p, i) => { const r = res[i]; if (r.status === "success") tick.set(p, Number((r.result as readonly [bigint, number])[1])); });
      list.forEach((j, i) => {
        const owner = res[pools.length + i];
        const t = tick.get(j.shape.pool.toLowerCase());
        if (owner.status !== "success" || t === undefined) { verdict.set(j.id, null); return; }
        const holder = (owner.result as string).toLowerCase();
        verdict.set(j.id, {
          inRange: t >= j.shape.tickLower && t < j.shape.tickUpper,
          held: holder === j.wallet.toLowerCase() || (!!j.gauge && holder === j.gauge.toLowerCase()),
        });
      });
    } catch {
      list.forEach((j) => verdict.set(j.id, null));
    }
  }
  return verdict;
}

async function live(ctx: ActionCtx) {
  const due = await ctx.runMutation(internal.autoRebalance.claimDue, { limit: CLAIM_LIMIT });
  if (due.length === 0) return;
  const fast: (Job & { gen: number; shape: NonNullable<ReturnType<typeof fastShape>> })[] = [];
  const full: { id: Id<"autoRebalances">; gen: number; retry: boolean }[] = [];
  for (const j of due) {
    const shape = j.retry ? null : fastShape(j);
    if (shape) fast.push({ ...j, shape }); else full.push({ id: j.id, gen: j.gen, retry: j.retry });
  }
  const verdict = await batchRead(fast);
  const settle: { id: Id<"autoRebalances">; gen: number }[] = [];
  for (const j of fast) {
    const v = verdict.get(j.id);
    if (v && v.inRange && v.held) settle.push({ id: j.id, gen: j.gen });
    else full.push({ id: j.id, gen: j.gen, retry: false });
  }
  if (settle.length) await ctx.runMutation(internal.autoRebalance.fastSettle, { items: settle });
  // Spread the full checks over the next few seconds so a big sweep does not start them all at once.
  for (const [i, f] of full.entries()) {
    await ctx.scheduler.runAfter(Math.min(i * 200, 30_000), internal.autoRebalanceActions.check, { id: f.id, gen: f.gen, retry: f.retry });
  }
}

async function shadow(ctx: ActionCtx) {
  const rows = await ctx.runQuery(internal.autoRebalance.activeForShadow, {});
  const eligible = rows.map((r) => ({ ...r, shape: fastShape(r) })).filter((r): r is typeof r & { shape: NonNullable<ReturnType<typeof fastShape>> } => !!r.shape);
  const verdict = await batchRead(eligible);
  const now = Date.now();
  let compared = 0, agree = 0;
  const details: string[] = [];
  for (const r of eligible) {
    // Compare only with a full check that read the chain moments ago, so both saw the same price.
    if (!r.lastCheckedAt || now - r.lastCheckedAt > 90_000 || r.lastInRange == null) continue;
    const v = verdict.get(r.id);
    if (!v) continue;
    compared++;
    if (v.inRange === r.lastInRange && v.held) agree++;
    else if (details.length < 10) details.push(`${r.label} #${r.tokenId}: batch inRange=${v.inRange} held=${v.held}, full inRange=${r.lastInRange}`);
  }
  await ctx.runMutation(internal.autoRebalance.recordShadow, {
    compared, agree, disagree: compared - agree, fastEligible: eligible.length, active: rows.length, details: JSON.stringify(details),
  });
}

export const sweepChecks = internalAction({
  args: {},
  handler: async (ctx) => {
    if (BATCH_CHECKS === "live") await live(ctx);
    else await shadow(ctx);
  },
});
