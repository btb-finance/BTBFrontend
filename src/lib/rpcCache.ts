import type { PublicClient } from 'viem';
import { ERC20_META_ABI } from '@/protocols/dexs/uniswap/v3/abis';
import { withSafeMulticall } from './safeMulticall';

// ─── Reads that never change, fetched once per browser ───────────────────────
// A token's symbol and decimals and a factory's pool address for a pair are
// fixed once they exist, yet every position refresh, pool probe and simulate
// run used to read them again. Each extra read is one more chance for a public
// RPC to rate limit the batch. Only successful answers are kept: a failed or
// zero read is asked again next time, never remembered.

export type TokenMeta = { symbol: string; decimals: number };

const META_STORE = 'btb:token-meta:v1';
const ADDR_STORE = 'btb:known-addr:v1';
// Sized for a large gauge voter (two entries per pool) plus a wallet's tokens
// and pools; it only guards against the store growing without bound.
const STORE_CAP = 6000;
// Browser only. Convex actions import the same protocol readers, and a promise
// or cache shared between server requests is not something to rely on there.
const BROWSER = typeof window !== 'undefined';

function loadStore<T>(name: string): Map<string, T> {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(name);
    return new Map(raw ? (JSON.parse(raw) as [string, T][]) : []);
  } catch { return new Map(); }
}

// Writes are coalesced: a position load can learn dozens of entries at once.
const pendingSave = new Set<string>();
function saveStore<T>(name: string, map: Map<string, T>) {
  if (pendingSave.has(name)) return;
  pendingSave.add(name);
  setTimeout(() => {
    pendingSave.delete(name);
    try {
      const entries = [...map.entries()];
      localStorage.setItem(name, JSON.stringify(entries.slice(-STORE_CAP)));
    } catch { /* storage full or blocked: the in-memory copy still works */ }
  }, 500);
}

let metaCache: Map<string, TokenMeta> | null = null;
let addrCache: Map<string, `0x${string}`> | null = null;
const metas = () => (metaCache ??= loadStore<TokenMeta>(META_STORE));
const addrs = () => (addrCache ??= loadStore<`0x${string}`>(ADDR_STORE));

const metaInflight = new Map<string, Promise<TokenMeta | undefined>>();

/**
 * symbol + decimals for each token, from the cache where known and one batched
 * read for the rest. A token with one field unreadable gets '?' or 18 for it;
 * one with neither maps to undefined and callers keep their own fallback.
 */
export async function tokenMetas(client: PublicClient, tokens: readonly `0x${string}`[]): Promise<Map<string, TokenMeta | undefined>> {
  const chainId = BROWSER ? client.chain?.id ?? 0 : 0;
  const keyOf = (t: string) => `${chainId}:${t.toLowerCase()}`;
  const unique = [...new Set(tokens.map((t) => t.toLowerCase() as `0x${string}`))];
  const out = new Map<string, TokenMeta | undefined>();
  const waits: Promise<void>[] = [];
  const missing: `0x${string}`[] = [];

  for (const t of unique) {
    const hit = chainId ? metas().get(keyOf(t)) : undefined;
    if (hit) { out.set(t, hit); continue; }
    const flying = chainId ? metaInflight.get(keyOf(t)) : undefined;
    if (flying) { waits.push(flying.then((m) => { out.set(t, m); })); continue; }
    missing.push(t);
  }

  if (missing.length > 0) {
    const batch = withSafeMulticall(client).multicall({
      contracts: missing.flatMap((t) => [
        { address: t, abi: ERC20_META_ABI, functionName: 'symbol' as const },
        { address: t, abi: ERC20_META_ABI, functionName: 'decimals' as const },
      ]),
      allowFailure: true,
    }).catch(() => [] as { status: string; result?: unknown }[]);

    missing.forEach((t, i) => {
      const one = batch.then(async (res) => {
        const sym = res[i * 2], dec = res[i * 2 + 1];
        // A busy RPC can fail part of a batch. Retry those tokens one read at a
        // time: a wrong decimals default turns every amount and price into nonsense.
        const read = <T,>(fn: 'symbol' | 'decimals') =>
          client.readContract({ address: t, abi: ERC20_META_ABI, functionName: fn }).then((r) => r as T).catch(() => undefined);
        const symbol = sym?.status === 'success' ? (sym.result as string) : await read<string>('symbol');
        const decimals = dec?.status === 'success' ? Number(dec.result) : await read<number>('decimals');
        if (symbol == null && decimals == null) return undefined;
        // Half an answer is still used (a bytes32 symbol token keeps its real
        // decimals) but only a complete one is remembered.
        const m = { symbol: symbol ?? '?', decimals: decimals != null ? Number(decimals) : 18 };
        if (chainId && symbol != null && decimals != null) { metas().set(keyOf(t), m); saveStore(META_STORE, metas()); }
        return m;
      }).finally(() => { if (chainId) metaInflight.delete(keyOf(t)); });
      if (chainId) metaInflight.set(keyOf(t), one);
      waits.push(one.then((m) => { out.set(t, m); }));
    });
  }

  await Promise.all(waits);
  return out;
}

// Keys start with the chain id, so a client with no chain (id 0) is never cached.

/** Cache key for a factory lookup; `key` is the fee, the tick spacing, or 0 for Algebra's one pool per pair. */
export function poolLookupKey(chainId: number, factory: string, token0: string, token1: string, key: number): string {
  return `${chainId}:pool:${factory.toLowerCase()}:${token0.toLowerCase()}:${token1.toLowerCase()}:${key}`;
}

/** An address that, once set on chain, never changes: a factory's pool, a voter's pool at an index, a pool's gauge. */
export function knownAddress(lookup: string): `0x${string}` | undefined {
  return BROWSER ? addrs().get(lookup) : undefined;
}

/** Remember such an answer. The zero address (nothing there yet) is not kept: it may be set later. */
export function rememberAddress(lookup: string, address: `0x${string}` | undefined) {
  if (!BROWSER || !address || /^0x0{40}$/i.test(address) || lookup.startsWith('0:')) return;
  addrs().set(lookup, address);
  saveStore(ADDR_STORE, addrs());
}

// ─── Identical live reads in flight share one request ────────────────────────
const shared = new Map<string, Promise<unknown>>();

/**
 * Run `fn` unless the same read is already on its way, in which case join it.
 * Nothing is kept once it settles, so every later call still reads live data;
 * this only stops two screens that ask at the same moment from doubling the load.
 */
export function shareInflight<T>(key: string, fn: () => Promise<T>): Promise<T> {
  if (!BROWSER) return fn();
  const hit = shared.get(key);
  if (hit) return hit as Promise<T>;
  const p = fn().finally(() => { shared.delete(key); });
  shared.set(key, p);
  return p;
}
