/**
 * Token search for Scan: by symbol, name or address, across every chain Scan
 * covers, from data the app already has (Discover's pools, the wallet, the
 * token list, recent scans), with DexScreener's search for anything else.
 */
import { SCAN_CHAINS } from '../../convex/tokenScanConfig';
import type { EarnPool } from './pools';

export interface ScanHit {
  chainId: number;
  address: string;      // lowercase
  symbol: string;
  name?: string;
  logo?: string;
  /** 24h volume of the pools that hold it, a popularity rank. */
  volumeUsd: number;
  /** Grade of a scan in the last 24 hours. */
  score?: number;
  /** Held by the connected wallet. */
  held?: boolean;
}

const ADDRESS_RE = /^0x[0-9a-f]{40}$/;
const key = (chainId: number, address: string) => `${chainId}:${address.toLowerCase()}`;

type IndexToken = { chainId?: number; address: string; symbol: string; name?: string; logoURI?: string };

/** One entry per token and chain, merged from every source the app has loaded. */
export function buildScanIndex(src: {
  pools?: EarnPool[];
  tokens?: IndexToken[];
  positions?: IndexToken[];
  recent?: { chainId: number; token: string; symbol: string; name: string; logo: string | null; score: number }[];
}): Map<string, ScanHit> {
  const index = new Map<string, ScanHit>();
  const add = (h: Omit<ScanHit, 'volumeUsd'> & { volumeUsd?: number }) => {
    if (!SCAN_CHAINS[h.chainId] || !ADDRESS_RE.test(h.address.toLowerCase())) return;
    const k = key(h.chainId, h.address);
    const cur = index.get(k);
    if (!cur) { index.set(k, { ...h, address: h.address.toLowerCase(), volumeUsd: h.volumeUsd ?? 0 }); return; }
    cur.volumeUsd += h.volumeUsd ?? 0;
    cur.name ??= h.name;
    cur.logo ??= h.logo;
    if (h.score != null) cur.score = h.score;
    if (h.held) cur.held = true;
  };
  for (const p of src.pools ?? []) {
    if (p.chainId == null) continue;
    const syms = p.pair.split(/[-/]/).map((s) => s.trim());
    (p.underlyingTokens ?? []).slice(0, 2).forEach((t, i) => {
      if (!syms[i]) return;
      add({ chainId: p.chainId!, address: t, symbol: syms[i], logo: p.tokenLogos?.[i] ?? undefined, volumeUsd: p.volume24hUsd ?? 0 });
    });
  }
  for (const t of src.tokens ?? []) add({ chainId: t.chainId ?? 1, address: t.address, symbol: t.symbol, name: t.name, logo: t.logoURI });
  for (const t of src.positions ?? []) if (t.chainId != null) add({ chainId: t.chainId, address: t.address, symbol: t.symbol, name: t.name, logo: t.logoURI, held: true });
  for (const r of src.recent ?? []) add({ chainId: r.chainId, address: r.token, symbol: r.symbol, name: r.name, logo: r.logo ?? undefined, score: r.score });
  return index;
}

/** Best matches for what was typed: exact symbol, then symbol prefix, then name; held, scanned and busy tokens first. */
export function searchScanIndex(index: Map<string, ScanHit>, raw: string, limit = 8): ScanHit[] {
  const q = raw.trim().toLowerCase().replace(/^\$/, '');
  if (!q) return [];
  const hits = [...index.values()];
  if (q.startsWith('0x')) return hits.filter((h) => h.address.startsWith(q)).sort((a, b) => b.volumeUsd - a.volumeUsd).slice(0, limit);
  const rank = (h: ScanHit) => {
    const s = h.symbol.toLowerCase(), n = (h.name ?? '').toLowerCase();
    if (s === q) return 0;
    if (s.startsWith(q)) return 1;
    if (n.startsWith(q)) return 2;
    if (s.includes(q) || n.includes(q)) return 3;
    return -1;
  };
  return hits
    .map((h) => ({ h, r: rank(h) }))
    .filter((x) => x.r >= 0)
    .sort((a, b) => a.r - b.r || Number(!!b.h.held) - Number(!!a.h.held) || Number(b.h.score != null) - Number(a.h.score != null) || b.h.volumeUsd - a.h.volumeUsd)
    .slice(0, limit)
    .map((x) => x.h);
}

const DEX_CHAIN: Record<string, number> = Object.fromEntries(Object.entries(SCAN_CHAINS).map(([id, c]) => [c.dex, Number(id)]));

/** DexScreener's search, for tokens none of our data knows. The side of each pair that matches the query is kept. */
export async function searchDexScreener(raw: string, signal?: AbortSignal): Promise<ScanHit[]> {
  const q = raw.trim().replace(/^\$/, '');
  if (q.length < 2) return [];
  const res = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`, { signal });
  if (!res.ok) return [];
  const json = await res.json() as { pairs?: { chainId: string; baseToken: { address: string; symbol: string; name: string }; quoteToken: { address: string; symbol: string; name: string }; volume?: { h24?: number }; info?: { imageUrl?: string } }[] };
  const lq = q.toLowerCase();
  const out = new Map<string, ScanHit>();
  for (const p of json.pairs ?? []) {
    const chainId = DEX_CHAIN[p.chainId];
    if (!chainId) continue;
    const side = [p.baseToken, p.quoteToken].find((t) => t.address.toLowerCase() === lq || t.symbol.toLowerCase().includes(lq) || t.name.toLowerCase().includes(lq)) ?? p.baseToken;
    const k = key(chainId, side.address);
    const vol = p.volume?.h24 ?? 0;
    const cur = out.get(k);
    if (cur) { cur.volumeUsd += vol; continue; }
    out.set(k, { chainId, address: side.address.toLowerCase(), symbol: side.symbol, name: side.name, logo: side === p.baseToken ? p.info?.imageUrl : undefined, volumeUsd: vol });
  }
  return [...out.values()].sort((a, b) => b.volumeUsd - a.volumeUsd);
}
