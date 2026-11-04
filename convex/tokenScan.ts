/**
 * Token Scan storage and read side. The fetching lives in tokenScanActions.ts.
 * A scan is paid once (SCAN_BTB) by the wallet that runs it; for the next 24
 * hours its result is free for everyone and nothing is fetched again.
 */
import { internalMutation, internalQuery, query, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { spendCredit, availableFor } from "./credit";
import { RESCAN_BTB, RESCAN_MIN_AGE_MS, SCAN_BTB, SCAN_KEEP_MS, SCAN_TTL_MS, type ScanResult } from "./tokenScanConfig";

async function newest(ctx: QueryCtx, chainId: number, token: string) {
  return ctx.db.query("tokenScans")
    .withIndex("by_token", (q) => q.eq("chainId", chainId).eq("token", token.toLowerCase()))
    .order("desc").first();
}

/**
 * The token's scan for the page. While fresh the full result comes back; once
 * it is older than 24 hours only when it ran and its grade, so the page can say
 * "last scanned 3 days ago, grade C" and offer a new scan.
 */
export const forToken = query({
  args: { chainId: v.float64(), token: v.string() },
  handler: async (ctx, { chainId, token }) => {
    const row = await newest(ctx, chainId, token);
    if (!row) return null;
    const expiresAt = row.createdAt + SCAN_TTL_MS;
    const fresh = expiresAt > Date.now();
    return { fresh, createdAt: row.createdAt, expiresAt, symbol: row.symbol, score: row.score, data: fresh ? row.data : null };
  },
});

/** Scans still open, newest first: anyone can read these for free. */
export const recent = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("tokenScans")
      .withIndex("by_created", (q) => q.gt("createdAt", Date.now() - SCAN_TTL_MS))
      .order("desc").take(60);
    const seen = new Set<string>();
    const out: { chainId: number; token: string; symbol: string; score: number; createdAt: number; name: string; logo: string | null; headline: string; tone: string; stance: string; change24h: number | null }[] = [];
    for (const r of rows) {
      const k = `${r.chainId}:${r.token}`;
      if (seen.has(k)) continue;
      seen.add(k);
      let d: ScanResult | null = null;
      try { d = JSON.parse(r.data) as ScanResult; } catch { /* listed without details */ }
      out.push({
        chainId: r.chainId, token: r.token, symbol: r.symbol, score: r.score, createdAt: r.createdAt,
        name: d?.name ?? r.symbol, logo: d?.logo ?? null, headline: d?.headline.text ?? "", tone: d?.headline.tone ?? "good",
        stance: d?.lp.stance ?? "careful", change24h: d?.change.h24 ?? null,
      });
      if (out.length >= 24) break;
    }
    return out;
  },
});

/** What the action needs before fetching anything: a fresh scan to reuse, the previous one for deltas, the wallet's BTB. */
export const before = internalQuery({
  args: { chainId: v.float64(), token: v.string(), wallet: v.string() },
  handler: async (ctx, { chainId, token, wallet }) => {
    const row = await newest(ctx, chainId, token);
    const fresh = !!row && row.createdAt + SCAN_TTL_MS > Date.now();
    const { total } = await availableFor(ctx, wallet);
    return { fresh, latestAt: row?.createdAt ?? null, previous: row ? { createdAt: row.createdAt, data: row.data } : null, available: total };
  },
});

/**
 * Charge and store in one transaction. If someone else finished a scan of the
 * same token while this one was fetching, theirs is kept and this wallet pays
 * nothing.
 */
/**
 * `seenAt` is the scan the wallet was looking at when it asked for a rescan (null for a first scan). If a newer one
 * exists by now, someone else just refreshed it: theirs is kept and this wallet pays nothing. A rescan of an open
 * scan costs RESCAN_BTB; anything else costs SCAN_BTB.
 */
export const save = internalMutation({
  args: { chainId: v.float64(), token: v.string(), symbol: v.string(), score: v.float64(), data: v.string(), wallet: v.string(), rescan: v.optional(v.boolean()), seenAt: v.optional(v.union(v.float64(), v.null())) },
  handler: async (ctx, a): Promise<{ ok: true; charged: boolean } | { ok: false; reason: string }> => {
    const row = await newest(ctx, a.chainId, a.token);
    const open = !!row && row.createdAt + SCAN_TTL_MS > Date.now();
    if (open && !a.rescan) return { ok: true, charged: false };
    if (open && a.rescan && row.createdAt > (a.seenAt ?? 0)) return { ok: true, charged: false };
    if (open && Date.now() - row.createdAt < RESCAN_MIN_AGE_MS) return { ok: false, reason: "This token was scanned in the last 15 minutes. Rescan opens shortly." };
    const price = open ? RESCAN_BTB : SCAN_BTB;
    if (!(await spendCredit(ctx, a.wallet, price))) return { ok: false, reason: `${open ? "A rescan" : "A scan"} costs ${price} BTB. Top up your BTB balance to run it.` };
    await ctx.db.insert("tokenScans", {
      chainId: a.chainId, token: a.token.toLowerCase(), symbol: a.symbol.slice(0, 24), score: a.score,
      data: a.data, by: a.wallet.toLowerCase(), createdAt: Date.now(),
    });
    return { ok: true, charged: true };
  },
});

/** Daily cleanup: scans older than 90 days. */
export const dropOld = internalMutation({
  args: {},
  handler: async (ctx) => {
    const old = await ctx.db.query("tokenScans").withIndex("by_created", (q) => q.lt("createdAt", Date.now() - SCAN_KEEP_MS)).take(500);
    for (const r of old) await ctx.db.delete(r._id);
    return { deleted: old.length, more: old.length === 500 };
  },
});

/**
 * The fleet: the newest scan of every token scanned in the last 90 days, reduced to the numbers the page ranks a
 * token against ("above 72% of scanned tokens"). Sorted arrays, so the page can place any value with a search.
 */
export const fleet = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("tokenScans").withIndex("by_created").order("desc").take(1000);
    const seen = new Set<string>();
    const m = { score: [] as number[], marketCap: [] as number[], liquidity: [] as number[], volume: [] as number[], holders: [] as number[], top10: [] as number[] };
    const pillars: Record<string, number[]> = {};
    for (const r of rows) {
      const k = `${r.chainId}:${r.token}`;
      if (seen.has(k)) continue;
      seen.add(k);
      let d: ScanResult;
      try { d = JSON.parse(r.data) as ScanResult; } catch { continue; }
      m.score.push(d.grade.score);
      if (d.marketCapUsd != null) m.marketCap.push(d.marketCapUsd);
      m.liquidity.push(d.liquidityUsd);
      m.volume.push(d.volume24hUsd);
      if (d.holders != null) m.holders.push(d.holders);
      if (d.top10Share != null) m.top10.push(d.top10Share);
      for (const p of d.pillars) if (p.score != null) (pillars[p.key] ??= []).push(p.score);
    }
    const sort = (a: number[]) => a.sort((x, y) => x - y);
    const quart = (a: number[]) => {
      const s = sort([...a]);
      const at = (q: number) => s.length ? s[Math.min(s.length - 1, Math.floor(q * (s.length - 1) + 0.5))] : 0;
      return { p25: at(0.25), median: at(0.5), p75: at(0.75) };
    };
    return {
      n: seen.size,
      score: sort(m.score), marketCap: sort(m.marketCap), liquidity: sort(m.liquidity), volume: sort(m.volume),
      holders: sort(m.holders), top10: sort(m.top10),
      scoreBand: quart(m.score),
      pillars: Object.fromEntries(Object.entries(pillars).map(([k, v]) => [k, quart(v)])),
    };
  },
});

/** Every stored scan of one token, oldest first, reduced to what the history chart draws. Free to read. */
export const timeline = query({
  args: { chainId: v.float64(), token: v.string() },
  handler: async (ctx, { chainId, token }) => {
    const rows = await ctx.db.query("tokenScans")
      .withIndex("by_token", (q) => q.eq("chainId", chainId).eq("token", token.toLowerCase()))
      .order("desc").take(30);
    return rows.reverse().map((r) => {
      let holders: number | null = null, liquidityUsd: number | null = null, priceUsd: number | null = null;
      try { const d = JSON.parse(r.data) as ScanResult; holders = d.holders; liquidityUsd = d.liquidityUsd; priceUsd = d.priceUsd; } catch { /* score only */ }
      return { at: r.createdAt, score: r.score, holders, liquidityUsd, priceUsd };
    });
  },
});
