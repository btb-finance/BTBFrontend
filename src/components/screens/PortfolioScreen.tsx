'use client';
import { useState } from 'react';
import { Glass } from '../Glass';
import { Icon } from '../Icon';
import { Button } from '../Button';
import { TokenIcon } from '../TokenIcon';
import { btb } from '../design-tokens';
import { DataTable, Column } from '../DataTable';
import { useTokenStore, Token } from '../../lib/TokenStore';
import { CHAIN_META } from '../../lib/wagmi';
import { LpPositions } from '../LpPositions';
import { TokenLpPicker } from '../TokenLpPicker';

function fmt(n: number, dp = 2) {
  return n.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

export function PortfolioScreen({ onSend, onSwap }: { onSend?: (token: Token) => void; onSwap?: (token: Token) => void } = {}) {
  const { positions, loadingBalances, loadingList, error, refetchBalances, showAllChains, setShowAllChains, loadingOtherChains } = useTokenStore();
  const tokensWithBalance = [...positions]
    .filter(t => parseFloat(t.balance ?? '0') > 0)
    .sort((a, b) => (b.usdValue ?? 0) - (a.usdValue ?? 0));
  const totalUsd = tokensWithBalance.reduce((s, t) => s + (t.usdValue ?? 0), 0);
  const loading = (loadingBalances || loadingList) && tokensWithBalance.length === 0;
  const refreshing = loadingBalances && tokensWithBalance.length > 0;
  const [tab, setTab] = useState<'tokens' | 'lps'>('tokens');
  const [lpToken, setLpToken] = useState<Token | null>(null);

  const COLORS = ['#FFFFFF', '#FFB36B', '#52E3A4', '#94A3B8'];
  const top4 = tokensWithBalance.slice(0, 4);

  const columns: Column<Token>[] = [
    {
      key: 'symbol', label: 'Asset', sortable: true, sortValue: t => t.symbol,
      render: t => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <TokenIcon symbol={t.symbol} size={30} logoUrl={t.logoURI} />
            {t.chainId && t.chainId !== 1 && CHAIN_META[t.chainId] && (
              <div style={{ position: 'absolute', bottom: -2, right: -2, width: 12, height: 12, borderRadius: '50%', background: CHAIN_META[t.chainId].color, border: `2px solid ${btb.bg}` }} />
            )}
          </div>
          <div>
            <div style={{ fontWeight: 700 }}>{t.symbol}</div>
            <div style={{ color: btb.textMuted, fontSize: 11.5 }}>{t.chainId && CHAIN_META[t.chainId] ? CHAIN_META[t.chainId].name : 'Ethereum'}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'balance', label: 'Balance', align: 'right', sortable: true, sortValue: t => parseFloat(t.balance ?? '0'),
      render: t => {
        const bal = parseFloat(t.balance ?? '0');
        return bal >= 1000 ? fmt(bal, 2) : bal >= 0.01 ? fmt(bal, 4) : bal.toExponential(2);
      },
    },
    {
      key: 'value', label: 'Value', align: 'right', sortable: true, sortValue: t => t.usdValue ?? 0,
      render: t => <span style={{ fontWeight: 700 }}>${fmt(t.usdValue ?? 0)}</span>,
    },
    {
      key: 'actions', label: '', align: 'right', width: '220px',
      render: t => {
        // Wallet actions all run on Ethereum mainnet only (wagmi is pinned to
        // chain 1) — showing live Send/Swap/LP buttons for another chain's
        // token would submit a broken/misdirected transaction.
        const isMainnet = (t.chainId ?? 1) === 1;
        if (!isMainnet) {
          return <span style={{ color: btb.textDim, fontSize: 11.5 }}>View only</span>;
        }
        return (
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <Button variant="ghost" size="sm" onClick={() => onSend?.(t)}
              style={{ height: 32, gap: 5, fontSize: 12, border: btb.borderSoft, background: 'rgba(255,255,255,0.07)', color: btb.text }}>
              <Icon name="send" size={12} /> Send
            </Button>
            <Button size="sm" onClick={() => onSwap?.(t)}
              style={{ height: 32, gap: 5, fontSize: 12, background: 'linear-gradient(135deg,rgba(255,255,255,0.15),rgba(255,255,255,0.07))', color: btb.text, boxShadow: 'none' }}>
              <Icon name="swap" size={12} /> Swap
            </Button>
            <Button variant="success" size="sm" onClick={() => setLpToken(t)}
              style={{ height: 32, gap: 5, fontSize: 12, boxShadow: 'none' }}>
              <Icon name="plus" size={12} /> LP
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 16 }}>
        <Glass padding={20} radius={18} strong style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ color: btb.textMuted, fontSize: 12, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase' }}>Net worth</div>
            <div style={{ color: btb.text, fontSize: 30, fontWeight: 800, letterSpacing: -0.6, marginTop: 4 }}>${fmt(totalUsd)}</div>
            <div style={{ color: btb.textMuted, fontSize: 12, marginTop: 4 }}>{tokensWithBalance.length} tokens</div>
          </div>
          <Glass padding={0} radius={999} style={{ width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: refreshing ? 'default' : 'pointer' }} onClick={() => { if (!refreshing) refetchBalances(); }}>
            <div className={refreshing ? 'spin' : undefined} style={refreshing ? { width: 16, height: 16 } : undefined}>
              <Icon name="refresh" size={16} />
            </div>
          </Glass>
        </Glass>

        {top4.length > 0 && (
          <Glass padding={20} radius={18} style={{ flex: 1 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              {top4.map((t, i) => (
                <div key={t.address + t.symbol + (t.chainId ?? '')} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 4, background: COLORS[i], flexShrink: 0 }} />
                  <span style={{ color: btb.textMuted, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.symbol}</span>
                  <span style={{ marginLeft: 'auto', color: btb.text, fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
                    {totalUsd > 0 ? Math.round(((t.usdValue ?? 0) / totalUsd) * 100) : 0}%
                  </span>
                </div>
              ))}
            </div>
          </Glass>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {([['tokens', 'Tokens'], ['lps', 'LP Positions']] as const).map(([t, label]) => {
            const active = tab === t;
            return (
              <button key={t} onClick={() => setTab(t)} style={{
                height: 36, padding: '0 18px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                background: active ? btb.surfaceStrong : 'transparent',
                border: `1px solid ${active ? 'rgba(255,255,255,0.26)' : 'transparent'}`,
                color: active ? '#fff' : btb.textMuted,
              }}>{label}</button>
            );
          })}
        </div>

        {tab === 'tokens' && (
          <div onClick={() => setShowAllChains(!showAllChains)} style={{
            display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '0 4px', height: 36,
          }}>
            <span style={{ color: btb.textMuted, fontSize: 12.5, fontWeight: 600 }}>
              {loadingOtherChains ? 'Loading other chains…' : 'All chains'}
            </span>
            <div style={{
              width: 34, height: 20, borderRadius: 999, position: 'relative', flexShrink: 0,
              background: showAllChains ? btb.gradGreen : 'rgba(255,255,255,0.12)',
              transition: 'background 0.15s',
            }}>
              <div style={{
                position: 'absolute', top: 2, left: showAllChains ? 16 : 2, width: 16, height: 16, borderRadius: 999,
                background: '#fff', transition: 'left 0.15s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
              }} />
            </div>
          </div>
        )}
      </div>

      {tab === 'lps' ? (
        <LpPositions showEmpty />
      ) : (
        <div style={{ borderRadius: 16, border: btb.borderSoft, background: btb.surfaceSoft, overflow: 'hidden' }}>
          <DataTable
            columns={columns}
            rows={tokensWithBalance}
            rowKey={t => t.address + t.symbol + (t.chainId ?? '')}
            loading={loading}
            emptyMessage={error ? `Failed to load: ${error}` : 'No tokens found'}
            defaultSortKey="value"
          />
        </div>
      )}

      {lpToken && <TokenLpPicker token={lpToken} onClose={() => setLpToken(null)} />}
    </div>
  );
}
