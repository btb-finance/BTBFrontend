import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { createPublicClient, erc20Abi, formatUnits, http, isAddress } from "viem";
import { mainnet } from "viem/chains";
import { MAINNET_RPCS } from "../src/lib/rpc";
import { CONTRACTS } from "../src/lib/contractAddresses";


/**
 * The wallet's BTB, asked of three different Ethereum RPCs at once, keeping the highest answer. A node that has
 * fallen behind answers from an old block and can only under-report (one returned 0 for a wallet holding 28,209
 * BTB on 2026-10-03, costing it the holding bonus); none can report BTB that is not there. Null only if all fail.
 */
async function btbBalanceOf(wallet: `0x${string}`): Promise<bigint | null> {
  const urls = [...MAINNET_RPCS].sort(() => Math.random() - 0.5).slice(0, 3);
  const reads = await Promise.allSettled(urls.map((url) =>
    createPublicClient({ chain: mainnet, transport: http(url, { timeout: 8_000 }) })
      .readContract({ address: CONTRACTS.BTB, abi: erc20Abi, functionName: "balanceOf", args: [wallet] })));
  const ok = reads.filter((r): r is PromiseFulfilledResult<bigint> => r.status === "fulfilled").map((r) => r.value);
  return ok.length ? ok.reduce((a, b) => (b > a ? b : a)) : null;
}

/**
 * Daily check-in. Reads the wallet's BTB on-chain so the holder bonus rests on
 * the chain, never on a number the client sends. A failed read still checks
 * in; it just earns no bonus today.
 */
export const checkIn = action({
  args: { walletAddress: v.string() },
  handler: async (ctx, { walletAddress }): Promise<{ alreadyCheckedIn: boolean; dailyXp?: number; weekMilestone?: number; holdBonus?: number; newStreak?: number }> => {
    if (!isAddress(walletAddress)) throw new Error("Invalid wallet address");
    const raw = await btbBalanceOf(walletAddress as `0x${string}`);
    const btbBalance = raw == null ? undefined : Number(formatUnits(raw, 18));
    const r = await ctx.runMutation(internal.users.recordCheckIn, { walletAddress, btbBalance });
    if (r.alreadyCheckedIn) return { alreadyCheckedIn: true };
    return { alreadyCheckedIn: false, dailyXp: r.dailyXp, weekMilestone: r.weekMilestone, holdBonus: r.holdBonus, newStreak: r.newStreak };
  },
});
