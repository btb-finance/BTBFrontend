"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  createPublicClient, createWalletClient, encodeAbiParameters, encodeFunctionData, http, isAddress, keccak256,
  type Address, type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { defineChain } from "viem";
import { amountsForLiquidity, chooseRange, heavySide, liquidityForAmounts, planSwap } from "./rebalanceMath";

const robinhood = defineChain({
  id: 4663, name: "Robinhood Chain", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.mainnet.chain.robinhood.com/"] } },
});
const QUOTER = "0x33e885ed0ec9bf04ecfb19341582aadcb4c8a9e7" as const;
const ZERO = "0x0000000000000000000000000000000000000000" as const;

const POLICY_COMPONENTS = [
  { name: "enabled", type: "bool" }, { name: "agent", type: "address" },
  { name: "positionManager", type: "address" }, { name: "uniswapFactory", type: "address" },
  { name: "pool", type: "address" }, { name: "swapAdapter", type: "address" },
  { name: "priceGuard", type: "address" }, { name: "token0", type: "address" },
  { name: "token1", type: "address" }, { name: "positionId", type: "uint256" },
  { name: "fee", type: "uint24" }, { name: "targetTickWidth", type: "uint24" },
  { name: "performanceFeeBps", type: "uint16" }, { name: "maxSlippageBps", type: "uint16" },
  { name: "maxSwapBpsOfPosition", type: "uint16" }, { name: "maxSpotTwapDeviationBps", type: "uint16" },
  { name: "twapSeconds", type: "uint32" }, { name: "minRebalanceInterval", type: "uint32" },
  { name: "expiresAt", type: "uint64" }, { name: "minimumAllowedTick", type: "int24" },
  { name: "maximumAllowedTick", type: "int24" }, { name: "maximumToken0PerExecution", type: "uint128" },
  { name: "maximumToken1PerExecution", type: "uint128" },
] as const;
const REQUEST_COMPONENTS = [
  { name: "newTickLower", type: "int24" }, { name: "newTickUpper", type: "int24" },
  { name: "tokenIn", type: "address" }, { name: "tokenOut", type: "address" },
  { name: "amountIn", type: "uint256" }, { name: "quotedMinimumOut", type: "uint256" },
  { name: "removeAmount0Min", type: "uint256" }, { name: "removeAmount1Min", type: "uint256" },
  { name: "mintAmount0Min", type: "uint256" }, { name: "mintAmount1Min", type: "uint256" },
  { name: "deadline", type: "uint256" }, { name: "nonce", type: "uint256" },
] as const;
const ACCOUNT_ABI = [
  { name: "owner", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { name: "paused", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  { name: "nextNonce", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "feeBaseline", type: "function", stateMutability: "view", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [{ type: "uint128" }, { type: "uint128" }] },
  { name: "policy", type: "function", stateMutability: "view", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [{ name: "result", type: "tuple", components: POLICY_COMPONENTS }] },
  { name: "rebalance", type: "function", stateMutability: "nonpayable", inputs: [
    { name: "positionManager", type: "address" }, { name: "positionId", type: "uint256" },
    { name: "request", type: "tuple", components: REQUEST_COMPONENTS }, { name: "swapData", type: "bytes" },
  ], outputs: [{ name: "newPositionId", type: "uint256" }] },
] as const;
const POSITION_ABI = [
  { name: "ownerOf", type: "function", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "address" }] },
  { name: "positions", type: "function", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [
    { type: "uint96" }, { type: "address" }, { type: "address" }, { type: "address" }, { type: "uint24" },
    { type: "int24" }, { type: "int24" }, { type: "uint128" }, { type: "uint256" }, { type: "uint256" },
    { type: "uint128" }, { type: "uint128" },
  ] },
  { name: "collect", type: "function", stateMutability: "payable", inputs: [{ name: "params", type: "tuple", components: [
    { name: "tokenId", type: "uint256" }, { name: "recipient", type: "address" },
    { name: "amount0Max", type: "uint128" }, { name: "amount1Max", type: "uint128" },
  ] }], outputs: [{ type: "uint256" }, { type: "uint256" }] },
] as const;
const POOL_ABI = [
  { name: "slot0", type: "function", stateMutability: "view", inputs: [], outputs: [
    { type: "uint160" }, { type: "int24" }, { type: "uint16" }, { type: "uint16" },
    { type: "uint16" }, { type: "uint8" }, { type: "bool" },
  ] },
  { name: "tickSpacing", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "int24" }] },
] as const;
const QUOTER_ABI = [{
  name: "quoteExactInputSingle", type: "function", stateMutability: "nonpayable",
  inputs: [{ name: "params", type: "tuple", components: [
    { name: "tokenIn", type: "address" }, { name: "tokenOut", type: "address" },
    { name: "amountIn", type: "uint256" }, { name: "fee", type: "uint24" },
    { name: "sqrtPriceLimitX96", type: "uint160" },
  ] }], outputs: [{ type: "uint256" }, { type: "uint160" }, { type: "uint32" }, { type: "uint256" }],
}] as const;

type Policy = {
  enabled: boolean; agent: Address; positionManager: Address; pool: Address; token0: Address; token1: Address;
  positionId: bigint; fee: number; targetTickWidth: number; performanceFeeBps: number; maxSlippageBps: number;
  maxSwapBpsOfPosition: number; expiresAt: bigint; minimumAllowedTick: number; maximumAllowedTick: number;
  maximumToken0PerExecution: bigint; maximumToken1PerExecution: bigint;
};
type Job = { _id: Id<"rebalanceJobs">; positionKey: string; chainId: number; account: string; positionManager: string; positionId: string; state: string; attempts: number; txHash?: string; signedTransaction?: string; newPositionId?: string };
type Row = { key: string; owner: string; account: string; positionManager: string; positionId: string; pool: string };

class PolicyActionRequired extends Error {}
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const min = (a: bigint, b: bigint) => a < b ? a : b;
const protectedMinimum = (value: bigint, slippageBps: number) => value * BigInt(10_000 - slippageBps) / 10_000n;

function signer() {
  const raw = process.env.AGENT_PRIVATE_KEY ?? "";
  const key = (raw.startsWith("0x") ? raw : `0x${raw}`) as Hex;
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error("AGENT_PRIVATE_KEY is missing or invalid");
  const account = privateKeyToAccount(key);
  const expected = process.env.AGENT_ADDRESS;
  if (!expected || !isAddress(expected) || !same(account.address, expected)) throw new Error("Agent key does not match AGENT_ADDRESS");
  return account;
}

function clients() {
  const rpc = process.env.AGENT_RPC_URL || robinhood.rpcUrls.default.http[0];
  const transport = http(rpc, { timeout: 15_000, retryCount: 2 });
  const account = signer();
  return { account, publicClient: createPublicClient({ chain: robinhood, transport }), walletClient: createWalletClient({ account, chain: robinhood, transport }) };
}

function errorText(error: unknown) {
  const value = error as { shortMessage?: string; message?: string };
  return (value.shortMessage || value.message || "Rebalance worker failed").slice(0, 500);
}

export const run = internalAction({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const job = await ctx.runMutation(internal.managedPositions.claimNextJob, { now }) as Job | null;
    if (!job) return;
    try {
      if (job.chainId !== 4663 || process.env.AGENT_CHAIN_ID !== "4663") throw new PolicyActionRequired("Worker is not configured for this chain");
      const { account, publicClient, walletClient } = clients();

      if (job.txHash) {
        let receipt;
        try { receipt = await publicClient.getTransactionReceipt({ hash: job.txHash as Hex }); }
        catch {
          // The raw signed transaction is durable. Re-submitting the identical
          // bytes cannot create a second logical transaction or consume a new nonce.
          if (job.signedTransaction) {
            try { await publicClient.sendRawTransaction({ serializedTransaction: job.signedTransaction as Hex }); }
            catch { /* already known, temporarily rejected, or RPC unavailable */ }
          }
          return;
        }
        if (receipt.status !== "success") throw new Error("Broadcast rebalance transaction reverted");
        if (!job.newPositionId) throw new Error("Broadcast job is missing its replacement position ID");
        const row = await ctx.runQuery(internal.managedPositions.positionForJob, { key: job.positionKey }) as Row | null;
        if (row) {
          const position = await publicClient.readContract({ address: row.positionManager as Address, abi: POSITION_ABI, functionName: "positions", args: [BigInt(job.newPositionId)] });
          await ctx.runMutation(internal.managedPositions.completeJob, {
            jobId: job._id, oldKey: job.positionKey, newPositionId: job.newPositionId,
            tickLower: Number(position[5]), tickUpper: Number(position[6]), txHash: job.txHash, now,
          });
        }
        return;
      }

      const row = await ctx.runQuery(internal.managedPositions.positionForJob, { key: job.positionKey }) as Row | null;
      if (!row) {
        await ctx.runMutation(internal.managedPositions.skipJob, { jobId: job._id, positionKey: job.positionKey, status: "position_missing", now });
        return;
      }
      const manager = row.positionManager as Address;
      const accountAddress = row.account as Address;
      const tokenId = BigInt(row.positionId);
      const [owner, nftOwner, paused, policyRaw, position, slot0, spacingRaw, baseline, nonce] = await Promise.all([
        publicClient.readContract({ address: accountAddress, abi: ACCOUNT_ABI, functionName: "owner" }),
        publicClient.readContract({ address: manager, abi: POSITION_ABI, functionName: "ownerOf", args: [tokenId] }),
        publicClient.readContract({ address: accountAddress, abi: ACCOUNT_ABI, functionName: "paused" }),
        publicClient.readContract({ address: accountAddress, abi: ACCOUNT_ABI, functionName: "policy", args: [manager, tokenId] }),
        publicClient.readContract({ address: manager, abi: POSITION_ABI, functionName: "positions", args: [tokenId] }),
        publicClient.readContract({ address: row.pool as Address, abi: POOL_ABI, functionName: "slot0" }),
        publicClient.readContract({ address: row.pool as Address, abi: POOL_ABI, functionName: "tickSpacing" }),
        publicClient.readContract({ address: accountAddress, abi: ACCOUNT_ABI, functionName: "feeBaseline", args: [manager, tokenId] }),
        publicClient.readContract({ address: accountAddress, abi: ACCOUNT_ABI, functionName: "nextNonce" }),
      ]);
      const policy = policyRaw as Policy;
      if (!same(owner, row.owner) || !same(nftOwner, accountAddress)) throw new PolicyActionRequired("Position custody changed");
      if (!policy.enabled || paused) throw new PolicyActionRequired(paused ? "Automation is paused" : "Automation policy is disabled");
      if (!same(policy.agent, account.address) || !same(policy.positionManager, manager) || policy.positionId !== tokenId || !same(policy.pool, row.pool)) throw new PolicyActionRequired("On-chain policy no longer matches this worker");
      if (Number(policy.expiresAt) * 1000 <= now) throw new PolicyActionRequired("Automation permission expired");
      const currentTick = Number(slot0[1]);
      const oldLower = Number(position[5]), oldUpper = Number(position[6]);
      if (currentTick >= oldLower && currentTick < oldUpper) {
        await ctx.runMutation(internal.managedPositions.skipJob, { jobId: job._id, positionKey: job.positionKey, status: "in_range", now });
        return;
      }

      const sqrtPriceX96 = slot0[0];
      const liquidity = position[7];
      if (liquidity === 0n) throw new PolicyActionRequired("Position has no liquidity");
      const [principal0, principal1] = amountsForLiquidity(sqrtPriceX96, oldLower, oldUpper, liquidity);
      const collectPreview = await publicClient.simulateContract({
        account: accountAddress, address: manager, abi: POSITION_ABI, functionName: "collect",
        args: [{ tokenId, recipient: accountAddress, amount0Max: (1n << 128n) - 1n, amount1Max: (1n << 128n) - 1n }],
      });
      const fees = collectPreview.result as readonly [bigint, bigint];
      const earned0 = fees[0] > baseline[0] ? fees[0] - baseline[0] : 0n;
      const earned1 = fees[1] > baseline[1] ? fees[1] - baseline[1] : 0n;
      let budget0 = principal0 + fees[0] - earned0 * 1_000n / 10_000n;
      let budget1 = principal1 + fees[1] - earned1 * 1_000n / 10_000n;
      const side = heavySide(sqrtPriceX96, budget0, budget1);
      const range = chooseRange(currentTick, Number(spacingRaw), Number(policy.targetTickWidth), Number(policy.minimumAllowedTick), Number(policy.maximumAllowedTick), side);

      let tokenIn: Address = ZERO, tokenOut: Address = ZERO, amountIn = 0n, expectedOut = 0n, quotedMinimumOut = 0n;
      let swapData: Hex = "0x";
      const planned = planSwap(sqrtPriceX96, range.tickLower, range.tickUpper, budget0, budget1);
      if (planned.sellSide !== null && planned.amountIn > 0n) {
        const inputBudget = planned.sellSide === 0 ? budget0 : budget1;
        const percentageCap = inputBudget * BigInt(policy.maxSwapBpsOfPosition) / 10_000n;
        const absoluteCap = planned.sellSide === 0 ? policy.maximumToken0PerExecution : policy.maximumToken1PerExecution;
        amountIn = min(planned.amountIn, min(percentageCap, absoluteCap));
        if (amountIn > 0n) {
          tokenIn = planned.sellSide === 0 ? policy.token0 : policy.token1;
          tokenOut = planned.sellSide === 0 ? policy.token1 : policy.token0;
          const quote = await publicClient.simulateContract({ address: QUOTER, abi: QUOTER_ABI, functionName: "quoteExactInputSingle", args: [{ tokenIn, tokenOut, amountIn, fee: Number(policy.fee), sqrtPriceLimitX96: 0n }] });
          expectedOut = (quote.result as readonly [bigint, bigint, number, bigint])[0];
          quotedMinimumOut = protectedMinimum(expectedOut, Number(policy.maxSlippageBps));
          swapData = encodeAbiParameters([{ type: "uint24" }, { type: "uint160" }], [Number(policy.fee), 0n]);
          if (planned.sellSide === 0) { budget0 -= amountIn; budget1 += expectedOut; }
          else { budget1 -= amountIn; budget0 += expectedOut; }
        }
      }

      const replacementLiquidity = liquidityForAmounts(sqrtPriceX96, range.tickLower, range.tickUpper, budget0, budget1);
      if (replacementLiquidity === 0n) throw new PolicyActionRequired("Policy swap cap cannot fund a replacement position in the allowed range");
      const [mint0, mint1] = amountsForLiquidity(sqrtPriceX96, range.tickLower, range.tickUpper, replacementLiquidity);
      const deadline = BigInt(Math.floor(now / 1000) + 480);
      const request = {
        newTickLower: range.tickLower, newTickUpper: range.tickUpper, tokenIn, tokenOut, amountIn, quotedMinimumOut,
        removeAmount0Min: protectedMinimum(principal0, Number(policy.maxSlippageBps)),
        removeAmount1Min: protectedMinimum(principal1, Number(policy.maxSlippageBps)),
        mintAmount0Min: protectedMinimum(mint0, Number(policy.maxSlippageBps)),
        mintAmount1Min: protectedMinimum(mint1, Number(policy.maxSlippageBps)), deadline, nonce,
      };
      const data = encodeFunctionData({ abi: ACCOUNT_ABI, functionName: "rebalance", args: [manager, tokenId, request, swapData] });
      if (process.env.AGENT_EXECUTION_ENABLED !== "1") throw new PolicyActionRequired("Agent execution is disabled");
      const simulation = await publicClient.simulateContract({ account, address: accountAddress, abi: ACCOUNT_ABI, functionName: "rebalance", args: [manager, tokenId, request, swapData] });
      const gas = await publicClient.estimateGas({ account, to: accountAddress, data });
      const gasPrice = await publicClient.getGasPrice();
      const requiredGas = gas * gasPrice * 12n / 10n;
      if (await publicClient.getBalance({ address: account.address }) < requiredGas) throw new Error("Automation agent needs more native gas");
      const prepared = await walletClient.prepareTransactionRequest({ account, to: accountAddress, data, gas: gas * 12n / 10n });
      const signedTransaction = await walletClient.signTransaction(prepared);
      const txHash = keccak256(signedTransaction);
      await ctx.runMutation(internal.managedPositions.recordBroadcast, {
        jobId: job._id, txHash, signedTransaction, newPositionId: simulation.result.toString(), now: Date.now(),
      });
      try { await publicClient.sendRawTransaction({ serializedTransaction: signedTransaction }); }
      catch { /* The next worker run safely re-submits the exact signed bytes. */ }
      await ctx.scheduler.runAfter(3_000, internal.rebalanceWorker.run, {});
    } catch (error) {
      await ctx.runMutation(internal.managedPositions.failJob, {
        jobId: job._id, positionKey: job.positionKey, error: errorText(error), retryable: !(error instanceof PolicyActionRequired), now: Date.now(),
      });
    }
  },
});
