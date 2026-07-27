"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  http,
  isAddress,
  type Address,
  type Hex,
} from "viem";
import { mainnet } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import type { Doc, Id } from "./_generated/dataModel";

// BTB and OPOSSUM both live on Ethereum mainnet — not the Robinhood chain the
// trading agents in this folder use. Addresses mirror CONTRACTS in
// src/lib/wagmi.ts; OPOS_TOKEN_ADDRESS can override for a redeploy.
const BTB = "0x88888888c90CD71B35830daBFD24743DbC135B51" as const;
const OPOS = "0x88888805E7e3d5c7FB002AD98f08250E79c298dC" as const;

// OPOSSUM.MINT_RATIO — 1e6 OPOS units redeem exactly 1 BTB unit. burn() also
// rejects anything below MIN_OPOS_BURN or not divisible by the ratio, so the
// weekly tax has to be trimmed to a whole multiple before it can be unwrapped.
const MINT_RATIO = 1_000_000n;
const MIN_OPOS_BURN = 1_000_000_000_000_000_000_000_000n;

const ERC20_ABI = [
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
  { name: "transfer", type: "function", stateMutability: "nonpayable", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [{ type: "bool" }] },
] as const;

const OPOS_ABI = [
  { name: "burn", type: "function", stateMutability: "nonpayable", inputs: [{ type: "uint256" }], outputs: [{ type: "uint256" }] },
  { name: "treasury", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
] as const;

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/**
 * The treasury signer. Defaults to the shared agent key but reads
 * REWARDS_PRIVATE_KEY first, so the fee-receiver wallet can be isolated from
 * the trading agent without touching anything else.
 */
function treasuryAccount() {
  const raw = process.env.REWARDS_PRIVATE_KEY || process.env.AGENT_PRIVATE_KEY || "";
  const key = (raw.startsWith("0x") ? raw : `0x${raw}`) as Hex;
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error("Rewards treasury key is not configured");
  return privateKeyToAccount(key);
}

function clients() {
  const account = treasuryAccount();
  const opos = process.env.OPOS_TOKEN_ADDRESS || OPOS;
  if (!isAddress(opos)) throw new Error("OPOS_TOKEN_ADDRESS is not a valid address");
  const transport = http(process.env.MAINNET_RPC_URL || "https://ethereum-rpc.publicnode.com", { timeout: 20_000, retryCount: 2 });
  return {
    account,
    opos: opos as Address,
    publicClient: createPublicClient({ chain: mainnet, transport }),
    walletClient: createWalletClient({ account, chain: mainnet, transport }),
  };
}

/** Estimate, gas-check and broadcast one call from the treasury EOA. */
async function broadcast(to: Address, data: Hex) {
  const { account, publicClient, walletClient } = clients();
  const gas = await publicClient.estimateGas({ account, to, data });
  const gasPrice = await publicClient.getGasPrice();
  if (await publicClient.getBalance({ address: account.address }) < gas * gasPrice * 15n / 10n) {
    throw new Error("Rewards treasury needs more ETH for gas");
  }
  return walletClient.sendTransaction({ account, to, data, gas: gas * 12n / 10n });
}

/** Wait for an already-broadcast transaction. Mainnet blocks are ~12s. */
async function confirm(hash: Hex) {
  const { publicClient } = clients();
  const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1, timeout: 300_000 });
  if (receipt.status !== "success") throw new Error("Rewards transaction reverted");
  return hash;
}

async function send(to: Address, data: Hex) {
  return confirm(await broadcast(to, data));
}

function messageOf(reason: unknown) {
  return reason instanceof Error ? reason.message : String(reason || "Rewards payout failed");
}

/** Errors that will never succeed on retry — fail the payout instead of looping. */
function terminalFailure(message: string) {
  const value = message.toLowerCase();
  return ["is not configured", "invalid recipient", "transfer amount exceeds", "insufficient balance"]
    .some((fragment) => value.includes(fragment));
}

/**
 * Unwrap the week's tax and hand the resulting BTB to settlement.
 *
 * OPOS is a hard-pegged wrapper, so there is no swap here and no market risk:
 * burn(N) returns exactly N / 1e6 BTB. Only a whole multiple of the ratio can
 * be burned, so the remainder stays in the treasury and simply joins next
 * week's balance.
 */
export const settle = internalAction({
  args: { epochId: v.float64() },
  handler: async (ctx, { epochId }): Promise<{ skipped: boolean; state?: string; queued?: number; potRaw?: string }> => {
    try {
      const epoch = await ctx.runQuery(internal.rewards.getEpoch, { epochId });
      if (!epoch || epoch.state !== "burning") return { skipped: true };

      // The pot is measured as the treasury's whole BTB balance, so an earlier
      // epoch still owed money must finish paying before this one is priced.
      if (await ctx.runQuery(internal.rewards.hasUnfinishedPayouts, {})) {
        throw new Error("A previous epoch is still paying out");
      }

      const { account, opos, publicClient } = clients();
      const configured = await publicClient.readContract({ address: opos, abi: OPOS_ABI, functionName: "treasury" });
      if (!same(configured, account.address)) {
        throw new Error("OPOS treasury is not the configured rewards wallet");
      }

      const balance = await publicClient.readContract({
        address: opos, abi: ERC20_ABI, functionName: "balanceOf", args: [account.address],
      });
      const burnable = (balance / MINT_RATIO) * MINT_RATIO;

      // A quiet week can leave less than the 1 BTB minimum. Not a failure —
      // skip the burn and split whatever BTB is already in the wallet.
      let burnTxHash: string | undefined;
      if (burnable >= MIN_OPOS_BURN) {
        burnTxHash = await send(opos, encodeFunctionData({ abi: OPOS_ABI, functionName: "burn", args: [burnable] }));
      }

      // Read the pot after the burn rather than assuming burnable / 1e6. This
      // also sweeps up dust, BTB from a burn we lost track of, and BTB from a
      // payout that permanently failed.
      const pot = await publicClient.readContract({
        address: BTB, abi: ERC20_ABI, functionName: "balanceOf", args: [account.address],
      });

      return await ctx.runMutation(internal.rewards.settleEpoch, {
        epochId,
        oposBurnedRaw: burnable >= MIN_OPOS_BURN ? burnable.toString() : "0",
        potRaw: pot.toString(),
        burnTxHash,
      });
    } catch (reason) {
      await ctx.runMutation(internal.rewards.markEpochFailed, { epochId, error: messageOf(reason) });
      throw reason;
    }
  },
});

/**
 * Send one queued BTB payout, then chain to the next. Serial by design — the
 * treasury is a single EOA, and the lease in claimPayout is what stops two
 * drains from reusing a nonce.
 */
export const drain = internalAction({
  args: {},
  handler: async (ctx): Promise<{ processed: boolean; locked?: boolean; payoutId?: Id<"rewardPayouts">; error?: string }> => {
    const workerId = crypto.randomUUID();
    const claimed: { locked: boolean; retryAfter: number; payout: Doc<"rewardPayouts"> | null } =
      await ctx.runMutation(internal.rewards.claimPayout, { workerId });
    if (!claimed.payout) {
      if (claimed.locked) {
        await ctx.scheduler.runAfter(Math.min(5_000, Math.max(1_000, claimed.retryAfter)), internal.rewardsActions.drain, {});
      }
      return { processed: false, locked: claimed.locked };
    }

    const payout = claimed.payout;
    try {
      if (!isAddress(payout.walletAddress)) throw new Error("Invalid recipient address");
      // A reclaimed row that already has a hash was broadcast by a previous
      // attempt — wait on that transaction instead of sending the BTB twice.
      let hash = payout.txHash as Hex | undefined;
      if (!hash) {
        hash = await broadcast(BTB, encodeFunctionData({
          abi: ERC20_ABI, functionName: "transfer",
          args: [payout.walletAddress as Address, BigInt(payout.amountRaw)],
        }));
        await ctx.runMutation(internal.rewards.markPayoutSubmitted, { payoutId: payout._id, workerId, txHash: hash });
      }
      await confirm(hash);
      await ctx.runMutation(internal.rewards.completePayout, { payoutId: payout._id, workerId, txHash: hash });
      await ctx.scheduler.runAfter(0, internal.rewardsActions.drain, {});
      return { processed: true, payoutId: payout._id };
    } catch (reason) {
      const error = messageOf(reason).slice(0, 600);
      await ctx.runMutation(internal.rewards.releasePayout, {
        payoutId: payout._id, workerId, error, terminal: terminalFailure(error),
      });
      await ctx.scheduler.runAfter(Math.min(30_000, 2_000 * 2 ** Math.max(0, payout.attempts - 1)), internal.rewardsActions.drain, {});
      return { processed: true, payoutId: payout._id, error };
    }
  },
});
