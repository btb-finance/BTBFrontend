"use node";

import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { createPublicClient, http, fallback, erc20Abi, formatUnits } from "viem";
import { mainnet } from "viem/chains";
import webpush from "web-push";
import { getChainClient } from "../src/lib/chainClient";
import { fetchV3Positions, fetchV4Positions } from "../src/protocols/dexs/uniswap";
import { deploymentOfPosition, v4DeploymentOfPosition } from "../src/protocols/lpChains";
import type { LiquidityPosition } from "../src/protocols/types";
import { ALERT_MIN_BTB } from "./alerts";

const BTB = "0x88888888c90CD71B35830daBFD24743DbC135B51" as const;
const MAINNET = ["https://eth.api.pocket.network", "https://gateway.tenderly.co/public/mainnet", "https://eth.rpc.blxrbdn.com", "https://ethereum-rpc.publicnode.com", "https://eth.drpc.org"];

async function btbBalance(address: `0x${string}`): Promise<number> {
  const client = createPublicClient({ chain: mainnet, transport: fallback(MAINNET.map((u) => http(u, { timeout: 10_000 }))) });
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
    const bal = await btbBalance(a.address as `0x${string}`);
    if (bal < ALERT_MIN_BTB) throw new Error(`Alerts need ${ALERT_MIN_BTB.toLocaleString("en-US")} BTB; this wallet holds ${Math.floor(bal).toLocaleString("en-US")}.`);
    await ctx.runMutation(internal.alerts.upsert, a);
    return { ok: true, balance: bal };
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

/**
 * Every five minutes: re-read each active alert's position, write an inbox
 * event and push on every range change, drop alerts whose wallet sold below
 * the threshold (re-checked hourly per wallet) or whose position is gone.
 */
export const check = internalAction({
  args: {},
  handler: async (ctx) => {
    if (process.env.DISABLE_CRONS) return;
    const alerts = await ctx.runQuery(internal.alerts.activeAlerts, {});
    if (alerts.length === 0) return;
    const push = configurePush();
    const balanceCache = new Map<string, number>();
    const started = Date.now();
    for (const alert of alerts) {
      if (Date.now() - started > 8 * 60_000) break;
      const owner = alert.address as `0x${string}`;
      // Balance gate, one read per wallet per run and only once an hour.
      const staleGate = !alert.lastCheckedAt || Date.now() - alert.lastCheckedAt > 60 * 60_000;
      if (staleGate) {
        let bal = balanceCache.get(owner);
        if (bal == null) { bal = await btbBalance(owner).catch(() => Number.POSITIVE_INFINITY); balanceCache.set(owner, bal); }
        if (bal < ALERT_MIN_BTB) { await ctx.runMutation(internal.alerts.recordCheck, { id: alert._id, deactivate: true }); continue; }
      }
      let inRange: boolean | null;
      try { inRange = await readInRange(alert.chainId, alert.protocol, alert.tokenId, owner); } catch { continue; }
      if (inRange == null) { await ctx.runMutation(internal.alerts.recordCheck, { id: alert._id, deactivate: true }); continue; }
      const changed = alert.lastInRange != null && alert.lastInRange !== inRange;
      await ctx.runMutation(internal.alerts.recordCheck, { id: alert._id, inRange });
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
