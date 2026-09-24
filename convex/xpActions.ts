import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { erc20Abi, erc721Abi, isAddress, isHash, parseEventLogs } from "viem";
import { getChainClient } from "../src/lib/chainClient";
import { CONTRACTS } from "../src/lib/contractAddresses";
import { SWAP_XP, MINT_XP } from "./xpRules";

const BEAR_NFT = CONTRACTS.BEAR_NFT;
/** A transaction older than this earns nothing; the app asks right after it confirms. */
const MAX_AGE_MS = 2 * 60 * 60_000;

type Result = { ok: boolean; awarded: number; reason?: string };

/**
 * XP for a swap, bridge or Bear mint, decided from the transaction itself.
 * The client sends only the hash: the server checks it succeeded, is recent,
 * involves the wallet, and has not been paid before, then sets the amount.
 * Replaces the old public awardXp, which took any amount for any address.
 */
export const awardTxXp = action({
  args: { walletAddress: v.string(), chainId: v.float64(), txHash: v.string(), kind: v.union(v.literal("swap"), v.literal("bridge"), v.literal("mint")) },
  handler: async (ctx, { walletAddress, chainId, txHash, kind }): Promise<Result> => {
    if (!isAddress(walletAddress) || !isHash(txHash)) return { ok: false, awarded: 0, reason: "bad input" };
    const wallet = walletAddress.toLowerCase();
    const client = getChainClient(chainId);
    if (!client) return { ok: false, awarded: 0, reason: "unsupported chain" };

    // The app calls this the moment its own RPC saw the receipt; ours can lag a block or two.
    let receipt = null;
    for (let i = 0; i < 4 && !receipt; i++) {
      receipt = await client.getTransactionReceipt({ hash: txHash as `0x${string}` }).catch(() => null);
      if (!receipt) await new Promise((r) => setTimeout(r, 2_000));
    }
    if (!receipt || receipt.status !== "success") return { ok: false, awarded: 0, reason: "transaction not found or failed" };
    const [tx, block] = await Promise.all([
      client.getTransaction({ hash: txHash as `0x${string}` }),
      client.getBlock({ blockNumber: receipt.blockNumber }),
    ]);
    if (Date.now() - Number(block.timestamp) * 1000 > MAX_AGE_MS) return { ok: false, awarded: 0, reason: "transaction too old" };

    let xp = 0;
    if (kind === "mint") {
      if (chainId !== 1) return { ok: false, awarded: 0, reason: "wrong chain" };
      const minted = parseEventLogs({ abi: erc721Abi, eventName: "Transfer", logs: receipt.logs, strict: false })
        .filter((l) => l.address.toLowerCase() === BEAR_NFT.toLowerCase() && l.args.from === "0x0000000000000000000000000000000000000000" && l.args.to?.toLowerCase() === wallet);
      xp = Math.min(minted.length, 200) * MINT_XP;
    } else {
      // The wallet must be the sender, or (smart accounts, where a bundler
      // sends) move tokens in or out in this transaction. A plain transfer to
      // yourself has no token movement and earns nothing.
      const moved = parseEventLogs({ abi: erc20Abi, eventName: "Transfer", logs: receipt.logs, strict: false })
        .some((l) => l.args.from?.toLowerCase() === wallet || l.args.to?.toLowerCase() === wallet);
      const sent = tx.from.toLowerCase() === wallet;
      if (!(moved || (sent && receipt.logs.length > 0))) return { ok: false, awarded: 0, reason: "wallet not in transaction" };
      xp = SWAP_XP;
    }
    if (xp <= 0) return { ok: false, awarded: 0, reason: "nothing to award" };
    return ctx.runMutation(internal.users.creditTxXp, { walletAddress: wallet, key: `tx:${chainId}:${txHash.toLowerCase()}`, xp, capped: kind !== "mint" });
  },
});
