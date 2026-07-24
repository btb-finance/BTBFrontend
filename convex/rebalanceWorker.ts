"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  createPublicClient, createWalletClient, decodeEventLog, defineChain, encodeAbiParameters, encodeFunctionData,
  http, isAddress, keccak256, type Address, type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { amountsForLiquidity, chooseRange, heavySide } from "./rebalanceMath";

const robinhood = defineChain({
  id: 4663, name: "Robinhood Chain", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.mainnet.chain.robinhood.com/"] } },
});
const DEFAULT_GUARD = "0x32421Fc3E2c446B29847BBC06D4886549A303484" as const;
const DEFAULT_BTB_QUOTER = "0x249B56FB5FC527F0CfaAbEc418aCF5ccEd1652f6" as const;
const DEFAULT_KYBER_ROUTER = "0x6131B5fae19EA4f9D964eAc0408E4408b66337b5" as const;
const ZERO = "0x0000000000000000000000000000000000000000" as const;
const UINT128_MAX = (1n << 128n) - 1n;
const Q192 = 1n << 192n;

const STAGE_COMPONENTS = [
  { name: "approvals", type: "tuple[]", components: [{ name: "token", type: "address" }, { name: "spender", type: "address" }, { name: "amount", type: "uint256" }] },
  { name: "calls", type: "tuple[]", components: [{ name: "target", type: "address" }, { name: "value", type: "uint256" }, { name: "data", type: "bytes" }] },
  { name: "balanceRules", type: "tuple[]", components: [{ name: "token", type: "address" }, { name: "maximumSpend", type: "uint256" }, { name: "minimumReceive", type: "uint256" }] },
] as const;
const accountAbi = [
  { name: "owner", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { name: "paused", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  { name: "agents", type: "function", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "address" }, { type: "uint64" }, { type: "bool" }] },
  { name: "executeGuardedWorkflow", type: "function", stateMutability: "nonpayable", inputs: [
    { name: "guard", type: "address" }, { name: "stages", type: "tuple[]", components: STAGE_COMPONENTS }, { name: "guardData", type: "bytes" },
  ], outputs: [{ type: "bytes[][]" }] },
] as const;
const positionAbi = [
  { name: "ownerOf", type: "function", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "address" }] },
  { name: "positions", type: "function", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [
    { type: "uint96" }, { type: "address" }, { type: "address" }, { type: "address" }, { type: "uint24" },
    { type: "int24" }, { type: "int24" }, { type: "uint128" }, { type: "uint256" }, { type: "uint256" }, { type: "uint128" }, { type: "uint128" },
  ] },
  { name: "decreaseLiquidity", type: "function", stateMutability: "payable", inputs: [{ name: "params", type: "tuple", components: [
    { name: "tokenId", type: "uint256" }, { name: "liquidity", type: "uint128" }, { name: "amount0Min", type: "uint256" }, { name: "amount1Min", type: "uint256" }, { name: "deadline", type: "uint256" },
  ] }], outputs: [{ type: "uint256" }, { type: "uint256" }] },
  { name: "collect", type: "function", stateMutability: "payable", inputs: [{ name: "params", type: "tuple", components: [
    { name: "tokenId", type: "uint256" }, { name: "recipient", type: "address" }, { name: "amount0Max", type: "uint128" }, { name: "amount1Max", type: "uint128" },
  ] }], outputs: [{ type: "uint256" }, { type: "uint256" }] },
  { name: "burn", type: "function", stateMutability: "payable", inputs: [{ type: "uint256" }], outputs: [] },
  { name: "mint", type: "function", stateMutability: "payable", inputs: [{ name: "params", type: "tuple", components: [
    { name: "token0", type: "address" }, { name: "token1", type: "address" }, { name: "fee", type: "uint24" },
    { name: "tickLower", type: "int24" }, { name: "tickUpper", type: "int24" }, { name: "amount0Desired", type: "uint256" },
    { name: "amount1Desired", type: "uint256" }, { name: "amount0Min", type: "uint256" }, { name: "amount1Min", type: "uint256" },
    { name: "recipient", type: "address" }, { name: "deadline", type: "uint256" },
  ] }], outputs: [{ type: "uint256" }, { type: "uint128" }, { type: "uint256" }, { type: "uint256" }] },
  { name: "Transfer", type: "event", inputs: [{ name: "from", type: "address", indexed: true }, { name: "to", type: "address", indexed: true }, { name: "tokenId", type: "uint256", indexed: true }] },
] as const;
const poolAbi = [
  { name: "slot0", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint160" }, { type: "int24" }, { type: "uint16" }, { type: "uint16" }, { type: "uint16" }, { type: "uint8" }, { type: "bool" }] },
  { name: "tickSpacing", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "int24" }] },
] as const;
const guardAbi = [
  { name: "poolKey", type: "function", stateMutability: "pure", inputs: [{ type: "address" }, { type: "address" }, { type: "uint24" }], outputs: [{ type: "bytes32" }] },
  { name: "poolPolicies", type: "function", stateMutability: "view", inputs: [{ type: "address" }, { type: "bytes32" }], outputs: [
    { type: "address" }, { type: "address" }, { type: "address" }, { type: "bytes32" }, { type: "bytes4" }, { type: "bytes4" },
    { type: "address" }, { type: "address" }, { type: "uint128" }, { type: "uint128" }, { type: "uint24" }, { type: "uint24" },
    { type: "uint16" }, { type: "int24" }, { type: "int24" }, { type: "uint64" }, { type: "bool" },
  ] },
] as const;
const btbQuoterAbi = [
  { name: "previewSwapToRange", type: "function", stateMutability: "view", inputs: [{ type: "address" }, { type: "int24" }, { type: "int24" }, { type: "uint256" }, { type: "uint256" }], outputs: [{ name: "plan", type: "tuple", components: [{ name: "tokenIn", type: "address" }, { name: "tokenOut", type: "address" }, { name: "amountIn", type: "uint256" }, { name: "targetAmount0", type: "uint256" }, { name: "targetAmount1", type: "uint256" }] }] },
  { name: "previewMint", type: "function", stateMutability: "view", inputs: [{ type: "address" }, { type: "int24" }, { type: "int24" }, { type: "uint256" }, { type: "uint256" }], outputs: [{ type: "uint256" }, { type: "uint256" }, { type: "uint128" }] },
] as const;

type Approval = { token: Address; spender: Address; amount: bigint };
type WorkflowCall = { target: Address; value: bigint; data: Hex };
type BalanceRule = { token: Address; maximumSpend: bigint; minimumReceive: bigint };
type Stage = { approvals: Approval[]; calls: WorkflowCall[]; balanceRules: BalanceRule[] };
type Job = { _id: Id<"rebalanceJobs">; positionKey: string; chainId: number; account: string; positionManager: string; positionId: string; state: string; attempts: number; txHash?: string; signedTransaction?: string };
type Row = {
  key: string; owner: string; account: string; positionManager: string; positionId: string; pool: string; token0: string; token1: string;
  fee: number; targetTickWidth: number; minimumAllowedTick: number; maximumAllowedTick: number; maxSlippageBps: number; maxSwapBps: number;
  source: string;
};

class PolicyActionRequired extends Error {}
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const min = (a: bigint, b: bigint) => a < b ? a : b;
const protectedMinimum = (value: bigint, slippageBps: number) => value * BigInt(10_000 - slippageBps) / 10_000n;

function configuredAddress(name: string, fallback: Address): Address {
  const value = process.env[name] || fallback;
  if (!isAddress(value)) throw new Error(`${name} is missing or invalid`);
  return value;
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
  const transport = http(process.env.AGENT_RPC_URL || robinhood.rpcUrls.default.http[0], { timeout: 15_000, retryCount: 2 });
  const account = signer();
  return { account, publicClient: createPublicClient({ chain: robinhood, transport }), walletClient: createWalletClient({ account, chain: robinhood, transport }) };
}

function errorText(error: unknown) {
  const value = error as { shortMessage?: string; message?: string };
  return (value.shortMessage || value.message || "Rebalance worker failed").slice(0, 500);
}

function pairRules(token0: Address, token1: Address, spend0 = 0n, spend1 = 0n, receive0 = 0n, receive1 = 0n): BalanceRule[] {
  return [
    { token: token0, maximumSpend: spend0, minimumReceive: receive0 },
    { token: token1, maximumSpend: spend1, minimumReceive: receive1 },
  ];
}

function approvalKey(request: Approval) {
  return keccak256(encodeAbiParameters([{ type: "address" }, { type: "address" }], [request.token, request.spender]));
}

async function kyberSwapData(tokenIn: Address, tokenOut: Address, amountIn: bigint, sender: Address, slippageBps: number) {
  const routesUrl = `https://aggregator-api.kyberswap.com/robinhood/api/v1/routes?tokenIn=${tokenIn}&tokenOut=${tokenOut}&amountIn=${amountIn}&saveGas=0&gasInclude=1`;
  const routeResponse = await fetch(routesUrl, { headers: { "x-client-id": "btb-finance" } });
  const routeJson = await routeResponse.json() as { code?: number; message?: string; data?: { routerAddress?: string; routeSummary?: { amountOut?: string } } };
  if (!routeResponse.ok || routeJson.code !== 0 || !routeJson.data?.routeSummary) throw new Error(routeJson.message || "Kyber route unavailable");
  const router = configuredAddress("KYBER_ROUTER_4663", DEFAULT_KYBER_ROUTER);
  if (!routeJson.data.routerAddress || !same(routeJson.data.routerAddress, router)) throw new Error("Kyber returned an unapproved router");
  const expectedOut = BigInt(routeJson.data.routeSummary.amountOut || "0");
  const buildResponse = await fetch("https://aggregator-api.kyberswap.com/robinhood/api/v1/route/build", {
    method: "POST", headers: { "Content-Type": "application/json", "x-client-id": "btb-finance" },
    body: JSON.stringify({ routeSummary: routeJson.data.routeSummary, sender, recipient: sender, slippageTolerance: slippageBps }),
  });
  const buildJson = await buildResponse.json() as { code?: number; message?: string; data?: { data?: string; routerAddress?: string; value?: string } };
  const tx = buildJson.data;
  if (!buildResponse.ok || buildJson.code !== 0 || !tx?.data || !/^0x[0-9a-fA-F]+$/.test(tx.data)) throw new Error(buildJson.message || "Kyber build failed");
  if (!tx.routerAddress || !same(tx.routerAddress, router) || BigInt(tx.value || "0") !== 0n) throw new Error("Kyber returned an unsafe transaction");
  const selector = tx.data.slice(0, 10).toLowerCase();
  if (selector !== "0xe21fd0e9" && selector !== "0x8af033fb") throw new Error("Kyber returned an unapproved selector");
  return { router, expectedOut, data: tx.data as Hex };
}

async function readGuardPolicy(publicClient: ReturnType<typeof clients>["publicClient"], guard: Address, row: Row) {
  const key = await publicClient.readContract({ address: guard, abi: guardAbi, functionName: "poolKey", args: [row.token0 as Address, row.token1 as Address, row.fee] });
  return publicClient.readContract({ address: guard, abi: guardAbi, functionName: "poolPolicies", args: [row.account as Address, key] });
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
      const currentRow = await ctx.runQuery(internal.managedPositions.positionForJob, { key: job.positionKey }) as Row | null;
      if (!currentRow || currentRow.source !== "universal-v5") {
        await ctx.runMutation(internal.managedPositions.skipJob, {
          jobId: job._id, positionKey: job.positionKey, status: currentRow ? "retired" : "position_missing", now,
        });
        return;
      }

      if (job.txHash) {
        let receipt;
        try { receipt = await publicClient.getTransactionReceipt({ hash: job.txHash as Hex }); }
        catch {
          if (job.signedTransaction) {
            try { await publicClient.sendRawTransaction({ serializedTransaction: job.signedTransaction as Hex }); } catch { /* idempotent retry */ }
          }
          return;
        }
        if (receipt.status !== "success") throw new Error("Broadcast rebalance transaction reverted");
        const row = currentRow;
        if (row) {
          let confirmedPositionId: bigint | null = null;
          for (const log of receipt.logs) {
            if (!same(log.address, row.positionManager)) continue;
            try {
              const decoded = decodeEventLog({ abi: positionAbi, eventName: "Transfer", data: log.data, topics: log.topics });
              if (same(decoded.args.from, ZERO) && same(decoded.args.to, row.account)) confirmedPositionId = decoded.args.tokenId;
            } catch { /* unrelated manager log */ }
          }
          if (confirmedPositionId === null) throw new Error("Confirmed workflow receipt is missing the replacement NFT mint");
          const [position, nftOwner] = await Promise.all([
            publicClient.readContract({ address: row.positionManager as Address, abi: positionAbi, functionName: "positions", args: [confirmedPositionId] }),
            publicClient.readContract({ address: row.positionManager as Address, abi: positionAbi, functionName: "ownerOf", args: [confirmedPositionId] }),
          ]);
          if (!same(nftOwner, row.account)) throw new Error("Replacement NFT is not owned by the universal wallet");
          await ctx.runMutation(internal.managedPositions.completeJob, {
            jobId: job._id, oldKey: job.positionKey, newPositionId: confirmedPositionId.toString(),
            tickLower: Number(position[5]), tickUpper: Number(position[6]), txHash: job.txHash, now,
          });
        }
        return;
      }

      const row = currentRow;
      const manager = row.positionManager as Address;
      const accountAddress = row.account as Address;
      const token0 = row.token0 as Address, token1 = row.token1 as Address;
      const tokenId = BigInt(row.positionId);
      const guard = configuredAddress("BTB_UNISWAP_V3_GUARD_4663", DEFAULT_GUARD);
      const [owner, nftOwner, paused, agentPolicy, guardPolicy, position, slot0, spacingRaw] = await Promise.all([
        publicClient.readContract({ address: accountAddress, abi: accountAbi, functionName: "owner" }),
        publicClient.readContract({ address: manager, abi: positionAbi, functionName: "ownerOf", args: [tokenId] }),
        publicClient.readContract({ address: accountAddress, abi: accountAbi, functionName: "paused" }),
        publicClient.readContract({ address: accountAddress, abi: accountAbi, functionName: "agents", args: [account.address] }),
        readGuardPolicy(publicClient, guard, row),
        publicClient.readContract({ address: manager, abi: positionAbi, functionName: "positions", args: [tokenId] }),
        publicClient.readContract({ address: row.pool as Address, abi: poolAbi, functionName: "slot0" }),
        publicClient.readContract({ address: row.pool as Address, abi: poolAbi, functionName: "tickSpacing" }),
      ]);
      if (!same(owner, row.owner) || !same(nftOwner, accountAddress)) throw new PolicyActionRequired("Position custody changed");
      if (paused || !agentPolicy[2] || Number(agentPolicy[1]) * 1000 <= now) throw new PolicyActionRequired(paused ? "Automation is paused" : "Agent permission expired");
      if (!guardPolicy[16] || !same(guardPolicy[0], manager) || !same(guardPolicy[1], row.pool) || !same(guardPolicy[6], token0) || !same(guardPolicy[7], token1)) throw new PolicyActionRequired("Owner guard policy changed");
      const currentTick = Number(slot0[1]);
      const oldLower = Number(position[5]), oldUpper = Number(position[6]);
      if (currentTick >= oldLower && currentTick < oldUpper) {
        await ctx.runMutation(internal.managedPositions.skipJob, { jobId: job._id, positionKey: job.positionKey, status: "in_range", now });
        return;
      }

      const sqrtPriceX96 = slot0[0], liquidity = position[7];
      if (liquidity === 0n) throw new PolicyActionRequired("Position has no liquidity");
      const [principal0, principal1] = amountsForLiquidity(sqrtPriceX96, oldLower, oldUpper, liquidity);
      const collectPreview = await publicClient.simulateContract({ account: accountAddress, address: manager, abi: positionAbi, functionName: "collect", args: [{ tokenId, recipient: accountAddress, amount0Max: UINT128_MAX, amount1Max: UINT128_MAX }] });
      const fees = collectPreview.result as readonly [bigint, bigint];
      let budget0 = principal0 + fees[0], budget1 = principal1 + fees[1];
      const side = heavySide(sqrtPriceX96, budget0, budget1);
      const range = chooseRange(currentTick, Number(spacingRaw), row.targetTickWidth, row.minimumAllowedTick, row.maximumAllowedTick, side);

      const quoter = configuredAddress("BTB_LP_QUOTER_4663", DEFAULT_BTB_QUOTER);
      const planned = await publicClient.readContract({ address: quoter, abi: btbQuoterAbi, functionName: "previewSwapToRange", args: [row.pool as Address, range.tickLower, range.tickUpper, budget0, budget1] });
      let swap: { router: Address; tokenIn: Address; tokenOut: Address; amountIn: bigint; minimumOut: bigint; data: Hex } | null = null;
      const sellSide = same(planned.tokenIn, token0) ? 0 : same(planned.tokenIn, token1) ? 1 : null;
      if (sellSide !== null && planned.amountIn > 0n) {
        const inputBudget = sellSide === 0 ? budget0 : budget1;
        const percentageCap = inputBudget * BigInt(row.maxSwapBps) / 10_000n;
        const absoluteCap = sellSide === 0 ? guardPolicy[8] : guardPolicy[9];
        const amountIn = min(planned.amountIn, min(percentageCap, absoluteCap));
        if (amountIn > 0n) {
          const tokenIn = sellSide === 0 ? token0 : token1;
          const tokenOut = sellSide === 0 ? token1 : token0;
          const built = await kyberSwapData(tokenIn, tokenOut, amountIn, accountAddress, row.maxSlippageBps);
          const minimumOut = protectedMinimum(built.expectedOut, row.maxSlippageBps);
          if (minimumOut === 0n) throw new PolicyActionRequired("Protected swap output is too small");
          swap = { ...built, tokenIn, tokenOut, amountIn, minimumOut };
          if (sellSide === 0) { budget0 -= amountIn; budget1 += minimumOut; } else { budget1 -= amountIn; budget0 += minimumOut; }
        }
      }

      const [mint0, mint1, replacementLiquidity] = await publicClient.readContract({ address: quoter, abi: btbQuoterAbi, functionName: "previewMint", args: [row.pool as Address, range.tickLower, range.tickUpper, budget0, budget1] });
      if (replacementLiquidity < 1_000n || (mint0 === 0n && mint1 === 0n)) throw new PolicyActionRequired("Position is too small to rebalance safely");
      const sqrtSquared = sqrtPriceX96 * sqrtPriceX96;
      const totalValue = budget0 * sqrtSquared + budget1 * Q192;
      const idleValue = (budget0 - mint0) * sqrtSquared + (budget1 - mint1) * Q192;
      if (totalValue === 0n || idleValue * 10_000n > totalValue * 2_500n) throw new PolicyActionRequired("Swap cap leaves too much capital outside the replacement range");

      const deadline = BigInt(Math.floor(now / 1000) + 480);
      const stages: Stage[] = [{
        approvals: [],
        calls: [
          { target: manager, value: 0n, data: encodeFunctionData({ abi: positionAbi, functionName: "decreaseLiquidity", args: [{ tokenId, liquidity, amount0Min: protectedMinimum(principal0, row.maxSlippageBps), amount1Min: protectedMinimum(principal1, row.maxSlippageBps), deadline }] }) },
          { target: manager, value: 0n, data: encodeFunctionData({ abi: positionAbi, functionName: "collect", args: [{ tokenId, recipient: accountAddress, amount0Max: UINT128_MAX, amount1Max: UINT128_MAX }] }) },
          { target: manager, value: 0n, data: encodeFunctionData({ abi: positionAbi, functionName: "burn", args: [tokenId] }) },
        ],
        balanceRules: pairRules(token0, token1),
      }];
      if (swap) {
        stages.push({
          approvals: [{ token: swap.tokenIn, spender: swap.router, amount: swap.amountIn }],
          calls: [{ target: swap.router, value: 0n, data: swap.data }],
          balanceRules: same(swap.tokenIn, token0)
            ? pairRules(token0, token1, swap.amountIn, 0n, 0n, swap.minimumOut)
            : pairRules(token0, token1, 0n, swap.amountIn, swap.minimumOut, 0n),
        });
      }
      const mintApprovals: Approval[] = [];
      if (mint0 > 0n) mintApprovals.push({ token: token0, spender: manager, amount: mint0 });
      if (mint1 > 0n) mintApprovals.push({ token: token1, spender: manager, amount: mint1 });
      mintApprovals.sort((a, b) => approvalKey(a).localeCompare(approvalKey(b)));
      stages.push({
        approvals: mintApprovals,
        calls: [{ target: manager, value: 0n, data: encodeFunctionData({ abi: positionAbi, functionName: "mint", args: [{ token0, token1, fee: row.fee, tickLower: range.tickLower, tickUpper: range.tickUpper, amount0Desired: mint0, amount1Desired: mint1, amount0Min: protectedMinimum(mint0, row.maxSlippageBps), amount1Min: protectedMinimum(mint1, row.maxSlippageBps), recipient: accountAddress, deadline }] }) }],
        balanceRules: pairRules(token0, token1, mint0, mint1),
      });

      const guardData = encodeAbiParameters([{ type: "address" }, { type: "address" }, { type: "uint24" }, { type: "uint256" }], [token0, token1, row.fee, tokenId]);
      const data = encodeFunctionData({ abi: accountAbi, functionName: "executeGuardedWorkflow", args: [guard, stages, guardData] });
      if (process.env.AGENT_EXECUTION_ENABLED !== "1") throw new PolicyActionRequired("Agent execution is disabled");
      await publicClient.simulateContract({ account, address: accountAddress, abi: accountAbi, functionName: "executeGuardedWorkflow", args: [guard, stages, guardData] });
      const gas = await publicClient.estimateGas({ account, to: accountAddress, data });
      const requiredGas = gas * (await publicClient.getGasPrice()) * 12n / 10n;
      if (await publicClient.getBalance({ address: account.address }) < requiredGas) throw new Error("Automation agent needs more native gas");
      const prepared = await walletClient.prepareTransactionRequest({ account, to: accountAddress, data, gas: gas * 12n / 10n });
      const signedTransaction = await walletClient.signTransaction(prepared);
      const txHash = keccak256(signedTransaction);
      await ctx.runMutation(internal.managedPositions.recordBroadcast, { jobId: job._id, txHash, signedTransaction, newPositionId: "0", now: Date.now() });
      try { await publicClient.sendRawTransaction({ serializedTransaction: signedTransaction }); } catch { /* durable exact-byte retry */ }
      await ctx.scheduler.runAfter(3_000, internal.rebalanceWorker.run, {});
    } catch (error) {
      await ctx.runMutation(internal.managedPositions.failJob, {
        jobId: job._id, positionKey: job.positionKey, error: errorText(error), retryable: !(error instanceof PolicyActionRequired), now: Date.now(),
      });
    }
  },
});
