'use client';
import { useEffect, useMemo, useState, useRef } from 'react';
import { useConfig } from 'wagmi';
import { getPublicClient } from 'wagmi/actions';
import { mintTarget, poolLink, lpAddressesForToken, fmtApr, fmtCompactUsd, fmtFeeTier, EarnPool } from '../../lib/pools';
import { useTokenStore } from '../../lib/TokenStore';
import { useDiscoverPools, prefetchDiscoverPools } from '../../lib/discoverPools';
import { searchMarketPools, type MarketPool } from '../../lib/dexSearch';

const WETH_ADDR = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
import { DataTable, Column } from '../DataTable';
import { TokenIcon } from '../TokenIcon';
import { Badge } from '../Badge';
import { Button } from '../Button';
import { Icon } from '../Icon';
import { Glass } from '../Glass';
import { Spinner } from '../Spinner';
import { btb } from '../design-tokens';
import { CreatePosition } from '../CreatePosition';
import { useSidebar } from '../../lib/SidebarContext';

/** Fee-based estimate used when the indexer doesn't report real 24h fees (DeFiLlama-sourced rows). */
function estFees24h(p: EarnPool): number {
  return p.fees24hUsd ?? (p.tvlUsd * p.apyBase) / 100 / 365;
}

const COMING_SOON_DEXS: { name: string; color: string }[] = [
  { name: 'Aerodrome', color: '#2151F5' },
  { name: 'Curve', color: '#3B6CF6' },
  { name: 'Velodrome', color: '#FF1100' },
  { name: 'SushiSwap', color: '#FA52A0' },
  { name: 'Balancer', color: '#E2E8F0' },
];

export function DiscoverScreen() {
  const config = useConfig();
  const { isMobile } = useSidebar();
  const { pools, priceChange, loading } = useDiscoverPools();
  const [search, setSearch] = useState('');
  const [selectedChain, setSelectedChain] = useState('all');
  const [selectedDex, setSelectedDex] = useState('all');
  const [sheet, setSheet] = useState<{ pool: EarnPool; simulate: boolean } | null>(null);

  // No-op when the app shell already warmed the data (or it's still fresh).
  useEffect(() => {
    prefetchDiscoverPools(getPublicClient(config));
  }, [config]);

  // Single-token market search: when the query names a token (symbol or
  // address), pull EVERY pool for it across all DEXes via the same
  // GeckoTerminal + DexScreener search Simulate uses for pairs.
  const [marketPools, setMarketPools] = useState<MarketPool[] | null>(null);
  const [marketSymbol, setMarketSymbol] = useState<string | null>(null);
  const [marketLoading, setMarketLoading] = useState(false);
  const marketReqRef = useRef(0);
  const { tokens } = useTokenStore();
  useEffect(() => {
    const q = search.trim().toLowerCase();
    const tok = q
      ? tokens.find(t => t.symbol.toLowerCase() === q || t.address.toLowerCase() === q)
      : undefined;
    if (!tok) {
      marketReqRef.current++;
      setMarketPools(null); setMarketSymbol(null); setMarketLoading(false);
      return;
    }
    const req = ++marketReqRef.current;
    setMarketSymbol(tok.symbol);
    setMarketLoading(true);
    const timer = setTimeout(() => {
      const addr = tok.address === 'ETH' ? WETH_ADDR : tok.address;
      searchMarketPools(addr, undefined, 1000)
        .then(ps => { if (marketReqRef.current === req) setMarketPools(ps); })
        .catch(() => { if (marketReqRef.current === req) setMarketPools([]); })
        .finally(() => { if (marketReqRef.current === req) setMarketLoading(false); });
    }, 500);
    return () => clearTimeout(timer);
  }, [search, tokens]);

  const { positions } = useTokenStore();
  const logoByAddress = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of tokens) if (t.logoURI) m.set(t.address.toLowerCase(), t.logoURI);
    return m;
  }, [tokens]);
  const held = useMemo(() => {
    const s = new Set<string>();
    for (const t of positions) {
      if (parseFloat(t.balance ?? '0') <= 0) continue;
      for (const a of lpAddressesForToken(t.address)) s.add(a);
    }
    return s;
  }, [positions]);
  const heldSyms = (p: EarnPool): string[] => {
    const syms = p.pair.split('-');
    return (p.underlyingTokens ?? []).map((t, i) => (held.has(t.toLowerCase()) ? syms[i] : null)).filter((x): x is string => !!x);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return pools.filter(p => {
      if (selectedChain !== 'all' && p.chain !== selectedChain) return false;
      if (selectedDex !== 'all' && p.dex !== selectedDex) return false;
      return !q || p.pair.toLowerCase().includes(q) || p.dex.toLowerCase().includes(q) || p.chain.toLowerCase().includes(q);
    });
  }, [pools, search, selectedChain, selectedDex]);

  const chains = useMemo(() => [...new Set(pools.map(pool => pool.chain))].sort(), [pools]);
  const dexes = useMemo(() => [...new Set(pools.map(pool => pool.dex))].sort(), [pools]);

  const splitPair = (p: EarnPool) => p.pair.split('-') as [string, string];
  const sheetProps = sheet ? mintTarget(sheet.pool, sheet.simulate) : null;
  const hasVolumeData = pools.some(p => p.volume24hUsd != null);
  const openSimulator = (pool: EarnPool) => {
    const pair = pool.underlyingTokens;
    // The simulator owns pair comparison. Pass the exact addresses so its
    // token pickers are pre-filled rather than opening a separate mini-sheet.
    if (pair?.[0] && pair[1]) {
      window.location.href = `/simulate?tokenA=${encodeURIComponent(pair[0])}&tokenB=${encodeURIComponent(pair[1])}`;
      return;
    }
    // A legacy/indexer row without token addresses cannot safely be mapped by
    // symbol alone (symbols are ambiguous), so preserve the existing fallback.
    setSheet({ pool, simulate: true });
  };

  const allColumns: (Column<EarnPool> & { key: string })[] = [
    {
      key: 'pair', label: 'Pool', sortable: true, sortValue: p => p.pair,
      render: p => {
        const [s0, s1] = splitPair(p);
        const mine = heldSyms(p);
        const [addr0, addr1] = p.underlyingTokens ?? [];
        const logo0 = addr0 ? logoByAddress.get(addr0.toLowerCase()) : undefined;
        const logo1 = addr1 ? logoByAddress.get(addr1.toLowerCase()) : undefined;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex' }}>
              <TokenIcon symbol={s0} size={26} logoUrl={logo0} />
              <div style={{ marginLeft: -8 }}><TokenIcon symbol={s1} size={26} logoUrl={logo1} /></div>
            </div>
            <div>
              <div style={{ fontWeight: 700 }}>{p.pair.replace('-', '/')}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2, flexWrap: 'wrap' }}>
                <Badge size="sm" bg={btb.surfaceSoft} color={btb.textMuted} border="none" style={{ fontSize: 10, padding: '1px 6px' }}>
                  {p.dex}{p.version ? ` ${p.version}` : ''}
                </Badge>
                <Badge size="sm" bg="rgba(148,163,184,0.1)" color={btb.textMuted} border="none" style={{ fontSize: 10, padding: '1px 6px' }}>{p.chain}</Badge>
                {p.feeTier != null && <span style={{ color: btb.textDim, fontSize: 11 }}>{fmtFeeTier(p.feeTier)}</span>}
                {p.stablecoin && <Badge size="sm" color={btb.green} bg="rgba(82,227,164,0.14)" border="none" style={{ fontSize: 10, padding: '1px 6px' }}>Stable</Badge>}
                {mine.length > 0 && (
                  <Badge size="sm" color="#7DE3B0" bg="rgba(82,227,164,0.1)" border="1px solid rgba(82,227,164,0.3)" style={{ fontSize: 10, padding: '1px 6px' }}>
                    You hold {mine.join(' + ')}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      key: 'change24h', label: '24h', align: 'right', sortable: true,
      sortValue: p => p.apyChange1d ?? priceChange[p.id] ?? 0,
      render: p => {
        const pct = p.apyChange1d ?? priceChange[p.id];
        if (pct == null) return <span style={{ color: btb.textDim }}>—</span>;
        const title = p.apyChange1d != null ? 'APY change (24h, pts)' : 'Price change (24h)';
        return <span title={title} style={{ color: pct >= 0 ? btb.green : btb.loss, fontWeight: 600 }}>{pct >= 0 ? '+' : ''}{pct.toFixed(2)}%</span>;
      },
    },
    {
      key: 'apr', label: 'APR', align: 'right', sortable: true, sortValue: p => p.aprRange ?? p.apy,
      render: p => p.source === 'dexscreener' && p.feeTier == null ? <span title="Fee tier data is not available from this source" style={{ color: btb.textDim }}>—</span> : (
        <span title={p.aprRange != null ? '±5% concentrated-range APR at current volume' : 'Whole-pool fees/TVL APR — no range data available for this pool'}
          style={{ color: btb.green, fontWeight: 700, textDecoration: 'underline dotted', textUnderlineOffset: 3 }}>
          {fmtApr(p.aprRange ?? p.apy)}
        </span>
      ),
    },
    {
      key: 'tvl', label: 'TVL', align: 'right', sortable: true, sortValue: p => p.tvlUsd,
      render: p => fmtCompactUsd(p.tvlUsd),
    },
    {
      // Only ever populated for indexer-sourced pools (real subgraph data) —
      // the DeFiLlama fallback API this app runs on otherwise doesn't report
      // volume at all, so the column itself is dropped (see `hasVolumeData`)
      // rather than show a permanently-dead "n/a" for every row.
      key: 'volume', label: 'Volume (24h)', align: 'right', sortable: true, sortValue: p => p.volume24hUsd ?? 0,
      render: p => p.volume24hUsd != null ? fmtCompactUsd(p.volume24hUsd) : <span style={{ color: btb.textDim }}>n/a</span>,
    },
    {
      key: 'fees', label: 'Fees (24h)', align: 'right', sortable: true, sortValue: p => estFees24h(p),
      render: p => {
        if (p.source === 'dexscreener' && p.feeTier == null) return <span style={{ color: btb.textDim }}>n/a</span>;
        const est = p.fees24hUsd == null;
        return <span title={est ? 'Estimated from pool APR' : undefined}>{est && '≈ '}{fmtCompactUsd(estFees24h(p))}</span>;
      },
    },
    {
      key: 'feesToTvl', label: 'Fees / TVL', align: 'right', sortable: true,
      sortValue: p => (p.tvlUsd > 0 ? estFees24h(p) / p.tvlUsd : 0),
      render: p => (p.source !== 'dexscreener' || p.feeTier != null) && p.tvlUsd > 0 ? `${((estFees24h(p) / p.tvlUsd) * 100).toFixed(3)}%` : '—',
    },
    {
      key: 'actions', label: '', align: 'right', width: '210px',
      render: p => {
        const mintable = mintTarget(p) !== null;
        const isEthereum = p.chain.toLowerCase() === 'ethereum';
        return (
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
            {mintable && (
              <Button variant="success" size="sm" onClick={() => setSheet({ pool: p, simulate: false })}
                style={{ height: 30, padding: '0 12px', gap: 4, fontSize: 11.5, boxShadow: 'none', whiteSpace: 'nowrap' }}>
                <Icon name="plus" size={11} /> Add LP
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => isEthereum ? openSimulator(p) : window.open(poolLink(p), '_blank', 'noopener,noreferrer')}
              style={{ height: 30, padding: '0 12px', gap: 4, fontSize: 11.5, border: btb.borderSoft, whiteSpace: 'nowrap' }}>
              {isEthereum ? 'Simulate' : 'View ↗'}
            </Button>
          </div>
        );
      },
    },
  ];

  const columns = allColumns.filter(c => c.key !== 'volume' || hasVolumeData);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
        <div style={{
          flex: 1, minWidth: isMobile ? '100%' : 220, display: 'flex', alignItems: 'center', gap: 8,
          padding: '0 14px', height: 42, borderRadius: 12,
          background: btb.surfaceSoft, border: btb.borderSoft,
        }}>
          <Icon name="search" size={15} color={btb.textMuted} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search assets..."
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: btb.text, fontSize: 13.5, fontFamily: 'inherit' }}
          />
        </div>
        <select value={selectedChain} onChange={event => setSelectedChain(event.target.value)} aria-label="Filter pools by chain" style={{ flex: isMobile ? 1 : '0 0 170px', minWidth: 0, height: 42, borderRadius: 12, border: btb.borderSoft, background: btb.surfaceSoft, color: btb.text, padding: '0 12px', outline: 'none', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
          <option value="all">All chains</option>
          {chains.map(chain => <option key={chain} value={chain}>{chain}</option>)}
        </select>
        <select value={selectedDex} onChange={event => setSelectedDex(event.target.value)} aria-label="Filter pools by DEX" style={{ flex: isMobile ? 1 : '0 0 170px', minWidth: 0, height: 42, borderRadius: 12, border: btb.borderSoft, background: btb.surfaceSoft, color: btb.text, padding: '0 12px', outline: 'none', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
          <option value="all">All DEXs</option>
          {dexes.map(dex => <option key={dex} value={dex}>{dex}</option>)}
        </select>
      </div>

      {isMobile ? (
        // Compact card list — the full table is far too wide for phones.
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <Spinner size={26} color="#fff" track="rgba(255,255,255,0.18)" />
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <div style={{ color: btb.textMuted, fontSize: 13.5, textAlign: 'center', padding: 32 }}>No pools found</div>
          )}
          {!loading && [...filtered].sort((a, b) => b.tvlUsd - a.tvlUsd).map(p => {
            const [s0, s1] = splitPair(p);
            const mine = heldSyms(p);
            const [addr0, addr1] = p.underlyingTokens ?? [];
            const pct = p.apyChange1d ?? priceChange[p.id];
            const mintable = mintTarget(p) !== null;
            const isEthereum = p.chain.toLowerCase() === 'ethereum';
            return (
              <Glass key={`${p.chain}-${p.id}`} padding={14} radius={18} onClick={() => mintable ? setSheet({ pool: p, simulate: false }) : isEthereum ? openSimulator(p) : window.open(poolLink(p), '_blank', 'noopener,noreferrer')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ display: 'flex', flexShrink: 0 }}>
                    <TokenIcon symbol={s0} size={26} logoUrl={addr0 ? logoByAddress.get(addr0.toLowerCase()) : undefined} />
                    <div style={{ marginLeft: -8 }}><TokenIcon symbol={s1} size={26} logoUrl={addr1 ? logoByAddress.get(addr1.toLowerCase()) : undefined} /></div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: btb.text, fontSize: 14 }}>{p.pair.replace('-', '/')}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2, flexWrap: 'wrap' }}>
                      <Badge size="sm" bg={btb.surfaceSoft} color={btb.textMuted} border="none" style={{ fontSize: 10, padding: '1px 6px' }}>
                        {p.dex}{p.version ? ` ${p.version}` : ''}
                      </Badge>
                      <Badge size="sm" bg="rgba(148,163,184,0.1)" color={btb.textMuted} border="none" style={{ fontSize: 10, padding: '1px 6px' }}>{p.chain}</Badge>
                      {p.feeTier != null && <span style={{ color: btb.textDim, fontSize: 11 }}>{fmtFeeTier(p.feeTier)}</span>}
                      {p.stablecoin && <Badge size="sm" color={btb.green} bg="rgba(82,227,164,0.14)" border="none" style={{ fontSize: 10, padding: '1px 6px' }}>Stable</Badge>}
                      {mine.length > 0 && (
                        <Badge size="sm" color="#7DE3B0" bg="rgba(82,227,164,0.1)" border="1px solid rgba(82,227,164,0.3)" style={{ fontSize: 10, padding: '1px 6px' }}>
                          You hold {mine.join(' + ')}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ color: p.source === 'dexscreener' && p.feeTier == null ? btb.textDim : btb.green, fontSize: 15, fontWeight: 800 }}>{p.source === 'dexscreener' && p.feeTier == null ? '—' : fmtApr(p.aprRange ?? p.apy)}</div>
                    <div style={{ color: btb.textDim, fontSize: 10.5 }}>APR</div>
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
                    <div style={{ color: p.source === 'dexscreener' && p.feeTier == null ? btb.textDim : btb.text, fontSize: 12.5, fontWeight: 600 }}>{p.source === 'dexscreener' && p.feeTier == null ? 'n/a' : <>{p.fees24hUsd == null && '≈ '}{fmtCompactUsd(estFees24h(p))}</>}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 12 }} onClick={e => e.stopPropagation()}>
                  {mintable && (
                    <Button variant="success" size="sm" onClick={() => setSheet({ pool: p, simulate: false })}
                      style={{ height: 36, flex: 1, gap: 5, fontSize: 12.5, boxShadow: 'none' }}>
                      <Icon name="plus" size={12} /> Add LP
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => isEthereum ? openSimulator(p) : window.open(poolLink(p), '_blank', 'noopener,noreferrer')}
                    style={{ height: 36, flex: 1, gap: 5, fontSize: 12.5, border: btb.borderSoft }}>
                    {isEthereum ? 'Simulate' : 'View ↗'}
                  </Button>
                </div>
              </Glass>
            );
          })}
        </div>
      ) : (
        <div style={{ borderRadius: 16, border: btb.borderSoft, background: btb.surfaceSoft, overflow: 'hidden' }}>
          <DataTable
            columns={columns}
            rows={filtered}
            rowKey={p => `${p.chain}-${p.id}`}
            loading={loading}
            emptyMessage="No pools found"
            defaultSortKey="tvl"
            onRowClick={p => p.chain.toLowerCase() === 'ethereum'
              ? setSheet({ pool: p, simulate: mintTarget(p) === null })
              : window.open(poolLink(p), '_blank', 'noopener,noreferrer')}
          />
        </div>
      )}

      {/* every pool for the searched token, across all DEXes */}
      {marketSymbol && (marketLoading || (marketPools && marketPools.length > 0)) && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span style={{ color: btb.text, fontSize: 15, fontWeight: 700 }}>All {marketSymbol} pools across DEXes</span>
            {marketLoading && <Spinner size={14} color="#fff" track="rgba(255,255,255,0.18)"/>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(marketPools ?? [])
              .filter(p => !pools.some(cp => cp.id.toLowerCase() === p.address))
              .slice(0, 15)
              .map(p => (
                <Glass key={p.address} padding={14} radius={18}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <div style={{ color: btb.text, fontSize: 13.5, fontWeight: 700 }}>
                        {p.name || `${marketSymbol} pool`}
                      </div>
                      <div style={{ color: btb.textMuted, fontSize: 12, marginTop: 2 }}>
                        {p.dexLabel}
                        {p.feePct != null && ` · ${(p.feePct * 100).toFixed(2)}% fee`}
                        {` · TVL ${fmtCompactUsd(p.tvlUsd)} · ${fmtCompactUsd(p.volume24hUsd)} vol 24h`}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ color: p.aprPct != null ? btb.green : btb.textDim, fontSize: 14, fontWeight: 800 }}>
                        {p.aprPct != null ? fmtApr(p.aprPct) : '—'}
                      </div>
                      <div style={{ color: btb.textDim, fontSize: 10.5 }}>fee APR</div>
                    </div>
                    <a href={p.url} target="_blank" rel="noreferrer" style={{
                      height: 32, padding: '0 14px', borderRadius: 12, border: btb.borderSoft, flexShrink: 0,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      color: btb.textMuted, fontSize: 12, fontWeight: 700, textDecoration: 'none',
                      background: 'rgba(255,255,255,0.06)',
                    }}>View ↗</a>
                  </div>
                </Glass>
              ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2, scrollbarWidth: 'none', alignItems: 'center' }}>
        <span style={{ color: btb.textDim, fontSize: 12, fontWeight: 600, marginRight: 4, flexShrink: 0 }}>More DEXs soon:</span>
        {COMING_SOON_DEXS.map(d => (
          <Badge key={d.name} color={btb.textDim} bg={btb.surfaceSoft} border={btb.borderSoft}
            style={{ height: 30, padding: '0 12px', fontSize: 12, gap: 6, opacity: 0.7, flexShrink: 0 }}>
            <span style={{ width: 7, height: 7, borderRadius: 4, background: d.color }} />
            {d.name}
          </Badge>
        ))}
      </div>

      <Glass padding={16} radius={16} soft>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(56,189,248,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name="shield" size={20} color="#38BDF8" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: btb.text, fontSize: 14, fontWeight: 700 }}>Liquid staking &amp; lending</div>
            <div style={{ color: btb.textMuted, fontSize: 12, marginTop: 2 }}>stETH, rETH, Aave v4 — lower-risk yield. Coming next.</div>
          </div>
          <Badge>Soon</Badge>
        </div>
      </Glass>

      {sheet && sheetProps && (
        <CreatePosition
          tokenA={sheetProps.tokenA}
          tokenB={sheetProps.tokenB}
          v4PoolId={sheetProps.v4PoolId}
          dex={sheetProps.dex}
          initialFee={sheet.pool.feeTier}
          fees24hUsd={sheet.pool.fees24hUsd ?? (sheet.pool.tvlUsd * sheet.pool.apyBase) / 100 / 365}
          simulate={sheet.simulate}
          onClose={() => setSheet(null)}
          onDone={() => setSheet(null)}
        />
      )}
    </div>
  );
}
