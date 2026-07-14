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
import { useYearnVaults, useYearnPositions, type YearnPosition } from '../../lib/yearn';
import { useSidebar } from '../../lib/SidebarContext';

function fmt(n: number, dp = 2) {
  return n.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

function fmtBal(n: number) {
  return n >= 1000 ? fmt(n, 2) : n >= 0.01 ? fmt(n, 4) : n > 0 ? n.toExponential(2) : '0';
}

function shortAddress(address: string) {
  return address.startsWith('0x') && address.length > 12
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : address;
}

function fmtCompactUsd(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 2,
  }).format(value);
}

const TOKEN_EXPLORER: Record<number, string> = {
  1: 'https://etherscan.io/token/',
  10: 'https://optimistic.etherscan.io/token/',
  56: 'https://bscscan.com/token/',
  130: 'https://uniscan.xyz/token/',
  137: 'https://polygonscan.com/token/',
  146: 'https://sonicscan.org/token/',
  2020: 'https://app.roninchain.com/token/',
  4663: 'https://robinhoodchain.blockscout.com/token/',
  324: 'https://era.zksync.network/address/',
  42161: 'https://arbiscan.io/token/',
  43114: 'https://snowtrace.io/token/',
  534352: 'https://scrollscan.com/token/',
  59144: 'https://lineascan.build/token/',
  80094: 'https://berascan.com/token/',
  81457: 'https://blastscan.io/token/',
  8453: 'https://basescan.org/token/',
  999: 'https://hyperevmscan.io/token/',
};

function isNativeAddress(address: string) {
  const normalized = address.toLowerCase();
  return normalized === 'eth'
    || normalized === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
    || normalized === '0x0000000000000000000000000000000000000000';
}

export function PortfolioScreen({ onSend, onSwap, onOpenEarn }: { onSend?: (token: Token) => void; onSwap?: (token: Token) => void; onOpenEarn?: () => void } = {}) {
  const { walletAddress, positions, loadingBalances, loadingList, error, refetchBalances, loadingOtherChains } = useTokenStore();
  const [tab, setTab] = useState<'tokens' | 'lps' | 'earn'>('tokens');
  const [lpToken, setLpToken] = useState<Token | null>(null);
  const [showHiddenAssets, setShowHiddenAssets] = useState(false);
  const [tokenSearch, setTokenSearch] = useState('');
  const allTokensWithBalance = [...positions]
    .filter(t => parseFloat(t.balance ?? '0') > 0)
    .sort((a, b) => {
      const trustedA = a.suspiciousQuote ? 0 : 1;
      const trustedB = b.suspiciousQuote ? 0 : 1;
      return trustedB - trustedA || (b.usdValue ?? 0) - (a.usdValue ?? 0);
    });
  const hiddenAssetCount = allTokensWithBalance.filter(t => (t.usdValue ?? 0) < 1 || t.suspiciousQuote).length;
  const visibleByValue = showHiddenAssets
    ? allTokensWithBalance
    : allTokensWithBalance.filter(t => (t.usdValue ?? 0) >= 1 && !t.suspiciousQuote);
  const search = tokenSearch.trim().toLowerCase();
  const tokensWithBalance = search
    ? allTokensWithBalance.filter(t => {
        const chainName = CHAIN_META[t.chainId ?? 1]?.name ?? t.chainSlug ?? '';
        return t.symbol.toLowerCase().includes(search)
          || t.name.toLowerCase().includes(search)
          || t.address.toLowerCase().includes(search)
          || chainName.toLowerCase().includes(search);
      })
    : visibleByValue;
  const loading = (loadingBalances || loadingList || loadingOtherChains) && tokensWithBalance.length === 0;
  const refreshing = loadingBalances && tokensWithBalance.length > 0;
  const { isMobile } = useSidebar();

  // Yearn vault/staking positions from the Earn tab count toward net worth too
  const { vaults } = useYearnVaults();
  const { positions: earnPositions, loading: loadingEarn } = useYearnPositions(walletAddress, vaults);
  const earnUsd = earnPositions.reduce((s, p) => s + p.usd, 0);
  const trustedTokens = allTokensWithBalance.filter(t => !t.suspiciousQuote);
  const totalUsd = trustedTokens.reduce((s, t) => s + (t.usdValue ?? 0), 0) + earnUsd;

  const COLORS = ['#FFFFFF', '#FFB36B', '#52E3A4', '#94A3B8'];
  const top4 = trustedTokens.slice(0, 4);

  const allTokenColumns: Column<Token>[] = [
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
            <div style={{ color: btb.textMuted, fontSize: 11.5 }}>
              {t.chainId && CHAIN_META[t.chainId] ? CHAIN_META[t.chainId].name : t.chainSlug || 'Ethereum'}
              {' · '}
              {isNativeAddress(t.address) ? (
                <span style={{ color: btb.textDim }}>Native token</span>
              ) : TOKEN_EXPLORER[t.chainId ?? 1] ? (
                <a
                  href={`${TOKEN_EXPLORER[t.chainId ?? 1]}${t.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`Open contract ${t.address}`}
                  onClick={(event) => event.stopPropagation()}
                  style={{ color: btb.textDim, textDecoration: 'none' }}
                >{shortAddress(t.address)} ↗</a>
              ) : <span title={t.address} style={{ color: btb.textDim }}>{shortAddress(t.address)}</span>}
            </div>
            {t.suspiciousQuote && <div style={{ color: btb.amber, fontSize: 9.5, fontWeight: 700, marginTop: 1 }}>UNVERIFIED QUOTE · CHECK CONTRACT</div>}
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
      key: 'value', label: 'Value', align: 'right', sortable: true, sortValue: t => t.suspiciousQuote ? 0 : t.usdValue ?? 0,
      render: t => t.suspiciousQuote
        ? <div title="Shown for reference, but excluded from net worth because the quote has no confirmed market price or timestamp." style={{ textAlign: 'right' }}>
            <div style={{ color: btb.text, fontSize: 12, fontWeight: 700 }}>~{fmtCompactUsd(t.usdValue ?? 0)}</div>
            <div style={{ color: btb.textDim, fontSize: 9.5, marginTop: 1 }}>Estimate</div>
          </div>
        : <span style={{ fontWeight: 700 }}>${fmt(t.usdValue ?? 0)}</span>,
    },
    {
      key: 'actions', label: '', align: 'right', width: isMobile ? '124px' : '220px',
      render: t => {
        // Wallet actions all run on Ethereum mainnet only (wagmi is pinned to
        // chain 1) — showing live Send/Swap/LP buttons for another chain's
        // token would submit a broken/misdirected transaction.
        const isMainnet = (t.chainId ?? 1) === 1;
        if (!isMainnet) {
          return <span style={{ color: btb.textDim, fontSize: 11.5 }}>View only</span>;
        }
        if (isMobile) {
          // icon-only so the table fits a phone without sideways scrolling
          return (
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              <Button variant="ghost" size="sm" title="Send" onClick={() => onSend?.(t)}
                style={{ height: 32, width: 34, padding: 0, border: btb.borderSoft, background: 'rgba(255,255,255,0.07)', color: btb.text }}>
                <Icon name="send" size={13} />
              </Button>
              <Button size="sm" title="Swap" onClick={() => onSwap?.(t)}
                style={{ height: 32, width: 34, padding: 0, background: 'linear-gradient(135deg,rgba(255,255,255,0.15),rgba(255,255,255,0.07))', color: btb.text, boxShadow: 'none' }}>
                <Icon name="swap" size={13} />
              </Button>
              <Button variant="success" size="sm" title="Add LP" onClick={() => setLpToken(t)}
                style={{ height: 32, width: 34, padding: 0, boxShadow: 'none' }}>
                <Icon name="plus" size={13} />
              </Button>
            </div>
          );
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
  const columns = allTokenColumns.filter(c => !isMobile || c.key !== 'balance');

  const allEarnColumns: Column<YearnPosition>[] = [
    {
      key: 'vault', label: 'Vault', sortable: true, sortValue: p => p.vault.name,
      render: p => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <TokenIcon symbol={p.vault.token.symbol} size={30} logoUrl={p.vault.token.icon} />
          <div>
            <div style={{ fontWeight: 700 }}>{p.vault.name}</div>
            <div style={{ color: btb.textMuted, fontSize: 11.5 }}>
              Yearn · {p.vault.token.symbol}
              {p.stakedShares > 0n && <span style={{ color: '#A78BFA' }}> · staked</span>}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'apy', label: 'APY', align: 'right', sortable: true, sortValue: p => p.vault.apy ?? 0,
      render: p => <span style={{ color: '#52E3A4', fontWeight: 700 }}>{p.vault.apy == null ? '—' : `${(p.vault.apy * 100).toFixed(2)}%`}</span>,
    },
    {
      key: 'balance', label: 'Deposited', align: 'right', sortable: true, sortValue: p => p.underlying,
      render: p => <span>{fmtBal(p.underlying)} {p.vault.token.symbol}</span>,
    },
    {
      key: 'value', label: 'Value', align: 'right', sortable: true, sortValue: p => p.usd,
      render: p => <span style={{ fontWeight: 700 }}>${fmt(p.usd)}</span>,
    },
  ];
  const earnColumns = allEarnColumns.filter(c => !isMobile || c.key !== 'balance');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <Glass padding={20} radius={18} strong style={{ flex: 1, minWidth: 260, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ color: btb.textMuted, fontSize: 12, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase' }}>Net worth</div>
            <div style={{ color: btb.text, fontSize: 30, fontWeight: 800, letterSpacing: -0.6, marginTop: 4 }}>${fmt(totalUsd)}</div>
            <div style={{ color: btb.textMuted, fontSize: 12, marginTop: 4 }}>
              {allTokensWithBalance.length} tokens{allTokensWithBalance.length > trustedTokens.length && ` · ${allTokensWithBalance.length - trustedTokens.length} quotes excluded from net worth`}{earnUsd > 0 && ` · $${fmt(earnUsd)} earning in Yearn`}
            </div>
          </div>
          <Glass padding={0} radius={999} style={{ width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: refreshing ? 'default' : 'pointer' }} onClick={() => { if (!refreshing) refetchBalances(); }}>
            <div className={refreshing ? 'spin' : undefined} style={refreshing ? { width: 16, height: 16 } : undefined}>
              <Icon name="refresh" size={16} />
            </div>
          </Glass>
        </Glass>

        {top4.length > 0 && (
          <Glass padding={20} radius={18} style={{ flex: 1, minWidth: 240 }}>
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

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: isMobile ? 4 : 8, minWidth: 0 }}>
          {([['tokens', 'Tokens'], ['lps', isMobile ? 'LPs' : 'LP Positions'], ['earn', earnPositions.length > 0 ? `Earn (${earnPositions.length})` : 'Earn']] as const).map(([t, label]) => {
            const active = tab === t;
            return (
              <button key={t} onClick={() => setTab(t)} style={{
                height: isMobile ? 32 : 36, padding: isMobile ? '0 12px' : '0 18px', borderRadius: 10,
                cursor: 'pointer', fontFamily: 'inherit', fontSize: isMobile ? 12.5 : 13, fontWeight: 700, whiteSpace: 'nowrap',
                background: active ? btb.surfaceStrong : 'transparent',
                border: `1px solid ${active ? 'rgba(255,255,255,0.26)' : 'transparent'}`,
                color: active ? '#fff' : btb.textMuted,
              }}>{label}</button>
            );
          })}
        </div>

        {tab === 'tokens' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {loadingOtherChains && <span style={{ color: btb.textDim, fontSize: 11.5 }}>Loading chains…</span>}
            <input
              value={tokenSearch}
              onChange={event => setTokenSearch(event.target.value)}
              placeholder="Search token or contract"
              aria-label="Search token or contract"
              style={{ width: isMobile ? 154 : 210, height: isMobile ? 30 : 32, boxSizing: 'border-box', borderRadius: 9, border: btb.borderSoft, background: 'rgba(255,255,255,0.055)', color: btb.text, padding: '0 10px', outline: 'none', fontFamily: 'inherit', fontSize: 11.5 }}
            />
            {hiddenAssetCount > 0 && (
              <button onClick={() => setShowHiddenAssets(value => !value)} style={{ height: isMobile ? 30 : 32, padding: '0 11px', borderRadius: 9, border: btb.borderSoft, background: showHiddenAssets ? 'rgba(255,255,255,0.1)' : 'transparent', color: showHiddenAssets ? btb.text : btb.textMuted, fontFamily: 'inherit', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {showHiddenAssets ? 'Hide risky & low value' : `Show hidden (${hiddenAssetCount})`}
              </button>
            )}
          </div>
        )}
      </div>

      {tab === 'lps' ? (
        <LpPositions showEmpty />
      ) : tab === 'earn' ? (
        <div style={{ borderRadius: 16, border: btb.borderSoft, background: btb.surfaceSoft, overflow: 'hidden' }}>
          <DataTable
            columns={earnColumns}
            rows={earnPositions}
            rowKey={p => p.vault.address}
            loading={loadingEarn && earnPositions.length === 0}
            emptyMessage={walletAddress ? 'No Yearn positions yet. Open the Earn tab to deposit.' : 'Connect a wallet to see Earn positions'}
            defaultSortKey="value"
            onRowClick={onOpenEarn ? () => onOpenEarn() : undefined}
          />
        </div>
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
