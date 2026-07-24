"use node";

import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { createPublicClient, defineChain, http, isAddress, type Address } from "viem";
import { v } from "convex/values";

const robinhood = defineChain({
  id: 4663, name: "Robinhood Chain", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.mainnet.chain.robinhood.com/"] } },
});
const DEFAULT_GUARD = "0xfD6cf126B7f748717F97AF1F6eaA649446E570c8" as const;

const accountAbi = [
  { name: "owner", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { name: "paused", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  { name: "agents", type: "function", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ name: "payoutReceiver", type: "address" }, { name: "expiresAt", type: "uint64" }, { name: "enabled", type: "bool" }] },
] as const;
const positionAbi = [
  { name: "ownerOf", type: "function", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "address" }] },
  { name: "positions", type: "function", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [
    { type: "uint96" }, { type: "address" }, { type: "address" }, { type: "address" }, { type: "uint24" },
    { type: "int24" }, { type: "int24" }, { type: "uint128" }, { type: "uint256" }, { type: "uint256" }, { type: "uint128" }, { type: "uint128" },
  ] },
] as const;
const slot0Abi = [{ name: "slot0", type: "function", stateMutability: "view", inputs: [], outputs: [
  { type: "uint160" }, { type: "int24" }, { type: "uint16" }, { type: "uint16" }, { type: "uint16" }, { type: "uint8" }, { type: "bool" },
] }] as const;
const guardAbi = [
  { name: "poolKey", type: "function", stateMutability: "pure", inputs: [{ type: "address" }, { type: "address" }, { type: "uint24" }], outputs: [{ type: "bytes32" }] },
  { name: "poolPolicies", type: "function", stateMutability: "view", inputs: [{ type: "address" }, { type: "bytes32" }], outputs: [
    { name: "positionManager", type: "address" }, { name: "pool", type: "address" }, { name: "router", type: "address" },
    { name: "routerCodeHash", type: "bytes32" }, { name: "routerSelector0", type: "bytes4" }, { name: "routerSelector1", type: "bytes4" },
    { name: "token0", type: "address" }, { name: "token1", type: "address" },
    { name: "maximumToken0PerRebalance", type: "uint128" }, { name: "maximumToken1PerRebalance", type: "uint128" },
    { name: "fee", type: "uint24" }, { name: "targetTickWidth", type: "uint24" }, { name: "maximumSlippageBps", type: "uint16" },
    { name: "minimumTick", type: "int24" }, { name: "maximumTick", type: "int24" }, { name: "expiresAt", type: "uint64" }, { name: "enabled", type: "bool" },
  ] },
] as const;

type DueRow = {
  key: string; chainId: number; owner: string; account: string; positionManager: string; positionId: string;
  pool: string; token0: string; token1: string; fee: number; expiresAt: number; minRebalanceInterval: number;
  lastRebalanceAt?: number; source: string;
};

const registration = {
  chainId: v.float64(), owner: v.string(), account: v.string(), positionManager: v.string(),
  positionId: v.string(), pool: v.string(), token0: v.string(), token1: v.string(), fee: v.float64(),
  tickLower: v.float64(), tickUpper: v.float64(), targetTickWidth: v.float64(),
  minimumAllowedTick: v.float64(), maximumAllowedTick: v.float64(), maxSlippageBps: v.float64(),
  maxSwapBps: v.float64(), twapSeconds: v.float64(), minRebalanceInterval: v.float64(),
  expiresAt: v.float64(), source: v.string(),
};

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const permanentPositionError = (message: string) => /ERC721.*(?:invalid token|nonexistent|owner query)|ERC721NonexistentToken|Position custody changed|Guard policy disabled or changed/i.test(message);

function client() {
  const rpc = process.env.AGENT_RPC_URL || robinhood.rpcUrls.default.http[0];
  return createPublicClient({ chain: robinhood, transport: http(rpc, { timeout: 15_000, retryCount: 2 }) });
}

function configuredAddress(name: string, fallback: Address): Address {
  const value = process.env[name] || fallback;
  if (!isAddress(value)) throw new Error(`${name} is missing or invalid`);
  return value;
}

function expectedAgent(): Address {
  const value = process.env.AGENT_ADDRESS;
  if (!value || !isAddress(value)) throw new Error("AGENT_ADDRESS is not configured");
  return value;
}

async function readGuardPolicy(c: ReturnType<typeof client>, account: Address, token0: Address, token1: Address, fee: number) {
  const guard = configuredAddress("BTB_UNISWAP_V3_GUARD_4663", DEFAULT_GUARD);
  const key = await c.readContract({ address: guard, abi: guardAbi, functionName: "poolKey", args: [token0, token1, fee] });
  return c.readContract({ address: guard, abi: guardAbi, functionName: "poolPolicies", args: [account, key] });
}

export const register = action({
  args: registration,
  handler: async (ctx, args): Promise<void> => {
    if (args.chainId !== 4663 || args.source !== "universal-v5") throw new Error("Only universal Robinhood LP positions can be automated");
    const c = client();
    const tokenId = BigInt(args.positionId);
    const [accountOwner, nftOwner, position, policy, agent] = await Promise.all([
      c.readContract({ address: args.account as Address, abi: accountAbi, functionName: "owner" }),
      c.readContract({ address: args.positionManager as Address, abi: positionAbi, functionName: "ownerOf", args: [tokenId] }),
      c.readContract({ address: args.positionManager as Address, abi: positionAbi, functionName: "positions", args: [tokenId] }),
      readGuardPolicy(c, args.account as Address, args.token0 as Address, args.token1 as Address, args.fee),
      c.readContract({ address: args.account as Address, abi: accountAbi, functionName: "agents", args: [expectedAgent()] }),
    ]);
    if (!same(accountOwner, args.owner) || !same(nftOwner, args.account)) throw new Error("The owner/account/NFT relationship is invalid");
    if (!agent[2] || Number(agent[1]) * 1000 <= Date.now()) throw new Error("The BTB agent is not authorized on this account");
    if (
      !policy[16] || !same(policy[0], args.positionManager) || !same(policy[1], args.pool)
      || !same(policy[6], args.token0) || !same(policy[7], args.token1) || Number(policy[10]) !== args.fee
      || Number(policy[11]) !== args.targetTickWidth || Number(policy[12]) !== args.maxSlippageBps
      || Number(policy[13]) !== args.minimumAllowedTick || Number(policy[14]) !== args.maximumAllowedTick
      || Number(policy[15]) !== args.expiresAt || Number(position[5]) !== args.tickLower || Number(position[6]) !== args.tickUpper
    ) throw new Error("Saved position details do not match the owner-installed guard policy");
    await ctx.runMutation(internal.managedPositions.upsert, args);
  },
});

export const check = internalAction({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const rows = await ctx.runQuery(internal.managedPositions.due, { now, limit: 100 }) as DueRow[];
    for (const row of rows) {
      try {
        if (row.chainId !== 4663 || row.source !== "universal-v5") throw new Error("Legacy managed position retired");
        const c = client();
        const tokenId = BigInt(row.positionId);
        const [accountOwner, nftOwner, position, policy, slot0, paused, agent] = await Promise.all([
          c.readContract({ address: row.account as Address, abi: accountAbi, functionName: "owner" }),
          c.readContract({ address: row.positionManager as Address, abi: positionAbi, functionName: "ownerOf", args: [tokenId] }),
          c.readContract({ address: row.positionManager as Address, abi: positionAbi, functionName: "positions", args: [tokenId] }),
          readGuardPolicy(c, row.account as Address, row.token0 as Address, row.token1 as Address, row.fee),
          c.readContract({ address: row.pool as Address, abi: slot0Abi, functionName: "slot0" }),
          c.readContract({ address: row.account as Address, abi: accountAbi, functionName: "paused" }),
          c.readContract({ address: row.account as Address, abi: accountAbi, functionName: "agents", args: [expectedAgent()] }),
        ]);
        if (!same(accountOwner, row.owner) || !same(nftOwner, row.account)) throw new Error("Position custody changed");
        if (!policy[16] || !same(policy[0], row.positionManager) || !same(policy[1], row.pool)) throw new Error("Guard policy disabled or changed");
        const lower = Number(position[5]), upper = Number(position[6]), current = Number(slot0[1]);
        const expired = Number(policy[15]) * 1000 <= now || !agent[2] || Number(agent[1]) * 1000 <= now;
        const out = current < lower || current >= upper;
        const last = row.lastRebalanceAt ?? 0;
        const cooldownEnds = last + row.minRebalanceInterval * 1000;
        const coolingDown = last > 0 && cooldownEnds > now;
        const status = paused ? "paused" : expired ? "permission_expired" : out && coolingDown ? "out_of_range_cooldown" : out ? "rebalance_needed" : "in_range";
        const queued = await ctx.runMutation(internal.managedPositions.saveCheck, {
          key: row.key, tickLower: lower, tickUpper: upper, currentTick: current, status,
          enabled: !expired, nextCheckAt: coolingDown ? Math.min(now + 60_000, cooldownEnds) : now + 60_000,
          error: undefined, lastRebalanceAt: last || undefined,
          queueRebalance: out && !expired && !paused && !coolingDown,
        });
        if (queued) await ctx.scheduler.runAfter(0, internal.rebalanceWorker.run, {});
      } catch (error) {
        const message = error instanceof Error ? error.message.slice(0, 300) : "Verification failed";
        const retired = permanentPositionError(message) || message === "Legacy managed position retired";
        await ctx.runMutation(internal.managedPositions.saveCheck, {
          key: row.key, status: retired ? "retired" : "verification_error", enabled: !retired,
          nextCheckAt: retired ? now : now + 5 * 60_000, error: message, queueRebalance: false,
        });
      }
    }
  },
});
