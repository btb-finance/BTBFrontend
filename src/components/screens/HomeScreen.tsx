'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { isAddress } from 'viem';
import { Badge } from '../Badge';
import { Glass } from '../Glass';
import { Spinner } from '../Spinner';
import { SmartTradePanel, type TradePreset } from '../SmartTradePanel';
import { TokenIcon } from '../TokenIcon';
import { btb } from '../design-tokens';
import { type Tab } from '../types';
import { useSidebar } from '../../lib/SidebarContext';
import { fetchMarketFeed, type MarketToken } from '../../lib/marketFeed';

type MarketView = 'trending' | 'new' | 'top' | 'all';

function usd(value: number, compact = true) {
  if (!Number.isFinite(value) || value <= 0) return '—';
  if (compact && value >= 1_000) return `$${new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(value)}`;
  if (value >= 1) return `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  if (value >= .0001) return `$${value.toLocaleString('en-US', { maximumSignificantDigits: 5 })}`;
  return `$${value.toExponential(3)}`;
}

function age(createdAt: number | null) {
  if (!createdAt) return '—';
  const seconds = Math.max(0, Math.floor((Date.now() - createdAt) / 1000));
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3_600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3_600)}h`;
  if (seconds < 2_592_000) return `${Math.floor(seconds / 86_400)}d`;
  return `${Math.floor(seconds / 2_592_000)}mo`;
}

function change(value: number | null) {
  if (value == null || !Number.isFinite(value)) return <span style={{ color: btb.textDim }}>—</span>;
  return <span style={{ color: value >= 0 ? btb.green : btb.loss, fontWeight: 750 }}>{value >= 0 ? '+' : ''}{value.toFixed(2)}%</span>;
}

const marketButton = (tone: 'buy' | 'sell') => ({
  height: 31,
  minWidth: 54,
  padding: '0 11px',
  borderRadius: 9,
  border: tone === 'buy' ? '1px solid rgba(82,227,164,.32)' : btb.borderSoft,
  background: tone === 'buy' ? 'rgba(82,227,164,.1)' : 'rgba(255,255,255,.035)',
  color: tone === 'buy' ? btb.green : btb.textMuted,
  fontFamily: 'inherit',
  fontSize: 10.5,
  fontWeight: 800,
  cursor: 'pointer',
} as const);

export function HomeScreen({ address, onConnectWallet }: {
  goto: (t: Tab) => void;
  address?: string;
  onDisconnect?: () => void;
  onReceive?: () => void;
  onSend?: () => void;
  onDocs?: () => void;
  onEarn?: () => void;
  onConnectWallet?: () => void;
}) {
  const { isMobile } = useSidebar();
  const [markets, setMarkets] = useState<MarketToken[]>([]);
  const [view, setView] = useState<MarketView>('trending');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visible, setVisible] = useState(30);
  const [presets, setPresets] = useState<TradePreset[]>([]);

  const load = useCallback(async (background = false) => {
    background ? setRefreshing(true) : setLoading(true);
    setError(null);
    try { setMarkets(await fetchMarketFeed()); }
    catch { setError('Live markets could not be loaded. Try again in a moment.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(true), 45_000);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => { setVisible(30); }, [query, view]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const rows = needle ? markets.filter(market =>
      market.symbol.toLowerCase().includes(needle)
      || market.name.toLowerCase().includes(needle)
      || market.address.toLowerCase().includes(needle)
    ) : [...markets];
    if (view === 'new') rows.sort((a, b) => (b.pairCreatedAt ?? 0) - (a.pairCreatedAt ?? 0));
    else if (view === 'top') rows.sort((a, b) => b.volume24h - a.volume24h);
    else if (view === 'all') rows.sort((a, b) => b.liquidityUsd - a.liquidityUsd);
    else rows.sort((a, b) => b.trendingScore - a.trendingScore);
    return rows;
  }, [markets, query, view]);

  const totals = useMemo(() => ({
    volume: markets.reduce((sum, market) => sum + market.volume24h, 0),
    liquidity: markets.reduce((sum, market) => sum + market.liquidityUsd, 0),
    newToday: markets.filter(market => market.pairCreatedAt && Date.now() - market.pairCreatedAt < 86_400_000).length,
  }), [markets]);

  function selectTrade(market: MarketToken, side: 'buy' | 'sell') {
    if (!isAddress(market.address)) return;
    setPresets(current => [...current, { id: crypto.randomUUID(), side, address: market.address as `0x${string}`, symbol: market.symbol, imageUrl: market.imageUrl }].slice(-100));
  }

  return <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 13 : 18 }}>
    <div id="smart-trade-panel" style={{ scrollMarginTop: 16 }}>
      <SmartTradePanel owner={address} onConnect={onConnectWallet} presets={presets}/>
    </div>

    <Glass padding={isMobile ? 13 : 17} radius={18} strong>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: btb.text, fontSize: isMobile ? 17 : 20, fontWeight: 900, letterSpacing: -.4 }}>Robinhood markets</span>
            <Badge size="sm" border="none" bg="rgba(82,227,164,.1)" color={btb.green}>LIVE</Badge>
          </div>
          <div style={{ color: btb.textMuted, fontSize: 10.5, marginTop: 4 }}>Discover a token, then buy or sell from your guarded smart account.</div>
        </div>
        <button onClick={() => void load(true)} disabled={refreshing} style={{ height: 32, padding: '0 11px', borderRadius: 9, border: btb.borderSoft, background: 'rgba(255,255,255,.035)', color: btb.textMuted, fontFamily: 'inherit', fontSize: 10.5, fontWeight: 750, cursor: refreshing ? 'default' : 'pointer' }}>{refreshing ? 'Updating…' : 'Refresh'}</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(3,1fr)' : 'repeat(3,minmax(130px,1fr))', gap: 7, marginTop: 13 }}>
        {[
          ['24h volume', usd(totals.volume)],
          ['Liquidity', usd(totals.liquidity)],
          ['New today', totals.newToday.toLocaleString('en-US')],
        ].map(([label, value]) => <div key={label} style={{ padding: isMobile ? '9px 8px' : '10px 11px', borderRadius: 11, background: 'rgba(255,255,255,.027)', border: btb.borderSoft }}>
          <div style={{ color: btb.textDim, fontSize: 8.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .45 }}>{label}</div>
          <div style={{ color: btb.text, fontSize: isMobile ? 12 : 14, fontWeight: 850, marginTop: 4 }}>{value}</div>
        </div>)}
      </div>

      <div style={{ display: 'flex', gap: 7, alignItems: 'center', marginTop: 13, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
        <div style={{ display: 'flex', gap: 5, overflowX: 'auto', maxWidth: '100%' }}>
          {(['trending', 'new', 'top', 'all'] as const).map(option => <button key={option} onClick={() => setView(option)} style={{ height: 34, padding: '0 12px', whiteSpace: 'nowrap', borderRadius: 10, border: view === option ? '1px solid rgba(82,227,164,.36)' : btb.borderSoft, background: view === option ? 'rgba(82,227,164,.1)' : 'rgba(255,255,255,.025)', color: view === option ? btb.green : btb.textMuted, fontFamily: 'inherit', fontSize: 10.5, fontWeight: 800, textTransform: 'capitalize', cursor: 'pointer' }}>{option === 'top' ? 'Top volume' : option}</button>)}
        </div>
        <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search name, symbol or contract" spellCheck={false} style={{ marginLeft: isMobile ? 0 : 'auto', flex: isMobile ? '1 0 100%' : '0 1 310px', width: isMobile ? '100%' : 310, height: 34, boxSizing: 'border-box', borderRadius: 10, border: btb.borderSoft, background: 'rgba(255,255,255,.035)', color: btb.text, padding: '0 11px', outline: 'none', fontSize: 11 }}/>
      </div>

      <div style={{ marginTop: 11, border: btb.borderSoft, borderRadius: 14, overflow: 'hidden', background: 'rgba(0,0,0,.08)' }}>
        {!isMobile && <div style={{ display: 'grid', gridTemplateColumns: 'minmax(190px,1.65fr) .75fr .58fr .72fr .72fr .58fr 126px', gap: 10, alignItems: 'center', minHeight: 34, padding: '0 12px', color: btb.textDim, fontSize: 8.5, fontWeight: 850, textTransform: 'uppercase', letterSpacing: .5, borderBottom: btb.borderSoft }}>
          <span>Token / market</span><span style={{ textAlign: 'right' }}>Price</span><span style={{ textAlign: 'right' }}>24h</span><span style={{ textAlign: 'right' }}>Volume</span><span style={{ textAlign: 'right' }}>Liquidity</span><span style={{ textAlign: 'right' }}>Age</span><span/>
        </div>}

        {loading ? <div style={{ minHeight: 180, display: 'grid', placeItems: 'center' }}><Spinner size={22}/></div>
          : error ? <div style={{ minHeight: 150, display: 'grid', placeItems: 'center', padding: 20, color: btb.loss, fontSize: 11, textAlign: 'center' }}>{error}</div>
          : filtered.length === 0 ? <div style={{ minHeight: 150, display: 'grid', placeItems: 'center', padding: 20, color: btb.textMuted, fontSize: 11 }}>No matching live market.</div>
          : filtered.slice(0, visible).map((market, index) => isMobile ? (
            <div key={market.address} style={{ padding: '12px 10px', borderBottom: index < Math.min(visible, filtered.length) - 1 ? btb.borderSoft : undefined }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <TokenIcon symbol={market.symbol} logoUrl={market.imageUrl} size={31}/>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ color: btb.text, fontSize: 12, fontWeight: 850, overflow: 'hidden', textOverflow: 'ellipsis' }}>{market.symbol}</span><span style={{ color: btb.textDim, fontSize: 9 }}>{market.dex}{market.version ? ` ${market.version}` : ''}</span></div>
                  <a href={`https://robinhoodchain.blockscout.com/token/${market.address}`} target="_blank" rel="noopener noreferrer" style={{ color: btb.textDim, fontSize: 8.5, textDecoration: 'none' }}>{market.address.slice(0, 6)}…{market.address.slice(-4)} ↗</a>
                </div>
                <div style={{ marginLeft: 'auto', textAlign: 'right' }}><div style={{ color: btb.text, fontSize: 11.5, fontWeight: 800 }}>{usd(market.priceUsd, false)}</div><div style={{ fontSize: 9.5, marginTop: 2 }}>{change(market.change24h)}</div></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginTop: 10 }}>
                <div><div style={{ color: btb.textDim, fontSize: 8 }}>VOLUME</div><div style={{ color: btb.textMuted, fontSize: 10, marginTop: 2 }}>{usd(market.volume24h)}</div></div>
                <div><div style={{ color: btb.textDim, fontSize: 8 }}>LIQUIDITY</div><div style={{ color: btb.textMuted, fontSize: 10, marginTop: 2 }}>{usd(market.liquidityUsd)}</div></div>
                <div><div style={{ color: btb.textDim, fontSize: 8 }}>TRADES / AGE</div><div style={{ color: btb.textMuted, fontSize: 10, marginTop: 2 }}>{(market.buys24h + market.sells24h).toLocaleString('en-US')} · {age(market.pairCreatedAt)}</div></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginTop: 10 }}><button onClick={() => selectTrade(market, 'buy')} style={marketButton('buy')}>Buy</button><button onClick={() => selectTrade(market, 'sell')} style={marketButton('sell')}>Dump</button></div>
            </div>
          ) : (
            <div key={market.address} style={{ display: 'grid', gridTemplateColumns: 'minmax(190px,1.65fr) .75fr .58fr .72fr .72fr .58fr 126px', gap: 10, alignItems: 'center', minHeight: 62, padding: '0 12px', borderBottom: index < Math.min(visible, filtered.length) - 1 ? btb.borderSoft : undefined }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                <TokenIcon symbol={market.symbol} logoUrl={market.imageUrl} size={31}/>
                <div style={{ minWidth: 0 }}><div style={{ display: 'flex', gap: 5, alignItems: 'center' }}><span style={{ color: btb.text, fontSize: 11.5, fontWeight: 850, overflow: 'hidden', textOverflow: 'ellipsis' }}>{market.symbol}</span><span style={{ color: btb.textDim, fontSize: 8.5 }}>{market.dex}{market.version ? ` ${market.version}` : ''}</span></div><a href={`https://robinhoodchain.blockscout.com/token/${market.address}`} target="_blank" rel="noopener noreferrer" style={{ color: btb.textDim, fontSize: 8.5, textDecoration: 'none' }}>{market.address.slice(0, 6)}…{market.address.slice(-4)} ↗</a></div>
              </div>
              <span style={{ color: btb.text, fontSize: 10.5, fontWeight: 750, textAlign: 'right' }}>{usd(market.priceUsd, false)}</span>
              <span style={{ fontSize: 10, textAlign: 'right' }}>{change(market.change24h)}</span>
              <span style={{ color: btb.textMuted, fontSize: 10, textAlign: 'right' }}>{usd(market.volume24h)}</span>
              <span style={{ color: btb.textMuted, fontSize: 10, textAlign: 'right' }}>{usd(market.liquidityUsd)}</span>
              <span style={{ color: btb.textMuted, fontSize: 10, textAlign: 'right' }}>{age(market.pairCreatedAt)}</span>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 5 }}><button onClick={() => selectTrade(market, 'buy')} style={marketButton('buy')}>Buy</button><button onClick={() => selectTrade(market, 'sell')} style={marketButton('sell')}>Dump</button></div>
            </div>
          ))}
      </div>

      {visible < filtered.length && <button onClick={() => setVisible(value => value + 30)} style={{ width: '100%', height: 36, marginTop: 9, borderRadius: 10, border: btb.borderSoft, background: 'rgba(255,255,255,.025)', color: btb.textMuted, fontFamily: 'inherit', fontSize: 10.5, fontWeight: 750, cursor: 'pointer' }}>Load more markets</button>}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginTop: 9, color: btb.textDim, fontSize: 8.5, lineHeight: 1.4 }}>
        <span>Trending uses live volume, liquidity and trade activity. New markets and high returns can be extremely risky.</span>
        <a href="https://dexscreener.com/robinhood" target="_blank" rel="noopener noreferrer" style={{ color: btb.textMuted, textDecoration: 'none' }}>Market data by Dexscreener ↗</a>
      </div>
    </Glass>
  </div>;
}
