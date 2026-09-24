import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { erc20Abi, formatUnits, isAddress } from "viem";
import { getChainClient } from "../src/lib/chainClient";
import { CONTRACTS } from "../src/lib/contractAddresses";


/**
 * Daily check-in. Reads the wallet's BTB on-chain so the holder bonus rests on
 * the chain, never on a number the client sends. A failed read still checks
 * in; it just earns no bonus today.
 */
export const checkIn = action({
  args: { walletAddress: v.string() },
  handler: async (ctx, { walletAddress }): Promise<{ alreadyCheckedIn: boolean; dailyXp?: number; weekMilestone?: number; holdBonus?: number; newStreak?: number }> => {
    if (!isAddress(walletAddress)) throw new Error("Invalid wallet address");
    const client = getChainClient(1);
    const raw = !client ? null : await client.readContract({ address: CONTRACTS.BTB, abi: erc20Abi, functionName: "balanceOf", args: [walletAddress as `0x${string}`] }).catch(() => null);
    const btbBalance = raw == null ? undefined : Number(formatUnits(raw, 18));
    const r = await ctx.runMutation(internal.users.recordCheckIn, { walletAddress, btbBalance });
    if (r.alreadyCheckedIn) return { alreadyCheckedIn: true };
    return { alreadyCheckedIn: false, dailyXp: r.dailyXp, weekMilestone: r.weekMilestone, holdBonus: r.holdBonus, newStreak: r.newStreak };
  },
});
