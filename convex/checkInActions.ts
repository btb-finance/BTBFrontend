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

/** Ethereum RPCs that answered balance reads up to 7,000 blocks back when tested on 2026-10-07 (most public nodes
 * keep only recent state). Used for the random snapshot below. */
const ARCHIVE_RPCS = [
  'https://rpc-eth.blockmachine.io', 'https://ethereum-json-rpc.stakely.io', 'https://gateway.tenderly.co/public/mainnet',
  'https://mainnet.rpc.sentio.xyz', 'https://1.rpc.thirdweb.com', 'https://rpc.swiftnodes.io/rpc/eth',
  'https://ethereum-public.nodies.app', 'https://eth.drpc.org',
];
/** Ethereum makes a block every 12 s: about 7,200 a day. */
const BLOCKS_PER_DAY = 7_200;

/**
 * The wallet's BTB at a random block in the last 24 hours. Stops one balance being counted by several wallets: moved
 * between them so each holds it at its own check-in, it sits in only one of them at a random moment, so across all of
 * them the bonus adds up to what one holder earns. The block is drawn here, after the fact, with a secure random
 * number, so it cannot be predicted or timed. Null if no archive RPC answered.
 */
async function btbBalanceAtRandomBlock(wallet: `0x${string}`): Promise<bigint | null> {
  const urls = [...ARCHIVE_RPCS].sort(() => Math.random() - 0.5);
  const pick = new Uint32Array(1);
  crypto.getRandomValues(pick);
  const back = 5n + BigInt(pick[0] % BLOCKS_PER_DAY);
  for (let i = 0; i < urls.length; i += 3) {
    const clients = urls.slice(i, i + 3).map((url) => createPublicClient({ chain: mainnet, transport: http(url, { timeout: 8_000 }) }));
    const latest = await Promise.any(clients.map((c) => c.getBlockNumber())).catch(() => null);
    if (latest == null) continue;
    const reads = await Promise.allSettled(clients.map((c) =>
      c.readContract({ address: CONTRACTS.BTB, abi: erc20Abi, functionName: "balanceOf", args: [wallet], blockNumber: latest - back })));
    const ok = reads.filter((r): r is PromiseFulfilledResult<bigint> => r.status === "fulfilled").map((r) => r.value);
    if (ok.length) return ok.reduce((a, b) => (b > a ? b : a));
  }
  return null;
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
    const [raw, snap] = await Promise.all([
      btbBalanceOf(walletAddress as `0x${string}`),
      btbBalanceAtRandomBlock(walletAddress as `0x${string}`),
    ]);
    const btbBalance = raw == null ? undefined : Number(formatUnits(raw, 18));
    const btbSnapshot = snap == null ? undefined : Number(formatUnits(snap, 18));
    const r = await ctx.runMutation(internal.users.recordCheckIn, { walletAddress, btbBalance, btbSnapshot });
    if (r.alreadyCheckedIn) return { alreadyCheckedIn: true };
    return { alreadyCheckedIn: false, dailyXp: r.dailyXp, weekMilestone: r.weekMilestone, holdBonus: r.holdBonus, newStreak: r.newStreak };
  },
});
