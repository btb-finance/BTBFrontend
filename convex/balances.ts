"use node";

/**
 * Server-side wallet-balance fetcher.
 *
 * Why this lives in Convex instead of the browser:
 *  - One Convex action per refresh ≪ 22 simultaneous RPC clients per user.
 *  - Public Ethereum RPCs rate-limit aggressively from browser IPs but tolerate
 *    Convex's datacenter origin, so "USDC didn't load" flakiness goes away.
 *  - Lets us gate refreshes (credit-based throttling later) without rewriting
 *    the frontend.
 *
 * Trigger model: explicit. Wallet connect kicks off one fetch; afterwards the
 * UI shows the cached snapshot from `userTokenBalances`, and a refresh button
 * is the only thing that re-runs this action.
 */

import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";
import { createPublicClient, http, fallback, erc20Abi } from "viem";
import { mainnet } from "viem/chains";

// Only RPCs that actually serve Multicall3. The `probeFirstBatch` action below
// proved that ~8 of the public endpoints return all-zero/empty for multicalls
// (llamarpc, cloudflare, ankr, zan, tatum, flashbots, meowrpc, payload) even
// though they respond OK to plain eth_call. Including them in the pool here
// just produces silent failures that look like "USDC didn't load".
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

const NATIVE = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";

function formatUnits(value: bigint, decimals: number): string {
  if (value === 0n) return "0";
  const s = value.toString().padStart(decimals + 1, "0");
  const whole = s.slice(0, s.length - decimals) || "0";
  const frac = s.slice(s.length - decimals).replace(/0+$/, "").slice(0, 6);
  return frac ? `${whole}.${frac}` : whole;
}

function balanceFloat(raw: bigint, decimals: number): number {
  return Number(raw) / Math.pow(10, decimals);
}

type TokenRow = { address: string; symbol: string; name: string; decimals: number; logoURI?: string };
type PriceRow = { address: string; priceUsd: number };

export const refresh = action({
  args: { walletAddress: v.string() },
  handler: async (ctx, { walletAddress }) => {
    const addr = walletAddress.toLowerCase() as `0x${string}`;

    const [tokenListRaw, priceRowsRaw] = await Promise.all([
      ctx.runQuery(api.tokens.listAll),
      ctx.runQuery(api.queries.listAllPrices),
    ]);
    const tokenList = tokenListRaw as TokenRow[];
    const priceRows = priceRowsRaw as PriceRow[];

    const priceMap = new Map<string, number>();
    for (const p of priceRows) priceMap.set(p.address.toLowerCase(), p.priceUsd);
    // DexScreener has no native-ETH entry; mirror WETH onto the native key.
    const wethPrice = priceMap.get(WETH);
    if (wethPrice && wethPrice > 0) priceMap.set(NATIVE, wethPrice);

    const erc20List: TokenRow[] = tokenList.filter((t) => t.address !== NATIVE);
    // Smaller batches survive flaky public RPCs (some reject multicalls > ~100
    // contracts due to per-call gas limits). 50 is a known-working size.
    const BATCH = 50;
    const batches: typeof erc20List[] = [];
    for (let i = 0; i < erc20List.length; i += BATCH) batches.push(erc20List.slice(i, i + BATCH));

    const clients = MAINNET_RPCS.map((url) => createPublicClient({ chain: mainnet, transport: http(url) }));
    const pub = createPublicClient({ chain: mainnet, transport: fallback(MAINNET_RPCS.map((url) => http(url))) });

    const callBatch = (clientIdx: number, batch: typeof erc20List) =>
      clients[clientIdx % clients.length].multicall({
        contracts: batch.map((t) => ({
          address: t.address as `0x${string}`,
          abi: erc20Abi,
          functionName: "balanceOf" as const,
          args: [addr],
        })),
        allowFailure: true,
      });

    // Race 3 RPCs at once per round — first successful response wins. If the
    // whole round fails, advance to the next 3 RPCs. Up to 5 rounds means each
    // batch tries 15 different RPCs before giving up.
    type Batch = typeof erc20List;
    type BatchResult = { batch: Batch; results: Awaited<ReturnType<typeof callBatch>> | null };
    const RACE_SIZE = 3;
    const MAX_ROUNDS = 5;

    async function fetchBatchRaced(batch: Batch, idx: number): Promise<BatchResult> {
      for (let round = 0; round < MAX_ROUNDS; round++) {
        const racers = Array.from({ length: RACE_SIZE }, (_, r) =>
          callBatch((idx + round * RACE_SIZE + r) % clients.length, batch)
        );
        try {
          const results = await Promise.any(racers);
          return { batch, results };
        } catch {
          /* every racer in this round failed — try next round */
        }
      }
      return { batch, results: null };
    }

    const [ethBalance, batchResults] = await Promise.all([
      pub.getBalance({ address: addr }).catch(() => 0n),
      Promise.all(batches.map((batch, idx) => fetchBatchRaced(batch, idx))),
    ]);

    type SnapshotRow = {
      tokenAddress: string;
      symbol: string;
      name: string;
      decimals: number;
      logoURI?: string;
      balanceFormatted: string;
      balanceRaw: string;
      valueUsd: number;
    };
    const balances: SnapshotRow[] = [];

    if (ethBalance > 0n) {
      const ethMeta = tokenList.find((t) => t.address === NATIVE);
      const price = priceMap.get(NATIVE) ?? 0;
      const balNum = balanceFloat(ethBalance, 18);
      balances.push({
        tokenAddress: NATIVE,
        symbol: ethMeta?.symbol ?? "ETH",
        name: ethMeta?.name ?? "Ethereum",
        decimals: 18,
        logoURI: ethMeta?.logoURI,
        balanceFormatted: formatUnits(ethBalance, 18),
        balanceRaw: ethBalance.toString(),
        valueUsd: balNum * price,
      });
    }

    for (const { batch, results } of batchResults) {
      if (!results) continue;
      for (let j = 0; j < results.length; j++) {
        const r = results[j];
        if (r.status !== "success") continue;
        const raw = r.result as bigint;
        if (raw <= 0n) continue;
        const t = batch[j];
        const price = priceMap.get(t.address.toLowerCase()) ?? 0;
        const balNum = balanceFloat(raw, t.decimals);
        balances.push({
          tokenAddress: t.address,
          symbol: t.symbol,
          name: t.name,
          decimals: t.decimals,
          logoURI: t.logoURI,
          balanceFormatted: formatUnits(raw, t.decimals),
          balanceRaw: raw.toString(),
          valueUsd: balNum * price,
        });
      }
    }

    const totalValueUsd = balances.reduce((s, b) => s + b.valueUsd, 0);
    await ctx.runMutation(api.users.saveBalanceSnapshot, {
      walletAddress: addr,
      balances,
      totalValueUsd,
    });

    const failedBatches = batchResults.filter((b: BatchResult) => !b.results).length;
    return { count: balances.length, totalValueUsd, totalBatches: batchResults.length, failedBatches };
  },
});

/** Diagnostic: probe batch 0 across all RPCs to see which actually respond. */
export const probeFirstBatch = action({
  args: { walletAddress: v.string() },
  handler: async (ctx, { walletAddress }) => {
    const addr = walletAddress.toLowerCase() as `0x${string}`;
    const tokenListRaw = await ctx.runQuery(api.tokens.listAll);
    const tokenList = tokenListRaw as TokenRow[];
    const erc20List = tokenList.filter((t) => t.address !== NATIVE);
    const batch = erc20List.slice(0, 50);

    const results: Array<{ rpc: string; ok: boolean; count: number; error?: string }> = [];
    for (const url of MAINNET_RPCS) {
      const c = createPublicClient({ chain: mainnet, transport: http(url) });
      try {
        const r = await c.multicall({
          contracts: batch.map((t) => ({
            address: t.address as `0x${string}`,
            abi: erc20Abi,
            functionName: "balanceOf" as const,
            args: [addr],
          })),
          allowFailure: true,
        });
        const successCount = r.filter((x) => x.status === "success").length;
        results.push({ rpc: url, ok: true, count: successCount });
      } catch (e) {
        results.push({ rpc: url, ok: false, count: 0, error: (e as Error).message?.slice(0, 200) });
      }
    }
    return results;
  },
});
