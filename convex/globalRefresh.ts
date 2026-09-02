"use node";

/**
 * Cron-driven refreshers for data that is identical for every visitor.
 *
 * Each one runs the work a browser used to repeat per session — a ydaemon
 * round trip, a batch of BearNFT/BearStaking reads — and writes the result to
 * the shared `snapshots` table. Clients read the snapshot with one Convex
 * query; nobody pays the upstream cost again until the next tick.
 *
 * Cadence lives in `crons.ts` (30 minutes). Storage/read live in
 * `snapshots.ts` — Convex requires queries/mutations outside "use node" files.
 */

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { createPublicClient, fallback, http } from "viem";
import { mainnet } from "viem/chains";
import { MAINNET_RPCS } from "./rpcEndpoints";
import { fetchYearnVaultsFromApi, toWire } from "../src/lib/yearnVaults";
import { CONTRACTS } from "../src/lib/contractAddresses";
import { BEAR_NFT_ABI, BEAR_STAKING_ABI } from "../src/contracts/abis";

export const SNAPSHOT_YEARN_VAULTS = "yearn-vaults";
export const SNAPSHOT_BEAR_STATS = "bear-stats";

function mainnetClient() {
  return createPublicClient({
    chain: mainnet,
    transport: fallback(MAINNET_RPCS.map((u) => http(u, { timeout: 12_000, retryCount: 1 }))),
  });
}

/** The Yearn vault catalog — one ydaemon call for the whole app. */
export const refreshYearnVaults = internalAction({
  args: {},
  handler: async (ctx) => {
    const vaults = await fetchYearnVaultsFromApi();
    await ctx.runMutation(internal.snapshots.save, {
      key: SNAPSHOT_YEARN_VAULTS,
      json: JSON.stringify({ version: 1, vaults: vaults.map(toWire) }),
    });
  },
});

/**
 * Global BearNFT + BearStaking numbers (mint progress, pool stats). These are
 * the reads every visitor used to poll every 15-20 seconds from the app shell,
 * connected or not. Per-wallet reads (balances, pending rewards, approval)
 * stay on the client — they are not shared and must stay live.
 */
export const refreshBearStats = internalAction({
  args: {},
  handler: async (ctx) => {
    const client = mainnetClient();
    const [totalMinted, pricePerNFT, remainingSupply, stats] = await client.multicall({
      allowFailure: false,
      contracts: [
        { address: CONTRACTS.BEAR_NFT, abi: BEAR_NFT_ABI, functionName: "totalMinted" },
        { address: CONTRACTS.BEAR_NFT, abi: BEAR_NFT_ABI, functionName: "pricePerNFT" },
        { address: CONTRACTS.BEAR_NFT, abi: BEAR_NFT_ABI, functionName: "remainingSupply" },
        { address: CONTRACTS.BEAR_STAKING, abi: BEAR_STAKING_ABI, functionName: "getStats" },
      ],
    });

    // bigints are serialized as decimal strings; the client revives them.
    const [totalStaked, totalRewardsDistributed, pendingToCollect, rewardsLast24h, estimatedApr] =
      stats as readonly [bigint, bigint, bigint, bigint, bigint];

    await ctx.runMutation(internal.snapshots.save, {
      key: SNAPSHOT_BEAR_STATS,
      json: JSON.stringify({
        version: 1,
        totalMinted: String(totalMinted),
        pricePerNFT: String(pricePerNFT),
        remainingSupply: String(remainingSupply),
        stats: {
          totalStaked: String(totalStaked),
          totalRewardsDistributed: String(totalRewardsDistributed),
          pendingToCollect: String(pendingToCollect),
          rewardsLast24h: String(rewardsLast24h),
          estimatedApr: String(estimatedApr),
        },
      }),
    });
  },
});
