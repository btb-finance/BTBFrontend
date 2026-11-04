/**
 * Token Scan: a paid readout of any token (safety, liquidity, holders, flow)
 * plus what it means for an LP. One wallet pays SCAN_BTB to run a scan; the
 * result is then shared with everyone, free, for SCAN_TTL_MS. Nothing is
 * re-fetched while a scan is fresh. Shared by the Convex functions and the
 * page, so it holds no server-only imports.
 */

/** BTB a scan costs the wallet that runs it. Viewing a fresh scan is free. */
export const SCAN_BTB = 100;
/** BTB to fetch fresh data for a token whose scan is still open. The new scan replaces it for everyone. */
export const RESCAN_BTB = 50;
/** A rescan unlocks this long after the last scan, so nobody pays for data that has barely moved. */
export const RESCAN_MIN_AGE_MS = 15 * 60_000;
/** How long a scan stays open to everyone before someone has to run it again. */
export const SCAN_TTL_MS = 24 * 3_600_000;
/** Old scans are kept this long so the next one can show what changed. */
export const SCAN_KEEP_MS = 90 * 86_400_000;

/** Chains a scan can read. `dex` is DexScreener's id, `blockscout` the explorer used for holders, GoPlus uses the chain id. */
export const SCAN_CHAINS: Record<number, { name: string; slug: string; dex: string; gecko: string; blockscout?: string }> = {
  1: { name: "Ethereum", slug: "ethereum", dex: "ethereum", gecko: "eth", blockscout: "https://eth.blockscout.com" },
  8453: { name: "Base", slug: "base", dex: "base", gecko: "base", blockscout: "https://base.blockscout.com" },
  4663: { name: "Robinhood Chain", slug: "robinhood", dex: "robinhood", gecko: "robinhood", blockscout: "https://robinhoodchain.blockscout.com" },
  42161: { name: "Arbitrum", slug: "arbitrum", dex: "arbitrum", gecko: "arbitrum" },
  10: { name: "Optimism", slug: "optimism", dex: "optimism", gecko: "optimism" },
  56: { name: "BNB Chain", slug: "bsc", dex: "bsc", gecko: "bsc" },
  137: { name: "Polygon", slug: "polygon", dex: "polygon", gecko: "polygon_pos" },
  130: { name: "Unichain", slug: "unichain", dex: "unichain", gecko: "unichain" },
};

/** Tokens that moved to a new contract: the scan warns and points to the new one. Keyed "chainId:address". */
export const MIGRATED: Record<string, { to: string; note: string }> = {
  "8453:0x940181a94a35a4569e4529a3cdfb74e38fd98631": { to: "0x3f5bf3edac59d650d8fdf9657a71f2f904a3a4ee", note: "This is the old AERO from Aerodrome. Aero launched a new AERO token" },
};

export function chainBySlug(slug: string): number | null {
  const s = slug.toLowerCase();
  const hit = Object.entries(SCAN_CHAINS).find(([id, c]) => c.slug === s || id === s);
  return hit ? Number(hit[0]) : null;
}

export type Tone = "good" | "warn" | "bad";

export interface ScanPillar {
  key: "safety" | "depth" | "concentration" | "holders" | "flow";
  label: string;
  /** 0..100, null when the source had nothing for this token. */
  score: number | null;
  weight: number;
  note: string;
}

export interface ScanPool {
  pair: string;
  dex: string;
  version: string | null;
  quote: string;
  /** The other token's address, so the page can open Add LP for this exact pool. */
  quoteAddress: string;
  liquidityUsd: number;
  volume24hUsd: number;
  url: string;
  /** Swap fee in percent, and the yearly fee rate an average LP earns (24h volume × fee ÷ liquidity × 365). */
  feePct?: number | null;
  feeApr?: number | null;
}

export interface ScanResult {
  version: 1;
  chainId: number;
  token: string;
  symbol: string;
  name: string;
  logo: string | null;
  priceUsd: number | null;
  marketCapUsd: number | null;
  fdvUsd: number | null;
  change: { h1: number | null; h6: number | null; h24: number | null };

  liquidityUsd: number;
  poolCount: number;
  volume24hUsd: number;
  /** Swap counts across every pool, last 24 hours and last hour. */
  txns24h: { buys: number; sells: number };
  txns1h: { buys: number; sells: number };

  holders: number | null;
  /** Share of supply held by the 10 largest wallets, pools and burn addresses left out. 0..1 */
  top10Share: number | null;
  /** Share of supply sitting in DEX pools, 0..1. */
  inPoolsShare: number | null;
  /** Share of supply sent to burn addresses, 0..1. */
  burnedShare: number | null;

  safety: {
    checked: boolean;
    honeypot: boolean;
    buyTaxPct: number | null;
    sellTaxPct: number | null;
    flags: string[];
    /** Extra GoPlus facts: who holds what, and how the contract can change. Missing on older scans. */
    details?: {
      creatorPct: number | null; ownerPct: number | null; ownerRenounced: boolean | null;
      lpLockedPct: number | null; proxy: boolean | null; openSource: boolean | null; sameCreatorHoneypot: boolean | null;
    };
  };

  grade: { score: number; letter: string; capped: string | null };
  pillars: ScanPillar[];
  signals: { tone: Tone; text: string }[];
  headline: { tone: Tone; text: string };

  lp: {
    stance: "good" | "careful" | "avoid";
    /** Suggested range around the current price, in percent (lower is negative). */
    lowerPct: number;
    upperPct: number;
    /** 24h volume of the deepest pool divided by its liquidity. */
    turnover: number | null;
    notes: string[];
    /** The deepest pool. */
    pool: ScanPool | null;
    /** Up to ten pools by liquidity, deepest first (scans before this field have none). */
    pools?: ScanPool[];
    /** The pool with the best fee rate among those deep enough to matter. */
    bestPair?: string | null;
    /** The swap fee in percent (0.3 means 0.3%) of `pool`, the pool Add LP opens, from GeckoTerminal. */
    feePct?: number | null;
    /** `volumeHistory` is the deepest pool's; this scales it to `pool` (its 24h volume ÷ the deepest's). 1 when they are the same. */
    volumeScale?: number;
  };

  /** Daily closes in USD from the deepest pool, oldest first: [unix seconds, price]. Up to 30 days. */
  history?: [number, number][];
  /** Daily trading volume in USD on the deepest pool, same days as `history`. */
  volumeHistory?: [number, number][];

  /** Supply split by holder rank (pools, lockers and burn addresses apart), shares of live supply. Blockscout chains only. */
  concentration?: { top10: number; r11to50: number; r51to100: number; pools: number; rest: number };
  /** The 10 largest wallets that are not pools: address, share of live supply, explorer name tag. */
  topHolders?: { address: string; share: number; label: string | null; contract: boolean }[];
  /** Recent swaps on the deepest pool (up to 300), bucketed by hour, oldest first. */
  flow?: {
    from: number; to: number; trades: number; wallets: number; buyUsd: number; sellUsd: number;
    hours: { at: number; buyUsd: number; sellUsd: number }[];
    /** The largest swaps in the window, biggest first. */
    big?: { at: number; usd: number; buy: boolean; wallet: string }[];
  };
  /** When the oldest pool opened, and the project's links from DexScreener. */
  meta?: { createdAt: number | null; websites: string[]; socials: { type: string; url: string }[] };

  /** The previous scan of this token, for "since last scan". */
  previous: { at: number; holders: number | null; top10Share: number | null; score: number; liquidityUsd: number; marketCapUsd?: number | null; volume24hUsd?: number; signals?: string[]; stance?: string } | null;
}

/**
 * Fees a position in the suggested range could earn, and what it gives up if the price runs to an edge. The pool's
 * average fee yield is scaled by how concentrated the range is against a typical ±30% LP (a V2 pool is full range,
 * so 1), and by the share of the last 30 days the price spent inside the range. An estimate, not a promise: it
 * assumes volume and the other LPs stay as they were.
 */
/** LP value against holding for a range [1 + lo, 1 + hi] opened at price 1 (V3 math; a full range when not concentrated). */
export function rangeMath(lo: number, hi: number, concentrated: boolean) {
  const a = concentrated ? 1 + lo : 1e-9, b = concentrated ? 1 + hi : 1e9;
  const x = 1 - 1 / Math.sqrt(b), y = 1 - Math.sqrt(a);
  const lpAt = (q: number) => q <= a ? (1 / Math.sqrt(a) - 1 / Math.sqrt(b)) * q : q >= b ? Math.sqrt(b) - Math.sqrt(a) : 2 * Math.sqrt(q) - Math.sqrt(a) - q / Math.sqrt(b);
  const holdAt = (q: number) => x * q + y;
  const mult = concentrated ? 2 / (2 - Math.sqrt(1 + lo) - 1 / Math.sqrt(1 + hi)) : 1;
  return { lpAt, holdAt, vsHold: (q: number) => lpAt(q) / holdAt(q) - 1, mult, start: lpAt(1) };
}

export function lpEarnings(d: ScanResult, deposit: number, range?: { lowerPct: number; upperPct: number }) {
  const pool = d.lp.pool;
  const fee = d.lp.feePct;
  if (!pool || fee == null || !(pool.liquidityUsd > 0) || d.priceUsd == null) return null;
  const scale = d.lp.volumeScale ?? 1;
  const vols = (d.volumeHistory ?? []).map((v) => v[1] * scale).filter((v) => v > 0);
  const avgVolume = vols.length ? vols.reduce((s, v) => s + v, 0) / vols.length : pool.volume24hUsd;
  const poolFeesDay = avgVolume * (fee / 100);
  const baseYield = poolFeesDay / pool.liquidityUsd;
  const lo = (range?.lowerPct ?? d.lp.lowerPct) / 100, hi = (range?.upperPct ?? d.lp.upperPct) / 100;
  const concentrated = (pool.version ?? "").toLowerCase() !== "v2";
  const rm = rangeMath(lo, hi, concentrated);
  const boost = concentrated ? rm.mult / rangeMath(-0.3, 0.3, true).mult : 1;
  const bandLo = d.priceUsd * (1 + lo), bandHi = d.priceUsd * (1 + hi);
  const closes = (d.history ?? []).map((h) => h[1]);
  const inRange = closes.length ? closes.filter((c) => c >= bandLo && c <= bandHi).length / closes.length : 0.7;
  const perDay = deposit * baseYield * boost * inRange;
  const edgeLow = rm.vsHold(1 + lo), edgeHigh = rm.vsHold(1 + hi);
  return {
    lowerPct: lo * 100, upperPct: hi * 100,
    fee, avgVolume, poolFeesDay, boost, inRange, concentrated,
    perDay, perMonth: perDay * 30, apr: deposit > 0 ? (perDay * 365) / deposit : 0,
    edgeLow, edgeHigh,
    daysToRecoverLow: perDay > 0 ? (-edgeLow * deposit) / perDay : null,
    daysToRecoverHigh: perDay > 0 ? (-edgeHigh * deposit) / perDay : null,
  };
}

/**
 * Replays the last 30 days: a deposit opened in the suggested range at the first close, fees earned on each day the
 * close sat inside the range, and the position's value at the last close, against holding the two tokens and against
 * keeping the dollars. Assumes the other token holds its dollar value (true for stablecoin pairs, close for others).
 */
export function lpBacktest(d: ScanResult, deposit: number) {
  const pool = d.lp.pool, fee = d.lp.feePct, h = d.history ?? [];
  if (!pool || fee == null || !(pool.liquidityUsd > 0) || h.length < 7) return null;
  const lo = d.lp.lowerPct / 100, hi = d.lp.upperPct / 100;
  const concentrated = (pool.version ?? "").toLowerCase() !== "v2";
  const rm = rangeMath(lo, hi, concentrated);
  const boost = concentrated ? rm.mult / rangeMath(-0.3, 0.3, true).mult : 1;
  const volBy = new Map((d.volumeHistory ?? []).map(([ts, v]) => [ts, v]));
  const p0 = h[0][1];
  let fees = 0, daysIn = 0;
  const series: { at: number; lp: number; hold: number }[] = [];
  for (const [ts, close] of h) {
    const q = close / p0;
    const inside = q >= 1 + lo && q <= 1 + hi;
    const dayVol = volBy.has(ts) ? (volBy.get(ts) ?? 0) * (d.lp.volumeScale ?? 1) : pool.volume24hUsd;
    if (inside) { daysIn++; fees += deposit * (dayVol * (fee / 100) / pool.liquidityUsd) * boost; }
    series.push({ at: ts, lp: deposit * (rm.lpAt(q) / rm.start) + fees, hold: deposit * (rm.holdAt(q) / rm.holdAt(1)) });
  }
  const qEnd = h[h.length - 1][1] / p0;
  const position = deposit * (rm.lpAt(qEnd) / rm.start);
  const hold = deposit * (rm.holdAt(qEnd) / rm.holdAt(1));
  return { days: h.length, daysIn, fees, position, total: position + fees, hold, priceMove: qEnd - 1, series };
}

/** The LP plan's line about trading against pool size, or null when it is unremarkable. */
export function turnoverNote(turnover: number): string | null {
  if (turnover >= 0.3) return `This pool trades ${turnover.toFixed(1)}x its size a day, so fees should be steady.`;
  if (turnover < 0.05) return "Little volume for the pool size, so fees will be thin.";
  return null;
}

/**
 * The scan as it reads with another of its pools picked: fee, turnover, volume scale and the turnover note all
 * describe that pool, so the range, earnings and backtest follow the reader's choice. The day by day volume history
 * belongs to the deepest pool; it is rescaled so its average matches the picked pool's last day.
 */
export function withPool(d: ScanResult, pair: string | null): ScanResult {
  const pools = d.lp.pools ?? [];
  const pool = pools.find((p) => p.pair === pair);
  if (!pool || pool.pair === d.lp.pool?.pair) return d;
  const vols = (d.volumeHistory ?? []).map((v) => v[1]).filter((v) => v > 0);
  const avg = vols.length ? vols.reduce((s, v) => s + v, 0) / vols.length : 0;
  const turnover = pool.liquidityUsd > 0 ? pool.volume24hUsd / pool.liquidityUsd : null;
  const oldNote = d.lp.turnover != null ? turnoverNote(d.lp.turnover) : null;
  const notes = d.lp.notes.filter((n) => n && n !== oldNote);
  const fresh = turnover != null ? turnoverNote(turnover) : null;
  if (fresh) notes.splice(1, 0, fresh);
  return {
    ...d,
    lp: {
      ...d.lp, pool, feePct: pool.feePct ?? null, turnover, notes,
      volumeScale: pool.pair === pools[0]?.pair || avg <= 0 ? 1 : pool.volume24hUsd / avg,
    },
  };
}

export function letterFor(score: number): string {
  return score >= 85 ? "A" : score >= 70 ? "B" : score >= 55 ? "C" : score >= 40 ? "D" : "F";
}
