"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import {
  createPublicClient, createWalletClient, defineChain, encodeFunctionData, http, isAddress, keccak256,
  toFunctionSelector, type Address, type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const robinhood = defineChain({
  id: 4663, name: "Robinhood Chain", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.mainnet.chain.robinhood.com/"] } },
});
const DEFAULT_REGISTRY = "0x3fD9F511fd3E244CF8566E8B52D26E539f6c02aF" as const;
const ALLOWED_SELECTORS = new Set([
  toFunctionSelector("createFromAccount(bytes,bytes)"),
  toFunctionSelector("increaseFromAccount(bytes,bytes)"),
  toFunctionSelector("createTwoTokens(bytes,bytes)"),
  toFunctionSelector("increaseTwoTokens(bytes,bytes)"),
].map(value => value.toLowerCase()));
const INSTRUCTION_ABI = [{
  name: "instructions", type: "function", stateMutability: "view",
  inputs: [{ type: "address" }, { type: "uint256" }],
  outputs: [
    { name: "enabled", type: "bool" }, { name: "agent", type: "address" },
    { name: "fundingToken", type: "address" }, { name: "maximumFundingAmount", type: "uint256" },
    { name: "secondFundingToken", type: "address" }, { name: "secondMaximumFundingAmount", type: "uint256" },
    { name: "executeAfter", type: "uint64" }, { name: "expiresAt", type: "uint64" },
    { name: "requiredRole", type: "uint8" }, { name: "zapSelector", type: "bytes4" },
    { name: "callHash", type: "bytes32" },
  ],
}, {
  name: "agentRoles", type: "function", stateMutability: "view",
  inputs: [{ type: "address" }, { type: "address" }], outputs: [{ type: "uint8" }],
}, {
  name: "executeInstruction", type: "function", stateMutability: "nonpayable",
  inputs: [{ type: "address" }, { type: "uint256" }, { type: "bytes" }, { type: "bytes" }],
  outputs: [{ type: "bytes" }],
}] as const;

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

function signer() {
  const raw = process.env.AGENT_PRIVATE_KEY ?? "";
  const key = (raw.startsWith("0x") ? raw : `0x${raw}`) as Hex;
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error("Agent signing key is not configured");
  const account = privateKeyToAccount(key);
  if (!process.env.AGENT_ADDRESS || !isAddress(process.env.AGENT_ADDRESS) || !same(account.address, process.env.AGENT_ADDRESS)) {
    throw new Error("Agent key does not match the configured agent address");
  }
  return account;
}

export const execute = action({
  args: { chainId: v.float64(), account: v.string(), instructionId: v.string(), pinnedArgs: v.string(), freshArgs: v.string() },
  handler: async (_ctx, args) => {
    if (args.chainId !== 4663 || process.env.AGENT_CHAIN_ID !== "4663" || process.env.AGENT_EXECUTION_ENABLED !== "1") {
      throw new Error("Zap agent execution is disabled for this chain");
    }
    if (!isAddress(args.account) || !/^\d+$/.test(args.instructionId)) throw new Error("Invalid Zap instruction");
    if (!/^0x(?:[0-9a-fA-F]{2})*$/.test(args.pinnedArgs) || !/^0x(?:[0-9a-fA-F]{2})*$/.test(args.freshArgs)) {
      throw new Error("Invalid Zap calldata");
    }
    if (args.pinnedArgs.length > 100_002 || args.freshArgs.length > 200_002) throw new Error("Zap instruction is too large");

    const account = signer();
    const configured = process.env.BTB_AGENT_REGISTRY_4663 || DEFAULT_REGISTRY;
    if (!isAddress(configured)) throw new Error("BTB agent registry is not configured");
    const registry = configured as Address;
    const rpc = process.env.AGENT_RPC_URL || robinhood.rpcUrls.default.http[0];
    const transport = http(rpc, { timeout: 15_000, retryCount: 2 });
    const publicClient = createPublicClient({ chain: robinhood, transport });
    const walletClient = createWalletClient({ account, chain: robinhood, transport });
    const instructionId = BigInt(args.instructionId);
    const pinnedArgs = args.pinnedArgs as Hex;
    const freshArgs = args.freshArgs as Hex;
    const instruction = await publicClient.readContract({ address: registry, abi: INSTRUCTION_ABI, functionName: "instructions", args: [args.account, instructionId] });
    const [enabled, instructionAgent, , , , , executeAfter, expiresAt, requiredRole, selector, callHash] = instruction;
    const now = BigInt(Math.floor(Date.now() / 1000));
    if (!enabled || !same(instructionAgent, account.address)) throw new Error("This Zap instruction is not assigned to the BTB agent");
    if (keccak256(pinnedArgs) !== callHash) throw new Error("Pinned Zap instruction hash does not match the owner's approval");
    if (!ALLOWED_SELECTORS.has(selector.toLowerCase())) throw new Error("Zap selector is not allowed");
    if (now < executeAfter || now > expiresAt) throw new Error(now < executeAfter ? "Zap instruction is not ready" : "Zap instruction expired");
    const roles = await publicClient.readContract({ address: registry, abi: INSTRUCTION_ABI, functionName: "agentRoles", args: [args.account, account.address] });
    if ((roles & requiredRole) === 0) throw new Error("BTB agent no longer has the required Zap role");

    const request = { account, address: registry, abi: INSTRUCTION_ABI, functionName: "executeInstruction" as const, args: [args.account, instructionId, pinnedArgs, freshArgs] as const };
    await publicClient.simulateContract(request);
    const data = encodeFunctionData({ abi: INSTRUCTION_ABI, functionName: "executeInstruction", args: request.args });
    const gas = await publicClient.estimateGas({ account, to: registry, data });
    const gasPrice = await publicClient.getGasPrice();
    if (await publicClient.getBalance({ address: account.address }) < gas * gasPrice * 12n / 10n) throw new Error("BTB Zap agent needs more native gas");
    const hash = await walletClient.sendTransaction({ account, to: registry, data, gas: gas * 12n / 10n });
    const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1, timeout: 60_000 });
    if (receipt.status !== "success") throw new Error("Zap agent transaction reverted");
    return { hash };
  },
});
