'use client';
import { useEffect, useMemo, useState, useRef } from 'react';
import { useGrowingList } from '../../lib/useGrowingList';
import { getAddress, isAddress } from 'viem';
import { useConfig } from 'wagmi';
import { getPublicClient } from 'wagmi/actions';
import { mintTarget, poolLink, lpAddressesForToken, fmtApr, fmtCompactUsd, EarnPool } from '../../lib/pools';
import { useTokenStore } from '../../lib/TokenStore';
import { useDiscoverPools } from '../../lib/discoverPools';
import { enrichMarketPools, searchMarketPools, type MarketPool } from '../../lib/dexSearch';
import { resolvePoolQuery } from '../../lib/tokenQuery';
import { poolPath, parsePoolPath, parseDiscoverChainPath, poolMatchesLink, chainSlug } from '../../lib/routes';

const WETH_ADDR = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
import { DataTable, Column } from '../DataTable';
import { DexLogo } from '../DexLogo';
import { Button } from '../Button';
import { Icon } from '../Icon';
import { PickerSheet } from '../PickerSheet';
import { DiscoverStatusBanner } from '../DiscoverStatusBanner';
import { ChainLogo } from '../ChainLogo';
import { Glass } from '../Glass';
import { Spinner } from '../Spinner';
import { btb } from '../design-tokens';
import { CreatePosition } from '../CreatePosition';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { SCAN_CHAINS, letterFor } from '../../../convex/tokenScanConfig';
import { MetricDepositSheet } from '../MetricDepositSheet';
import { SmartLpRows, SMART_LPS_NOTE } from '../simulator/sections/SmartLps';
import { isMetricChain } from '@/protocols/dexs/metric';
import { useSidebar } from '../../lib/SidebarContext';
import { CHAIN_META, type SupportedChainId } from '../../lib/wagmi';
import { CHAIN_DATA_NETWORKS } from '../../lib/chainDataNetworks';
import { useChainTheme } from '../../lib/ChainThemeContext';
import { focusOnOpen } from '../../lib/focusOnOpen';
import {
  estFees24h, headlineApr, scanTokenOf, discoverChainId, dexKey, isMetricPool, pairKey, groupByPair, canSimulatePool,
  ChainMark, PoolNameCell, ChangeCell, AprCell, FeesCell, feesToTvlText, PoolCard, MorePoolsToggle, SearchBox,
  SEARCH_PLACEHOLDER, SEARCH_INPUT_STYLE, type DiscoverChain,
} from '../discover/poolParts';

function DiscoverChainSelect({ chains, value, onChange, mobile }: {
  chains: DiscoverChain[];
  value: string;
  onChange: (chain: string) => void;
  mobile: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = chains.find(chain => chain.name === value);
  const logoChains = chains.filter((chain): chain is DiscoverChain & { chainId: number } => chain.chainId != null).slice(0, 2);
  const filteredChains = chains.filter(chain => chain.name.toLowerCase().includes(query.trim().toLowerCase()));

  useEffect(() => {
    // The phone sheet lives in a portal and closes itself; an outside-click check would eat taps on its options.
    if (!open || mobile) return;
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
  }, [open, mobile]);

  const options = (
    <>
    {!query && <button type="button" role="option" aria-selected={value === 'all'} onClick={() => { onChange('all'); setOpen(false); }} style={{ width: '100%', height: mobile ? 50 : 42, padding: '0 9px', border: 'none', borderRadius: 11, background: value === 'all' ? 'rgba(var(--fg-rgb), .1)' : 'transparent', color: btb.text, fontFamily: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 9 }}>
      <span style={{ width: 25, height: 23, position: 'relative', flexShrink: 0 }}>
        {logoChains.map((chain, index) => <span key={chain.name} style={{ position: 'absolute', left: index * 8, top: 1 }}><ChainLogo chainId={chain.chainId} size={21}/></span>)}
      </span>
      <span style={{ flex: 1, textAlign: 'left', fontSize: mobile ? 14 : 12.5, fontWeight: value === 'all' ? 800 : 650 }}>All chains</span>
      {value === 'all' && <Icon name="check" size={15} color={btb.green}/>}
    </button>}
    {filteredChains.map(chain => {
      const active = value === chain.name;
      return (
        <button key={chain.name} type="button" role="option" aria-selected={active} onClick={() => { onChange(chain.name); setOpen(false); }} style={{ width: '100%', height: mobile ? 50 : 42, padding: '0 9px', border: 'none', borderRadius: 11, background: active ? 'rgba(var(--fg-rgb), .1)' : 'transparent', color: btb.text, fontFamily: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 9 }}>
          <ChainMark name={chain.name} chainId={chain.chainId} size={23} src={chain.logo}/>
          <span style={{ flex: 1, textAlign: 'left', fontSize: mobile ? 14 : 12.5, fontWeight: active ? 800 : 650 }}>{chain.name}</span>
          {active && <Icon name="check" size={15} color={btb.green}/>}
        </button>
      );
    })}
    {filteredChains.length === 0 && (
      <div style={{ padding: '18px 10px', color: btb.textMuted, fontSize: 12.5, textAlign: 'center' }}>No chains found</div>
    )}
    </>
  );

  return (
    <div ref={rootRef} style={{ position: 'relative', flex: mobile ? 1 : '0 0 170px', minWidth: 0 }}>
      <button
        type="button"
        aria-label="Filter pools by chain"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(isOpen => {
          if (!isOpen) setQuery('');
          return !isOpen;
        })}
        style={{
          width: '100%',
          height: 42,
          borderRadius: 12,
          border: btb.borderSoft,
          background: btb.surfaceSoft,
          color: btb.text,
          padding: '0 10px',
          fontFamily: 'inherit',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        {selected ? (
          <ChainMark name={selected.name} chainId={selected.chainId} size={23} src={selected.logo}/>
        ) : (
          <span style={{ width: 25, height: 23, position: 'relative', flexShrink: 0 }}>
            {logoChains.map((chain, index) => (
              <span key={chain.name} style={{ position: 'absolute', left: index * 8, top: 1 }}>
                <ChainLogo chainId={chain.chainId} size={21}/>
              </span>
            ))}
          </span>
        )}
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left', fontSize: 12.5, fontWeight: 750 }}>{selected?.name ?? 'All chains'}</span>
        <Icon name="down" size={13} color={btb.textMuted}/>
      </button>
      {open && mobile && (
        <PickerSheet title="Choose chain" query={query} onQuery={setQuery} placeholder="Search chains" onClose={() => setOpen(false)}>
          {options}
        </PickerSheet>
      )}
      {open && !mobile && (
        <div role="listbox" aria-label="Filter pools by chain" style={{ position: 'absolute', zIndex: 80, top: 'calc(100% + 8px)', right: 0, width: 230, maxWidth: 'min(230px, calc(100vw - 40px))', maxHeight: 380, overflowY: 'auto', padding: 7, borderRadius: 16, background: 'rgba(var(--bg-rgb), .98)', border: '1px solid rgba(var(--fg-rgb), .13)', boxShadow: '0 18px 50px rgba(0,0,0,.5)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)' }}>
          <div style={{ height: 38, marginBottom: 5, padding: '0 9px', borderRadius: 10, border: btb.borderSoft, background: 'rgba(var(--fg-rgb), .055)', display: 'flex', alignItems: 'center', gap: 7 }}>
            <Icon name="search" size={13} color={btb.textMuted}/>
            <input
              autoFocus={focusOnOpen()}
              value={query}
              onChange={event => setQuery(event.target.value)}
              onKeyDown={event => event.stopPropagation()}
              placeholder="Search chains"
              aria-label="Search chains"
              style={{ width: '100%', minWidth: 0, border: 'none', outline: 'none', background: 'transparent', color: btb.text, font: 'inherit', fontSize: 12.5 }}
            />
          </div>
          {options}
        </div>
      )}
    </div>
  );
}

function DiscoverDexSelect({ dexes, value, onChange, mobile, logos }: {
  dexes: string[];
  value: string;
  onChange: (dex: string) => void;
  mobile: boolean;
  /** Provider supplied logo per DEX brand, carried on the pool rows. */
  logos: Map<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = value === 'all' ? null : value;
  const logoDexes = dexes.slice(0, 3);
  const filteredDexes = dexes.filter(dex => dex.toLowerCase().includes(query.trim().toLowerCase()));

  useEffect(() => {
    // The phone sheet lives in a portal and closes itself; an outside-click check would eat taps on its options.
    if (!open || mobile) return;
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
  }, [open, mobile]);

  const allLogos = (
    <span style={{ width: 37, height: 23, position: 'relative', flexShrink: 0 }}>
      {logoDexes.map((dex, index) => (
        <span key={dex} style={{ position: 'absolute', left: index * 8, top: 1 }}>
          <DexLogo name={dex} size={21} src={logos.get(dex)}/>
        </span>
      ))}
    </span>
  );

  const options = (
    <>
    {!query && <button type="button" role="option" aria-selected={value === 'all'} onClick={() => { onChange('all'); setOpen(false); }} style={{
      width: '100%', height: mobile ? 50 : 42, padding: '0 9px', border: 'none', borderRadius: 11,
      background: value === 'all' ? 'rgba(var(--fg-rgb), .1)' : 'transparent',
      color: btb.text, fontFamily: 'inherit', cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: 9,
    }}>
      {allLogos}
      <span style={{ flex: 1, textAlign: 'left', fontSize: mobile ? 14 : 12.5, fontWeight: value === 'all' ? 800 : 650 }}>All DEXs</span>
      {value === 'all' && <Icon name="check" size={15} color={btb.green}/>}
    </button>}
    {filteredDexes.map(dex => {
      const active = value === dex;
      return (
        <button key={dex} type="button" role="option" aria-selected={active} onClick={() => { onChange(dex); setOpen(false); }} style={{
          width: '100%', height: mobile ? 50 : 42, padding: '0 9px', border: 'none', borderRadius: 11,
          background: active ? 'rgba(var(--fg-rgb), .1)' : 'transparent',
          color: btb.text, fontFamily: 'inherit', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 9,
        }}>
          <DexLogo name={dex} size={23} src={logos.get(dex)}/>
          <span style={{ flex: 1, textAlign: 'left', fontSize: mobile ? 14 : 12.5, fontWeight: active ? 800 : 650 }}>{dex}</span>
          {active && <Icon name="check" size={15} color={btb.green}/>}
        </button>
      );
    })}
    {filteredDexes.length === 0 && (
      <div style={{ padding: '18px 10px', color: btb.textMuted, fontSize: 12.5, textAlign: 'center' }}>No DEXs found</div>
    )}
    </>
  );

  return (
    <div ref={rootRef} style={{ position: 'relative', flex: mobile ? 1 : '0 0 170px', minWidth: 0 }}>
      <button
        type="button"
        aria-label="Filter pools by DEX"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(isOpen => {
          if (!isOpen) setQuery('');
          return !isOpen;
        })}
        style={{
          width: '100%', height: 42, borderRadius: 12, border: btb.borderSoft,
          background: btb.surfaceSoft, color: btb.text, padding: '0 10px',
          fontFamily: 'inherit', cursor: 'pointer', display: 'flex',
          alignItems: 'center', gap: 8,
        }}
      >
        {selected ? <DexLogo name={selected} size={23} src={logos.get(selected)}/> : allLogos}
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left', fontSize: 12.5, fontWeight: 750 }}>
          {selected ?? 'All DEXs'}
        </span>
        <Icon name="down" size={13} color={btb.textMuted}/>
      </button>
      {open && mobile && (
        <PickerSheet title="Choose DEX" query={query} onQuery={setQuery} placeholder="Search DEXs" onClose={() => setOpen(false)}>
          {options}
        </PickerSheet>
      )}
      {open && !mobile && (
        <div role="listbox" aria-label="Filter pools by DEX" style={{
          position: 'absolute', zIndex: 80, top: 'calc(100% + 8px)', right: 0,
          width: 210, maxWidth: 'min(210px, calc(100vw - 40px))', maxHeight: 360,
          overflowY: 'auto', padding: 7, borderRadius: 16,
          background: 'rgba(var(--bg-rgb), .98)', border: '1px solid rgba(var(--fg-rgb), .13)',
          boxShadow: '0 18px 50px rgba(0,0,0,.5)', backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
        }}>
          <div style={{ height: 38, marginBottom: 5, padding: '0 9px', borderRadius: 10, border: btb.borderSoft, background: 'rgba(var(--fg-rgb), .055)', display: 'flex', alignItems: 'center', gap: 7 }}>
            <Icon name="search" size={13} color={btb.textMuted}/>
            <input
              autoFocus={focusOnOpen()}
              value={query}
              onChange={event => setQuery(event.target.value)}
              onKeyDown={event => event.stopPropagation()}
              placeholder="Search DEXs"
              aria-label="Search DEXs"
              style={{ width: '100%', minWidth: 0, border: 'none', outline: 'none', background: 'transparent', color: btb.text, font: 'inherit', fontSize: 12.5 }}
            />
          </div>
          {options}
        </div>
      )}
    </div>
  );
}

export function DiscoverScreen() {
  const config = useConfig();
  const { isMobile } = useSidebar();
  const { pools, priceChange, loading, complete } = useDiscoverPools();
  const [search, setSearch] = useState('');
  const [selectedChain, setSelectedChain] = useState('all');
  const [selectedDex, setSelectedDex] = useState('all');
  const { setThemeChainId } = useChainTheme();
  const [sheet, setSheet] = useState<{ pool: EarnPool; simulate: boolean; rangePct?: { token: string; lowerPct: number; upperPct: number } } | null>(null);
  // Metric pools deposit through their own sheet: bins around the oracle price, not a tick range.
  const [metricSheet, setMetricSheet] = useState<{ pool: EarnPool; simulate: boolean } | null>(null);
  // Token Scan: a fresh scan (anyone's, last 24 hours) shows its grade on the button; otherwise the button opens the scan page.
  const recentScans = useQuery(api.tokenScan.recent, {});
  const scanGrade = useMemo(() => new Map((recentScans ?? []).map((s) => [`${s.chainId}:${s.token}`, s.score])), [recentScans]);
  const scanFor = (p: EarnPool) => {
    const chainId = discoverChainId(p.chain, p.chainId);
    const token = scanTokenOf(p);
    return chainId && SCAN_CHAINS[chainId] && token ? { chainId, token, score: scanGrade.get(`${chainId}:${token}`) } : null;
  };
  const openScan = (s: { chainId: number; token: string }) => {
    window.history.pushState(null, '', `/scan?chain=${SCAN_CHAINS[s.chainId].slug}&token=${s.token}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };
  const scanButton = (p: EarnPool, style: React.CSSProperties) => {
    const s = scanFor(p);
    if (!s) return null;
    return (
      <Button variant="ghost" size="sm" onClick={() => openScan(s)} title={s.score != null ? 'Scanned in the last 24 hours, free to read' : 'Grade this token'}
        style={{ ...style, border: btb.borderSoft, whiteSpace: 'nowrap' }}>
        {s.score != null ? `${letterFor(s.score)} ${s.score}` : 'Scan'}
      </Button>
    );
  };
  // Smart LPs: shown only on pools the daily job ranked (convex/smartLpsActions.ts).
  const smartCounts = useQuery(api.smartLps.counts, {});
  const [smartSheet, setSmartSheet] = useState<EarnPool | null>(null);
  const smartCount = (p: EarnPool) => {
    const chainId = discoverChainId(p.chain, p.chainId);
    return chainId ? smartCounts?.[`${chainId}:${p.id.toLowerCase()}`] ?? 0 : 0;
  };
  const smartButton = (p: EarnPool, style: React.CSSProperties) => smartCount(p) > 0 ? (
    <Button variant="ghost" size="sm" onClick={() => setSmartSheet(p)} title="LPs in this pool who stayed in range and beat holding"
      style={{ ...style, border: btb.borderSoft, whiteSpace: 'nowrap' }}>
      Smart LPs
    </Button>
  ) : null;
  const addLp = (pool: EarnPool) => (isMetricPool(pool) ? setMetricSheet({ pool, simulate: false }) : openPool(pool, false));
  const simulatePool = (pool: EarnPool) => (isMetricPool(pool) ? setMetricSheet({ pool, simulate: true }) : openSimulator(pool));
  // Direct open from a shared link's token addresses — permanent, independent of the pools list.
  const [directMint, setDirectMint] = useState<{ tokenA?: `0x${string}`; tokenB?: `0x${string}`; v4PoolId?: `0x${string}`; chainId: 1 | 4663 | 8453 | 56 | 5042 } | null>(null);

  // Open a pool. Minting flows put a shareable URL in the address bar with the
  // token addresses carried in the query, so the link resolves forever even if
  // the pool later leaves the Discover list or its symbols are ambiguous.
  const openPool = (pool: EarnPool, simulate: boolean, rangePct?: { token: string; lowerPct: number; upperPct: number }) => {
    setSheet({ pool, simulate, ...(rangePct ? { rangePct } : {}) });
    if (simulate) return;
    const target = mintTarget(pool);
    const query = target?.tokenA && target?.tokenB
      ? `?t=${target.tokenA}-${target.tokenB}`
      : target?.v4PoolId ? `?p=${target.v4PoolId}` : '';
    window.history.pushState(null, '', poolPath(pool.chain, pool.pair) + query);
  };
  const closeSheet = () => {
    setSheet(null); setDirectMint(null);
    if (parsePoolPath(window.location.pathname)) window.history.pushState(null, '', '/discover');
  };

  // Resolve a shared /discover/<chain>/<pair> link. Addresses in the query open
  // immediately (permanent); a symbol-only link falls back to the loaded pools,
  // and if not found seeds the search with the pair.
  const openedFromUrl = useRef(false);
  useEffect(() => {
    if (openedFromUrl.current || sheet || directMint) return;
    const link = parsePoolPath(window.location.pathname);
    if (!link) return;
    const chainId: 1 | 4663 | 8453 | 56 | 5042 | null = link.chain === 'ethereum' ? 1 : link.chain === 'robinhoodchain' ? 4663 : link.chain === 'base' ? 8453 : link.chain === 'bnbchain' || link.chain === 'bsc' ? 56 : link.chain === 'arc' ? 5042 : null;
    const params = new URLSearchParams(window.location.search);
    // ?id=<pool address or V4 pool id> pins one exact pool row (the agent and share links use it).
    const wantId = (params.get('id') ?? '').toLowerCase();
    if (wantId) {
      if (pools.length === 0) return;
      const exact = pools.find(p => p.id.toLowerCase() === wantId && chainSlug(p.chain) === link.chain);
      if (exact) { openedFromUrl.current = true; setSheet({ pool: exact, simulate: mintTarget(exact) === null }); return; }
    }
    const pair = (params.get('t') ?? '').split('-');
    const v4 = params.get('p');
    if (chainId && pair.length === 2 && isAddress(pair[0]) && isAddress(pair[1])) {
      openedFromUrl.current = true;
      setDirectMint({ tokenA: pair[0] as `0x${string}`, tokenB: pair[1] as `0x${string}`, chainId });
      return;
    }
    if (chainId && v4 && /^0x[0-9a-fA-F]{64}$/.test(v4)) {
      openedFromUrl.current = true;
      setDirectMint({ v4PoolId: v4 as `0x${string}`, chainId });
      return;
    }
    if (pools.length === 0) return; // symbol fallback needs the pools list
    openedFromUrl.current = true;
    const pool = pools.find(p => poolMatchesLink(p.chain, p.pair, link) && mintTarget(p) !== null);
    if (pool) setSheet({ pool, simulate: false });
    else setSearch(link.pair.replace(/-/g, ' '));
  }, [pools, sheet, directMint]);

  // /discover/<chain> preselects that chain's filter (once pools are loaded).
  const appliedChainFromUrl = useRef(false);
  useEffect(() => {
    if (appliedChainFromUrl.current || pools.length === 0) return;
    const slug = parseDiscoverChainPath(window.location.pathname);
    if (!slug) return;
    appliedChainFromUrl.current = true;
    const chain = [...new Set(pools.map(p => p.chain))].find(c => chainSlug(c) === slug);
    if (chain) setSelectedChain(chain);
  }, [pools]);

  // Reflect the chain filter into the URL so the current view is shareable
  // (e.g. selecting Robinhood Chain → /discover/robinhoodchain). No history spam.
  useEffect(() => {
    if (parsePoolPath(window.location.pathname)) return; // a pool link owns the URL
    const target = selectedChain === 'all' ? '/discover' : `/discover/${chainSlug(selectedChain)}`;
    if (window.location.pathname !== target) window.history.replaceState(null, '', target);
  }, [selectedChain]);

  // Keep the sheet in sync with browser back/forward: reset and let the resolver
  // above re-run against the new URL.
  useEffect(() => {
    const onPop = () => {
      openedFromUrl.current = false;
      setSheet(null); setDirectMint(null);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Market search: the query can name one token or a pair — "usdc",
  // "eth/usdc", "eth usdc" or "ethusdc" all resolve (see lib/tokenQuery).
  // Either way this pulls EVERY matching pool across all DEXes via the same
  // GeckoTerminal + DexScreener search Simulate uses.
  const [marketPools, setMarketPools] = useState<MarketPool[] | null>(null);
  const [marketSymbol, setMarketSymbol] = useState<string | null>(null);
  const [marketLoading, setMarketLoading] = useState(false);
  const marketReqRef = useRef(0);
  const { tokens } = useTokenStore();
  useEffect(() => {
    const selectedChainId = selectedChain === 'all' ? undefined : discoverChainId(selectedChain);
    const resolved = resolvePoolQuery(search, tokens, selectedChainId);
    const targetChainId = selectedChainId ?? resolved?.a.token?.chainId ?? 1;
    const networks = CHAIN_DATA_NETWORKS[targetChainId];
    // The native gas token has no pool of its own — search its wrapped form.
    const toSearchAddress = (side: { address: string }) =>
      side.address.toUpperCase() === 'ETH' ? WETH_ADDR : side.address;
    const addr = resolved ? toSearchAddress(resolved.a) : null;
    const addrB = resolved?.b ? toSearchAddress(resolved.b) : undefined;
    if (!addr || !networks) {
      marketReqRef.current++;
      setMarketPools(null); setMarketSymbol(null); setMarketLoading(false);
      return;
    }
    const req = ++marketReqRef.current;
    setMarketSymbol(resolved!.b ? `${resolved!.a.label} / ${resolved!.b.label}` : resolved!.a.label);
    setMarketLoading(true);
    const timer = setTimeout(() => {
      // A pair is already a narrow search, so it keeps the low floor Simulate
      // uses; a single token matches far more and needs the higher one to stay
      // readable.
      searchMarketPools(addr, addrB, addrB ? 100 : 1000, networks)
        .then(async market => {
          const client = getPublicClient(config, { chainId: targetChainId as SupportedChainId });
          return enrichMarketPools(
            client,
            market,
            pools,
            CHAIN_META[targetChainId]?.name ?? selectedChain,
            addr,
            addrB,
            networks.llama,
            targetChainId,
          );
        })
        .then(market => { if (marketReqRef.current === req) setMarketPools(market); })
        .catch(() => { if (marketReqRef.current === req) setMarketPools([]); })
        .finally(() => { if (marketReqRef.current === req) setMarketLoading(false); });
    }, 500);
    return () => clearTimeout(timer);
  }, [config, pools, search, selectedChain, tokens]);

  const { positions } = useTokenStore();
  const logoByAddress = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of tokens) if (t.logoURI) m.set(t.address.toLowerCase(), t.logoURI);
    return m;
  }, [tokens]);
  // What the wallet holds, keyed by chain + address, valued in USD. Chain
  // matters: USDC on Base is not USDC on Ethereum for LP purposes.
  const held = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of positions) {
      if (parseFloat(t.balance ?? '0') <= 0) continue;
      for (const a of lpAddressesForToken(t.address, t.chainId ?? 1)) {
        const key = `${t.chainId ?? 1}:${a}`;
        m.set(key, (m.get(key) ?? 0) + (t.usdValue ?? 0));
      }
    }
    return m;
  }, [positions]);
  const heldSides = (p: EarnPool): { sym: string; usd: number }[] => {
    const syms = p.pair.split('-');
    const chainId = discoverChainId(p.chain, p.chainId) ?? 1;
    return (p.underlyingTokens ?? [])
      .map((t, i) => { const usd = held.get(`${chainId}:${t.toLowerCase()}`); return usd == null ? null : { sym: syms[i], usd }; })
      .filter((x): x is { sym: string; usd: number } => !!x);
  };
  const heldSyms = (p: EarnPool): string[] => heldSides(p).map((s) => s.sym);
  /** Ranking for "pools for your holdings": both sides held beats one side,
   * then by how much of the pool's tokens the wallet actually holds. */
  const holdScore = (p: EarnPool): number => {
    const sides = heldSides(p);
    if (sides.length === 0) return 0;
    return sides.length * 1e12 + sides.reduce((s, x) => s + x.usd, 0);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return pools.filter(p => {
      if (selectedChain !== 'all' && p.chain !== selectedChain) return false;
      if (selectedDex !== 'all' && dexKey(p) !== selectedDex) return false;
      return !q || p.pair.toLowerCase().includes(q) || p.dex.toLowerCase().includes(q) || p.chain.toLowerCase().includes(q);
    });
  }, [pools, search, selectedChain, selectedDex]);

  // Pools the wallet can enter with what it already holds come first, on
  // their own, ranked by how much of the pair is in the wallet. Everything
  // else keeps the volume ranking below. No search: the search is the intent.
  const FOR_YOU_MAX = 8;
  const [showAllForYou, setShowAllForYou] = useState(false);
  const forYouAll = useMemo(() => {
    if (search.trim() || held.size === 0) return [];
    return filtered
      .filter(p => holdScore(p) > 0 && p.tvlUsd >= 50_000)
      .sort((a, b) => holdScore(b) - holdScore(a) || (b.volume24hUsd ?? 0) - (a.volume24hUsd ?? 0));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, held, search]);
  // Pairs, not pools: the top pairs for the wallet, each with every pool it has, so a pair is never split
  // between this section and All pools.
  const forYouGroups = useMemo(() => groupByPair(forYouAll), [forYouAll]);
  const forYouPairs = useMemo(() => new Set((showAllForYou ? forYouGroups : forYouGroups.slice(0, FOR_YOU_MAX)).map(g => pairKey(g[0]))), [forYouGroups, showAllForYou]);
  const forYou = useMemo(() => forYouAll.filter(p => forYouPairs.has(pairKey(p))), [forYouAll, forYouPairs]);
  const rest = useMemo(() => filtered.filter(p => !forYouPairs.has(pairKey(p))), [filtered, forYouPairs]);
  // Phones get cards by TVL, a pair to a card, drawn a batch at a time: all ~3,700 at once kept a phone busy for half a minute.
  const restGroups = useMemo(() => groupByPair([...rest].sort((a, b) => b.tvlUsd - a.tvlUsd)), [rest]);
  const forYouCardGroups = useMemo(() => groupByPair(forYou), [forYou]);
  const mobilePage = useGrowingList(restGroups.length, 30);
  const [openPairs, setOpenPairs] = useState<Set<string>>(new Set());

  const chains = useMemo(() => {
    const byName = new Map<string, DiscoverChain>();
    for (const pool of pools) byName.set(pool.chain, { name: pool.chain, chainId: discoverChainId(pool.chain, pool.chainId), logo: pool.chainLogo });
    return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [pools]);
  const dexLogos = useMemo(() => {
    const m = new Map<string, string>();
    for (const pool of pools) if (pool.dexLogo && !m.has(dexKey(pool))) m.set(dexKey(pool), pool.dexLogo);
    return m;
  }, [pools]);
  const dexes = useMemo(() => [...new Set(
    pools
      .filter(pool => selectedChain === 'all' || pool.chain === selectedChain)
      .map(pool => dexKey(pool))
  )].sort(), [pools, selectedChain]);

  useEffect(() => {
    if (selectedDex !== 'all' && !dexes.includes(selectedDex)) setSelectedDex('all');
  }, [dexes, selectedDex]);

  const logosFor = (p: EarnPool) => {
    const [addr0, addr1] = p.underlyingTokens ?? [];
    return [
      p.tokenLogos?.[0] ?? (addr0 ? logoByAddress.get(addr0.toLowerCase()) : undefined),
      p.tokenLogos?.[1] ?? (addr1 ? logoByAddress.get(addr1.toLowerCase()) : undefined),
    ];
  };
  const sheetProps = sheet ? mintTarget(sheet.pool, sheet.simulate) : null;
  const hasVolumeData = pools.some(p => p.volume24hUsd != null);
  const openSimulator = (pool: EarnPool) => {
    const pair = pool.underlyingTokens;
    // The simulator owns pair comparison. Pass the exact addresses so its
    // token pickers are pre-filled rather than opening a separate mini-sheet.
    if (pair?.[0] && pair[1]) {
      const chainId = discoverChainId(pool.chain, pool.chainId);
      const chainQuery = chainId ? `chain=${chainId}&` : '';
      window.location.href = `/simulate?${chainQuery}tokenA=${encodeURIComponent(pair[0])}&tokenB=${encodeURIComponent(pair[1])}`;
      return;
    }
    // A legacy/indexer row without token addresses cannot safely be mapped by
    // symbol alone (symbols are ambiguous), so preserve the existing fallback.
    setSheet({ pool, simulate: true });
  };

  const allColumns: (Column<EarnPool> & { key: string })[] = [
    {
      key: 'pair', label: 'Pool', sortable: true, sortValue: p => p.pair,
      render: p => <PoolNameCell p={p} mine={heldSyms(p)} logos={logosFor(p)}/>,
    },
    {
      key: 'change24h', label: '24h', align: 'right', sortable: true,
      sortValue: p => p.apyChange1d ?? priceChange[p.id] ?? 0,
      render: p => <ChangeCell p={p} priceChange={priceChange[p.id]}/>,
    },
    {
      key: 'apr', label: 'APR', align: 'right', sortable: true, sortValue: headlineApr,
      render: p => <AprCell p={p}/>,
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
      render: p => <FeesCell p={p}/>,
    },
    {
      key: 'feesToTvl', label: 'Fees / TVL', align: 'right', sortable: true,
      sortValue: p => (p.tvlUsd > 0 ? estFees24h(p) / p.tvlUsd : 0),
      render: feesToTvlText,
    },
    {
      key: 'actions', label: '', align: 'right', width: '270px',
      render: p => {
        const mintable = mintTarget(p) !== null || isMetricPool(p);
        const simulatable = canSimulatePool(p) || isMetricPool(p);
        return (
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
            {mintable && (
              <Button variant="success" size="sm" onClick={() => addLp(p)}
                style={{ height: 30, padding: '0 12px', gap: 4, fontSize: 11.5, boxShadow: 'none', whiteSpace: 'nowrap' }}>
                Add LP
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => simulatable ? simulatePool(p) : window.open(poolLink(p), '_blank', 'noopener,noreferrer')}
              style={{ height: 30, padding: '0 12px', gap: 4, fontSize: 11.5, border: btb.borderSoft, whiteSpace: 'nowrap' }}>
              {simulatable ? 'Simulate' : 'View'}
            </Button>
            {scanButton(p, { height: 30, padding: '0 12px', fontSize: 11.5 })}
            {smartButton(p, { height: 30, padding: '0 12px', fontSize: 11.5 })}
          </div>
        );
      },
    },
  ];

  const columns = allColumns.filter(c => c.key !== 'volume' || hasVolumeData);

  const renderMobileGroup = (group: EarnPool[]) => {
    const key = pairKey(group[0]);
    const isOpen = openPairs.has(key);
    const more = group.length - 1;
    return (
      <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {renderMobileCard(group[0])}
        {more > 0 && (
          <MorePoolsToggle more={more} open={isOpen} onClick={() => setOpenPairs(prev => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; })}/>
        )}
        {isOpen && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 12, borderLeft: '2px solid rgba(var(--green-rgb), 0.25)', marginLeft: 6 }}>
            {group.slice(1).map(renderMobileCard)}
          </div>
        )}
      </div>
    );
  };

  const renderMobileCard = (p: EarnPool) => {
    const mintable = mintTarget(p) !== null || isMetricPool(p);
    const simulatable = canSimulatePool(p) || isMetricPool(p);
    return (
      <PoolCard key={`${p.chain}-${p.id}`} p={p} priceChange={priceChange[p.id]} mine={heldSyms(p)} logos={logosFor(p)}
        onClick={() => mintable ? addLp(p) : simulatable ? simulatePool(p) : window.open(poolLink(p), '_blank', 'noopener,noreferrer')}
        actions={
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }} onClick={e => e.stopPropagation()}>
            {mintable && (
              <Button variant="success" size="sm" onClick={() => addLp(p)}
                style={{ height: 36, flex: 1, gap: 5, fontSize: 12.5, boxShadow: 'none' }}>
                Add LP
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => simulatable ? simulatePool(p) : window.open(poolLink(p), '_blank', 'noopener,noreferrer')}
              style={{ height: 36, flex: 1, gap: 5, fontSize: 12.5, border: btb.borderSoft }}>
              {simulatable ? 'Simulate' : 'View'}
            </Button>
            {scanButton(p, { height: 36, padding: '0 14px', fontSize: 12.5 })}
            {smartButton(p, { height: 36, padding: '0 14px', fontSize: 12.5 })}
          </div>
        }/>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <DiscoverStatusBanner isMobile={isMobile} />
      <div style={{ display: 'flex', gap: 10, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
        <SearchBox mobile={isMobile}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={SEARCH_PLACEHOLDER}
            style={SEARCH_INPUT_STYLE}
          />
        </SearchBox>
        <DiscoverChainSelect chains={chains} value={selectedChain} onChange={(chainName) => {
          setSelectedChain(chainName);
          setSelectedDex(current => current === 'all' || pools.some(pool =>
            (chainName === 'all' || pool.chain === chainName) && dexKey(pool) === current
          ) ? current : 'all');
          const chain = chains.find(item => item.name === chainName);
          if (chain?.chainId) setThemeChainId(chain.chainId);
        }} mobile={isMobile}/>
        <DiscoverDexSelect dexes={dexes} value={selectedDex} onChange={setSelectedDex} mobile={isMobile} logos={dexLogos}/>
      </div>

      {isMobile ? (
        // Compact card list — the full table is far too wide for phones.
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <Spinner size={26} color="var(--btb-text)" track="rgba(var(--fg-rgb), 0.18)" />
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <div style={{ color: btb.textMuted, fontSize: 13.5, textAlign: 'center', padding: 32 }}>No pools found</div>
          )}
          {!loading && forYou.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 4px 0' }}>
              <span style={{ color: btb.text, fontSize: 15, fontWeight: 800, letterSpacing: -0.3 }}>Pools for your holdings</span>
              {forYouGroups.length > FOR_YOU_MAX && (
                <button onClick={() => setShowAllForYou(v => !v)} style={{ background: 'none', border: 'none', color: btb.textMuted, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {showAllForYou ? 'Show fewer' : `Show all ${forYouGroups.length}`}
                </button>
              )}
            </div>
          )}
          {!loading && forYouCardGroups.map(renderMobileGroup)}
          {!loading && forYou.length > 0 && rest.length > 0 && (
            <div style={{ color: btb.text, fontSize: 15, fontWeight: 800, letterSpacing: -0.3, padding: '8px 4px 0' }}>All pools</div>
          )}
          {!loading && restGroups.slice(0, mobilePage.count).map(renderMobileGroup)}
          {!loading && mobilePage.left > 0 && (
            <div ref={mobilePage.sentinel} style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 4px' }}>
              <button type="button" onClick={mobilePage.more} style={{ height: 36, padding: '0 18px', borderRadius: 999, border: btb.borderSoft, background: 'transparent', color: btb.textMuted, fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                Show more ({mobilePage.left.toLocaleString('en-US')} left)
              </button>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {!loading && forYou.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
                <div>
                  <span style={{ color: btb.text, fontSize: 17, fontWeight: 800, letterSpacing: -0.3 }}>Pools for your holdings</span>
                  <span style={{ color: btb.textDim, fontSize: 12, marginLeft: 10 }}>ranked by what you already hold, both sides first</span>
                </div>
                {forYouGroups.length > FOR_YOU_MAX && (
                  <button onClick={() => setShowAllForYou(v => !v)} style={{ background: 'none', border: 'none', color: btb.textMuted, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                    {showAllForYou ? 'Show fewer' : `Show all ${forYouGroups.length}`}
                  </button>
                )}
              </div>
              <div style={{ borderRadius: 16, border: '1px solid rgba(var(--green-rgb), 0.25)', background: 'rgba(var(--green-rgb), 0.04)', overflow: 'hidden' }}>
                <DataTable
                  columns={columns}
                  rows={forYou}
                  rowKey={p => `${p.chain}-${p.id}`}
                  groupBy={pairKey}
                  loading={false}
                  emptyMessage=""
                  onRowClick={p => isMetricPool(p) ? setMetricSheet({ pool: p, simulate: true }) : canSimulatePool(p)
                    ? openSimulator(p)
                    : window.open(poolLink(p), '_blank', 'noopener,noreferrer')}
                />
              </div>
            </div>
          )}
          {!loading && forYou.length > 0 && (
            <div style={{ color: btb.text, fontSize: 17, fontWeight: 800, letterSpacing: -0.3, padding: '4px 4px 0' }}>All pools</div>
          )}
          {/* The busiest pools show first; the full lists for every chain follow in the background. */}
          {!loading && !complete && pools.length > 0 && (
            <div style={{ color: btb.textMuted, fontSize: 12, padding: '0 4px' }}>Showing the busiest pools, loading the rest…</div>
          )}
          <div style={{ borderRadius: 16, border: btb.borderSoft, background: btb.surfaceSoft, overflow: 'hidden' }}>
            <DataTable
              columns={columns}
              rows={rest}
              pageSize={60}
              rowKey={p => `${p.chain}-${p.id}`}
              groupBy={pairKey}
              loading={loading}
              emptyMessage="No pools found"
              // Volume, not TVL. Sorting by TVL is what put pools holding nine
              // figures with no trades at the top of the table.
              defaultSortKey="volume"
              onRowClick={p => isMetricPool(p) ? setMetricSheet({ pool: p, simulate: true }) : canSimulatePool(p)
                ? openSimulator(p)
                : window.open(poolLink(p), '_blank', 'noopener,noreferrer')}
            />
          </div>
        </div>
      )}

      {/* every pool for the searched token, across all DEXes */}
      {marketSymbol && (marketLoading || marketPools) && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span style={{ color: btb.text, fontSize: 15, fontWeight: 700 }}>All {marketSymbol} pools across DEXes</span>
            {marketLoading && <Spinner size={14} color="var(--btb-text)" track="rgba(var(--fg-rgb), 0.18)"/>}
          </div>
          {!marketLoading && (marketPools?.length ?? 0) === 0 && (
            <div style={{ color: btb.textMuted, fontSize: 13, padding: '8px 2px' }}>
              No live pools found for this token on any DEX we track.
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(marketPools ?? [])
              .filter(p => !pools.some(cp => cp.id.toLowerCase() === p.address))
              .slice(0, 15)
              .map(p => (
                <Glass key={p.address} padding={14} radius={18}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <div style={{ color: btb.text, fontSize: 13.5, fontWeight: 700 }}>
                        {p.name || `${marketSymbol} pool`}
                      </div>
                      <div style={{ color: btb.textMuted, fontSize: 12, marginTop: 3, display: 'flex', alignItems: 'center', gap: 5 }}>
                        <DexLogo name={p.dexLabel} size={15}/>
                        <span>
                          {p.dexLabel}
                          {p.feePct != null && ` · ${(p.feePct * 100).toFixed(2)}% fee`}
                          {` · TVL ${fmtCompactUsd(p.tvlUsd)} · ${fmtCompactUsd(p.volume24hUsd)} vol 24h`}
                        </span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div title={p.aprLabel} style={{ color: p.aprPct != null ? btb.green : btb.textDim, fontSize: 14, fontWeight: 800 }}>
                        {p.aprPct != null ? fmtApr(p.aprPct) : p.aprLabel ? 'RFQ' : '—'}
                      </div>
                      <div style={{ color: btb.textDim, fontSize: 10.5 }}>fee APR</div>
                    </div>
                    <a href={p.url} target="_blank" rel="noreferrer" style={{
                      height: 32, padding: '0 14px', borderRadius: 12, border: btb.borderSoft, flexShrink: 0,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      color: btb.textMuted, fontSize: 12, fontWeight: 700, textDecoration: 'none',
                      background: 'rgba(var(--fg-rgb), 0.06)',
                    }}>View</a>
                  </div>
                </Glass>
              ))}
          </div>
        </div>
      )}

      {sheet && sheetProps && (
        <CreatePosition
          tokenA={sheetProps.tokenA}
          tokenB={sheetProps.tokenB}
          v4PoolId={sheetProps.v4PoolId}
          dex={sheetProps.dex}
          chainId={sheetProps.chainId}
          // Slipstream keys pools by tick spacing, which the list does not carry;
          // the sheet then opens on the deepest spacing for the pair.
          initialFee={sheetProps.dex === 'aerodrome' || sheetProps.dex === 'aero' ? undefined : sheet.pool.feeTier}
          initialPool={/^0x[0-9a-fA-F]{40}$/.test(sheet.pool.id) ? sheet.pool.id : undefined}
          fees24hUsd={sheet.pool.fees24hUsd ?? (sheet.pool.tvlUsd * sheet.pool.apyBase) / 100 / 365}
          tokenPricesUsd={sheet.pool.tokenPricesUsd}
          simulate={sheet.simulate}
          initialRangePct={sheet.rangePct}
          onClose={closeSheet}
          onDone={closeSheet}
        />
      )}
      {smartSheet && <SmartLpsSheet pool={smartSheet} chainId={discoverChainId(smartSheet.chain, smartSheet.chainId)} onClose={() => setSmartSheet(null)}
        onUse={(rangePct) => { const p = smartSheet; setSmartSheet(null); openPool(p, false, rangePct); }} />}
      {metricSheet && metricSheet.pool.chainId != null && isMetricChain(metricSheet.pool.chainId) && /^0x[0-9a-fA-F]{40}$/.test(metricSheet.pool.id) && (
        <MetricDepositSheet key={`${metricSheet.pool.id}:${metricSheet.simulate}`} chainId={metricSheet.pool.chainId} pool={getAddress(metricSheet.pool.id)} simulate={metricSheet.simulate} onClose={() => setMetricSheet(null)} onDone={() => setMetricSheet(null)}/>
      )}
      {!sheet && directMint && (
        <CreatePosition
          tokenA={directMint.tokenA}
          tokenB={directMint.tokenB}
          v4PoolId={directMint.v4PoolId}
          dex="uniswap"
          chainId={directMint.chainId}
          simulate={false}
          onClose={closeSheet}
          onDone={closeSheet}
        />
      )}
    </div>
  );
}

/**
 * A pool's smart LPs from Discover. Ranges are moves of the pool's first token
 * (token0) price, which is also how "Use range" hands them to the Add LP sheet.
 */
function SmartLpsSheet({ pool, chainId, onClose, onUse }: {
  pool: EarnPool;
  chainId?: number;
  onClose: () => void;
  onUse: (rangePct: { token: string; lowerPct: number; upperPct: number }) => void;
}) {
  const data = useQuery(api.smartLps.forPool, chainId ? { chainId, pool: pool.id } : 'skip');
  const [a, b] = (pool.underlyingTokens ?? []).map((t) => t.toLowerCase());
  const token0 = a && b ? (a < b ? a : b) : undefined;
  const symbols = pool.pair.split(/[-/]/);
  const sym0 = token0 && a && token0 === a ? symbols[0] : symbols[1];
  return (
    <PickerSheet title={`Smart LPs · ${pool.pair}`} onClose={onClose}
      footer={data ? `${data.smart} of ${data.measured} LPs here beat holding. Ranges are moves of ${sym0 ?? 'the first token'}'s price.` : undefined}>
      <div style={{ color: btb.textMuted, fontSize: 12, lineHeight: 1.5, padding: '0 4px 8px' }}>{SMART_LPS_NOTE}</div>
      {data === undefined ? <div style={{ padding: 16, display: 'flex', justifyContent: 'center' }}><Spinner /></div>
        : !data || data.top.length === 0 ? <div style={{ color: btb.textDim, fontSize: 13, padding: 16 }}>No smart LPs in this pool yet.</div>
        : <SmartLpRows top={data.top} flip={false} onUse={(x) => token0 && onUse({ token: token0, lowerPct: x.lowPct, upperPct: x.highPct })} />}
    </PickerSheet>
  );
}
