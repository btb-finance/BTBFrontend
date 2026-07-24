"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import {
  createPublicClient,
  createWalletClient,
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

const FACTORY = "0x2C2360b0e662ffB535e0c501B2Fd28Cd3792815d" as const;
const ROUTER = "0x6131B5fae19EA4f9D964eAc0408E4408b66337b5" as const;
const ROUTER_CODE_HASH = "0xdc6eb20a6d4701d8f0f04f9a3342d254eb2698bbad281d8578d6efba21865867" as const;
const SELECTOR_0 = "0xe21fd0e9" as const;
const SELECTOR_1 = "0x8af033fb" as const;

const SETUP_COMPONENTS = [
  { name: "agent", type: "address" },
  { name: "payoutReceiver", type: "address" },
  { name: "sessionSigner", type: "address" },
  { name: "maximumBalanceSpendBps", type: "uint16" },
  { name: "expiresAt", type: "uint64" },
  { name: "router", type: "address" },
  { name: "routerCodeHash", type: "bytes32" },
  { name: "selector0", type: "bytes4" },
  { name: "selector1", type: "bytes4" },
  { name: "nonce", type: "uint256" },
  { name: "deadline", type: "uint64" },
] as const;

const FACTORY_ABI = [
  { name: "predictWallet", type: "function", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "address" }] },
  { name: "createWalletAndConfigure", type: "function", stateMutability: "nonpayable", inputs: [{ type: "address" }, { type: "bytes" }], outputs: [{ type: "address" }] },
] as const;

const WALLET_ABI = [
  { name: "owner", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { name: "tradingSetupNonce", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "configureTradingBySig", type: "function", stateMutability: "nonpayable", inputs: [{ type: "tuple", components: SETUP_COMPONENTS }, { type: "bytes" }], outputs: [] },
] as const;

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

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
    sessionSigner: v.string(),
    expiresAt: v.float64(),
    nonce: v.string(),
    deadline: v.float64(),
    ownerSignature: v.string(),
  },
  handler: async (_ctx, args) => {
    if (process.env.AGENT_CHAIN_ID !== "4663" || process.env.AGENT_EXECUTION_ENABLED !== "1") {
      throw new Error("BTB relaying is disabled");
    }
    if (![args.owner, args.account, args.sessionSigner].every(value => isAddress(value))) {
      throw new Error("Invalid setup address");
    }
    if (!/^\d+$/.test(args.nonce) || !/^0x[0-9a-fA-F]{130}$/.test(args.ownerSignature)) {
      throw new Error("Invalid setup authorization");
    }
    const now = Math.floor(Date.now() / 1000);
    if (!Number.isInteger(args.expiresAt) || !Number.isInteger(args.deadline) || args.expiresAt <= now || args.deadline <= now) {
      throw new Error("Setup authorization expired");
    }

    const agent = agentAccount();
    const transport = http(process.env.AGENT_RPC_URL || robinhood.rpcUrls.default.http[0], { timeout: 15_000, retryCount: 2 });
    const publicClient = createPublicClient({ chain: robinhood, transport });
    const walletClient = createWalletClient({ account: agent, chain: robinhood, transport });
    const owner = args.owner as Address;
    const account = args.account as Address;
    const nonce = BigInt(args.nonce);

    if (args.deployed) {
      const [onchainOwner, onchainNonce] = await Promise.all([
        publicClient.readContract({ address: account, abi: WALLET_ABI, functionName: "owner" }),
        publicClient.readContract({ address: account, abi: WALLET_ABI, functionName: "tradingSetupNonce" }),
      ]);
      if (!same(onchainOwner, owner) || onchainNonce !== nonce) throw new Error("Wallet setup state changed; refresh and retry");
    } else {
      const predicted = await publicClient.readContract({ address: FACTORY, abi: FACTORY_ABI, functionName: "predictWallet", args: [owner] });
      if (!same(predicted, account) || nonce !== 0n) throw new Error("Predicted wallet does not match this authorization");
    }

    const setup = {
      agent: agent.address,
      payoutReceiver: agent.address,
      sessionSigner: args.sessionSigner as Address,
      maximumBalanceSpendBps: 10_000,
      expiresAt: BigInt(args.expiresAt),
      router: ROUTER,
      routerCodeHash: ROUTER_CODE_HASH,
      selector0: SELECTOR_0,
      selector1: SELECTOR_1,
      nonce,
      deadline: BigInt(args.deadline),
    };
    const valid = await verifyTypedData({
      address: owner,
      domain: { name: "BTB Universal Managed Wallet", version: "5", chainId: 4663, verifyingContract: account },
      types: { TradingSetup: SETUP_COMPONENTS },
      primaryType: "TradingSetup",
      message: setup,
      signature: args.ownerSignature as Hex,
    });
    if (!valid) throw new Error("Wallet owner did not authorize these exact permissions");

    const setupCall = encodeFunctionData({ abi: WALLET_ABI, functionName: "configureTradingBySig", args: [setup, args.ownerSignature as Hex] });
    const to = args.deployed ? account : FACTORY;
    const data = args.deployed
      ? setupCall
      : encodeFunctionData({ abi: FACTORY_ABI, functionName: "createWalletAndConfigure", args: [owner, setupCall] });
    const gas = await publicClient.estimateGas({ account: agent, to, data });
    const gasPrice = await publicClient.getGasPrice() * 125n / 100n;
    if (await publicClient.getBalance({ address: agent.address }) < gas * gasPrice * 12n / 10n) {
      throw new Error("BTB relayer needs more native gas");
    }
    const hash = await walletClient.sendTransaction({ account: agent, chain: robinhood, to, data, gas: gas * 12n / 10n, gasPrice });
    const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1, timeout: 60_000 });
    if (receipt.status !== "success") throw new Error("Signed wallet setup reverted");
    return { hash, account };
  },
});
