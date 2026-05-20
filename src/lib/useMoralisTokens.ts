'use client';
import { useEffect, useState } from 'react';

const API_KEY = process.env.NEXT_PUBLIC_MORALIS_KEY ?? '';
const BASE = 'https://deep-index.moralis.io/api/v2.2';

export interface MoralisToken {
  token_address: string;
  symbol: string;
  name: string;
  logo?: string;
  decimals: number;
  balance: string;
  balance_formatted: string;
  usd_price?: number;
  usd_value?: number;
  portfolio_percentage?: number;
  verified_contract?: boolean;
}

export interface WalletPortfolio {
  tokens: MoralisToken[];
  totalUsd: number;
  loading: boolean;
  error: string | null;
}

export function useMoralisTokens(address?: string): WalletPortfolio {
  const [tokens, setTokens] = useState<MoralisToken[]>([]);
  const [totalUsd, setTotalUsd] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;

    async function fetch_() {
      setLoading(true);
      setError(null);
      try {
        // Fetch ERC-20 tokens + native ETH in one call via the wallet tokens endpoint
        const res = await fetch(
          `${BASE}/wallets/${address}/tokens?chain=eth&limit=100`,
          { headers: { 'X-API-Key': API_KEY, accept: 'application/json' } }
        );
        if (!res.ok) throw new Error(`Moralis ${res.status}`);
        const data = await res.json();
        if (cancelled) return;

        const list: MoralisToken[] = (data.result ?? []);
        const total = list.reduce((s, t) => s + (t.usd_value ?? 0), 0);

        setTokens(list);
        setTotalUsd(total);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetch_();
    return () => { cancelled = true; };
  }, [address]);

  return { tokens, totalUsd, loading, error };
}
