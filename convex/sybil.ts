/**
 * One person, one share: spotting many wallets behind one person, and the rules the Friday split applies (2026-10-29).
 *
 * Every check-in records where it came from (checkInSignals): a salted hash of the IP and of its network, a random id
 * kept in the browser, and a hash of browser traits. At settlement:
 *  - Wallets linked by the same browser id, or by the same browser traits AND the same IP, are one cluster. A cluster
 *    is paid like one person: it counts the XP of its best wallet, split among its wallets by their own XP.
 *  - Sharing an IP alone (a home, an office, a mobile network) is only shown on the admin page, never acted on.
 *  - A wallet with no on-chain history anywhere (checked by rewardsActions.settle) does not share the pot until it has
 *    made one transaction, so each extra wallet costs its maker gas.
 * Nothing here asks users to sign anything.
 */
import { internalMutation, internalQuery, query } from "./_generated/server";
import { v } from "convex/values";
import { sessionWallet } from "./sessions";
import { epochIdAt } from "./xpRules";

export type Signal = { walletAddress: string; ipHash?: string; netHash?: string; deviceId?: string; fpHash?: string };
export type Cluster = { wallets: string[]; links: string[] };

/** Groups wallets that look like one person: same browser id, or same browser traits from the same IP. */
export function clusterWallets(signals: Signal[]): Cluster[] {
  const parent = new Map<string, string>();
  const find = (a: string): string => {
    let r = a;
    while (parent.get(r) !== r) r = parent.get(r)!;
    parent.set(a, r);
    return r;
  };
  const links = new Map<string, Set<string>>();
  const union = (a: string, b: string, why: string) => {
    for (const w of [a, b]) if (!parent.has(w)) parent.set(w, w);
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
    for (const w of [a, b]) links.set(w, (links.get(w) ?? new Set()).add(why));
  };
  for (const s of signals) if (!parent.has(s.walletAddress)) parent.set(s.walletAddress, s.walletAddress);

  const byKey = new Map<string, string[]>();
  for (const s of signals) {
    if (s.deviceId) byKey.set(`device:${s.deviceId}`, [...(byKey.get(`device:${s.deviceId}`) ?? []), s.walletAddress]);
    if (s.fpHash && s.ipHash) byKey.set(`fpip:${s.fpHash}:${s.ipHash}`, [...(byKey.get(`fpip:${s.fpHash}:${s.ipHash}`) ?? []), s.walletAddress]);
  }
  for (const [key, ws] of byKey) {
    const uniq = [...new Set(ws)];
    for (let i = 1; i < uniq.length; i++) union(uniq[0], uniq[i], key.startsWith("device:") ? "same browser" : "same browser traits and IP");
  }
  const groups = new Map<string, string[]>();
  for (const w of parent.keys()) groups.set(find(w), [...(groups.get(find(w)) ?? []), w]);
  return [...groups.values()]
    .filter((ws) => ws.length > 1)
    .map((ws) => ({ wallets: ws.sort(), links: [...new Set(ws.flatMap((w) => [...(links.get(w) ?? [])]))] }));
}

/** Wallets that only share an IP with others (no stronger link): shown on the admin page, never acted on. */
export function sharedIpOnly(signals: Signal[], clusters: Cluster[]): { ipHash: string; wallets: string[] }[] {
  const clustered = new Set(clusters.flatMap((c) => c.wallets));
  const byIp = new Map<string, Set<string>>();
  for (const s of signals) if (s.ipHash) byIp.set(s.ipHash, (byIp.get(s.ipHash) ?? new Set()).add(s.walletAddress));
  return [...byIp].map(([ipHash, ws]) => ({ ipHash, wallets: [...ws] }))
    .filter((x) => x.wallets.length > 1 && x.wallets.some((w) => !clustered.has(w)));
}

/**
 * XP each wallet counts in the split. A cluster counts as one person: the XP of its best wallet, shared among its
 * wallets in proportion to their own XP. A wallet that is not eligible (no on-chain history) counts 0.
 */
export function countedPoints(
  earners: { walletAddress: string; points: number }[],
  clusters: Cluster[],
  eligible: (wallet: string) => boolean,
): Map<string, { points: number; note?: string }> {
  const out = new Map<string, { points: number; note?: string }>();
  for (const e of earners) out.set(e.walletAddress, eligible(e.walletAddress) ? { points: e.points } : { points: 0, note: "no on-chain history yet" });
  for (const c of clusters) {
    const members = c.wallets.filter((w) => (out.get(w)?.points ?? 0) > 0);
    if (members.length < 2) continue;
    const pts = members.map((w) => out.get(w)!.points);
    const sum = pts.reduce((a, b) => a + b, 0);
    const best = Math.max(...pts);
    for (const w of members) {
      const p = out.get(w)!.points;
      out.set(w, { points: (p / sum) * best, note: `one of ${members.length} wallets that look like one person (${c.links.join(", ")})` });
    }
  }
  return out;
}

// ── Recording ───────────────────────────────────────────────────────────────

export const recordSignal = internalMutation({
  args: { walletAddress: v.string(), ipHash: v.optional(v.string()), netHash: v.optional(v.string()), deviceId: v.optional(v.string()), fpHash: v.optional(v.string()) },
  handler: async (ctx, a) => {
    const wallet = a.walletAddress.toLowerCase();
    const at = Date.now();
    const day = Math.floor(at / 86_400_000);
    // One row per wallet, day and source: a reload the same day does not add rows.
    const today = await ctx.db.query("checkInSignals").withIndex("by_wallet_day", (q) => q.eq("walletAddress", wallet).eq("day", day)).collect();
    if (today.some((r) => r.ipHash === a.ipHash && r.deviceId === a.deviceId && r.fpHash === a.fpHash)) return;
    await ctx.db.insert("checkInSignals", { walletAddress: wallet, epochId: epochIdAt(at), day, at, ipHash: a.ipHash, netHash: a.netHash, deviceId: a.deviceId, fpHash: a.fpHash });
  },
});

export const epochSignals = internalQuery({
  args: { epochId: v.float64() },
  handler: (ctx, { epochId }) => ctx.db.query("checkInSignals").withIndex("by_epoch", (q) => q.eq("epochId", epochId)).collect(),
});

export const epochEarners = internalQuery({
  args: { epochId: v.float64() },
  handler: async (ctx, { epochId }) => (await ctx.db.query("epochPoints").withIndex("by_epoch", (q) => q.eq("epochId", epochId)).collect())
    .filter((r) => r.points > 0).map((r) => ({ walletAddress: r.walletAddress, points: r.points })),
});

// ── Admin page ──────────────────────────────────────────────────────────────

/** Wallets allowed to read the admin page: ADMIN_WALLETS in the Convex environment, comma separated. */
function isAdmin(wallet: string | null): boolean {
  if (!wallet) return false;
  return (process.env.ADMIN_WALLETS ?? "").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean).includes(wallet.toLowerCase());
}

/**
 * Check-ins per day for the last two weeks (wallets, browsers, IPs, new wallets), and this week's clusters and shared
 * IPs with each wallet's XP. Only for an admin wallet's signed session.
 */
export const adminStats = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const wallet = await sessionWallet(ctx, sessionToken);
    if (!isAdmin(wallet)) return { ok: false as const, reason: wallet ? "This wallet is not an admin." : "Sign in again." };
    const today = Math.floor(Date.now() / 86_400_000);
    const since = (today - 13) * 86_400_000;
    const newUsers = (await ctx.db.query("users").collect()).filter((u) => u.joinedAt >= since);
    const days = [];
    for (let d = today - 13; d <= today; d++) {
      const rows = await ctx.db.query("checkInSignals").withIndex("by_day", (q) => q.eq("day", d)).collect();
      days.push({
        day: d,
        wallets: new Set(rows.map((r) => r.walletAddress)).size,
        devices: new Set(rows.map((r) => r.deviceId).filter(Boolean)).size,
        ips: new Set(rows.map((r) => r.ipHash).filter(Boolean)).size,
        newWallets: newUsers.filter((u) => Math.floor(u.joinedAt / 86_400_000) === d).length,
      });
    }

    const epochId = epochIdAt();
    const signals = await ctx.db.query("checkInSignals").withIndex("by_epoch", (q) => q.eq("epochId", epochId)).collect();
    const points = new Map((await ctx.db.query("epochPoints").withIndex("by_epoch", (q) => q.eq("epochId", epochId)).collect()).map((r) => [r.walletAddress, r.points]));
    const clusters = clusterWallets(signals);
    const withPts = (ws: string[]) => ws.map((w) => ({ wallet: w, points: points.get(w) ?? 0 })).sort((a, b) => b.points - a.points);
    const last = await ctx.db.query("rewardRequests").withIndex("by_epoch", (q) => q.eq("epochId", epochId - 1)).collect();
    return {
      ok: true as const,
      days,
      epochId,
      walletsThisWeek: new Set(signals.map((s) => s.walletAddress)).size,
      clusters: clusters.map((c) => ({ links: c.links, wallets: withPts(c.wallets) })).sort((a, b) => b.wallets.length - a.wallets.length),
      sharedIp: sharedIpOnly(signals, clusters).map((x) => ({ wallets: withPts(x.wallets) })).sort((a, b) => b.wallets.length - a.wallets.length).slice(0, 30),
      lastWeekAdjusted: last.filter((r) => r.note).map((r) => ({ wallet: r.walletAddress, points: r.pointsAtSettle ?? 0, counted: r.pointsCounted ?? 0, note: r.note! })),
    };
  },
});
