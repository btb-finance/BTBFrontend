"use node";

import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { createPublicClient, http, fallback, erc20Abi, formatUnits, parseAbi, parseEventLogs, verifyMessage, isAddress, isHash, BaseError, ContractFunctionRevertedError } from "viem";
import { mainnet } from "viem/chains";
import webpush from "web-push";
import { getChainClient } from "../src/lib/chainClient";
import { fetchV3Positions, fetchV4Positions } from "../src/protocols/dexs/uniswap";
import { deploymentOfPosition, v4DeploymentOfPosition } from "../src/protocols/lpChains";
import type { LiquidityPosition } from "../src/protocols/types";
import { ALERT_MIN_BTB } from "./alerts";
import { FAST_CHECK_BTB, FREE_CHECK_MS, DEPOSIT_MAX_AGE_MS, SIGNATURE_MAX_AGE_MS, alertAuthMessage, FAST_ON_ACTION } from "./alertMessages";

const BTB = "0x88888888c90CD71B35830daBFD24743DbC135B51" as const;
const OPOS = "0x88888805E7e3d5c7FB002AD98f08250E79c298dC" as const;
/** Reads that throw this many times in a row drop the alert (about a day at hourly). */
const MAX_READ_FAILURES = 24;
const MAINNET = ["https://eth.api.pocket.network", "https://gateway.tenderly.co/public/mainnet", "https://eth.rpc.blxrbdn.com", "https://ethereum-rpc.publicnode.com", "https://eth.drpc.org"];

const mainnetClient = () => createPublicClient({ chain: mainnet, transport: fallback(MAINNET.map((u) => http(u, { timeout: 10_000 }))) });

/** The OPOS treasury, which is also the rewards wallet: alert deposits join the weekly pot. */
async function readTreasury(): Promise<string> {
  return mainnetClient().readContract({ address: OPOS, abi: parseAbi(["function treasury() view returns (address)"]), functionName: "treasury" });
}

async function btbBalance(address: `0x${string}`): Promise<number> {
  const client = mainnetClient();
  const raw = await client.readContract({ address: BTB, abi: erc20Abi, functionName: "balanceOf", args: [address] });
  return parseFloat(formatUnits(raw, 18));
}

function configurePush(): boolean {
  const pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:hello@btb.finance", pub, priv);
  return true;
}

/** Subscribe one position. Verifies the BTB balance on-chain first. */
export const subscribe = action({
  args: { address: v.string(), chainId: v.float64(), protocol: v.string(), tokenId: v.string(), label: v.string(), inRange: v.optional(v.boolean()) },
  handler: async (ctx, a) => {
    // A plain result, not a thrown error: thrown errors reach the client wrapped
    // in Convex's request framing, which is not something to show a user.
    const bal = await btbBalance(a.address as `0x${string}`).catch(() => null);
    if (bal == null) return { ok: false as const, reason: "Could not read your BTB balance right now. Try again in a moment." };
    if (bal < ALERT_MIN_BTB) return { ok: false as const, reason: `Alerts need ${ALERT_MIN_BTB.toLocaleString("en-US")} BTB; this wallet holds ${Math.floor(bal).toLocaleString("en-US")}.`, balance: bal };
    await ctx.runMutation(internal.alerts.upsert, a);
    return { ok: true as const, balance: bal };
  },
});

/** Read one position's range state. Null when the position is gone. */
async function readInRange(chainId: number, protocol: string, tokenId: string, owner: `0x${string}`): Promise<boolean | null> {
  const client = getChainClient(chainId);
  if (!client) return null;
  const stub = { protocol, chainId } as LiquidityPosition;
  const id = BigInt(tokenId);
  const rows = protocol === "uniswap-v4"
    ? await fetchV4Positions(client, owner, [id], v4DeploymentOfPosition(stub), 0n)
    : await fetchV3Positions(client, owner, deploymentOfPosition(stub), [id]);
  const p = rows[0];
  if (!p || p.liquidity === 0n) return null;
  return p.inRange;
}

/** True when the position NFT no longer exists: ownerOf reverts for a burned id. */
async function positionBurned(chainId: number, protocol: string, tokenId: string): Promise<boolean> {
  const client = getChainClient(chainId);
  if (!client) return false;
  const stub = { protocol, chainId } as LiquidityPosition;
  const manager = protocol === "uniswap-v4" ? v4DeploymentOfPosition(stub)?.positionManager : deploymentOfPosition(stub)?.positionManager;
  if (!manager) return false;
  try {
    await client.readContract({ address: manager, abi: parseAbi(["function ownerOf(uint256) view returns (address)"]), functionName: "ownerOf", args: [BigInt(tokenId)] });
    return false;
  } catch (e) {
    // Only a contract revert means gone; a timeout or rate limit says nothing.
    return e instanceof BaseError && !!e.walk((err) => err instanceof ContractFunctionRevertedError);
  }
}

/**
 * Every five minutes: re-read each due alert's position, write an inbox
 * event and push on every range change, drop alerts whose wallet sold below
 * the threshold (re-checked hourly per wallet) or whose position is gone.
 * Due means hourly for free alerts, every tick for a wallet paying for fast
 * checks (FAST_CHECK_BTB per successful read).
 */
export const check = internalAction({
  args: {},
  handler: async (ctx) => {
    if (process.env.DISABLE_CRONS) return;
    const alerts = await ctx.runQuery(internal.alerts.activeAlerts, {});
    if (alerts.length === 0) return;
    const push = configurePush();
    const balanceCache = new Map<string, number>();
    // Fast wallets pay per read; track what is left inside this run so a
    // wallet with many positions cannot spend past its balance.
    const fastLeft = new Map((await ctx.runQuery(internal.alerts.fastWallets, {})).map((w) => [w.address, w.balance]));
    const started = Date.now();
    // Oldest first, so a run cut short by the time budget does not starve the same rows.
    alerts.sort((a, b) => (a.lastCheckedAt ?? 0) - (b.lastCheckedAt ?? 0));
    for (const alert of alerts) {
      if (Date.now() - started > 8 * 60_000) break;
      const owner = alert.address as `0x${string}`;
      const left = fastLeft.get(alert.address) ?? 0;
      const fast = left >= FAST_CHECK_BTB;
      // Free alerts are read hourly. A few seconds of slack so a row checked
      // near the end of one tick is still due on the tick an hour later.
      const due = fast || !alert.lastCheckedAt || Date.now() - alert.lastCheckedAt >= FREE_CHECK_MS - 60_000;
      if (!due) continue;
      // Balance gate, one read per wallet per run and only once an hour.
      const staleGate = !alert.lastCheckedAt || Date.now() - alert.lastCheckedAt > 60 * 60_000;
      if (staleGate) {
        let bal = balanceCache.get(owner);
        if (bal == null) { bal = await btbBalance(owner).catch(() => Number.POSITIVE_INFINITY); balanceCache.set(owner, bal); }
        if (bal < ALERT_MIN_BTB) { await ctx.runMutation(internal.alerts.recordCheck, { id: alert._id, deactivate: true }); continue; }
      }
      let inRange: boolean | null;
      try { inRange = await readInRange(alert.chainId, alert.protocol, alert.tokenId, owner); } catch {
        // A read that throws used to be skipped forever, so a position whose
        // NFT was burned stayed "watched". Burned means gone now; anything
        // else counts toward MAX_READ_FAILURES.
        if (await positionBurned(alert.chainId, alert.protocol, alert.tokenId)) await ctx.runMutation(internal.alerts.recordCheck, { id: alert._id, deactivate: true });
        else await ctx.runMutation(internal.alerts.recordFailure, { id: alert._id, maxFailures: MAX_READ_FAILURES });
        continue;
      }
      if (inRange == null) { await ctx.runMutation(internal.alerts.recordCheck, { id: alert._id, deactivate: true }); continue; }
      const changed = alert.lastInRange != null && alert.lastInRange !== inRange;
      if (fast) fastLeft.set(alert.address, left - FAST_CHECK_BTB);
      await ctx.runMutation(internal.alerts.recordCheck, { id: alert._id, inRange, charge: fast ? FAST_CHECK_BTB : undefined });
      if (!changed) continue;
      const kind = inRange ? "in" : "out";
      const message = inRange ? `${alert.label} is back in range and earning fees.` : `${alert.label} moved out of range. Rebalance to keep earning.`;
      await ctx.runMutation(internal.alerts.pushEvent, { address: alert.address, kind, label: alert.label, message });
      if (!push) continue;
      const subs = await ctx.runQuery(internal.alerts.subscriptionsFor, { address: alert.address });
      for (const s of subs) {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ title: inRange ? "Back in range" : "Out of range", body: message, url: "/portfolio" }), { TTL: 3600 });
        } catch (e) {
          const code = (e as { statusCode?: number })?.statusCode;
          if (code === 404 || code === 410) await ctx.runMutation(internal.alerts.dropSubscription, { endpoint: s.endpoint });
        }
      }
    }
  },
});

// ── Fast-check balance ──────────────────────────────────────────────────────

type Result = { ok: true; amount?: number } | { ok: false; reason: string };

async function checkAuth(wallet: string, action: string, issuedAt: number, signature: string): Promise<string | null> {
  if (!isAddress(wallet)) return "Invalid wallet address.";
  if (Math.abs(Date.now() - issuedAt) > SIGNATURE_MAX_AGE_MS) return "Signature expired, try again.";
  const ok = await verifyMessage({ address: wallet as `0x${string}`, message: alertAuthMessage(wallet, action, issuedAt), signature: signature as `0x${string}` }).catch(() => false);
  return ok ? null : "Signature did not verify.";
}

/**
 * Credit a BTB transfer to the treasury. The sender of the transfer is the
 * wallet credited, so pasting someone else's hash only tops up their balance.
 * Each hash is credited once, and only within a day of its block.
 */
export const depositFromTx = action({
  args: { txHash: v.string() },
  handler: async (ctx, { txHash }): Promise<Result> => {
    const hash = txHash.trim().toLowerCase();
    if (!isHash(hash)) return { ok: false, reason: "That is not a transaction hash." };
    const client = mainnetClient();
    const receipt = await client.getTransactionReceipt({ hash }).catch(() => null);
    if (!receipt) return { ok: false, reason: "Transaction not found on Ethereum yet. Wait for it to confirm, then paste it again." };
    if (receipt.status !== "success") return { ok: false, reason: "That transaction failed on-chain." };
    const block = await client.getBlock({ blockNumber: receipt.blockNumber });
    if (Date.now() - Number(block.timestamp) * 1000 > DEPOSIT_MAX_AGE_MS) return { ok: false, reason: "This transaction is more than a day old and can no longer be used." };
    const treasury = (await readTreasury()).toLowerCase();
    const transfers = parseEventLogs({ abi: erc20Abi, eventName: "Transfer", logs: receipt.logs })
      .filter((l) => l.address.toLowerCase() === BTB.toLowerCase() && l.args.to.toLowerCase() === treasury);
    if (transfers.length === 0) return { ok: false, reason: "No BTB was sent to the treasury in that transaction." };
    const senders = new Set(transfers.map((l) => l.args.from.toLowerCase()));
    if (senders.size > 1) return { ok: false, reason: "That transaction has BTB from several wallets. Send from one wallet." };
    const [from] = [...senders];
    const amount = Number(formatUnits(transfers.reduce((sum, l) => sum + l.args.value, 0n), 18));
    if (amount < FAST_CHECK_BTB) return { ok: false, reason: `Send at least ${FAST_CHECK_BTB} BTB.` };
    const { ok } = await ctx.runMutation(internal.alerts.creditDeposit, { txHash: hash, address: from, amount });
    if (!ok) return { ok: false, reason: "That transaction was already credited." };
    return { ok: true, amount };
  },
});

/** Turn fast checks on. Signed, because they spend the wallet's balance. */
export const enableFast = action({
  args: { address: v.string(), issuedAt: v.float64(), signature: v.string() },
  handler: async (ctx, a): Promise<Result> => {
    const problem = await checkAuth(a.address, FAST_ON_ACTION, a.issuedAt, a.signature);
    if (problem) return { ok: false, reason: problem };
    await ctx.runMutation(internal.alerts.setFastVerified, { address: a.address, fast: true });
    return { ok: true };
  },
});

/** Where deposits go: the OPOS treasury, read on-chain so it can never drift. */
export const depositAddress = action({
  args: {},
  handler: async (): Promise<string> => readTreasury(),
});
