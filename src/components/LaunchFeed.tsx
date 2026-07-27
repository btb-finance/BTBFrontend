'use client';

import { useMemo, useState } from 'react';
import { TokenIcon } from './TokenIcon';
import { Spinner } from './Spinner';
import { btb } from './design-tokens';
import { newPoolToMarket, usePoolSafety, useNewPools, type NewPool, type PoolSafety } from '../lib/newPools';
import type { MarketToken } from '../lib/marketFeed';
import { useSidebar } from '../lib/SidebarContext';

/**
 * Tokens seconds after they exist, read off the Uniswap V3 factory.
 *
 * A raw firehose is not usable — this chain mints roughly a pool a second and
 * most of them never get liquidity. So the feed leads with the facts that
 * decide whether a launch is worth touching at all: whether the LP is locked,
 * whether the position can actually be sold back, and how much the deployer
 * bought for themselves. The default filter hides the dead ones; nothing is
 * hidden that the user cannot unhide.
 */

const MIN_LIQUIDITY_OPTIONS = [
  { label: 'Any liquidity', value: 0 },
  { label: '$25+', value: 25 },
  { label: '$250+', value: 250 },
  { label: '$1k+', value: 1_000 },
] as const;

function usd(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '$0';
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}m`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}k`;
  return `$${value.toFixed(value >= 10 ? 0 : 2)}`;
}

function price(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '—';
  if (value >= 0.01) return `$${value.toFixed(4)}`;
  const decimals = Math.min(12, Math.max(6, Math.ceil(-Math.log10(value)) + 3));
  return `$${value.toFixed(decimals)}`;
}

function seconds(value: number | null) {
  if (value == null) return '—';
  if (value < 60) return `${value}s`;
  if (value < 3_600) return `${Math.floor(value / 60)}m`;
  return `${Math.floor(value / 3_600)}h`;
}

function Chip({ tone, title, children }: { tone: 'good' | 'bad' | 'warn' | 'mute'; title?: string; children: React.ReactNode }) {
  const colors = {
    good: { color: btb.green, background: 'rgba(82,227,164,.1)', border: '1px solid rgba(82,227,164,.28)' },
    bad: { color: btb.loss, background: 'rgba(255,107,122,.1)', border: '1px solid rgba(255,107,122,.3)' },
    warn: { color: '#ffca6b', background: 'rgba(255,202,107,.1)', border: '1px solid rgba(255,202,107,.28)' },
    mute: { color: btb.textDim, background: 'rgba(255,255,255,.035)', border: btb.borderSoft },
  }[tone];
  return <span title={title} style={{ ...colors, borderRadius: 6, padding: '2px 6px', fontSize: 8.5, fontWeight: 850, whiteSpace: 'nowrap', letterSpacing: .2 }}>{children}</span>;
}

/** The one-glance verdict for a row, and the reason behind it. */
function safetyChip(pool: NewPool, safety: PoolSafety | undefined) {
  if (pool.lpLocked === false) return <Chip tone="bad" title="No launchpad lock — whoever holds the liquidity can withdraw it at any time">LP UNLOCKED</Chip>;
  if (safety?.status === 'honeypot') return <Chip tone="bad" title="A simulated sell of this token reverts — you would not be able to exit">CANNOT SELL</Chip>;
  if (safety?.status === 'sellable' && safety.taxBps != null && safety.taxBps >= 300) {
    return <Chip tone="warn" title={`A round trip loses ${(safety.taxBps / 100).toFixed(1)}% more than the pool fee explains`}>TAX ~{(safety.taxBps / 100).toFixed(1)}%</Chip>;
  }
  if (safety?.status === 'sellable') return <Chip tone="good" title="A simulated buy and immediate sell both succeed at this size">SELLABLE</Chip>;
  if (!pool.resolved) return <Chip tone="mute" title="Created moments ago — the node has not caught up yet">CONFIRMING</Chip>;
  if (pool.wethLiquidity === 0) return <Chip tone="mute" title="Nothing has been paired against this pool yet">NO LIQUIDITY</Chip>;
  return <Chip tone="mute" title="The sell simulation has not completed for this row">CHECKING…</Chip>;
}

export function LaunchFeed({ active, onTrade }: { active: boolean; onTrade: (market: MarketToken, side: 'buy' | 'sell') => void }) {
  const { isMobile } = useSidebar();
  const { pools, loading, error, updatedAt } = useNewPools(active);
  const [minLiquidity, setMinLiquidity] = useState<number>(25);
  const [lockedOnly, setLockedOnly] = useState(true);
  const [sellableOnly, setSellableOnly] = useState(false);
  const [query, setQuery] = useState('');

  // One row per token — a launch often opens several fee tiers, and the one
  // holding the most WETH is the one a buy should route through.
  const deduped = useMemo(() => {
    const best = new Map<string, NewPool>();
    for (const pool of pools) {
      const key = pool.token.toLowerCase();
      const current = best.get(key);
      if (!current || pool.wethLiquidity > current.wethLiquidity) best.set(key, pool);
    }
    return [...best.values()].sort((a, b) => b.block - a.block);
  }, [pools]);

  const liquidEnough = useMemo(
    () => deduped.filter(pool => pool.liquidityUsd >= minLiquidity && (!lockedOnly || pool.lpLocked !== false)),
    [deduped, lockedOnly, minLiquidity],
  );
  const { byToken, checking } = usePoolSafety(liquidEnough);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return liquidEnough.filter(pool => {
      if (needle && !pool.symbol.toLowerCase().includes(needle) && !pool.name.toLowerCase().includes(needle) && !pool.token.toLowerCase().includes(needle)) return false;
      if (sellableOnly && byToken.get(pool.token.toLowerCase())?.status !== 'sellable') return false;
      return true;
    });
  }, [byToken, liquidEnough, query, sellableOnly]);

  const hidden = deduped.length - rows.length;

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginTop: 11 }}>
        <select value={minLiquidity} onChange={event => setMinLiquidity(Number(event.target.value))} style={{ height: 32, borderRadius: 9, border: btb.borderSoft, background: 'rgba(255,255,255,.035)', color: btb.text, padding: '0 8px', fontFamily: 'inherit', fontSize: 10.5, fontWeight: 700, outline: 'none' }}>
          {MIN_LIQUIDITY_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        {([
          ['LP locked only', lockedOnly, () => setLockedOnly(value => !value), 'Hide pools whose liquidity is not held by the launchpad locker'],
          ['Sellable only', sellableOnly, () => setSellableOnly(value => !value), 'Hide anything whose simulated sell has not succeeded'],
        ] as const).map(([label, on, toggle, title]) => (
          <button key={label} onClick={toggle} title={title} style={{ height: 32, padding: '0 11px', borderRadius: 9, border: on ? '1px solid rgba(82,227,164,.36)' : btb.borderSoft, background: on ? 'rgba(82,227,164,.1)' : 'rgba(255,255,255,.025)', color: on ? btb.green : btb.textMuted, fontFamily: 'inherit', fontSize: 10, fontWeight: 800, cursor: 'pointer' }}>{on ? '✓ ' : ''}{label}</button>
        ))}
        <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Filter by name or contract" spellCheck={false} style={{ marginLeft: isMobile ? 0 : 'auto', flex: isMobile ? '1 0 100%' : '0 1 240px', height: 32, boxSizing: 'border-box', borderRadius: 9, border: btb.borderSoft, background: 'rgba(255,255,255,.035)', color: btb.text, padding: '0 10px', outline: 'none', fontSize: 10.5 }}/>
      </div>

      <div style={{ marginTop: 10, border: btb.borderSoft, borderRadius: 14, overflow: 'hidden', background: 'rgba(0,0,0,.08)' }}>
        {!isMobile && <div style={{ display: 'grid', gridTemplateColumns: 'minmax(170px,1.5fr) .8fr .9fr .7fr .6fr 96px', gap: 10, alignItems: 'center', minHeight: 34, padding: '0 12px', color: btb.textDim, fontSize: 8.5, fontWeight: 850, textTransform: 'uppercase', letterSpacing: .5, borderBottom: btb.borderSoft }}>
          <span>Token</span><span style={{ textAlign: 'right' }}>Price</span><span style={{ textAlign: 'right' }}>Sellable liquidity</span><span style={{ textAlign: 'right' }}>Dev buy</span><span style={{ textAlign: 'right' }}>Age</span><span/>
        </div>}

        {loading ? <div style={{ minHeight: 170, display: 'grid', placeItems: 'center' }}><Spinner size={22}/></div>
          : error ? <div style={{ minHeight: 140, display: 'grid', placeItems: 'center', padding: 20, color: btb.loss, fontSize: 11, textAlign: 'center' }}>{error}</div>
          : rows.length === 0 ? <div style={{ minHeight: 140, display: 'grid', placeItems: 'center', padding: 20, color: btb.textMuted, fontSize: 11, textAlign: 'center' }}>
              {deduped.length === 0 ? 'No pool has been created in the last few minutes.' : `Every one of the last ${deduped.length} launches was filtered out. Loosen the filters to see them.`}
            </div>
          : rows.map((pool, index) => {
            const safety = byToken.get(pool.token.toLowerCase());
            const market = newPoolToMarket(pool);
            const border = index < rows.length - 1 ? btb.borderSoft : undefined;
            const identity = (
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                <TokenIcon symbol={pool.symbol} logoUrl="" size={30}/>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ color: btb.text, fontSize: 11.5, fontWeight: 850, overflow: 'hidden', textOverflow: 'ellipsis' }}>{pool.symbol}</span>
                    {safetyChip(pool, safety)}
                    {pool.lpLocked === true && <Chip tone="good" title="The LP position NFT is held by the launchpad locker right now">LP LOCKED</Chip>}
                  </div>
                  <a href={`https://robinhoodchain.blockscout.com/token/${pool.token}`} target="_blank" rel="noopener noreferrer" style={{ color: btb.textDim, fontSize: 8.5, textDecoration: 'none' }}>{pool.token.slice(0, 6)}…{pool.token.slice(-4)} ↗</a>
                </div>
              </div>
            );
            const actions = (
              <button onClick={() => onTrade(market, 'buy')} disabled={pool.wethLiquidity === 0} style={{ height: 28, padding: '0 12px', borderRadius: 8, border: '1px solid rgba(82,227,164,.34)', background: 'rgba(82,227,164,.12)', color: btb.green, fontFamily: 'inherit', fontSize: 10, fontWeight: 850, cursor: pool.wethLiquidity === 0 ? 'default' : 'pointer', opacity: pool.wethLiquidity === 0 ? .5 : 1 }}>Buy</button>
            );

            return isMobile ? (
              <div key={pool.token} style={{ padding: '11px 10px', borderBottom: border }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  {identity}
                  <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                    <div style={{ color: btb.text, fontSize: 11, fontWeight: 800 }}>{price(pool.priceUsd)}</div>
                    <div style={{ color: btb.textDim, fontSize: 9, marginTop: 2 }}>{seconds(pool.ageSeconds)} old</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginTop: 9 }}>
                  <div><div style={{ color: btb.textDim, fontSize: 8 }}>SELLABLE LIQ.</div><div style={{ color: btb.textMuted, fontSize: 10, marginTop: 2 }}>{usd(pool.liquidityUsd)}</div></div>
                  <div><div style={{ color: btb.textDim, fontSize: 8 }}>DEV BUY</div><div style={{ color: btb.textMuted, fontSize: 10, marginTop: 2 }}>{usd(pool.devBuyUsd)}</div></div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-end' }}>{actions}</div>
                </div>
              </div>
            ) : (
              <div key={pool.token} style={{ display: 'grid', gridTemplateColumns: 'minmax(170px,1.5fr) .8fr .9fr .7fr .6fr 96px', gap: 10, alignItems: 'center', minHeight: 58, padding: '0 12px', borderBottom: border }}>
                {identity}
                <span style={{ color: btb.text, fontSize: 10.5, fontWeight: 750, textAlign: 'right' }}>{price(pool.priceUsd)}</span>
                <span style={{ color: btb.textMuted, fontSize: 10, textAlign: 'right' }}>{usd(pool.liquidityUsd)}</span>
                <span style={{ color: pool.devBuyUsd > pool.liquidityUsd ? '#ffca6b' : btb.textMuted, fontSize: 10, textAlign: 'right' }} title={pool.devBuyUsd > pool.liquidityUsd ? 'The deployer bought more than is left in the pool' : undefined}>{usd(pool.devBuyUsd)}</span>
                <span style={{ color: btb.textMuted, fontSize: 10, textAlign: 'right' }}>{seconds(pool.ageSeconds)}</span>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>{actions}</div>
              </div>
            );
          })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginTop: 9, color: btb.textDim, fontSize: 8.5, lineHeight: 1.5 }}>
        <span style={{ maxWidth: 620 }}>
          Read from the Uniswap V3 factory as each pool is created, priced from the pool itself. &ldquo;Sellable liquidity&rdquo; is the WETH side only — what you could actually sell back into.
          Sellable and tax come from simulating a buy and an immediate sell; they catch a pool you cannot exit, not a token that blocks specific buyers later. Most of these go to zero.
        </span>
        <span style={{ color: btb.textMuted }}>
          {hidden > 0 ? `${hidden} filtered out · ` : ''}{checking ? 'checking sells…' : updatedAt ? `updated ${Math.max(0, Math.round((Date.now() - updatedAt) / 1000))}s ago` : ''}
        </span>
      </div>
    </div>
  );
}
