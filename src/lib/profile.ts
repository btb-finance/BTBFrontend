'use client';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

export interface ProfileWallet { address: string; label?: string; linkedAt: number }

/** Every wallet in the profile that contains `address` (the address itself when unlinked). */
export function useProfileWallets(address?: string): { profileId?: string; wallets: ProfileWallet[]; loading: boolean } {
  const res = useQuery(api.profiles.forAddress, address ? { address } : 'skip');
  if (!address) return { wallets: [], loading: false };
  if (!res) return { wallets: [{ address: address.toLowerCase(), linkedAt: 0 }], loading: true };
  return { profileId: res.profileId, wallets: res.wallets, loading: false };
}

/** Must match convex/profilesActions.ts linkMessage exactly. */
export function linkMessage(wallet: string, other: string, issuedAt: number): string {
  return `BTB Finance\n\nLink this wallet to my profile.\n\nWallet: ${wallet}\nWith: ${other}\nIssued: ${new Date(issuedAt).toISOString()}`;
}

export function shortAddr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}
