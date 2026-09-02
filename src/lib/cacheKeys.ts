/**
 * Shared key + TTL definitions for the Convex memo cache.
 *
 * Imported by both the browser (to read `cache.get`) and the Convex fill
 * action (to write the same row), so a key can never drift between the two
 * sides and silently turn every read into a miss.
 */

export type CacheKind =
  | 'pool-history'   // Uniswap/Pancake subgraph day history
  | 'pool-daily'     // GeckoTerminal daily OHLCV
  | 'pool-stats'     // GeckoTerminal TVL/volume/creation time
  | 'token-safety'   // explorer holder concentration + spam flags
  | 'token-prices';  // DeFiLlama USD prices

/**
 * How long a filled entry stays valid. Everything shared and slow-moving gets
 * the standard 30 minutes; pool stats carry an immutable creation timestamp so
 * they hold longer, and USD prices stay short because position sizing reads
 * them — a half-hour-old price would misprice the simulator.
 */
export const CACHE_TTL_MS: Record<CacheKind, number> = {
  'pool-history': 30 * 60_000,
  'pool-daily': 30 * 60_000,
  'pool-stats': 6 * 60 * 60_000,
  'token-safety': 30 * 60_000,
  'token-prices': 5 * 60_000,
};

export type CacheArgs = {
  kind: CacheKind;
  /** Pool address, pool id, or a comma-joined address list — lowercased. */
  id: string;
  /** GeckoTerminal / DeFiLlama network slug, when the source is chain-scoped. */
  network?: string;
  chainId?: number;
  days?: number;
  subgraphId?: string;
  explorerBase?: string;
};

/** Stable, collision-free key. Field order is fixed — do not reorder. */
export function cacheKey(a: CacheArgs): string {
  return [
    a.kind,
    a.id.toLowerCase(),
    a.network ?? '',
    a.chainId ?? '',
    a.days ?? '',
    a.subgraphId ?? '',
    a.explorerBase ?? '',
  ].join('|');
}
