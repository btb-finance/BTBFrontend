/**
 * Yearn vault catalog — pure data layer, no React and no wagmi.
 *
 * Split out of `yearn.ts` (which is `'use client'`) so the Convex refresher
 * can import the exact same fetch + parse code. The vault list is identical
 * for every visitor, so it is fetched once per cron tick server-side and read
 * from a snapshot in the browser — see `convex/globalRefresh.ts`.
 */

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

/** Snapshot-safe shape — `pricePerShare` is a bigint, which JSON cannot hold. */
export type YearnVaultWire = Omit<YearnVault, 'pricePerShare'> & { pricePerShare: string };

export const toWire = (v: YearnVault): YearnVaultWire => ({ ...v, pricePerShare: v.pricePerShare.toString() });
export const fromWire = (w: YearnVaultWire): YearnVault => ({ ...w, pricePerShare: BigInt(w.pricePerShare || '0') });

export function parseVaults(raw: unknown[]): YearnVault[] {
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

/** One ydaemon round trip. Called by the Convex cron, not by the browser. */
export async function fetchYearnVaultsFromApi(): Promise<YearnVault[]> {
  const response = await fetch(`${YDAEMON}/${YEARN_CHAIN_ID}/vaults/all?limit=1000`);
  if (!response.ok) throw new Error(`ydaemon ${response.status}`);
  return parseVaults(await response.json());
}

export function sharesToUnderlying(shares: bigint, v: YearnVault): bigint {
  return (shares * v.pricePerShare) / 10n ** BigInt(v.decimals);
}

export function yearnUrl(v: YearnVault): string {
  return v.isV3
    ? `https://yearn.fi/v3/${YEARN_CHAIN_ID}/${v.address}`
    : `https://yearn.fi/vaults/${YEARN_CHAIN_ID}/${v.address}`;
}
