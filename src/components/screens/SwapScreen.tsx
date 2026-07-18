'use client';
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

function ChainSelect({ chains, value, onChange, disabledId, small = false, ariaLabel }: {
  chains: readonly ChainOption[];
  value: number;
  onChange: (chainId: number) => void;
  disabledId?: number;
  small?: boolean;
  ariaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = chains.find(chain => chain.id === value) ?? chains[0];

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
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

  return (
    <div ref={rootRef} style={{ position: 'relative', width: small ? 190 : 230, maxWidth: '100%', flexShrink: 1 }}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(value => !value)}
        style={{
          width: '100%',
          height: small ? 34 : 40,
          padding: small ? '0 10px' : '0 12px',
          borderRadius: 999,
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.12)',
          color: btb.text,
          fontFamily: 'inherit',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <ChainLogo chainId={selected.id} size={small ? 20 : 23}/>
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left', fontSize: small ? 12 : 12.5, fontWeight: 750 }}>{selected.name}</span>
        <Icon name="down" size={13} color={btb.textMuted}/>
      </button>
      {open && (
        <div
          role="listbox"
          aria-label={ariaLabel}
          style={{
            position: 'absolute',
            zIndex: 80,
            top: 'calc(100% + 8px)',
            right: 0,
            width: 260,
            maxWidth: 'min(260px, calc(100vw - 40px))',
            maxHeight: 310,
            overflowY: 'auto',
            padding: 7,
            borderRadius: 18,
            background: 'rgba(12,12,18,.98)',
            border: '1px solid rgba(255,255,255,.13)',
            boxShadow: '0 18px 50px rgba(0,0,0,.5)',
            backdropFilter: 'blur(18px)',
            WebkitBackdropFilter: 'blur(18px)',
          }}
        >
          {chains.map(chain => {
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
                  background: active ? 'rgba(255,255,255,.1)' : 'transparent',
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

function TokenPicker({ tokens, selected, loading, onSelect, onImport, onClose }: {
  tokens: Token[]; selected: string; loading?: boolean; onSelect: (t: Token) => void; onImport: (address: string) => Promise<Token>; onClose: () => void;
}) {
  const { width: sidebarWidth } = useSidebar();
  const [q, setQ] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const sorted = sortedTokens(tokens);
  const ql = q.toLowerCase();
  const filtered = ql
    ? sorted.filter(t =>
        t.symbol.toLowerCase().includes(ql) ||
        t.name.toLowerCase().includes(ql) ||
        t.address.toLowerCase().includes(ql)
      )
    : sorted; // show every token — balance-first sorted, search-narrowable
  const visible = ql ? filtered : filtered.slice(0, 100);

  return (
    <Portal>
    <div onClick={onClose} style={{ position: 'fixed', top: 0, left: sidebarWidth, right: 0, bottom: 0, zIndex: 300, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, minWidth: 0, maxHeight: '82vh', background: 'rgba(10,10,15,0.98)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 28, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '12px 20px 0' }}>
            <div style={{ color: btb.text, fontSize: 18, fontWeight: 800, marginBottom: 12 }}>Select token</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.06)', border: btb.borderSoft, borderRadius: 14, padding: '10px 14px', marginBottom: 8 }}>
            <Icon name="search" size={16} color={btb.textMuted}/>
            <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search token…"
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: btb.text, fontSize: 15, fontFamily: 'inherit' }}/>
          </div>
          {!q && <div style={{ color: btb.textDim, fontSize: 11, marginBottom: 6, paddingLeft: 4 }}>{loading ? 'Loading network tokens…' : `${tokens.length.toLocaleString()} tokens · balances shown first`}</div>}
        </div>
        <div style={{ overflowY: 'auto', padding: '0 12px 48px' }}>
          {isAddress(q.trim()) && !filtered.some(token => token.address.toLowerCase() === q.trim().toLowerCase()) && <button onClick={async () => { setImporting(true); setImportError(null); try { const token = await onImport(q.trim()); onSelect(token); onClose(); } catch (error) { setImportError((error as Error).message || 'Could not import token'); } finally { setImporting(false); } }} disabled={importing} style={{ width: '100%', minHeight: 46, margin: '4px 0 8px', borderRadius: 12, border: '1px solid rgba(82,227,164,.3)', background: 'rgba(82,227,164,.08)', color: btb.green, fontFamily: 'inherit', fontSize: 12, fontWeight: 800, cursor: importing ? 'wait' : 'pointer' }}>{importing ? 'Checking contract…' : `Import ${q.slice(0, 8)}…${q.slice(-6)}`}</button>}
          {importError && <div style={{ color: btb.red, fontSize: 11, padding: '0 6px 8px' }}>{importError}</div>}
          {visible.map(t => (
            <div key={t.address} onClick={() => { onSelect(t); onClose(); }} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 8px', borderRadius: 14,
              background: t.address.toLowerCase() === selected.toLowerCase() ? 'rgba(255,255,255,0.08)' : 'transparent', cursor: 'pointer',
            }}>
              <TokenIcon symbol={t.symbol} size={38} logoUrl={t.logoURI}/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: btb.text, fontSize: 15, fontWeight: 700 }}>{t.symbol}</div>
                <div style={{ color: btb.textMuted, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
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
          ))}
          {filtered.length === 0 && !loading && <div style={{ color: btb.textMuted, fontSize: 14, textAlign: 'center', padding: 24 }}>No tokens found. Paste a contract address to import one.</div>}
        </div>
      </div>
    </div>
    </Portal>
  );
}


function TokenPill({ token, onClick }: { token: Token; onClick: () => void }) {
  return (
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px 6px 6px', background: 'rgba(255,255,255,0.1)', border: btb.border, borderRadius: 999, flexShrink: 0, cursor: 'pointer', maxWidth: 160 }}>
      <TokenIcon symbol={token.symbol} size={28} logoUrl={token.logoURI}/>
      <span style={{ color: btb.text, fontSize: 16, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{token.symbol}</span>
      <Icon name="down" size={14} color="rgba(255,255,255,0.7)"/>
    </div>
  );
}

function InfoRow({ label, value, last }: { label: string; value: React.ReactNode; last?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 4px', borderBottom: last ? 'none' : '1px solid rgba(255,255,255,0.06)' }}>
      <span style={{ color: btb.textMuted, fontSize: 13 }}>{label}</span>
      <span style={{ color: btb.text, fontSize: 13, fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function SwapModeTabs({ mode, onSwap, onBridge }: { mode: 'swap' | 'bridge'; onSwap: () => void; onBridge: () => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', padding: 4, borderRadius: 16, background: 'rgba(255,255,255,0.05)', border: btb.borderSoft }}>
      {([
        ['swap', 'Swap', onSwap],
        ['bridge', 'Bridge', onBridge],
      ] as const).map(([value, label, action]) => (
        <button key={value} onClick={action} style={{ height: 38, border: 'none', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 800, color: mode === value ? btb.text : btb.textMuted, background: mode === value ? 'rgba(255,255,255,0.1)' : 'transparent', boxShadow: mode === value ? 'inset 0 1px 0 rgba(255,255,255,.1)' : 'none' }}>{label}</button>
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

      const tx = await buildKyberTx(activeQuote.routeSummary, activeQuote.routerAddress, address, address, 50, chainId);
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
        label: `Swap ${fromToken.symbol} → ${toToken.symbol}`,
        track, chainId,
      });

      if (lastHash) setTxHash(lastHash);
      setStep('success');
      setBalanceRefreshNonce(value => value + 1);
      if (address) awardXp({ walletAddress: address, amount: SWAP_XP, reason: 'swap' }).catch(() => {});
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

  // ── Form step ──────────────────────────────────────────────────────────────
  if (step === 'form') return (
    <Screen gap={16} style={{ maxWidth: 480, margin: '0 auto' }}>
      <SwapModeTabs mode="swap" onSwap={() => {}} onBridge={onBridge}/>
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
        <ChainSelect chains={SUPPORTED_CHAINS.filter(chain => KYBER_CHAINS[chain.id])} value={chainId} onChange={selectChain} ariaLabel="Swap network"/>
        <Glass padding={0} radius={999} style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="settings" size={18}/>
        </Glass>
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
          background: 'linear-gradient(135deg,rgba(255,255,255,0.2),rgba(255,255,255,0.08))', border: '4px solid rgba(10,10,15,0.95)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 20px rgba(255,255,255,0.2), inset 0 1px 0 rgba(255,255,255,0.3)',
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
        <Glass padding={14} radius={18} soft>
          <InfoRow label="Rate"         value={`1 ${fromToken.symbol} = ${dispRate.toLocaleString('en-US', { maximumFractionDigits: 4 })} ${toToken.symbol}`}/>
          <InfoRow label="Network fee"  value={dispGasUsd != null && dispGasUsd > 0 ? `~ $${dispGasUsd.toFixed(2)}` : '—'}/>
          <InfoRow label="BTB fee" value={`${BTB_SWAP_FEE_PERCENT}% · received token`}/>
          <InfoRow label="Price impact" value={<span style={{ color: quote.priceImpact > 2 ? btb.red : '#52E3A4' }}>{quote.priceImpact > 0 ? `${quote.priceImpact.toFixed(2)}%` : '< 0.01%'}</span>}/>
          <InfoRow label="Route" last value={
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Icon name="bolt" size={12} color={btb.amber}/>
              {quote.route}
            </span>
          }/>
        </Glass>
      )}

      {quoteErr && (
        <div style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 14, padding: '10px 14px', color: btb.red, fontSize: 13 }}>
          {quoteErr}
        </div>
      )}

      <Button
        onClick={() => (!address ? onConnectWallet?.() : canSwap && setStep('confirm'))}
        disabled={!address ? false : !canSwap}
        style={{ marginTop: 4, fontSize: 18 }}
      >
        {!address ? 'Connect wallet' : !fromAmt ? 'Enter amount' : insufficientBalance ? `Insufficient ${fromToken.symbol}` : quoting ? 'Getting best price…' : quote ? 'Review swap' : quoteErr ? 'No route found' : 'Enter amount'}
      </Button>

      {picker && (
        <TokenPicker
          tokens={chainTokens}
          loading={loadingTokenList}
          selected={picker === 'from' ? fromToken.address : toToken.address}
          onSelect={t => { picker === 'from' ? setFromToken(t) : setToToken(t); setFromAmt(''); setQuote(null); }}
          onImport={importToken}
          onClose={() => setPicker(null)}
        />
      )}
    </Screen>
  );

  // ── Confirm / sending step ─────────────────────────────────────────────────
  if (step === 'confirm' || step === 'approving' || step === 'sending') return (
    <Screen gap={16} style={{ maxWidth: 480, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 4px' }}>
        <div onClick={() => setStep('form')} style={{ width: 36, height: 36, borderRadius: 12, background: 'rgba(255,255,255,0.08)', border: btb.borderSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <Icon name="back" size={18} color={btb.textMuted}/>
        </div>
        <div>
          <div style={{ color: btb.text, fontSize: 22, fontWeight: 800, letterSpacing: -0.4 }}>Confirm swap</div>
          {CHAIN_META[chainId] && <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}><ChainLogo chainId={chainId} size={16}/><span style={{ color: btb.textMuted, fontSize: 12 }}>{CHAIN_META[chainId].name}</span></div>}
        </div>
      </div>

      <Glass padding={0} radius={22} strong style={{ overflow: 'hidden' }}>
        {/* Pay row */}
        <div style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <TokenIcon symbol={fromToken.symbol} size={40} logoUrl={fromToken.logoURI}/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: btb.textMuted, fontSize: 12, marginBottom: 2 }}>You pay</div>
            <div style={{ color: btb.text, fontSize: 17, fontWeight: 800, letterSpacing: -0.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {parseFloat(fromAmt).toLocaleString('en-US', { maximumFractionDigits: 8 })} {fromToken.symbol}
            </div>
            {fromToken.usdPrice && <div style={{ color: btb.textDim, fontSize: 12 }}>≈ ${(parseFloat(fromAmt) * fromToken.usdPrice).toLocaleString('en-US', { maximumFractionDigits: 2 })}</div>}
          </div>
        </div>
        {/* Divider with arrow */}
        <div style={{ position: 'relative', height: 1, background: 'rgba(255,255,255,0.07)', margin: '0 18px' }}>
          <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,0.08)', border: btb.borderSoft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="down" size={14} color={btb.textMuted}/>
          </div>
        </div>
        {/* Receive row */}
        <div style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <TokenIcon symbol={toToken.symbol} size={40} logoUrl={toToken.logoURI}/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: btb.textMuted, fontSize: 12, marginBottom: 2 }}>You receive</div>
            <div style={{ color: '#52E3A4', fontSize: 17, fontWeight: 800, letterSpacing: -0.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {bestOutFormatted} {toToken.symbol}
            </div>
            {toUsd != null && toUsd > 0 && <div style={{ color: btb.textDim, fontSize: 12 }}>≈ ${toUsd.toLocaleString('en-US', { maximumFractionDigits: 2 })}</div>}
          </div>
        </div>
      </Glass>

      <Glass padding={14} radius={18} soft>
        {quote && [
          ['Rate',         `1 ${fromToken.symbol} = ${quote.rate.toLocaleString('en-US', { maximumFractionDigits: 4 })} ${toToken.symbol}`],
          ['Network fee',  quote.gasUsd > 0 ? `~ $${quote.gasUsd.toFixed(2)}` : '—'],
          ['Price impact', `${quote.priceImpact > 0 ? quote.priceImpact.toFixed(2) : '< 0.01'}%`],
          ['Slippage',     '0.5%'],
          ['BTB fee',      `${BTB_SWAP_FEE_PERCENT}% · received token`],
          ['Route',        quote.route],
        ].map(([label, value], i, arr) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 4px', borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
            <span style={{ color: btb.textMuted, fontSize: 13 }}>{label}</span>
            <span style={{ color: btb.text, fontSize: 13, fontWeight: 600 }}>{value}</span>
          </div>
        ))}
      </Glass>

      <div style={{ display: 'flex', gap: 10 }}>
        <Button variant="ghost" size="md" onClick={() => setStep('form')} style={{ flex: 1, fontSize: 15 }}>Cancel</Button>
        <Button
          size="md"
          onClick={executeSwap}
          disabled={step === 'approving' || step === 'sending'}
          loading={step === 'approving' || step === 'sending'}
          icon={step === 'approving' || step === 'sending' ? undefined : 'swap'}
          style={{ flex: 2 }}
        >
          {step === 'approving' ? 'Approving…' : step === 'sending' ? 'Swapping…' : 'Confirm swap'}
        </Button>
      </div>
    </Screen>
  );

  // ── Success step ───────────────────────────────────────────────────────────
  if (step === 'success') return (
    <Screen gap={20} style={{ alignItems: 'center', justifyContent: 'center', minHeight: '70vh', maxWidth: 480, margin: '0 auto' }}>
      <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(82,227,164,0.15)', border: '2px solid rgba(82,227,164,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="check" size={36} color={btb.green}/>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ color: btb.text, fontSize: 24, fontWeight: 800, letterSpacing: -0.5 }}>Swap complete!</div>
        <div style={{ color: btb.textMuted, fontSize: 14, marginTop: 8 }}>
          {fromAmt} {fromToken.symbol} → {bestOutFormatted} {toToken.symbol}
        </div>
        <Badge bg="rgba(82,227,164,0.14)" border="1px solid rgba(82,227,164,0.3)" color="#52E3A4" style={{ gap: 5, marginTop: 10, padding: '4px 12px', fontSize: 13 }}>
          <Icon name="bolt" size={13} color="#52E3A4"/> +{SWAP_XP} XP earned
        </Badge>
      </div>
      {txHash && (
        <a href={`${chainExplorer}/tx/${txHash}`} target="_blank" rel="noreferrer"
          style={{ color: btb.textMuted, fontSize: 12, fontFamily: 'monospace' }}>
          {txHash.slice(0, 14)}…{txHash.slice(-8)} ↗
        </a>
      )}
      <button onClick={reset} style={{ width: '100%', maxWidth: 360, height: 56, borderRadius: 18, border: 'none', cursor: 'pointer', background: 'rgba(82,227,164,0.15)', color: btb.green, fontSize: 16, fontWeight: 700, fontFamily: 'inherit', outline: '1px solid rgba(82,227,164,0.35)' }}>Swap again</button>
    </Screen>
  );

  // ── Error step ─────────────────────────────────────────────────────────────
  return (
    <Screen gap={20} style={{ alignItems: 'center', justifyContent: 'center', minHeight: '70vh', maxWidth: 480, margin: '0 auto' }}>
      <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', border: '2px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="close" size={32} color={btb.red}/>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ color: btb.text, fontSize: 22, fontWeight: 800 }}>Transaction failed</div>
        <div style={{ color: btb.textMuted, fontSize: 13, marginTop: 8, lineHeight: 1.5, maxWidth: 300 }}>{errMsg}</div>
      </div>
      <div style={{ display: 'flex', gap: 10, width: '100%', maxWidth: 360 }}>
        <button onClick={reset} style={{ flex: 1, height: 52, borderRadius: 16, border: btb.borderSoft, background: 'transparent', color: btb.textMuted, fontSize: 15, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>Cancel</button>
        <button onClick={() => setStep('confirm')} style={{ flex: 1, height: 52, borderRadius: 16, border: 'none', background: btb.gradPrimary, color: btb.bg, fontSize: 15, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>Retry</button>
      </div>
    </Screen>
  );
}

function BridgeSwap({ onStandardSwap, onConnectWallet }: { onStandardSwap: () => void; onConnectWallet?: () => void }) {
  const { positions } = useTokenStore();
  const { address, chainId: walletChainId } = useConnection();
  const config = useConfig();
  const { track } = useTx();
  const awardXp = useMutation(api.users.awardXp);
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
      const { lastHash } = await runCalls(config, { account: address, calls, label: `Bridge ${fromToken.symbol} → ${toToken.symbol}`, track, chainId: fromChainId });
      if (lastHash) setTxHash(lastHash);
      setStep('success');
      awardXp({ walletAddress: address, amount: SWAP_XP, reason: 'cross-chain swap' }).catch(() => {});
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
    .filter(Boolean) ?? [])].join(' → ') || quote?.tool || 'Best bridge';
  const canReview = !!quote && !!address && !quoting && !insufficient;
  const explorer = SUPPORTED_CHAINS.find(chain => chain.id === fromChainId)?.blockExplorers?.default.url ?? 'https://etherscan.io';

  if (step === 'form') return (
    <Screen gap={16} style={{ maxWidth: 480, margin: '0 auto' }}>
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
      <div style={{ display: 'flex', justifyContent: 'center', margin: '-8px 0', zIndex: 2 }}><div style={{ width: 38, height: 38, borderRadius: 12, background: 'rgba(255,255,255,.1)', border: '4px solid rgba(10,10,15,.95)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="down" size={17}/></div></div>
      <Glass padding={18} radius={24} strong>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ color: btb.textMuted, fontSize: 13 }}>Receive on</span>
          <ChainSelect chains={availableChains} value={toChainId} onChange={selectToChain} disabledId={fromChainId} small ariaLabel="Destination network"/>
        </div>
        <div style={{ color: btb.textMuted, fontSize: 12, marginBottom: 7 }}>You receive</div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}><div style={{ flex: 1, minWidth: 0, color: quoting ? btb.textMuted : btb.text, fontSize: 34, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis' }}>{quoting ? '…' : outFormatted}</div><TokenPill token={toToken} onClick={() => setPicker('to')}/></div>
        {quote?.estimate.toAmountUSD && <div style={{ color: btb.textDim, fontSize: 12, marginTop: 5 }}>≈ ${Number(quote.estimate.toAmountUSD).toLocaleString('en-US', { maximumFractionDigits: 2 })}</div>}
      </Glass>
      {quote && !quoting && <Glass padding={14} radius={18} soft>
        <InfoRow label="Arrival" value={duration <= 5 ? '≈ a few seconds' : `≈ ${Math.ceil(duration / 60)} min`}/>
        <InfoRow label="Network gas" value={gasUsd > 0 ? `~ $${gasUsd.toFixed(2)} · paid by wallet` : 'Paid by wallet'}/>
        <InfoRow label="Route fees" value={routeFeeUsd > 0 ? `~ $${routeFeeUsd.toFixed(2)} · deducted` : 'None'}/>
        {lifiFeePercent > 0 && <InfoRow label="LI.FI service fee" value={`${lifiFeePercent.toFixed(2)}% · included above`}/>}
        {btbFeePercent > 0 && (
          <InfoRow label="BTB fee" value={`${btbFeePercent}% · sending token`}/>
        )}
        {btbFeePercent === 0 && <InfoRow label="BTB fee" value="Free"/>}
        <InfoRow label="Route" last value={route}/>
      </Glass>}
      {quoteErr && <div style={{ padding: '10px 14px', borderRadius: 14, background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.18)', color: btb.red, fontSize: 13 }}>{quoteErr}</div>}
      <Button onClick={() => !address ? onConnectWallet?.() : canReview && setStep('confirm')} disabled={!!address && !canReview} style={{ fontSize: 18 }}>{!address ? 'Connect wallet' : !fromAmt ? 'Enter amount' : insufficient ? `Insufficient ${fromToken.symbol}` : quoting ? 'Finding fastest bridge…' : quote ? 'Review bridge' : quoteErr ? 'No route found' : 'Enter amount'}</Button>
      {picker && (
        <TokenPicker tokens={picker === 'from' ? fromTokens : toTokens} loading={picker === 'from' ? loadingFrom : loadingTo} selected={picker === 'from' ? fromToken.address : toToken.address} onSelect={token => { picker === 'from' ? setFromToken(token) : setToToken(token); setFromAmt(''); setQuote(null); }} onImport={tokenAddress => importToken(tokenAddress, picker === 'from' ? fromChainId : toChainId)} onClose={() => setPicker(null)}/>
      )}
    </Screen>
  );

  if (step === 'confirm' || step === 'approving' || step === 'sending') return (
    <Screen gap={16} style={{ maxWidth: 480, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><button onClick={() => setStep('form')} style={{ width: 36, height: 36, borderRadius: 12, border: btb.borderSoft, background: 'rgba(255,255,255,.08)', color: btb.text, cursor: 'pointer' }}>←</button><div><div style={{ color: btb.text, fontSize: 22, fontWeight: 850 }}>Confirm bridge</div><div style={{ color: btb.textMuted, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}><ChainLogo chainId={fromChainId} size={16}/>{CHAIN_META[fromChainId]?.name}<span>→</span><ChainLogo chainId={toChainId} size={16}/>{CHAIN_META[toChainId]?.name}</div></div></div>
      <Glass padding={18} radius={22} strong><div style={{ color: btb.textMuted, fontSize: 12 }}>You pay</div><div style={{ color: btb.text, fontSize: 21, fontWeight: 850, marginTop: 4 }}>{Number(fromAmt).toLocaleString('en-US', { maximumFractionDigits: 8 })} {fromToken.symbol}</div><div style={{ height: 1, background: 'rgba(255,255,255,.08)', margin: '16px 0' }}/><div style={{ color: btb.textMuted, fontSize: 12 }}>You receive on {CHAIN_META[toChainId]?.name}</div><div style={{ color: btb.green, fontSize: 21, fontWeight: 850, marginTop: 4 }}>{outFormatted} {toToken.symbol}</div></Glass>
      <Glass padding={14} radius={18} soft><InfoRow label="Arrival" value={duration <= 5 ? '≈ a few seconds' : `≈ ${Math.ceil(duration / 60)} min`}/><InfoRow label="Destination gas" value="Not required"/><InfoRow label="Minimum received" value={`${quote ? Number(formatUnits(BigInt(quote.estimate.toAmountMin), toToken.decimals)).toLocaleString('en-US', { maximumFractionDigits: 6 }) : '—'} ${toToken.symbol}`}/><InfoRow label="Route fees" value={routeFeeUsd > 0 ? `~ $${routeFeeUsd.toFixed(2)} · from amount` : 'None'}/>{lifiFeePercent > 0 && <InfoRow label="LI.FI service fee" value={`${lifiFeePercent.toFixed(2)}%`}/>}<InfoRow label="BTB fee" value={btbFeePercent > 0 ? `${btbFeePercent}%` : 'Free'}/><InfoRow label="Route" last value={route}/></Glass>
      <div style={{ display: 'flex', gap: 10 }}><Button variant="ghost" size="md" onClick={() => setStep('form')} style={{ flex: 1 }}>Cancel</Button><Button size="md" onClick={execute} disabled={step === 'approving' || step === 'sending'} loading={step === 'approving' || step === 'sending'} style={{ flex: 2 }}>{step === 'approving' ? 'Approving…' : step === 'sending' ? 'Starting transfer…' : 'Confirm'}</Button></div>
    </Screen>
  );

  if (step === 'success') return (
    <Screen gap={18} style={{ alignItems: 'center', justifyContent: 'center', minHeight: '70vh', maxWidth: 480, margin: '0 auto', textAlign: 'center' }}><div style={{ width: 76, height: 76, borderRadius: '50%', background: 'rgba(82,227,164,.15)', border: '2px solid rgba(82,227,164,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="check" size={34} color={btb.green}/></div><div><div style={{ color: btb.text, fontSize: 24, fontWeight: 850 }}>Transfer started</div><div style={{ color: btb.textMuted, fontSize: 13, marginTop: 7, lineHeight: 1.5 }}>{outFormatted} {toToken.symbol} will arrive on {CHAIN_META[toChainId]?.name}. You do not need destination gas.</div></div>{txHash && <a href={`${explorer}/tx/${txHash}`} target="_blank" rel="noreferrer" style={{ color: btb.textMuted, fontSize: 12 }}>Source transaction ↗</a>}<Button onClick={() => { setStep('form'); setFromAmt(''); setQuote(null); setTxHash(undefined); }} style={{ width: '100%', maxWidth: 360 }}>Done</Button></Screen>
  );

  return (
    <Screen gap={18} style={{ alignItems: 'center', justifyContent: 'center', minHeight: '70vh', maxWidth: 480, margin: '0 auto', textAlign: 'center' }}><div style={{ color: btb.red, fontSize: 22, fontWeight: 850 }}>Transfer failed</div><div style={{ color: btb.textMuted, fontSize: 13 }}>{errMsg}</div><Button onClick={() => setStep('form')} style={{ width: '100%', maxWidth: 360 }}>Try again</Button></Screen>
  );
}
