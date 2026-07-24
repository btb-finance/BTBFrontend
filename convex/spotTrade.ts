"use node";

import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import {
  createPublicClient, createWalletClient, defineChain, encodeFunctionData, http, isAddress,
  keccak256, parseEventLogs, verifyTypedData, type Address, type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const robinhood = defineChain({
  id: 4663, name: "Robinhood Chain", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.mainnet.chain.robinhood.com/"] } },
});
const DEFAULT_KYBER_ROUTER = "0x6131B5fae19EA4f9D964eAc0408E4408b66337b5" as const;
const MAX_SLIPPAGE_BPS = 500;
const DUST_FEE_USD_MICROS = 500_000n;

const SPOT_POLICY_COMPONENTS = [
  { name: "agent", type: "address" }, { name: "sessionSigner", type: "address" },
  { name: "maximumBalanceSpendBps", type: "uint16" }, { name: "expiresAt", type: "uint64" },
  { name: "enabled", type: "bool" },
] as const;
const SPOT_TRADE_COMPONENTS = [
  { name: "tokenIn", type: "address" }, { name: "tokenOut", type: "address" },
  { name: "amountIn", type: "uint256" }, { name: "minimumGrossOutput", type: "uint256" },
  { name: "minimumProtocolFee", type: "uint256" },
  { name: "nonce", type: "uint256" }, { name: "deadline", type: "uint64" },
] as const;
const WALLET_ABI = [
  { name: "spotTradePolicy", type: "function", stateMutability: "view", inputs: [], outputs: SPOT_POLICY_COMPONENTS },
  { name: "usedSpotTradeNonces", type: "function", stateMutability: "view", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [{ type: "bool" }] },
  { name: "executeSpotTradeV3", type: "function", stateMutability: "nonpayable", inputs: [{ name: "trade", type: "tuple", components: SPOT_TRADE_COMPONENTS }, { name: "sessionSignature", type: "bytes" }, { name: "swapData", type: "bytes" }], outputs: [{ name: "grossOutput", type: "uint256" }, { name: "protocolFee", type: "uint256" }, { name: "netOutput", type: "uint256" }] },
  { name: "SpotTradeV3Executed", type: "event", inputs: [
    { name: "agent", type: "address", indexed: true }, { name: "tokenIn", type: "address", indexed: true },
    { name: "tokenOut", type: "address", indexed: true }, { name: "amountIn", type: "uint256", indexed: false },
    { name: "grossOutput", type: "uint256", indexed: false }, { name: "protocolFee", type: "uint256", indexed: false },
    { name: "netOutput", type: "uint256", indexed: false }, { name: "nonce", type: "uint256", indexed: false },
  ] },
] as const;
const ERC20_BALANCE_ABI = [{ name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] }] as const;
const SPOT_TRADE_TYPES = { SpotTradeV3: SPOT_TRADE_COMPONENTS } as const;

type Policy = { agent: Address; sessionSigner: Address; maximumBalanceSpendBps: number; expiresAt: bigint; enabled: boolean };
type Quote = { router: Address; summary: Record<string, unknown>; expectedOut: bigint; amountInUsd: number; amountOutUsdMicros: bigint };

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

function client() {
  const rpc = process.env.AGENT_RPC_URL || robinhood.rpcUrls.default.http[0];
  return createPublicClient({ chain: robinhood, transport: http(rpc, { timeout: 15_000, retryCount: 2 }) });
}

async function policyFor(publicClient: ReturnType<typeof client>, account: Address): Promise<Policy> {
  const raw = await publicClient.readContract({ address: account, abi: WALLET_ABI, functionName: "spotTradePolicy" });
  return { agent: raw[0], sessionSigner: raw[1], maximumBalanceSpendBps: Number(raw[2]), expiresAt: raw[3], enabled: raw[4] };
}

function assertPolicy(policy: Policy, agent: Address, sessionSigner?: Address) {
  if (!policy.enabled || !same(policy.agent, agent) || Number(policy.expiresAt) <= Math.floor(Date.now() / 1000)) {
    throw new Error("Instant trading permission is disabled or expired");
  }
  if (sessionSigner && !same(policy.sessionSigner, sessionSigner)) throw new Error("This device is not authorized for this smart account");
}

async function quote(tokenIn: Address, tokenOut: Address, amountIn: bigint): Promise<Quote> {
  const kyberRouter = configuredAddress("KYBER_ROUTER_4663", DEFAULT_KYBER_ROUTER);
  const url = `https://aggregator-api.kyberswap.com/robinhood/api/v1/routes?tokenIn=${tokenIn}&tokenOut=${tokenOut}&amountIn=${amountIn}&saveGas=0&gasInclude=1`;
  const response = await fetch(url, { headers: { "x-client-id": "btb-finance" } });
  const json = await response.json() as { code?: number; message?: string; data?: { routerAddress?: string; routeSummary?: Record<string, unknown> & { amountOut?: string; amountInUsd?: string; amountOutUsd?: string } } };
  if (!response.ok || json.code !== 0 || !json.data?.routeSummary) throw new Error(json.message || "No executable KyberSwap route was found");
  if (!json.data.routerAddress || !isAddress(json.data.routerAddress) || !same(json.data.routerAddress, kyberRouter)) throw new Error("KyberSwap returned an unapproved router");
  const expectedOut = BigInt(json.data.routeSummary.amountOut || "0");
  const amountInUsd = Number(json.data.routeSummary.amountInUsd || 0);
  const amountOutUsd = Number(json.data.routeSummary.amountOutUsd || 0);
  const amountOutUsdMicros = BigInt(Math.max(0, Math.round(amountOutUsd * 1_000_000)));
  if (!Number.isFinite(amountInUsd) || !Number.isFinite(amountOutUsd)) throw new Error("KyberSwap returned an invalid USD quote");
  if (expectedOut <= 0n) throw new Error("The quoted output is zero");
  return { router: json.data.routerAddress, summary: json.data.routeSummary, expectedOut, amountInUsd, amountOutUsdMicros };
}

export const prepare = action({
  args: { chainId: v.float64(), account: v.string(), tokenIn: v.string(), tokenOut: v.string(), amountIn: v.string(), sessionSigner: v.string(), side: v.union(v.literal("buy"), v.literal("sell")) },
  handler: async (_ctx, args) => {
    if (args.chainId !== 4663 || process.env.AGENT_CHAIN_ID !== "4663" || process.env.AGENT_EXECUTION_ENABLED !== "1") throw new Error("Instant trading is disabled");
    if (!isAddress(args.account) || !isAddress(args.tokenIn) || !isAddress(args.tokenOut) || !isAddress(args.sessionSigner) || same(args.tokenIn, args.tokenOut)) throw new Error("Invalid trade request");
    if (!/^\d+$/.test(args.amountIn) || BigInt(args.amountIn) <= 0n) throw new Error("Invalid trade amount");
    const agent = signer();
    const publicClient = client();
    const policy = await policyFor(publicClient, args.account);
    assertPolicy(policy, agent.address, args.sessionSigner);
    const route = await quote(args.tokenIn, args.tokenOut, BigInt(args.amountIn));
    const minimumTradeUsd = Number(process.env.MIN_SPOT_TRADE_USD || 5);
    if (args.side === "buy" && route.amountInUsd < minimumTradeUsd) throw new Error(`Minimum instant buy is $${minimumTradeUsd.toFixed(0)}`);
    const minimumGrossOutput = route.expectedOut * BigInt(10_000 - MAX_SLIPPAGE_BPS) / 10_000n;
    let minimumProtocolFee = 0n;
    if (args.side === "sell" && route.amountInUsd < minimumTradeUsd) {
      if (route.amountOutUsdMicros <= 0n) throw new Error("This dust token has no reliable output price");
      minimumProtocolFee = (route.expectedOut * DUST_FEE_USD_MICROS + route.amountOutUsdMicros - 1n) / route.amountOutUsdMicros;
      if (minimumProtocolFee >= minimumGrossOutput) throw new Error("Dust value must be above the approximately $0.50 execution fee");
    }
    const nonce = BigInt(keccak256(crypto.getRandomValues(new Uint8Array(32))));
    return { minimumGrossOutput: minimumGrossOutput.toString(), minimumProtocolFee: minimumProtocolFee.toString(), nonce: nonce.toString(), deadline: Math.floor(Date.now() / 1000) + 10 * 60, amountInUsd: route.amountInUsd, dust: minimumProtocolFee > 0n };
  },
});

export const enqueue = action({
  args: {
    orderKey: v.string(), chainId: v.float64(), account: v.string(), tokenIn: v.string(), tokenOut: v.string(), amountIn: v.string(),
    minimumGrossOutput: v.string(), minimumProtocolFee: v.string(), nonce: v.string(), deadline: v.float64(), sessionSignature: v.string(),
  },
  handler: async (ctx, args): Promise<{ id: Id<"spotTradeOrders">; state: string; duplicate: boolean }> => {
    if (args.chainId !== 4663 || process.env.AGENT_CHAIN_ID !== "4663" || process.env.AGENT_EXECUTION_ENABLED !== "1") throw new Error("Instant trading is disabled");
    if (!/^[a-zA-Z0-9:_-]{8,120}$/.test(args.orderKey)) throw new Error("Invalid order key");
    if (!isAddress(args.account) || !isAddress(args.tokenIn) || !isAddress(args.tokenOut) || same(args.tokenIn, args.tokenOut)) throw new Error("Invalid trade tokens");
    if (![args.amountIn, args.minimumGrossOutput, args.minimumProtocolFee, args.nonce].every(value => /^\d+$/.test(value)) || BigInt(args.amountIn) <= 0n || BigInt(args.minimumGrossOutput) <= 0n || BigInt(args.minimumProtocolFee) >= BigInt(args.minimumGrossOutput)) throw new Error("Invalid trade amount or fee");
    if (!/^0x[0-9a-fA-F]{130}$/.test(args.sessionSignature) || !Number.isInteger(args.deadline) || args.deadline <= Date.now() / 1000) throw new Error("Invalid or expired device authorization");
    const agent = signer();
    const publicClient = client();
    const account = args.account as Address;
    const policy = await policyFor(publicClient, account);
    assertPolicy(policy, agent.address);
    const message = { tokenIn: args.tokenIn as Address, tokenOut: args.tokenOut as Address, amountIn: BigInt(args.amountIn), minimumGrossOutput: BigInt(args.minimumGrossOutput), minimumProtocolFee: BigInt(args.minimumProtocolFee), nonce: BigInt(args.nonce), deadline: BigInt(args.deadline) };
    const valid = await verifyTypedData({ address: policy.sessionSigner, domain: { name: "BTB Universal Managed Wallet", version: "3", chainId: 4663, verifyingContract: account }, types: SPOT_TRADE_TYPES, primaryType: "SpotTradeV3", message, signature: args.sessionSignature as Hex });
    if (!valid) throw new Error("This device did not authorize these exact trade terms");
    const used = await publicClient.readContract({ address: account, abi: WALLET_ABI, functionName: "usedSpotTradeNonces", args: [policy.sessionSigner, BigInt(args.nonce)] });
    if (used) throw new Error("This trade authorization was already used");
    return ctx.runMutation(internal.spotTradeQueue.insert, {
      orderKey: args.orderKey, chainId: args.chainId, account: args.account, tokenIn: args.tokenIn, tokenOut: args.tokenOut,
      amountIn: args.amountIn, minimumGrossOutput: args.minimumGrossOutput, minimumProtocolFee: args.minimumProtocolFee, nonce: args.nonce, deadline: args.deadline, sessionSignature: args.sessionSignature,
    });
  },
});

export const executeQueued = internalAction({
  args: {
    chainId: v.float64(), account: v.string(), tokenIn: v.string(), tokenOut: v.string(), amountIn: v.string(),
    minimumGrossOutput: v.optional(v.string()), minimumProtocolFee: v.optional(v.string()), nonce: v.optional(v.string()), deadline: v.optional(v.float64()), sessionSignature: v.optional(v.string()),
    orderId: v.id("spotTradeOrders"), workerId: v.string(), txHash: v.optional(v.string()), signedTransaction: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.chainId !== 4663 || process.env.AGENT_CHAIN_ID !== "4663" || process.env.AGENT_EXECUTION_ENABLED !== "1") throw new Error("Instant trading is disabled");
    if (!isAddress(args.account) || !isAddress(args.tokenIn) || !isAddress(args.tokenOut) || same(args.tokenIn, args.tokenOut)) throw new Error("Invalid trade tokens");
    if (!args.minimumGrossOutput || args.minimumProtocolFee === undefined || !args.nonce || !args.deadline || !args.sessionSignature) throw new Error("Session-signed trade authorization is missing");
    if (args.deadline <= Date.now() / 1000) throw new Error("Trade authorization expired before execution");

    const agent = signer();
    const publicClient = client();
    const transport = http(process.env.AGENT_RPC_URL || robinhood.rpcUrls.default.http[0], { timeout: 15_000, retryCount: 2 });
    const walletClient = createWalletClient({ account: agent, chain: robinhood, transport });
    const account = args.account as Address;
    const tokenIn = args.tokenIn as Address;
    const tokenOut = args.tokenOut as Address;
    const amountIn = BigInt(args.amountIn);
    const policy = await policyFor(publicClient, account);
    assertPolicy(policy, agent.address);

    if (args.txHash) {
      let receipt = await publicClient.getTransactionReceipt({ hash: args.txHash as Hex }).catch(() => null);
      if (!receipt && args.signedTransaction) {
        try { await publicClient.sendRawTransaction({ serializedTransaction: args.signedTransaction as Hex }); }
        catch (reason) {
          const message = reason instanceof Error ? reason.message.toLowerCase() : "";
          if (!message.includes("already known") && !message.includes("known transaction")) throw reason;
        }
      }
      receipt ??= await publicClient.waitForTransactionReceipt({ hash: args.txHash as Hex, confirmations: 1, timeout: 60_000 });
      if (receipt.status !== "success") throw new Error("Instant trade reverted");
      const event = parseEventLogs({ abi: WALLET_ABI, logs: receipt.logs, eventName: "SpotTradeV3Executed", strict: false }).find(log => same(log.address, account));
      if (!event) throw new Error("Confirmed trade is missing its settlement event");
      return { hash: args.txHash, grossAmountOut: String(event.args.grossOutput ?? 0), protocolFee: String(event.args.protocolFee ?? 0), netAmountOut: String(event.args.netOutput ?? 0), amountInUsd: 0 };
    }

    const balance = await publicClient.readContract({ address: tokenIn, abi: ERC20_BALANCE_ABI, functionName: "balanceOf", args: [account] });
    if (balance < amountIn) throw new Error("Insufficient balance in the smart account — fund it and try again");
    const route = await quote(tokenIn, tokenOut, amountIn);
    if (route.expectedOut < BigInt(args.minimumGrossOutput)) throw new Error("KyberSwap price moved below your signed minimum");
    const buildResponse = await fetch("https://aggregator-api.kyberswap.com/robinhood/api/v1/route/build", {
      method: "POST", headers: { "Content-Type": "application/json", "x-client-id": "btb-finance" },
      body: JSON.stringify({ routeSummary: route.summary, sender: account, recipient: account, slippageTolerance: MAX_SLIPPAGE_BPS }),
    });
    const buildJson = await buildResponse.json() as { code?: number; message?: string; data?: { data?: string; routerAddress?: string; value?: string } };
    const tx = buildJson.data;
    if (!buildResponse.ok || buildJson.code !== 0 || !tx?.data || !/^0x[0-9a-fA-F]+$/.test(tx.data)) throw new Error(buildJson.message || "KyberSwap route build failed");
    if (!tx.routerAddress || !same(tx.routerAddress, route.router) || BigInt(tx.value || "0") !== 0n) throw new Error("KyberSwap returned unsafe transaction data");
    const selector = tx.data.slice(0, 10).toLowerCase();
    if (selector !== "0xe21fd0e9" && selector !== "0x8af033fb") throw new Error("KyberSwap returned an unapproved selector");

    const trade = { tokenIn, tokenOut, amountIn, minimumGrossOutput: BigInt(args.minimumGrossOutput), minimumProtocolFee: BigInt(args.minimumProtocolFee), nonce: BigInt(args.nonce), deadline: BigInt(args.deadline) };
    const call = { account: agent, address: account, abi: WALLET_ABI, functionName: "executeSpotTradeV3" as const, args: [trade, args.sessionSignature as Hex, tx.data as Hex] as const };
    await publicClient.simulateContract(call);
    const data = encodeFunctionData({ abi: WALLET_ABI, functionName: "executeSpotTradeV3", args: call.args });
    const gas = await publicClient.estimateGas({ account: agent, to: account, data });
    // Robinhood's base fee can move between estimation and broadcast. A legacy
    // transaction caps its fee at gasPrice, so sign above the current quote or
    // a tiny next-block increase leaves the queue retrying an invalid raw tx.
    const gasPrice = await publicClient.getGasPrice() * 125n / 100n;
    if (await publicClient.getBalance({ address: agent.address }) < gas * gasPrice * 12n / 10n) throw new Error("BTB agent needs more native gas");
    const transactionNonce = await publicClient.getTransactionCount({ address: agent.address, blockTag: "pending" });
    const signedTransaction = await walletClient.signTransaction({ account: agent, chain: robinhood, to: account, data, gas: gas * 12n / 10n, gasPrice, nonce: transactionNonce });
    const hash = keccak256(signedTransaction);
    await ctx.runMutation(internal.spotTradeQueue.markSubmitted, { orderId: args.orderId, workerId: args.workerId, txHash: hash, signedTransaction, amountInUsd: route.amountInUsd });
    try { await publicClient.sendRawTransaction({ serializedTransaction: signedTransaction }); } catch (reason) {
      const message = reason instanceof Error ? reason.message.toLowerCase() : "";
      if (!message.includes("already known") && !message.includes("known transaction")) throw reason;
    }
    const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1, timeout: 60_000 });
    if (receipt.status !== "success") throw new Error("Instant trade reverted");
    const event = parseEventLogs({ abi: WALLET_ABI, logs: receipt.logs, eventName: "SpotTradeV3Executed", strict: false }).find(log => same(log.address, account));
    if (!event) throw new Error("Confirmed trade is missing its settlement event");
    return { hash, grossAmountOut: String(event.args.grossOutput ?? 0), protocolFee: String(event.args.protocolFee ?? 0), netAmountOut: String(event.args.netOutput ?? 0), amountInUsd: route.amountInUsd };
  },
});
