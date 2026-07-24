"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import {
  createPublicClient,
  createWalletClient,
  decodeFunctionData,
  defineChain,
  encodeFunctionData,
  http,
  isAddress,
  verifyTypedData,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const robinhood = defineChain({
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.mainnet.chain.robinhood.com/"] } },
});

const DEFAULT_FACTORY = "0x2C2360b0e662ffB535e0c501B2Fd28Cd3792815d" as const;

const CALL_POLICY_COMPONENTS = [
  { name: "targetCodeHash", type: "bytes32" },
  { name: "maximumNativeValue", type: "uint96" },
  { name: "recipientOffset", type: "uint16" },
  { name: "recipientMode", type: "uint8" },
  { name: "enabled", type: "bool" },
] as const;

const APPROVAL_POLICY_COMPONENTS = [
  { name: "maximumPerExecution", type: "uint128" },
  { name: "maximumPerWindow", type: "uint128" },
  { name: "window", type: "uint64" },
  { name: "windowStart", type: "uint64" },
  { name: "spentInWindow", type: "uint128" },
  { name: "enabled", type: "bool" },
] as const;

const GUARDED_SETUP_COMPONENTS = [
  { name: "agent", type: "address" },
  { name: "payoutReceiver", type: "address" },
  { name: "expiresAt", type: "uint64" },
  { name: "guard", type: "address" },
  { name: "guardCodeHash", type: "bytes32" },
  { name: "guardConfigHash", type: "bytes32" },
  { name: "callPoliciesHash", type: "bytes32" },
  { name: "approvalPoliciesHash", type: "bytes32" },
  { name: "nonce", type: "uint256" },
  { name: "deadline", type: "uint64" },
] as const;

const WALLET_ABI = [
  { name: "owner", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { name: "guardedSetupNonce", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  {
    name: "configureGuardedWorkflowBySig",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "setup", type: "tuple", components: GUARDED_SETUP_COMPONENTS },
      { name: "callPolicyUpdates", type: "tuple[]", components: [{ name: "target", type: "address" }, { name: "selector", type: "bytes4" }, { name: "policy", type: "tuple", components: CALL_POLICY_COMPONENTS }] },
      { name: "approvalPolicyUpdates", type: "tuple[]", components: [{ name: "token", type: "address" }, { name: "spender", type: "address" }, { name: "policy", type: "tuple", components: APPROVAL_POLICY_COMPONENTS }] },
      { name: "guardConfiguration", type: "bytes" },
      { name: "ownerSignature", type: "bytes" },
    ],
    outputs: [],
  },
] as const;

const FACTORY_ABI = [
  { name: "predictWallet", type: "function", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "address" }] },
  { name: "createWalletAndConfigure", type: "function", stateMutability: "nonpayable", inputs: [{ type: "address" }, { type: "bytes" }], outputs: [{ type: "address" }] },
] as const;

const GUARDED_SETUP_TYPES = { GuardedSetup: GUARDED_SETUP_COMPONENTS } as const;
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

function configuredAddress(name: string, fallback?: Address): Address {
  const value = process.env[name] || fallback;
  if (!value || !isAddress(value)) throw new Error(`${name} is missing or invalid`);
  return value;
}

function agentAccount() {
  const raw = process.env.AGENT_PRIVATE_KEY ?? "";
  const key = (raw.startsWith("0x") ? raw : `0x${raw}`) as Hex;
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error("Agent signing key is not configured");
  const account = privateKeyToAccount(key);
  if (!process.env.AGENT_ADDRESS || !same(account.address, process.env.AGENT_ADDRESS)) {
    throw new Error("Agent key does not match AGENT_ADDRESS");
  }
  return account;
}

export const configure = action({
  args: {
    owner: v.string(),
    account: v.string(),
    deployed: v.boolean(),
    setupCall: v.string(),
  },
  handler: async (_ctx, args) => {
    if (process.env.AGENT_CHAIN_ID !== "4663" || process.env.AGENT_EXECUTION_ENABLED !== "1") {
      throw new Error("BTB relaying is disabled");
    }
    if (!isAddress(args.owner) || !isAddress(args.account) || !/^0x[0-9a-fA-F]+$/.test(args.setupCall)) {
      throw new Error("Invalid signed LP setup");
    }
    if (args.setupCall.length > 100_000) throw new Error("LP setup is too large");

    const decoded = decodeFunctionData({ abi: WALLET_ABI, data: args.setupCall as Hex });
    if (decoded.functionName !== "configureGuardedWorkflowBySig") throw new Error("Unsupported LP setup call");
    const [setup, callPolicyUpdates, approvalPolicyUpdates, _guardConfiguration, ownerSignature] = decoded.args;
    const agent = agentAccount();
    const expectedGuard = configuredAddress("BTB_UNISWAP_V3_GUARD_4663");
    if (!same(setup.agent, agent.address) || !same(setup.payoutReceiver, agent.address) || !same(setup.guard, expectedGuard)) {
      throw new Error("LP setup contains an unapproved agent or guard");
    }
    if (callPolicyUpdates.length === 0 || callPolicyUpdates.length > 16 || approvalPolicyUpdates.length === 0 || approvalPolicyUpdates.length > 16) {
      throw new Error("LP setup policy count is invalid");
    }
    const now = Math.floor(Date.now() / 1000);
    if (setup.deadline <= now || setup.expiresAt <= now || setup.expiresAt > now + 366 * 86_400) {
      throw new Error("LP setup authorization expired or is too long");
    }

    const owner = args.owner as Address;
    const wallet = args.account as Address;
    const valid = await verifyTypedData({
      address: owner,
      domain: { name: "BTB Universal Managed Wallet", version: "5", chainId: 4663, verifyingContract: wallet },
      types: GUARDED_SETUP_TYPES,
      primaryType: "GuardedSetup",
      message: setup,
      signature: ownerSignature,
    });
    if (!valid) throw new Error("Wallet owner did not authorize these exact LP rules");

    const transport = http(process.env.AGENT_RPC_URL || robinhood.rpcUrls.default.http[0], { timeout: 15_000, retryCount: 2 });
    const publicClient = createPublicClient({ chain: robinhood, transport });
    const walletClient = createWalletClient({ account: agent, chain: robinhood, transport });
    const factory = configuredAddress("BTB_UNIVERSAL_FACTORY_4663", DEFAULT_FACTORY);
    if (args.deployed) {
      const [onchainOwner, nonce] = await Promise.all([
        publicClient.readContract({ address: wallet, abi: WALLET_ABI, functionName: "owner" }),
        publicClient.readContract({ address: wallet, abi: WALLET_ABI, functionName: "guardedSetupNonce" }),
      ]);
      if (!same(onchainOwner, owner) || nonce !== setup.nonce) throw new Error("Wallet LP setup state changed; refresh and retry");
    } else {
      const predicted = await publicClient.readContract({ address: factory, abi: FACTORY_ABI, functionName: "predictWallet", args: [owner] });
      if (!same(predicted, wallet) || setup.nonce !== 0n) throw new Error("Predicted wallet does not match this LP authorization");
    }

    const to = args.deployed ? wallet : factory;
    const data = args.deployed
      ? args.setupCall as Hex
      : encodeFunctionData({ abi: FACTORY_ABI, functionName: "createWalletAndConfigure", args: [owner, args.setupCall as Hex] });
    const gas = await publicClient.estimateGas({ account: agent, to, data });
    const gasPrice = await publicClient.getGasPrice() * 125n / 100n;
    if (await publicClient.getBalance({ address: agent.address }) < gas * gasPrice * 12n / 10n) {
      throw new Error("BTB relayer needs more native gas");
    }
    const hash = await walletClient.sendTransaction({ account: agent, chain: robinhood, to, data, gas: gas * 12n / 10n, gasPrice });
    const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1, timeout: 60_000 });
    if (receipt.status !== "success") throw new Error("Signed LP setup reverted");
    return { hash, account: wallet };
  },
});
