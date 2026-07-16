"use node";

import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { createPublicClient, defineChain, http, isAddress, keccak256, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const robinhood = defineChain({
  id: 4663, name: "Robinhood Chain", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.mainnet.chain.robinhood.com/"] } },
});
const DEFAULT_REGISTRY = "0x3fD9F511fd3E244CF8566E8B52D26E539f6c02aF" as const;

const REGISTRY_ABI = [
  { name: "tradePolicies", type: "function", stateMutability: "view", inputs: [{ type: "address" }], outputs: [
    { name: "enabled", type: "bool" }, { name: "agent", type: "address" }, { name: "requestKeyHash", type: "bytes32" },
    { name: "maximumBalanceBpsPerTrade", type: "uint16" }, { name: "maximumSlippageBps", type: "uint16" },
    { name: "maximumSpotTwapDeviationBps", type: "uint16" }, { name: "minimumTwapSeconds", type: "uint32" }, { name: "expiresAt", type: "uint64" },
  ] },
  { name: "agentRoles", type: "function", stateMutability: "view", inputs: [{ type: "address" }, { type: "address" }], outputs: [{ type: "uint8" }] },
] as const;
const ERC20_DECIMALS_ABI = [{ name: "decimals", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] }] as const;

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

const INTERVAL_MIN_MS = 5 * 60_000;      // no tighter than every 5 minutes
const INTERVAL_MAX_MS = 30 * 24 * 60 * 60_000; // no looser than monthly

function signerAddress(): Address {
  const raw = process.env.AGENT_PRIVATE_KEY ?? "";
  const key = (raw.startsWith("0x") ? raw : `0x${raw}`) as Hex;
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error("Agent signing key is not configured");
  const account = privateKeyToAccount(key);
  const expected = process.env.AGENT_ADDRESS;
  if (!expected || !isAddress(expected) || !same(account.address, expected)) throw new Error("Agent key does not match AGENT_ADDRESS");
  return account.address;
}

function publicClient() {
  const rpc = process.env.AGENT_RPC_URL || robinhood.rpcUrls.default.http[0];
  return createPublicClient({ chain: robinhood, transport: http(rpc, { timeout: 15_000, retryCount: 2 }) });
}

function registryAddress(): Address {
  const value = process.env.BTB_AGENT_REGISTRY_4663 || DEFAULT_REGISTRY;
  if (!isAddress(value)) throw new Error("BTB_AGENT_REGISTRY_4663 is invalid");
  return value;
}

// Convert a dollar target into a base-unit funding amount using a live route
// quote from the aggregator, so "$5" stays ~$5 as the price moves.
async function sizeUsd(client: ReturnType<typeof publicClient>, tokenIn: Address, tokenOut: Address, targetUsd: number): Promise<string> {
  const decimals = await client.readContract({ address: tokenIn, abi: ERC20_DECIMALS_ABI, functionName: "decimals" });
  const probe = 10n ** BigInt(decimals); // one whole funding token
  const url = `https://aggregator-api.kyberswap.com/robinhood/api/v1/routes?tokenIn=${tokenIn}&tokenOut=${tokenOut}&amountIn=${probe}&saveGas=0&gasInclude=1`;
  const response = await fetch(url, { headers: { "x-client-id": "btb-finance" } });
  const json = await response.json() as { code?: number; data?: { routeSummary?: { amountInUsd?: string } } };
  const unitUsd = Number(json.data?.routeSummary?.amountInUsd || 0);
  if (!response.ok || json.code !== 0 || !Number.isFinite(unitUsd) || unitUsd <= 0) throw new Error("Could not price the funding token for this pair");
  // amountIn = probe * (targetUsd / unitUsd), in 1e6 fixed point to keep it integer.
  const ratioMicros = BigInt(Math.max(1, Math.round((targetUsd / unitUsd) * 1_000_000)));
  const amountIn = probe * ratioMicros / 1_000_000n;
  if (amountIn <= 0n) throw new Error("The dollar amount is too small for this funding token");
  return amountIn.toString();
}

async function assertPolicyAllows(client: ReturnType<typeof publicClient>, registry: Address, account: Address, agent: Address, requestKey: Hex) {
  const policy = await client.readContract({ address: registry, abi: REGISTRY_ABI, functionName: "tradePolicies", args: [account] });
  if (!policy[0] || !same(policy[1], agent) || Number(policy[7]) <= Math.floor(Date.now() / 1000)) throw new Error("Instant trading permission is disabled or expired");
  if (keccak256(requestKey) !== policy[2]) throw new Error("This device is not authorized for this smart account");
  const roles = await client.readContract({ address: registry, abi: REGISTRY_ABI, functionName: "agentRoles", args: [account, agent] });
  if ((roles & 16) === 0) throw new Error("The BTB agent does not have trading permission");
}

export const createSchedule = action({
  args: {
    account: v.string(), owner: v.string(), chainId: v.float64(),
    tokenIn: v.string(), tokenOut: v.string(), tokenInSymbol: v.string(), tokenOutSymbol: v.string(),
    tokenOutImage: v.optional(v.string()), amountUsd: v.float64(), intervalMs: v.float64(),
    requestKey: v.string(), maxRuns: v.optional(v.float64()),
  },
  handler: async (ctx, args): Promise<{ id: Id<"spotTradeSchedules"> }> => {
    if (args.chainId !== 4663 || process.env.AGENT_CHAIN_ID !== "4663" || process.env.AGENT_EXECUTION_ENABLED !== "1") throw new Error("Instant trading is disabled");
    if (!isAddress(args.account) || !isAddress(args.owner) || !isAddress(args.tokenIn) || !isAddress(args.tokenOut) || same(args.tokenIn, args.tokenOut)) throw new Error("Invalid trade tokens");
    if (!/^0x[0-9a-fA-F]{64}$/.test(args.requestKey)) throw new Error("This device is not authorized for instant trading");
    const minUsd = Number(process.env.MIN_SPOT_TRADE_USD || 5);
    if (!Number.isFinite(args.amountUsd) || args.amountUsd < minUsd) throw new Error(`Each recurring buy must be at least $${minUsd.toFixed(0)}`);
    if (!Number.isFinite(args.intervalMs) || args.intervalMs < INTERVAL_MIN_MS || args.intervalMs > INTERVAL_MAX_MS) throw new Error("Pick an interval between 5 minutes and 1 month");
    if (args.maxRuns !== undefined && (!Number.isInteger(args.maxRuns) || args.maxRuns < 1)) throw new Error("Invalid run limit");

    const agent = signerAddress();
    const client = publicClient();
    const registry = registryAddress();
    await assertPolicyAllows(client, registry, args.account as Address, agent, args.requestKey as Hex);
    const amountIn = await sizeUsd(client, args.tokenIn as Address, args.tokenOut as Address, args.amountUsd);

    return ctx.runMutation(internal.dca.insertSchedule, {
      account: args.account, owner: args.owner, chainId: args.chainId,
      tokenIn: args.tokenIn, tokenOut: args.tokenOut, tokenInSymbol: args.tokenInSymbol, tokenOutSymbol: args.tokenOutSymbol,
      tokenOutImage: args.tokenOutImage, amountIn, amountUsd: args.amountUsd, intervalMs: args.intervalMs,
      requestKeyHash: keccak256(args.requestKey as Hex), maxRuns: args.maxRuns,
    });
  },
});

// One run of a due schedule: re-size to the dollar target and drop a normal
// spot order into the queue for the existing worker to execute.
export const enqueueRun = internalAction({
  args: { scheduleId: v.id("spotTradeSchedules"), runIndex: v.float64() },
  handler: async (ctx, { scheduleId, runIndex }) => {
    const schedule = await ctx.runQuery(internal.dca.getSchedule, { scheduleId });
    if (!schedule) return;
    if (process.env.AGENT_CHAIN_ID !== "4663" || process.env.AGENT_EXECUTION_ENABLED !== "1") {
      await ctx.runMutation(internal.dca.recordError, { scheduleId, error: "Instant trading is disabled" });
      return;
    }
    try {
      let amountIn = schedule.amountIn;
      try { amountIn = await sizeUsd(publicClient(), schedule.tokenIn as Address, schedule.tokenOut as Address, schedule.amountUsd); }
      catch { /* pricing hiccup — fall back to the last sized amount */ }
      await ctx.runMutation(internal.spotTradeQueue.insert, {
        orderKey: `dca:${scheduleId}:${runIndex}`,
        chainId: schedule.chainId, account: schedule.account,
        tokenIn: schedule.tokenIn, tokenOut: schedule.tokenOut, amountIn,
      });
      await ctx.runMutation(internal.dca.recordRun, { scheduleId });
    } catch (reason) {
      await ctx.runMutation(internal.dca.recordError, { scheduleId, error: (reason instanceof Error ? reason.message : String(reason)).slice(0, 300) });
    }
  },
});
