"use node";

/**
 * Server-side Discover pool refresher (hourly cron — see crons.ts).
 *
 * The Discover pool pipeline (DeFiLlama + DexPaprika discovery + DexScreener
 * TVL + on-chain fee/range-APR multicalls) takes several seconds and hits
 * rate-limited public APIs — running it per visitor made the page slow.
 * This action runs it once an hour and stores the finished list via
 * `discover.save`; storage/read live in `discover.ts` (Convex requires
 * queries/mutations to live outside "use node" files).
 *
 * Reuses the exact pipeline code from `src/lib/pools.ts`, so Discover shows
 * identical numbers either way.
 */

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { createPublicClient, fallback, http } from "viem";
import { mainnet } from "viem/chains";
import { getChainClient } from "../src/lib/chainClient";
import { getEarnPools, addRangeAprs, ingestChainExtras, fetchDexLogos, applyLogos, isConcentratedPool, DISCOVERY_CHAINS, type EarnPool } from "../src/lib/pools";
import { v } from "convex/values";
import { fetchPoolPriceChanges } from "../src/lib/geckoterminal";

// Multicall3-capable public RPCs — same proven set as balances.ts.
const MAINNET_RPCS = [
  "https://ethereum.publicnode.com",
  "https://1rpc.io/eth",
  "https://eth.drpc.org",
  "https://eth.blockrazor.xyz",
  "https://eth.rpc.blxrbdn.com",
  "https://rpc.eth.gateway.fm",
  "https://gateway.tenderly.co/public/mainnet",
  "https://mainnet.gateway.tenderly.co",
  "https://eth1.lava.build",
  "https://eth.api.onfinality.io/public",
  "https://0xrpc.io/eth",
  "https://ethereum.public.blockpi.network/v1/rpc/public",
  "https://eth-mainnet.public.blastapi.io",
];

export const refresh = internalAction({
  args: {},
  handler: async (ctx) => {
    const mainnetClient = createPublicClient({
      chain: mainnet,
      transport: fallback(MAINNET_RPCS.map((u) => http(u, { timeout: 12_000, retryCount: 1 }))),
    });

    // One client per discovery chain, built once and reused across the pass.
    // These must come from getChainClient rather than a bare createPublicClient:
    // it carries each chain's viem chain object, and without that viem does not
    // know the Multicall3 address, so every batched fee and symbol read fails.
    // Mainnet keeps its own longer failover list above.
    const clients = new Map<number, unknown>([[1, mainnetClient]]);
    for (const { chainId } of DISCOVERY_CHAINS) {
      if (chainId == null || clients.has(chainId)) continue;
      const chainClient = getChainClient(chainId);
      if (chainClient) clients.set(chainId, chainClient);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const clientFor = (chainId?: number) => (chainId == null ? null : clients.get(chainId) ?? null) as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pools = await getEarnPools(undefined, clientFor as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const withRange = await addRangeAprs(mainnetClient as any, pools).catch(() => pools);

    // 24h price change for indexer-sourced rows — one batched call.
    let priceChange: Record<string, number> = {};
    const addressable = withRange.filter((p) => p.source === "uniswap");
    if (addressable.length > 0) {
      priceChange = await fetchPoolPriceChanges(addressable.map((p) => p.id)).catch(() => ({}));
    }

    await ctx.runMutation(internal.discover.save, {
      json: JSON.stringify({ version: 2, pools: withRange, priceChange }),
    });

    // DEX coverage runs as independent follow-up actions, one chain each,
    // staggered so their paced GeckoTerminal walks do not overlap. Scheduled
    // up front rather than chained, so one chain failing or timing out never
    // stops the others. Each step merges into whatever snapshot is current.
    for (let index = 0; index < DISCOVERY_CHAINS.length; index++) {
      await ctx.scheduler.runAfter(index * 4 * 60_000, internal.discoverRefresh.coverDexes, { index });
    }
  },
});

/** Pull the top pools of every concentrated liquidity DEX the base snapshot
 * missed on one discovery chain and merge them in. */
export const coverDexes = internalAction({
  args: { index: v.number() },
  handler: async (ctx, { index }) => {
    const target = DISCOVERY_CHAINS[index];
    if (!target || target.chainId == null) return;
    const row = await ctx.runQuery(internal.discover.getInternal, {});
    if (!row) return;
    const snap = JSON.parse(row.json) as { version?: number; pools: EarnPool[]; priceChange?: Record<string, number> };
    const chainName = target.chain;
    const existing = snap.pools.filter((p) => p.chain === chainName);
    const client = getChainClient(target.chainId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const extras = (await ingestChainExtras(client as any, target.chainId, chainName, 50_000, existing).catch(() => [] as EarnPool[])).filter(isConcentratedPool);
    if (extras.length > 0) {
      applyLogos(extras, await fetchDexLogos().catch(() => new Map<string, string>()));
      // Re-read before writing: the base refresh may have run meanwhile.
      const latest = await ctx.runQuery(internal.discover.getInternal, {});
      const current = latest ? (JSON.parse(latest.json) as typeof snap) : snap;
      const have = new Set(current.pools.map((p) => `${p.chain}:${p.id.toLowerCase()}`));
      const merged = [...current.pools, ...extras.filter((p) => !have.has(`${p.chain}:${p.id.toLowerCase()}`))];
      await ctx.runMutation(internal.discover.save, {
        json: JSON.stringify({ ...current, pools: merged }),
      });
    }
  },
});
