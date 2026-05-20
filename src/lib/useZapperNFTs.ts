'use client';
import { useEffect, useState } from 'react';
import { fetchZapperNFTs, ZapperNFT } from './zapper';

export function useZapperNFTs(address?: string, limit = 25) {
  const [nfts, setNfts]           = useState<ZapperNFT[]>([]);
  const [totalUSD, setTotal]      = useState(0);
  const [totalOwned, setOwned]    = useState(0);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchZapperNFTs(address, limit)
      .then(({ nfts, totalUSD, totalOwned }) => {
        if (!cancelled) { setNfts(nfts); setTotal(totalUSD); setOwned(totalOwned); }
      })
      .catch(e  => { if (!cancelled) setError((e as Error).message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [address, limit]);

  return { nfts, totalUSD, totalOwned, loading, error };
}
