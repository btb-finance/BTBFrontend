'use client';
import { useEffect, useMemo, useState, useRef } from 'react';
import { isAddress } from 'viem';
import { useConfig } from 'wagmi';
import { getPublicClient } from 'wagmi/actions';
import { mintTarget, poolLink, lpAddressesForToken, fmtApr, fmtCompactUsd, fmtFeeTier, EarnPool } from '../../lib/pools';
import { useTokenStore } from '../../lib/TokenStore';
import { useDiscoverPools } from '../../lib/discoverPools';
import { enrichMarketPools, searchMarketPools, type MarketPool } from '../../lib/dexSearch';
import { poolPath, parsePoolPath, parseDiscoverChainPath, poolMatchesLink, chainSlug } from '../../lib/routes';

const WETH_ADDR = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
import { DataTable, Column } from '../DataTable';
import { TokenIcon } from '../TokenIcon';
import { DexLogo } from '../DexLogo';
import { Badge } from '../Badge';
import { Button } from '../Button';
import { Icon } from '../Icon';
import { DiscoverStatusBanner } from '../DiscoverStatusBanner';
import { ChainLogo } from '../ChainLogo';
import { Glass } from '../Glass';
import { Spinner } from '../Spinner';
import { btb } from '../design-tokens';
import { CreatePosition } from '../CreatePosition';
import { useSidebar } from '../../lib/SidebarContext';
import { CHAIN_META, type SupportedChainId } from '../../lib/wagmi';
import { CHAIN_DATA_NETWORKS } from '../../lib/chainDataNetworks';
import { useChainTheme } from '../../lib/ChainThemeContext';
import { KYBER_CHAINS } from '../../lib/kyberswap';

/** Fee-based estimate used when the indexer doesn't report real 24h fees (DeFiLlama-sourced rows). */
function estFees24h(p: EarnPool): number {
  return p.fees24hUsd ?? (p.tvlUsd * p.apyBase) / 100 / 365;
}

function headlineApr(p: EarnPool): number {
  return p.aprRange ?? p.apy;
}

function aprContext(p: EarnPool): { label: string; title: string } | null {
  const reward = p.rewardTokenSymbols?.join(' + ') || 'gauge';
  if (p.yieldMode === 'stake-or-fees') {
    const route = p.requiresStaking ? `Stake LP · ${reward}` : 'Unstaked fee yield';
    return {
      label: route,
      title: `${route}. Gauge rewards: ${fmtApr(p.apyReward)}; unstaked fee APR: ${fmtApr(p.apyBase)}. These alternatives are not added together.`,
    };
  }
  if (p.yieldMode === 'staked-rewards') {
    return {
      label: `Stake LP · ${reward}`,
      title: `Gauge reward APR paid to staked LP positions in ${reward}: ${fmtApr(p.apyReward)}. Fee APR is shown separately and is not added to this staked route.`,
    };
  }
  return null;
}

type DiscoverChain = { name: string; chainId?: number };

function discoverChainId(name: string, explicitId?: number): number | undefined {
  if (explicitId && CHAIN_META[explicitId]) return explicitId;
  const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const aliases: Record<string, number> = {
    ethereum: 1, ethereummainnet: 1, bsc: 56, bnbchain: 56, bnbsmartchain: 56,
    polygon: 137, polygonmainnet: 137, arbitrum: 42161, arbitrumone: 42161,
    optimism: 10, opmainnet: 10, base: 8453, avalanche: 43114,
    avalanchecchain: 43114, robinhoodchain: 4663, zksync: 324, zksyncera: 324,
    hyperevm: 999, hyperliquidl1: 999,
  };
  const direct = aliases[normalized];
  if (direct) return direct;
  return Number(Object.entries(CHAIN_META).find(([, meta]) =>
    meta.name.toLowerCase().replace(/[^a-z0-9]/g, '') === normalized
  )?.[0]) || undefined;
}

function canSimulatePool(pool: EarnPool): boolean {
  const chainId = discoverChainId(pool.chain, pool.chainId);
  const pair = pool.underlyingTokens;
  return !!chainId && !!KYBER_CHAINS[chainId] && !!pair?.[0] && !!pair[1]
    && isAddress(pair[0]) && isAddress(pair[1]);
}

function ChainMark({ name, chainId, size }: { name: string; chainId?: number; size: number }) {
  if (chainId) return <ChainLogo chainId={chainId} size={size}/>;
  const nonEvmAsset = {
    solana: '/chains/solana.webp',
    sui: '/chains/sui.webp',
  }[name.toLowerCase()];
  if (nonEvmAsset) {
    return (
      <img
        src={nonEvmAsset}
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, boxShadow: '0 0 0 1px rgba(255,255,255,.12)' }}
      />
    );
  }
  return (
    <span style={{ width: size, height: size, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,.1)', boxShadow: '0 0 0 1px rgba(255,255,255,.12)', flexShrink: 0 }}>
      <Icon name="globe" size={Math.max(10, size - 7)} color={btb.textMuted}/>
    </span>
  );
}

function ChainBadge({ name, chainId }: DiscoverChain) {
  return (
    <span
      title={name}
      aria-label={name}
      style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}
    >
      <ChainMark name={name} chainId={chainId} size={17}/>
    </span>
  );
}

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
          <ChainMark name={selected.name} chainId={selected.chainId} size={23}/>
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
      {open && (
        <div role="listbox" aria-label="Filter pools by chain" style={{ position: 'absolute', zIndex: 80, top: 'calc(100% + 8px)', right: 0, width: 230, maxWidth: 'min(230px, calc(100vw - 40px))', maxHeight: 380, overflowY: 'auto', padding: 7, borderRadius: 16, background: 'rgba(12,12,18,.98)', border: '1px solid rgba(255,255,255,.13)', boxShadow: '0 18px 50px rgba(0,0,0,.5)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)' }}>
          <div style={{ height: 38, marginBottom: 5, padding: '0 9px', borderRadius: 10, border: btb.borderSoft, background: 'rgba(255,255,255,.055)', display: 'flex', alignItems: 'center', gap: 7 }}>
            <Icon name="search" size={13} color={btb.textMuted}/>
            <input
              autoFocus
              value={query}
              onChange={event => setQuery(event.target.value)}
              onKeyDown={event => event.stopPropagation()}
              placeholder="Search chains"
              aria-label="Search chains"
              style={{ width: '100%', minWidth: 0, border: 'none', outline: 'none', background: 'transparent', color: btb.text, font: 'inherit', fontSize: 12.5 }}
            />
          </div>
          {!query && <button type="button" role="option" aria-selected={value === 'all'} onClick={() => { onChange('all'); setOpen(false); }} style={{ width: '100%', height: 42, padding: '0 9px', border: 'none', borderRadius: 11, background: value === 'all' ? 'rgba(255,255,255,.1)' : 'transparent', color: btb.text, fontFamily: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ width: 25, height: 23, position: 'relative', flexShrink: 0 }}>
              {logoChains.map((chain, index) => <span key={chain.name} style={{ position: 'absolute', left: index * 8, top: 1 }}><ChainLogo chainId={chain.chainId} size={21}/></span>)}
            </span>
            <span style={{ flex: 1, textAlign: 'left', fontSize: 12.5, fontWeight: value === 'all' ? 800 : 650 }}>All chains</span>
            {value === 'all' && <Icon name="check" size={15} color={btb.green}/>}
          </button>}
          {filteredChains.map(chain => {
            const active = value === chain.name;
            return (
              <button key={chain.name} type="button" role="option" aria-selected={active} onClick={() => { onChange(chain.name); setOpen(false); }} style={{ width: '100%', height: 42, padding: '0 9px', border: 'none', borderRadius: 11, background: active ? 'rgba(255,255,255,.1)' : 'transparent', color: btb.text, fontFamily: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 9 }}>
                <ChainMark name={chain.name} chainId={chain.chainId} size={23}/>
                <span style={{ flex: 1, textAlign: 'left', fontSize: 12.5, fontWeight: active ? 800 : 650 }}>{chain.name}</span>
                {active && <Icon name="check" size={15} color={btb.green}/>}
              </button>
            );
          })}
          {filteredChains.length === 0 && (
            <div style={{ padding: '18px 10px', color: btb.textMuted, fontSize: 12.5, textAlign: 'center' }}>No chains found</div>
          )}
        </div>
      )}
    </div>
  );
}

function DiscoverDexSelect({ dexes, value, onChange, mobile }: {
  dexes: string[];
  value: string;
  onChange: (dex: string) => void;
  mobile: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = value === 'all' ? null : value;
  const logoDexes = dexes.slice(0, 3);
  const filteredDexes = dexes.filter(dex => dex.toLowerCase().includes(query.trim().toLowerCase()));

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

  const allLogos = (
    <span style={{ width: 37, height: 23, position: 'relative', flexShrink: 0 }}>
      {logoDexes.map((dex, index) => (
        <span key={dex} style={{ position: 'absolute', left: index * 8, top: 1 }}>
          <DexLogo name={dex} size={21}/>
        </span>
      ))}
    </span>
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
        {selected ? <DexLogo name={selected} size={23}/> : allLogos}
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left', fontSize: 12.5, fontWeight: 750 }}>
          {selected ?? 'All DEXs'}
        </span>
        <Icon name="down" size={13} color={btb.textMuted}/>
      </button>
      {open && (
        <div role="listbox" aria-label="Filter pools by DEX" style={{
          position: 'absolute', zIndex: 80, top: 'calc(100% + 8px)', right: 0,
          width: 210, maxWidth: 'min(210px, calc(100vw - 40px))', maxHeight: 360,
          overflowY: 'auto', padding: 7, borderRadius: 16,
          background: 'rgba(12,12,18,.98)', border: '1px solid rgba(255,255,255,.13)',
          boxShadow: '0 18px 50px rgba(0,0,0,.5)', backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
        }}>
          <div style={{ height: 38, marginBottom: 5, padding: '0 9px', borderRadius: 10, border: btb.borderSoft, background: 'rgba(255,255,255,.055)', display: 'flex', alignItems: 'center', gap: 7 }}>
            <Icon name="search" size={13} color={btb.textMuted}/>
            <input
              autoFocus
              value={query}
              onChange={event => setQuery(event.target.value)}
              onKeyDown={event => event.stopPropagation()}
              placeholder="Search DEXs"
              aria-label="Search DEXs"
              style={{ width: '100%', minWidth: 0, border: 'none', outline: 'none', background: 'transparent', color: btb.text, font: 'inherit', fontSize: 12.5 }}
            />
          </div>
          {!query && <button type="button" role="option" aria-selected={value === 'all'} onClick={() => { onChange('all'); setOpen(false); }} style={{
            width: '100%', height: 42, padding: '0 9px', border: 'none', borderRadius: 11,
            background: value === 'all' ? 'rgba(255,255,255,.1)' : 'transparent',
            color: btb.text, fontFamily: 'inherit', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 9,
          }}>
            {allLogos}
            <span style={{ flex: 1, textAlign: 'left', fontSize: 12.5, fontWeight: value === 'all' ? 800 : 650 }}>All DEXs</span>
            {value === 'all' && <Icon name="check" size={15} color={btb.green}/>}
          </button>}
          {filteredDexes.map(dex => {
            const active = value === dex;
            return (
              <button key={dex} type="button" role="option" aria-selected={active} onClick={() => { onChange(dex); setOpen(false); }} style={{
                width: '100%', height: 42, padding: '0 9px', border: 'none', borderRadius: 11,
                background: active ? 'rgba(255,255,255,.1)' : 'transparent',
                color: btb.text, fontFamily: 'inherit', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 9,
              }}>
                <DexLogo name={dex} size={23}/>
                <span style={{ flex: 1, textAlign: 'left', fontSize: 12.5, fontWeight: active ? 800 : 650 }}>{dex}</span>
                {active && <Icon name="check" size={15} color={btb.green}/>}
              </button>
            );
          })}
          {filteredDexes.length === 0 && (
            <div style={{ padding: '18px 10px', color: btb.textMuted, fontSize: 12.5, textAlign: 'center' }}>No DEXs found</div>
          )}
        </div>
      )}
    </div>
  );
}

export function DiscoverScreen() {
  const config = useConfig();
  const { isMobile } = useSidebar();
  const { pools, priceChange, loading } = useDiscoverPools();
  const [search, setSearch] = useState('');
  const [selectedChain, setSelectedChain] = useState('all');
  const [selectedDex, setSelectedDex] = useState('all');
  const { setThemeChainId } = useChainTheme();
  const [sheet, setSheet] = useState<{ pool: EarnPool; simulate: boolean } | null>(null);
  // Direct open from a shared link's token addresses — permanent, independent of the pools list.
  const [directMint, setDirectMint] = useState<{ tokenA?: `0x${string}`; tokenB?: `0x${string}`; v4PoolId?: `0x${string}`; chainId: 1 | 4663 } | null>(null);

  // Open a pool. Minting flows put a shareable URL in the address bar with the
  // token addresses carried in the query, so the link resolves forever even if
  // the pool later leaves the Discover list or its symbols are ambiguous.
  const openPool = (pool: EarnPool, simulate: boolean) => {
    setSheet({ pool, simulate });
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
    const chainId: 1 | 4663 | null = link.chain === 'ethereum' ? 1 : link.chain === 'robinhoodchain' ? 4663 : null;
    const params = new URLSearchParams(window.location.search);
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

  // Single-token market search: when the query names a token (symbol or
  // address), pull EVERY pool for it across all DEXes via the same
  // GeckoTerminal + DexScreener search Simulate uses for pairs.
  const [marketPools, setMarketPools] = useState<MarketPool[] | null>(null);
  const [marketSymbol, setMarketSymbol] = useState<string | null>(null);
  const [marketLoading, setMarketLoading] = useState(false);
  const marketReqRef = useRef(0);
  const { tokens } = useTokenStore();
  useEffect(() => {
    const q = search.trim().toLowerCase();
    const selectedChainId = selectedChain === 'all' ? undefined : discoverChainId(selectedChain);
    const tok = q
      ? tokens.find(t =>
          (t.symbol.toLowerCase() === q || t.address.toLowerCase() === q)
          && (selectedChainId == null || (t.chainId ?? 1) === selectedChainId)
        )
      : undefined;
    // A pasted address the app's token list doesn't know is still searchable —
    // the market APIs only need the address itself, not list membership.
    const addr = tok
      ? (tok.address === 'ETH' ? WETH_ADDR : tok.address)
      : /^0x[0-9a-f]{40}$/.test(q) ? q : null;
    const targetChainId = selectedChainId ?? tok?.chainId ?? 1;
    const networks = CHAIN_DATA_NETWORKS[targetChainId];
    if (!addr || !networks) {
      marketReqRef.current++;
      setMarketPools(null); setMarketSymbol(null); setMarketLoading(false);
      return;
    }
    const req = ++marketReqRef.current;
    setMarketSymbol(tok?.symbol ?? `${q.slice(0, 6)}…${q.slice(-4)}`);
    setMarketLoading(true);
    const timer = setTimeout(() => {
      searchMarketPools(addr, undefined, 1000, networks)
        .then(async market => {
          const client = getPublicClient(config, { chainId: targetChainId as SupportedChainId });
          return enrichMarketPools(
            client,
            market,
            pools,
            CHAIN_META[targetChainId]?.name ?? selectedChain,
            addr,
            undefined,
            networks.llama,
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
    return (p.underlyingTokens ?? []).map((t, i) => (held.has(t.toLowerCase()) ? syms[i] : null)).filter((x): x is string => !!x);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return pools.filter(p => {
      if (selectedChain !== 'all' && p.chain !== selectedChain) return false;
      if (selectedDex !== 'all' && p.dex !== selectedDex) return false;
      return !q || p.pair.toLowerCase().includes(q) || p.dex.toLowerCase().includes(q) || p.chain.toLowerCase().includes(q);
    });
  }, [pools, search, selectedChain, selectedDex]);

  const chains = useMemo(() => {
    const byName = new Map<string, DiscoverChain>();
    for (const pool of pools) byName.set(pool.chain, { name: pool.chain, chainId: discoverChainId(pool.chain, pool.chainId) });
    return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [pools]);
  const dexes = useMemo(() => [...new Set(
    pools
      .filter(pool => selectedChain === 'all' || pool.chain === selectedChain)
      .map(pool => pool.dex)
  )].sort(), [pools, selectedChain]);

  useEffect(() => {
    if (selectedDex !== 'all' && !dexes.includes(selectedDex)) setSelectedDex('all');
  }, [dexes, selectedDex]);

  const splitPair = (p: EarnPool) => p.pair.split('-') as [string, string];
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
      render: p => {
        const [s0, s1] = splitPair(p);
        const mine = heldSyms(p);
        const [addr0, addr1] = p.underlyingTokens ?? [];
        const logo0 = addr0 ? logoByAddress.get(addr0.toLowerCase()) : undefined;
        const logo1 = addr1 ? logoByAddress.get(addr1.toLowerCase()) : undefined;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex' }}>
              <TokenIcon symbol={s0} size={26} logoUrl={logo0} />
              <div style={{ marginLeft: -8 }}><TokenIcon symbol={s1} size={26} logoUrl={logo1} /></div>
            </div>
            <div>
              <div style={{ fontWeight: 700 }}>{p.pair.replace('-', '/')}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2, flexWrap: 'wrap' }}>
                <span title={[p.dex, p.liquidityModel === 'CLMM' ? 'Concentrated liquidity' : p.version, p.poolMeta].filter(Boolean).join(' · ')} aria-label={`${p.dex}${p.version ? ` ${p.version}` : ''}`}>
                  <Badge size="sm" bg={btb.surfaceSoft} color={btb.textMuted} border="none" style={{ fontSize: 10, padding: p.version || p.liquidityModel === 'CLMM' ? '1px 6px' : 2 }}>
                    <DexLogo name={p.dex} size={13}/>
                    {p.liquidityModel === 'CLMM' ? 'CL' : p.version}
                  </Badge>
                </span>
                <ChainBadge name={p.chain} chainId={discoverChainId(p.chain, p.chainId)}/>
                {p.feeTier != null && <span style={{ color: btb.textDim, fontSize: 11 }}>{fmtFeeTier(p.feeTier)}</span>}
                {p.stablecoin && <Badge size="sm" color={btb.green} bg="rgba(82,227,164,0.14)" border="none" style={{ fontSize: 10, padding: '1px 6px' }}>Stable</Badge>}
                {mine.length > 0 && (
                  <Badge size="sm" color="#7DE3B0" bg="rgba(82,227,164,0.1)" border="1px solid rgba(82,227,164,0.3)" style={{ fontSize: 10, padding: '1px 6px' }}>
                    You hold {mine.join(' + ')}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      key: 'change24h', label: '24h', align: 'right', sortable: true,
      sortValue: p => p.apyChange1d ?? priceChange[p.id] ?? 0,
      render: p => {
        const pct = p.apyChange1d ?? priceChange[p.id];
        if (pct == null) return <span style={{ color: btb.textDim }}>—</span>;
        const title = p.apyChange1d != null ? 'APY change (24h, pts)' : 'Price change (24h)';
        return <span title={title} style={{ color: pct >= 0 ? btb.green : btb.loss, fontWeight: 600 }}>{pct >= 0 ? '+' : ''}{pct.toFixed(2)}%</span>;
      },
    },
    {
      key: 'apr', label: 'APR', align: 'right', sortable: true, sortValue: headlineApr,
      render: p => p.source === 'dexscreener' && p.feeTier == null ? <span title="Fee tier data is not available from this source" style={{ color: btb.textDim }}>—</span> : (
        <div title={aprContext(p)?.title ?? (p.aprRange != null ? '±5% concentrated-range APR at current volume' : 'Whole-pool fees/TVL APR — no range data available for this pool')}>
          <div style={{ color: btb.green, fontWeight: 700, textDecoration: 'underline dotted', textUnderlineOffset: 3 }}>
            {fmtApr(headlineApr(p))}
          </div>
          {aprContext(p) && <div style={{ color: btb.textDim, fontSize: 9.5, fontWeight: 650, marginTop: 2 }}>{aprContext(p)!.label}</div>}
        </div>
      ),
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
      render: p => {
        if (p.source === 'dexscreener' && p.feeTier == null) return <span style={{ color: btb.textDim }}>n/a</span>;
        const est = p.fees24hUsd == null;
        return <span title={est ? 'Estimated from pool APR' : undefined}>{est && '≈ '}{fmtCompactUsd(estFees24h(p))}</span>;
      },
    },
    {
      key: 'feesToTvl', label: 'Fees / TVL', align: 'right', sortable: true,
      sortValue: p => (p.tvlUsd > 0 ? estFees24h(p) / p.tvlUsd : 0),
      render: p => (p.source !== 'dexscreener' || p.feeTier != null) && p.tvlUsd > 0 ? `${((estFees24h(p) / p.tvlUsd) * 100).toFixed(3)}%` : '—',
    },
    {
      key: 'actions', label: '', align: 'right', width: '210px',
      render: p => {
        const mintable = mintTarget(p) !== null;
        const simulatable = canSimulatePool(p);
        return (
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
            {mintable && (
              <Button variant="success" size="sm" onClick={() => openPool(p, false)}
                style={{ height: 30, padding: '0 12px', gap: 4, fontSize: 11.5, boxShadow: 'none', whiteSpace: 'nowrap' }}>
                <Icon name="plus" size={11} /> Add LP
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => simulatable ? openSimulator(p) : window.open(poolLink(p), '_blank', 'noopener,noreferrer')}
              style={{ height: 30, padding: '0 12px', gap: 4, fontSize: 11.5, border: btb.borderSoft, whiteSpace: 'nowrap' }}>
              {simulatable ? 'Simulate' : 'View ↗'}
            </Button>
          </div>
        );
      },
    },
  ];

  const columns = allColumns.filter(c => c.key !== 'volume' || hasVolumeData);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <DiscoverStatusBanner isMobile={isMobile} />
      <div style={{ display: 'flex', gap: 10, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
        <div style={{
          flex: 1, minWidth: isMobile ? '100%' : 220, display: 'flex', alignItems: 'center', gap: 8,
          padding: '0 14px', height: 42, borderRadius: 12,
          background: btb.surfaceSoft, border: btb.borderSoft,
        }}>
          <Icon name="search" size={15} color={btb.textMuted} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search assets..."
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: btb.text, fontSize: 13.5, fontFamily: 'inherit' }}
          />
        </div>
        <DiscoverChainSelect chains={chains} value={selectedChain} onChange={(chainName) => {
          setSelectedChain(chainName);
          setSelectedDex(current => current === 'all' || pools.some(pool =>
            (chainName === 'all' || pool.chain === chainName) && pool.dex === current
          ) ? current : 'all');
          const chain = chains.find(item => item.name === chainName);
          if (chain?.chainId) setThemeChainId(chain.chainId);
        }} mobile={isMobile}/>
        <DiscoverDexSelect dexes={dexes} value={selectedDex} onChange={setSelectedDex} mobile={isMobile}/>
      </div>

      {isMobile ? (
        // Compact card list — the full table is far too wide for phones.
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <Spinner size={26} color="#fff" track="rgba(255,255,255,0.18)" />
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <div style={{ color: btb.textMuted, fontSize: 13.5, textAlign: 'center', padding: 32 }}>No pools found</div>
          )}
          {!loading && [...filtered].sort((a, b) => b.tvlUsd - a.tvlUsd).map(p => {
            const [s0, s1] = splitPair(p);
            const mine = heldSyms(p);
            const [addr0, addr1] = p.underlyingTokens ?? [];
            const pct = p.apyChange1d ?? priceChange[p.id];
            const mintable = mintTarget(p) !== null;
            const simulatable = canSimulatePool(p);
            return (
              <Glass key={`${p.chain}-${p.id}`} padding={14} radius={18} onClick={() => mintable ? openPool(p, false) : simulatable ? openSimulator(p) : window.open(poolLink(p), '_blank', 'noopener,noreferrer')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ display: 'flex', flexShrink: 0 }}>
                    <TokenIcon symbol={s0} size={26} logoUrl={addr0 ? logoByAddress.get(addr0.toLowerCase()) : undefined} />
                    <div style={{ marginLeft: -8 }}><TokenIcon symbol={s1} size={26} logoUrl={addr1 ? logoByAddress.get(addr1.toLowerCase()) : undefined} /></div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: btb.text, fontSize: 14 }}>{p.pair.replace('-', '/')}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2, flexWrap: 'wrap' }}>
                      <span title={[p.dex, p.liquidityModel === 'CLMM' ? 'Concentrated liquidity' : p.version, p.poolMeta].filter(Boolean).join(' · ')} aria-label={`${p.dex}${p.version ? ` ${p.version}` : ''}`}>
                        <Badge size="sm" bg={btb.surfaceSoft} color={btb.textMuted} border="none" style={{ fontSize: 10, padding: p.version || p.liquidityModel === 'CLMM' ? '1px 6px' : 2 }}>
                          <DexLogo name={p.dex} size={13}/>
                          {p.liquidityModel === 'CLMM' ? 'CL' : p.version}
                        </Badge>
                      </span>
                      <ChainBadge name={p.chain} chainId={discoverChainId(p.chain, p.chainId)}/>
                      {p.feeTier != null && <span style={{ color: btb.textDim, fontSize: 11 }}>{fmtFeeTier(p.feeTier)}</span>}
                      {p.stablecoin && <Badge size="sm" color={btb.green} bg="rgba(82,227,164,0.14)" border="none" style={{ fontSize: 10, padding: '1px 6px' }}>Stable</Badge>}
                      {mine.length > 0 && (
                        <Badge size="sm" color="#7DE3B0" bg="rgba(82,227,164,0.1)" border="1px solid rgba(82,227,164,0.3)" style={{ fontSize: 10, padding: '1px 6px' }}>
                          You hold {mine.join(' + ')}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ color: p.source === 'dexscreener' && p.feeTier == null ? btb.textDim : btb.green, fontSize: 15, fontWeight: 800 }}>{p.source === 'dexscreener' && p.feeTier == null ? '—' : fmtApr(headlineApr(p))}</div>
                    <div title={aprContext(p)?.title} style={{ color: btb.textDim, fontSize: 10.5 }}>{aprContext(p)?.label ?? 'APR'}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 10 }}>
                  <div>
                    <div style={{ color: btb.textDim, fontSize: 10.5 }}>TVL</div>
                    <div style={{ color: btb.text, fontSize: 12.5, fontWeight: 600 }}>{fmtCompactUsd(p.tvlUsd)}</div>
                  </div>
                  <div>
                    <div style={{ color: btb.textDim, fontSize: 10.5 }}>24h</div>
                    <div style={{ color: pct == null ? btb.textDim : pct >= 0 ? btb.green : btb.loss, fontSize: 12.5, fontWeight: 600 }}>
                      {pct == null ? '—' : `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: btb.textDim, fontSize: 10.5 }}>Fees (24h)</div>
                    <div style={{ color: p.source === 'dexscreener' && p.feeTier == null ? btb.textDim : btb.text, fontSize: 12.5, fontWeight: 600 }}>{p.source === 'dexscreener' && p.feeTier == null ? 'n/a' : <>{p.fees24hUsd == null && '≈ '}{fmtCompactUsd(estFees24h(p))}</>}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 12 }} onClick={e => e.stopPropagation()}>
                  {mintable && (
                    <Button variant="success" size="sm" onClick={() => openPool(p, false)}
                      style={{ height: 36, flex: 1, gap: 5, fontSize: 12.5, boxShadow: 'none' }}>
                      <Icon name="plus" size={12} /> Add LP
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => simulatable ? openSimulator(p) : window.open(poolLink(p), '_blank', 'noopener,noreferrer')}
                    style={{ height: 36, flex: 1, gap: 5, fontSize: 12.5, border: btb.borderSoft }}>
                    {simulatable ? 'Simulate' : 'View ↗'}
                  </Button>
                </div>
              </Glass>
            );
          })}
        </div>
      ) : (
        <div style={{ borderRadius: 16, border: btb.borderSoft, background: btb.surfaceSoft, overflow: 'hidden' }}>
          <DataTable
            columns={columns}
            rows={filtered}
            rowKey={p => `${p.chain}-${p.id}`}
            loading={loading}
            emptyMessage="No pools found"
            defaultSortKey="tvl"
            onRowClick={p => canSimulatePool(p)
              ? openSimulator(p)
              : window.open(poolLink(p), '_blank', 'noopener,noreferrer')}
          />
        </div>
      )}

      {/* every pool for the searched token, across all DEXes */}
      {marketSymbol && (marketLoading || marketPools) && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span style={{ color: btb.text, fontSize: 15, fontWeight: 700 }}>All {marketSymbol} pools across DEXes</span>
            {marketLoading && <Spinner size={14} color="#fff" track="rgba(255,255,255,0.18)"/>}
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
                      background: 'rgba(255,255,255,0.06)',
                    }}>View ↗</a>
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
          initialFee={sheet.pool.feeTier}
          fees24hUsd={sheet.pool.fees24hUsd ?? (sheet.pool.tvlUsd * sheet.pool.apyBase) / 100 / 365}
          tokenPricesUsd={sheet.pool.tokenPricesUsd}
          simulate={sheet.simulate}
          onClose={closeSheet}
          onDone={closeSheet}
        />
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
