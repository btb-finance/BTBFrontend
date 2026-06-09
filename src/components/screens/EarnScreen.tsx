'use client';
import { useEffect, useMemo, useState } from 'react';
import { Glass } from '../Glass';
import { Icon } from '../Icon';
import { btb } from '../design-tokens';
import { getTopPools, poolLink, fmtCompactUsd, LlamaPool } from '../../lib/defillama';
import { V3Positions } from '../V3Positions';
import { CreateV3Position } from '../CreateV3Position';

const DEX_COLORS: Record<string, string> = {
  Uniswap: '#FF007A', Aerodrome: '#2151F5', Blackhole: '#7C3AED',
  Velodrome: '#FF1100', PancakeSwap: '#1FC7D4', SushiSwap: '#FA52A0',
  Curve: '#3B6CF6', Balancer: '#E2E8F0', Camelot: '#F59E0B',
};
const dexColor = (d: string) => DEX_COLORS[d] ?? '#94A3B8';

function apyColor(apy: number) {
  if (apy >= 50) return '#52E3A4';
  if (apy >= 15) return '#7DE3B0';
  return btb.text;
}

export function EarnScreen() {
  const [pools, setPools]   = useState<LlamaPool[]>([]);
  const [loading, setLoad]  = useState(true);
  const [error, setError]   = useState<string | null>(null);
  const [dex, setDex]       = useState<string>('All');
  const [selected, setSelected] = useState<LlamaPool | null>(null);

  useEffect(() => {
    let live = true;
    setLoad(true);
    getTopPools()
      .then((p) => { if (live) { setPools(p); setError(null); } })
      .catch((e: Error) => { if (live) setError(e.message); })
      .finally(() => { if (live) setLoad(false); });
    return () => { live = false; };
  }, []);

  const dexes = useMemo(() => {
    const set = new Set(pools.map((p) => p.dex));
    return ['All', ...Array.from(set).sort()];
  }, [pools]);

  const shown = useMemo(
    () => (dex === 'All' ? pools : pools.filter((p) => p.dex === dex)),
    [pools, dex],
  );

  return (
    <div style={{ padding: 'env(safe-area-inset-top, 24px) 18px 100px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <BetaNotice/>

      {/* header */}
      <div style={{ padding: '0 4px' }}>
        <div style={{ color: btb.text, fontSize: 28, fontWeight: 800, letterSpacing: -0.6 }}>Earn</div>
        <div style={{ color: btb.textMuted, fontSize: 13, marginTop: 2 }}>
          Provide liquidity across the top DEXs · live APR &amp; TVL
        </div>
      </div>

      {/* Your live positions (Uniswap V3 · mainnet) */}
      <V3Positions/>

      {/* Liquidity Pools */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
        <span style={{ color: btb.text, fontSize: 17, fontWeight: 800, letterSpacing: -0.3 }}>Liquidity Pools</span>
        <span style={{ color: btb.textDim, fontSize: 12 }}>{loading ? 'Loading…' : `${shown.length} pools`}</span>
      </div>

      {/* DEX filter chips */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2, scrollbarWidth: 'none' }}>
        {dexes.map((d) => {
          const active = dex === d;
          return (
            <button key={d} onClick={() => setDex(d)} style={{
              flexShrink: 0, height: 32, padding: '0 14px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 13, fontWeight: 700,
              background: active ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${active ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.1)'}`,
              color: active ? '#fff' : btb.textMuted,
              display: 'flex', alignItems: 'center', gap: 7,
            }}>
              {d !== 'All' && <span style={{ width: 8, height: 8, borderRadius: 4, background: dexColor(d) }}/>}
              {d}
            </button>
          );
        })}
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
          {shown.map((p) => (
            <Glass key={p.id} padding={14} radius={18} onClick={() => setSelected(p)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                  background: `${dexColor(p.dex)}22`, border: `1px solid ${dexColor(p.dex)}55`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon name="layers" size={20} color={dexColor(p.dex)}/>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: btb.text, fontSize: 15, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.pair}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                    <span style={{ color: dexColor(p.dex), fontSize: 11, fontWeight: 700 }}>{p.dex}</span>
                    <span style={{ color: btb.textDim, fontSize: 11 }}>·</span>
                    <span style={{ color: btb.textMuted, fontSize: 11 }}>{p.chain}</span>
                    {p.stablecoin && <span style={{ color: '#52E3A4', fontSize: 10, fontWeight: 700, background: 'rgba(82,227,164,0.14)', padding: '1px 6px', borderRadius: 999 }}>Stable</span>}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ color: apyColor(p.apy), fontSize: 17, fontWeight: 800, letterSpacing: -0.3 }}>{p.apy.toFixed(2)}%</div>
                  <div style={{ color: btb.textMuted, fontSize: 11 }}>{fmtCompactUsd(p.tvlUsd)} TVL</div>
                </div>
              </div>
            </Glass>
          ))}
          {shown.length === 0 && (
            <div style={{ color: btb.textMuted, fontSize: 14, textAlign: 'center', padding: 24 }}>No pools for {dex}.</div>
          )}
        </div>
      )}

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

      {selected && <ManageSheet pool={selected} onClose={() => setSelected(null)}/>}
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

function ManageSheet({ pool, onClose }: { pool: LlamaPool; onClose: () => void }) {
  const [minting, setMinting] = useState(false);
  const tokens = (pool.underlyingTokens ?? []) as `0x${string}`[];
  // We can mint natively only for Uniswap V3 pools on Ethereum mainnet.
  const canMintInApp = pool.project === 'uniswap-v3' && pool.chain.toLowerCase() === 'ethereum' && tokens.length >= 2;

  if (minting) {
    return (
      <CreateV3Position
        tokenA={tokens[0]}
        tokenB={tokens[1]}
        onClose={() => setMinting(false)}
        onDone={onClose}
      />
    );
  }

  const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <span style={{ color: btb.textMuted, fontSize: 13 }}>{label}</span>
      <span style={{ color: btb.text, fontSize: 13, fontWeight: 700 }}>{value}</span>
    </div>
  );

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, background: 'rgba(10,10,15,0.98)', borderTop: '1px solid rgba(255,255,255,0.1)', borderRadius: '28px 28px 0 0', padding: '12px 20px 32px', maxHeight: '86vh', overflowY: 'auto' }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.18)', margin: '0 auto 18px' }}/>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div style={{ width: 44, height: 44, borderRadius: 13, background: `${dexColor(pool.dex)}22`, border: `1px solid ${dexColor(pool.dex)}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name="layers" size={22} color={dexColor(pool.dex)}/>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: btb.text, fontSize: 19, fontWeight: 800, letterSpacing: -0.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pool.pair}</div>
            <div style={{ color: btb.textMuted, fontSize: 12, marginTop: 1 }}>{pool.dex} · {pool.chain}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: apyColor(pool.apy), fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>{pool.apy.toFixed(2)}%</div>
            <div style={{ color: btb.textMuted, fontSize: 11 }}>APY</div>
          </div>
        </div>

        <div style={{ margin: '14px 0 8px' }}>
          <Row label="Total APY" value={<span style={{ color: apyColor(pool.apy) }}>{pool.apy.toFixed(2)}%</span>}/>
          <Row label="Fee APY" value={`${pool.apyBase.toFixed(2)}%`}/>
          <Row label="Reward APY" value={`${pool.apyReward.toFixed(2)}%`}/>
          <Row label="TVL" value={fmtCompactUsd(pool.tvlUsd)}/>
          <Row label="Type" value={pool.stablecoin ? 'Stablecoin pair' : 'Volatile pair'}/>
          <Row label="Impermanent-loss risk" value={pool.ilRisk === 'no' ? 'Low' : 'Yes'}/>
        </div>

        {/* Native add/remove is staged (mainnet first). For now, manage on the DEX. */}
        {canMintInApp && (
          <button onClick={() => setMinting(true)} style={{
            width: '100%', height: 56, borderRadius: 18, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            background: 'linear-gradient(135deg,#52E3A4,#1aad77)', color: '#fff', fontSize: 16, fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 8px 20px rgba(82,227,164,0.3)', marginBottom: 10,
          }}>
            <Icon name="plus" size={18}/> Add liquidity in-app
          </button>
        )}

        {/* DeFiLlama is the discovery source — external link, clearly marked. */}
        <a href={poolLink(pool)} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
          <button style={{
            width: '100%', height: canMintInApp ? 46 : 54, borderRadius: 16, cursor: 'pointer', fontFamily: 'inherit',
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)', color: btb.textMuted, fontSize: 14, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            View on DeFiLlama ↗
          </button>
        </a>
        <div style={{ color: btb.textDim, fontSize: 11, textAlign: 'center', marginTop: 12, lineHeight: 1.5 }}>
          {canMintInApp
            ? 'Creates a new Uniswap V3 position from your wallet — no redirect. Manage it afterwards under “Your Positions”.'
            : `In-app add/withdraw work today for Uniswap V3 on Ethereum. This pool (${pool.dex} · ${pool.chain}) opens at the source for now.`}
        </div>
      </div>
    </div>
  );
}
