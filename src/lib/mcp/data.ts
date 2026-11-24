import { gunzipSync } from 'node:zlib';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../convex/_generated/api';
import { unpackSnapshotNode } from '../snapshotCodec';
import { mintTarget, type EarnPool } from '../pools';
import { chainSlug, poolPath } from '../routes';
import type { ScanResult } from '../../../convex/tokenScanConfig';

// The data behind the BTB connector (src/app/api/mcp): Discover's pool snapshot, read the same way the page reads it
// (convex discover.index plus one gzip file per chain), kept for 5 minutes per server instance, and the risk grade the
// BTB Chain defi-yields contract computes, ported so both give the same letter.

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL ?? 'https://grateful-oyster-780.convex.cloud';
export const SITE = 'https://btb.finance';
const TTL_MS = 5 * 60_000;

export const convex = () => new ConvexHttpClient(CONVEX_URL);

export interface Snapshot { pools: EarnPool[]; updatedAt: number | null; chains: string[] }

let cache: { at: number; snap: Promise<Snapshot> } | null = null;

async function chainFile(url: string): Promise<EarnPool[]> {
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`chain file ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  // Convex storage serves the file as stored (gzip); a proxy may already have decoded it.
  const text = bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes).toString('utf8') : bytes.toString('utf8');
  return (JSON.parse(text) as { pools: EarnPool[] }).pools;
}

async function load(): Promise<Snapshot> {
  const index = await convex().query(api.discover.index, {});
  if (!index) throw new Error('The pool snapshot is not available yet.');
  const top = await unpackSnapshotNode<{ pools: EarnPool[] }>(index.top);
  const files = await Promise.all(index.chains.map((c) => chainFile(c.url).catch(() => null)));
  const byKey = new Map<string, EarnPool>();
  // Chain files are the full lists; the top list fills in for a chain whose file could not be read.
  for (const p of [...files.flatMap((f) => f ?? []), ...top.pools]) {
    const k = poolKey(p);
    const had = byKey.get(k);
    // The snapshot lists a few pools twice under two DEX labels: keep the row with more TVL.
    if (!had || (p.tvlUsd ?? 0) > (had.tvlUsd ?? 0)) byKey.set(k, p);
  }
  const pools = [...byKey.values()].filter((p) => Number.isFinite(p.tvlUsd));
  return { pools, updatedAt: index.updatedAt ?? null, chains: [...new Set(pools.map((p) => p.chain))].sort() };
}

export function snapshot(): Promise<Snapshot> {
  if (!cache || Date.now() - cache.at > TTL_MS) {
    const snap = load();
    cache = { at: Date.now(), snap };
    snap.catch(() => { if (cache?.snap === snap) cache = null; });
  }
  return cache.snap;
}

export const poolKey = (p: EarnPool) => `${chainSlug(p.chain)}:${p.id.toLowerCase()}`;

// ---- chains ----

const CHAIN_ALIASES: Record<string, string> = {
  eth: 'ethereum', mainnet: 'ethereum', '1': 'ethereum', '8453': 'base', bsc: 'bnbchain', bnb: 'bnbchain', binance: 'bnbchain',
  '56': 'bnbchain', robinhood: 'robinhoodchain', '4663': 'robinhoodchain', '5042': 'arc', arb: 'arbitrum', '42161': 'arbitrum',
  op: 'optimism', '10': 'optimism', matic: 'polygon', '137': 'polygon', '130': 'unichain',
};

/** A chain name, slug or id as a user might type it → the slug the snapshot's chain names reduce to. */
export function chainKey(input: string): string {
  const s = chainSlug(input);
  return CHAIN_ALIASES[s] ?? s;
}

export function chainIdOf(p: EarnPool): number | null {
  const id = (p as EarnPool & { chainId?: number }).chainId;
  if (typeof id === 'number') return id;
  const k = chainKey(p.chain);
  return ({ ethereum: 1, base: 8453, bnbchain: 56, robinhoodchain: 4663, arc: 5042, arbitrum: 42161, optimism: 10, polygon: 137, unichain: 130 } as Record<string, number>)[k] ?? null;
}

// ---- numbers ----

/** The APR a liquidity provider sees first: the measured ±5 % range APR when there is one, else base plus rewards. */
export function headlineApr(p: EarnPool): number {
  if (typeof p.aprRange === 'number' && Number.isFinite(p.aprRange)) return p.aprRange;
  if (typeof p.apy === 'number' && Number.isFinite(p.apy)) return p.apy;
  return (p.apyBase ?? 0) + (p.apyReward ?? 0);
}

export function feePct(p: EarnPool): number | null {
  const f = p.feeTier;
  if (f == null || f & 0x800000 || f > 1_000_000) return null;
  return f / 10_000;
}

// ---- risk (same formula as BTB Chain's defi-yields contract, pool_risk) ----

export interface TokenGrade { token: string; symbol: string; score: number | null; flags: string[]; honeypot: boolean; scannedAt: number; proxy: boolean; lpLockedPct: number | null }
export type Letter = 'A' | 'B' | 'C' | 'D' | 'E';
export interface Risk { score: number; grade: Letter; reasons: string[] }

export const letter = (score: number): Letter => (score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 55 ? 'C' : score >= 40 ? 'D' : 'E');
export const LETTERS: Letter[] = ['A', 'B', 'C', 'D', 'E'];

export function poolRisk(p: EarnPool, grades: (TokenGrade | null)[] = []): Risk {
  let score = 100;
  const reasons: string[] = [];
  const take = (n: number, why: string) => { score -= n; reasons.push(`−${n}: ${why}`); };
  const tvl = p.tvlUsd ?? 0;
  if (tvl < 100_000) take(30, 'TVL under $100k, easy to move and to drain');
  else if (tvl < 1_000_000) take(15, 'TVL under $1M');
  else if (tvl < 10_000_000) take(5, 'TVL under $10M');
  if (!p.stablecoin) take(10, 'not a stable pair, so impermanent loss applies');
  const inRange = p.rangeYield?.inRangePct;
  if (typeof inRange === 'number') {
    if (inRange < 50) take(15, `a ±5 % range was in range only ${inRange.toFixed(0)} % of the time`);
    else if (inRange < 80) take(5, `a ±5 % range was in range ${inRange.toFixed(0)} % of the time`);
  }
  const apr = headlineApr(p);
  if (apr > 1_000) take(20, `APR of ${apr.toFixed(0)} % is very unlikely to last`);
  else if (apr > 200) take(10, `APR of ${apr.toFixed(0)} % is unlikely to last`);
  const tokens = (p.underlyingTokens ?? []).slice(0, 2);
  tokens.forEach((t, i) => {
    const g = grades[i];
    const sym = g?.symbol || p.pair.split('-')[i] || t;
    if (!g || g.score == null) { take(5, `${sym} has no safety scan`); return; }
    if (g.score < 50) take(25, `${sym} safety score ${g.score}/100`);
    else if (g.score < 70) take(10, `${sym} safety score ${g.score}/100`);
    if (g.honeypot) take(40, `${sym} cannot be sold (honeypot)`);
    for (const f of g.flags) {
      if (/mint|blacklist|tax can be changed|change balances/i.test(f)) take(10, `${sym}: ${f.toLowerCase()}`);
    }
    if (g.proxy) take(5, `${sym} is an upgradeable proxy`);
    if (g.lpLockedPct != null && g.lpLockedPct < 50) take(5, `${sym}: most of its liquidity is not locked`);
  });
  score = Math.max(0, Math.min(100, score));
  return { score, grade: letter(score), reasons };
}

/** The newest open safety scan of a token (scans are paid for by whoever runs them, then free to read for 24 hours). */
export async function tokenGrade(chainId: number | null, token: string): Promise<TokenGrade | null> {
  if (!chainId || !/^0x[0-9a-fA-F]{40}$/.test(token)) return null;
  const row = await convex().query(api.tokenScan.forToken, { chainId, token: token.toLowerCase() }).catch(() => null);
  if (!row || !row.fresh || !row.data) return null;
  let d: ScanResult | null = null;
  try { d = JSON.parse(row.data) as ScanResult; } catch { return null; }
  return {
    token: token.toLowerCase(), symbol: row.symbol, score: d.grade?.score ?? row.score ?? null, flags: d.safety?.flags ?? [],
    honeypot: !!d.safety?.honeypot, scannedAt: row.createdAt, proxy: !!d.safety?.details?.proxy, lpLockedPct: d.safety?.details?.lpLockedPct ?? null,
  };
}

// ---- links (nothing here signs or sends: every action opens the site, where the user's own wallet signs) ----

export function poolLink(p: EarnPool): string {
  return `${SITE}${poolPath(p.chain, p.pair)}?id=${encodeURIComponent(p.id)}`;
}

/** Whether btb.finance can open this pool's Add-liquidity flow, and with which DEX. */
export function addable(p: EarnPool): { ok: boolean; dex: string | null } {
  const t = mintTarget(p);
  return { ok: !!t, dex: t?.dex ?? null };
}

export const portfolioLink = () => `${SITE}/portfolio`;
export const scanLink = (chainSlugName: string, token: string) => `${SITE}/scan?chain=${chainSlugName}&token=${token}`;

// ---- finding pools ----

/** A pool by `chain` + pool address / V4 id, or by its key `chain:id`. */
export function findPool(pools: EarnPool[], chain: string | undefined, id: string): EarnPool | null {
  let c = chain ? chainKey(chain) : null;
  let want = id.trim().toLowerCase();
  if (want.includes(':')) { const [a, b] = want.split(':'); c = chainKey(a); want = b; }
  const hits = pools.filter((p) => p.id.toLowerCase() === want && (!c || chainKey(p.chain) === c));
  return hits.sort((a, b) => b.tvlUsd - a.tvlUsd)[0] ?? null;
}

const norm = (s: string) => s.toLowerCase().replace(/^w(eth|bnb)$/, '$1');

/** Pools whose pair, DEX or token addresses match every word of the query. */
export function searchPools(pools: EarnPool[], query: string): EarnPool[] {
  const words = query.toLowerCase().split(/[\s/,-]+/).filter(Boolean);
  return pools.filter((p) => {
    const syms = p.pair.split('-').map(norm);
    const hay = `${p.project} ${p.dex ?? ''} ${p.version ?? ''}`.toLowerCase();
    const toks = (p.underlyingTokens ?? []).map((t) => t.toLowerCase());
    return words.every((w) => syms.includes(norm(w)) || toks.includes(w) || syms.some((s) => s.startsWith(norm(w)) && w.length >= 3) || hay.includes(w));
  });
}

/** The fields an agent needs to compare pools, as plain JSON. */
export function brief(p: EarnPool, risk = poolRisk(p)) {
  const a = addable(p);
  return {
    key: poolKey(p),
    pair: p.pair,
    chain: p.chain,
    dex: [p.dex ?? p.project, p.version].filter(Boolean).join(' '),
    feePct: feePct(p),
    tvlUsd: Math.round(p.tvlUsd),
    aprPct: round2(headlineApr(p)),
    aprKind: typeof p.aprRange === 'number' ? (p.rangeYield ? 'measured ±5% range APR' : 'estimated ±5% range APR') : 'base + reward APR',
    baseAprPct: p.apyBase == null ? null : round2(p.apyBase),
    rewardAprPct: p.apyReward == null ? null : round2(p.apyReward),
    volume24hUsd: p.volume24hUsd == null ? null : Math.round(p.volume24hUsd),
    fees24hUsd: p.fees24hUsd == null ? null : Math.round(p.fees24hUsd),
    stablePair: !!p.stablecoin,
    inRangePct: p.rangeYield?.inRangePct ?? null,
    vsHoldPct: p.rangeYield ? round2(p.rangeYield.netPct) : null,
    measuredDays: p.rangeYield?.days ?? null,
    risk: risk.grade,
    riskScore: risk.score,
    canAddOnBtb: a.ok,
    link: poolLink(p),
  };
}

export const round2 = (x: number) => Math.round(x * 100) / 100;

export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
