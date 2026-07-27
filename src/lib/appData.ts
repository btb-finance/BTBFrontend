'use client';
import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchAccountAssets, type AccountAsset } from './accountAssets';
import { fetchKrystalLp, type KrystalLpResponse } from './krystal';
import type { LiquidityPosition } from '@/protocols/types';

/**
 * Shared app data layer. Every screen that needs the same fact reads the same
 * React Query cache entry, so nothing is fetched twice and navigating between
 * Home, Portfolio, and sheets reuses what is already loaded instead of
 * spinning its own loaders.
 */

// Server side the assets route caches per address; a bumped nonce busts it
// after a trade or deposit so the refetch returns fresh balances.
const assetNonce = new Map<string, number>();

/**
 * Wallet or smart account token balances, shared across all consumers.
 *
 * Pass `live` from a screen where the balance is being acted on — it polls
 * every 10 seconds so a trade is never sized against a stale number. The poll
 * is invisible by construction: `placeholderData` keeps the previous values on
 * screen while the next request is in flight, so figures are replaced in place
 * rather than collapsing to a loader. Screens that only display balances leave
 * it off and keep the cheap 30 second cache.
 */
export function useAccountAssets(address?: string | null, options?: { live?: boolean }) {
  const key = address?.toLowerCase() ?? '';
  const live = options?.live ?? false;
  return useQuery<AccountAsset[]>({
    queryKey: ['account-assets', key],
    queryFn: ({ signal }) => fetchAccountAssets(address as string, signal, assetNonce.get(key) ?? 0),
    enabled: !!address,
    staleTime: live ? 5_000 : 30_000,
    gcTime: 5 * 60_000,
    // A hidden tab has no user to keep current, and this hits an RPC-backed
    // route on a rate limited key.
    refetchInterval: live ? 10_000 : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: live,
    placeholderData: previous => previous,
  });
}

/** Invalidate balances after a trade, deposit, or withdrawal. */
export function useRefreshAssets() {
  const queryClient = useQueryClient();
  return useCallback((...addresses: (string | null | undefined)[]) => {
    for (const address of addresses) {
      if (!address) continue;
      const key = address.toLowerCase();
      assetNonce.set(key, (assetNonce.get(key) ?? 0) + 1);
      void queryClient.invalidateQueries({ queryKey: ['account-assets', key] });
    }
  }, [queryClient]);
}

/** Krystal LP analytics (history, PnL, other chain positions), shared. */
export function useKrystalLp(address?: string | null) {
  return useQuery<KrystalLpResponse>({
    queryKey: ['krystal-lp', address?.toLowerCase() ?? ''],
    queryFn: () => fetchKrystalLp(address as string),
    enabled: !!address,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    placeholderData: previous => previous,
  });
}

// ── On-chain LP position snapshot ────────────────────────────────────────────
// The LP list loads progressively (each protocol lands as it resolves), which
// React Query cannot model as one queryFn. Instead the last full snapshot is
// kept here so a revisit renders instantly while a background refresh runs.

const lpSnapshots = new Map<string, LiquidityPosition[]>();

export function getCachedLpPositions(address?: string | null): LiquidityPosition[] | null {
  return address ? lpSnapshots.get(address.toLowerCase()) ?? null : null;
}

export function setCachedLpPositions(address: string, positions: LiquidityPosition[]): void {
  lpSnapshots.set(address.toLowerCase(), positions);
}
