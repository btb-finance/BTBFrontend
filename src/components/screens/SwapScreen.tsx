'use client';
import { useXpToast } from '../../lib/XpToast';
import { useState, useEffect, useRef } from 'react';
import { useConnection, useConfig } from 'wagmi';
import { getPublicClient } from 'wagmi/actions';
import { useMutation } from 'convex/react';
import { erc20Abi, encodeFunctionData, formatUnits, isAddress, isHex, parseUnits } from 'viem';
import { useTx } from '@/lib/TxTracker';
import { runCalls, type Call } from '@/lib/txRunner';
import { Glass } from '../Glass';
import { Button } from '../Button';
import { Icon } from '../Icon';
import { Portal } from '../Portal';
import { TokenIcon } from '../TokenIcon';
import { btb } from '../design-tokens';
import { useSidebar } from '../../lib/SidebarContext';
import { Screen } from '../Screen';
import { Badge } from '../Badge';
import { ChainLogo } from '../ChainLogo';
import { useTokenStore, Token } from '../../lib/TokenStore';
import { BTB_SWAP_FEE_PERCENT, buildKyberTx, getKyberQuote, KYBER_CHAINS, type KyberQuote } from '../../lib/kyberswap';
import { CHAIN_META, SUPPORTED_CHAINS, type SupportedChainId } from '../../lib/wagmi';
import { api } from '../../../convex/_generated/api';
import { useChainTheme } from '../../lib/ChainThemeContext';

const SWAP_XP = 100;
const NATIVE_ADDRESSES = new Set([
  'eth',
  '0x0000000000000000000000000000000000000000',
  '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
]);

function isNativeToken(address: string) {
  return NATIVE_ADDRESSES.has(address.toLowerCase());
}

// ─── helpers ─────────────────────────────────────────────────────────────────

type ChainOption = { id: number; name: string };

const CHAIN_PRIORITY = [1, 8453, 56, 4663, 42161, 10, 137];
function rank(id: number): number {
  const i = CHAIN_PRIORITY.indexOf(id);
  return i === -1 ? CHAIN_PRIORITY.length : i;
}

export function ChainSelect({ chains, value, onChange, disabledId, small = false, ariaLabel }: {
  chains: readonly ChainOption[];
  value: number;
  onChange: (chainId: number) => void;
  disabledId?: number;
  small?: boolean;
  ariaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const selected = chains.find(chain => chain.id === value) ?? chains[0];

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: MouseEvent) => {
      const t = event.target as Node;
      if (!rootRef.current?.contains(t) && !listRef.current?.contains(t)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  if (!selected) return null;

  // The LP chains first, then the rest in their wagmi order, so the four
  // networks the app is built around never hide behind a scroll.
  const ordered = [...chains].sort((a, b) => rank(a.id) - rank(b.id));
  // The card that hosts the picker clips overflow, so the list is portalled
  // to the body and pinned under the button with a fixed position.
  const [anchor, setAnchor] = useState<{ top: number; right: number } | null>(null);
  useEffect(() => {
    if (!open) return;
    const place = () => {
      const r = rootRef.current?.getBoundingClientRect();
      if (r) setAnchor({ top: r.bottom + 8, right: Math.max(12, window.innerWidth - r.right) });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [open]);

  return (
    <div ref={rootRef} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        type="button"
        aria-label={ariaLabel}
        title={selected.name}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(value => !value)}
        style={{
          height: small ? 34 : 40,
          padding: small ? '0 8px 0 7px' : '0 9px 0 8px',
          borderRadius: 999,
          background: 'rgba(var(--fg-rgb), 0.05)',
          border: '1px solid rgba(var(--fg-rgb), 0.12)',
          color: btb.text,
          fontFamily: 'inherit',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        {/* Logo only: the name is in the tooltip and the list, so the Swap / Bridge switch keeps the width. */}
        <ChainLogo chainId={selected.id} size={small ? 20 : 23}/>
        <Icon name="down" size={12} color={btb.textMuted}/>
      </button>
      {open && anchor && (
        <Portal>
        <div
          ref={listRef}
          role="listbox"
          aria-label={ariaLabel}
          style={{
            position: 'fixed',
            zIndex: 450,
            top: anchor.top,
            right: anchor.right,
            width: 420,
            maxWidth: 'min(420px, calc(100vw - 40px))',
            maxHeight: 'min(70vh, 520px)',
            overflowY: 'auto',
            padding: 7,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
            gap: 2,
            borderRadius: 18,
            background: 'rgba(var(--bg-rgb), .98)',
            border: '1px solid rgba(var(--fg-rgb), .13)',
            boxShadow: '0 18px 50px rgba(0,0,0,.5)',
            backdropFilter: 'blur(18px)',
            WebkitBackdropFilter: 'blur(18px)',
          }}
        >
          {ordered.map(chain => {
            const disabled = chain.id === disabledId;
            const active = chain.id === value;
            return (
              <button
                key={chain.id}
                type="button"
                role="option"
                aria-selected={active}
                disabled={disabled}
                onClick={() => {
                  onChange(chain.id);
                  setOpen(false);
                }}
                style={{
                  width: '100%',
                  height: 42,
                  padding: '0 9px',
                  border: 'none',
                  borderRadius: 12,
                  background: active ? 'rgba(var(--fg-rgb), .1)' : 'transparent',
                  color: disabled ? btb.textDim : btb.text,
                  opacity: disabled ? .42 : 1,
                  fontFamily: 'inherit',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <ChainLogo chainId={chain.id} size={24}/>
                <span style={{ flex: 1, textAlign: 'left', fontSize: 12.5, fontWeight: active ? 800 : 650 }}>{chain.name}</span>
                {active && <Icon name="check" size={15} color={btb.green}/>}
              </button>
            );
          })}
        </div>
        </Portal>
      )}
    </div>
  );
}

function balanceNum(t: Token): number {
  const bal = parseFloat(t.balance ?? '0');
  return !bal || !isFinite(bal) ? 0 : bal;
}

function realUsdValue(t: Token): number {
  return balanceNum(t) * (t.usdPrice ?? 0);
}

function sortedTokens(tokens: Token[]): Token[] {
  // Tokens the wallet actually holds come first (even if price hasn't loaded
  // yet), ordered by USD value then by raw balance.
  return [...tokens].sort((a, b) => {
    const ah = balanceNum(a) > 0, bh = balanceNum(b) > 0;
    if (ah && !bh) return -1;
    if (bh && !ah) return 1;
    const ua = realUsdValue(a), ub = realUsdValue(b);
    if (ua !== ub) return ub - ua;
    return balanceNum(b) - balanceNum(a);
  });
}

// ─── Token picker ─────────────────────────────────────────────────────────────

function TokenPicker({ tokens, selected, loading, onSelect, onImport, onClose, held, chainId }: {
  tokens: Token[]; selected: string; loading?: boolean; onSelect: (t: Token) => void; onImport: (address: string) => Promise<Token>; onClose: () => void;
  /** Wallet holdings across every chain. Shown first with a chain mark;
   * picking one on another chain moves the swap to that chain. */
  held?: Token[];
  chainId?: number;
}) {
  const { width: sidebarWidth } = useSidebar();
  const [q, setQ] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const ql = q.toLowerCase();
  const matches = (t: Token) => !ql
    || t.symbol.toLowerCase().includes(ql)
    || t.name.toLowerCase().includes(ql)
    || t.address.toLowerCase().includes(ql);
  const heldSorted = sortedTokens((held ?? []).filter(t => balanceNum(t) > 0)).filter(matches);
  const heldKeys = new Set(heldSorted.map(t => `${t.chainId ?? 1}:${t.address.toLowerCase()}`));
  const sorted = sortedTokens(tokens).filter(t => matches(t) && !heldKeys.has(`${t.chainId ?? chainId ?? 1}:${t.address.toLowerCase()}`));
  const filtered = [...heldSorted, ...sorted];
  const visible = ql ? sorted : sorted.slice(0, 100);
  const chainName = chainId ? CHAIN_META[chainId]?.name ?? 'this network' : 'this network';

  const row = (t: Token, showChain: boolean) => (
    <div key={`${t.chainId ?? chainId ?? 1}:${t.address}`} onClick={() => { onSelect(t); onClose(); }} style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 8px', borderRadius: 14,
      background: t.address.toLowerCase() === selected.toLowerCase() && (t.chainId ?? chainId) === chainId ? 'rgba(var(--fg-rgb), 0.08)' : 'transparent', cursor: 'pointer',
    }}>
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <TokenIcon symbol={t.symbol} size={38} logoUrl={t.logoURI}/>
        {showChain && t.chainId != null && (
          <span style={{ position: 'absolute', right: -3, bottom: -3, borderRadius: 999, background: 'var(--chain-bg)', padding: 1.5, display: 'inline-flex' }}>
            <ChainLogo chainId={t.chainId} size={15}/>
          </span>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: btb.text, fontSize: 15, fontWeight: 700 }}>{t.symbol}</div>
        <div style={{ color: btb.textMuted, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {showChain && t.chainId != null ? `${CHAIN_META[t.chainId]?.name ?? 'Chain ' + t.chainId} · ` : ''}{t.name}
        </div>
      </div>
      {(() => {
        const bal = parseFloat(t.balance ?? '0');
        if (!bal || !isFinite(bal)) return null;
        return (
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ color: btb.text, fontSize: 13, fontWeight: 600 }}>
              {bal.toLocaleString('en-US', { maximumFractionDigits: 4 })}
            </div>
            {t.usdValue != null && t.usdValue > 0 && (
              <div style={{ color: btb.textMuted, fontSize: 11 }}>${t.usdValue.toLocaleString('en-US', { maximumFractionDigits: 2 })}</div>
            )}
          </div>
        );
      })()}
    </div>
  );

  return (
    <Portal>
    <div onClick={onClose} style={{ position: 'fixed', top: 0, left: sidebarWidth, right: 0, bottom: 0, zIndex: 300, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, minWidth: 0, maxHeight: '82vh', background: 'rgba(var(--bg-rgb), 0.98)', border: '1px solid rgba(var(--fg-rgb), 0.1)', borderRadius: 28, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '12px 20px 0' }}>
            <div style={{ color: btb.text, fontSize: 18, fontWeight: 800, marginBottom: 12 }}>Select token</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(var(--fg-rgb), 0.06)', border: btb.borderSoft, borderRadius: 14, padding: '10px 14px', marginBottom: 8 }}>
            <Icon name="search" size={16} color={btb.textMuted}/>
            <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search token…"
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: btb.text, fontSize: 15, fontFamily: 'inherit' }}/>
          </div>
          {!q && <div style={{ color: btb.textDim, fontSize: 11, marginBottom: 6, paddingLeft: 4 }}>{loading ? 'Loading network tokens…' : held ? 'Your tokens on every chain first, then everything on this network' : `${tokens.length.toLocaleString()} tokens · balances shown first`}</div>}
        </div>
        <div style={{ overflowY: 'auto', padding: '0 12px 48px' }}>
          {isAddress(q.trim()) && !filtered.some(token => token.address.toLowerCase() === q.trim().toLowerCase()) && <button onClick={async () => { setImporting(true); setImportError(null); try { const token = await onImport(q.trim()); onSelect(token); onClose(); } catch (error) { setImportError((error as Error).message || 'Could not import token'); } finally { setImporting(false); } }} disabled={importing} style={{ width: '100%', minHeight: 46, margin: '4px 0 8px', borderRadius: 12, border: '1px solid rgba(var(--green-rgb), .3)', background: 'rgba(var(--green-rgb), .08)', color: btb.green, fontFamily: 'inherit', fontSize: 12, fontWeight: 800, cursor: importing ? 'wait' : 'pointer' }}>{importing ? 'Checking contract…' : `Import ${q.slice(0, 8)}…${q.slice(-6)}`}</button>}
          {importError && <div style={{ color: btb.red, fontSize: 11, padding: '0 6px 8px' }}>{importError}</div>}
          {heldSorted.length > 0 && (
            <div style={{ color: btb.textDim, fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, padding: '6px 8px 2px' }}>Your tokens</div>
          )}
          {heldSorted.map(t => row(t, true))}
          {heldSorted.length > 0 && visible.length > 0 && (
            <div style={{ color: btb.textDim, fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, padding: '10px 8px 2px' }}>All tokens on {chainName}</div>
          )}
          {visible.map(t => row(t, false))}
          {filtered.length === 0 && !loading && <div style={{ color: btb.textMuted, fontSize: 14, textAlign: 'center', padding: 24 }}>No tokens found. Paste a contract address to import one.</div>}
        </div>
      </div>
    </div>
    </Portal>
  );
}


function TokenPill({ token, onClick }: { token: Token; onClick: () => void }) {
  return (
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px 6px 6px', background: 'rgba(var(--fg-rgb), 0.1)', border: btb.border, borderRadius: 999, flexShrink: 0, cursor: 'pointer', maxWidth: 160 }}>
      <TokenIcon symbol={token.symbol} size={28} logoUrl={token.logoURI}/>
      <span style={{ color: btb.text, fontSize: 16, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{token.symbol}</span>
      <Icon name="down" size={14} color="rgba(var(--fg-rgb), 0.7)"/>
    </div>
  );
}

/** Quote details folded behind one summary line so the action button stays
 * within reach on a phone: tap the line to see fees, impact and the route. */
function QuoteDetails({ summary, children }: { summary: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Glass padding={0} radius={18} soft>
      <div onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', cursor: 'pointer', minHeight: 44 }}>
        <div style={{ flex: 1, minWidth: 0, color: btb.text, fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{summary}</div>
        <span style={{ color: btb.textMuted, fontSize: 12, flexShrink: 0 }}>{open ? 'Hide' : 'Details'}</span>
        <Icon name={open ? 'up' : 'down'} size={14} color={btb.textMuted}/>
      </div>
      {open && <div style={{ padding: '0 14px 12px', borderTop: '1px solid rgba(var(--fg-rgb), 0.07)' }}>{children}</div>}
    </Glass>
  );
}

function InfoRow({ label, value, last }: { label: string; value: React.ReactNode; last?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 4px', borderBottom: last ? 'none' : '1px solid rgba(var(--fg-rgb), 0.06)' }}>
      <span style={{ color: btb.textMuted, fontSize: 13 }}>{label}</span>
      <span style={{ color: btb.text, fontSize: 13, fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function SwapModeTabs({ mode, onSwap, onBridge }: { mode: 'swap' | 'bridge'; onSwap: () => void; onBridge: () => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', padding: 4, borderRadius: 16, background: 'rgba(var(--fg-rgb), 0.05)', border: btb.borderSoft }}>
      {([
        ['swap', 'Swap', onSwap],
        ['bridge', 'Bridge', onBridge],
      ] as const).map(([value, label, action]) => (
        <button key={value} onClick={action} style={{ height: 38, border: 'none', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 800, color: mode === value ? btb.text : btb.textMuted, background: mode === value ? 'rgba(var(--fg-rgb), 0.1)' : 'transparent', boxShadow: mode === value ? 'inset 0 1px 0 rgba(var(--fg-rgb), .1)' : 'none' }}>{label}</button>
      ))}
    </div>
  );
}

type CrossChainQuote = {
  id: string;
  tool: string;
  action: { fromChainId: number; toChainId: number };
  estimate: {
    approvalAddress: string;
    fromAmount: string;
    fromAmountUSD?: string;
    toAmount: string;
    toAmountMin: string;
    toAmountUSD?: string;
    executionDuration?: number;
    gasCosts?: Array<{ amountUSD?: string }>;
    feeCosts?: Array<{ amountUSD?: string; name?: string; description?: string; percentage?: string }>;
  };
  transactionRequest: { from: string; to: string; data: string; value: string; chainId: number; gasLimit?: string };
  includedSteps?: Array<{ tool?: string; toolDetails?: { name?: string } }>;
};

const ETH_DEFAULT:  Token = { address: 'ETH',  symbol: 'ETH',  name: 'Ethereum', decimals: 18, chainId: 1 };
const USDC_DEFAULT: Token = { address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', symbol: 'USDC', name: 'USD Coin', decimals: 6, chainId: 1 };

const DEFAULT_QUOTES: Record<number, Token> = {
  1: USDC_DEFAULT,
  56: { address: '0x55d398326f99059ff775485246999027b3197955', symbol: 'USDT', name: 'Tether USD', decimals: 18, chainId: 56 },
  137: { address: '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359', symbol: 'USDC', name: 'USD Coin', decimals: 6, chainId: 137 },
  42161: { address: '0xaf88d065e77c8cc2239327c5edb3a432268e5831', symbol: 'USDC', name: 'USD Coin', decimals: 6, chainId: 42161 },
  10: { address: '0x0b2c639c533813f4aa9d7837caf62653d097ff85', symbol: 'USDC', name: 'USD Coin', decimals: 6, chainId: 10 },
  8453: { address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', symbol: 'USDC', name: 'USD Coin', decimals: 6, chainId: 8453 },
  43114: { address: '0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e', symbol: 'USDC', name: 'USD Coin', decimals: 6, chainId: 43114 },
  59144: { address: '0x176211869ca2b568f2a7d4ee941e073a821ee1ff', symbol: 'USDC', name: 'USD Coin', decimals: 6, chainId: 59144 },
  534352: { address: '0x06efdbff2a14a7c8e15944d1f4a48f9f95f663a4', symbol: 'USDC', name: 'USD Coin', decimals: 6, chainId: 534352 },
  81457: { address: '0x4300000000000000000000000000000000000003', symbol: 'USDB', name: 'USDB', decimals: 18, chainId: 81457 },
  4663: { address: '0x5fc5360d0400a0fd4f2af552add042d716f1d168', symbol: 'USDG', name: 'Global Dollar', decimals: 6, chainId: 4663 },
};

function nativeEthForChain(chainId: number): Token {
  const meta = CHAIN_META[chainId] ?? { name: 'Native token', symbol: 'ETH' };
  return { address: 'ETH', symbol: meta.symbol, name: meta.name, decimals: 18, chainId };
}

type SwapStep = 'form' | 'confirm' | 'approving' | 'sending' | 'success' | 'error';

// ─── Main ─────────────────────────────────────────────────────────────────────

export function SwapScreen({ initialFrom, onConnectWallet }: { initialFrom?: Token; onConnectWallet?: () => void } = {}) {
  const [mode, setMode] = useState<'swap' | 'bridge'>('swap');
  return mode === 'bridge'
    ? <BridgeSwap onStandardSwap={() => setMode('swap')} onConnectWallet={onConnectWallet}/>
    : <SameChainSwap initialFrom={initialFrom} onBridge={() => setMode('bridge')} onConnectWallet={onConnectWallet}/>;
}

function SameChainSwap({ initialFrom, onConnectWallet, onBridge }: { initialFrom?: Token; onConnectWallet?: () => void; onBridge: () => void }) {
  const { tokens, positions } = useTokenStore();
  const { address, chainId: walletChainId } = useConnection();
  const config = useConfig();
  const { track } = useTx();
  const urlChain = typeof window !== 'undefined' ? Number(new URLSearchParams(window.location.search).get('chain')) : 0;
  const initialChain = Number.isFinite(urlChain) && KYBER_CHAINS[urlChain]
    ? urlChain
    : initialFrom?.chainId && KYBER_CHAINS[initialFrom.chainId]
      ? initialFrom.chainId
      : walletChainId && KYBER_CHAINS[walletChainId] ? walletChainId : 1;
  const [chainId, setChainId] = useState<number>(initialChain);
  const { setThemeChainId } = useChainTheme();
  const [customTokens, setCustomTokens] = useState<Token[]>([]);
  const [listedTokens, setListedTokens] = useState<Token[]>([]);
  const [liveBalanceTokens, setLiveBalanceTokens] = useState<Token[]>([]);
  const [loadingTokenList, setLoadingTokenList] = useState(false);
  const [balanceRefreshNonce, setBalanceRefreshNonce] = useState(0);

  const [fromToken, setFromToken] = useState<Token>(initialFrom ?? ETH_DEFAULT);
  const [toToken,   setToToken]   = useState<Token>(
    initialFrom ? DEFAULT_QUOTES[initialFrom.chainId ?? 1] ?? nativeEthForChain(initialFrom.chainId ?? 1) : USDC_DEFAULT
  );
  const [fromAmt,   setFromAmt]   = useState('');
  const [picker,    setPicker]    = useState<'from' | 'to' | null>(null);
  const [step,      setStep]      = useState<SwapStep>('form');
  const [quote,     setQuote]     = useState<KyberQuote | null>(null);
  const [quoting,   setQuoting]   = useState(false);
  const [quoteErr,  setQuoteErr]  = useState<string | null>(null);
  const [txHash,    setTxHash]    = useState<`0x${string}` | undefined>();
  const [errMsg,    setErrMsg]    = useState('');
  // Max slippage for the swap, in bps. The pill in the header cycles it.
  const [slippageBps, setSlippageBps] = useState(50);
  const [lastSwap, setLastSwap] = useState<{ amount: string; from: string; out: string; to: string } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const chainTokens = (() => {
    const merged = new Map<string, Token>();
    const add = (token: Token) => {
      if ((token.chainId ?? 1) !== chainId) return;
      const address = isNativeToken(token.address) ? 'ETH' : token.address.toLowerCase();
      const key = address.toLowerCase();
      merged.set(key, { ...merged.get(key), ...token, address, chainId });
    };
    add(nativeEthForChain(chainId));
    if (DEFAULT_QUOTES[chainId]) add(DEFAULT_QUOTES[chainId]);
    for (const token of listedTokens) add(token);
    for (const token of chainId === 1 ? tokens : positions) add(token);
    for (const token of customTokens) add(token);
    for (const token of liveBalanceTokens) add(token);
    return [...merged.values()];
  })();

  // Deep-linkable pair: /swap?from=<address|symbol>&to=<address|symbol>.
  // The query string is captured once on first render — the URL-writer effect
  // below rewrites location.search, so it can't be re-read later.
  const initialQueryRef = useRef<string | null>(null);
  if (initialQueryRef.current === null) {
    initialQueryRef.current = typeof window === 'undefined' ? '' : window.location.search;
  }

  const awardXp = useMutation(api.users.awardXp);
  const showXp = useXpToast();

  const isNativeFrom = fromToken.address === 'ETH';

  useEffect(() => {
    setThemeChainId(chainId);
  }, [chainId, setThemeChainId]);

  useEffect(() => {
    if (chainId === 1) { setListedTokens([]); setLoadingTokenList(false); return; }
    const controller = new AbortController();
    setLoadingTokenList(true);
    fetch(`/api/swap-tokens?chainId=${chainId}`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error(`Token catalog ${response.status}`);
        return response.json() as Promise<{ tokens?: Token[] }>;
      })
      .then(body => setListedTokens(Array.isArray(body.tokens) ? body.tokens : []))
      .catch(error => { if ((error as Error).name !== 'AbortError') setListedTokens([]); })
      .finally(() => { if (!controller.signal.aborted) setLoadingTokenList(false); });
    return () => controller.abort();
  }, [chainId]);

  // The token catalog contains metadata, not wallet balances. Read both assets
  // directly from the selected chain so Pay/Receive/MAX never depend on an
  // indexer's refresh cadence.
  useEffect(() => {
    if (!address) { setLiveBalanceTokens([]); return; }
    let cancelled = false;
    const client = getPublicClient(config, { chainId: chainId as SupportedChainId });
    if (!client) { setLiveBalanceTokens([]); return; }

    const read = async (token: Token): Promise<Token> => {
      const raw = isNativeToken(token.address)
        ? await client.getBalance({ address }).catch(() => 0n)
        : await client.readContract({
            address: token.address as `0x${string}`,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [address],
          }).catch(() => 0n);
      return {
        ...token,
        address: isNativeToken(token.address) ? 'ETH' : token.address.toLowerCase(),
        chainId,
        balanceRaw: raw.toString(),
        balance: formatUnits(raw, token.decimals),
        usdValue: token.usdPrice ? Number(formatUnits(raw, token.decimals)) * token.usdPrice : undefined,
      };
    };

    const refresh = () => Promise.all([read(fromToken), read(toToken)])
      .then(next => { if (!cancelled) setLiveBalanceTokens(next); });
    refresh();
    const timer = setInterval(refresh, 15_000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [address, chainId, config, fromToken.address, fromToken.decimals, toToken.address, toToken.decimals, balanceRefreshNonce]);

  // Pick the pair once when the token list first arrives: URL params win,
  // then the initialFrom prop (portfolio "Swap" buttons), then ETH → USDC.
  const defaultsAppliedRef = useRef(false);
  useEffect(() => {
    if (chainTokens.length === 0 || defaultsAppliedRef.current) return;
    defaultsAppliedRef.current = true;
    const sp = new URLSearchParams(initialQueryRef.current ?? '');
    const resolve = (q: string | null) => q
      ? chainTokens.find(t => t.address.toLowerCase() === q.toLowerCase() || t.symbol.toLowerCase() === q.toLowerCase())
      : undefined;
    const urlFrom = resolve(sp.get('from'));
    const urlTo   = resolve(sp.get('to'));
    if (urlFrom) setFromToken(urlFrom);
    if (urlTo)   setToToken(urlTo);
    if (initialFrom && !urlFrom) {
      const live = chainTokens.find(t => t.address === initialFrom.address && t.chainId === initialFrom.chainId);
      if (live) setFromToken(live);
    } else if (!initialFrom) {
      if (!urlFrom) {
        const eth = chainTokens.find(t => t.address === 'ETH');
        if (eth) setFromToken(eth);
      }
      if (!urlTo) {
        const usdc = chainTokens.find(t => t.address !== 'ETH');
        if (usdc) setToToken(usdc);
      }
    }
  }, [chainId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the URL carrying the full pair so the current swap is always
  // shareable. replaceState (not push) — token picking shouldn't pile up
  // history entries.
  useEffect(() => {
    if (typeof window === 'undefined' || window.location.pathname !== '/swap') return;
    if (!defaultsAppliedRef.current) return; // don't clobber params before they're consumed
    const next = `/swap?chain=${chainId}&from=${encodeURIComponent(fromToken.address)}&to=${encodeURIComponent(toToken.address)}`;
    if (window.location.pathname + window.location.search !== next) {
      window.history.replaceState(null, '', next);
    }
  }, [chainId, fromToken.address, toToken.address]);

  // Keep the selected from/to tokens in sync with the live store — balances
  // and prices arrive asynchronously, so the picked tokens must refresh too.
  useEffect(() => {
    if (chainTokens.length === 0) return;
    const liveFrom = chainTokens.find(t => t.address.toLowerCase() === fromToken.address.toLowerCase());
    if (liveFrom && (liveFrom.balance !== fromToken.balance || liveFrom.usdPrice !== fromToken.usdPrice)) {
      setFromToken(liveFrom);
    }
    const liveTo = chainTokens.find(t => t.address.toLowerCase() === toToken.address.toLowerCase());
    if (liveTo && (liveTo.balance !== toToken.balance || liveTo.usdPrice !== toToken.usdPrice)) {
      setToToken(liveTo);
    }
  }, [chainId, positions, tokens, listedTokens, customTokens, liveBalanceTokens, fromToken.address, toToken.address, fromToken.balance, fromToken.usdPrice, toToken.balance, toToken.usdPrice]);

  function selectChain(nextChainId: number) {
    if (!KYBER_CHAINS[nextChainId] || nextChainId === chainId) return;
    const native = nativeEthForChain(nextChainId);
    const heldToken = positions.find(token => token.chainId === nextChainId && token.address !== 'ETH');
    setChainId(nextChainId);
    setFromToken(native);
    setToToken(DEFAULT_QUOTES[nextChainId] ?? heldToken ?? native);
    setFromAmt(''); setQuote(null); setQuoteErr(null); setStep('form');
  }

  async function importToken(tokenAddress: string): Promise<Token> {
    if (!isAddress(tokenAddress)) throw new Error('Enter a valid token contract');
    const client = getPublicClient(config, { chainId: chainId as SupportedChainId });
    if (!client) throw new Error('RPC is unavailable for this chain');
    const token = tokenAddress as `0x${string}`;
    const [symbol, name, decimals, balance] = await Promise.all([
      client.readContract({ address: token, abi: erc20Abi, functionName: 'symbol' }),
      client.readContract({ address: token, abi: erc20Abi, functionName: 'name' }).catch(() => 'Imported token'),
      client.readContract({ address: token, abi: erc20Abi, functionName: 'decimals' }),
      address ? client.readContract({ address: token, abi: erc20Abi, functionName: 'balanceOf', args: [address] }).catch(() => 0n) : 0n,
    ]);
    const imported: Token = { address: tokenAddress.toLowerCase(), symbol, name, decimals, chainId, balance: formatUnits(balance, decimals), balanceRaw: balance.toString() };
    setCustomTokens(current => [...current.filter(item => item.chainId !== chainId || item.address.toLowerCase() !== imported.address), imported]);
    return imported;
  }

  // Kyber routes carry the BTB output-token fee. `silent` refreshes update the
  // numbers without flashing the loading state.
  const quoteSeq = useRef(0);
  async function fetchQuotes(silent: boolean) {
    if (!fromAmt || parseFloat(fromAmt) <= 0) return;
    const seq = ++quoteSeq.current;
    if (!silent) { setQuoting(true); setQuoteErr(null); }
    const amtIn = parseUnits(fromAmt, fromToken.decimals).toString();
    try {
      const q = await getKyberQuote(fromToken.address, toToken.address, amtIn, toToken.decimals, chainId, {
        chargeBtbFee: true,
        decimalsIn: fromToken.decimals,
      });
      if (quoteSeq.current === seq) setQuote(q);
    } catch (e) {
      if (quoteSeq.current === seq && !silent) {
        setQuoteErr((e as Error).message);
        setQuote(null);
      }
    } finally {
      if (quoteSeq.current === seq && !silent) setQuoting(false);
    }
  }

  // Debounced fetch on input changes
  // A new amount starts a new swap: drop the last result banner.
  useEffect(() => { if (fromAmt && (step === 'success' || step === 'error')) setStep('form'); }, [fromAmt]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!fromAmt || parseFloat(fromAmt) <= 0) { setQuote(null); return; }
    debounceRef.current = setTimeout(() => fetchQuotes(false), 600);
  }, [fromAmt, fromToken.address, toToken.address, chainId, address]); // eslint-disable-line react-hooks/exhaustive-deps

  // Kyber recommends refreshing routes within 5–10 seconds.
  useEffect(() => {
    if (step !== 'form' || !fromAmt || parseFloat(fromAmt) <= 0) return;
    const id = setInterval(() => fetchQuotes(true), 8_000);
    return () => clearInterval(id);
  }, [step, fromAmt, fromToken.address, toToken.address, chainId, address]); // eslint-disable-line react-hooks/exhaustive-deps

  function flip() {
    setFromToken(toToken); setToToken(fromToken);
    setFromAmt(''); setQuote(null);
  }

  function reset() {
    setStep('form'); setFromAmt(''); setQuote(null); setTxHash(undefined); setErrMsg('');
  }

  async function executeSwap() {
    if (!address || !quote) return;
    try {
      setStep('sending');
      // A user can leave the confirmation screen open. Always build from a
      // fresh fee-bearing route instead of submitting the preview route.
      const amountIn = parseUnits(fromAmt, fromToken.decimals).toString();
      const activeQuote = await getKyberQuote(fromToken.address, toToken.address, amountIn, toToken.decimals, chainId, {
        chargeBtbFee: true,
        decimalsIn: fromToken.decimals,
      });
      setQuote(activeQuote);
      const calls: Call[] = [];

      // ERC-20: approve the router first if the allowance is short. Batched with
      // the swap below so supporting wallets confirm both at once; otherwise the
      // runner approves, WAITS for it to confirm, then swaps.
      let needsApprove = false;
      if (!isNativeFrom) {
        const amountInRaw = BigInt(activeQuote.routeSummary.amountIn ?? '0');
        const client = getPublicClient(config, { chainId: chainId as SupportedChainId });
        const currentAllowance = client ? await client.readContract({
          address: fromToken.address as `0x${string}`,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [address, activeQuote.routerAddress as `0x${string}`],
        }).catch(() => 0n) : 0n;
        if (currentAllowance < amountInRaw) {
          needsApprove = true;
          calls.push({
            to: fromToken.address as `0x${string}`,
            data: encodeFunctionData({
              abi: erc20Abi,
              functionName: 'approve',
              args: [activeQuote.routerAddress as `0x${string}`, amountInRaw],
            }),
          });
        }
      }

      const tx = await buildKyberTx(activeQuote.routeSummary, activeQuote.routerAddress, address, address, slippageBps, chainId);
      const txValue = isNativeFrom
        ? BigInt(activeQuote.routeSummary.amountIn ?? '0')
        : BigInt(tx.value && tx.value !== '0' ? tx.value : '0');
      calls.push({
        to: tx.to as `0x${string}`,
        data: tx.data as `0x${string}`,
        value: txValue,
        gas: tx.gas ? BigInt(tx.gas) : undefined,
      });

      setStep(needsApprove ? 'approving' : 'sending');
      const { lastHash } = await runCalls(config, {
        account: address,
        calls,
        label: `Swap ${fromToken.symbol} to ${toToken.symbol}`,
        track, chainId,
      });

      if (lastHash) setTxHash(lastHash);
      setLastSwap({ amount: fromAmt, from: fromToken.symbol, out: bestOutFormatted, to: toToken.symbol });
      setStep('success');
      setFromAmt(''); setQuote(null);
      setBalanceRefreshNonce(value => value + 1);
      if (address) awardXp({ walletAddress: address, amount: SWAP_XP, reason: 'swap' }).then(r => showXp(r.awarded ?? 0, 'Swap')).catch(() => {});
    } catch (e: any) {
      setErrMsg(e?.shortMessage ?? e?.message ?? 'Transaction failed');
      setStep('error');
    }
  }

  const fromBal = fromToken.balance ? parseFloat(fromToken.balance) : 0;
  const fromUsd = fromToken.usdPrice && fromAmt ? parseFloat(fromAmt) * fromToken.usdPrice : null;
  const insufficientBalance = fromToken.balance != null && parseFloat(fromAmt || '0') > fromBal;

  const bestOutFormatted = quote?.amountOutFormatted ?? '0';
  const toUsd = quote?.amountOutUsd ?? null;
  const dispRate = quote?.rate ?? 0;
  const dispGasUsd = quote?.gasUsd ?? null;
  const canSwap = !!quote && !!address && !quoting && !insufficientBalance;
  const chainExplorer = SUPPORTED_CHAINS.find(chain => chain.id === chainId)?.blockExplorers?.default.url ?? 'https://etherscan.io';

  // Everything happens on this one screen: progress in the button, the
  // result as a banner above it. No review, progress, or result pages.
  const busy = step === 'approving' || step === 'sending';
  return (
    <Screen gap={16} style={{ width: '100%', maxWidth: 520, margin: '0 auto' }}>
      {/* One header row: mode, network, slippage. The network is also set by
          picking a token you hold on another chain, so it stays compact. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 150 }}><SwapModeTabs mode="swap" onSwap={() => {}} onBridge={onBridge}/></div>
        <ChainSelect chains={SUPPORTED_CHAINS.filter(chain => KYBER_CHAINS[chain.id])} value={chainId} onChange={selectChain} small ariaLabel="Swap network"/>
        <div
          onClick={() => { const opts = [10, 50, 100, 300]; const i = opts.indexOf(slippageBps); setSlippageBps(opts[(i + 1) % opts.length]); }}
          title="Max slippage. Tap to change."
          style={{ flexShrink: 0, cursor: 'pointer', height: 40, padding: '0 10px', borderRadius: 12, background: 'rgba(var(--fg-rgb), 0.05)', border: btb.borderSoft, display: 'flex', flexDirection: 'column', justifyContent: 'center', lineHeight: 1.1 }}>
          <span style={{ color: btb.textDim, fontSize: 9 }}>Slippage</span>
          <span style={{ color: btb.text, fontSize: 12, fontWeight: 800 }}>{slippageBps / 100}%</span>
        </div>
      </div>

      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Glass padding={18} radius={24} strong>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ color: btb.textMuted, fontSize: 13 }}>You pay</span>
            <span style={{ color: btb.textMuted, fontSize: 12 }}>
              {fromBal > 0 ? `${fromBal.toLocaleString('en-US', { maximumFractionDigits: 6 })} ${fromToken.symbol}` : '—'}
              {fromBal > 0 && <span onClick={() => setFromAmt(fromToken.balance ?? '')} style={{ color: btb.red, fontWeight: 700, marginLeft: 6, cursor: 'pointer' }}>MAX</span>}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input value={fromAmt} onChange={e => { setFromAmt(e.target.value); setQuote(null); }} inputMode="decimal" placeholder="0"
              style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', color: btb.text, fontSize: 36, fontWeight: 700, letterSpacing: -1, fontFamily: 'inherit', padding: 0 }}/>
            <TokenPill token={fromToken} onClick={() => setPicker('from')}/>
          </div>
          {fromUsd != null && <div style={{ color: btb.textDim, fontSize: 13, marginTop: 4 }}>≈ ${fromUsd.toLocaleString('en-US', { maximumFractionDigits: 2 })}</div>}
        </Glass>

        <div onClick={flip} style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          width: 44, height: 44, borderRadius: 14, zIndex: 5, cursor: 'pointer',
          background: 'linear-gradient(135deg,rgba(var(--fg-rgb), 0.2),rgba(var(--fg-rgb), 0.08))', border: '4px solid rgba(var(--bg-rgb), 0.95)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 20px rgba(var(--fg-rgb), 0.2), inset 0 1px 0 rgba(var(--fg-rgb), 0.3)',
        }}>
          <Icon name="swap" size={20}/>
        </div>

        <Glass padding={18} radius={24} strong>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ color: btb.textMuted, fontSize: 13 }}>You receive</span>
            <span style={{ color: btb.textMuted, fontSize: 12 }}>
              {toToken.balance ? `${parseFloat(toToken.balance).toLocaleString('en-US', { maximumFractionDigits: 4 })} ${toToken.symbol}` : '—'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, color: quoting ? btb.textMuted : btb.text, fontSize: 36, fontWeight: 700, letterSpacing: -1, fontVariantNumeric: 'tabular-nums', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {quoting ? '…' : quote ? bestOutFormatted : '0'}
            </div>
            <TokenPill token={toToken} onClick={() => setPicker('to')}/>
          </div>
          {toUsd != null && <div style={{ color: btb.textDim, fontSize: 13, marginTop: 4 }}>≈ ${toUsd.toLocaleString('en-US', { maximumFractionDigits: 2 })}</div>}
        </Glass>
      </div>

      {quote && !quoting && (
        <QuoteDetails summary={<>1 {fromToken.symbol} = {dispRate.toLocaleString('en-US', { maximumFractionDigits: 4 })} {toToken.symbol}<span style={{ color: btb.textMuted, fontWeight: 500 }}>{dispGasUsd != null && dispGasUsd > 0 ? ` · fee ~$${dispGasUsd.toFixed(2)}` : ''}{quote.priceImpact > 2 ? ` · impact ${quote.priceImpact.toFixed(2)}%` : ''}</span></>}>
          <InfoRow label="Rate"         value={`1 ${fromToken.symbol} = ${dispRate.toLocaleString('en-US', { maximumFractionDigits: 4 })} ${toToken.symbol}`}/>
          <InfoRow label="Network fee"  value={dispGasUsd != null && dispGasUsd > 0 ? `~ $${dispGasUsd.toFixed(2)}` : '—'}/>
          <InfoRow label="BTB fee" value={`${BTB_SWAP_FEE_PERCENT}% · received token`}/>
          <InfoRow label="Price impact" value={<span style={{ color: quote.priceImpact > 2 ? btb.red : 'var(--btb-green)' }}>{quote.priceImpact > 0 ? `${quote.priceImpact.toFixed(2)}%` : '< 0.01%'}</span>}/>
          <InfoRow label="Route" last value={
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Icon name="bolt" size={12} color={btb.amber}/>
              {quote.route}
            </span>
          }/>
        </QuoteDetails>
      )}

      {quoteErr && (
        <div style={{ background: 'rgba(var(--fg-rgb), 0.08)', border: '1px solid rgba(var(--fg-rgb), 0.18)', borderRadius: 14, padding: '10px 14px', color: btb.red, fontSize: 13 }}>
          {quoteErr}
        </div>
      )}

      {step === 'success' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(var(--green-rgb), 0.10)', border: '1px solid rgba(var(--green-rgb), 0.4)', borderRadius: 14, padding: '11px 14px' }}>
          <Icon name="check" size={16} color={btb.green}/>
          <div style={{ flex: 1, minWidth: 0, color: btb.text, fontSize: 13, fontWeight: 700 }}>
            Swapped{lastSwap ? ` ${lastSwap.amount} ${lastSwap.from} for ${lastSwap.out} ${lastSwap.to}` : ''}
            <span style={{ color: btb.textMuted, fontWeight: 500 }}> · +{SWAP_XP} XP</span>
          </div>
          {txHash && <a href={`${chainExplorer}/tx/${txHash}`} target="_blank" rel="noreferrer" style={{ color: btb.textMuted, fontSize: 12, flexShrink: 0 }}>tx</a>}
        </div>
      )}
      {step === 'error' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(var(--loss-rgb), 0.08)', border: '1px solid rgba(var(--loss-rgb), 0.35)', borderRadius: 14, padding: '11px 14px' }}>
          <Icon name="close" size={16} color={btb.loss}/>
          <div style={{ flex: 1, minWidth: 0, color: btb.text, fontSize: 12.5, lineHeight: 1.4 }}>{errMsg || 'Transaction failed'}</div>
          <button onClick={() => setStep('form')} style={{ background: 'none', border: 'none', color: btb.textMuted, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>Dismiss</button>
        </div>
      )}

      <Button
        // One tap: the quote line above is the review. The wallet's own
        // confirmation is the second look; progress shows on the next screen.
        onClick={() => (!address ? onConnectWallet?.() : canSwap && !busy && executeSwap())}
        disabled={!address ? false : !canSwap || busy}
        loading={busy}
        icon={address && canSwap && !busy ? 'swap' : undefined}
        style={{ marginTop: 4, fontSize: 18 }}
      >
        {step === 'approving' ? 'Approving…' : step === 'sending' ? 'Swapping…' : !address ? 'Connect wallet' : !fromAmt ? 'Enter amount' : insufficientBalance ? `Insufficient ${fromToken.symbol}` : quoting ? 'Getting best price…' : quote ? `Swap ${fromToken.symbol} for ${toToken.symbol}` : quoteErr ? 'No route found' : 'Enter amount'}
      </Button>

      {picker && (
        <TokenPicker
          tokens={chainTokens}
          loading={loadingTokenList}
          selected={picker === 'from' ? fromToken.address : toToken.address}
          chainId={chainId}
          // Paying: the wallet's holdings on every chain lead the list, and
          // picking one elsewhere moves the whole swap to that chain, the way
          // the bridge does. Receiving stays on the current chain.
          held={picker === 'from' ? positions.filter(t => KYBER_CHAINS[t.chainId ?? 1]) : positions.filter(t => (t.chainId ?? 1) === chainId)}
          onSelect={t => {
            const tokenChain = t.chainId ?? 1;
            if (picker === 'from' && tokenChain !== chainId && KYBER_CHAINS[tokenChain]) {
              setChainId(tokenChain);
              const from = { ...t, address: isNativeToken(t.address) ? 'ETH' : t.address.toLowerCase() };
              setFromToken(from);
              const quoteDefault = DEFAULT_QUOTES[tokenChain];
              const native = nativeEthForChain(tokenChain);
              const sameAsFrom = (x: Token) => x.address.toLowerCase() === from.address.toLowerCase();
              setToToken(quoteDefault && !sameAsFrom(quoteDefault) ? quoteDefault : !sameAsFrom(native) ? native : quoteDefault ?? native);
            } else if (picker === 'from') setFromToken(t);
            else setToToken(t);
            setFromAmt(''); setQuote(null); setQuoteErr(null); setStep('form');
          }}
          onImport={importToken}
          onClose={() => setPicker(null)}
        />
      )}
    </Screen>
  );

  // ── Confirm / sending step ─────────────────────────────────────────────────
}

function BridgeSwap({ onStandardSwap, onConnectWallet }: { onStandardSwap: () => void; onConnectWallet?: () => void }) {
  const { positions } = useTokenStore();
  const { address, chainId: walletChainId } = useConnection();
  const config = useConfig();
  const { track } = useTx();
  const awardXp = useMutation(api.users.awardXp);
  const showXp = useXpToast();
  const availableChains = SUPPORTED_CHAINS.filter(chain => KYBER_CHAINS[chain.id]);
  const firstChain = walletChainId && KYBER_CHAINS[walletChainId] ? walletChainId : 1;
  const firstDestination = firstChain === 8453 ? 42161 : 8453;
  const [fromChainId, setFromChainId] = useState<number>(firstChain);
  const { setThemeChainId } = useChainTheme();
  const [toChainId, setToChainId] = useState<number>(firstDestination);
  const [fromToken, setFromToken] = useState<Token>(nativeEthForChain(firstChain));
  const [toToken, setToToken] = useState<Token>(DEFAULT_QUOTES[firstDestination] ?? nativeEthForChain(firstDestination));
  const [fromCatalog, setFromCatalog] = useState<Token[]>([]);
  const [toCatalog, setToCatalog] = useState<Token[]>([]);
  const [customTokens, setCustomTokens] = useState<Token[]>([]);
  const [liveFrom, setLiveFrom] = useState<Token | null>(null);
  const [loadingFrom, setLoadingFrom] = useState(true);
  const [loadingTo, setLoadingTo] = useState(true);
  const [fromAmt, setFromAmt] = useState('');
  const [picker, setPicker] = useState<'from' | 'to' | null>(null);
  const [quote, setQuote] = useState<CrossChainQuote | null>(null);
  const [btbFeePercent, setBtbFeePercent] = useState(0);
  const [quoting, setQuoting] = useState(false);
  const [quoteErr, setQuoteErr] = useState<string | null>(null);
  const [step, setStep] = useState<SwapStep>('form');
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [errMsg, setErrMsg] = useState('');
  const quoteSeq = useRef(0);

  useEffect(() => {
    setThemeChainId(fromChainId);
  }, [fromChainId, setThemeChainId]);

  function mergedTokens(chainId: number, catalog: Token[], selectedBalance?: Token | null) {
    const merged = new Map<string, Token>();
    const add = (token: Token) => {
      if ((token.chainId ?? 1) !== chainId) return;
      const tokenAddress = isNativeToken(token.address) ? 'ETH' : token.address.toLowerCase();
      const key = tokenAddress.toLowerCase();
      merged.set(key, { ...merged.get(key), ...token, address: tokenAddress, chainId });
    };
    add(nativeEthForChain(chainId));
    if (DEFAULT_QUOTES[chainId]) add(DEFAULT_QUOTES[chainId]);
    catalog.forEach(add);
    positions.forEach(add);
    customTokens.forEach(add);
    if (selectedBalance) add(selectedBalance);
    return [...merged.values()];
  }
  const fromTokens = mergedTokens(fromChainId, fromCatalog, liveFrom);
  const toTokens = mergedTokens(toChainId, toCatalog);

  useEffect(() => {
    const controller = new AbortController();
    const load = async (chainId: number, setter: (tokens: Token[]) => void, setLoading: (value: boolean) => void) => {
      setLoading(true);
      try {
        const response = await fetch(`/api/swap-tokens?chainId=${chainId}`, { signal: controller.signal });
        const body = await response.json() as { tokens?: Token[] };
        if (!response.ok) throw new Error('Token catalog unavailable');
        setter(Array.isArray(body.tokens) ? body.tokens : []);
      } catch (error) {
        if ((error as Error).name !== 'AbortError') setter([]);
      } finally { if (!controller.signal.aborted) setLoading(false); }
    };
    load(fromChainId, setFromCatalog, setLoadingFrom);
    load(toChainId, setToCatalog, setLoadingTo);
    return () => controller.abort();
  }, [fromChainId, toChainId]);

  useEffect(() => {
    if (!address) { setLiveFrom(null); return; }
    let cancelled = false;
    const client = getPublicClient(config, { chainId: fromChainId as SupportedChainId });
    if (!client) return;
    const refresh = async () => {
      const raw = isNativeToken(fromToken.address)
        ? await client.getBalance({ address }).catch(() => 0n)
        : await client.readContract({ address: fromToken.address as `0x${string}`, abi: erc20Abi, functionName: 'balanceOf', args: [address] }).catch(() => 0n);
      if (!cancelled) setLiveFrom({ ...fromToken, address: isNativeToken(fromToken.address) ? 'ETH' : fromToken.address.toLowerCase(), chainId: fromChainId, balanceRaw: raw.toString(), balance: formatUnits(raw, fromToken.decimals) });
    };
    refresh();
    const timer = setInterval(refresh, 15_000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [address, config, fromChainId, fromToken.address, fromToken.decimals]);

  function selectFromChain(next: number) {
    if (next === toChainId) return;
    setFromChainId(next);
    setFromToken(nativeEthForChain(next));
    setFromAmt(''); setQuote(null); setQuoteErr(null);
  }

  function selectToChain(next: number) {
    if (next === fromChainId) return;
    setToChainId(next);
    setToToken(DEFAULT_QUOTES[next] ?? nativeEthForChain(next));
    setFromAmt(''); setQuote(null); setQuoteErr(null);
  }

  async function importToken(tokenAddress: string, targetChainId: number): Promise<Token> {
    if (!isAddress(tokenAddress)) throw new Error('Enter a valid token contract');
    const client = getPublicClient(config, { chainId: targetChainId as SupportedChainId });
    if (!client) throw new Error('RPC is unavailable for this chain');
    const token = tokenAddress as `0x${string}`;
    const [symbol, name, decimals, balance] = await Promise.all([
      client.readContract({ address: token, abi: erc20Abi, functionName: 'symbol' }),
      client.readContract({ address: token, abi: erc20Abi, functionName: 'name' }).catch(() => 'Imported token'),
      client.readContract({ address: token, abi: erc20Abi, functionName: 'decimals' }),
      address ? client.readContract({ address: token, abi: erc20Abi, functionName: 'balanceOf', args: [address] }).catch(() => 0n) : 0n,
    ]);
    const imported: Token = { address: tokenAddress.toLowerCase(), symbol, name, decimals, chainId: targetChainId, balanceRaw: balance.toString(), balance: formatUnits(balance, decimals) };
    setCustomTokens(current => [...current.filter(item => item.chainId !== targetChainId || item.address.toLowerCase() !== imported.address), imported]);
    return imported;
  }

  async function requestQuote(silent = false): Promise<CrossChainQuote> {
    if (!address || !fromAmt || parseFloat(fromAmt) <= 0) throw new Error('Enter an amount');
    const seq = ++quoteSeq.current;
    if (!silent) { setQuoting(true); setQuoteErr(null); }
    try {
      const response = await fetch('/api/cross-chain/quote', {
        method: 'POST', headers: { 'content-type': 'application/json' }, cache: 'no-store',
        body: JSON.stringify({
          fromChain: fromChainId, toChain: toChainId,
          fromToken: isNativeToken(fromToken.address) ? '0x0000000000000000000000000000000000000000' : fromToken.address,
          toToken: isNativeToken(toToken.address) ? '0x0000000000000000000000000000000000000000' : toToken.address,
          fromAmount: parseUnits(fromAmt, fromToken.decimals).toString(), wallet: address,
        }),
      });
      const body = await response.json() as { quote?: CrossChainQuote; btbFeePercent?: number; error?: string };
      if (!response.ok || !body.quote) throw new Error(body.error || 'No bridge route');
      if (quoteSeq.current === seq) { setQuote(body.quote); setBtbFeePercent(body.btbFeePercent ?? 0); }
      return body.quote;
    } catch (error) {
      if (quoteSeq.current === seq && !silent) { setQuote(null); setQuoteErr((error as Error).message); }
      throw error;
    } finally { if (quoteSeq.current === seq && !silent) setQuoting(false); }
  }

  useEffect(() => {
    if (!fromAmt || parseFloat(fromAmt) <= 0 || !address) { setQuote(null); return; }
    const timer = setTimeout(() => requestQuote(false).catch(() => {}), 650);
    return () => clearTimeout(timer);
  }, [address, fromAmt, fromChainId, toChainId, fromToken.address, toToken.address]); // eslint-disable-line react-hooks/exhaustive-deps

  async function execute() {
    if (!address || !quote) return;
    try {
      setStep('sending');
      const active = await requestQuote(true);
      const tx = active.transactionRequest;
      if (tx.chainId !== fromChainId || tx.from.toLowerCase() !== address.toLowerCase() || !isAddress(tx.to) || !isHex(tx.data) || tx.data === '0x') throw new Error('The bridge returned unsafe transaction data');
      const calls: Call[] = [];
      let needsApprove = false;
      const amountIn = BigInt(active.estimate.fromAmount);
      if (!isNativeToken(fromToken.address)) {
        if (!isAddress(active.estimate.approvalAddress)) throw new Error('The bridge returned an invalid approval target');
        const client = getPublicClient(config, { chainId: fromChainId as SupportedChainId });
        const allowance = client ? await client.readContract({ address: fromToken.address as `0x${string}`, abi: erc20Abi, functionName: 'allowance', args: [address, active.estimate.approvalAddress as `0x${string}`] }).catch(() => 0n) : 0n;
        if (allowance < amountIn) {
          needsApprove = true;
          calls.push({ to: fromToken.address as `0x${string}`, data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [active.estimate.approvalAddress as `0x${string}`, amountIn] }) });
        }
      }
      calls.push({ to: tx.to as `0x${string}`, data: tx.data as `0x${string}`, value: BigInt(tx.value || '0'), gas: tx.gasLimit ? BigInt(tx.gasLimit) : undefined });
      setStep(needsApprove ? 'approving' : 'sending');
      const { lastHash } = await runCalls(config, { account: address, calls, label: `Bridge ${fromToken.symbol} to ${toToken.symbol}`, track, chainId: fromChainId });
      if (lastHash) setTxHash(lastHash);
      setStep('success');
      awardXp({ walletAddress: address, amount: SWAP_XP, reason: 'cross-chain swap' }).then(r => showXp(r.awarded ?? 0, 'Cross-chain swap')).catch(() => {});
    } catch (error) {
      const rawMessage = (error as { shortMessage?: string; message?: string }).shortMessage ?? (error as Error).message ?? 'Transfer failed';
      setErrMsg(rawMessage.toLowerCase().includes('return amount is not enough')
        ? 'The bridge price moved past the protected minimum. No funds were sent. Try again for a fresh quote.'
        : rawMessage);
      setStep('error');
    }
  }

  const fromBalance = Number(liveFrom?.balance ?? fromToken.balance ?? 0);
  const insufficient = liveFrom?.balance != null && Number(fromAmt || 0) > fromBalance;
  const outFormatted = quote ? Number(formatUnits(BigInt(quote.estimate.toAmount), toToken.decimals)).toLocaleString('en-US', { maximumFractionDigits: 6 }) : '0';
  const gasUsd = quote?.estimate.gasCosts?.reduce((sum, fee) => sum + Number(fee.amountUSD ?? 0), 0) ?? 0;
  const routeFeeUsd = quote?.estimate.feeCosts?.reduce((sum, fee) => sum + Number(fee.amountUSD ?? 0), 0) ?? 0;
  const lifiFee = quote?.estimate.feeCosts?.find(fee => fee.name?.toLowerCase().includes('lifi'));
  const lifiFeePercent = Number(lifiFee?.percentage ?? 0) * 100;
  const duration = quote?.estimate.executionDuration ?? 0;
  const route = [...new Set(quote?.includedSteps
    ?.filter(item => item.tool !== 'feeCollection')
    .map(item => item.toolDetails?.name || item.tool)
    .filter(Boolean) ?? [])].join(' to ') || quote?.tool || 'Best bridge';
  const canReview = !!quote && !!address && !quoting && !insufficient;
  const explorer = SUPPORTED_CHAINS.find(chain => chain.id === fromChainId)?.blockExplorers?.default.url ?? 'https://etherscan.io';

  if (step === 'form') return (
    <Screen gap={16} style={{ width: '100%', maxWidth: 520, margin: '0 auto' }}>
      <SwapModeTabs mode="bridge" onSwap={onStandardSwap} onBridge={() => {}}/>
      <div style={{ color: btb.textMuted, fontSize: 12.5, lineHeight: 1.45, padding: '0 4px' }}>Buy on another network from the balance you already have. Destination gas is not required.</div>
      <Glass padding={18} radius={24} strong>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ color: btb.textMuted, fontSize: 13 }}>Pay from</span>
          <ChainSelect chains={availableChains} value={fromChainId} onChange={selectFromChain} disabledId={toChainId} small ariaLabel="Source network"/>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: btb.textMuted, fontSize: 12, marginBottom: 7 }}><span>You pay</span><span>{fromBalance > 0 ? `${fromBalance.toLocaleString('en-US', { maximumFractionDigits: 6 })} ${fromToken.symbol}` : '—'}{fromBalance > 0 && <b onClick={() => setFromAmt(liveFrom?.balance ?? fromToken.balance ?? '')} style={{ color: btb.red, marginLeft: 6, cursor: 'pointer' }}>MAX</b>}</span></div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}><input value={fromAmt} onChange={event => { setFromAmt(event.target.value); setQuote(null); }} inputMode="decimal" placeholder="0" style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', color: btb.text, fontFamily: 'inherit', fontSize: 34, fontWeight: 800 }}/><TokenPill token={fromToken} onClick={() => setPicker('from')}/></div>
        {fromToken.usdPrice && fromAmt && <div style={{ color: btb.textDim, fontSize: 12, marginTop: 5 }}>≈ ${(Number(fromAmt) * fromToken.usdPrice).toLocaleString('en-US', { maximumFractionDigits: 2 })}</div>}
      </Glass>
      <div style={{ display: 'flex', justifyContent: 'center', margin: '-8px 0', zIndex: 2 }}><div style={{ width: 38, height: 38, borderRadius: 12, background: 'rgba(var(--fg-rgb), .1)', border: '4px solid rgba(var(--bg-rgb), .95)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="down" size={17}/></div></div>
      <Glass padding={18} radius={24} strong>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ color: btb.textMuted, fontSize: 13 }}>Receive on</span>
          <ChainSelect chains={availableChains} value={toChainId} onChange={selectToChain} disabledId={fromChainId} small ariaLabel="Destination network"/>
        </div>
        <div style={{ color: btb.textMuted, fontSize: 12, marginBottom: 7 }}>You receive</div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}><div style={{ flex: 1, minWidth: 0, color: quoting ? btb.textMuted : btb.text, fontSize: 34, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis' }}>{quoting ? '…' : outFormatted}</div><TokenPill token={toToken} onClick={() => setPicker('to')}/></div>
        {quote?.estimate.toAmountUSD && <div style={{ color: btb.textDim, fontSize: 12, marginTop: 5 }}>≈ ${Number(quote.estimate.toAmountUSD).toLocaleString('en-US', { maximumFractionDigits: 2 })}</div>}
      </Glass>
      {quote && !quoting && <QuoteDetails summary={<>{duration <= 5 ? 'Arrives in seconds' : `Arrives in about ${Math.ceil(duration / 60)} min`}<span style={{ color: btb.textMuted, fontWeight: 500 }}>{gasUsd > 0 ? ` · gas ~$${gasUsd.toFixed(2)}` : ''}{routeFeeUsd > 0 ? ` · fees ~$${routeFeeUsd.toFixed(2)}` : ''}</span></>}>
        <InfoRow label="Arrival" value={duration <= 5 ? '≈ a few seconds' : `≈ ${Math.ceil(duration / 60)} min`}/>
        <InfoRow label="Network gas" value={gasUsd > 0 ? `~ $${gasUsd.toFixed(2)} · paid by wallet` : 'Paid by wallet'}/>
        <InfoRow label="Route fees" value={routeFeeUsd > 0 ? `~ $${routeFeeUsd.toFixed(2)} · deducted` : 'None'}/>
        {lifiFeePercent > 0 && <InfoRow label="LI.FI service fee" value={`${lifiFeePercent.toFixed(2)}% · included above`}/>}
        {btbFeePercent > 0 && (
          <InfoRow label="BTB fee" value={`${btbFeePercent}% · sending token`}/>
        )}
        {btbFeePercent === 0 && <InfoRow label="BTB fee" value="Free"/>}
        <InfoRow label="Route" last value={route}/>
      </QuoteDetails>}
      {quoteErr && <div style={{ padding: '10px 14px', borderRadius: 14, background: 'rgba(var(--fg-rgb), .08)', border: '1px solid rgba(var(--fg-rgb), .18)', color: btb.red, fontSize: 13 }}>{quoteErr}</div>}
      <Button onClick={() => !address ? onConnectWallet?.() : canReview && execute()} disabled={!!address && !canReview} style={{ fontSize: 18 }}>{!address ? 'Connect wallet' : !fromAmt ? 'Enter amount' : insufficient ? `Insufficient ${fromToken.symbol}` : quoting ? 'Finding fastest bridge…' : quote ? `Bridge ${fromToken.symbol} to ${CHAIN_META[toChainId]?.name ?? 'destination'}` : quoteErr ? 'No route found' : 'Enter amount'}</Button>
      {picker && (
        <TokenPicker tokens={picker === 'from' ? fromTokens : toTokens} loading={picker === 'from' ? loadingFrom : loadingTo} selected={picker === 'from' ? fromToken.address : toToken.address} onSelect={token => { picker === 'from' ? setFromToken(token) : setToToken(token); setFromAmt(''); setQuote(null); }} onImport={tokenAddress => importToken(tokenAddress, picker === 'from' ? fromChainId : toChainId)} onClose={() => setPicker(null)}/>
      )}
    </Screen>
  );

  if (step === 'confirm' || step === 'approving' || step === 'sending') return (
    <Screen gap={16} style={{ width: '100%', maxWidth: 520, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><button onClick={() => setStep('form')} style={{ width: 36, height: 36, borderRadius: 12, border: btb.borderSoft, background: 'rgba(var(--fg-rgb), .08)', color: btb.text, cursor: 'pointer' }}>←</button><div><div style={{ color: btb.text, fontSize: 22, fontWeight: 850 }}>Confirm bridge</div><div style={{ color: btb.textMuted, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}><ChainLogo chainId={fromChainId} size={16}/>{CHAIN_META[fromChainId]?.name}<span>to</span><ChainLogo chainId={toChainId} size={16}/>{CHAIN_META[toChainId]?.name}</div></div></div>
      <Glass padding={18} radius={22} strong><div style={{ color: btb.textMuted, fontSize: 12 }}>You pay</div><div style={{ color: btb.text, fontSize: 21, fontWeight: 850, marginTop: 4 }}>{Number(fromAmt).toLocaleString('en-US', { maximumFractionDigits: 8 })} {fromToken.symbol}</div><div style={{ height: 1, background: 'rgba(var(--fg-rgb), .08)', margin: '16px 0' }}/><div style={{ color: btb.textMuted, fontSize: 12 }}>You receive on {CHAIN_META[toChainId]?.name}</div><div style={{ color: btb.green, fontSize: 21, fontWeight: 850, marginTop: 4 }}>{outFormatted} {toToken.symbol}</div></Glass>
      <Glass padding={14} radius={18} soft><InfoRow label="Arrival" value={duration <= 5 ? '≈ a few seconds' : `≈ ${Math.ceil(duration / 60)} min`}/><InfoRow label="Destination gas" value="Not required"/><InfoRow label="Minimum received" value={`${quote ? Number(formatUnits(BigInt(quote.estimate.toAmountMin), toToken.decimals)).toLocaleString('en-US', { maximumFractionDigits: 6 }) : '—'} ${toToken.symbol}`}/><InfoRow label="Route fees" value={routeFeeUsd > 0 ? `~ $${routeFeeUsd.toFixed(2)} · from amount` : 'None'}/>{lifiFeePercent > 0 && <InfoRow label="LI.FI service fee" value={`${lifiFeePercent.toFixed(2)}%`}/>}<InfoRow label="BTB fee" value={btbFeePercent > 0 ? `${btbFeePercent}%` : 'Free'}/><InfoRow label="Route" last value={route}/></Glass>
      <div style={{ display: 'flex', gap: 10 }}><Button variant="ghost" size="md" onClick={() => setStep('form')} style={{ flex: 1 }}>Cancel</Button><Button size="md" onClick={execute} disabled={step === 'approving' || step === 'sending'} loading={step === 'approving' || step === 'sending'} style={{ flex: 2 }}>{step === 'approving' ? 'Approving…' : step === 'sending' ? 'Starting transfer…' : 'Confirm'}</Button></div>
    </Screen>
  );

  if (step === 'success') return (
    <Screen gap={18} style={{ alignItems: 'center', justifyContent: 'center', minHeight: '70vh', textAlign: 'center' }}><div style={{ width: 76, height: 76, borderRadius: '50%', background: 'rgba(var(--green-rgb), .15)', border: '2px solid rgba(var(--green-rgb), .4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="check" size={34} color={btb.green}/></div><div><div style={{ color: btb.text, fontSize: 24, fontWeight: 850 }}>Transfer started</div><div style={{ color: btb.textMuted, fontSize: 13, marginTop: 7, lineHeight: 1.5 }}>{outFormatted} {toToken.symbol} will arrive on {CHAIN_META[toChainId]?.name}. You do not need destination gas.</div></div>{txHash && <a href={`${explorer}/tx/${txHash}`} target="_blank" rel="noreferrer" style={{ color: btb.textMuted, fontSize: 12 }}>Source transaction</a>}<Button onClick={() => { setStep('form'); setFromAmt(''); setQuote(null); setTxHash(undefined); }} style={{ width: '100%', maxWidth: 360 }}>Done</Button></Screen>
  );

  return (
    <Screen gap={18} style={{ alignItems: 'center', justifyContent: 'center', minHeight: '70vh', textAlign: 'center' }}><div style={{ color: btb.red, fontSize: 22, fontWeight: 850 }}>Transfer failed</div><div style={{ color: btb.textMuted, fontSize: 13 }}>{errMsg}</div><Button onClick={() => setStep('form')} style={{ width: '100%', maxWidth: 360 }}>Try again</Button></Screen>
  );
}
