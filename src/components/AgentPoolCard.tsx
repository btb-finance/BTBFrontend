'use client';
import { useState } from 'react';
import { btb } from './design-tokens';
import { ChainLogo } from './ChainLogo';
import { DexLogo } from './DexLogo';
import type { EarnPool } from '../lib/pools';

const usd = (n: number) => n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `$${Math.round(n / 1e3)}K` : `$${Math.round(n)}`;
const pct = (n: number) => `${n >= 100 ? Math.round(n).toLocaleString('en-US') : n.toFixed(1)}%`;

function TokenMark({ src, symbol, size, offset }: { src?: string | null; symbol: string; size: number; offset: boolean }) {
  const [failed, setFailed] = useState(false);
  const style: React.CSSProperties = { width: size, height: size, borderRadius: 999, flexShrink: 0, marginLeft: offset ? -8 : 0, border: '2px solid rgba(var(--bg-rgb), 1)', background: 'rgba(var(--fg-rgb), 0.1)' };
  // eslint-disable-next-line @next/next/no-img-element
  if (src && !failed) return <img src={src} alt={symbol} width={size} height={size} onError={() => setFailed(true)} style={{ ...style, objectFit: 'cover' }}/>;
  return <span style={{ ...style, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: btb.textMuted, fontSize: size * 0.38, fontWeight: 800 }}>{symbol.slice(0, 1)}</span>;
}

/**
 * A pool the agent recommended, drawn from the same catalog Discover uses: pair, chain and DEX, the headline APR with
 * where it comes from, TVL and volume, and the one action the agent picked (Add LP, or Simulate where the app cannot
 * mint yet). Nothing is fetched for it; the catalog is already loaded.
 */
export function AgentPoolCard({ pool, action, href }: { pool: EarnPool; action: string; href: string }) {
  const symbols = pool.pair.split(/[-/]/).map((s) => s.trim()).filter(Boolean);
  const fee = pool.feeTier == null ? null : pool.feeTier & 0x800000 ? 'dynamic' : `${pool.feeTier / 10000}%`;
  const merkl = pool.merkl?.apr ?? 0;
  const total = pool.apy + merkl;
  const parts = [
    `fees ${pct(pool.apyBase ?? 0)}`,
    pool.apyReward > 0 ? `${pool.rewardTokenSymbols?.join('/') || 'rewards'} ${pct(pool.apyReward)}` : '',
    merkl > 0 ? `${pool.merkl!.rewardSymbols.join('/')} ${pct(merkl)}` : '',
  ].filter(Boolean);
  const inApp = /(^|\.)btb\.finance$/i.test((() => { try { return new URL(href).hostname; } catch { return ''; } })());
  const target = inApp && typeof window !== 'undefined' && window.location.hostname === 'localhost' ? href.replace(/^https?:\/\/(www\.)?btb\.finance/, '') : href;

  return (
    <div style={{ margin: '8px 0', padding: '12px 14px', borderRadius: 16, background: 'rgba(var(--fg-rgb), 0.045)', border: '1px solid rgba(var(--fg-rgb), 0.08)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'flex', flexShrink: 0 }}>
          {symbols.slice(0, 2).map((s, i) => <TokenMark key={s + i} symbol={s} src={pool.tokenLogos?.[i]} size={30} offset={i > 0}/>)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ color: btb.text, fontSize: 14.5, fontWeight: 800 }}>{symbols.join(' / ')}</span>
            {fee && <span style={{ color: btb.textMuted, fontSize: 11, fontWeight: 700, padding: '1px 6px', borderRadius: 6, background: 'rgba(var(--fg-rgb), 0.07)' }}>{fee}</span>}
            {pool.stablecoin && <span style={{ color: btb.green, fontSize: 11, fontWeight: 700, padding: '1px 6px', borderRadius: 6, background: 'rgba(var(--green-rgb), 0.12)' }}>Stable</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3, color: btb.textMuted, fontSize: 11.5 }}>
            {pool.chainId != null && <ChainLogo chainId={pool.chainId} size={14} src={pool.chainLogo}/>}
            <span>{pool.chain}</span>
            <span style={{ color: btb.textDim }}>·</span>
            <DexLogo name={pool.dex} size={14} src={pool.dexLogo}/>
            <span>{pool.dex}{pool.version ? ` ${pool.version}` : ''}</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 1fr', gap: 8, marginTop: 12 }}>
        <div>
          <div style={{ color: btb.textDim, fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3 }}>APR</div>
          <div style={{ color: btb.green, fontSize: 18, fontWeight: 800, letterSpacing: -0.3 }}>{pct(total)}</div>
        </div>
        <div>
          <div style={{ color: btb.textDim, fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3 }}>TVL</div>
          <div style={{ color: btb.text, fontSize: 15, fontWeight: 800, marginTop: 2 }}>{usd(pool.tvlUsd)}</div>
        </div>
        <div>
          <div style={{ color: btb.textDim, fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3 }}>24h volume</div>
          <div style={{ color: btb.text, fontSize: 15, fontWeight: 800, marginTop: 2 }}>{pool.volume24hUsd != null ? usd(pool.volume24hUsd) : 'n/a'}</div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
        <span style={{ color: btb.textDim, fontSize: 11 }}>{parts.join(' · ')}</span>
        <a href={target} target={inApp ? undefined : '_blank'} rel={inApp ? undefined : 'noopener noreferrer'} style={{ height: 32, padding: '0 14px', borderRadius: 10, display: 'inline-flex', alignItems: 'center', textDecoration: 'none', fontSize: 12.5, fontWeight: 800, ...(action === 'Add LP' ? { background: btb.green, color: '#000' } : { background: 'transparent', color: btb.green, border: '1px solid rgba(var(--green-rgb), 0.4)' }) }}>
          {action}
        </a>
      </div>
    </div>
  );
}
