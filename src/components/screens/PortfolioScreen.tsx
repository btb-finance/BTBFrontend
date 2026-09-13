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
import { LpPositions, LpSummary } from '../LpPositions';
import { StudioPositions } from '../StudioPositions';
import { TokenLpPicker } from '../TokenLpPicker';
import { KYBER_CHAINS } from '../../lib/kyberswap';
import { CHAIN_DATA_NETWORKS } from '../../lib/chainDataNetworks';
import { isLpChain } from '../../protocols/lpChains';
import { useSidebar } from '../../lib/SidebarContext';
import { ChainLogo } from '../ChainLogo';

function fmt(n: number, dp = 2) {
  return n.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

function fmtBal(n: number) {
  // Tiny balances stay readable as plain decimals instead of 8.75e-4.
  return n >= 1000 ? fmt(n, 2) : n >= 0.01 ? fmt(n, 4) : n > 0 ? n.toLocaleString('en-US', { maximumSignificantDigits: 3, maximumFractionDigits: 8 }) : '0';
}

function shortAddress(address: string) {
  return address.startsWith('0x') && address.length > 12
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : address;
}

function fmtPrice(n: number) {
  if (n >= 1000) return fmt(n, 2);
  if (n >= 1) return fmt(n, 2);
  if (n >= 0.01) return fmt(n, 4);
  return n > 0 ? n.toPrecision(3) : '0';
}

function fmtSignedPct(n: number) {
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

/** 24h change pill: green up, red down, muted when unknown. */
function ChangePill({ pct, size = 11 }: { pct?: number; size?: number }) {
  if (pct == null || !Number.isFinite(pct)) return null;
  const up = pct >= 0;
  return (
    <span style={{
      display: 'inline-block', padding: '1px 6px', borderRadius: 6, fontSize: size, fontWeight: 700, whiteSpace: 'nowrap',
      color: up ? btb.green : btb.loss, background: up ? 'rgba(82,227,164,0.12)' : 'rgba(255,107,122,0.12)',
    }}>{fmtSignedPct(pct)}</span>
  );
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

export function PortfolioScreen({ onSend, onSwap, onSimulate }: { onSend?: () => void; onSwap?: (token: Token) => void; onSimulate?: (token: Token) => void } = {}) {
  const { walletAddress, positions, loadingBalances, loadingList, error, refetchBalances, loadingOtherChains } = useTokenStore();
  const [tab, setTab] = useState<'tokens' | 'lps'>('tokens');
  const [lpToken, setLpToken] = useState<Token | null>(null);
  const [showHiddenAssets, setShowHiddenAssets] = useState(false);
  const [tokenSearch, setTokenSearch] = useState('');
  const [lp, setLp] = useState<LpSummary>({ valueUsd: 0, feesUsd: 0, count: 0, inRange: 0, loading: false });
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

  const trustedTokens = allTokensWithBalance.filter(t => !t.suspiciousQuote);
  const tokensUsd = trustedTokens.reduce((s, t) => s + (t.usdValue ?? 0), 0);
  // Net worth is wallet tokens plus what sits inside LP positions plus the
  // fees those positions have earned but not yet paid out.
  const totalUsd = tokensUsd + lp.valueUsd + lp.feesUsd;
  // 24h move of the token side only (LP value has no price history here).
  const change1dUsd = trustedTokens.reduce((s, t) => s + (t.change1d ?? 0), 0);
  const change1dPct = tokensUsd - change1dUsd > 0 ? (change1dUsd / (tokensUsd - change1dUsd)) * 100 : 0;
  const hasChange = trustedTokens.some(t => t.change1d != null);

  // Allocation bar: top four holdings, everything else grouped.
  const COLORS = ['#FFFFFF', '#FFB36B', '#52E3A4', '#94A3B8', 'rgba(var(--fg-rgb), 0.28)'];
  const top4 = trustedTokens.slice(0, 4);
  const restUsd = tokensUsd - top4.reduce((s, t) => s + (t.usdValue ?? 0), 0);
  const allocation = [
    ...top4.map((t, i) => ({ key: t.address + t.symbol + (t.chainId ?? ''), label: t.symbol, value: t.usdValue ?? 0, color: COLORS[i] })),
    ...(restUsd > 0.005 ? [{ key: 'rest', label: `${trustedTokens.length - top4.length} more`, value: restUsd, color: COLORS[4] }] : []),
  ];

  const canSwapToken = (t: Token) => !!KYBER_CHAINS[t.chainId ?? 1];
  const canSimulateToken = (t: Token) => !!CHAIN_DATA_NETWORKS[t.chainId ?? 1];
  const openLpFor = (t: Token) => (isLpChain(t.chainId ?? 1) ? setLpToken(t) : onSimulate?.(t));
  const chainNameOf = (t: Token) => CHAIN_META[t.chainId ?? 1]?.name ?? t.chainSlug ?? 'Ethereum';

  const AssetCell = ({ t }: { t: Token }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <TokenIcon symbol={t.symbol} size={34} logoUrl={t.logoURI} />
        <span title={chainNameOf(t)} style={{ position: 'absolute', right: -4, bottom: -3, display: 'inline-flex', borderRadius: 999, background: btb.bg, padding: 1.5 }}>
          <ChainLogo chainId={t.chainId ?? 1} size={14}/>
        </span>
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontWeight: 800, fontSize: 14 }}>{t.symbol}</span>
          {isMobile && <ChangePill pct={t.changePct1d} size={10}/>}
        </div>
        <div style={{ color: btb.textMuted, fontSize: 11.5, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {isMobile ? (
            <>{fmtBal(parseFloat(t.balance ?? '0'))} {t.symbol} <span style={{ color: btb.textDim }}>on {chainNameOf(t)}</span></>
          ) : isNativeAddress(t.address) ? (
            <>{t.name} <span style={{ color: btb.textDim }}>on {chainNameOf(t)}</span></>
          ) : TOKEN_EXPLORER[t.chainId ?? 1] ? (
            <>
              {t.name}{' '}
              <a href={`${TOKEN_EXPLORER[t.chainId ?? 1]}${t.address}`} target="_blank" rel="noopener noreferrer" title={`Open contract ${t.address}`}
                onClick={(event) => event.stopPropagation()} style={{ color: btb.textDim, textDecoration: 'none' }}>{shortAddress(t.address)}</a>
            </>
          ) : <span title={t.address}>{t.name} <span style={{ color: btb.textDim }}>{shortAddress(t.address)}</span></span>}
        </div>
        {t.suspiciousQuote && <div style={{ color: btb.amber, fontSize: 9.5, fontWeight: 700, marginTop: 2 }}>UNVERIFIED QUOTE · CHECK CONTRACT</div>}
      </div>
    </div>
  );

  const ValueCell = ({ t }: { t: Token }) => t.suspiciousQuote
    ? <div title="Shown for reference, but excluded from net worth because the quote has no confirmed market price or timestamp." style={{ textAlign: 'right' }}>
        <div style={{ color: btb.text, fontSize: 12, fontWeight: 700 }}>~{fmtCompactUsd(t.usdValue ?? 0)}</div>
        <div style={{ color: btb.textDim, fontSize: 9.5, marginTop: 1 }}>Estimate</div>
      </div>
    : <div style={{ textAlign: 'right' }}>
        <div style={{ fontWeight: 800, fontSize: 14 }}>${fmt(t.usdValue ?? 0)}</div>
        {isMobile && t.usdPrice != null && <div style={{ color: btb.textDim, fontSize: 11, marginTop: 1 }}>${fmtPrice(t.usdPrice)}</div>}
      </div>;

  const Actions = ({ t }: { t: Token }) => {
    // Every token gets the three LP moves. Swap runs through KyberSwap on
    // the token's own chain; Simulate opens the finder for that chain with
    // the token preselected; LP uses the mainnet pool picker on Ethereum
    // and the finder (which can deploy on Aerodrome/Base) elsewhere.
    const canSwap = canSwapToken(t);
    const canSimulate = canSimulateToken(t);
    if (!canSwap && !canSimulate) return <span style={{ color: btb.textDim, fontSize: 11.5 }}>View only</span>;
    const h = isMobile ? 34 : 32;
    return (
      <div style={{ display: 'flex', gap: 6, justifyContent: isMobile ? 'stretch' : 'flex-end' }} onClick={e => e.stopPropagation()}>
        {canSwap && (
          <Button size="sm" fullWidth={isMobile} onClick={() => onSwap?.(t)}
            style={{ height: h, gap: 5, fontSize: 12, background: 'linear-gradient(135deg,rgba(var(--fg-rgb), 0.15),rgba(var(--fg-rgb), 0.07))', color: btb.text, boxShadow: 'none', borderRadius: 10 }}>
            <Icon name="swap" size={12} /> Swap
          </Button>
        )}
        {canSimulate && (
          <Button variant="ghost" size="sm" fullWidth={isMobile} onClick={() => onSimulate?.(t)}
            style={{ height: h, gap: 5, fontSize: 12, border: btb.borderSoft, background: 'rgba(var(--fg-rgb), 0.07)', color: btb.text, borderRadius: 10 }}>
            <Icon name="chart" size={12} /> Simulate
          </Button>
        )}
        {canSimulate && (
          <Button variant="success" size="sm" fullWidth={isMobile} onClick={() => openLpFor(t)}
            style={{ height: h, gap: 5, fontSize: 12, boxShadow: 'none', borderRadius: 10 }}>
            <Icon name="plus" size={12} /> LP
          </Button>
        )}
      </div>
    );
  };

  const columns: Column<Token>[] = [
    { key: 'symbol', label: 'Asset', sortable: true, sortValue: t => t.symbol, render: t => <AssetCell t={t}/> },
    {
      key: 'price', label: 'Price / 24h', align: 'right', sortable: true, sortValue: t => t.changePct1d ?? -Infinity,
      render: t => t.usdPrice != null
        ? <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 600 }}>${fmtPrice(t.usdPrice)}</div>
            <div style={{ marginTop: 2 }}><ChangePill pct={t.changePct1d}/></div>
          </div>
        : <span style={{ color: btb.textDim }}>No price</span>,
    },
    {
      key: 'balance', label: 'Balance', align: 'right', sortable: true, sortValue: t => parseFloat(t.balance ?? '0'),
      render: t => <span style={{ color: btb.textMuted, fontWeight: 600 }}>{fmtBal(parseFloat(t.balance ?? '0'))}</span>,
    },
    { key: 'value', label: 'Value', align: 'right', sortable: true, sortValue: t => t.suspiciousQuote ? 0 : t.usdValue ?? 0, render: t => <ValueCell t={t}/> },
    { key: 'actions', label: '', align: 'right', width: '250px', render: t => <Actions t={t}/> },
  ];

  const statTiles = [
    { label: 'Tokens', value: String(allTokensWithBalance.length), color: btb.text, go: 'tokens' as const, active: tab === 'tokens' },
    { label: 'LP positions', value: lp.loading && lp.count === 0 ? '…' : String(lp.count), color: btb.text, go: 'lps' as const, active: tab === 'lps' },
    { label: 'In range', value: lp.count > 0 ? `${lp.inRange} / ${lp.count}` : '0', color: lp.count > 0 && lp.inRange < lp.count ? btb.amber : btb.text, go: 'lps' as const, active: false },
    { label: 'Unclaimed fees', value: fmtCompactUsd(lp.feesUsd), color: lp.feesUsd > 0 ? btb.green : btb.text, go: 'lps' as const, active: false },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Glass padding={isMobile ? 16 : 22} radius={20} strong>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: btb.textMuted, fontSize: 12, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase' }}>Net worth</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
              <div style={{ color: btb.text, fontSize: isMobile ? 'clamp(26px, 8vw, 34px)' : 38, fontWeight: 800, letterSpacing: -1, lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>${fmt(totalUsd)}</div>
              {hasChange && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ChangePill pct={change1dPct} size={12}/>
                  <span style={{ color: change1dUsd >= 0 ? btb.green : btb.loss, fontSize: 12.5, fontWeight: 700 }}>{change1dUsd >= 0 ? '+' : '-'}${fmt(Math.abs(change1dUsd))}</span>
                  <span style={{ color: btb.textDim, fontSize: 11.5 }}>24h</span>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', marginTop: 10, fontSize: 12 }}>
              {([
                { label: 'Tokens', value: tokensUsd, dot: '#FFFFFF', color: btb.text },
                { label: 'LP positions', value: lp.valueUsd, dot: '#94A3B8', color: btb.text },
                { label: 'Unclaimed fees', value: lp.feesUsd, dot: btb.green, color: btb.green },
              ] as const).map(b => (
                <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 7, height: 7, borderRadius: 4, background: b.dot, flexShrink: 0 }}/>
                  <span style={{ color: btb.textMuted }}>{b.label}</span>
                  <span style={{ color: b.color, fontWeight: 700 }}>${fmt(b.value)}</span>
                </div>
              ))}
            </div>
            {allTokensWithBalance.length > trustedTokens.length && (
              <div style={{ color: btb.textDim, fontSize: 11.5, marginTop: 6 }}>
                {allTokensWithBalance.length - trustedTokens.length} unverified quotes excluded from net worth
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {onSend && (
              <Button variant="ghost" size="sm" fullWidth={false} onClick={onSend} title="Send tokens from this wallet"
                style={{ height: 36, width: isMobile ? 36 : undefined, padding: isMobile ? 0 : undefined, gap: 5, fontSize: 12, border: btb.borderSoft, background: 'rgba(var(--fg-rgb), 0.07)', color: btb.text, borderRadius: 999 }}>
                <Icon name="send" size={12} />{!isMobile && ' Send'}
              </Button>
            )}
            <Glass padding={0} radius={999} style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: refreshing ? 'default' : 'pointer' }} onClick={() => { if (!refreshing) refetchBalances(); }}>
              <div className={refreshing ? 'spin' : undefined} style={refreshing ? { width: 16, height: 16 } : undefined}>
                <Icon name="refresh" size={16} />
              </div>
            </Glass>
          </div>
        </div>

        {allocation.length > 0 && tokensUsd > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', height: 8, borderRadius: 999, overflow: 'hidden', gap: 2 }}>
              {allocation.map(a => (
                <div key={a.key} title={`${a.label} ${Math.round((a.value / tokensUsd) * 100)}%`} style={{ width: `${(a.value / tokensUsd) * 100}%`, background: a.color, minWidth: a.value > 0 ? 2 : 0 }}/>
              ))}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', marginTop: 8 }}>
              {allocation.map(a => (
                <div key={a.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5 }}>
                  <span style={{ width: 7, height: 7, borderRadius: 4, background: a.color, flexShrink: 0 }}/>
                  <span style={{ color: btb.textMuted }}>{a.label}</span>
                  <span style={{ color: btb.text, fontWeight: 700 }}>{Math.round((a.value / tokensUsd) * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Glass>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))', gap: isMobile ? 8 : 10 }}>
        {statTiles.map(s => (
          <button key={s.label} onClick={() => setTab(s.go)} style={{
            textAlign: 'left', padding: isMobile ? '10px 12px' : '12px 14px', borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit', minWidth: 0,
            background: s.active ? btb.surfaceStrong : btb.surfaceSoft,
            border: `1px solid ${s.active ? 'rgba(var(--fg-rgb), 0.22)' : 'rgba(var(--fg-rgb), 0.07)'}`,
          }}>
            <div style={{ color: btb.textMuted, fontSize: isMobile ? 10 : 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.label}</div>
            <div style={{ color: s.color, fontSize: isMobile ? 17 : 20, fontWeight: 800, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.value}</div>
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4, padding: 3, borderRadius: 12, background: btb.surfaceSoft, border: btb.borderSoft }}>
          {([['tokens', 'Tokens'], ['lps', isMobile ? 'LPs' : 'LP Positions']] as const).map(([t, label]) => {
            const active = tab === t;
            return (
              <button key={t} onClick={() => setTab(t)} style={{
                height: isMobile ? 30 : 32, padding: isMobile ? '0 12px' : '0 16px', borderRadius: 9,
                cursor: 'pointer', fontFamily: 'inherit', fontSize: isMobile ? 12.5 : 13, fontWeight: 700, whiteSpace: 'nowrap',
                background: active ? 'rgba(var(--fg-rgb), 0.12)' : 'transparent', border: 'none',
                color: active ? btb.text : btb.textMuted,
              }}>{label}</button>
            );
          })}
        </div>

        {tab === 'tokens' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: isMobile ? 1 : undefined, minWidth: 0 }}>
            {loadingOtherChains && !isMobile && <span style={{ color: btb.textDim, fontSize: 11.5 }}>Loading chains…</span>}
            <input
              value={tokenSearch}
              onChange={event => setTokenSearch(event.target.value)}
              placeholder="Search token or contract"
              aria-label="Search token or contract"
              style={{ flex: isMobile ? 1 : undefined, width: isMobile ? undefined : 210, minWidth: 0, height: isMobile ? 34 : 36, boxSizing: 'border-box', borderRadius: 10, border: btb.borderSoft, background: 'rgba(var(--fg-rgb), 0.055)', color: btb.text, padding: '0 10px', outline: 'none', fontFamily: 'inherit', fontSize: 12 }}
            />
            {hiddenAssetCount > 0 && (
              <button onClick={() => setShowHiddenAssets(value => !value)} style={{ height: isMobile ? 34 : 36, padding: '0 11px', borderRadius: 10, border: btb.borderSoft, background: showHiddenAssets ? 'rgba(var(--fg-rgb), 0.1)' : 'transparent', color: showHiddenAssets ? btb.text : btb.textMuted, fontFamily: 'inherit', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {showHiddenAssets ? 'Hide risky' : `Hidden (${hiddenAssetCount})`}
              </button>
            )}
          </div>
        )}
      </div>

      {/* The LP tab stays mounted while hidden so its live totals keep
          feeding net worth and the stat tiles without a refetch on switch. */}
      <div style={{ display: tab === 'lps' ? 'flex' : 'none', flexDirection: 'column', gap: 16 }}>
        <StudioPositions />
        <LpPositions showEmpty onSummary={setLp} />
      </div>
      {tab === 'tokens' && (isMobile ? (
        // Phone: one card per token. A table can't fit balance, price and
        // three actions in 360px, so each row stacks them.
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {loading && <div style={{ color: btb.textDim, fontSize: 13, textAlign: 'center', padding: 28 }}>Loading balances…</div>}
          {!loading && tokensWithBalance.length === 0 && (
            <div style={{ color: btb.textMuted, fontSize: 13.5, textAlign: 'center', padding: 28 }}>{error ? `Failed to load: ${error}` : 'No tokens found'}</div>
          )}
          {tokensWithBalance.map(t => (
            <div key={t.address + t.symbol + (t.chainId ?? '')} style={{ padding: 12, borderRadius: 16, border: btb.borderSoft, background: btb.surfaceSoft }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <AssetCell t={t}/>
                <ValueCell t={t}/>
              </div>
              {(canSwapToken(t) || canSimulateToken(t)) && <div style={{ marginTop: 10 }}><Actions t={t}/></div>}
            </div>
          ))}
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
      ))}

      {lpToken && <TokenLpPicker token={lpToken} onClose={() => setLpToken(null)} />}

    </div>
  );
}
