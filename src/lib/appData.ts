'use client';
import { useQuery } from '@tanstack/react-query';
import { fetchKrystalLp, type KrystalLpResponse } from './krystal';
import type { LiquidityPosition } from '@/protocols/types';

/**
 * Shared app data layer. Every screen that needs the same fact reads the same
 * React Query cache entry, so nothing is fetched twice and navigating between
 * Home, Portfolio, and sheets reuses what is already loaded instead of
 * spinning its own loaders.
 */

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
