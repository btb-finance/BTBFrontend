'use client';
import { useEffect, useMemo, useState } from 'react';
import { useConfig } from 'wagmi';
import { getPublicClient } from 'wagmi/actions';
import { Glass } from '../Glass';
import { Icon } from '../Icon';
import { btb } from '../design-tokens';
import {
  getEarnPools, addRangeAprs, mintTarget, lpAddressesForToken,
  RANGE_APR_PCT, fmtApr, fmtCompactUsd, fmtFeeTier, EarnPool,
} from '../../lib/pools';
import { useTokenStore } from '../../lib/TokenStore';
import { LpPositions } from '../LpPositions';
import { CreatePosition } from '../CreatePosition';

const DEX_COLORS: Record<string, string> = { Uniswap: '#FF007A', PancakeSwap: '#1FC7D4' };
const dexColor = (dex: string) => DEX_COLORS[dex] ?? '#FF007A';

// Staged DEX integrations — shown as "coming soon" instead of listing pools
// the app can't act on yet.
const COMING_SOON_DEXS: { name: string; color: string }[] = [
  { name: 'Aerodrome', color: '#2151F5' },
  { name: 'Curve', color: '#3B6CF6' },
  { name: 'Velodrome', color: '#FF1100' },
  { name: 'SushiSwap', color: '#FA52A0' },
  { name: 'Balancer', color: '#E2E8F0' },
];

function apyColor(apy: number) {
  if (apy >= 50) return '#52E3A4';
  if (apy >= 15) return '#7DE3B0';
  return btb.text;
}

export function EarnScreen() {
  const config = useConfig();
  const [pools, setPools]   = useState<EarnPool[]>([]);
  const [loading, setLoad]  = useState(true);
  const [error, setError]   = useState<string | null>(null);
  const [sheet, setSheet] = useState<{ pool: EarnPool; simulate: boolean } | null>(null);

  useEffect(() => {
    let live = true;
    setLoad(true);
    getEarnPools()
      .then((p) => {
        if (!live) return;
        setPools(p); setError(null);
        // Upgrade the headline numbers to ±5%-range APRs (live on-chain
        // liquidity) once available — the list shows immediately either way.
        const client = getPublicClient(config);
        if (client) addRangeAprs(client, p).then((ep) => { if (live) setPools(ep); }).catch(() => {});
      })
      .catch((e: Error) => { if (live) setError(e.message); })
      .finally(() => { if (live) setLoad(false); });
    return () => { live = false; };
  }, [config]);

  const sheetProps = sheet ? mintTarget(sheet.pool, sheet.simulate) : null;

  // Balance-aware ordering: pools made of tokens the wallet holds rank first
  // (both tokens held beats one), keeping the TVL order within each group.
  const { positions } = useTokenStore();
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
    return (p.underlyingTokens ?? [])
      .map((t, i) => (held.has(t.toLowerCase()) ? syms[i] : null))
      .filter((x): x is string => !!x);
  };
  const shown = useMemo(() => {
    if (held.size === 0) return pools;
    const score = (p: EarnPool) => (p.underlyingTokens ?? []).filter((t) => held.has(t.toLowerCase())).length;
    return [...pools].sort((a, b) => score(b) - score(a));
  }, [pools, held]);

  return (
    <div style={{ padding: 'env(safe-area-inset-top, 24px) 18px 100px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <BetaNotice/>

      {/* header */}
      <div style={{ padding: '0 4px' }}>
        <div style={{ color: btb.text, fontSize: 28, fontWeight: 800, letterSpacing: -0.6 }}>Earn</div>
        <div style={{ color: btb.textMuted, fontSize: 13, marginTop: 2 }}>
          Uniswap V3/V4 &amp; PancakeSwap V3 liquidity · live APR, volume &amp; TVL
        </div>
      </div>

      {/* Your live positions (Uniswap V3 + V4 · mainnet) */}
      <LpPositions/>

      {/* Liquidity Pools */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
        <span style={{ color: btb.text, fontSize: 17, fontWeight: 800, letterSpacing: -0.3 }}>Liquidity Pools</span>
        <span style={{ color: btb.textDim, fontSize: 12 }}>{loading ? 'Loading…' : `${pools.length} pools`}</span>
      </div>

      {error && (
        <Glass padding={14} radius={16} soft>
          <div style={{ color: btb.loss, fontSize: 13 }}>Couldn&apos;t load pools — {error}</div>
        </Glass>
      )}

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[0, 1, 2, 3].map((i) => (
            <Glass key={i} padding={16} radius={18}>
              <div style={{ height: 44, opacity: 0.4, display: 'flex', alignItems: 'center', color: btb.textDim, fontSize: 13 }}>Loading pools…</div>
            </Glass>
          ))}
        </div>
      )}

      {!loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {shown.map((p) => {
            const mintable = mintTarget(p) !== null;
            const mine = heldSyms(p);
            return (
              <Glass key={p.id} padding={14} radius={18}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                    background: `${dexColor(p.dex)}22`, border: `1px solid ${dexColor(p.dex)}55`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon name="layers" size={20} color={dexColor(p.dex)}/>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                      <span style={{ color: btb.text, fontSize: 15, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.pair}</span>
                      {p.feeTier !== undefined && (
                        <span style={{ flexShrink: 0, color: btb.textMuted, fontSize: 10, fontWeight: 700, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', padding: '1px 6px', borderRadius: 999 }}>{fmtFeeTier(p.feeTier)}</span>
                      )}
                      {p.version && (
                        <span style={{ flexShrink: 0, color: dexColor(p.dex), fontSize: 10, fontWeight: 700, background: `${dexColor(p.dex)}18`, border: `1px solid ${dexColor(p.dex)}44`, padding: '1px 6px', borderRadius: 999 }}>{p.dex === 'PancakeSwap' ? `CAKE ${p.version}` : p.version}</span>
                      )}
                      {p.stablecoin && <span style={{ flexShrink: 0, color: '#52E3A4', fontSize: 10, fontWeight: 700, background: 'rgba(82,227,164,0.14)', padding: '1px 6px', borderRadius: 999 }}>Stable</span>}
                      {mine.length > 0 && (
                        <span style={{ flexShrink: 0, color: '#7DE3B0', fontSize: 10, fontWeight: 700, background: 'rgba(82,227,164,0.1)', border: '1px solid rgba(82,227,164,0.3)', padding: '1px 6px', borderRadius: 999 }}>
                          You hold {mine.join(' + ')}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                      <span style={{ color: btb.textMuted, fontSize: 11 }}>Vol 24h <b style={{ color: btb.text, fontWeight: 700 }}>{fmtCompactUsd(p.volume24hUsd ?? 0)}</b></span>
                      <span style={{ color: btb.textMuted, fontSize: 11 }}>Fees <b style={{ color: btb.text, fontWeight: 700 }}>{fmtCompactUsd(p.fees24hUsd ?? 0)}</b></span>
                      <span style={{ color: btb.textMuted, fontSize: 11 }}>TVL <b style={{ color: btb.text, fontWeight: 700 }}>{fmtCompactUsd(p.tvlUsd)}</b></span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ color: apyColor(p.aprRange ?? p.apy), fontSize: 17, fontWeight: 800, letterSpacing: -0.3 }}>{fmtApr(p.aprRange ?? p.apy)}%</div>
                    <div style={{ color: btb.textMuted, fontSize: 11 }}>{p.aprRange !== undefined ? `±${RANGE_APR_PCT}% range APR` : 'pool APR'}</div>
                  </div>
                </div>

                {/* Actions — straight from the list, no intermediate page */}
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  {mintable && (
                    <button onClick={() => setSheet({ pool: p, simulate: false })} style={{
                      flex: 1.5, height: 42, borderRadius: 13, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                      background: 'linear-gradient(135deg,#52E3A4,#1aad77)', color: '#fff', fontSize: 14, fontWeight: 800,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    }}>
                      <Icon name="plus" size={16}/> Add LP
                    </button>
                  )}
                  <button onClick={() => setSheet({ pool: p, simulate: true })} style={{
                    flex: 1, height: 42, borderRadius: 13, cursor: 'pointer', fontFamily: 'inherit',
                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)', color: btb.textMuted, fontSize: 14, fontWeight: 700,
                  }}>
                    Simulate
                  </button>
                </div>
              </Glass>
            );
          })}
          {pools.length === 0 && !error && (
            <div style={{ color: btb.textMuted, fontSize: 14, textAlign: 'center', padding: 24 }}>No pools right now.</div>
          )}
        </div>
      )}

      {/* More DEXs — staged */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 4px 0' }}>
        <span style={{ color: btb.text, fontSize: 17, fontWeight: 800, letterSpacing: -0.3 }}>More DEXs</span>
        <span style={{ color: btb.textDim, fontSize: 11, fontWeight: 700, border: '1px solid rgba(255,255,255,0.14)', borderRadius: 999, padding: '3px 10px' }}>Soon</span>
      </div>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2, scrollbarWidth: 'none' }}>
        {COMING_SOON_DEXS.map((d) => (
          <span key={d.name} style={{
            flexShrink: 0, height: 32, padding: '0 14px', borderRadius: 999, fontSize: 13, fontWeight: 700,
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: btb.textDim,
            display: 'flex', alignItems: 'center', gap: 7, opacity: 0.7,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: 4, background: d.color }}/>
            {d.name}
          </span>
        ))}
      </div>

      {/* Safe Earnings — staged next */}
      <div style={{ color: btb.text, fontSize: 17, fontWeight: 800, letterSpacing: -0.3, padding: '8px 4px 0' }}>Safe Earnings</div>
      <Glass padding={16} radius={20} soft>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(56,189,248,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name="shield" size={20} color="#38BDF8"/>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: btb.text, fontSize: 15, fontWeight: 700 }}>Liquid staking &amp; lending</div>
            <div style={{ color: btb.textMuted, fontSize: 12, marginTop: 2 }}>stETH, rETH, Aave v4 — lower-risk yield. Coming next.</div>
          </div>
          <span style={{ color: btb.textDim, fontSize: 11, fontWeight: 700, border: '1px solid rgba(255,255,255,0.14)', borderRadius: 999, padding: '3px 10px' }}>Soon</span>
        </div>
      </Glass>

      {sheet && sheetProps && (
        <CreatePosition
          tokenA={sheetProps.tokenA}
          tokenB={sheetProps.tokenB}
          v4PoolId={sheetProps.v4PoolId}
          dex={sheetProps.dex}
          initialFee={sheet.pool.feeTier}
          // indexer pools carry real 24h fees; for DeFiLlama rows derive from fee APY
          fees24hUsd={sheet.pool.fees24hUsd ?? (sheet.pool.tvlUsd * sheet.pool.apyBase) / 100 / 365}
          simulate={sheet.simulate}
          onClose={() => setSheet(null)}
          onDone={() => setSheet(null)}
        />
      )}
    </div>
  );
}

const SUGGEST_URL = 'https://discord.gg/bqFEPA56Tc';

function BetaNotice() {
  const [hidden, setHidden] = useState(false);
  useEffect(() => { setHidden(localStorage.getItem('earn-beta-dismissed') === '1'); }, []);
  if (hidden) return null;
  return (
    <div style={{ background: 'rgba(255,179,107,0.1)', border: '1px solid rgba(255,179,107,0.3)', borderRadius: 16, padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <div style={{ flexShrink: 0, marginTop: 1 }}><Icon name="bolt" size={16} color="#FFB36B"/></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: '#FFB36B', fontSize: 13, fontWeight: 700 }}>Earn is in beta</div>
        <div style={{ color: btb.textMuted, fontSize: 12, marginTop: 3, lineHeight: 1.5 }}>
          We&apos;re actively making this better — some things may not work as expected yet. Hit a bug or have an idea?{' '}
          <a href={SUGGEST_URL} target="_blank" rel="noreferrer" style={{ color: '#FFB36B', fontWeight: 700, textDecoration: 'none' }}>Tell us ↗</a> — all suggestions welcome.
        </div>
      </div>
      <button
        onClick={() => { try { localStorage.setItem('earn-beta-dismissed', '1'); } catch {} setHidden(true); }}
        aria-label="Dismiss"
        style={{ flexShrink: 0, background: 'none', border: 'none', color: btb.textMuted, cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 2 }}
      >×</button>
    </div>
  );
}
