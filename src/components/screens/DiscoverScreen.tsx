'use client';
import { useEffect, useMemo, useState } from 'react';
import { useConfig } from 'wagmi';
import { getPublicClient } from 'wagmi/actions';
import { mintTarget, lpAddressesForToken, fmtApr, fmtCompactUsd, EarnPool } from '../../lib/pools';
import { useTokenStore } from '../../lib/TokenStore';
import { useDiscoverPools, prefetchDiscoverPools } from '../../lib/discoverPools';
import { DataTable, Column } from '../DataTable';
import { TokenIcon } from '../TokenIcon';
import { Sparkline } from '../Sparkline';
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
  const { pools, priceChange, sparklines, loading } = useDiscoverPools();
  const [search, setSearch] = useState('');
  const [sheet, setSheet] = useState<{ pool: EarnPool; simulate: boolean } | null>(null);

  // No-op when the app shell already warmed the data (or it's still fresh).
  useEffect(() => {
    prefetchDiscoverPools(getPublicClient(config));
  }, [config]);

  const { positions, tokens } = useTokenStore();
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
    if (!q) return pools;
    return pools.filter(p => p.pair.toLowerCase().includes(q) || p.dex.toLowerCase().includes(q));
  }, [pools, search]);

  const splitPair = (p: EarnPool) => p.pair.split('-') as [string, string];
  const sheetProps = sheet ? mintTarget(sheet.pool, sheet.simulate) : null;
  const hasVolumeData = pools.some(p => p.volume24hUsd != null);

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
                {p.feeTier != null && <span style={{ color: btb.textDim, fontSize: 11 }}>{(p.feeTier / 10000).toFixed(2)}%</span>}
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
      key: 'chart', label: 'Trend', align: 'right', width: '90px',
      render: p => {
        const s = sparklines[p.id];
        if (!s) return <span style={{ color: btb.textDim }}>—</span>;
        const up = s[s.length - 1] >= s[0];
        const title = p.source === 'uniswap' ? 'Recent price' : 'Recent TVL';
        return <span title={title}><Sparkline points={s} width={70} height={24} color={up ? btb.green : btb.loss} /></span>;
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
      render: p => (
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
        const est = p.fees24hUsd == null;
        return <span title={est ? 'Estimated from pool APR' : undefined}>{est && '≈ '}{fmtCompactUsd(estFees24h(p))}</span>;
      },
    },
    {
      key: 'feesToTvl', label: 'Fees / TVL', align: 'right', sortable: true,
      sortValue: p => (p.tvlUsd > 0 ? estFees24h(p) / p.tvlUsd : 0),
      render: p => p.tvlUsd > 0 ? `${((estFees24h(p) / p.tvlUsd) * 100).toFixed(3)}%` : '—',
    },
    {
      key: 'actions', label: '', align: 'right', width: '210px',
      render: p => {
        const mintable = mintTarget(p) !== null;
        return (
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
            {mintable && (
              <Button variant="success" size="sm" onClick={() => setSheet({ pool: p, simulate: false })}
                style={{ height: 30, padding: '0 12px', gap: 4, fontSize: 11.5, boxShadow: 'none', whiteSpace: 'nowrap' }}>
                <Icon name="plus" size={11} /> Add LP
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setSheet({ pool: p, simulate: true })}
              style={{ height: 30, padding: '0 12px', gap: 4, fontSize: 11.5, border: btb.borderSoft, whiteSpace: 'nowrap' }}>
              Simulate
            </Button>
          </div>
        );
      },
    },
  ];

  const columns = allColumns.filter(c => c.key !== 'volume' || hasVolumeData);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 8,
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
            const spark = sparklines[p.id];
            const mintable = mintTarget(p) !== null;
            return (
              <Glass key={p.id} padding={14} radius={18} onClick={() => setSheet({ pool: p, simulate: !mintable })}>
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
                      {p.feeTier != null && <span style={{ color: btb.textDim, fontSize: 11 }}>{(p.feeTier / 10000).toFixed(2)}%</span>}
                      {p.stablecoin && <Badge size="sm" color={btb.green} bg="rgba(82,227,164,0.14)" border="none" style={{ fontSize: 10, padding: '1px 6px' }}>Stable</Badge>}
                      {mine.length > 0 && (
                        <Badge size="sm" color="#7DE3B0" bg="rgba(82,227,164,0.1)" border="1px solid rgba(82,227,164,0.3)" style={{ fontSize: 10, padding: '1px 6px' }}>
                          You hold {mine.join(' + ')}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ color: btb.green, fontSize: 15, fontWeight: 800 }}>{fmtApr(p.aprRange ?? p.apy)}</div>
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
                    <div style={{ color: btb.text, fontSize: 12.5, fontWeight: 600 }}>{p.fees24hUsd == null && '≈ '}{fmtCompactUsd(estFees24h(p))}</div>
                  </div>
                  <div style={{ marginLeft: 'auto' }}>
                    {spark && <Sparkline points={spark} width={64} height={22} color={spark[spark.length - 1] >= spark[0] ? btb.green : btb.loss} />}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 12 }} onClick={e => e.stopPropagation()}>
                  {mintable && (
                    <Button variant="success" size="sm" onClick={() => setSheet({ pool: p, simulate: false })}
                      style={{ height: 36, flex: 1, gap: 5, fontSize: 12.5, boxShadow: 'none' }}>
                      <Icon name="plus" size={12} /> Add LP
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => setSheet({ pool: p, simulate: true })}
                    style={{ height: 36, flex: 1, gap: 5, fontSize: 12.5, border: btb.borderSoft }}>
                    Simulate
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
            rowKey={p => p.id}
            loading={loading}
            emptyMessage="No pools found"
            defaultSortKey="tvl"
            onRowClick={p => setSheet({ pool: p, simulate: mintTarget(p) === null })}
          />
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
