'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useConfig, useConnection } from 'wagmi';
import { getPublicClient } from 'wagmi/actions';
import { encodeAbiParameters, erc20Abi, isAddress, keccak256, parseAbiParameters, zeroAddress, type PublicClient } from 'viem';
import { Glass } from '../Glass';
import { Icon } from '../Icon';
import { Button } from '../Button';
import { Portal } from '../Portal';
import { TokenIcon } from '../TokenIcon';
import { ChainLogo } from '../ChainLogo';
import { DexLogo } from '../DexLogo';
import { btb } from '../design-tokens';
import { SimulatorPage } from '../simulator/SimulatorPage';
import { ChainSelect } from './SwapScreen';
import { useSidebar } from '../../lib/SidebarContext';
import { useTokenStore, Token } from '../../lib/TokenStore';
import { FACTORY_ABI } from '@/protocols/dexs/uniswap/v3/abis';
import { fmtFeeTier, DYNAMIC_FEE_FLAG } from '@/protocols/dexs/uniswap/graph';
import {
  uniswapV3DeploymentForChain, WETH,
  type V3Deployment,
} from '@/protocols/dexs/uniswap/v3/addresses';
import {
  ROBINHOOD_UNISWAP_V4, UNISWAP_V4, NATIVE_CURRENCY,
  type V4Deployment,
} from '@/protocols/dexs/uniswap/v4/addresses';
import { STATE_VIEW_ABI } from '@/protocols/dexs/uniswap/v4/abis';
import { PANCAKE_V3_DEPLOYMENT } from '@/protocols/dexs/pancakeswap';
import { fetchPoolStats } from '../../lib/geckoterminal';
import { fetchDexPaprikaPools } from '../../lib/dexpaprika';
import { fetchDexScreenerPools } from '../../lib/dexscreener';
import { enrichMarketPools, searchMarketPools, type MarketPool } from '../../lib/dexSearch';
import { getEarnPools, addRangeAprs, fmtApr, fmtCompactUsd, type EarnPool } from '../../lib/pools';
import { CHAIN_META, SUPPORTED_CHAINS, type SupportedChainId } from '../../lib/wagmi';
import { KYBER_CHAINS } from '../../lib/kyberswap';
import { CHAIN_DATA_NETWORKS } from '../../lib/chainDataNetworks';
import { useChainTheme } from '../../lib/ChainThemeContext';
import { useDiscoverPools, waitForDiscoverPools } from '../../lib/discoverPools';

type Protocol = 'uniswap-v3' | 'uniswap-v4' | 'pancakeswap-v3';
type SimulateMode = 'single' | 'cross-chain';

type CrossChainPair = {
  id: string;
  tokenA: string;
  tokenB: string;
  label: string;
  tokenAByChain?: Record<number, Token>;
  tokenBByChain?: Record<number, Token>;
};

type CrossChainResearchResult = {
  key: string;
  chainId: number;
  chainName: string;
  pair: CrossChainPair;
  status: 'queued' | 'loading' | 'complete' | 'unavailable' | 'error';
  tokenA?: Token;
  tokenB?: Token;
  pools: MarketPool[];
  message?: string;
};

type ResearchTokenOption = {
  symbol: string;
  name: string;
  logoURI?: string;
  chainIds: number[];
  tokensByChain?: Record<number, Token>;
};

const PROTOCOLS: { id: Protocol; label: string; dex: 'uniswap' | 'pancakeswap' }[] = [
  { id: 'uniswap-v3',     label: 'Uniswap V3',     dex: 'uniswap' },
  { id: 'uniswap-v4',     label: 'Uniswap V4',     dex: 'uniswap' },
  { id: 'pancakeswap-v3', label: 'PancakeSwap V3', dex: 'pancakeswap' },
];

/** Official chain-native stablecoins that may not be present in the shared
 * token catalog yet. Never alias one stablecoin ticker to another. */
const CROSS_CHAIN_TOKEN_OVERRIDES: Record<number, Record<string, Token>> = {
  4663: {
    USDG: {
      address: '0x5fc5360d0400a0fd4f2af552add042d716f1d168',
      symbol: 'USDG',
      name: 'Global Dollar',
      decimals: 6,
      chainId: 4663,
    },
  },
  4326: {
    USDM: {
      address: '0xfafddbb3fc7688494971a79cc65dca3ef82079e7',
      symbol: 'USDm',
      name: 'MegaUSD',
      decimals: 18,
      chainId: 4326,
    },
  },
};

// Standard tick spacing per fee tier — used to probe for V4 pools (no-hook case)
// since V4 has no factory to query; the pool either exists at these canonical
// spacings or it doesn't.
const V4_TICK_SPACINGS: Record<number, number> = { 100: 1, 500: 10, 3000: 60, 10000: 200 };
const V4_FEE_TIERS = [100, 500, 3000, 10000];
const CROSS_CHAIN_RANK_COLUMNS = 'minmax(0, 1.15fr) minmax(0, .7fr) minmax(0, .7fr) minmax(0, .7fr) 64px';
const WRAPPED_NATIVE_FALLBACKS: Record<number, `0x${string}`> = {
  1: WETH,
  56: '0xBB4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
  137: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
  42161: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
  10: '0x4200000000000000000000000000000000000006',
  8453: '0x4200000000000000000000000000000000000006',
  43114: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',
  59144: '0xe5D7C2a44FfDDf6b295A15c148167DaAf5Cf4Cea',
  81457: '0x4300000000000000000000000000000000000004',
  130: '0x4200000000000000000000000000000000000006',
  324: '0x5aea5775959fbc2557cc8789bc1bf90a239d9a91',
  999: '0x5555555555555555555555555555555555555555',
  143: '0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A',
  4326: '0x4200000000000000000000000000000000000006',
  4663: '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73',
};

function toCurrency(address: string): `0x${string}` {
  return (address.toLowerCase() === 'eth' ? NATIVE_CURRENCY : address) as `0x${string}`;
}

/** V3/PancakeSwap V3 have no native-ETH pools — 'ETH' always means the WETH contract there. */
function toV3Address(address: string, wrappedNative: `0x${string}` = WETH): `0x${string}` {
  return (address.toLowerCase() === 'eth' ? wrappedNative : address) as `0x${string}`;
}

/** One retry for transient RPC hiccups — a public multicall failing once
 * shouldn't read as "no pool exists" (which is a different, false claim). */
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch {
    return await fn();
  }
}

function sortCurrencies(a: `0x${string}`, b: `0x${string}`): [`0x${string}`, `0x${string}`] {
  return BigInt(a) < BigInt(b) ? [a, b] : [b, a];
}

function computeV4PoolId(currency0: `0x${string}`, currency1: `0x${string}`, fee: number, tickSpacing: number, hooks: `0x${string}`): `0x${string}` {
  const encoded = encodeAbiParameters(
    parseAbiParameters('address, address, uint24, int24, address'),
    [currency0, currency1, fee, tickSpacing, hooks],
  );
  return keccak256(encoded);
}

interface FoundPool {
  protocol: Protocol;
  feeTier: number;
  v4PoolId?: `0x${string}`;
  /** Resolved on-chain pool contract address (V3/PancakeSwap V3 only) — used to fetch a TVL fallback. */
  address?: `0x${string}`;
  tvlUsd?: number;
  apy?: number;
  /** Real (or fee-derived) 24h pool fees — feeds the earnings simulation in
   * the CreatePosition sheet, same as Discover passes for its pools. */
  fees24hUsd?: number;
  /** True when `apy` came from GeckoTerminal's whole-pool fees/TVL fallback
   * (DeFiLlama doesn't index this pool — common for PancakeSwap on Ethereum)
   * rather than the ±5% range-adjusted figure everywhere else uses. */
  aprIsUnranged?: boolean;
  aprKind?: MarketPool['aprKind'];
  aprLabel?: string;
  /** Pool on a DEX the app can't mint on (Uniswap V2, SushiSwap, Balancer, …)
   * from the GeckoTerminal/DexScreener pair search — shown for completeness
   * with a link out instead of a Simulate button. */
  external?: { dexLabel: string; url: string; aprLabel?: string };
}

function foundPoolKey(pool: FoundPool): string {
  return pool.v4PoolId?.toLowerCase()
    ?? pool.address?.toLowerCase()
    ?? `${pool.protocol}:${pool.feeTier}`;
}

/** Merge provider responses without making an already-actionable on-chain row
 * fall back to a read-only market row that happened to finish later. */
function mergeFoundPools(current: FoundPool[], incoming: FoundPool[]): FoundPool[] {
  const merged = new Map(current.map(pool => [foundPoolKey(pool), pool]));
  for (const pool of incoming) {
    const key = foundPoolKey(pool);
    const previous = merged.get(key);
    if (!previous) {
      merged.set(key, pool);
      continue;
    }
    if (!previous.external && pool.external) {
      merged.set(key, {
        ...pool,
        ...previous,
        tvlUsd: previous.tvlUsd ?? pool.tvlUsd,
        apy: previous.apy ?? pool.apy,
        fees24hUsd: previous.fees24hUsd ?? pool.fees24hUsd,
      });
      continue;
    }
    const next = { ...previous, ...pool };
    if (!pool.external) delete next.external;
    merged.set(key, next);
  }
  return [...merged.values()].sort((a, b) => (b.tvlUsd ?? 0) - (a.tvlUsd ?? 0));
}

function marketPoolRows(marketPools: Awaited<ReturnType<typeof searchMarketPools>>): FoundPool[] {
  return marketPools.map(mp => ({
    protocol: 'uniswap-v3' as const, // unused for external rows
    feeTier: mp.feePct != null ? Math.round(mp.feePct * 1_000_000) : 0,
    address: mp.address as `0x${string}`,
    tvlUsd: mp.tvlUsd,
    apy: mp.aprPct != null && mp.aprPct > 0 ? mp.aprPct : undefined,
    aprIsUnranged: mp.aprPct != null && mp.aprPct > 0 && mp.aprKind !== 'gauge' ? true : undefined,
    aprKind: mp.aprKind,
    aprLabel: mp.aprLabel,
    fees24hUsd: mp.feePct != null ? mp.volume24hUsd * mp.feePct : undefined,
    external: { dexLabel: mp.dexLabel, url: mp.url, aprLabel: mp.aprLabel },
  }));
}

function foundPoolDexLabel(pool: FoundPool): string {
  return pool.external?.dexLabel ?? PROTOCOLS.find(protocol => protocol.id === pool.protocol)?.label ?? 'DEX';
}

function dexBrand(label: string): string {
  return label
    .replace(/\s+V\d+.*$/i, '')
    .replace(/\s+Slipstream.*$/i, '')
    .trim();
}

function marketAprText(pool: MarketPool): string {
  if (pool.aprPct == null) return pool.aprLabel ? 'RFQ' : '—';
  if (pool.aprKind === 'gauge') {
    const reward = pool.aprLabel?.split('·').at(-1)?.trim();
    return `${fmtApr(pool.aprPct)}${reward ? ` · ${reward}` : ''}`;
  }
  return `${fmtApr(pool.aprPct)}†`;
}

function foundAprText(pool: FoundPool): string {
  if (pool.apy == null) return pool.external?.aprLabel ? 'RFQ' : '—';
  if (pool.aprKind === 'gauge') {
    const reward = pool.aprLabel?.split('·').at(-1)?.trim();
    return `${fmtApr(pool.apy)}${reward ? ` · ${reward}` : ''}`;
  }
  return `${fmtApr(pool.apy)}${pool.aprIsUnranged ? '†' : ''}`;
}

function foundPoolDexCount(pools: FoundPool[]): number {
  return new Set(pools.map(pool => dexBrand(foundPoolDexLabel(pool)))).size;
}

function marketPoolDexCount(pools: MarketPool[]): number {
  return new Set(pools.map(pool => dexBrand(pool.dexLabel))).size;
}

function MobilePoolMetrics({ pool }: { pool: MarketPool }) {
  const metrics = [
    ['TVL', fmtCompactUsd(pool.tvlUsd)],
    ['24H VOLUME', fmtCompactUsd(pool.volume24hUsd)],
    [pool.aprLabel ? `APR · ${pool.aprLabel}` : 'APR', marketAprText(pool)],
  ];
  return (
    <div style={{
      gridColumn: '1 / -1',
      display: 'grid',
      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
      gap: 7,
      paddingTop: 3,
    }}>
      {metrics.map(([label, value]) => (
        <div key={label} style={{ minWidth: 0 }}>
          <div style={{ color: btb.textDim, fontSize: 8.5, fontWeight: 800, letterSpacing: .35 }}>{label}</div>
          <div style={{
            color: label === 'APR' && pool.aprPct != null ? btb.amber : btb.text,
            fontSize: 11.5,
            fontWeight: 750,
            marginTop: 2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>{value}</div>
        </div>
      ))}
    </div>
  );
}


const PROTOCOL_FOR_EARN_POOL = (p: EarnPool): Protocol | null => {
  if (p.dex === 'PancakeSwap') return 'pancakeswap-v3';
  if (p.version === 'V4') return 'uniswap-v4';
  if (p.version === 'V3') return 'uniswap-v3';
  return null;
};

/** True when an EarnPool's pair is this exact token pair, symbol-based (robust to native/wrapped address differences). */
function pairMatches(p: EarnPool, tokenA: Token, tokenB: Token): boolean {
  const syms = p.pair.split('-').map(s => s.toUpperCase());
  const want = [tokenA.symbol.toUpperCase(), tokenB.symbol.toUpperCase()];
  const norm = (s: string) => (s === 'ETH' ? 'WETH' : s);
  return syms.length === 2 && [syms[0], syms[1]].map(norm).sort().join() === want.map(norm).sort().join();
}

function normalizedChainName(name: string): string {
  const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  return {
    bnbchain: 'bsc',
    bnbsmartchain: 'bsc',
    arbitrumone: 'arbitrum',
    opmainnet: 'optimism',
    polygonmainnet: 'polygon',
    hyperliquidl1: 'hyperevm',
  }[normalized] ?? normalized;
}

/** Enriches on-chain-probed pools with real TVL/APR, and adds any pools the
 * indexer knows about that our standard-fee-tier probe can't find — mainly
 * V4, which allows arbitrary (non-standard) fee tiers since pools are
 * permissionless, unlike V3's fixed tier set. */
function mergeWithEarnPools(probed: FoundPool[], earnPools: EarnPool[], tokenA: Token, tokenB: Token, chainName: string): FoundPool[] {
  const wantedChain = normalizedChainName(chainName);
  const matched = earnPools.filter(p => normalizedChainName(p.chain) === wantedChain && pairMatches(p, tokenA, tokenB));
  // Same headline APR everywhere: the ±5% concentrated-range figure (aprRange)
  // when we have it, never the whole-pool fees/TVL number — that understates
  // concentrated LPing by 10-100x and would read as a different, lower APR
  // than the same pool shows on Discover.
  const dailyFees = (p: EarnPool) => p.fees24hUsd ?? (p.tvlUsd * p.apyBase) / 100 / 365;
  const merged = probed.map(f => {
    const hit = matched.find(p => PROTOCOL_FOR_EARN_POOL(p) === f.protocol && p.feeTier === f.feeTier);
    return hit ? { ...f, tvlUsd: hit.tvlUsd, apy: hit.aprRange ?? hit.apy, fees24hUsd: dailyFees(hit) } : f;
  });
  // Extra V4 rows at fee tiers our standard-tier probe wouldn't have tried.
  for (const p of matched) {
    if (PROTOCOL_FOR_EARN_POOL(p) !== 'uniswap-v4' || p.source !== 'uniswap') continue;
    if (p.feeTier == null) continue;
    if (merged.some(f => f.protocol === 'uniswap-v4' && f.feeTier === p.feeTier)) continue;
    merged.push({ protocol: 'uniswap-v4', feeTier: p.feeTier, v4PoolId: p.id as `0x${string}`, tvlUsd: p.tvlUsd, apy: p.aprRange ?? p.apy, fees24hUsd: dailyFees(p) });
  }
  return merged.sort((a, b) => (b.tvlUsd ?? 0) - (a.tvlUsd ?? 0));
}

async function readTokenMetadata(client: PublicClient, chainId: number, address: string): Promise<Token | null> {
  if (!isAddress(address)) return null;
  const tokenAddress = address.toLowerCase() as `0x${string}`;
  try {
    const [symbol, decimals, name] = await Promise.all([
      client.readContract({ address: tokenAddress, abi: erc20Abi, functionName: 'symbol' }),
      client.readContract({ address: tokenAddress, abi: erc20Abi, functionName: 'decimals' }),
      client.readContract({ address: tokenAddress, abi: erc20Abi, functionName: 'name' }).catch(() => ''),
    ]);
    if (!symbol?.trim()) return null;
    return {
      address: tokenAddress,
      symbol: symbol.trim(),
      name: name?.trim() || symbol.trim(),
      decimals,
      chainId,
    };
  } catch {
    return null;
  }
}

function TokenPickerButton({ label, token, onPick, tokens, onImportAddress }: {
  label: string;
  token: Token | null;
  onPick: (t: Token) => void;
  tokens: Token[];
  onImportAddress?: (address: string) => Promise<Token | null>;
}) {
  const { width: sidebarWidth } = useSidebar();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const pastedAddress = isAddress(q.trim()) ? q.trim().toLowerCase() : null;
  const addressAlreadyListed = pastedAddress
    ? tokens.some(candidate => candidate.address.toLowerCase() === pastedAddress)
    : false;
  const filtered = q
    ? tokens.filter(t =>
      t.symbol.toLowerCase().includes(q.toLowerCase())
      || t.name.toLowerCase().includes(q.toLowerCase())
      || t.address.toLowerCase().includes(q.toLowerCase())
    )
    : tokens;

  async function importAddress() {
    if (!pastedAddress || !onImportAddress || importing) return;
    setImporting(true);
    setImportError(null);
    try {
      const imported = await onImportAddress(pastedAddress);
      if (!imported) {
        setImportError('No ERC-20 contract found at this address on this chain.');
        return;
      }
      onPick(imported);
      setOpen(false);
      setQ('');
    } finally {
      setImporting(false);
    }
  }

  return (
    <>
      <div onClick={() => setOpen(true)} style={{
        flex: 1, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
        background: btb.surfaceSoft, border: btb.borderSoft, borderRadius: 14, padding: '12px 14px',
      }}>
        {token ? <TokenIcon symbol={token.symbol} size={28} logoUrl={token.logoURI} /> : (
          <div style={{ width: 28, height: 28, borderRadius: 999, border: '1.5px dashed rgba(255,255,255,0.25)' }} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: btb.textDim, fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
          <div style={{ color: token ? btb.text : btb.textMuted, fontSize: 14, fontWeight: 700 }}>{token ? token.symbol : 'Select token'}</div>
        </div>
        <Icon name="down" size={14} color={btb.textMuted} />
      </div>

      {open && (
        <Portal>
          <div onClick={() => { setOpen(false); setImportError(null); }} style={{
            position: 'fixed', top: 0, left: sidebarWidth, right: 0, bottom: 0, zIndex: 300,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', overflowY: 'auto',
          }}>
            <div onClick={e => e.stopPropagation()} style={{
              width: '100%', maxWidth: 420, maxHeight: '80vh', background: 'rgba(10,10,15,0.98)',
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: 28, display: 'flex', flexDirection: 'column',
            }}>
              <div style={{ padding: '20px 20px 0' }}>
                <div style={{ color: btb.text, fontSize: 18, fontWeight: 800, marginBottom: 12 }}>Select {label.toLowerCase()}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.06)', border: btb.borderSoft, borderRadius: 14, padding: '10px 14px', marginBottom: 8 }}>
                  <Icon name="search" size={16} color={btb.textMuted} />
                  <input autoFocus value={q} onChange={e => { setQ(e.target.value); setImportError(null); }} placeholder="Search name, symbol, or paste address…"
                    style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: btb.text, fontSize: 15, fontFamily: 'inherit' }} />
                </div>
              </div>
              <div style={{ overflowY: 'auto', padding: '0 12px 20px' }}>
                {pastedAddress && onImportAddress && !addressAlreadyListed && (
                  <button type="button" disabled={importing} onClick={importAddress} style={{
                    width: '100%', minHeight: 48, marginBottom: 5, borderRadius: 13, border: '1px solid rgba(82,227,164,.3)',
                    background: 'rgba(82,227,164,.08)', color: btb.green, padding: '8px 11px', cursor: importing ? 'wait' : 'pointer',
                    fontFamily: 'inherit', fontSize: 11.5, fontWeight: 800, textAlign: 'left',
                  }}>
                    {importing ? 'Checking this chain…' : `Find ${pastedAddress.slice(0, 8)}…${pastedAddress.slice(-6)} on this chain`}
                  </button>
                )}
                {importError && <div style={{ color: btb.loss, fontSize: 11, padding: '4px 8px 9px' }}>{importError}</div>}
                {filtered.slice(0, 200).map(t => (
                  <div key={t.address} onClick={() => { onPick(t); setOpen(false); setQ(''); }} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 8px', borderRadius: 14, cursor: 'pointer',
                  }}>
                    <TokenIcon symbol={t.symbol} size={34} logoUrl={t.logoURI} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: btb.text, fontSize: 14.5, fontWeight: 700 }}>{t.symbol}</div>
                      <div style={{ color: btb.textMuted, fontSize: 11.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
                    </div>
                  </div>
                ))}
                {filtered.length === 0 && !pastedAddress && <div style={{ color: btb.textMuted, fontSize: 13, textAlign: 'center', padding: 24 }}>No tokens found</div>}
              </div>
            </div>
          </div>
        </Portal>
      )}
    </>
  );
}

async function findV4Pools(client: PublicClient, tokenA: Token, tokenB: Token, deployment: V4Deployment): Promise<FoundPool[]> {
  const [c0, c1] = sortCurrencies(toCurrency(tokenA.address), toCurrency(tokenB.address));
  const results = await client.multicall({
    contracts: V4_FEE_TIERS.map(fee => ({
      address: deployment.stateView,
      abi: STATE_VIEW_ABI,
      functionName: 'getSlot0' as const,
      args: [computeV4PoolId(c0, c1, fee, V4_TICK_SPACINGS[fee], NATIVE_CURRENCY)],
    })),
    allowFailure: true,
  });
  const pools: FoundPool[] = [];
  results.forEach((r, i) => {
    if (r.status !== 'success') return;
    const sqrtPriceX96 = (r.result as readonly unknown[])[0] as bigint;
    if (sqrtPriceX96 > 0n) {
      const fee = V4_FEE_TIERS[i];
      pools.push({ protocol: 'uniswap-v4', feeTier: fee, v4PoolId: computeV4PoolId(c0, c1, fee, V4_TICK_SPACINGS[fee], NATIVE_CURRENCY) });
    }
  });
  return pools;
}

async function findV3Pools(
  client: PublicClient,
  protocol: 'uniswap-v3' | 'pancakeswap-v3',
  tokenA: Token,
  tokenB: Token,
  deployment: V3Deployment,
  wrappedNative: `0x${string}`,
): Promise<FoundPool[]> {
  const addrA = toV3Address(tokenA.address, wrappedNative);
  const addrB = toV3Address(tokenB.address, wrappedNative);
  const results = await client.multicall({
    contracts: deployment.feeTiers.map(fee => ({
      address: deployment.factory,
      abi: FACTORY_ABI,
      functionName: 'getPool' as const,
      args: [addrA, addrB, fee],
    })),
    allowFailure: true,
  });
  const pools: FoundPool[] = [];
  results.forEach((r, i) => {
    if (r.status !== 'success') return;
    const addr = r.result as `0x${string}`;
    if (addr !== '0x0000000000000000000000000000000000000000') pools.push({ protocol, feeTier: deployment.feeTiers[i], address: addr });
  });
  return pools;
}

function resolveCrossChainToken(catalog: Token[], chainId: number, symbol: string): Token | null {
  const wanted = symbol.toUpperCase();
  const chainSymbol = CHAIN_META[chainId]?.symbol?.toUpperCase();
  if (wanted === chainSymbol) {
    return catalog.find(token => token.address.toLowerCase() === 'eth') ?? {
      address: 'ETH',
      symbol: CHAIN_META[chainId]?.symbol ?? symbol,
      name: CHAIN_META[chainId]?.name ?? symbol,
      decimals: 18,
      chainId,
    };
  }

  const override = CROSS_CHAIN_TOKEN_OVERRIDES[chainId]?.[wanted];
  if (override) return override;

  const candidates = catalog.filter(token => token.symbol.toUpperCase() === wanted);
  if (candidates.length === 0) return null;
  return [...candidates].sort((a, b) => {
    const verified = Number(Boolean(b.verified)) - Number(Boolean(a.verified));
    if (verified !== 0) return verified;
    const priced = Number(Boolean(b.usdPrice)) - Number(Boolean(a.usdPrice));
    if (priced !== 0) return priced;
    return Number(Boolean(b.logoURI)) - Number(Boolean(a.logoURI));
  })[0];
}

function ResearchTokenPicker({ label, selected, options, selectedChainIds, loading, disabled, onSelect }: {
  label: string;
  selected: ResearchTokenOption | null;
  options: ResearchTokenOption[];
  selectedChainIds: number[];
  loading: boolean;
  disabled: boolean;
  onSelect: (token: ResearchTokenOption) => void;
}) {
  const config = useConfig();
  const { width: sidebarWidth } = useSidebar();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const selectedChainCount = selectedChainIds.length;
  const normalizedQuery = query.trim().toLowerCase();
  const pastedAddress = isAddress(query.trim()) ? query.trim().toLowerCase() as `0x${string}` : null;
  const filtered = normalizedQuery
    ? options.filter(token => token.symbol.toLowerCase().includes(normalizedQuery) || token.name.toLowerCase().includes(normalizedQuery))
    : options;

  async function importAddress() {
    if (!pastedAddress || importing) return;
    setImporting(true);
    setImportError(null);
    try {
      const found = (await Promise.all(selectedChainIds.map(async (selectedChainId): Promise<Token | null> => {
        const client = getPublicClient(config, { chainId: selectedChainId as SupportedChainId });
        return client ? readTokenMetadata(client, selectedChainId, pastedAddress) : null;
      }))).filter((token): token is Token => token != null);
      if (found.length === 0) {
        setImportError('No ERC-20 contract found at this address on the selected chains.');
        return;
      }

      const reference = found[0];
      const matching = found.filter(token =>
        token.symbol.toUpperCase() === reference.symbol.toUpperCase()
        && token.decimals === reference.decimals
      );
      const tokensByChain = Object.fromEntries(matching.map(token => [token.chainId!, token]));
      onSelect({
        symbol: reference.symbol.toUpperCase(),
        name: reference.name,
        chainIds: matching.map(token => token.chainId!),
        tokensByChain,
      });
      setOpen(false);
      setQuery('');
    } finally {
      setImporting(false);
    }
  }

  return (
    <>
      <button type="button" disabled={disabled} onClick={() => setOpen(true)} style={{
        height: 48, minWidth: 0, borderRadius: 13, border: btb.borderSoft, background: btb.surfaceSoft,
        color: btb.text, padding: '0 12px', display: 'flex', alignItems: 'center', gap: 9,
        cursor: disabled ? 'default' : 'pointer', fontFamily: 'inherit', textAlign: 'left',
      }}>
        {selected
          ? <TokenIcon symbol={selected.symbol} size={28} logoUrl={selected.logoURI}/>
          : <div style={{ width: 28, height: 28, borderRadius: 999, border: '1.5px dashed rgba(255,255,255,.22)' }}/>
        }
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', color: btb.textDim, fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .4 }}>{label}</span>
          <span style={{ display: 'block', color: selected ? btb.text : btb.textMuted, fontSize: 12.5, fontWeight: 750, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>
            {selected?.symbol ?? (loading ? 'Loading tokens…' : 'Select token')}
          </span>
        </span>
        <Icon name="down" size={13} color={btb.textMuted}/>
      </button>

      {open && (
        <Portal>
          <div onClick={() => { setOpen(false); setQuery(''); setImportError(null); }} style={{
            position: 'fixed', inset: 0, left: sidebarWidth, zIndex: 320, background: 'rgba(0,0,0,.64)',
            backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '32px 18px', overflowY: 'auto',
          }}>
            <div onClick={event => event.stopPropagation()} style={{ width: '100%', maxWidth: 440, maxHeight: '82vh', display: 'flex', flexDirection: 'column', borderRadius: 24, background: 'rgba(10,10,15,.98)', border: btb.border }}>
              <div style={{ padding: '18px 18px 8px' }}>
                <div style={{ color: btb.text, fontSize: 17, fontWeight: 850 }}>Select {label.toLowerCase()}</div>
                <div style={{ color: btb.textMuted, fontSize: 11, marginTop: 3 }}>{options.length.toLocaleString()} token symbols across {selectedChainCount} selected chain{selectedChainCount === 1 ? '' : 's'}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, borderRadius: 13, border: btb.borderSoft, background: btb.surfaceSoft, padding: '0 12px' }}>
                  <Icon name="search" size={15} color={btb.textMuted}/>
                  <input autoFocus aria-label={`Search ${label.toLowerCase()}`} value={query} onChange={event => { setQuery(event.target.value); setImportError(null); }} placeholder="Search name, symbol, or paste address…" style={{ height: 42, flex: 1, minWidth: 0, border: 0, outline: 'none', background: 'transparent', color: btb.text, fontFamily: 'inherit', fontSize: 13 }}/>
                </div>
              </div>
              <div style={{ overflowY: 'auto', padding: '0 10px 16px' }}>
                {pastedAddress && (
                  <button type="button" disabled={importing} onClick={importAddress} style={{
                    width: '100%', minHeight: 48, marginBottom: 5, borderRadius: 13, border: '1px solid rgba(82,227,164,.3)',
                    background: 'rgba(82,227,164,.08)', color: btb.green, padding: '8px 11px', cursor: importing ? 'wait' : 'pointer',
                    fontFamily: 'inherit', fontSize: 11.5, fontWeight: 800, textAlign: 'left',
                  }}>
                    {importing ? `Checking ${selectedChainCount} chains…` : `Find ${pastedAddress.slice(0, 8)}…${pastedAddress.slice(-6)} on selected chains`}
                  </button>
                )}
                {importError && <div style={{ color: btb.loss, fontSize: 11, padding: '4px 8px 9px' }}>{importError}</div>}
                {filtered.slice(0, 250).map(token => (
                  <button key={token.symbol} type="button" onClick={() => { onSelect(token); setOpen(false); setQuery(''); }} style={{
                    width: '100%', minHeight: 52, border: 0, borderRadius: 13, background: selected?.symbol === token.symbol ? 'rgba(82,227,164,.08)' : 'transparent',
                    color: btb.text, padding: '7px 9px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                  }}>
                    <TokenIcon symbol={token.symbol} size={32} logoUrl={token.logoURI}/>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 13, fontWeight: 800 }}>{token.symbol}</span>
                      <span style={{ display: 'block', color: btb.textMuted, fontSize: 10.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>{token.name}</span>
                    </span>
                    <span style={{ color: token.chainIds.length === selectedChainCount ? btb.green : btb.textDim, fontSize: 10.5, fontWeight: 750 }}>{token.chainIds.length}/{selectedChainCount} chains</span>
                  </button>
                ))}
                {filtered.length === 0 && <div style={{ color: btb.textMuted, textAlign: 'center', fontSize: 12, padding: 28 }}>No matching token in the selected chain catalogs.</div>}
              </div>
            </div>
          </div>
        </Portal>
      )}
    </>
  );
}

function CrossChainResearch({ chains, isMobile }: {
  chains: readonly { id: number; name: string }[];
  isMobile: boolean;
}) {
  const config = useConfig();
  const { pools: earnPools } = useDiscoverPools();
  const defaultChainIds = [1, 8453, 4663, 4326].filter(id => chains.some(chain => chain.id === id));
  const [selectedChains, setSelectedChains] = useState<number[]>(defaultChainIds);
  const [pairs, setPairs] = useState<CrossChainPair[]>([]);
  const [pairTokenA, setPairTokenA] = useState<ResearchTokenOption | null>(null);
  const [pairTokenB, setPairTokenB] = useState<ResearchTokenOption | null>(null);
  const [pairTokenOptions, setPairTokenOptions] = useState<ResearchTokenOption[]>([]);
  const [loadingPairTokens, setLoadingPairTokens] = useState(true);
  const [pairError, setPairError] = useState<string | null>(null);
  const [results, setResults] = useState<CrossChainResearchResult[]>([]);
  const [researching, setResearching] = useState(false);
  const [rankBy, setRankBy] = useState<'volume' | 'tvl' | 'apr'>('volume');

  useEffect(() => {
    const controller = new AbortController();
    if (selectedChains.length === 0) {
      setPairTokenOptions([]);
      setLoadingPairTokens(false);
      setPairTokenA(null);
      setPairTokenB(null);
      return () => controller.abort();
    }

    setLoadingPairTokens(true);
    void Promise.all(selectedChains.map(async selectedChainId => {
      try {
        const response = await fetch(`/api/swap-tokens?chainId=${selectedChainId}`, { signal: controller.signal });
        if (!response.ok) return [] as Token[];
        const body = await response.json() as { tokens?: Token[] };
        const catalog = Array.isArray(body.tokens) ? body.tokens : [];
        const meta = CHAIN_META[selectedChainId];
        const native: Token = { address: 'ETH', symbol: meta?.symbol ?? 'ETH', name: meta?.name ?? 'Native token', decimals: 18, chainId: selectedChainId };
        return [native, ...catalog, ...Object.values(CROSS_CHAIN_TOKEN_OVERRIDES[selectedChainId] ?? {})];
      } catch (cause) {
        if ((cause as Error).name === 'AbortError') throw cause;
        return [] as Token[];
      }
    })).then(catalogs => {
      if (controller.signal.aborted) return;
      const aggregated = new Map<string, { option: ResearchTokenOption; chainIds: Set<number>; quality: number }>();
      catalogs.forEach((catalog, index) => {
        const selectedChainId = selectedChains[index];
        const seenOnChain = new Set<string>();
        for (const token of catalog) {
          const symbol = token.symbol?.trim().toUpperCase();
          if (!symbol || symbol.length > 16 || seenOnChain.has(symbol)) continue;
          seenOnChain.add(symbol);
          const quality = Number(Boolean(token.verified)) * 4 + Number(Boolean(token.usdPrice)) * 2 + Number(Boolean(token.logoURI));
          const existing = aggregated.get(symbol);
          if (!existing) {
            aggregated.set(symbol, {
              option: { symbol, name: token.name || token.symbol, logoURI: token.logoURI, chainIds: [] },
              chainIds: new Set([selectedChainId]),
              quality,
            });
          } else {
            existing.chainIds.add(selectedChainId);
            if (quality > existing.quality) {
              existing.option = { ...existing.option, name: token.name || token.symbol, logoURI: token.logoURI };
              existing.quality = quality;
            }
          }
        }
      });
      const options = [...aggregated.values()].map(entry => ({ ...entry.option, chainIds: [...entry.chainIds] }))
        .sort((a, b) => b.chainIds.length - a.chainIds.length || a.symbol.localeCompare(b.symbol));
      setPairTokenOptions(options);
      setPairTokenA(current => current && options.some(option => option.symbol === current.symbol) ? current : null);
      setPairTokenB(current => current && options.some(option => option.symbol === current.symbol) ? current : null);
    }).catch(cause => {
      if ((cause as Error).name !== 'AbortError' && !controller.signal.aborted) setPairTokenOptions([]);
    }).finally(() => { if (!controller.signal.aborted) setLoadingPairTokens(false); });

    return () => controller.abort();
  }, [selectedChains]);

  const toggleChain = (id: number) => {
    if (researching) return;
    setSelectedChains(current => current.includes(id) ? current.filter(chainId => chainId !== id) : [...current, id]);
    setResults([]);
  };
  const addPair = () => {
    if (researching) return;
    if (!pairTokenA || !pairTokenB) {
      setPairError('Select two tokens first.');
      return;
    }
    const tokenA = pairTokenA.symbol;
    const tokenB = pairTokenB.symbol;
    if (tokenA === tokenB) {
      setPairError('Choose two different token symbols.');
      return;
    }
    const normalized = [tokenA, tokenB].sort();
    const id = `${normalized[0].toLowerCase()}-${normalized[1].toLowerCase()}`;
    if (pairs.some(pair => pair.id === id)) {
      setPairError(`${tokenA} / ${tokenB} is already selected.`);
      return;
    }
    setPairs(current => [...current, {
      id,
      tokenA,
      tokenB,
      label: `${tokenA} / ${tokenB}`,
      tokenAByChain: pairTokenA.tokensByChain,
      tokenBByChain: pairTokenB.tokensByChain,
    }]);
    setPairTokenA(null);
    setPairTokenB(null);
    setPairError(null);
    setResults([]);
  };
  const removePair = (id: string) => {
    if (researching) return;
    setPairs(current => current.filter(pair => pair.id !== id));
    setResults([]);
  };

  async function researchAcrossChains() {
    const earnCatalog = earnPools.length > 0 ? earnPools : await waitForDiscoverPools();
    const tasks = selectedChains.flatMap(selectedChainId => {
      const selectedChain = chains.find(chain => chain.id === selectedChainId);
      if (!selectedChain) return [];
      return pairs.map(pair => ({
        key: `${selectedChainId}:${pair.id}`,
        chainId: selectedChainId,
        chainName: selectedChain.name,
        pair,
      }));
    });
    if (tasks.length === 0) return;

    const initial = tasks.map<CrossChainResearchResult>(task => ({
      ...task,
      status: 'queued',
      pools: [],
    }));
    setResults(initial);
    setResearching(true);

    const catalogs = new Map<number, Promise<Token[]>>();
    const loadCatalog = (targetChainId: number) => {
      const existing = catalogs.get(targetChainId);
      if (existing) return existing;
      const request = fetch(`/api/swap-tokens?chainId=${targetChainId}`)
        .then(async response => {
          if (!response.ok) throw new Error(`Token catalog ${response.status}`);
          const body = await response.json() as { tokens?: Token[] };
          return Array.isArray(body.tokens) ? body.tokens : [];
        });
      catalogs.set(targetChainId, request);
      return request;
    };
    const updateResult = (key: string, update: Partial<CrossChainResearchResult>) => {
      setResults(current => current.map(result => result.key === key ? { ...result, ...update } : result));
    };

    let cursor = 0;
    const worker = async () => {
      while (cursor < tasks.length) {
        const task = tasks[cursor++];
        updateResult(task.key, { status: 'loading', message: 'Resolving local token addresses…' });
        try {
          const catalog = await loadCatalog(task.chainId);
          const tokenA = task.pair.tokenAByChain
            ? task.pair.tokenAByChain[task.chainId] ?? null
            : resolveCrossChainToken(catalog, task.chainId, task.pair.tokenA);
          const tokenB = task.pair.tokenBByChain
            ? task.pair.tokenBByChain[task.chainId] ?? null
            : resolveCrossChainToken(catalog, task.chainId, task.pair.tokenB);
          if (!tokenA || !tokenB) {
            const missing = [!tokenA && task.pair.tokenA, !tokenB && task.pair.tokenB].filter(Boolean).join(' and ');
            updateResult(task.key, {
              status: 'unavailable',
              tokenA: tokenA ?? undefined,
              tokenB: tokenB ?? undefined,
              message: `${missing} is not available in the ${task.chainName} token catalog.`,
            });
            continue;
          }

          updateResult(task.key, { tokenA, tokenB, message: 'Searching indexed DEX liquidity…' });
          const wrappedNative = WRAPPED_NATIVE_FALLBACKS[task.chainId] ?? WETH;
          const marketTokenA = toV3Address(tokenA.address, wrappedNative);
          const marketTokenB = toV3Address(tokenB.address, wrappedNative);
          const indexedPoolsRaw = await searchMarketPools(
            marketTokenA,
            marketTokenB,
            100,
            CHAIN_DATA_NETWORKS[task.chainId],
          );
          updateResult(task.key, {
            tokenA,
            tokenB,
            pools: indexedPoolsRaw,
            message: `${indexedPoolsRaw.length} pools found · loading missing APRs on-chain…`,
          });
          const client = getPublicClient(config, { chainId: task.chainId as SupportedChainId });
          const pools = await enrichMarketPools(
            client,
            indexedPoolsRaw,
            earnCatalog,
            task.chainName,
            marketTokenA,
            marketTokenB,
          );
          updateResult(task.key, {
            status: 'complete',
            tokenA,
            tokenB,
            pools,
            message: pools.length === 0
              ? 'No indexed pool found for this pair.'
              : `${pools.length} pools across ${marketPoolDexCount(pools)} DEX${marketPoolDexCount(pools) === 1 ? '' : 's'}`,
          });
        } catch (cause) {
          updateResult(task.key, {
            status: 'error',
            message: `Research failed: ${(cause as Error).message?.slice(0, 100) || 'provider unavailable'}`,
          });
        }
      }
    };

    await Promise.all(Array.from({ length: Math.min(3, tasks.length) }, () => worker()));
    setResearching(false);
  }

  const completed = results.filter(result => result.status === 'complete' || result.status === 'unavailable' || result.status === 'error').length;
  const foundPools = results.reduce((sum, result) => sum + result.pools.length, 0);
  const metricValue = (pool: MarketPool) => rankBy === 'volume'
    ? pool.volume24hUsd
    : rankBy === 'apr' ? (pool.aprPct ?? -1) : pool.tvlUsd;
  const rankedPools = useMemo(() => results.flatMap(result => result.pools.map(pool => ({ result, pool })))
    .sort((a, b) => {
      const aValue = rankBy === 'volume' ? a.pool.volume24hUsd : rankBy === 'apr' ? (a.pool.aprPct ?? -1) : a.pool.tvlUsd;
      const bValue = rankBy === 'volume' ? b.pool.volume24hUsd : rankBy === 'apr' ? (b.pool.aprPct ?? -1) : b.pool.tvlUsd;
      return bValue - aValue;
    })
    .slice(0, 12), [rankBy, results]);
  const winner = rankedPools[0];
  const runnerUp = rankedPools[1];
  const winnerValue = winner ? metricValue(winner.pool) : 0;
  const runnerUpValue = runnerUp ? metricValue(runnerUp.pool) : 0;
  const winnerLead = runnerUpValue > 0 ? winnerValue / runnerUpValue : null;
  const rankLabel = rankBy === 'volume' ? '24h volume' : rankBy === 'tvl' ? 'TVL' : 'APR';
  const winnerMetric = winner
    ? rankBy === 'volume' ? fmtCompactUsd(winner.pool.volume24hUsd)
      : rankBy === 'tvl' ? fmtCompactUsd(winner.pool.tvlUsd)
        : winner.pool.aprPct != null ? fmtApr(winner.pool.aprPct) : '—'
    : '—';

  return (
    <>
      <Glass padding={20} radius={22}>
        <div style={{ color: btb.text, fontSize: 15, fontWeight: 800 }}>Cross-chain LP research</div>
        <div style={{ color: btb.textMuted, fontSize: 12, marginTop: 5, lineHeight: 1.5 }}>
          Select several networks and pair types. Each chain uses its own token contracts; results appear as each search finishes.
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 18, marginBottom: 9 }}>
          <span style={{ color: btb.textDim, fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .5 }}>Networks</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" disabled={researching} onClick={() => { setSelectedChains(chains.map(chain => chain.id)); setResults([]); }} style={{ border: 0, background: 'transparent', color: btb.textMuted, font: 'inherit', fontSize: 11, cursor: 'pointer' }}>Select all</button>
            <button type="button" disabled={researching} onClick={() => { setSelectedChains([]); setResults([]); }} style={{ border: 0, background: 'transparent', color: btb.textMuted, font: 'inherit', fontSize: 11, cursor: 'pointer' }}>Clear</button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))', gap: 7 }}>
          {chains.map(chain => {
            const selected = selectedChains.includes(chain.id);
            return (
              <button key={chain.id} type="button" aria-pressed={selected} disabled={researching} onClick={() => toggleChain(chain.id)} style={{
                height: 39, minWidth: 0, borderRadius: 12, border: selected ? '1px solid rgba(82,227,164,.42)' : btb.borderSoft,
                background: selected ? 'rgba(82,227,164,.1)' : btb.surfaceSoft, color: selected ? btb.text : btb.textMuted,
                padding: '0 9px', display: 'flex', alignItems: 'center', gap: 7, cursor: researching ? 'default' : 'pointer', fontFamily: 'inherit',
              }}>
                <ChainLogo chainId={chain.id} size={20}/>
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11.5, fontWeight: selected ? 800 : 650 }}>{chain.name}</span>
              </button>
            );
          })}
        </div>

        <div style={{ color: btb.textDim, fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .5, marginTop: 18, marginBottom: 9 }}>Your pairs</div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr auto', gap: 8 }}>
          <ResearchTokenPicker label="First token" selected={pairTokenA} options={pairTokenOptions} selectedChainIds={selectedChains} loading={loadingPairTokens} disabled={researching || loadingPairTokens || selectedChains.length === 0} onSelect={token => { setPairTokenA(token); setPairError(null); }}/>
          <ResearchTokenPicker label="Second token" selected={pairTokenB} options={pairTokenOptions} selectedChainIds={selectedChains} loading={loadingPairTokens} disabled={researching || loadingPairTokens || selectedChains.length === 0} onSelect={token => { setPairTokenB(token); setPairError(null); }}/>
          <button type="button" disabled={researching || !pairTokenA || !pairTokenB} onClick={addPair} style={{
            height: 48, gridColumn: isMobile ? '1 / -1' : undefined, borderRadius: 12, border: '1px solid rgba(82,227,164,.32)',
            background: 'rgba(82,227,164,.09)', color: btb.green, padding: '0 15px', cursor: researching || !pairTokenA || !pairTokenB ? 'default' : 'pointer',
            opacity: !pairTokenA || !pairTokenB ? .55 : 1,
            fontFamily: 'inherit', fontSize: 11.5, fontWeight: 800,
          }}>Add pair</button>
        </div>
        <div style={{ color: btb.textMuted, fontSize: 10.5, marginTop: 7 }}>
          {loadingPairTokens ? 'Loading token catalogs for the selected networks…' : `${pairTokenOptions.length.toLocaleString()} searchable token symbols found across the selected networks.`}
        </div>
        {pairError && <div style={{ color: btb.amber, fontSize: 11, marginTop: 7 }}>{pairError}</div>}
        {pairs.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
            {pairs.map(pair => (
              <button key={pair.id} type="button" disabled={researching} onClick={() => removePair(pair.id)} title={`Remove ${pair.label}`} style={{
                height: 32, borderRadius: 999, border: '1px solid rgba(82,227,164,.35)', background: 'rgba(82,227,164,.09)',
                color: btb.text, padding: '0 11px', cursor: researching ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 11.5, fontWeight: 750,
              }}>{pair.label} <span style={{ color: btb.textMuted, marginLeft: 5 }}>×</span></button>
            ))}
          </div>
        )}
        {pairs.length === 0 && <div style={{ color: btb.textMuted, fontSize: 11, marginTop: 8 }}>Add one or more token pairs to research across the selected networks.</div>}

        <Button variant="success" size="md" onClick={researchAcrossChains} disabled={selectedChains.length === 0 || pairs.length === 0} loading={researching} style={{ borderRadius: 12, marginTop: 18 }}>
          {researching ? `Researching ${completed}/${results.length} combinations…` : `Research ${selectedChains.length * pairs.length} combinations`}
        </Button>
        {results.length > 0 && (
          <div aria-live="polite" style={{ color: researching ? btb.textMuted : btb.green, fontSize: 11.5, marginTop: 9 }}>
            {researching ? `${completed} of ${results.length} complete · ${foundPools} pools found so far` : `${foundPools} pools across ${results.length} chain/pair combinations`}
          </div>
        )}
      </Glass>

      {rankedPools.length > 0 && (
        <Glass padding={0} radius={18} style={{ overflow: 'hidden' }}>
          <div style={{ minHeight: 55, padding: '10px 15px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: btb.borderSoft }}>
            <div style={{ flex: 1 }}>
              <div style={{ color: btb.text, fontSize: 13.5, fontWeight: 800 }}>Best opportunities across selected chains</div>
              <div style={{ color: btb.textMuted, fontSize: 10.5, marginTop: 2 }}>One comparable ranking from every completed search</div>
            </div>
            <div style={{ display: 'flex', padding: 3, borderRadius: 10, background: btb.surfaceSoft, border: btb.borderSoft }}>
              {(['volume', 'tvl', 'apr'] as const).map(metric => (
                <button key={metric} type="button" onClick={() => setRankBy(metric)} style={{
                  height: 27, minWidth: metric === 'volume' ? 58 : 42, border: 0, borderRadius: 8, background: rankBy === metric ? 'rgba(255,255,255,.1)' : 'transparent',
                  color: rankBy === metric ? btb.text : btb.textMuted, cursor: 'pointer', fontFamily: 'inherit', fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase',
                }}>{metric}</button>
              ))}
            </div>
          </div>
          {winner && (
            <div style={{ margin: 12, padding: '13px 14px', borderRadius: 14, border: '1px solid rgba(82,227,164,.3)', background: 'rgba(82,227,164,.08)', display: 'flex', alignItems: 'center', gap: 11 }}>
              <div style={{ width: 34, height: 34, flexShrink: 0, borderRadius: 12, display: 'grid', placeItems: 'center', background: 'rgba(82,227,164,.14)', color: btb.green, fontSize: 17 }}>★</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: btb.green, fontSize: 10.5, fontWeight: 850, textTransform: 'uppercase', letterSpacing: .5 }}>{researching ? 'Current winner' : 'Winner'} by {rankLabel}</div>
                <div style={{ color: btb.text, fontSize: 13.5, fontWeight: 850, marginTop: 3, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span>{winner.result.pair.label} ·</span>
                  <DexLogo name={winner.pool.dexLabel} size={16}/>
                  <span>{winner.pool.dexLabel}</span>
                </div>
                <div style={{ color: btb.textMuted, fontSize: 11, marginTop: 3 }}>
                  {winnerMetric} {rankLabel}{winnerLead != null ? ` · ${winnerLead.toLocaleString(undefined, { maximumFractionDigits: 2 })}× the runner-up` : ' · only comparable pool so far'}
                </div>
              </div>
              <ChainLogo chainId={winner.result.chainId} size={30}/>
            </div>
          )}
          {!isMobile && (
            <div style={{ display: 'grid', gridTemplateColumns: CROSS_CHAIN_RANK_COLUMNS, gap: 10, padding: '7px 15px', borderTop: btb.borderSoft, borderBottom: btb.borderSoft }}>
              {['Pool', 'TVL', '24h volume', 'APR', ''].map(label => <span key={label} style={{ color: btb.textDim, fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .35 }}>{label}</span>)}
            </div>
          )}
          {rankedPools.map(({ result, pool }, index) => {
            const simulateHref = result.tokenA && result.tokenB
              ? `/simulate?chain=${result.chainId}&tokenA=${encodeURIComponent(result.tokenA.address)}&tokenB=${encodeURIComponent(result.tokenB.address)}`
              : null;
            return (
              <div key={`${result.key}:${pool.address}`} style={{
                display: 'grid', gridTemplateColumns: isMobile ? '1fr auto' : CROSS_CHAIN_RANK_COLUMNS,
                alignItems: 'center', gap: 10, padding: '10px 15px',
                borderBottom: index < rankedPools.length - 1 ? '1px solid rgba(255,255,255,.04)' : undefined,
                background: index === 0 ? 'rgba(82,227,164,.045)' : undefined,
              }}>
                <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ChainLogo chainId={result.chainId} size={22}/>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: btb.text, fontSize: 12, fontWeight: 750, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{result.pair.label}</div>
                    <div style={{ color: btb.textMuted, fontSize: 10.5, marginTop: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <DexLogo name={pool.dexLabel} size={14}/>
                      <span>{pool.dexLabel}</span>
                    </div>
                  </div>
                </div>
                {!isMobile && <span style={{ color: btb.text, fontSize: 12, fontWeight: 650 }}>{fmtCompactUsd(pool.tvlUsd)}</span>}
                {!isMobile && <span style={{ color: btb.text, fontSize: 12, fontWeight: 650 }}>{fmtCompactUsd(pool.volume24hUsd)}</span>}
                {!isMobile && <span title={pool.aprLabel} style={{ color: pool.aprPct != null ? btb.amber : btb.textDim, fontSize: 12, fontWeight: 750 }}>{marketAprText(pool)}</span>}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {simulateHref && <a href={simulateHref} style={{ color: btb.green, fontSize: 11, fontWeight: 750, textDecoration: 'none' }}>Simulate</a>}
                </div>
                {isMobile && <MobilePoolMetrics pool={pool}/>}
              </div>
            );
          })}
        </Glass>
      )}

      {results.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {results.map(result => {
            const topPools = result.pools.slice(0, 8);
            const simulateHref = result.tokenA && result.tokenB
              ? `/simulate?chain=${result.chainId}&tokenA=${encodeURIComponent(result.tokenA.address)}&tokenB=${encodeURIComponent(result.tokenB.address)}`
              : null;
            return (
              <Glass key={result.key} padding={0} radius={18} style={{ overflow: 'hidden' }}>
                <div style={{ minHeight: 58, padding: '11px 15px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: topPools.length > 0 ? btb.borderSoft : undefined }}>
                  <ChainLogo chainId={result.chainId} size={28}/>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: btb.text, fontSize: 13.5, fontWeight: 800 }}>{result.pair.label}</div>
                    <div style={{ color: result.status === 'error' || result.status === 'unavailable' ? btb.amber : btb.textMuted, fontSize: 11, marginTop: 2 }}>
                      {result.status === 'queued' ? 'Waiting…' : result.status === 'loading' ? result.message : result.message ?? `${result.pools.length} pool${result.pools.length === 1 ? '' : 's'} found`}
                    </div>
                  </div>
                  {result.status === 'loading' && <span className="spin" style={{ width: 12, height: 12, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,.22)', borderTopColor: btb.text }}/>}
                  {simulateHref && result.status === 'complete' && (
                    <a href={simulateHref} style={{ height: 31, padding: '0 12px', borderRadius: 12, border: btb.borderSoft, display: 'inline-flex', alignItems: 'center', color: btb.text, background: btb.surfaceSoft, textDecoration: 'none', fontSize: 11.5, fontWeight: 750 }}>
                      Full simulate
                    </a>
                  )}
                </div>
                {topPools.map((pool, index) => (
                  <div key={pool.address} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.2fr .8fr .8fr', alignItems: 'center', gap: 10, padding: '9px 15px', borderBottom: index < topPools.length - 1 ? '1px solid rgba(255,255,255,.04)' : undefined, background: index === 0 ? 'rgba(82,227,164,.035)' : undefined }}>
                    <span style={{ color: btb.text, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <DexLogo name={pool.dexLabel} size={16}/>
                      <span>{pool.dexLabel}{pool.feePct != null ? ` · ${(pool.feePct * 100).toLocaleString(undefined, { maximumFractionDigits: 3 })}%` : ''}</span>
                    </span>
                    {!isMobile && <span style={{ color: btb.text, fontSize: 12, fontWeight: 650 }}>{fmtCompactUsd(pool.tvlUsd)}</span>}
                    {!isMobile && <span title={pool.aprLabel} style={{ color: pool.aprPct != null ? btb.amber : btb.textDim, fontSize: 12, fontWeight: 700 }}>{marketAprText(pool)}</span>}
                    {isMobile && <MobilePoolMetrics pool={pool}/>}
                  </div>
                ))}
              </Glass>
            );
          })}
        </div>
      )}
    </>
  );
}

export function SimulateScreen() {
  const config = useConfig();
  const { chainId: walletChainId } = useConnection();
  const { isMobile } = useSidebar();
  const { tokens, positions } = useTokenStore();
  const { pools: sharedEarnPools } = useDiscoverPools();
  const [mode, setMode] = useState<SimulateMode>('single');
  const urlChain = typeof window !== 'undefined' ? Number(new URLSearchParams(window.location.search).get('chain')) : 0;
  const initialChain = Number.isFinite(urlChain) && KYBER_CHAINS[urlChain]
    ? urlChain
    : walletChainId && KYBER_CHAINS[walletChainId] ? walletChainId : 1;
  const [chainId, setChainId] = useState(initialChain);
  const [listedTokens, setListedTokens] = useState<Token[]>([]);
  const [loadingTokens, setLoadingTokens] = useState(true);
  const { setThemeChainId } = useChainTheme();
  const networks = CHAIN_DATA_NETWORKS[chainId] ?? CHAIN_DATA_NETWORKS[1];
  const chainName = CHAIN_META[chainId]?.name ?? SUPPORTED_CHAINS.find(chain => chain.id === chainId)?.name ?? 'Ethereum';
  const availableChains = SUPPORTED_CHAINS.filter(chain => KYBER_CHAINS[chain.id]);
  const researchChains = availableChains.filter(chain => CHAIN_DATA_NETWORKS[chain.id]);
  const chainTokens = useMemo(() => {
    const merged = new Map<string, Token>();
    const add = (token: Token) => {
      if ((token.chainId ?? 1) !== chainId) return;
      const address = token.address.toLowerCase() === 'eth' ? 'ETH' : token.address.toLowerCase();
      merged.set(address.toLowerCase(), { ...merged.get(address.toLowerCase()), ...token, address, chainId });
    };
    for (const token of listedTokens) add(token);
    for (const token of tokens) add(token);
    for (const token of positions) add(token);
    return [...merged.values()];
  }, [chainId, listedTokens, positions, tokens]);
  const wrappedNative = useMemo(() => {
    const nativeSymbol = CHAIN_META[chainId]?.symbol?.toUpperCase() ?? 'ETH';
    const wanted = new Set([`W${nativeSymbol}`, nativeSymbol === 'MATIC' ? 'WPOL' : '', nativeSymbol === 'S' ? 'WS' : '']);
    const listed = chainTokens.find(token => wanted.has(token.symbol.toUpperCase()) && token.address.toLowerCase() !== 'eth');
    return (listed?.address ?? WRAPPED_NATIVE_FALLBACKS[chainId] ?? WETH) as `0x${string}`;
  }, [chainId, chainTokens]);
  const [presetPair] = useState(() => {
    if (typeof window === 'undefined') return { a: null, b: null };
    const params = new URLSearchParams(window.location.search);
    return { a: params.get('tokenA')?.toLowerCase() ?? null, b: params.get('tokenB')?.toLowerCase() ?? null };
  });
  const [tokenA, setTokenA] = useState<Token | null>(null);
  const [tokenB, setTokenB] = useState<Token | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [found, setFound] = useState<FoundPool[] | null>(null);
  const [sheetFee, setSheetFee] = useState<FoundPool | null>(null);
  const appliedPair = useRef(false);
  const autoComparedPair = useRef(false);

  useEffect(() => {
    setThemeChainId(chainId);
  }, [chainId, setThemeChainId]);

  useEffect(() => {
    const controller = new AbortController();
    setLoadingTokens(true);
    fetch(`/api/swap-tokens?chainId=${chainId}`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error(`Token catalog ${response.status}`);
        return response.json() as Promise<{ tokens?: Token[] }>;
      })
      .then(body => setListedTokens(Array.isArray(body.tokens) ? body.tokens : []))
      .catch(error => { if ((error as Error).name !== 'AbortError') setListedTokens([]); })
      .finally(() => { if (!controller.signal.aborted) setLoadingTokens(false); });
    return () => controller.abort();
  }, [chainId]);

  function selectChain(nextChainId: number) {
    if (nextChainId === chainId) return;
    setChainId(nextChainId);
    setTokenA(null);
    setTokenB(null);
    setFound(null);
    setError(null);
    setProgress(null);
    setSheetFee(null);
    appliedPair.current = true;
    autoComparedPair.current = false;
    const params = new URLSearchParams(window.location.search);
    params.set('chain', String(nextChainId));
    params.delete('tokenA');
    params.delete('tokenB');
    window.history.replaceState(null, '', `/simulate?${params.toString()}`);
  }

  async function importSingleChainToken(address: string): Promise<Token | null> {
    const client = getPublicClient(config, { chainId: chainId as SupportedChainId });
    return client ? readTokenMetadata(client, chainId, address) : null;
  }

  // Discover links here with the pool's exact underlying-token addresses.
  // Some discovered assets are not in our curated picker, so resolve missing
  // metadata from the selected chain before starting the comparison.
  useEffect(() => {
    if (appliedPair.current || loadingTokens) return;
    const { a, b } = presetPair;
    if (!a || !b) return;

    let cancelled = false;
    const nativeSymbol = CHAIN_META[chainId]?.symbol ?? 'ETH';
    const nativeToken = chainTokens.find(token => token.address.toLowerCase() === 'eth') ?? {
      address: 'ETH',
      symbol: nativeSymbol,
      name: nativeSymbol,
      decimals: 18,
      chainId,
    };

    async function resolveToken(address: string): Promise<Token | null> {
      const normalized = address.toLowerCase();
      if (
        normalized === 'eth'
        || normalized === zeroAddress
        || normalized === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
        || normalized === wrappedNative.toLowerCase()
      ) {
        return nativeToken;
      }

      const listed = chainTokens.find(token => token.address.toLowerCase() === normalized);
      if (listed) return listed;
      if (!isAddress(address)) return null;

      const client = getPublicClient(config, { chainId: chainId as SupportedChainId });
      return client ? readTokenMetadata(client, chainId, normalized) : null;
    }

    void Promise.all([resolveToken(a), resolveToken(b)]).then(([presetA, presetB]) => {
      if (cancelled) return;
      if (!presetA || !presetB) {
        setError(`Couldn't load the linked token pair on ${chainName}.`);
        return;
      }
      appliedPair.current = true;
      setTokenA(presetA);
      setTokenB(presetB);
    });

    return () => { cancelled = true; };
  }, [chainId, chainName, chainTokens, config, loadingTokens, presetPair, wrappedNative]);

  const canSearch = !!tokenA && !!tokenB && tokenA.address.toLowerCase() !== tokenB.address.toLowerCase();

  async function findPools() {
    if (!tokenA || !tokenB) return;
    setError(null);
    setFound([]);
    setSheetFee(null);
    setLoading(true);
    setProgress(`Checking pools on ${chainName}…`);
    try {
      const client = getPublicClient(config, { chainId: chainId as SupportedChainId });
      if (!client) throw new Error('No RPC client available');
      const uniswapV3 = uniswapV3DeploymentForChain(chainId);
      const uniswapV4 = chainId === 4663 ? ROBINHOOD_UNISWAP_V4 : UNISWAP_V4;

      // Full-market pool discovery (GeckoTerminal + DexScreener) runs in
      // parallel with the on-chain probes — it finds pools on DEXes the
      // probes can't (Uniswap V2, SushiSwap, Balancer, …).
      const externalP = searchMarketPools(
        toV3Address(tokenA.address, wrappedNative),
        toV3Address(tokenB.address, wrappedNative),
        100,
        networks,
      )
        .then(async marketPools => {
          setFound(current => mergeFoundPools(current ?? [], marketPoolRows(marketPools)));
          if (marketPools.length > 0) {
            const dexCount = marketPoolDexCount(marketPools);
            setProgress(`Found ${marketPools.length} pools across ${dexCount} DEX${dexCount === 1 ? '' : 's'} · loading TVL and APR…`);
          }
          const enriched = await enrichMarketPools(
            client,
            marketPools,
            sharedEarnPools.length > 0 ? sharedEarnPools : await waitForDiscoverPools(),
            chainName,
            toV3Address(tokenA.address, wrappedNative),
            toV3Address(tokenB.address, wrappedNative),
          );
          setFound(current => mergeFoundPools(current ?? [], marketPoolRows(enriched)));
          return enriched;
        })
        .catch(() => []);

      // Compare across every protocol we can act on in one search, instead
      // of making the user re-run this per protocol tab. Real TVL/APR (and
      // any non-standard V4 fee tiers) come from the same pool data Discover
      // uses, merged in below — otherwise this table would only ever show
      // fee-split theory, not which pool is actually worth more.
      // Each check is retried once and its failure tracked separately from a
      // genuine "no pool exists" — an RPC hiccup must never be presented as
      // the pair having no pool when we simply couldn't check.
      const checks: { label: string; run: () => Promise<FoundPool[]> }[] = [
        ...(uniswapV3 ? [{ label: 'Uniswap V3', run: () => findV3Pools(client, 'uniswap-v3' as const, tokenA, tokenB, uniswapV3, wrappedNative) }] : []),
        { label: 'Uniswap V4', run: () => findV4Pools(client, tokenA, tokenB, uniswapV4) },
        { label: 'PancakeSwap V3', run: () => findV3Pools(client, 'pancakeswap-v3', tokenA, tokenB, PANCAKE_V3_DEPLOYMENT, wrappedNative) },
      ];
      const results = await Promise.all(checks.map(c => withRetry(c.run).then(
        (v): { ok: true; pools: FoundPool[] } => {
          setFound(current => mergeFoundPools(current ?? [], v));
          if (v.length > 0) {
            setProgress(`Found ${v.length} ${c.label} pool${v.length > 1 ? 's' : ''} · loading TVL and APR…`);
          }
          return { ok: true, pools: v };
        },
        (e): { ok: false; error: Error } => ({ ok: false, error: e as Error }),
      )));
      const failedChecks = checks.filter((_, i) => !results[i].ok).map(c => c.label);
      const probed = results.flatMap(r => (r.ok ? r.pools : []));
      setProgress(probed.length > 0 ? `Found ${probed.length} on-chain pools · loading TVL and APR…` : 'Checking market liquidity…');

      // No TVL floor — a pool we just confirmed exists on-chain should still
      // get its real (if small) TVL/APR rather than being silently dropped.
      const earnPoolsRaw = chainId === 1
        ? await withRetry(() => getEarnPools(0, client)).catch(() => [] as EarnPool[])
        : [] as EarnPool[];
      // Same ±5%-range APR upgrade Discover applies — otherwise this table's
      // APR would be the (much lower, misleading) whole-pool figure for
      // indexer-sourced pools while Discover shows the range-adjusted one.
      const earnPools = chainId === 1
        ? await addRangeAprs(client, earnPoolsRaw).catch(() => earnPoolsRaw)
        : earnPoolsRaw;
      const merged = mergeWithEarnPools(probed, earnPools, tokenA, tokenB, chainName);

      // DeFiLlama only indexes a subset of pools (PancakeSwap-on-Ethereum
      // especially sparsely) — for anything it missed, fall back to
      // GeckoTerminal's real on-chain reserve/volume figures using the
      // resolved pool address, so a pool doesn't just show blank dashes.
      // The APR fallback is whole-pool fees/TVL, not the ±5% range-adjusted
      // figure used everywhere else, so it's tagged and rendered distinctly
      // rather than presented as the same metric.
      const needsData = merged.filter(f => (f.tvlUsd == null || f.apy == null) && f.address);
      if (needsData.length > 0) {
        const stats = await fetchPoolStats(needsData.map(f => f.address!), networks.gecko).catch(() => ({} as Record<string, { tvlUsd: number; volume24hUsd: number; aprPct: number | null }>));
        for (const f of merged) {
          if (!f.address) continue;
          const s = stats[f.address.toLowerCase()];
          if (!s) continue;
          if (f.tvlUsd == null) f.tvlUsd = s.tvlUsd;
          if (f.apy == null && s.aprPct != null) { f.apy = s.aprPct; f.aprIsUnranged = true; }
          if (f.fees24hUsd == null && s.volume24hUsd > 0 && f.feeTier > 0 && !(f.feeTier & DYNAMIC_FEE_FLAG)) {
            f.fees24hUsd = s.volume24hUsd * (f.feeTier / 1_000_000);
          }
        }
      }
      // Third/fourth fallback: DexScreener + DexPaprika (both free, keyless,
      // index V4 by the same poolId hash). Neither has a reliable per-pool fee
      // tier of its own, so their volume is only ever combined with the fee
      // tier we already resolved on-chain above — never used to invent a fee
      // we don't actually know. DexScreener returns TVL+volume in one call
      // (DexPaprika needs a second detail call for the same numbers), so it
      // wins when both have data.
      const stillNeeds = merged.filter(f => (f.tvlUsd == null || f.apy == null));
      if (stillNeeds.length > 0) {
        const ids = stillNeeds.map(f => f.v4PoolId ?? f.address).filter((x): x is `0x${string}` => !!x);
        const [ds, dp] = await Promise.all([
          fetchDexScreenerPools(ids, networks.dexScreener).catch(() => ({} as Record<string, { tvlUsd: number; volume24hUsd: number }>)),
          fetchDexPaprikaPools(ids, networks.dexPaprika).catch(() => ({} as Record<string, { tvlUsd: number; volume24hUsd: number }>)),
        ]);
        for (const f of merged) {
          const id = (f.v4PoolId ?? f.address)?.toLowerCase();
          if (!id) continue;
          const s = ds[id] ?? dp[id];
          if (!s) continue;
          if (f.tvlUsd == null) f.tvlUsd = s.tvlUsd;
          // Dynamic-fee V4 pools carry the flag bit, not a fee — deriving
          // fees/APR from it fabricates absurd numbers, so leave them unknown.
          const dynamicFee = (f.feeTier & DYNAMIC_FEE_FLAG) !== 0;
          if (f.apy == null && !dynamicFee && s.volume24hUsd > 0 && s.tvlUsd > 0) {
            const apr = (s.volume24hUsd * (f.feeTier / 1_000_000) * 365 / s.tvlUsd) * 100;
            if (isFinite(apr) && apr > 0) { f.apy = apr; f.aprIsUnranged = true; }
          }
          if (f.fees24hUsd == null && !dynamicFee && s.volume24hUsd > 0 && f.feeTier > 0) {
            f.fees24hUsd = s.volume24hUsd * (f.feeTier / 1_000_000);
          }
        }
      }
      // Merge in every other pool the market APIs know for this pair
      // (GeckoTerminal + DexScreener via the shared dexSearch module).
      const marketPools = await externalP;
      const known = new Set(
        merged.flatMap(f => [f.address?.toLowerCase(), f.v4PoolId?.toLowerCase()]).filter(Boolean),
      );
      merged.push(...marketPoolRows(marketPools).filter(pool => !known.has(foundPoolKey(pool))));

      const pools = merged.sort((a, b) => (b.tvlUsd ?? 0) - (a.tvlUsd ?? 0));

      if (pools.length === 0 && failedChecks.length > 0) {
        setError(`Couldn't check ${failedChecks.join(', ')} right now (RPC error) — try again. ${3 - failedChecks.length > 0 ? 'No pool found on the rest.' : ''}`);
      } else if (pools.length === 0) {
        setError(`No pool found for ${tokenA.symbol}/${tokenB.symbol} on any DEX we track.`);
      } else if (failedChecks.length > 0) {
        setError(`Couldn't check ${failedChecks.join(', ')} right now (RPC error) — results below may be incomplete. Try again to include them.`);
      }
      setFound(pools);
      setProgress('Comparison complete');
    } catch (e) {
      setError(`Couldn't look up pools — ${(e as Error).message?.slice(0, 120)}`);
      setProgress(null);
    } finally {
      setLoading(false);
    }
  }

  // Discover has already chosen the pair, so run its comparison immediately
  // instead of requiring a redundant second click on this screen.
  useEffect(() => {
    if (!appliedPair.current || autoComparedPair.current || !tokenA || !tokenB) return;
    autoComparedPair.current = true;
    void findPools();
    // `findPools` deliberately reads the current token state above. The ref
    // prevents reruns from its changing function identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenA, tokenB]);

  const sheetMeta = sheetFee ? PROTOCOLS.find(p => p.id === sheetFee.protocol)! : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 760 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', padding: 4, borderRadius: 16, background: btb.surfaceSoft, border: btb.borderSoft }}>
        {([
          ['single', 'One chain'],
          ['cross-chain', 'Cross-chain research'],
        ] as const).map(([value, label]) => (
          <button key={value} type="button" aria-pressed={mode === value} onClick={() => setMode(value)} style={{
            height: 38, border: 'none', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit',
            fontSize: 12.5, fontWeight: 800, color: mode === value ? btb.text : btb.textMuted,
            background: mode === value ? 'rgba(255,255,255,.09)' : 'transparent',
          }}>{label}</button>
        ))}
      </div>

      {mode === 'cross-chain' ? (
        <CrossChainResearch chains={researchChains} isMobile={isMobile}/>
      ) : (
      <>
      <Glass padding={20} radius={22} style={{ overflow: 'visible', zIndex: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
          <div style={{ color: btb.text, fontSize: 15, fontWeight: 700 }}>Compare pools for a pair</div>
          <ChainSelect chains={availableChains} value={chainId} onChange={selectChain} small ariaLabel="Simulate network"/>
        </div>
        <div style={{ color: btb.textMuted, fontSize: 12, marginBottom: 14 }}>
          Pick two tokens on {chainName}. We check Uniswap V3, Uniswap V4, PancakeSwap V3, and the wider DEX market together.
        </div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <TokenPickerButton label="Token 1" token={tokenA} onPick={t => { setTokenA(t); setFound(null); }} tokens={chainTokens} onImportAddress={importSingleChainToken} />
          <TokenPickerButton label="Token 2" token={tokenB} onPick={t => { setTokenB(t); setFound(null); }} tokens={chainTokens} onImportAddress={importSingleChainToken} />
        </div>
        {loadingTokens && <div style={{ color: btb.textDim, fontSize: 11.5, margin: '-6px 0 10px' }}>Loading {chainName} tokens…</div>}

        <Button variant="success" size="md" onClick={findPools} disabled={!canSearch} loading={loading} style={{ borderRadius: 12 }}>
          {loading ? 'Comparing pools…' : 'Compare pools'}
        </Button>
        {progress && (
          <div aria-live="polite" style={{ marginTop: 10, color: loading ? btb.textMuted : btb.green, fontSize: 12, display: 'flex', alignItems: 'center', gap: 7 }}>
            {loading && <span className="spin" style={{ width: 10, height: 10, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,.22)', borderTopColor: btb.text }} />}
            {progress}
          </div>
        )}

        {error && (
          <div style={{ marginTop: 12, background: 'rgba(255,107,122,0.12)', border: '1px solid rgba(255,107,122,0.35)', borderRadius: 12, padding: '10px 14px', color: btb.loss, fontSize: 13 }}>
            {error}
          </div>
        )}
      </Glass>

      {found && found.length > 0 && (
        <Glass padding={0} radius={22} style={{ overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px 4px', color: btb.text, fontSize: 14, fontWeight: 700 }}>
            {found.length} pool{found.length > 1 ? 's' : ''} across {foundPoolDexCount(found)} DEX{foundPoolDexCount(found) === 1 ? '' : 's'}{loading ? ' found so far' : ''} for {tokenA?.symbol}/{tokenB?.symbol}
          </div>
          <div style={{ padding: '0 18px 10px', color: btb.textMuted, fontSize: 11.5 }}>
            Sorted by TVL — higher TVL usually means steadier, more reliable fee income; a high APR on a tiny pool can vanish fast.
            {found.some(f => f.aprIsUnranged) && ' † = whole-pool APR (fallback data), not the ±5% range-adjusted figure used elsewhere.'}
          </div>
          {isMobile ? (
            // Stacked cards — the 5-column comparison grid doesn't fit a phone.
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '4px 12px 14px' }}>
              {found.map((f, i) => {
                const label = foundPoolDexLabel(f);
                const feeLabel = f.feeTier > 0 ? fmtFeeTier(f.feeTier) : '—';
                return (
                  <div key={f.external ? f.address : `${f.protocol}-${f.feeTier}`} style={{
                    borderRadius: 14, border: btb.borderSoft, padding: '12px 14px',
                    background: i === 0 ? 'rgba(82,227,164,0.05)' : 'rgba(255,255,255,0.03)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <DexLogo name={label} size={19}/>
                      <span style={{ color: btb.text, fontSize: 13.5, fontWeight: 700, flex: 1 }}>
                        {label} · {feeLabel}
                        {i === 0 && <span title="Highest TVL" style={{ color: btb.green, fontSize: 10, marginLeft: 5 }}>Highest TVL</span>}
                        {!f.external && f.protocol === 'uniswap-v4' && <span title="No protocol fee" style={{ color: btb.green, fontSize: 10, marginLeft: 5 }}>No protocol fee</span>}
                      </span>
                      <span
                        style={{ color: f.apy != null ? (f.aprIsUnranged ? btb.amber : btb.green) : btb.textDim, fontSize: 14, fontWeight: 800, fontStyle: f.aprIsUnranged ? 'italic' : 'normal' }}
                        title={f.aprIsUnranged ? 'Whole-pool fees/TVL — not the ±5% range-adjusted figure (this pool isn\'t in DeFiLlama\'s data)' : f.aprLabel ?? f.external?.aprLabel}
                      >
                        {foundAprText(f)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                      <span style={{ color: btb.textMuted, fontSize: 12 }}>TVL {f.tvlUsd != null ? fmtCompactUsd(f.tvlUsd) : '—'}</span>
                      {f.external ? (
                        <a href={f.external.url} target="_blank" rel="noreferrer" style={{
                          height: 32, width: 100, marginLeft: 'auto', borderRadius: 14, border: btb.borderSoft,
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          color: btb.textMuted, fontSize: 12, fontWeight: 700, textDecoration: 'none',
                          background: 'rgba(255,255,255,0.06)',
                        }}>View ↗</a>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => setSheetFee(f)} style={{ height: 32, fontSize: 12, border: btb.borderSoft, marginLeft: 'auto', width: 100 }}>
                          Simulate
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 0.9fr 1fr 1fr 1fr', padding: '8px 18px', borderTop: btb.borderSoft, borderBottom: btb.borderSoft }}>
              {['Protocol', 'Fee tier', 'TVL', 'APR', ''].map(h => (
                <span key={h} style={{ color: btb.textMuted, fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3 }}>{h}</span>
              ))}
            </div>
            {found.map((f, i) => {
              const label = foundPoolDexLabel(f);
              return (
                <div key={f.external ? f.address : `${f.protocol}-${f.feeTier}`} style={{ display: 'grid', gridTemplateColumns: '1.3fr 0.9fr 1fr 1fr 1fr', alignItems: 'center', padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,0.04)', background: i === 0 ? 'rgba(82,227,164,0.05)' : undefined }}>
                  <span style={{ color: btb.text, fontSize: 13.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <DexLogo name={label} size={20}/>
                    {label}
                    {i === 0 && <span title="Highest TVL" style={{ color: btb.green, fontSize: 10 }}>Highest TVL</span>}
                    {!f.external && f.protocol === 'uniswap-v4' && <span title="No protocol fee" style={{ color: btb.green, fontSize: 10 }}>No protocol fee</span>}
                  </span>
                  <span style={{ color: btb.text, fontSize: 13 }}>{f.feeTier > 0 ? fmtFeeTier(f.feeTier) : '—'}</span>
                  <span style={{ color: btb.text, fontSize: 13, fontWeight: 600 }}>{f.tvlUsd != null ? fmtCompactUsd(f.tvlUsd) : '—'}</span>
                  <span
                    style={{ color: f.apy != null ? (f.aprIsUnranged ? btb.amber : btb.green) : btb.textDim, fontSize: 13, fontWeight: 700, fontStyle: f.aprIsUnranged ? 'italic' : 'normal' }}
                    title={f.aprIsUnranged ? 'Whole-pool fees/TVL — not the ±5% range-adjusted figure (this pool isn\'t in DeFiLlama\'s data)' : f.aprLabel ?? f.external?.aprLabel}
                  >
                    {foundAprText(f)}
                  </span>
                  {f.external ? (
                    <a href={f.external.url} target="_blank" rel="noreferrer" style={{
                      height: 32, width: 100, justifySelf: 'end', borderRadius: 14, border: btb.borderSoft,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      color: btb.textMuted, fontSize: 12, fontWeight: 700, textDecoration: 'none',
                      background: 'rgba(255,255,255,0.06)',
                    }}>View ↗</a>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => setSheetFee(f)} style={{ height: 32, fontSize: 12, border: btb.borderSoft, justifySelf: 'end', width: 100 }}>
                      Simulate
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
          )}
        </Glass>
      )}

      {sheetFee && sheetMeta && tokenA && tokenB && (
        <SimulatorPage
          tokenA={sheetFee.protocol !== 'uniswap-v4' ? tokenA.address : undefined}
          tokenB={sheetFee.protocol !== 'uniswap-v4' ? tokenB.address : undefined}
          selected={{
            ...sheetFee,
            fees24hUsd: sheetFee.fees24hUsd ?? (sheetFee.tvlUsd != null && sheetFee.apy != null ? (sheetFee.tvlUsd * sheetFee.apy) / 100 / 365 : undefined),
          }}
          siblings={(found ?? []).filter((f) => !f.external && f.protocol === sheetFee.protocol)}
          chainId={chainId}
          chainName={chainName}
          wrappedNative={wrappedNative}
          networks={networks}
          onClose={() => setSheetFee(null)}
        />
      )}
      </>
      )}
    </div>
  );
}
