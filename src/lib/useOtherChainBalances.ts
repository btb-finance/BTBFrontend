'use client';
import { useEffect, useState } from 'react';
import { formatUnits } from 'viem';
import {
  ALCHEMY_NETWORKS, ALCHEMY_CHAIN_ID, NATIVE_TOKEN,
  fetchAlchemyTokenBalances, fetchAlchemyTokenMetadata, fetchAlchemyTokenPrices, fetchAlchemyNativePrices,
} from './alchemy';
import type { Token } from './TokenStore';

// Ethereum mainnet already has its own dedicated (free, RPC-multicall-based)
// balance pipeline in TokenStore — this hook only covers the other chains
// Alchemy's free-tier Portfolio API supports, so a connected wallet's L2/sidechain
// holdings show up too instead of silently being invisible.
const OTHER_NETWORKS = ALCHEMY_NETWORKS.filter(n => n !== 'eth-mainnet');

/** Dust filter — skip balances too small to be worth a metadata+price lookup. */
const MIN_RAW_BALANCE = 1n;

export function useOtherChainBalances(walletAddress?: string) {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!walletAddress) { setTokens([]); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const res = await fetch(`/api/krystal/tokens?address=${walletAddress}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`Krystal tokens ${res.status}`);
        const json = await res.json() as KrystalTokenBalanceOutput;
        const result: Token[] = [];
        const seen = new Set<string>();

        for (const chain of json.data ?? []) {
          for (const item of chain.balances ?? []) {
            const token = item.token;
            if (!token?.address || !token.symbol || token.tag?.toUpperCase().includes('SPAM')) continue;
            const tag = token.tag?.toUpperCase() ?? '';
            const quote = item.quotes?.usd;
            const hasMarketData = (quote?.value ?? 0) > 0 || (quote?.price ?? quote?.marketPrice ?? 0) > 0;
            // Krystal returns thousands of unsolicited, unclassified airdrops
            // on some chains. Keep market-backed and explicitly classified
            // assets, while excluding unknown zero-value entries from the UI.
            if (!hasMarketData && tag !== 'VERIFIED' && tag !== 'UNVERIFIED') continue;
            let raw: bigint;
            try { raw = BigInt(item.balance ?? '0'); } catch { continue; }
            if (raw <= 0n) continue;
            const key = `${chain.chainId}:${token.address.toLowerCase()}`;
            if (seen.has(key)) continue;
            seen.add(key);
            const decimals = typeof token.decimals === 'number' && Number.isFinite(token.decimals) ? token.decimals : 18;
            const isNative = token.address.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
              || token.address.toLowerCase() === '0x0000000000000000000000000000000000000000';
            const suspiciousQuote = !isNative && tag !== 'VERIFIED'
              && (quote?.value ?? 0) >= 100
              && (quote?.timestamp ?? 0) <= 0
              && (quote?.marketPrice ?? 0) <= 0;
            result.push({
              address: token.address.toLowerCase(),
              symbol: token.symbol,
              name: token.name || token.symbol,
              decimals,
              logoURI: token.logo || undefined,
              balance: formatUnits(raw, decimals),
              balanceRaw: raw.toString(),
              usdPrice: quote?.price ?? quote?.marketPrice ?? 0,
              usdValue: quote?.value ?? 0,
              verified: tag === 'VERIFIED' ? true : tag === 'UNVERIFIED' ? false : undefined,
              suspiciousQuote,
              chainId: chain.chainId,
              chainSlug: chain.chainName,
            });
          }
        }
        if (cancelled) return;
        setTokens(result);
        return;
      } catch {
        // Alchemy remains a fallback only when Krystal is unavailable.
      }

      const balances = await fetchAlchemyTokenBalances(walletAddress, OTHER_NETWORKS);
      const held = balances.filter(b => {
        try { return BigInt(b.tokenBalance) >= MIN_RAW_BALANCE; } catch { return false; }
      });
      if (cancelled) return;

      const erc20s = held.filter(b => b.tokenAddress);
      const natives = held.filter(b => !b.tokenAddress);

      // Metadata — one RPC call per unique (network, token), Alchemy has no batch endpoint.
      const metaEntries = await Promise.all(
        erc20s.map(async b => {
          const meta = await fetchAlchemyTokenMetadata(b.network, b.tokenAddress!);
          return { key: `${b.network}:${b.tokenAddress!.toLowerCase()}`, meta };
        }),
      );
      if (cancelled) return;
      const metaMap = new Map(metaEntries.filter(e => e.meta).map(e => [e.key, e.meta!]));

      const [erc20Prices, nativePrices] = await Promise.all([
        fetchAlchemyTokenPrices(erc20s.map(b => ({ network: b.network, address: b.tokenAddress! }))),
        fetchAlchemyNativePrices(natives.map(b => NATIVE_TOKEN[b.network]?.symbol ?? 'ETH')),
      ]);
      if (cancelled) return;

      const result: Token[] = [];

      for (const b of natives) {
        const native = NATIVE_TOKEN[b.network] ?? { symbol: 'ETH', name: 'Ethereum' };
        const balNum = Number(BigInt(b.tokenBalance)) / 1e18;
        const price = nativePrices[native.symbol] ?? 0;
        if (balNum <= 0) continue;
        result.push({
          address: 'ETH', symbol: native.symbol, name: native.name, decimals: 18,
          balance: balNum.toString(), balanceRaw: b.tokenBalance,
          usdPrice: price, usdValue: balNum * price,
          chainId: b.chainId, chainSlug: b.network,
        });
      }

      for (const b of erc20s) {
        const key = `${b.network}:${b.tokenAddress!.toLowerCase()}`;
        const meta = metaMap.get(key);
        if (!meta) continue;
        const balNum = Number(BigInt(b.tokenBalance)) / 10 ** meta.decimals;
        if (balNum <= 0) continue;
        const price = erc20Prices[key] ?? 0;
        // No price data at all almost always means an unsolicited airdrop/spam
        // token (fake "claim your reward" tokens, scam links in the name,
        // etc.) rather than a real asset — Alchemy has no spam filter on this
        // endpoint, so this is the cheapest signal to exclude them.
        if (price <= 0) continue;
        result.push({
          address: b.tokenAddress!.toLowerCase(), symbol: meta.symbol, name: meta.name, decimals: meta.decimals,
          logoURI: meta.logo,
          balance: balNum.toString(), balanceRaw: b.tokenBalance,
          usdPrice: price, usdValue: balNum * price,
          chainId: b.chainId, chainSlug: b.network,
        });
      }

      if (!cancelled) setTokens(result);
    })()
      .catch((e: Error) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [walletAddress]);

  return { tokens, loading, error };
}

interface KrystalTokenBalanceOutput {
  data?: Array<{
    chainId: number;
    chainName: string;
    balances?: Array<{
      balance?: string;
      token?: { address?: string; symbol?: string; name?: string; decimals?: number; logo?: string; tag?: string };
      quotes?: { usd?: { value?: number; price?: number; marketPrice?: number; timestamp?: number } };
    }>;
  }>;
}
