"use node";

import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { createPublicClient, http, type Address } from "viem";
import { defineChain } from "viem";
import { v } from "convex/values";

const robinhood = defineChain({ id: 4663, name: "Robinhood Chain", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: ["https://rpc.mainnet.chain.robinhood.com/"] } } });
const ethereum = defineChain({ id: 1, name: "Ethereum", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: ["https://ethereum.publicnode.com"] } } });
const ownerAbi = [{ name: "owner", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] }] as const;
const pausedAbi = [{ name: "paused", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] }] as const;
const ownerOfAbi = [{ name: "ownerOf", type: "function", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "address" }] }] as const;
const positionAbi = [{ name: "positions", type: "function", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [
  { type: "uint96" }, { type: "address" }, { type: "address" }, { type: "address" }, { type: "uint24" },
  { type: "int24" }, { type: "int24" }, { type: "uint128" }, { type: "uint256" }, { type: "uint256" }, { type: "uint128" }, { type: "uint128" },
] }] as const;
const slot0Abi = [{ name: "slot0", type: "function", stateMutability: "view", inputs: [], outputs: [
  { type: "uint160" }, { type: "int24" }, { type: "uint16" }, { type: "uint16" }, { type: "uint16" }, { type: "uint8" }, { type: "bool" },
] }] as const;
const policyAbi = [{ name: "policy", type: "function", stateMutability: "view", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [{ type: "tuple", components: [
  { name: "enabled", type: "bool" }, { name: "agent", type: "address" }, { name: "positionManager", type: "address" },
  { name: "uniswapFactory", type: "address" }, { name: "pool", type: "address" }, { name: "swapAdapter", type: "address" },
  { name: "priceGuard", type: "address" }, { name: "token0", type: "address" }, { name: "token1", type: "address" },
  { name: "positionId", type: "uint256" }, { name: "fee", type: "uint24" }, { name: "targetTickWidth", type: "uint24" },
  { name: "performanceFeeBps", type: "uint16" }, { name: "maxSlippageBps", type: "uint16" },
  { name: "maxSwapBpsOfPosition", type: "uint16" }, { name: "maxSpotTwapDeviationBps", type: "uint16" },
  { name: "twapSeconds", type: "uint32" }, { name: "minRebalanceInterval", type: "uint32" }, { name: "expiresAt", type: "uint64" },
  { name: "minimumAllowedTick", type: "int24" }, { name: "maximumAllowedTick", type: "int24" },
  { name: "maximumToken0PerExecution", type: "uint128" }, { name: "maximumToken1PerExecution", type: "uint128" },
] }] }] as const;
const policyKeyAbi = [{ name: "policyKey", type: "function", stateMutability: "pure", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [{ type: "bytes32" }] }] as const;
const lastRebalanceAbi = [{ name: "lastRebalanceAt", type: "function", stateMutability: "view", inputs: [{ type: "bytes32" }], outputs: [{ type: "uint64" }] }] as const;

type DueRow = { key: string; chainId: number; owner: string; account: string; positionManager: string; positionId: string; pool: string; expiresAt: number; minRebalanceInterval: number };

const registration = {
  chainId: v.float64(), owner: v.string(), account: v.string(), positionManager: v.string(),
  positionId: v.string(), pool: v.string(), token0: v.string(), token1: v.string(), fee: v.float64(),
  tickLower: v.float64(), tickUpper: v.float64(), targetTickWidth: v.float64(),
  minimumAllowedTick: v.float64(), maximumAllowedTick: v.float64(), maxSlippageBps: v.float64(),
  maxSwapBps: v.float64(), twapSeconds: v.float64(), minRebalanceInterval: v.float64(),
  expiresAt: v.float64(), source: v.string(),
};

function chainClient(chainId: number) {
  const chain = chainId === 4663 ? robinhood : chainId === 1 ? ethereum : null;
  if (!chain) throw new Error("Unsupported chain");
  return createPublicClient({ chain, transport: http(chain.rpcUrls.default.http[0], { timeout: 12_000, retryCount: 1 }) });
}

/** Public registration is accepted only after the action proves the complete
 * smart-account/NFT/policy relationship directly against the chain. */
export const register = action({
  args: registration,
  handler: async (ctx, args): Promise<void> => {
    const client = chainClient(args.chainId);
    const tokenId = BigInt(args.positionId);
    const [accountOwner, nftOwner, position, policy] = await Promise.all([
      client.readContract({ address: args.account as Address, abi: ownerAbi, functionName: "owner" }),
      client.readContract({ address: args.positionManager as Address, abi: ownerOfAbi, functionName: "ownerOf", args: [tokenId] }),
      client.readContract({ address: args.positionManager as Address, abi: positionAbi, functionName: "positions", args: [tokenId] }),
      client.readContract({ address: args.account as Address, abi: policyAbi, functionName: "policy", args: [args.positionManager as Address, tokenId] }),
    ]);
    const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
    if (!same(accountOwner, args.owner) || !same(nftOwner, args.account)) throw new Error("The wallet does not own this managed account/position");
    if (
      !policy.enabled || policy.positionId !== tokenId || !same(policy.positionManager, args.positionManager)
        || !same(policy.pool, args.pool) || !same(policy.token0, args.token0) || !same(policy.token1, args.token1)
        || Number(policy.fee) !== args.fee || Number(position[5]) !== args.tickLower || Number(position[6]) !== args.tickUpper
    ) throw new Error("Saved position details do not match the on-chain policy");
    await ctx.runMutation(internal.managedPositions.upsert, args);
  },
});

export const check = internalAction({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const rows = await ctx.runQuery(internal.managedPositions.due, { now, limit: 100 }) as DueRow[];
    for (const row of rows) {
      const nextCheckAt = now + 60_000;
      try {
        const client = chainClient(row.chainId);
        const tokenId = BigInt(row.positionId);
        const [accountOwner, nftOwner, position, policy, slot0, paused, keyHash] = await Promise.all([
          client.readContract({ address: row.account as Address, abi: ownerAbi, functionName: "owner" }),
          client.readContract({ address: row.positionManager as Address, abi: ownerOfAbi, functionName: "ownerOf", args: [tokenId] }),
          client.readContract({ address: row.positionManager as Address, abi: positionAbi, functionName: "positions", args: [tokenId] }),
          client.readContract({ address: row.account as Address, abi: policyAbi, functionName: "policy", args: [row.positionManager as Address, tokenId] }),
          client.readContract({ address: row.pool as Address, abi: slot0Abi, functionName: "slot0" }),
          client.readContract({ address: row.account as Address, abi: pausedAbi, functionName: "paused" }),
          client.readContract({ address: row.account as Address, abi: policyKeyAbi, functionName: "policyKey", args: [row.positionManager as Address, tokenId] }),
        ]);
        if (accountOwner.toLowerCase() !== row.owner || nftOwner.toLowerCase() !== row.account) throw new Error("Position custody changed");
        if (!policy.enabled || policy.positionId !== tokenId || policy.pool.toLowerCase() !== row.pool) throw new Error("Automation policy disabled or changed");
        const lower = Number(position[5]), upper = Number(position[6]), current = Number(slot0[1]);
        const last = Number(await client.readContract({ address: row.account as Address, abi: lastRebalanceAbi, functionName: "lastRebalanceAt", args: [keyHash] }));
        const expired = Number(policy.expiresAt) * 1000 <= now;
        const out = current < lower || current >= upper;
        const cooldownEnds = (last + Number(policy.minRebalanceInterval)) * 1000;
        const coolingDown = last > 0 && cooldownEnds > now;
        const status = paused ? "paused" : expired ? "permission_expired" : out && coolingDown ? "out_of_range_cooldown" : out ? "rebalance_needed" : "in_range";
        await ctx.runMutation(internal.managedPositions.saveCheck, {
          key: row.key, tickLower: lower, tickUpper: upper, currentTick: current, status,
          enabled: !expired, nextCheckAt: coolingDown ? Math.min(nextCheckAt, cooldownEnds) : nextCheckAt,
          error: undefined, lastRebalanceAt: last > 0 ? last * 1000 : undefined,
          queueRebalance: out && !expired && !paused && !coolingDown,
        });
      } catch (error) {
        await ctx.runMutation(internal.managedPositions.saveCheck, {
          key: row.key, status: "verification_error", enabled: true,
          nextCheckAt: now + 5 * 60_000, error: error instanceof Error ? error.message.slice(0, 300) : "Verification failed",
          queueRebalance: false,
        });
      }
    }
  },
});
