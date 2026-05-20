'use client';
import { useEffect, useState } from 'react';
import { fetchPortfolioChart, ChartPoint, TimeFrame } from './zapper';

export function usePortfolioChart(address?: string, timeFrame: TimeFrame = 'WEEK') {
  const [points, setPoints]   = useState<ChartPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchPortfolioChart(address, timeFrame)
      .then(p  => { if (!cancelled) setPoints(p); })
      .catch(e => { if (!cancelled) setError((e as Error).message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [address, timeFrame]);

  return { points, loading, error };
}
