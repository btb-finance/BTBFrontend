'use client';

import { useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { MarketToken } from './robinhoodMarkets';

export type { MarketToken } from './robinhoodMarkets';

export type MarketFeedData = {
  markets: MarketToken[];
  updatedAt: number | null;
  loading: boolean;
  error: string | null;
};

export function useMarketFeed(): MarketFeedData {
  const row = useQuery(api.markets.get, {});
  return useMemo(() => {
    if (row === undefined) return { markets: [], updatedAt: null, loading: true, error: null };
    if (!row) return { markets: [], updatedAt: null, loading: false, error: 'Market snapshot is not ready yet.' };
    try {
      const snapshot = JSON.parse(row.json) as { version?: number; markets?: MarketToken[] };
      const markets = Array.isArray(snapshot.markets) ? snapshot.markets : [];
      return {
        markets,
        updatedAt: row.updatedAt,
        loading: false,
        error: markets.length > 0 ? null : 'Market snapshot is empty.',
      };
    } catch {
      return { markets: [], updatedAt: row.updatedAt, loading: false, error: 'Market snapshot is invalid.' };
    }
  }, [row]);
}
