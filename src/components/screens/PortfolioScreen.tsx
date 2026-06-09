'use client';
import { useState } from 'react';
import { Glass } from '../Glass';
import { Icon } from '../Icon';
import { TokenIcon } from '../TokenIcon';
import { btb } from '../design-tokens';
import { useTokenStore, Token } from '../../lib/TokenStore';
import { CHAIN_META } from '../../lib/wagmi';
import { V3Positions } from '../V3Positions';

function fmt(n: number, dp = 2) {
  return n.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

function Donut({ tokens, total }: { tokens: Token[]; total: number }) {
  const COLORS = ['#FFFFFF','#FFB36B','#52E3A4','#94A3B8','#3B99FC','#FF6B7A'];
  const top4 = [...tokens].sort((a, b) => (b.usdValue ?? 0) - (a.usdValue ?? 0)).slice(0, 4);
  const r = 36, cx = 44, cy = 44, circ = 2 * Math.PI * r;
  let offset = 0;
  const segments = top4.map((t, i) => ({
    c: COLORS[i],
    pct: total > 0 ? ((t.usdValue ?? 0) / total) * 100 : 25,
    sym: t.symbol,
  }));
  if (segments.length === 0) {
    segments.push({ c: 'rgba(255,255,255,0.08)', pct: 100, sym: '—' });
  }
  return (
    <svg width="88" height="88" viewBox="0 0 88 88" style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="12"/>
      {segments.map((s, i) => {
        const len = (s.pct / 100) * circ;
        const el = (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none"
            stroke={s.c} strokeWidth="12"
            strokeDasharray={`${len} ${circ - len}`}
            strokeDashoffset={-offset}
          />
        );
        offset += len;
        return el;
      })}
    </svg>
  );
}

export function PortfolioScreen({ onSend, onSwap }: { onSend?: (token: Token) => void; onSwap?: (token: Token) => void } = {}) {
  const { positions, loadingBalances, loadingList, error, refetchBalances } = useTokenStore();
  const tokensWithBalance = [...positions]
    .filter(t => parseFloat(t.balance ?? '0') > 0)
    .sort((a, b) => (b.usdValue ?? 0) - (a.usdValue ?? 0));
  const totalUsd = tokensWithBalance.reduce((s, t) => s + (t.usdValue ?? 0), 0);
  // Full loader only when there's nothing cached to show. Once we have a
  // snapshot, navigating back never blanks out — refreshes happen in place.
  const loading = (loadingBalances || loadingList) && tokensWithBalance.length === 0;
  const refreshing = loadingBalances && tokensWithBalance.length > 0;
  const [expandedToken, setExpandedToken] = useState<string | null>(null);

  const COLORS = ['#FFFFFF','#FFB36B','#52E3A4','#94A3B8'];
  const top4 = tokensWithBalance.slice(0, 4);

  return (
    <div style={{ padding: 'env(safe-area-inset-top, 24px) 18px 100px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px' }}>
        <div style={{ color: btb.text, fontSize: 28, fontWeight: 800, letterSpacing: -0.6 }}>Portfolio</div>
        <Glass padding={0} radius={999} style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: refreshing ? 'default' : 'pointer' }} onClick={() => { if (!refreshing) refetchBalances(); }}>
          <div style={refreshing ? { animation: 'spin 0.8s linear infinite', width: 18, height: 18 } : undefined}>
            <Icon name="refresh" size={18}/>
          </div>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </Glass>
      </div>

      {/* net worth card */}
      <Glass padding={20} radius={26} strong>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <Donut tokens={tokensWithBalance} total={totalUsd}/>
          <div style={{ flex: 1 }}>
            <div style={{ color: btb.textMuted, fontSize: 12, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase' }}>Net worth</div>
            {loading
              ? <div style={{ color: btb.textMuted, fontSize: 14, marginTop: 6 }}>Loading…</div>
              : <>
                  <div style={{ color: btb.text, fontSize: 26, fontWeight: 800, letterSpacing: -0.5 }}>${fmt(totalUsd)}</div>
                  <div style={{ color: btb.textMuted, fontSize: 12, marginTop: 4 }}>{tokensWithBalance.length} tokens</div>
                </>
            }
          </div>
        </div>

        {top4.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, marginTop: 14 }}>
            {top4.map((t, i) => (
              <div key={t.symbol} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: 4, background: COLORS[i], flexShrink: 0 }}/>
                <span style={{ color: btb.textMuted, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.symbol}</span>
                <span style={{ marginLeft: 'auto', color: btb.text, fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
                  {totalUsd > 0 ? Math.round(((t.usdValue ?? 0) / totalUsd) * 100) : 0}%
                </span>
              </div>
            ))}
          </div>
        )}
      </Glass>

      {/* Live LP positions (Uniswap V3 · mainnet) */}
      <V3Positions/>

      {/* tokens list — from our own multicall balance system */}
      {loading ? (
        <Glass padding={20} radius={22}>
          <div style={{ color: btb.textMuted, fontSize: 14, textAlign: 'center' }}>
            <div style={{ marginBottom: 8, width: 28, height: 28, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.18)', borderTopColor: '#FFFFFF', margin: '0 auto 10px', animation: 'spin 0.8s linear infinite' }}/>
            Fetching balances…
          </div>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </Glass>
      ) : error ? (
        <Glass padding={20} radius={22}>
          <div style={{ color: btb.red, fontSize: 13, textAlign: 'center' }}>Failed to load: {error}</div>
        </Glass>
      ) : tokensWithBalance.length === 0 ? (
        <Glass padding={20} radius={22}>
          <div style={{ color: btb.textMuted, fontSize: 14, textAlign: 'center' }}>No tokens found</div>
        </Glass>
      ) : (
        <Glass padding={0} radius={22}>
          {tokensWithBalance.map((h, i) => {
            const balNum = parseFloat(h.balance ?? '0');
            const balStr = balNum >= 1000
              ? fmt(balNum, 2)
              : balNum >= 0.01
              ? fmt(balNum, 4)
              : balNum.toExponential(2);
            const tokenKey = h.address + h.symbol + (h.chainId ?? '');
            const isExpanded = expandedToken === tokenKey;
            return (
              <div key={tokenKey} style={{ borderBottom: i < tokensWithBalance.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                <div onClick={() => setExpandedToken(isExpanded ? null : tokenKey)} style={{
                  padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
                }}>
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <TokenIcon symbol={h.symbol} size={40} logoUrl={h.logoURI}/>
                    {h.chainId && h.chainId !== 1 && CHAIN_META[h.chainId] && (
                      <div style={{ position: 'absolute', bottom: -2, right: -2, width: 14, height: 14, borderRadius: '50%', background: CHAIN_META[h.chainId].color, border: '2px solid #0A0A0F' }}/>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: btb.text, fontSize: 15, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.symbol}</div>
                    <div style={{ color: btb.textMuted, fontSize: 12, marginTop: 1 }}>{balStr} · {h.chainId && CHAIN_META[h.chainId] ? CHAIN_META[h.chainId].name : 'Ethereum'}</div>
                  </div>
                  <div style={{ textAlign: 'right', minWidth: 72, flexShrink: 0 }}>
                    <div style={{ color: btb.text, fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>${fmt(h.usdValue ?? 0)}</div>
                  </div>
                  <Icon name={isExpanded ? 'up' : 'down'} size={12} color={btb.textDim}/>
                </div>

                {isExpanded && (
                  <div style={{ padding: '0 16px 14px', display: 'flex', gap: 8 }}>
                    <button onClick={() => { onSend?.(h); setExpandedToken(null); }} style={{
                      flex: 1, height: 42, borderRadius: 14, border: btb.borderSoft,
                      background: 'rgba(255,255,255,0.07)', color: btb.text,
                      fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    }}>
                      <Icon name="send" size={14}/> Send {h.symbol}
                    </button>
                    <button onClick={() => { onSwap?.(h); setExpandedToken(null); }} style={{
                      flex: 1, height: 42, borderRadius: 14, border: 'none',
                      background: 'linear-gradient(135deg,rgba(255,255,255,0.15),rgba(255,255,255,0.07))',
                      color: btb.text, fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      boxShadow: '0 4px 12px rgba(255,255,255,0.08)',
                    }}>
                      <Icon name="swap" size={14}/> Swap {h.symbol}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </Glass>
      )}
    </div>
  );
}
