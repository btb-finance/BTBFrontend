'use client';
import { useEffect, useState, useCallback } from 'react';
import { fetchTransactionHistory, ZapperTx } from './zapper';

export function useTransactionHistory(address?: string, pageSize = 25) {
  const [txs, setTxs]         = useState<ZapperTx[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [cursor, setCursor]   = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    setLoading(true);
    setTxs([]);
    setCursor(undefined);
    setError(null);
    fetchTransactionHistory(address, pageSize)
      .then(({ txs, endCursor, hasNextPage }) => {
        if (!cancelled) { setTxs(txs); setCursor(endCursor); setHasMore(hasNextPage); }
      })
      .catch(e => { if (!cancelled) setError((e as Error).message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [address, pageSize]);

  const loadMore = useCallback(async () => {
    if (!address || !cursor || loading) return;
    setLoading(true);
    try {
      const { txs: more, endCursor, hasNextPage } = await fetchTransactionHistory(address, pageSize, cursor);
      setTxs(prev => [...prev, ...more]);
      setCursor(endCursor);
      setHasMore(hasNextPage);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [address, cursor, loading, pageSize]);

  return { txs, loading, error, hasMore, loadMore };
}
