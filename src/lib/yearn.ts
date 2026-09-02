'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useReadContracts } from 'wagmi';
import { erc20Abi, formatUnits } from 'viem';
import { useSnapshot } from './convexCache';
import {
  fetchYearnVaultsFromApi, fromWire, sharesToUnderlying,
  type YearnVault, type YearnVaultWire,
} from './yearnVaults';

// ─── Yearn data layer (shared by EarnScreen & PortfolioScreen) ───────────────
// The vault catalog is the same for every visitor, so it is fetched once per
// cron tick by Convex (convex/globalRefresh.ts) and read here as a snapshot.
// Types, parsing, and the raw ydaemon call live in ./yearnVaults so the Convex
// action can share them; they are re-exported so this module stays the single
// import site for the rest of the app.
export {
  YEARN_CHAIN_ID, sharesToUnderlying, yearnUrl,
  type StakingSource, type YearnVault,
} from './yearnVaults';

/** Snapshot key — must match convex/globalRefresh.ts. */
const SNAPSHOT_KEY = 'yearn-vaults';

// ─── ABIs ────────────────────────────────────────────────────────────────────
// V3 vaults are ERC-4626; V2 ("Legacy", version 0.x) use deposit(uint256) /
// withdraw(maxShares).
export const V2_VAULT_ABI = [
  { name: 'deposit',  type: 'function', stateMutability: 'nonpayable', inputs: [{ name: '_amount', type: 'uint256' }], outputs: [{ type: 'uint256' }] },
  { name: 'withdraw', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'maxShares', type: 'uint256' }], outputs: [{ type: 'uint256' }] },
] as const;

export const V3_VAULT_ABI = [
  { name: 'deposit',  type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'assets', type: 'uint256' }, { name: 'receiver', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'withdraw', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'assets', type: 'uint256' }, { name: 'receiver', type: 'address' }, { name: 'owner', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'redeem',   type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'shares', type: 'uint256' }, { name: 'receiver', type: 'address' }, { name: 'owner', type: 'address' }], outputs: [{ type: 'uint256' }] },
] as const;

// veYFI gauge — ERC-4626 over the yv token, shares mint 1:1, rewards in dYFI.
export const VEYFI_GAUGE_ABI = [
  { name: 'deposit',  type: 'function', stateMutability: 'nonpayable', inputs: [{ name: '_assets', type: 'uint256' }, { name: '_receiver', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'redeem',   type: 'function', stateMutability: 'nonpayable', inputs: [{ name: '_assets', type: 'uint256' }, { name: '_receiver', type: 'address' }, { name: '_owner', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'getReward', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: '_account', type: 'address' }], outputs: [{ type: 'bool' }] },
] as const;

// Synthetix-style StakingRewards used by "V3 Staking" vaults.
export const STAKING_REWARDS_ABI = [
  { name: 'stake',    type: 'function', stateMutability: 'nonpayable', inputs: [{ name: '_amount', type: 'uint256' }], outputs: [] },
  { name: 'withdraw', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: '_amount', type: 'uint256' }], outputs: [] },
  { name: 'getReward', type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
] as const;

export const EARNED_ABI = [
  { name: 'earned', type: 'function', stateMutability: 'view', inputs: [{ name: '_account', type: 'address' }], outputs: [{ type: 'uint256' }] },
] as const;

// ─── vault list (one shared Convex snapshot, refreshed every 30 min) ────────

type VaultSnapshot = { version?: number; vaults?: YearnVaultWire[] };

/**
 * The vault catalog.
 *
 * Normal path: one Convex row, already computed — no ydaemon call from the
 * browser at all. The direct fetch below is a cold-start fallback only, for
 * the window before the first cron tick has ever run on a deployment; without
 * it a fresh environment would show an empty Earn tab for up to 30 minutes.
 */
export function useYearnVaults() {
  const snapshot = useSnapshot<VaultSnapshot>(SNAPSHOT_KEY);
  const [fallback, setFallback] = useState<YearnVault[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const fromSnapshot = useMemo(() => {
    const wire = snapshot.data?.vaults;
    return wire && wire.length > 0 ? wire.map(fromWire) : null;
  }, [snapshot.data]);

  useEffect(() => {
    if (snapshot.loading || fromSnapshot) return;
    let live = true;
    fetchYearnVaultsFromApi()
      .then((v) => { if (live) { setFallback(v); setError(null); } })
      .catch((e) => { if (live) setError(e?.message ?? 'Failed to load vaults'); });
    return () => { live = false; };
  }, [snapshot.loading, fromSnapshot, nonce]);

  const vaults = fromSnapshot ?? fallback;
  const reload = useCallback(() => { setFallback(null); setError(null); setNonce((n) => n + 1); }, []);

  return { vaults, error: vaults ? null : error, reload };
}

// ─── wallet positions (vault shares + staked gauge shares) ──────────────────

export type YearnPosition = {
  vault: YearnVault;
  shares: bigint;       // total yv shares (wallet + staked), gauge shares are 1:1
  stakedShares: bigint; // portion sitting in the staking contract
  underlying: number;   // in the vault's underlying token
  usd: number;
};

export function useYearnPositions(owner: string | undefined, vaults: YearnVault[] | null) {
  const account = owner as `0x${string}` | undefined;

  const readPlan = useMemo(() => {
    if (!account || !vaults) return [];
    return vaults.flatMap((v, vi) => [
      { vi, staked: false, contract: { address: v.address, abi: erc20Abi, functionName: 'balanceOf' as const, args: [account] as const } },
      ...(v.staking ? [{ vi, staked: true, contract: { address: v.staking.address, abi: erc20Abi, functionName: 'balanceOf' as const, args: [account] as const } }] : []),
    ]);
  }, [account, vaults]);

  const reads = useReadContracts({
    contracts: readPlan.map(p => p.contract),
    query: { enabled: readPlan.length > 0, refetchInterval: 60_000 },
  });

  const positions = useMemo(() => {
    const out: YearnPosition[] = [];
    if (!vaults || !reads.data) return out;
    const acc = new Map<number, { total: bigint; staked: bigint }>();
    readPlan.forEach((p, i) => {
      const bal = reads.data![i]?.result as bigint | undefined;
      if (!bal) return;
      const a = acc.get(p.vi) ?? { total: 0n, staked: 0n };
      a.total += bal;
      if (p.staked) a.staked += bal;
      acc.set(p.vi, a);
    });
    acc.forEach((a, vi) => {
      if (a.total === 0n) return;
      const vault = vaults[vi];
      const underlying = parseFloat(formatUnits(sharesToUnderlying(a.total, vault), vault.token.decimals));
      out.push({ vault, shares: a.total, stakedShares: a.staked, underlying, usd: underlying * vault.tokenPrice });
    });
    out.sort((a, b) => b.usd - a.usd);
    return out;
  }, [vaults, reads.data, readPlan]);

  return { positions, loading: readPlan.length > 0 && reads.isLoading, refetch: reads.refetch };
}
