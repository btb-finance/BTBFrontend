'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useReadContracts } from 'wagmi';
import { erc20Abi, formatUnits } from 'viem';

// ─── Yearn data layer (shared by EarnScreen & PortfolioScreen) ───────────────
// ydaemon is the public API used by yearn.fi itself —
// https://docs.yearn.fi/developers/building-on-yearn
const YDAEMON = 'https://ydaemon.yearn.fi';
export const YEARN_CHAIN_ID = 1; // app is mainnet-only (see MiniApp chain lock)
const MIN_TVL = 50_000;          // hide dust/dead vaults

export type StakingSource = 'VeYFI' | 'V3 Staking';

export type YearnVault = {
  address: `0x${string}`;
  name: string;
  symbol: string;
  decimals: number;
  version: string;
  isV3: boolean;
  category: string;
  token: { address: `0x${string}`; symbol: string; name: string; decimals: number; icon?: string };
  tvlUsd: number;
  tokenPrice: number;
  apy: number | null;          // net APY as a fraction (0.05 = 5%)
  stakingApr: number | null;   // extra gauge rewards APR, if any
  // Staking product attached to the vault: stake yv shares → earn rewards.
  // VeYFI gauges are ERC-4626 (1:1 shares) paying dYFI; "V3 Staking" is a
  // Synthetix-style StakingRewards contract.
  staking?: { address: `0x${string}`; source: StakingSource; rewardSymbol: string };
  pricePerShare: bigint;       // scaled by 10^decimals
};

function parseVaults(raw: unknown[]): YearnVault[] {
  const out: YearnVault[] = [];
  for (const r of raw as any[]) {
    if (r.chainID !== YEARN_CHAIN_ID || !r.endorsed) continue;
    if (r.details?.isRetired || r.info?.isRetired || r.info?.isHidden) continue;
    const tvlUsd = r.tvl?.tvl ?? 0;
    if (tvlUsd < MIN_TVL) continue;
    const fwd = r.apr?.forwardAPR?.netAPR;
    const net = r.apr?.netAPR;
    const apy = fwd != null && fwd > 0 ? fwd : net ?? null;
    const st = r.staking;
    const source = st?.source as StakingSource | undefined;
    out.push({
      address: r.address,
      name: r.displayName || r.name,
      symbol: r.symbol,
      decimals: r.decimals,
      version: r.version ?? '',
      isV3: /^[~]?3/.test(r.version ?? ''),
      category: r.category ?? '',
      token: {
        address: r.token?.address,
        symbol: r.token?.display_symbol || r.token?.symbol || '',
        name: r.token?.display_name || r.token?.name || '',
        decimals: r.token?.decimals ?? 18,
        icon: r.token?.icon,
      },
      tvlUsd,
      tokenPrice: r.tvl?.price ?? 0,
      apy,
      stakingApr: r.apr?.extra?.stakingRewardsAPR ?? null,
      staking: st?.available && st.address && (source === 'VeYFI' || source === 'V3 Staking')
        ? { address: st.address, source, rewardSymbol: st.rewards?.[0]?.symbol ?? 'rewards' }
        : undefined,
      pricePerShare: BigInt(r.pricePerShare ?? '0'),
    });
  }
  out.sort((a, b) => b.tvlUsd - a.tvlUsd);
  return out;
}

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

// ─── helpers ─────────────────────────────────────────────────────────────────

export function sharesToUnderlying(shares: bigint, v: YearnVault): bigint {
  return (shares * v.pricePerShare) / 10n ** BigInt(v.decimals);
}

export function yearnUrl(v: YearnVault): string {
  return v.isV3
    ? `https://yearn.fi/v3/${YEARN_CHAIN_ID}/${v.address}`
    : `https://yearn.fi/vaults/${YEARN_CHAIN_ID}/${v.address}`;
}

// ─── vault list (module-cached so Earn & Portfolio share one fetch) ──────────

let cache: YearnVault[] | null = null;
let inflight: Promise<YearnVault[]> | null = null;

function fetchYearnVaults(): Promise<YearnVault[]> {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = fetch(`${YDAEMON}/${YEARN_CHAIN_ID}/vaults/all?limit=1000`)
      .then(r => { if (!r.ok) throw new Error(`ydaemon ${r.status}`); return r.json(); })
      .then(raw => { cache = parseVaults(raw); return cache; })
      .finally(() => { inflight = null; });
  }
  return inflight;
}

/** Fire-and-forget warmup so the Earn tab and Portfolio open instantly. */
export function prefetchYearnVaults() {
  fetchYearnVaults().catch(() => {});
}

export function useYearnVaults() {
  const [vaults, setVaults] = useState<YearnVault[] | null>(cache);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    let on = true;
    fetchYearnVaults()
      .then(v => { if (on) setVaults(v); })
      .catch(e => { if (on) setError(e?.message ?? 'Failed to load vaults'); });
    return () => { on = false; };
  }, []);

  useEffect(load, [load]);
  const reload = useCallback(() => { cache = null; load(); }, [load]);

  return { vaults, error, reload };
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
