"use node";

import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import {
  createPublicClient, createWalletClient, defineChain, encodeAbiParameters, encodeFunctionData, encodePacked,
  http, isAddress, keccak256, parseEventLogs, zeroAddress, type Address, type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const robinhood = defineChain({
  id: 4663, name: "Robinhood Chain", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.mainnet.chain.robinhood.com/"] } },
});
const DEFAULT_REGISTRY = "0x3fD9F511fd3E244CF8566E8B52D26E539f6c02aF" as const;
const DEFAULT_ADAPTER = "0x2aC7b3da0AD46ff72C897267C01f7B1A221461dc" as const;
const DEFAULT_FACTORY = "0x1f7d7550B1b028f7571E69A784071F0205FD2EfA" as const;
const DEFAULT_WETH = "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73" as const;
const DEFAULT_KYBER_ROUTER = "0x6131B5fae19EA4f9D964eAc0408E4408b66337b5" as const;
const FEES = [100, 500, 3_000, 10_000] as const;

const TRADE_POLICY_COMPONENTS = [
  { name: "enabled", type: "bool" }, { name: "agent", type: "address" },
  { name: "requestKeyHash", type: "bytes32" }, { name: "maximumBalanceBpsPerTrade", type: "uint16" },
  { name: "maximumSlippageBps", type: "uint16" }, { name: "maximumSpotTwapDeviationBps", type: "uint16" },
  { name: "minimumTwapSeconds", type: "uint32" }, { name: "expiresAt", type: "uint64" },
] as const;
const SWAP_REQUEST_COMPONENTS = [
  { name: "account", type: "address" }, { name: "fundingToken", type: "address" },
  { name: "fundingAmount", type: "uint256" }, { name: "tokenOut", type: "address" },
  { name: "quotedMinimumOut", type: "uint256" }, { name: "path", type: "bytes" },
  { name: "twapSeconds", type: "uint32" }, { name: "maxSlippageBps", type: "uint16" },
  { name: "maxSpotTwapDeviationBps", type: "uint16" },
] as const;
const REGISTRY_ABI = [
  { name: "tradePolicies", type: "function", stateMutability: "view", inputs: [{ type: "address" }], outputs: TRADE_POLICY_COMPONENTS },
  { name: "agentRoles", type: "function", stateMutability: "view", inputs: [{ type: "address" }, { type: "address" }], outputs: [{ type: "uint8" }] },
  { name: "executeTrade", type: "function", stateMutability: "nonpayable", inputs: [{ name: "request", type: "tuple", components: SWAP_REQUEST_COMPONENTS }, { name: "swapData", type: "bytes" }], outputs: [{ type: "uint256" }, { type: "uint256" }, { type: "uint256" }] },
  { name: "TradeExecuted", type: "event", inputs: [
    { name: "account", type: "address", indexed: true }, { name: "agent", type: "address", indexed: true },
    { name: "tokenIn", type: "address", indexed: true }, { name: "tokenOut", type: "address", indexed: false },
    { name: "amountIn", type: "uint256", indexed: false }, { name: "grossAmountOut", type: "uint256", indexed: false },
    { name: "protocolFee", type: "uint256", indexed: false }, { name: "netAmountOut", type: "uint256", indexed: false },
  ] },
] as const;
const FACTORY_ABI = [{ name: "getPool", type: "function", stateMutability: "view", inputs: [{ type: "address" }, { type: "address" }, { type: "uint24" }], outputs: [{ type: "address" }] }] as const;
const POOL_ABI = [{ name: "liquidity", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint128" }] }] as const;
const ADAPTER_ABI = [
  { name: "allowedRouter", type: "function", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "bool" }] },
  { name: "allowedSelector", type: "function", stateMutability: "view", inputs: [{ type: "address" }, { type: "bytes4" }], outputs: [{ type: "bool" }] },
] as const;
const ERC20_BALANCE_ABI = [
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

type TradePolicy = {
  enabled: boolean; agent: Address; requestKeyHash: Hex; maximumBalanceBpsPerTrade: number;
  maximumSlippageBps: number; maximumSpotTwapDeviationBps: number; minimumTwapSeconds: number; expiresAt: bigint;
};

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const configuredAddress = (name: string, fallback: Address): Address => {
  const value = process.env[name] || fallback;
  if (!isAddress(value)) throw new Error(`${name} is missing or invalid`);
  return value;
};

function signer() {
  const raw = process.env.AGENT_PRIVATE_KEY ?? "";
  const key = (raw.startsWith("0x") ? raw : `0x${raw}`) as Hex;
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error("Agent signing key is not configured");
  const account = privateKeyToAccount(key);
  const expected = process.env.AGENT_ADDRESS;
  if (!expected || !isAddress(expected) || !same(account.address, expected)) throw new Error("Agent key does not match AGENT_ADDRESS");
  return account;
}

async function bestHop(publicClient: ReturnType<typeof createPublicClient>, factory: Address, tokenIn: Address, tokenOut: Address): Promise<{ fee: typeof FEES[number]; liquidity: bigint } | null> {
  const candidates = await Promise.all(FEES.map(async fee => {
    const pool = await publicClient.readContract({ address: factory, abi: FACTORY_ABI, functionName: "getPool", args: [tokenIn, tokenOut, fee] }).catch(() => zeroAddress);
    if (pool === zeroAddress) return null;
    const liquidity = await publicClient.readContract({ address: pool, abi: POOL_ABI, functionName: "liquidity" }).catch(() => 0n);
    return liquidity > 0n ? { fee, liquidity } : null;
  }));
  let best: { fee: typeof FEES[number]; liquidity: bigint } | null = null;
  for (const candidate of candidates) if (candidate && (!best || candidate.liquidity > best.liquidity)) best = candidate;
  return best;
}

async function protectedPath(publicClient: ReturnType<typeof createPublicClient>, factory: Address, weth: Address, tokenIn: Address, tokenOut: Address): Promise<Hex> {
  const direct = await bestHop(publicClient, factory, tokenIn, tokenOut);
  if (direct) return encodePacked(["address", "uint24", "address"], [tokenIn, direct.fee, tokenOut]);
  if (same(tokenIn, weth) || same(tokenOut, weth)) throw new Error("No protected Uniswap V3 price route exists for this pair");
  const [first, second] = await Promise.all([bestHop(publicClient, factory, tokenIn, weth), bestHop(publicClient, factory, weth, tokenOut)]);
  if (!first || !second) throw new Error("No protected Uniswap V3 route exists through WETH for this pair");
  return encodePacked(["address", "uint24", "address", "uint24", "address"], [tokenIn, first.fee, weth, second.fee, tokenOut]);
}

export const enqueue = action({
  args: {
    orderKey: v.string(), chainId: v.float64(), account: v.string(), tokenIn: v.string(), tokenOut: v.string(),
    amountIn: v.string(), requestKey: v.string(),
  },
  handler: async (ctx, args): Promise<{ id: Id<"spotTradeOrders">; state: string; duplicate: boolean }> => {
    if (args.chainId !== 4663 || process.env.AGENT_CHAIN_ID !== "4663" || process.env.AGENT_EXECUTION_ENABLED !== "1") throw new Error("Instant trading is disabled");
    if (!/^[a-zA-Z0-9:_-]{8,120}$/.test(args.orderKey)) throw new Error("Invalid order key");
    if (!isAddress(args.account) || !isAddress(args.tokenIn) || !isAddress(args.tokenOut) || same(args.tokenIn, args.tokenOut)) throw new Error("Invalid trade tokens");
    if (!/^\d+$/.test(args.amountIn) || BigInt(args.amountIn) <= 0n) throw new Error("Invalid trade amount");
    if (!/^0x[0-9a-fA-F]{64}$/.test(args.requestKey)) throw new Error("This device is not authorized for instant trading");
    const agent = signer();
    const rpc = process.env.AGENT_RPC_URL || robinhood.rpcUrls.default.http[0];
    const publicClient = createPublicClient({ chain: robinhood, transport: http(rpc, { timeout: 15_000, retryCount: 2 }) });
    const registry = configuredAddress("BTB_AGENT_REGISTRY_4663", DEFAULT_REGISTRY);
    const accountAddress = args.account as Address;
    const rawPolicy = await publicClient.readContract({ address: registry, abi: REGISTRY_ABI, functionName: "tradePolicies", args: [accountAddress] });
    if (!rawPolicy[0] || !same(rawPolicy[1], agent.address) || Number(rawPolicy[7]) <= Math.floor(Date.now() / 1000)) throw new Error("Instant trading permission is disabled or expired");
    if (keccak256(args.requestKey as Hex) !== rawPolicy[2]) throw new Error("This device is not authorized for this smart account");
    const roles = await publicClient.readContract({ address: registry, abi: REGISTRY_ABI, functionName: "agentRoles", args: [accountAddress, agent.address] });
    if ((roles & 16) === 0) throw new Error("The BTB agent does not have trading permission");
    return ctx.runMutation(internal.spotTradeQueue.insert, {
      orderKey: args.orderKey, chainId: args.chainId, account: args.account,
      tokenIn: args.tokenIn, tokenOut: args.tokenOut, amountIn: args.amountIn,
    });
  },
});

export const executeQueued = internalAction({
  args: {
    chainId: v.float64(), account: v.string(), tokenIn: v.string(), tokenOut: v.string(),
    amountIn: v.string(), orderId: v.id("spotTradeOrders"), workerId: v.string(), txHash: v.optional(v.string()), signedTransaction: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.chainId !== 4663 || process.env.AGENT_CHAIN_ID !== "4663" || process.env.AGENT_EXECUTION_ENABLED !== "1") throw new Error("Instant trading is disabled");
    if (!isAddress(args.account) || !isAddress(args.tokenIn) || !isAddress(args.tokenOut) || same(args.tokenIn, args.tokenOut)) throw new Error("Invalid trade tokens");
    if (!/^\d+$/.test(args.amountIn) || BigInt(args.amountIn) <= 0n) throw new Error("Invalid trade amount");

    const agent = signer();
    const rpc = process.env.AGENT_RPC_URL || robinhood.rpcUrls.default.http[0];
    const transport = http(rpc, { timeout: 15_000, retryCount: 2 });
    const publicClient = createPublicClient({ chain: robinhood, transport });
    const walletClient = createWalletClient({ account: agent, chain: robinhood, transport });
    const registry = configuredAddress("BTB_AGENT_REGISTRY_4663", DEFAULT_REGISTRY);
    const adapter = configuredAddress("BTB_AGGREGATOR_ADAPTER_4663", DEFAULT_ADAPTER);
    const factory = configuredAddress("BTB_UNISWAP_FACTORY_4663", DEFAULT_FACTORY);
    const weth = configuredAddress("BTB_WETH_4663", DEFAULT_WETH);
    const kyberRouter = configuredAddress("KYBER_ROUTER_4663", DEFAULT_KYBER_ROUTER);
    const accountAddress = args.account as Address;
    const tokenIn = args.tokenIn as Address;
    const tokenOut = args.tokenOut as Address;
    const amountIn = BigInt(args.amountIn);

    const rawPolicy = await publicClient.readContract({ address: registry, abi: REGISTRY_ABI, functionName: "tradePolicies", args: [accountAddress] });
    const policy: TradePolicy = {
      enabled: rawPolicy[0], agent: rawPolicy[1], requestKeyHash: rawPolicy[2],
      maximumBalanceBpsPerTrade: rawPolicy[3], maximumSlippageBps: rawPolicy[4],
      maximumSpotTwapDeviationBps: rawPolicy[5], minimumTwapSeconds: rawPolicy[6], expiresAt: rawPolicy[7],
    };
    if (!policy.enabled || !same(policy.agent, agent.address) || Number(policy.expiresAt) <= Math.floor(Date.now() / 1000)) throw new Error("Instant trading permission is disabled or expired");
    const roles = await publicClient.readContract({ address: registry, abi: REGISTRY_ABI, functionName: "agentRoles", args: [accountAddress, agent.address] });
    if ((roles & 16) === 0) throw new Error("The BTB agent does not have trading permission");

    if (args.txHash) {
      if (!/^0x[0-9a-fA-F]{64}$/.test(args.txHash)) throw new Error("Invalid submitted transaction hash");
      let receipt = await publicClient.getTransactionReceipt({ hash: args.txHash as Hex }).catch(() => null);
      if (!receipt && args.signedTransaction && /^0x[0-9a-fA-F]+$/.test(args.signedTransaction)) {
        try { await publicClient.sendRawTransaction({ serializedTransaction: args.signedTransaction as Hex }); }
        catch (reason) {
          const message = (reason as Error).message?.toLowerCase() || "";
          if (!message.includes("already known") && !message.includes("known transaction")) throw reason;
        }
      }
      receipt ??= await publicClient.waitForTransactionReceipt({ hash: args.txHash as Hex, confirmations: 1, timeout: 60_000 });
      if (receipt.status !== "success") throw new Error("Instant trade reverted");
      const event = parseEventLogs({ abi: REGISTRY_ABI, logs: receipt.logs, eventName: "TradeExecuted", strict: false })
        .find(log => same(log.args.account || "", accountAddress));
      if (!event) throw new Error("Confirmed trade is missing its settlement event");
      return {
        hash: args.txHash,
        grossAmountOut: event.args.grossAmountOut?.toString() || "0",
        protocolFee: event.args.protocolFee?.toString() || "0",
        netAmountOut: event.args.netAmountOut?.toString() || "0",
        amountInUsd: 0,
      };
    }

    // Fail fast when the smart account simply cannot fund the trade, instead of
    // paying for a route quote + on-chain simulation only to revert. "insufficient
    // balance" is a terminal reason, so the order fails immediately with a clear
    // message rather than sitting "queued" through six pointless retries.
    const fundingBalance = await publicClient.readContract({ address: tokenIn, abi: ERC20_BALANCE_ABI, functionName: "balanceOf", args: [accountAddress] });
    if (fundingBalance < amountIn) throw new Error("Insufficient balance in the smart account — fund it and try again");

    const routesUrl = `https://aggregator-api.kyberswap.com/robinhood/api/v1/routes?tokenIn=${tokenIn}&tokenOut=${tokenOut}&amountIn=${amountIn}&saveGas=0&gasInclude=1`;
    const routeResponse = await fetch(routesUrl, { headers: { "x-client-id": "btb-finance" } });
    const routeJson = await routeResponse.json() as { code?: number; message?: string; data?: { routerAddress?: string; routeSummary?: { amountOut?: string; amountInUsd?: string } } };
    if (!routeResponse.ok || routeJson.code !== 0 || !routeJson.data?.routeSummary) throw new Error(routeJson.message || "No executable route was found");
    if (!routeJson.data.routerAddress || !same(routeJson.data.routerAddress, kyberRouter)) throw new Error("Kyber returned an unapproved router");
    const amountInUsd = Number(routeJson.data.routeSummary.amountInUsd || 0);
    const minimumTradeUsd = Number(process.env.MIN_SPOT_TRADE_USD || 5);
    if (!Number.isFinite(amountInUsd) || amountInUsd < minimumTradeUsd) throw new Error(`Minimum instant trade is $${minimumTradeUsd.toFixed(0)}`);
    const expectedOut = BigInt(routeJson.data.routeSummary.amountOut || "0");
    if (expectedOut === 0n) throw new Error("The quoted output is zero");

    const buildResponse = await fetch("https://aggregator-api.kyberswap.com/robinhood/api/v1/route/build", {
      method: "POST", headers: { "Content-Type": "application/json", "x-client-id": "btb-finance" },
      body: JSON.stringify({ routeSummary: routeJson.data.routeSummary, sender: adapter, recipient: adapter, slippageTolerance: Number(policy.maximumSlippageBps) }),
    });
    const buildJson = await buildResponse.json() as { code?: number; message?: string; data?: { data?: string; routerAddress?: string; value?: string } };
    const tx = buildJson.data;
    if (!buildResponse.ok || buildJson.code !== 0 || !tx?.data || !/^0x[0-9a-fA-F]+$/.test(tx.data)) throw new Error(buildJson.message || "Kyber route build failed");
    if (!tx.routerAddress || !same(tx.routerAddress, kyberRouter) || BigInt(tx.value || "0") !== 0n) throw new Error("Kyber returned unsafe transaction data");
    const selector = tx.data.slice(0, 10) as Hex;
    const [routerAllowed, selectorAllowed] = await Promise.all([
      publicClient.readContract({ address: adapter, abi: ADAPTER_ABI, functionName: "allowedRouter", args: [kyberRouter] }),
      publicClient.readContract({ address: adapter, abi: ADAPTER_ABI, functionName: "allowedSelector", args: [kyberRouter, selector] }),
    ]);
    if (!routerAllowed || !selectorAllowed) throw new Error("The returned Kyber route is not approved by BTB");

    const path = await protectedPath(publicClient, factory, weth, tokenIn, tokenOut);
    const minimumOut = expectedOut * BigInt(10_000 - Number(policy.maximumSlippageBps)) / 10_000n;
    const request = {
      account: accountAddress, fundingToken: tokenIn, fundingAmount: amountIn, tokenOut,
      quotedMinimumOut: minimumOut, path, twapSeconds: Number(policy.minimumTwapSeconds),
      maxSlippageBps: Number(policy.maximumSlippageBps),
      maxSpotTwapDeviationBps: Number(policy.maximumSpotTwapDeviationBps),
    };
    const swapData = encodeAbiParameters([{ type: "address" }, { type: "bytes" }], [kyberRouter, tx.data as Hex]);
    const contractCall = { account: agent, address: registry, abi: REGISTRY_ABI, functionName: "executeTrade" as const, args: [request, swapData] as const };
    await publicClient.simulateContract(contractCall);
    const data = encodeFunctionData({ abi: REGISTRY_ABI, functionName: "executeTrade", args: contractCall.args });
    const gas = await publicClient.estimateGas({ account: agent, to: registry, data });
    const gasPrice = await publicClient.getGasPrice();
    if (await publicClient.getBalance({ address: agent.address }) < gas * gasPrice * 12n / 10n) throw new Error("BTB agent needs more native gas");
    const nonce = await publicClient.getTransactionCount({ address: agent.address, blockTag: "pending" });
    const signedTransaction = await walletClient.signTransaction({ account: agent, chain: robinhood, to: registry, data, gas: gas * 12n / 10n, gasPrice, nonce });
    const hash = keccak256(signedTransaction);
    await ctx.runMutation(internal.spotTradeQueue.markSubmitted, { orderId: args.orderId, workerId: args.workerId, txHash: hash, signedTransaction, amountInUsd });
    try {
      await publicClient.sendRawTransaction({ serializedTransaction: signedTransaction });
    } catch (reason) {
      const message = (reason as Error).message?.toLowerCase() || "";
      if (!message.includes("already known") && !message.includes("known transaction")) throw reason;
    }
    const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1, timeout: 60_000 });
    if (receipt.status !== "success") throw new Error("Instant trade reverted");
    const event = parseEventLogs({ abi: REGISTRY_ABI, logs: receipt.logs, eventName: "TradeExecuted", strict: false })
      .find(log => same(log.args.account || "", accountAddress));
    if (!event) throw new Error("Confirmed trade is missing its settlement event");
    return {
      hash,
      grossAmountOut: event.args.grossAmountOut?.toString() || "0",
      protocolFee: event.args.protocolFee?.toString() || "0",
      netAmountOut: event.args.netAmountOut?.toString() || "0",
      amountInUsd,
    };
  },
});
