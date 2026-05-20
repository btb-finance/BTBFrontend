'use client';
import { useEffect, useState } from 'react';
import { fetchMobulaDefi, MobulaDefiApp } from './mobula';

// Re-export compatible types so PortfolioScreen keeps working unchanged
export type ZapperApp      = MobulaDefiApp;
export type ZapperPosition = MobulaDefiApp['positions'][number];

export function useZapperDefi(address?: string) {
  const [apps, setApps]         = useState<MobulaDefiApp[]>([]);
  const [totalUSD, setTotal]    = useState(0);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchMobulaDefi(address)
      .then(({ apps, totalUSD }) => { if (!cancelled) { setApps(apps); setTotal(totalUSD); } })
      .catch(e  => { if (!cancelled) setError((e as Error).message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [address]);

  return { apps, totalUSD, loading, error };
}
