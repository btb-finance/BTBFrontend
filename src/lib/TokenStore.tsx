'use client';
import { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef, ReactNode } from 'react';
import { useAction, useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Token {
  address: string;       // lowercase '0x...' or 'ETH' for native gas token
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  balance?: string;
  balanceRaw?: string;
  usdPrice?: number;
  usdValue?: number;
  chainId?: number;
  chainSlug?: string;
  change1d?: number;
  changePct1d?: number;
  verified?: boolean;
  positionType?: string;
}

interface TokenStoreState {
  tokens: Token[];               // Convex mainnet token list enriched with wallet balances (swap picker)
  positions: Token[];            // Wallet token holdings — loaded from Convex snapshot
  balanceMap: Map<string, Token>;
  loadingList: boolean;
  loadingBalances: boolean;
  error: string | null;
  refetchBalances: () => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const Ctx = createContext<TokenStoreState>({
  tokens: [], positions: [], balanceMap: new Map(),
  loadingList: false, loadingBalances: false, error: null,
  refetchBalances: () => {},
});

export function useTokenStore() { return useContext(Ctx); }

// ─── Provider ─────────────────────────────────────────────────────────────────

const NATIVE = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
const WETH   = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';

export function TokenStoreProvider({ children, walletAddress }: { children: ReactNode; walletAddress?: string }) {
  const registerOrGet     = useMutation(api.users.registerOrGet);
  const seedIfEmpty       = useAction(api.tokens.seedIfEmpty);
  const seedPricesIfEmpty = useAction(api.prices.seedPricesIfEmpty);
  // Server-side multicall + snapshot save. Manual trigger only.
  const refreshBalances   = useAction(api.balances.refresh);

  // Convex token list + USD prices — refreshed by crons.
  const convexTokenList = useQuery(api.tokens.listAll) ?? [];
  const convexPrices    = useQuery(api.queries.listAllPrices) ?? [];
  // Cached wallet holdings — fetched server-side, read here as the single
  // source of truth for `positions`.
  const snapshot        = useQuery(
    api.users.getBalanceSnapshot,
    walletAddress ? { walletAddress } : 'skip',
  ) ?? [];

  const loadingList = convexTokenList.length === 0;
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const priceMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of convexPrices) m.set(p.address.toLowerCase(), p.priceUsd);
    // DexScreener has no native-ETH key; mirror WETH onto the native pseudo-address.
    const wethPrice = m.get(WETH);
    if (wethPrice && wethPrice > 0) m.set(NATIVE, wethPrice);
    return m;
  }, [convexPrices]);

  // Positions come straight from the Convex snapshot. Each row is re-priced
  // against the latest priceMap so USD values update without re-running RPC.
  const positions = useMemo<Token[]>(() => {
    return snapshot.map((b) => {
      const addrKey = b.tokenAddress.toLowerCase();
      const price = priceMap.get(addrKey) ?? 0;
      const balNum = parseFloat(b.balanceFormatted);
      return {
        address: addrKey === NATIVE ? 'ETH' : addrKey,
        symbol: b.symbol,
        name: b.name,
        decimals: b.decimals,
        logoURI: b.logoURI,
        balance: b.balanceFormatted,
        balanceRaw: b.balanceRaw,
        usdPrice: price,
        usdValue: balNum * price,
        chainId: 1,
      };
    });
  }, [snapshot, priceMap]);

  // Balance map for the swap picker — token list merged with live balances/prices.
  const balanceMap = useMemo(() => {
    const m = new Map<string, Token>();
    for (const t of convexTokenList) {
      const addrKey = t.address === NATIVE ? 'eth' : t.address.toLowerCase();
      const price = priceMap.get(t.address.toLowerCase()) ?? 0;
      const tok: Token = {
        address: t.address === NATIVE ? 'ETH' : t.address,
        symbol: t.symbol, name: t.name, decimals: t.decimals, logoURI: t.logoURI,
        chainId: 1, usdPrice: price,
      };
      m.set(addrKey, tok);
      m.set(t.symbol.toUpperCase(), tok);
    }
    for (const p of positions) {
      const key = p.address === 'ETH' ? 'eth' : p.address.toLowerCase();
      m.set(key, { ...(m.get(key) ?? p), ...p });
      m.set(p.symbol.toUpperCase(), { ...(m.get(p.symbol.toUpperCase()) ?? p), ...p });
    }
    return m;
  }, [convexTokenList, priceMap, positions]);

  // Convex token list merged with live wallet balances for the swap picker.
  const tokens = useMemo<Token[]>(() => convexTokenList.map((t) => {
    const key = t.address === NATIVE ? 'eth' : t.address.toLowerCase();
    return balanceMap.get(key) ?? {
      address: t.address === NATIVE ? 'ETH' : t.address,
      symbol: t.symbol, name: t.name, decimals: t.decimals, logoURI: t.logoURI,
      chainId: 1,
    };
  }), [convexTokenList, balanceMap]);

  // Trigger one fetch on wallet connect — only if the snapshot is empty.
  // After that, refreshes are explicit.
  const triggeredForRef = useRef<string>('');
  useEffect(() => {
    if (!walletAddress) return;
    if (triggeredForRef.current === walletAddress) return;
    triggeredForRef.current = walletAddress;

    Promise.all([
      registerOrGet({ walletAddress }).catch(() => {}),
      seedIfEmpty().catch(() => {}),
      seedPricesIfEmpty().catch(() => {}),
    ]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddress]);

  // First-fetch guard — only run the server multicall if Convex has no snapshot yet.
  const firstFetchRef = useRef<string>('');
  useEffect(() => {
    if (!walletAddress) return;
    // Wait until the snapshot query has resolved (not undefined).
    if (snapshot === undefined) return;
    if (snapshot.length > 0) return;
    if (firstFetchRef.current === walletAddress) return;
    firstFetchRef.current = walletAddress;

    setLoadingBalances(true);
    setError(null);
    refreshBalances({ walletAddress })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoadingBalances(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddress, snapshot]);

  const refetchBalances = useCallback(() => {
    if (!walletAddress) return;
    setLoadingBalances(true);
    setError(null);
    refreshBalances({ walletAddress })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoadingBalances(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddress]);

  return (
    <Ctx.Provider value={{
      tokens, positions, balanceMap,
      loadingList, loadingBalances, error, refetchBalances,
    }}>
      {children}
    </Ctx.Provider>
  );
}
