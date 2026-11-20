// Server-rendered first view of Discover (see ../RoutePreview.tsx): the banner, the search row and the busiest pools,
// drawn with the same row pieces as the live screen (../discover/poolParts) and in the same order, so the swap to the
// live screen does not move anything. Buttons do nothing until the app has loaded, as on any server-rendered page.
import { mintTarget, fmtCompactUsd, type EarnPool } from '../../lib/pools';
import { SCAN_CHAINS } from '../../../convex/tokenScanConfig';
import { DiscoverStatusBanner } from '../DiscoverStatusBanner';
import { Button } from '../Button';
import { Icon } from '../Icon';
import { btb } from '../design-tokens';
import {
  canSimulatePool, discoverChainId, feesToTvlText, groupByPair, isMetricPool, pairKey, scanTokenOf,
  AprCell, ChangeCell, FeesCell, MorePoolsToggle, PoolCard, PoolNameCell, SearchBox, SEARCH_INPUT_STYLE, SEARCH_PLACEHOLDER,
} from '../discover/poolParts';
import type { DiscoverPreviewData } from './discoverPreviewData';

const PHONE_GROUPS = 6;

// The snapshot's own logos; the live screen can also fill gaps from the token list, which the server does not load.
const logosOf = (p: EarnPool) => [p.tokenLogos?.[0] ?? undefined, p.tokenLogos?.[1] ?? undefined];
const DESKTOP_GROUPS = 12;

function actionsOf(p: EarnPool) {
  const chainId = discoverChainId(p.chain, p.chainId);
  const scan = !!chainId && !!SCAN_CHAINS[chainId] && !!scanTokenOf(p);
  return { mintable: mintTarget(p) !== null || isMetricPool(p), simulatable: canSimulatePool(p) || isMetricPool(p), scan };
}

function PhoneActions({ p }: { p: EarnPool }) {
  const a = actionsOf(p);
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
      {a.mintable && <Button variant="success" size="sm" style={{ height: 36, flex: 1, gap: 5, fontSize: 12.5, boxShadow: 'none' }}>Add LP</Button>}
      <Button variant="ghost" size="sm" style={{ height: 36, flex: 1, gap: 5, fontSize: 12.5, border: btb.borderSoft }}>{a.simulatable ? 'Simulate' : 'View'}</Button>
      {a.scan && <Button variant="ghost" size="sm" style={{ height: 36, padding: '0 14px', fontSize: 12.5, border: btb.borderSoft, whiteSpace: 'nowrap' }}>Scan</Button>}
    </div>
  );
}

function DesktopActions({ p }: { p: EarnPool }) {
  const a = actionsOf(p);
  const s = { height: 30, padding: '0 12px', gap: 4, fontSize: 11.5, whiteSpace: 'nowrap' as const };
  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', whiteSpace: 'nowrap' }}>
      {a.mintable && <Button variant="success" size="sm" style={{ ...s, boxShadow: 'none' }}>Add LP</Button>}
      <Button variant="ghost" size="sm" style={{ ...s, border: btb.borderSoft }}>{a.simulatable ? 'Simulate' : 'View'}</Button>
      {a.scan && <Button variant="ghost" size="sm" style={{ ...s, border: btb.borderSoft }}>Scan</Button>}
    </div>
  );
}

function FilterButton({ label, mobile }: { label: string; mobile: boolean }) {
  return (
    <div style={{ position: 'relative', flex: mobile ? 1 : '0 0 170px', minWidth: 0 }}>
      <div style={{ width: '100%', height: 42, borderRadius: 12, border: btb.borderSoft, background: btb.surfaceSoft, color: btb.text, padding: '0 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ flex: 1, fontSize: 12.5, fontWeight: 750, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
        <Icon name="down" size={12} color={btb.textMuted}/>
      </div>
    </div>
  );
}

function Controls({ mobile }: { mobile: boolean }) {
  return (
    <>
      <DiscoverStatusBanner isMobile={mobile}/>
      <div style={{ display: 'flex', gap: 10, flexWrap: mobile ? 'wrap' : 'nowrap' }}>
        <SearchBox mobile={mobile}>
          <input readOnly aria-label="Search pools" placeholder={SEARCH_PLACEHOLDER} style={SEARCH_INPUT_STYLE}/>
        </SearchBox>
        <FilterButton label="All chains" mobile={mobile}/>
        <FilterButton label="All DEXs" mobile={mobile}/>
      </div>
    </>
  );
}

const TH = { padding: '10px 16px', fontSize: 12.5, fontWeight: 600, color: btb.textMuted, borderBottom: btb.borderSoft, whiteSpace: 'nowrap' as const };
const TD = { padding: '12px 16px', fontSize: 13.5, color: btb.text, borderBottom: '1px solid rgba(var(--fg-rgb), 0.04)' };

export function DiscoverPreview({ data }: { data: DiscoverPreviewData | null }) {
  const pools = data?.pools ?? [];
  const change = (p: EarnPool) => data?.priceChange[p.id];
  // The live screen's orders: phones by TVL, the desktop table by 24h volume, both one row per pair.
  const phoneGroups = groupByPair([...pools].sort((a, b) => b.tvlUsd - a.tvlUsd)).slice(0, PHONE_GROUPS);
  const deskGroups = groupByPair([...pools].sort((a, b) => (b.volume24hUsd ?? 0) - (a.volume24hUsd ?? 0))).slice(0, DESKTOP_GROUPS);
  const hasVolume = pools.some(p => p.volume24hUsd != null);
  const heads: [string, 'left' | 'right', string?][] = [
    ['Pool', 'left'], ['24h', 'right'], ['APR', 'right'], ['TVL', 'right'],
    ...(hasVolume ? [['Volume (24h)', 'right'] as [string, 'right']] : []),
    ['Fees (24h)', 'right'], ['Fees / TVL', 'right'], ['', 'right', '270px'],
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="btb-phone-only" style={{ gap: 20 }}>
        <Controls mobile/>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {phoneGroups.map(g => (
            <div key={pairKey(g[0])} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <PoolCard p={g[0]} priceChange={change(g[0])} logos={logosOf(g[0])} actions={<PhoneActions p={g[0]}/>}/>
              {g.length > 1 && <MorePoolsToggle more={g.length - 1} open={false}/>}
            </div>
          ))}
        </div>
      </div>

      <div className="btb-desktop-only" style={{ gap: 20 }}>
        <Controls mobile={false}/>
        {pools.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ color: btb.textMuted, fontSize: 12, padding: '0 4px' }}>Showing the busiest pools, loading the rest…</div>
            <div style={{ borderRadius: 16, border: btb.borderSoft, background: btb.surfaceSoft, overflow: 'hidden' }}>
              <div style={{ width: '100%', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontVariantNumeric: 'tabular-nums' }}>
                  <thead>
                    <tr>
                      {heads.map(([label, align, width]) => (
                        <th key={label || 'actions'} style={{ ...TH, textAlign: align, width }}>
                          {label}
                          {label === 'Volume (24h)' && <span style={{ marginLeft: 4, display: 'inline-flex', verticalAlign: 'middle' }}><Icon name="down" size={11} color={btb.text}/></span>}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {deskGroups.map(g => {
                      const p = g[0];
                      return (
                        <tr key={`${p.chain}-${p.id}`}>
                          <td style={TD}>
                            {g.length > 1 ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ flex: 1, minWidth: 0 }}><PoolNameCell p={p} logos={logosOf(p)}/></div>
                                <span style={{ flexShrink: 0, height: 24, padding: '0 8px', borderRadius: 999, fontSize: 11, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4, border: '1px solid rgba(var(--fg-rgb), 0.12)', background: 'rgba(var(--fg-rgb), 0.05)', color: btb.textMuted }}>
                                  +{g.length - 1}
                                  <Icon name="down" size={10} color={btb.textMuted}/>
                                </span>
                              </div>
                            ) : <PoolNameCell p={p} logos={logosOf(p)}/>}
                          </td>
                          <td style={{ ...TD, textAlign: 'right' }}><ChangeCell p={p} priceChange={change(p)}/></td>
                          <td style={{ ...TD, textAlign: 'right' }}><AprCell p={p}/></td>
                          <td style={{ ...TD, textAlign: 'right' }}>{fmtCompactUsd(p.tvlUsd)}</td>
                          {hasVolume && <td style={{ ...TD, textAlign: 'right' }}>{p.volume24hUsd != null ? fmtCompactUsd(p.volume24hUsd) : <span style={{ color: btb.textDim }}>n/a</span>}</td>}
                          <td style={{ ...TD, textAlign: 'right' }}><FeesCell p={p}/></td>
                          <td style={{ ...TD, textAlign: 'right' }}>{feesToTvlText(p)}</td>
                          <td style={{ ...TD, textAlign: 'right' }}><DesktopActions p={p}/></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
