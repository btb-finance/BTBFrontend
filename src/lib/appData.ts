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

const lpSnapshots = new Map<string, { positions: LiquidityPosition[]; at: number; indexKey: string }>();

export function getCachedLpPositions(address?: string | null): LiquidityPosition[] | null {
  return address ? lpSnapshots.get(address.toLowerCase())?.positions ?? null : null;
}

/** `indexKey` names the position index the snapshot was read against, so a changed index is never treated as fresh. */
export function setCachedLpPositions(address: string, positions: LiquidityPosition[], indexKey = ''): void {
  lpSnapshots.set(address.toLowerCase(), { positions, at: Date.now(), indexKey });
}

/**
 * The full multi chain LP scan is the heaviest read in the app (every venue on
 * every chain). Reopening Portfolio within this window reuses the last full
 * read instead of scanning again; any action that changes a position still
 * forces a fresh scan.
 */
const LP_FRESH_MS = 60_000;
export function isLpSnapshotFresh(address: string, indexKey: string): boolean {
  const s = lpSnapshots.get(address.toLowerCase());
  return !!s && s.indexKey === indexKey && Date.now() - s.at < LP_FRESH_MS;
}

/** Any confirmed transaction may have minted, moved or closed a position anywhere in the app; the next view rescans. */
export function markLpSnapshotsStale(): void {
  for (const s of lpSnapshots.values()) s.at = 0;
}
