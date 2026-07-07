'use client';
import { useEffect, useState } from 'react';
import { fetchTokenMarketChart, PricePoint } from './coingecko';
import type { Token } from './TokenStore';

export type ChartRange = '24H' | '1W' | '1M' | '1Y';
const RANGE_DAYS: Record<ChartRange, number> = { '24H': 1, '1W': 7, '1M': 30, '1Y': 365 };

export interface ValuePoint { timestamp: number; value: number; }

/** Nearest-price lookup in a sorted-by-timestamp series (small arrays — linear scan is fine). */
function priceAt(series: PricePoint[], ts: number): number | null {
  if (series.length === 0) return null;
  let best = series[0], bestDist = Math.abs(series[0].timestamp - ts);
  for (const p of series) {
    const d = Math.abs(p.timestamp - ts);
    if (d < bestDist) { best = p; bestDist = d; }
  }
  return best.price;
}

/**
 * Reconstructs a portfolio-value history from each held token's own CoinGecko
 * price history × its *current* balance (no historical balance tracking, so
 * this assumes holdings were constant over the window — same approximation
 * most lightweight portfolio trackers make without indexing every transfer).
 * Free, keyless, no third-party portfolio API involved.
 */
export function usePortfolioValueHistory(heldTokens: Token[], range: ChartRange) {
  const [points, setPoints] = useState<ValuePoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const key = heldTokens.map(t => `${t.address}:${t.balance}`).join(',');

  useEffect(() => {
    if (heldTokens.length === 0) { setPoints([]); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);

    const days = RANGE_DAYS[range];
    Promise.allSettled(heldTokens.map(t => fetchTokenMarketChart(t.address, days)))
      .then(results => {
        if (cancelled) return;
        const series = results.map((r, i) => ({
          balance: parseFloat(heldTokens[i].balance ?? '0'),
          prices: r.status === 'fulfilled' ? r.value : [],
        })).filter(s => s.balance > 0 && s.prices.length > 0);

        if (series.length === 0) { setPoints([]); return; }

        // Use the longest series as the common timeline.
        const reference = series.reduce((a, b) => (a.prices.length >= b.prices.length ? a : b)).prices;
        const merged: ValuePoint[] = reference.map(ref => {
          const value = series.reduce((sum, s) => {
            const p = priceAt(s.prices, ref.timestamp);
            return sum + (p != null ? p * s.balance : 0);
          }, 0);
          return { timestamp: ref.timestamp, value };
        });
        setPoints(merged);
      })
      .catch((e: Error) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, range]);

  return { points, loading, error };
}
