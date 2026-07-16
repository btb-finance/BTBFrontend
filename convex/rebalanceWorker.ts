"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  createPublicClient, createWalletClient, encodeAbiParameters, encodeFunctionData, http, isAddress, keccak256,
  parseEventLogs,
  type Address, type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { defineChain } from "viem";
import { amountsForLiquidity, chooseRange, heavySide } from "./rebalanceMath";

const robinhood = defineChain({
  id: 4663, name: "Robinhood Chain", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.mainnet.chain.robinhood.com/"] } },
});
const UNISWAP_QUOTER = "0x33e885ed0ec9bf04ecfb19341582aadcb4c8a9e7" as const;
const UNISWAP_ROUTER = "0xCaf681a66D020601342297493863E78C959E5cb2" as const;
const DEFAULT_BTB_QUOTER = "0x249B56FB5FC527F0CfaAbEc418aCF5ccEd1652f6" as const;
const DEFAULT_AGGREGATOR_ADAPTER = "0x2aC7b3da0AD46ff72C897267C01f7B1A221461dc" as const;
const DEFAULT_KYBER_ROUTER = "0x6131B5fae19EA4f9D964eAc0408E4408b66337b5" as const;
const ZERO = "0x0000000000000000000000000000000000000000" as const;
const Q192 = 1n << 192n;

const POLICY_COMPONENTS = [
  { name: "enabled", type: "bool" }, { name: "agent", type: "address" },
  { name: "positionManager", type: "address" }, { name: "uniswapFactory", type: "address" },
  { name: "pool", type: "address" }, { name: "swapAdapter", type: "address" },
  { name: "priceGuard", type: "address" }, { name: "token0", type: "address" },
  { name: "token1", type: "address" }, { name: "positionId", type: "uint256" },
  { name: "fee", type: "uint24" }, { name: "targetTickWidth", type: "uint24" },
  { name: "performanceFeeBps", type: "uint16" }, { name: "maxSlippageBps", type: "uint16" },
  { name: "maxSwapBpsOfPosition", type: "uint16" }, { name: "maxSpotTwapDeviationBps", type: "uint16" },
  { name: "maxIdleBps", type: "uint16" },
  { name: "twapSeconds", type: "uint32" }, { name: "minRebalanceInterval", type: "uint32" },
  { name: "expiresAt", type: "uint64" }, { name: "minimumAllowedTick", type: "int24" },
  { name: "maximumAllowedTick", type: "int24" }, { name: "maximumToken0PerExecution", type: "uint128" },
  { name: "maximumToken1PerExecution", type: "uint128" },
] as const;
const LEGACY_POLICY_COMPONENTS = POLICY_COMPONENTS.filter(component => component.name !== "maxIdleBps");
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
  { name: "PositionRebalanced", type: "event", inputs: [
    { name: "oldPositionId", type: "uint256", indexed: true },
    { name: "newPositionId", type: "uint256", indexed: true },
    { name: "agent", type: "address", indexed: true },
    { name: "tokenIn", type: "address", indexed: false },
    { name: "tokenOut", type: "address", indexed: false },
    { name: "amountIn", type: "uint256", indexed: false },
    { name: "amountOut", type: "uint256", indexed: false },
    { name: "tickLower", type: "int24", indexed: false },
    { name: "tickUpper", type: "int24", indexed: false },
    { name: "liquidity", type: "uint128", indexed: false },
  ] },
] as const;
const LEGACY_POLICY_ABI = [{
  name: "policy", type: "function", stateMutability: "view",
  inputs: [{ type: "address" }, { type: "uint256" }],
  outputs: [{ name: "result", type: "tuple", components: LEGACY_POLICY_COMPONENTS }],
}] as const;
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
const ROUTER_ABI = [{
  name: "exactInputSingle", type: "function", stateMutability: "payable",
  inputs: [{ name: "params", type: "tuple", components: [
    { name: "tokenIn", type: "address" }, { name: "tokenOut", type: "address" },
    { name: "fee", type: "uint24" }, { name: "recipient", type: "address" },
    { name: "amountIn", type: "uint256" }, { name: "amountOutMinimum", type: "uint256" },
    { name: "sqrtPriceLimitX96", type: "uint160" },
  ] }], outputs: [{ type: "uint256" }],
}] as const;
const BTB_QUOTER_ABI = [
  {
    name: "previewSwapToRange", type: "function", stateMutability: "view",
    inputs: [{ type: "address" }, { type: "int24" }, { type: "int24" }, { type: "uint256" }, { type: "uint256" }],
    outputs: [{ name: "plan", type: "tuple", components: [
      { name: "tokenIn", type: "address" }, { name: "tokenOut", type: "address" },
      { name: "amountIn", type: "uint256" }, { name: "targetAmount0", type: "uint256" },
      { name: "targetAmount1", type: "uint256" },
    ] }],
  },
  {
    name: "previewMint", type: "function", stateMutability: "view",
    inputs: [{ type: "address" }, { type: "int24" }, { type: "int24" }, { type: "uint256" }, { type: "uint256" }],
    outputs: [{ name: "amount0", type: "uint256" }, { name: "amount1", type: "uint256" }, { name: "liquidity", type: "uint128" }],
  },
] as const;

type Policy = {
  enabled: boolean; agent: Address; positionManager: Address; pool: Address; swapAdapter: Address; token0: Address; token1: Address;
  positionId: bigint; fee: number; targetTickWidth: number; performanceFeeBps: number; maxSlippageBps: number;
  maxSwapBpsOfPosition: number; maxIdleBps: number; expiresAt: bigint; minimumAllowedTick: number; maximumAllowedTick: number;
  maximumToken0PerExecution: bigint; maximumToken1PerExecution: bigint;
};
type Job = { _id: Id<"rebalanceJobs">; positionKey: string; chainId: number; account: string; positionManager: string; positionId: string; state: string; attempts: number; txHash?: string; signedTransaction?: string; newPositionId?: string };
type Row = { key: string; owner: string; account: string; positionManager: string; positionId: string; pool: string };

class PolicyActionRequired extends Error {}
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const min = (a: bigint, b: bigint) => a < b ? a : b;
const protectedMinimum = (value: bigint, slippageBps: number) => value * BigInt(10_000 - slippageBps) / 10_000n;

function configuredAddress(name: string, fallback: Address): Address {
  const value = process.env[name] || fallback;
  if (!isAddress(value)) throw new Error(`${name} is missing or invalid`);
  return value;
}

async function kyberSwapData(tokenIn: Address, tokenOut: Address, amountIn: bigint, minimumOut: bigint, adapter: Address, slippageBps: number) {
  const routesUrl = `https://aggregator-api.kyberswap.com/robinhood/api/v1/routes?tokenIn=${tokenIn}&tokenOut=${tokenOut}&amountIn=${amountIn}&saveGas=0&gasInclude=1`;
  const routeResponse = await fetch(routesUrl, { headers: { "x-client-id": "btb-finance" } });
  const routeJson = await routeResponse.json() as { code?: number; message?: string; data?: { routerAddress?: string; routeSummary?: { amountOut?: string } } };
  if (!routeResponse.ok || routeJson.code !== 0 || !routeJson.data?.routeSummary) throw new Error(routeJson.message || "Kyber route unavailable");
  const kyberRouter = configuredAddress("KYBER_ROUTER_4663", DEFAULT_KYBER_ROUTER);
  if (!routeJson.data.routerAddress || !same(routeJson.data.routerAddress, kyberRouter)) throw new Error("Kyber returned an unapproved router");
  const routeOut = BigInt(routeJson.data.routeSummary.amountOut || "0");
  if (routeOut < minimumOut) throw new Error("Kyber quote is below the protected minimum");
  const buildResponse = await fetch("https://aggregator-api.kyberswap.com/robinhood/api/v1/route/build", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-client-id": "btb-finance" },
    body: JSON.stringify({ routeSummary: routeJson.data.routeSummary, sender: adapter, recipient: adapter, slippageTolerance: slippageBps }),
  });
  const buildJson = await buildResponse.json() as { code?: number; message?: string; data?: { data?: string; routerAddress?: string; value?: string } };
  const tx = buildJson.data;
  if (!buildResponse.ok || buildJson.code !== 0 || !tx?.data || !/^0x[0-9a-fA-F]+$/.test(tx.data)) throw new Error(buildJson.message || "Kyber build failed");
  if (!tx.routerAddress || !same(tx.routerAddress, kyberRouter) || BigInt(tx.value || "0") !== 0n) throw new Error("Kyber returned an unsafe transaction");
  const selector = tx.data.slice(0, 10).toLowerCase();
  if (selector !== "0xe21fd0e9" && selector !== "0x8af033fb") throw new Error("Kyber returned an unapproved selector");
  return { expectedOut: routeOut, swapData: encodeAbiParameters([{ type: "address" }, { type: "bytes" }], [kyberRouter, tx.data as Hex]) };
}

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

async function readPolicy(
  publicClient: ReturnType<typeof clients>["publicClient"], account: Address, manager: Address, tokenId: bigint,
): Promise<Policy> {
  try {
    return await publicClient.readContract({ address: account, abi: ACCOUNT_ABI, functionName: "policy", args: [manager, tokenId] }) as Policy;
  } catch {
    const legacy = await publicClient.readContract({ address: account, abi: LEGACY_POLICY_ABI, functionName: "policy", args: [manager, tokenId] });
    return { ...legacy, maxIdleBps: 10_000 } as Policy;
  }
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
        const row = await ctx.runQuery(internal.managedPositions.positionForJob, { key: job.positionKey }) as Row | null;
        if (row) {
          // A simulated mint ID is only a hint: other users may mint between
          // simulation and inclusion. The confirmed event is the canonical ID.
          const event = parseEventLogs({ abi: ACCOUNT_ABI, logs: receipt.logs, eventName: "PositionRebalanced", strict: false })
            .find(log => same(log.address, row.account) && log.args.oldPositionId === BigInt(job.positionId));
          if (!event || event.args.newPositionId === undefined) {
            throw new Error("Confirmed rebalance receipt is missing PositionRebalanced");
          }
          const confirmedPositionId = event.args.newPositionId;
          const [position, nftOwner] = await Promise.all([
            publicClient.readContract({ address: row.positionManager as Address, abi: POSITION_ABI, functionName: "positions", args: [confirmedPositionId] }),
            publicClient.readContract({ address: row.positionManager as Address, abi: POSITION_ABI, functionName: "ownerOf", args: [confirmedPositionId] }),
          ]);
          if (!same(nftOwner, row.account)) throw new Error("Confirmed replacement NFT is not owned by the managed account");
          await ctx.runMutation(internal.managedPositions.completeJob, {
            jobId: job._id, oldKey: job.positionKey, newPositionId: confirmedPositionId.toString(),
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
        readPolicy(publicClient, accountAddress, manager, tokenId),
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

      const btbQuoter = configuredAddress("BTB_LP_QUOTER_4663", DEFAULT_BTB_QUOTER);
      const aggregatorAdapter = configuredAddress("BTB_AGGREGATOR_ADAPTER_4663", DEFAULT_AGGREGATOR_ADAPTER);
      let tokenIn: Address = ZERO, tokenOut: Address = ZERO, amountIn = 0n, expectedOut = 0n, quotedMinimumOut = 0n;
      let swapData: Hex = "0x";
      const planned = await publicClient.readContract({
        address: btbQuoter, abi: BTB_QUOTER_ABI, functionName: "previewSwapToRange",
        args: [policy.pool, range.tickLower, range.tickUpper, budget0, budget1],
      });
      const sellSide = same(planned.tokenIn, policy.token0) ? 0 : same(planned.tokenIn, policy.token1) ? 1 : null;
      if (sellSide !== null && planned.amountIn > 0n) {
        const inputBudget = sellSide === 0 ? budget0 : budget1;
        const percentageCap = inputBudget * BigInt(policy.maxSwapBpsOfPosition) / 10_000n;
        const absoluteCap = sellSide === 0 ? policy.maximumToken0PerExecution : policy.maximumToken1PerExecution;
        amountIn = min(planned.amountIn, min(percentageCap, absoluteCap));
        if (amountIn > 0n) {
          tokenIn = sellSide === 0 ? policy.token0 : policy.token1;
          tokenOut = sellSide === 0 ? policy.token1 : policy.token0;
          if (same(policy.swapAdapter, aggregatorAdapter)) {
            try {
              const kyber = await kyberSwapData(tokenIn, tokenOut, amountIn, 0n, aggregatorAdapter, Number(policy.maxSlippageBps));
              expectedOut = kyber.expectedOut;
              swapData = kyber.swapData;
            } catch {
              const quote = await publicClient.simulateContract({ address: UNISWAP_QUOTER, abi: QUOTER_ABI, functionName: "quoteExactInputSingle", args: [{ tokenIn, tokenOut, amountIn, fee: Number(policy.fee), sqrtPriceLimitX96: 0n }] });
              expectedOut = (quote.result as readonly [bigint, bigint, number, bigint])[0];
              const routerData = encodeFunctionData({ abi: ROUTER_ABI, functionName: "exactInputSingle", args: [{ tokenIn, tokenOut, fee: Number(policy.fee), recipient: aggregatorAdapter, amountIn, amountOutMinimum: protectedMinimum(expectedOut, Number(policy.maxSlippageBps)), sqrtPriceLimitX96: 0n }] });
              swapData = encodeAbiParameters([{ type: "address" }, { type: "bytes" }], [UNISWAP_ROUTER, routerData]);
            }
          } else {
            const quote = await publicClient.simulateContract({ address: UNISWAP_QUOTER, abi: QUOTER_ABI, functionName: "quoteExactInputSingle", args: [{ tokenIn, tokenOut, amountIn, fee: Number(policy.fee), sqrtPriceLimitX96: 0n }] });
            expectedOut = (quote.result as readonly [bigint, bigint, number, bigint])[0];
            swapData = encodeAbiParameters([{ type: "uint24" }, { type: "uint160" }], [Number(policy.fee), 0n]);
          }
          if (expectedOut === 0n) throw new PolicyActionRequired("The protected swap output is too small to rebalance");
          quotedMinimumOut = protectedMinimum(expectedOut, Number(policy.maxSlippageBps));
          if (sellSide === 0) { budget0 -= amountIn; budget1 += expectedOut; }
          else { budget1 -= amountIn; budget0 += expectedOut; }
        }
      }

      const mintPreview = await publicClient.readContract({
        address: btbQuoter, abi: BTB_QUOTER_ABI, functionName: "previewMint",
        args: [policy.pool, range.tickLower, range.tickUpper, budget0, budget1],
      });
      const [mint0, mint1, replacementLiquidity] = mintPreview;
      if (replacementLiquidity < 1_000n || (mint0 === 0n && mint1 === 0n)) throw new PolicyActionRequired("The position is too small to rebalance safely");
      const sqrtSquared = sqrtPriceX96 * sqrtPriceX96;
      const totalValue = budget0 * sqrtSquared + budget1 * Q192;
      const idleValue = (budget0 - mint0) * sqrtSquared + (budget1 - mint1) * Q192;
      if (totalValue === 0n || idleValue * 10_000n > totalValue * BigInt(policy.maxIdleBps)) {
        throw new PolicyActionRequired("The swap cap would leave too much capital outside the replacement range");
      }
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
