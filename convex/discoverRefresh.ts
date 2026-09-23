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
import { CHAIN_DATA_NETWORKS } from "../src/lib/chainDataNetworks";
import { fetchPoolPriceChanges, fetchTokenLogos } from "../src/lib/geckoterminal";
import { fetchMerklPoolRewards, MERKL_CHAINS } from "../src/lib/merkl";
import { packSnapshot, unpackSnapshotNode } from "../src/lib/snapshotCodec";

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

    // Keep the DEX coverage rows from the previous cycle rather than wiping
    // them: the coverage steps below take up to a quarter of an hour, and
    // without this the extra DEXes vanished from Discover for that long every
    // refresh. The steps then replace each chain's rows with fresh numbers.
    const previous = await ctx.runQuery(internal.discover.getInternal, {});
    const baseKeys = new Set(withRange.map((p) => `${p.chain}:${p.id.toLowerCase()}`));
    let carried: EarnPool[] = [];
    if (previous) {
      try {
        const prev = await unpackSnapshotNode<{ pools?: EarnPool[] }>(previous.json);
        carried = (prev.pools ?? []).filter((p) => isConcentratedPool(p) && !baseKeys.has(`${p.chain}:${p.id.toLowerCase()}`));
      } catch { /* unreadable previous snapshot: start clean */ }
    }
    await ctx.runMutation(internal.discover.save, {
      json: await packSnapshot({ version: 2, pools: [...withRange, ...carried], priceChange }),
    });

    // DEX coverage runs as independent follow-up actions, one chain each,
    // staggered so their paced GeckoTerminal walks do not overlap. Scheduled
    // up front rather than chained, so one chain failing or timing out never
    // stops the others. Each step merges into whatever snapshot is current.
    for (let index = 0; index < DISCOVERY_CHAINS.length; index++) {
      await ctx.scheduler.runAfter(index * 4 * 60_000, internal.discoverRefresh.coverDexes, { index });
    }
    // Token logos once the coverage passes have landed.
    await ctx.scheduler.runAfter((DISCOVERY_CHAINS.length + 1) * 4 * 60_000, internal.discoverRefresh.fillTokenLogos, {});
    await ctx.scheduler.runAfter((DISCOVERY_CHAINS.length + 1) * 4 * 60_000 + 60_000, internal.discoverRefresh.fillMerkl, {});
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
    const snap = await unpackSnapshotNode<{ version?: number; pools: EarnPool[]; priceChange?: Record<string, number> }>(row.json);
    const chainName = target.chain;
    const existing = snap.pools.filter((p) => p.chain === chainName);
    const client = getChainClient(target.chainId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const extras = (await ingestChainExtras(client as any, target.chainId, chainName, 50_000, existing).catch(() => [] as EarnPool[])).filter(isConcentratedPool);
    if (extras.length > 0) {
      applyLogos(extras, await fetchDexLogos().catch(() => new Map<string, string>()));
      // Re-read before writing: the base refresh may have run meanwhile.
      const latest = await ctx.runQuery(internal.discover.getInternal, {});
      const current = latest ? await unpackSnapshotNode<typeof snap>(latest.json) : snap;
      // Fresh rows win over what the snapshot already had for the same pool.
      const fresh = new Set(extras.map((p) => `${p.chain}:${p.id.toLowerCase()}`));
      const merged = [...current.pools.filter((p) => !fresh.has(`${p.chain}:${p.id.toLowerCase()}`)), ...extras];
      await ctx.runMutation(internal.discover.save, {
        json: await packSnapshot({ ...current, pools: merged }),
      });
    }
  },
});

/**
 * Give every pool row both token logos. Known logos come from the tokenLogos
 * table; the rest are looked up on GeckoTerminal, 30 addresses per call,
 * paced to the public rate limit and capped so one run stays well inside the
 * action time limit. A token GeckoTerminal has no image for is remembered and
 * asked about again only after a week; a failed request is retried next run.
 */
export const fillTokenLogos = internalAction({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.runQuery(internal.discover.getInternal, {});
    if (!row) return;
    const snap = await unpackSnapshotNode<{ version?: number; pools: EarnPool[]; priceChange?: Record<string, number> }>(row.json);
    // Every EVM chain the snapshot carries, not only the four LP chains.
    const netFor = (p: EarnPool) => {
      const id = p.chainId ?? DISCOVERY_CHAINS.find((c) => c.chain === p.chain)?.chainId;
      const n = id != null ? CHAIN_DATA_NETWORKS[id] : undefined;
      return id != null && n ? { chainId: id, network: n.gecko } : null;
    };
    const wanted = new Map<string, { chainId: number; network: string; address: string }>();
    for (const p of snap.pools) {
      const net = netFor(p);
      if (!net) continue;
      for (const t of p.underlyingTokens ?? []) {
        const a = t.toLowerCase();
        if (!/^0x[0-9a-f]{40}$/.test(a)) continue;
        wanted.set(`${net.chainId}:${a}`, { chainId: net.chainId, network: net.network, address: a });
      }
    }
    const keys = [...wanted.keys()];
    const { known, noLogo } = await ctx.runQuery(internal.discover.tokenLogosFor, { keys });
    const skip = new Set(noLogo);
    const missing = keys.filter((k) => !known[k] && !skip.has(k));
    const byNetwork = new Map<string, string[]>();
    for (const k of missing) { const w = wanted.get(k)!; byNetwork.set(w.network, [...(byNetwork.get(w.network) ?? []), w.address]); }
    const started = Date.now();
    const found: { key: string; logoURI: string }[] = [];
    for (const [network, addrs] of byNetwork) {
      const chainId = [...wanted.values()].find((w) => w.network === network)!.chainId;
      for (let i = 0; i < addrs.length; i += 30) {
        if (Date.now() - started > 7 * 60_000) break;
        const batch = addrs.slice(i, i + 30);
        // A failed request is simply retried next run; only a real answer
        // that leaves an address out records it as having no logo.
        const logos = await fetchTokenLogos(network, batch).catch(() => null);
        if (!logos) continue;
        for (const a of batch) found.push({ key: `${chainId}:${a}`, logoURI: logos.get(a) ?? '' });
      }
    }
    if (found.length > 0) await ctx.runMutation(internal.discover.saveTokenLogos, { entries: found });
    const all: Record<string, string> = { ...known, ...Object.fromEntries(found.filter((f) => f.logoURI).map((f) => [f.key, f.logoURI])) };
    // Re-read before writing so a coverage pass that landed meanwhile is kept.
    const latest = await ctx.runQuery(internal.discover.getInternal, {});
    const current = latest ? await unpackSnapshotNode<typeof snap>(latest.json) : snap;
    for (const p of current.pools) {
      const net = netFor(p);
      if (!net) continue;
      const logos = (p.underlyingTokens ?? []).map((t) => all[`${net.chainId}:${t.toLowerCase()}`]);
      if (logos.some(Boolean)) p.tokenLogos = logos.map((l) => l ?? null);
    }
    await ctx.runMutation(internal.discover.save, { json: await packSnapshot(current) });
  },
});

/** Attach Merkl reward APRs to pool rows, matched by pool address or V4 pool id per chain. */
export const fillMerkl = internalAction({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.runQuery(internal.discover.getInternal, {});
    if (!row) return;
    const snap = await unpackSnapshotNode<{ version?: number; pools: EarnPool[]; priceChange?: Record<string, number> }>(row.json);
    const chainIds = [...new Set(snap.pools.map((p) => p.chainId ?? DISCOVERY_CHAINS.find((c) => c.chain === p.chain)?.chainId).filter((c): c is number => c != null && MERKL_CHAINS.has(c)))];
    const byChain = new Map<number, Awaited<ReturnType<typeof fetchMerklPoolRewards>>>();
    for (const c of chainIds) byChain.set(c, await fetchMerklPoolRewards(c).catch(() => new Map()));
    let hits = 0;
    for (const p of snap.pools) {
      const cid = p.chainId ?? DISCOVERY_CHAINS.find((c) => c.chain === p.chain)?.chainId;
      const m = cid != null ? byChain.get(cid)?.get(p.id.toLowerCase()) : undefined;
      if (m) { p.merkl = { apr: m.apr, rewardSymbols: m.rewardSymbols, dailyRewardsUsd: m.dailyRewardsUsd, endsAt: m.endsAt }; hits++; }
      else if (p.merkl) delete p.merkl;
    }
    console.log(`merkl: ${hits} pools with live rewards`);
    await ctx.runMutation(internal.discover.save, { json: await packSnapshot(snap) });
  },
});
