// Pool helpers and row pieces shared by the Discover screen and its server-rendered preview
// (src/components/discover/DiscoverPreview.tsx). No hooks and no wallet state here, so the same markup renders on the
// server for the first paint and in the app afterwards.
import type { CSSProperties, ReactNode } from 'react';
import { isAddress } from 'viem';
import { fmtApr, fmtCompactUsd, fmtFeeTier, type EarnPool } from '../../lib/pools';
import { isOldAero } from '@/lib/aeroPools';
import { CHAIN_META } from '../../lib/chainMeta';
import { KYBER_CHAINS } from '../../lib/kyberswap';
import { TokenIcon } from '../TokenIcon';
import { DexLogo } from '../DexLogo';
import { Badge } from '../Badge';
import { Icon } from '../Icon';
import { ChainLogo } from '../ChainLogo';
import { Glass } from '../Glass';
import { btb } from '../design-tokens';

/** Fee-based estimate used when the indexer doesn't report real 24h fees (DeFiLlama-sourced rows). */
export function estFees24h(p: EarnPool): number {
  return p.fees24hUsd ?? (p.tvlUsd * p.apyBase) / 100 / 365;
}

export function headlineApr(p: EarnPool): number {
  return p.aprRange ?? p.apy;
}

/** Hover text for the APR cell when no gauge route explains it. */
export function rangeAprTitle(p: EarnPool): string {
  return rangeAprText(p) + (p.lpCutPct ? ` After the DEX's ${p.lpCutPct}% cut of swap fees.` : '');
}

export function rangeAprText(p: EarnPool): string {
  const y = p.rangeYield;
  if (y && p.aprRange != null) {
    const days = Math.max(1, Math.round(y.days));
    const span = `${days} ${days === 1 ? 'day' : 'days'}`;
    const inRange = y.inRangePct != null ? ` In range ${y.inRangePct}% of the time.` : '';
    const scaled = y.scaled ? ' Measured on the nearest liquidity edges and scaled to ±5%, so it assumes the price stayed within ±5%.' : '';
    const net = `${y.netPct >= 0 ? '+' : ''}${y.netPct.toFixed(2)}%`;
    return `What a ±5% range, reset once a day, really earned in fees over the last ${span}, read from the pool's fee counters.${inRange}${scaled} With each day's price move counted, against just holding: ${net} over the ${span}.`;
  }
  return p.aprRange != null ? '±5% range APR estimated from 24h volume' : 'Whole pool fees over TVL. No range data for this pool yet.';
}

/** Short tag under the APR: how the number was made. */
export function rangeAprTag(p: EarnPool): string | null {
  const y = p.rangeYield;
  if (!y) return null;
  return `±5% · ${Math.max(1, Math.round(y.days))}d${y.scaled ? ' · scaled' : ''}`;
}

export function aprContext(p: EarnPool): { label: string; title: string } | null {
  const reward = p.rewardTokenSymbols?.join(' + ') || 'gauge';
  if (p.yieldMode === 'stake-or-fees') {
    const route = p.requiresStaking ? `Stake LP · ${reward}` : 'Unstaked fee yield';
    return {
      label: route,
      title: `${route}. Gauge rewards: ${fmtApr(p.apyReward)}; unstaked fee APR: ${fmtApr(p.apyBase)}. These alternatives are not added together.`,
    };
  }
  if (p.yieldMode === 'staked-rewards') {
    return {
      label: `Stake LP · ${reward}`,
      title: `Gauge reward APR paid to staked LP positions in ${reward}: ${fmtApr(p.apyReward)}. Fee APR is shown separately and is not added to this staked route.`,
    };
  }
  return null;
}

export type DiscoverChain = { name: string; chainId?: number; logo?: string };

/** Quote-side tokens: a pool is scanned by its other token. */
export const SCAN_SKIP = new Set(['USDC', 'USDT', 'DAI', 'WETH', 'ETH', 'WBTC', 'CBBTC', 'USDBC', 'USDS', 'USDE', 'BTC', 'WBNB', 'BNB', 'USDC.E']);

/** The token a Scan of this pool looks at: the side that is not a stablecoin or wrapped major, else the first. */
export function scanTokenOf(p: EarnPool): string | null {
  const tokens = p.underlyingTokens ?? [];
  if (tokens.length < 2) return null;
  const [s0, s1] = p.pair.split(/[-/]/).map((s) => s.trim().toUpperCase());
  const i = SCAN_SKIP.has(s0) && !SCAN_SKIP.has(s1 ?? '') ? 1 : 0;
  const t = tokens[i]?.toLowerCase() ?? '';
  return /^0x[0-9a-f]{40}$/.test(t) ? t : null;
}

export function discoverChainId(name: string, explicitId?: number): number | undefined {
  if (explicitId && CHAIN_META[explicitId]) return explicitId;
  const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const aliases: Record<string, number> = {
    ethereum: 1, ethereummainnet: 1, bsc: 56, bnbchain: 56, bnbsmartchain: 56,
    polygon: 137, polygonmainnet: 137, arbitrum: 42161, arbitrumone: 42161,
    optimism: 10, opmainnet: 10, base: 8453, avalanche: 43114,
    avalanchecchain: 43114, robinhoodchain: 4663, arc: 5042, zksync: 324, zksyncera: 324,
    hyperevm: 999, hyperliquidl1: 999,
  };
  const direct = aliases[normalized];
  if (direct) return direct;
  return Number(Object.entries(CHAIN_META).find(([, meta]) =>
    meta.name.toLowerCase().replace(/[^a-z0-9]/g, '') === normalized
  )?.[0]) || undefined;
}

/** DEX filter key. Venues that run several generations side by side get one
 * chip per generation ("Uniswap V3", "Uniswap V4"), since they are different
 * products with different pools, ranges and fees. */
export function dexKey(p: EarnPool): string {
  // Pools from before Aero get their own chip, so "Aero" and the old Aerodrome and Velodrome pools never mix.
  if (isOldAero(p)) return `${p.dex} (old)`;
  return p.version && /uniswap|pancakeswap|sushiswap|orvex|swaphood/i.test(p.dex) ? `${p.dex} ${p.version}` : p.dex;
}

/** Marks a pool from before Aero: its gauge stopped paying at Aero's launch. */
export function OldBadge() {
  return (
    <span title="From before Aero. Its gauge stopped paying rewards at Aero's launch on Oct 22, 2026; Aero's new pools are listed as Aero.">
      <Badge size="sm" color={btb.amber} bg="rgba(var(--amber-rgb), 0.14)" border="none" style={{ fontSize: 10, fontWeight: 800, padding: '1px 6px' }}>Old</Badge>
    </span>
  );
}

export const isMetricPool = (pool: EarnPool) => pool.project === 'metric';

/** One pair on one chain, whichever way round its tokens are listed; symbols when a row has no addresses. */
export function pairKey(p: EarnPool): string {
  const tokens = (p.underlyingTokens ?? []).slice(0, 2).map((t) => t.toLowerCase());
  const ids = tokens.length === 2 ? tokens : p.pair.toUpperCase().split(/[-/]/);
  return `${p.chainId ?? p.chain}:${[...ids].sort().join('|')}`;
}

/** Pools grouped by pair, in the order given: the first pool of each pair leads it. */
export function groupByPair(pools: EarnPool[]): EarnPool[][] {
  const at = new Map<string, number>();
  const out: EarnPool[][] = [];
  for (const p of pools) {
    const k = pairKey(p);
    const i = at.get(k);
    if (i == null) { at.set(k, out.length); out.push([p]); } else out[i].push(p);
  }
  return out;
}

export function canSimulatePool(pool: EarnPool): boolean {
  // The simulator models a concentrated range; Metric's oracle priced bins do not have one.
  if (isMetricPool(pool)) return false;
  const chainId = discoverChainId(pool.chain, pool.chainId);
  const pair = pool.underlyingTokens;
  return !!chainId && !!KYBER_CHAINS[chainId] && !!pair?.[0] && !!pair[1]
    && isAddress(pair[0]) && isAddress(pair[1]);
}

export function ChainMark({ name, chainId, size, src }: { name: string; chainId?: number; size: number; src?: string }) {
  if (chainId) return <ChainLogo chainId={chainId} size={size} src={src}/>;
  const nonEvmAsset = {
    solana: '/chains/solana.webp',
    sui: '/chains/sui.webp',
  }[name.toLowerCase()];
  if (nonEvmAsset) {
    return (
      <img
        src={nonEvmAsset}
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, boxShadow: '0 0 0 1px rgba(var(--fg-rgb), .12)' }}
      />
    );
  }
  return (
    <span style={{ width: size, height: size, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(var(--fg-rgb), .1)', boxShadow: '0 0 0 1px rgba(var(--fg-rgb), .12)', flexShrink: 0 }}>
      <Icon name="globe" size={Math.max(10, size - 7)} color={btb.textMuted}/>
    </span>
  );
}

export function ChainBadge({ name, chainId, logo }: DiscoverChain) {
  return (
    <span
      title={name}
      aria-label={name}
      style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}
    >
      <ChainMark name={name} chainId={chainId} size={17} src={logo}/>
    </span>
  );
}


export const splitPair = (p: EarnPool) => p.pair.split('-') as [string, string];

/** Whether the list has a real APR / fee figure for this pool (DexScreener rows without a fee tier do not). */
export const hasFeeData = (p: EarnPool) => !(p.source === 'dexscreener' && p.feeTier == null);

/** DEX, chain, fee tier and the small badges under a pool's name. */
function PoolTags({ p, mine }: { p: EarnPool; mine: string[] }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2, flexWrap: 'wrap' }}>
      <span title={[p.dex, p.liquidityModel === 'CLMM' ? 'Concentrated liquidity' : p.version, p.poolMeta].filter(Boolean).join(' · ')} aria-label={`${p.dex}${p.version ? ` ${p.version}` : ''}`}>
        <Badge size="sm" bg={btb.surfaceSoft} color={btb.textMuted} border="none" style={{ fontSize: 10, padding: p.version || p.liquidityModel === 'CLMM' ? '1px 6px' : 2 }}>
          <DexLogo name={p.dex} size={13} src={p.dexLogo}/>
          {p.version ?? (p.liquidityModel === 'CLMM' ? 'CL' : '')}
        </Badge>
      </span>
      <ChainBadge name={p.chain} chainId={discoverChainId(p.chain, p.chainId)}/>
      {isOldAero(p) && <OldBadge/>}
      {p.feeTier != null && <span style={{ color: btb.textDim, fontSize: 11 }}>{fmtFeeTier(p.feeTier)}</span>}
      {p.stablecoin && <Badge size="sm" color={btb.green} bg="rgba(var(--green-rgb), 0.14)" border="none" style={{ fontSize: 10, padding: '1px 6px' }}>Stable</Badge>}
      {mine.length > 0 && (
        <Badge size="sm" color={btb.green} bg="rgba(var(--green-rgb), 0.14)" border="1px solid rgba(var(--green-rgb), 0.38)" style={{ fontSize: 10, fontWeight: 800, padding: '1px 6px' }}>
          {mine.length === 2 ? 'You hold both' : `You hold ${mine.join(' and ')}`}
        </Badge>
      )}
    </div>
  );
}

/** The table's Pool cell: token pair, name and tags. */
export function PoolNameCell({ p, mine = [], logos = [] }: { p: EarnPool; mine?: string[]; logos?: (string | undefined)[] }) {
  const [s0, s1] = splitPair(p);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ display: 'flex' }}>
        <TokenIcon symbol={s0} size={26} logoUrl={logos[0]} />
        <div style={{ marginLeft: -8 }}><TokenIcon symbol={s1} size={26} logoUrl={logos[1]} /></div>
      </div>
      <div>
        <div style={{ fontWeight: 700 }}>{p.pair.replace('-', '/')}</div>
        <PoolTags p={p} mine={mine}/>
      </div>
    </div>
  );
}

/** The table's 24h cell: APY change when the source has it, else the price change. */
export function ChangeCell({ p, priceChange }: { p: EarnPool; priceChange?: number }) {
  const pct = p.apyChange1d ?? priceChange;
  if (pct == null) return <span style={{ color: btb.textDim }}>—</span>;
  const title = p.apyChange1d != null ? 'APY change (24h, pts)' : 'Price change (24h)';
  return <span title={title} style={{ color: pct >= 0 ? btb.green : btb.loss, fontWeight: 600 }}>{pct >= 0 ? '+' : ''}{pct.toFixed(2)}%</span>;
}

/** The table's APR cell, with how it was measured and any Merkl campaign under it. */
export function AprCell({ p }: { p: EarnPool }) {
  if (!hasFeeData(p)) return <span title="Fee tier data is not available from this source" style={{ color: btb.textDim }}>—</span>;
  const ctx = aprContext(p);
  return (
    <div title={ctx?.title ?? rangeAprTitle(p)}>
      <div style={{ color: btb.green, fontWeight: 700, textDecoration: 'underline dotted', textUnderlineOffset: 3 }}>
        {fmtApr(headlineApr(p))}
      </div>
      {ctx && <div style={{ color: btb.textDim, fontSize: 9.5, fontWeight: 650, marginTop: 2 }}>{ctx.label}</div>}
      {!ctx && rangeAprTag(p) && <div style={{ color: btb.textDim, fontSize: 9.5, fontWeight: 650, marginTop: 2, whiteSpace: 'nowrap' }}>{rangeAprTag(p)}</div>}
      {p.merkl && p.merkl.apr > 0 && (
        <div title={`Merkl reward campaign paying ${p.merkl.rewardSymbols.join(', ') || 'rewards'} to LPs in this pool, on top of fees. Claim from Portfolio.`} style={{ display: 'inline-block', color: btb.reward, background: 'rgba(var(--reward-rgb, 196, 181, 253), 0.14)', borderRadius: 6, padding: '1px 6px', fontSize: 10, fontWeight: 800, marginTop: 3, whiteSpace: 'nowrap' }}>
          +{fmtApr(p.merkl.apr)} {p.merkl.rewardSymbols[0] ?? 'rewards'}
        </div>
      )}
    </div>
  );
}

/** The table's Fees (24h) cell; "≈" when estimated from the APR. */
export function FeesCell({ p }: { p: EarnPool }) {
  if (!hasFeeData(p)) return <span style={{ color: btb.textDim }}>n/a</span>;
  const est = p.fees24hUsd == null;
  return <span title={est ? 'Estimated from pool APR' : undefined}>{est && '≈ '}{fmtCompactUsd(estFees24h(p))}</span>;
}

/** Fees over TVL for the day, as a percent string. */
export function feesToTvlText(p: EarnPool): string {
  return hasFeeData(p) && p.tvlUsd > 0 ? `${((estFees24h(p) / p.tvlUsd) * 100).toFixed(3)}%` : '—';
}

/** The phone card for one pool. `actions` is its button row; `onClick` opens the pool (absent in the server preview). */
export function PoolCard({ p, priceChange, mine = [], logos = [], actions, onClick }: {
  p: EarnPool; priceChange?: number; mine?: string[]; logos?: (string | undefined)[]; actions: ReactNode; onClick?: () => void;
}) {
  const [s0, s1] = splitPair(p);
  const pct = p.apyChange1d ?? priceChange;
  const fee = hasFeeData(p);
  return (
    <Glass padding={14} radius={18} onClick={onClick}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'flex', flexShrink: 0 }}>
          <TokenIcon symbol={s0} size={26} logoUrl={logos[0]} />
          <div style={{ marginLeft: -8 }}><TokenIcon symbol={s1} size={26} logoUrl={logos[1]} /></div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, color: btb.text, fontSize: 14 }}>{p.pair.replace('-', '/')}</div>
          <PoolTags p={p} mine={mine}/>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ color: fee ? btb.green : btb.textDim, fontSize: 15, fontWeight: 800 }}>{fee ? fmtApr(headlineApr(p)) : '—'}</div>
          {p.merkl && p.merkl.apr > 0 && <div style={{ display: 'inline-block', color: btb.reward, background: 'rgba(var(--reward-rgb, 196, 181, 253), 0.14)', borderRadius: 6, padding: '1px 6px', fontSize: 10, fontWeight: 800 }}>+{fmtApr(p.merkl.apr)} {p.merkl.rewardSymbols[0] ?? 'rewards'}</div>}
          <div title={aprContext(p)?.title} style={{ color: btb.textDim, fontSize: 10.5 }}>{aprContext(p)?.label ?? 'APR'}</div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 10 }}>
        <div>
          <div style={{ color: btb.textDim, fontSize: 10.5 }}>TVL</div>
          <div style={{ color: btb.text, fontSize: 12.5, fontWeight: 600 }}>{fmtCompactUsd(p.tvlUsd)}</div>
        </div>
        <div>
          <div style={{ color: btb.textDim, fontSize: 10.5 }}>24h</div>
          <div style={{ color: pct == null ? btb.textDim : pct >= 0 ? btb.green : btb.loss, fontSize: 12.5, fontWeight: 600 }}>
            {pct == null ? '—' : `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`}
          </div>
        </div>
        <div>
          <div style={{ color: btb.textDim, fontSize: 10.5 }}>Fees (24h)</div>
          <div style={{ color: fee ? btb.text : btb.textDim, fontSize: 12.5, fontWeight: 600 }}>{fee ? <>{p.fees24hUsd == null && '≈ '}{fmtCompactUsd(estFees24h(p))}</> : 'n/a'}</div>
        </div>
      </div>

      {actions}
    </Glass>
  );
}

/** The "N more pools for this pair" toggle under a phone card. */
export function MorePoolsToggle({ more, open, onClick }: { more: number; open: boolean; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick}
      style={{ alignSelf: 'flex-start', marginLeft: 12, height: 28, padding: '0 12px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11.5, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 5,
        border: open ? '1px solid rgba(var(--green-rgb), 0.45)' : '1px solid rgba(var(--fg-rgb), 0.12)',
        background: open ? 'rgba(var(--green-rgb), 0.15)' : 'rgba(var(--fg-rgb), 0.05)', color: open ? btb.text : btb.textMuted }}>
      {open ? 'Hide other pools' : `${more} more pool${more === 1 ? '' : 's'} for this pair`}
      <Icon name={open ? 'up' : 'down'} size={10} color={btb.textMuted}/>
    </button>
  );
}

/** The search box's look; the screen passes its live input, the preview a placeholder. */
export function SearchBox({ mobile, children }: { mobile?: boolean; children: ReactNode }) {
  return (
    <div style={{
      flex: 1, minWidth: mobile ? '100%' : 220, display: 'flex', alignItems: 'center', gap: 8,
      padding: '0 14px', height: 42, borderRadius: 12,
      background: btb.surfaceSoft, border: btb.borderSoft,
    }}>
      <Icon name="search" size={15} color={btb.textMuted} />
      {children}
    </div>
  );
}

export const SEARCH_PLACEHOLDER = 'Search a token or pair: eth, eth/usdc, ethusdc';
export const SEARCH_INPUT_STYLE: CSSProperties = { flex: 1, background: 'transparent', border: 'none', outline: 'none', color: btb.text, fontSize: 13.5, fontFamily: 'inherit' };
