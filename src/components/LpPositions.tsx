'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useConnection, useConfig } from 'wagmi';
import { getPublicClient } from 'wagmi/actions';
import { formatUnits, parseUnits, erc20Abi } from 'viem';
import { Glass } from './Glass';
import { Portal } from './Portal';
import { Button } from './Button';
import { Badge } from './Badge';
import { DataTable, Column } from './DataTable';
import { TokenIcon } from './TokenIcon';
import { btb } from './design-tokens';
import { useSidebar } from '../lib/SidebarContext';
import { useTx } from '../lib/TxTracker';
import { useTokenStore, useTokenLogos } from '../lib/TokenStore';
import { runCalls } from '../lib/txRunner';
import { getTokenPricesUsd } from '../lib/defillama';
import {
  fetchV3Positions, buildCollect, buildRemove, buildIncrease,
  fetchV4Positions, buildV4Collect, buildV4Remove, buildV4Increase,
  addAmounts, addSide, isWeth, isNativeCurrency, liquidityForAmounts, maxIn, SLIPPAGE_BPS,
  fmtFeeTier, tickToPrice, NATIVE_CURRENCY, type LiquidityPosition, type V3Deployment,
} from '@/protocols/dexs/uniswap';
import { fetchPancakePositions, PANCAKE_V3_DEPLOYMENT } from '@/protocols/dexs/pancakeswap';
import { fetchAerodromeStakedByIds, AERODROME_CL_DEPLOYMENTS, BASE_CHAIN_ID, aerodromeDeploymentsFor } from '@/protocols/dexs/aerodrome';
import { withStakeTargets, fetchStakedPositions, stakingSupported, stakingDeploymentsFor, buildStakeCalls, buildUnstakeCalls, buildClaimCalls } from '@/protocols/staking';
import { LP_CHAINS, LP_CHAIN_NAMES, v3DeploymentFor, v4DeploymentFor, v4DeployBlockFor, deploymentOfPosition, v4DeploymentOfPosition, canActOnPosition, wrappedNativeFor, lpSlippageBps, type LpChainId, type LpDex } from '@/protocols/lpChains';
import { Icon } from './Icon';
import { LpButton, lpBox, lpBoxLabel, lpBoxValue, fmtPrice } from './LpCardParts';
import { RangeStrip } from './RangeStrip';
import { FastAlertsPanel, fmtBtb } from './FastAlerts';
import { STABLES, DISCOVERY_CHAINS } from '../lib/pools';
import { CONTRACTS } from '../lib/wagmi';
import { useDiscoverPools } from '../lib/discoverPools';
import { RebalanceFlow } from './RebalanceFlow';
import { SharePositionCard, type ShareCardData } from './SharePositionCard';
import { useAlerts, ALERT_MIN_BTB, FAST_CHECK_BTB, needsHomeScreen, isWalletBrowser } from '../lib/alerts';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { withSafeMulticall } from '@/lib/safeMulticall';
import { buildSwapGap } from '../lib/swapGap';
import { fetchPositionHistory, fetchEmptyPositions, type PositionHistory } from '../lib/positionHistory';
import { NPM_ABI as V3_NPM_ABI, RAMSES_NPM_ABI, SLIPSTREAM_NPM_ABI } from '@/protocols/dexs/uniswap/v3/abis';
import { rebalancePlan } from '@/protocols/dexs/uniswap/v3/math';
import { POOL_ABI } from '@/protocols/dexs/uniswap/v3/abis';
import { STATE_VIEW_ABI } from '@/protocols/dexs/uniswap/v4/abis';
import {
  type KrystalPositionAnalytics,
  type KrystalTokenAmount,
} from '../lib/krystal';
import { getCachedLpPositions, setCachedLpPositions, useKrystalLp } from '../lib/appData';
import { ChainLogo } from './ChainLogo';


/** Deployment for a V3-architecture position (Uniswap default, Pancake fork). */
const v3DeploymentOf = deploymentOfPosition;
const v4DeploymentOf = v4DeploymentOfPosition;
const canActOn = (p: LiquidityPosition) => canActOnPosition(p, (hooks) => isNativeCurrency(hooks ?? NATIVE_CURRENCY));

/** Badge text; Aerodrome positions on an older Slipstream deployment say so. */
function protocolBadgeLabel(p: LiquidityPosition): string {
  if (p.protocol === 'aerodrome-cl') {
    const label = deploymentOfPosition(p).label ?? '';
    return /old/i.test(label) ? 'AERO V3 (old)' : 'AERO V3';
  }
  return PROTOCOL_BADGE[p.protocol].label;
}

const PROTOCOL_BADGE: Record<LiquidityPosition['protocol'], { label: string; color: string }> = {
  'uniswap-v3': { label: 'V3', color: '#FF007A' },
  'uniswap-v4': { label: 'V4', color: '#FF007A' },
  'pancakeswap-v3': { label: 'CAKE V3', color: '#1FC7D4' },
  'aerodrome-cl': { label: 'AERO V3', color: '#2A6BFF' },
  'giga-v3': { label: 'GIGA V3', color: '#F5A524' },
  'ramses-v3': { label: 'RAMSES V3', color: '#E0245E' },
  'up-v3': { label: 'UP', color: '#52E3A4' },
  'sushiswap-v3': { label: 'SUSHI V3', color: '#FA52A0' },
};

function fmtAmt(raw: bigint, decimals: number): string {
  const n = parseFloat(formatUnits(raw, decimals));
  if (n === 0) return '0';
  if (n < 0.0001) return '<0.0001';
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 10_000) return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

const posKey = (p: LiquidityPosition) => `${p.chainId ?? 1}-${p.protocol}-${p.id.toString()}`;

/** "checked 4m ago" for an alert row's last read. */
function checkedAgo(t: number | null): string {
  if (!t) return 'not checked yet';
  const m = Math.round((Date.now() - t) / 60_000);
  return m < 1 ? 'checked just now' : m < 60 ? `checked ${m}m ago` : `checked ${Math.round(m / 60)}h ago`;
}

/** Chains Krystal's LP index covers (see api/krystal/lp/route.ts). */
const KRYSTAL_LP_CHAINS = new Set([1, 10, 56, 130, 137, 2020, 324, 42161, 43114, 59144, 80094, 81457, 8453, 999]);

const KRYSTAL_PROTOCOL: Record<LiquidityPosition['protocol'], string> = {
  'uniswap-v3': 'uniswapv3',
  'uniswap-v4': 'uniswapv4',
  'pancakeswap-v3': 'pancakev3',
  'aerodrome-cl': 'aerodrome',
  'giga-v3': 'giga',
  'ramses-v3': 'ramses',
  'up-v3': 'up',
  'sushiswap-v3': 'sushiswapv3',
};

/** Krystal row ↔ on-chain position. Aerodrome's projectKey varies by
 * deployment ("aerodromecl", "aerodrome-slipstream"…), so match by prefix. */
function krystalMatches(p: LiquidityPosition, item: { chainId: number; tokenId: string; pool?: { projectKey?: string } }): boolean {
  if (item.chainId !== (p.chainId ?? 1) || item.tokenId !== p.id.toString()) return false;
  const key = item.pool?.projectKey?.toLowerCase() ?? '';
  return p.protocol === 'aerodrome-cl' ? key.includes('aerodrome') : key === KRYSTAL_PROTOCOL[p.protocol];
}

function LpChainLogo({ chainId, chainName }: { chainId: number; chainName: string }) {
  return (
    <span title={chainName} aria-label={chainName} style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
      <ChainLogo chainId={chainId} size={17}/>
    </span>
  );
}

function sumKrystalUsd(items?: KrystalTokenAmount[]): number {
  return (items ?? []).reduce((sum, item) => sum + (item.quotes?.usd?.value ?? 0), 0);
}

function krystalSymbols(position: KrystalPositionAnalytics): string[] {
  return [...new Set((position.currentAmounts ?? [])
    .map((amount) => amount.token?.symbol)
    .filter((symbol): symbol is string => !!symbol))];
}

function krystalAmountLabel(amount: KrystalTokenAmount): string {
  const symbol = amount.token?.symbol ?? 'Token';
  const usdValue = amount.quotes?.usd?.value ?? 0;
  return usdValue > 0
    ? `$${usdValue.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${symbol}`
    : symbol;
}

function compactProjectLabel(project?: string, projectKey?: string): string {
  const value = `${project ?? ''} ${projectKey ?? ''}`.toLowerCase();
  if (value.includes('aerodrome')) return 'AERO V3';
  if (value.includes('uniswap') && value.includes('v4')) return 'V4';
  if (value.includes('uniswap') && value.includes('v3')) return 'V3';
  if (value.includes('pancake')) return 'CAKE V3';
  return project?.replace(/\s+concentrated\s*/i, ' ').trim() || 'LP';
}

function fmtSignedMoney(value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}$${Math.abs(value).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

function fmtSignedPercent(value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${Math.abs(value).toFixed(2)}%`;
}

/**
 * The viewed wallet's live Uniswap V3/V4 + PancakeSwap V3 liquidity
 * positions (Ethereum mainnet) with Collect/Add/Withdraw actions. Shared by
 * the Earn and Portfolio screens. Renders nothing when there are no positions
 * (unless `showEmpty`).
 */
/** Live totals the Portfolio hero folds into net worth. */
export interface LpSummary {
  valueUsd: number;
  feesUsd: number;
  count: number;
  inRange: number;
  loading: boolean;
}

export function LpPositions({ showEmpty = false, onSummary }: { showEmpty?: boolean; onSummary?: (s: LpSummary) => void } = {}) {
  const { isMobile } = useSidebar();
  const { address: connectedAddress } = useConnection();
  const config = useConfig();
  const { track } = useTx();
  const [positions, setPositions] = useState<LiquidityPosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [manage, setManage] = useState<{ pos: LiquidityPosition; mode: 'add' | 'withdraw' } | null>(null);
  const [rebalance, setRebalance] = useState<LiquidityPosition | null>(null);
  const [share, setShare] = useState<ShareCardData | null>(null);
  const [alertNote, setAlertNote] = useState<string | null>(null);
  const [actionNote, setActionNote] = useState<string | null>(null);
  async function toggleAlert(p: LiquidityPosition) {
    setAlertNote(null);
    try {
      const problem = await alerts.toggle(p, `${p.symbol0} / ${p.symbol1} ${fmtFeeTier(p.fee)} on ${p.chainName ?? LP_CHAIN_NAMES[(p.chainId ?? 1) as keyof typeof LP_CHAIN_NAMES] ?? 'Ethereum'}`);
      if (problem) { setAlertNote(problem); return; }
      if (!alerts.has(p)) {
        setAlertNote(isWalletBrowser()
          ? 'Alert on. This wallet browser cannot receive push, so alerts show under the bell in the app.'
          : needsHomeScreen() ? 'Alert on. For push on iPhone, add BTB to your home screen from the Share menu; alerts also show under the bell.'
          : 'Alert on. You will get a push on this device and a line under the bell when the range changes. Checked hourly, or every 5 minutes with fast alerts above.');
      }
    } catch (e) {
      // Convex wraps thrown errors in its own framing; keep the sentence only.
      const raw = (e as Error)?.message ?? 'Could not enable the alert';
      const m = raw.match(/Uncaught Error: ([^\n]+?)(?: at handler|$)/);
      setAlertNote((m ? m[1] : raw).trim());
    }
  }
  const [usd, setUsd] = useState<Record<string, number>>({});

  const [showClosedHistory, setShowClosedHistory] = useState(false);
  // How the open positions are shown. The view choice survives reloads; the
  // filters reset, so nobody comes back to a list that looks half empty.
  const [view, setViewState] = useState<'cards' | 'list'>('list');
  // Read after mount: the server render has no storage, and a different first paint would not hydrate.
  useEffect(() => { try { if (localStorage.getItem('btb.lp.view') === 'cards') setViewState('cards'); } catch { /* private mode */ } }, []);
  const setView = (v: 'cards' | 'list') => { setViewState(v); try { localStorage.setItem('btb.lp.view', v); } catch { /* private mode */ } };
  const [chainFilter, setChainFilter] = useState<number | 'all'>('all');
  const [protoFilter, setProtoFilter] = useState<string>('all');
  const [rangeFilter, setRangeFilter] = useState<'all' | 'in' | 'out'>('all');
  const [sortBy, setSortBy] = useState<'attention' | 'value' | 'fees' | 'apr'>('attention');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [fastOpen, setFastOpen] = useState(false);
  const fastRef = useRef<HTMLDivElement>(null);
  const openFast = () => { setFastOpen(true); setTimeout(() => fastRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50); };
  // TokenStore prices cover tokens DeFiLlama doesn't index (BTB, small caps) —
  // read through a ref so balance refreshes don't retrigger the price effect.
  const { tokens: storeTokens, walletAddress } = useTokenStore();
  const logoFor = useTokenLogos();
  // Token logos the Discover snapshot already carries (filled server-side for
  // every chain), for tokens the wallet list does not know.
  const { pools: discoverPools } = useDiscoverPools();
  const snapshotLogo = useMemo(() => {
    const m = new Map<string, string>();
    for (const pool of discoverPools ?? []) {
      const cid = pool.chainId ?? DISCOVERY_CHAINS.find((c) => c.chain === pool.chain)?.chainId;
      if (!cid || !pool.tokenLogos) continue;
      (pool.underlyingTokens ?? []).forEach((t, i) => { const l = pool.tokenLogos?.[i]; if (l) m.set(`${cid}:${t.toLowerCase()}`, l); });
    }
    return (address: string, chainId: number) => m.get(`${chainId}:${address.toLowerCase()}`);
  }, [discoverPools]);
  const address = walletAddress ?? connectedAddress;

  const alerts = useAlerts(connectedAddress);
  const alertCredit = useQuery(api.alerts.creditFor, connectedAddress ? { address: connectedAddress } : 'skip');
  const fastAlerts = !!alertCredit?.fast && alertCredit.balance >= FAST_CHECK_BTB;
  // Tags: a short label per position, editable inline, stored per wallet.
  const tags = useQuery(api.alerts.tagsForAddress, address ? { address } : 'skip') ?? {};
  const setTagMutation = useMutation(api.alerts.setTag);
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [tagDraft, setTagDraft] = useState('');
  const tagKeyOf = (p: LiquidityPosition) => `${p.chainId ?? 1}:${p.protocol}:${p.id.toString()}`;
  const commitTag = async (p: LiquidityPosition) => {
    if (!address) return;
    await setTagMutation({ address, key: tagKeyOf(p), tag: tagDraft }).catch(() => {});
    setEditingTag(null);
  };

  // Gas-aware Collect: estimate the collect call once per position and price it
  // in USD with the wrapped native token's price, so tiny fees are not
  // collected at a loss.
  const [collectGasUsd, setCollectGasUsd] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!connectedAddress || positions.length === 0) return;
    let live = true;
    (async () => {
      const out: Record<string, number> = {};
      await Promise.all(positions.filter((p) => (p.fees0 > 0n || p.fees1 > 0n) && !p.staked).slice(0, 10).map(async (p) => {
        const chainId = (p.chainId ?? 1) as number;
        const client = getPublicClient(config, { chainId });
        if (!client) return;
        try {
          const call = (p.protocol === 'uniswap-v4' ? buildV4Collect(p, connectedAddress as `0x${string}`, v4DeploymentOf(p)) : buildCollect(p.id, connectedAddress as `0x${string}`, v3DeploymentOf(p))).at(-1)!;
          const [gas, price] = await Promise.all([
            client.estimateGas({ account: connectedAddress as `0x${string}`, to: call.to, data: call.data, value: call.value }),
            client.getGasPrice(),
          ]);
          const nativeUsd = usd[wrappedNativeFor(chainId).toLowerCase()] ?? 0;
          if (nativeUsd > 0) out[posKey(p)] = parseFloat(formatUnits(gas * price, 18)) * nativeUsd;
        } catch { /* unknown gas */ }
      }));
      if (live) setCollectGasUsd(out);
    })();
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions, connectedAddress, usd]);
  // Shared Krystal analytics cache — survives tab switches, fetched once app wide.
  const { data: krystalData, isFetching: krystalLoading } = useKrystalLp(address);
  const krystal = krystalData ?? null;
  const krystalRef = useRef(krystal);
  krystalRef.current = krystal;
  const canTransact = !!connectedAddress && !!address && connectedAddress.toLowerCase() === address.toLowerCase();
  const storeTokensRef = useRef(storeTokens);
  storeTokensRef.current = storeTokens;

  const positionsRef = useRef<LiquidityPosition[]>([]);

  // Krystal is the index: its rows say which position NFTs the wallet has on
  // each chain (manager address, tokenId, gauge when staked). The chain RPC
  // then supplies the live numbers for exactly those ids. No Blockscout, no
  // balanceOf loops, no Transfer-log scans. A cheap balanceOf pass on the V3
  // style managers still runs so a position minted a minute ago shows before
  // Krystal has indexed it.
  const krystalOpenKey = (krystal?.positions ?? [])
    .filter((i) => !(i.status?.toUpperCase().includes('CLOSED') || i.closedTime > 0))
    .map((i) => `${i.chainId}:${i.tokenAddress ?? ''}:${i.tokenId}:${i.id ?? ''}`).sort().join(',');
  const load = useCallback(async () => {
    if (!address) { setPositions([]); return; }
    const owner = address as `0x${string}`;
    // A previous full snapshot renders instantly; the refresh runs silently.
    const cached = getCachedLpPositions(address);
    if (cached && positionsRef.current.length === 0) setPositions(cached);
    setLoading(!cached && positionsRef.current.length === 0);
    try {
      const merge = (protocol: LiquidityPosition['protocol'], chainId: number, chainName: string, staked = false) => (items: LiquidityPosition[]) =>
        setPositions((prev) => {
          const seen = new Set(items.map(posKey));
          const next = [
            ...prev.filter((p) => !(p.protocol === protocol && (p.chainId ?? 1) === chainId && !!p.staked === staked) || seen.has(posKey(p))),
            ...items.map((p) => ({ ...p, chainId, chainName })),
          ].filter((p, i, arr) => arr.findIndex((q) => posKey(q) === posKey(p) && !!q.staked === !!p.staked) === i);
          positionsRef.current = next;
          return next;
        });

      const rows = (krystalRef.current?.positions ?? []).filter((i) => !(i.status?.toUpperCase().includes('CLOSED') || i.closedTime > 0));
      const jobs: Promise<unknown>[] = [];
      for (const chainId of LP_CHAINS) {
        const client = getPublicClient(config, { chainId });
        if (!client) continue;
        const chainName = LP_CHAIN_NAMES[chainId];
        const v3 = v3DeploymentFor('uniswap', chainId);
        const v4 = v4DeploymentFor(chainId);
        const cake = v3DeploymentFor('pancakeswap', chainId);
        const aero = aerodromeDeploymentsFor(chainId);

        // Krystal ids for this chain, bucketed by the manager contract they live in.
        const byManager = new Map<string, bigint[]>();
        const stakedAero: { id: bigint; gauge: `0x${string}`; manager: `0x${string}` }[] = [];
        for (const row of rows) {
          if (row.chainId !== chainId || !row.tokenAddress) continue;
          let id: bigint;
          try { id = BigInt(row.tokenId); } catch { continue; }
          const manager = row.tokenAddress.toLowerCase();
          const gauge = row.id?.split('_')[1];
          if (row.farming && gauge && /^0x[0-9a-f]{40}$/i.test(gauge) && aero.some((d) => d.positionManager.toLowerCase() === manager)) {
            stakedAero.push({ id, gauge: gauge as `0x${string}`, manager: manager as `0x${string}` });
            continue;
          }
          byManager.set(manager, [...(byManager.get(manager) ?? []), id]);
        }
        const idsIn = (manager?: string) => (manager ? byManager.get(manager.toLowerCase()) : undefined);

        // V3 style managers: Krystal ids plus a cheap balanceOf enumeration
        // (two multicalls) so brand new positions appear straight away.
        const giga = v3DeploymentFor('giga', chainId);
        const ramses = v3DeploymentFor('ramses', chainId);
        const up = v3DeploymentFor('up', chainId);
        const sushi = v3DeploymentFor('sushiswap', chainId);
        const v3Like: { protocol: LiquidityPosition['protocol']; d: V3Deployment }[] = [
          ...(v3 ? [{ protocol: 'uniswap-v3' as const, d: v3 }] : []),
          ...(cake ? [{ protocol: 'pancakeswap-v3' as const, d: cake }] : []),
          ...(giga ? [{ protocol: 'giga-v3' as const, d: giga }] : []),
          ...(ramses ? [{ protocol: 'ramses-v3' as const, d: ramses }] : []),
          ...(up ? [{ protocol: 'up-v3' as const, d: up }] : []),
          ...(sushi ? [{ protocol: 'sushiswap-v3' as const, d: sushi }] : []),
          ...aero.map((d) => ({ protocol: 'aerodrome-cl' as const, d })),
        ];
        for (const { protocol, d } of v3Like) {
          const known = idsIn(d.positionManager) ?? [];
          jobs.push(
            fetchV3Positions(client, owner, d)
              .catch(() => [] as LiquidityPosition[])
              .then(async (enumerated) => {
                const have = new Set(enumerated.map((p) => p.id));
                const missing = known.filter((id) => !have.has(id));
                const extra = missing.length > 0 ? await fetchV3Positions(client, owner, d, missing).catch(() => []) : [];
                return [...enumerated, ...extra];
              })
              .then((items) => stakingSupported(d) ? withStakeTargets(client, d, items).catch(() => items) : items)
              .then((items) => setPositions((prev) => {
                const keep = prev.filter((p) => !(p.protocol === protocol && (p.chainId ?? 1) === chainId && !p.staked && p.positionManager?.toLowerCase() === d.positionManager.toLowerCase()) && !(protocol !== 'aerodrome-cl' && p.protocol === protocol && (p.chainId ?? 1) === chainId && !p.staked));
                const next = [...keep, ...items.map((p) => ({ ...p, chainId, chainName, positionManager: p.positionManager ?? d.positionManager }))];
                positionsRef.current = next;
                return next;
              })),
          );
        }
        // V4: Krystal ids where Krystal indexes the chain. Where it does not
        // (Robinhood), fall back to the manager's Transfer-log scan; the chain
        // is young enough for that to be quick.
        const v4Ids = v4 ? idsIn(v4.positionManager) : undefined;
        if (v4 && v4Ids && v4Ids.length > 0) {
          jobs.push(fetchV4Positions(client, owner, v4Ids, v4, v4DeployBlockFor(chainId)).then(merge('uniswap-v4', chainId, chainName)));
        } else if (v4 && !KRYSTAL_LP_CHAINS.has(chainId)) {
          jobs.push(fetchV4Positions(client, owner, undefined, v4, v4DeployBlockFor(chainId)).catch(() => [] as LiquidityPosition[]).then(merge('uniswap-v4', chainId, chainName)));
        }
        // Aerodrome gauges: Krystal names the gauge, so read each staked NFT directly.
        if (stakedAero.length > 0) {
          jobs.push(fetchAerodromeStakedByIds(client, owner, stakedAero).then(merge('aerodrome-cl', chainId, chainName, true)));
        }
        // Venues Krystal does not index (UP gauges, Giga's farm on Robinhood):
        // the staking contracts themselves enumerate the wallet's positions.
        for (const d of stakingDeploymentsFor(chainId)) {
          jobs.push(fetchStakedPositions(client, owner, d).catch(() => [] as LiquidityPosition[]).then(merge(d.protocol, chainId, chainName, true)));
        }
      }
      await Promise.allSettled(jobs);
      setCachedLpPositions(address, positionsRef.current);
    } catch { /* read failure: leave the list as it was */ }
    finally { setLoading(false); }
  // krystalOpenKey: re-run once Krystal's index lands or changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, config, krystalOpenKey]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => { positionsRef.current = positions; }, [positions]);

  // Live USD prices for every token held across positions — used only for the
  // stats strip (current value + unclaimed fees), both real on-chain amounts.
  // No cost-basis history is tracked, so P&L/ROI/APR aren't shown here — that
  // would require fabricating numbers we can't back up.
  useEffect(() => {
    if (positions.length === 0) return;
    const addrs = [...new Set(positions.flatMap((p) => [p.token0, p.token1]))];
    // App-known prices first (covers BTB and other tokens DeFiLlama misses),
    // then DeFiLlama's figures win for everything it does index.
    const fromStore: Record<string, number> = {};
    for (const a of addrs) {
      const key = a.toLowerCase();
      const t = storeTokensRef.current.find(
        (tok) => tok.address.toLowerCase() === key || (isNativeCurrency(a) && tok.address === 'ETH'),
      );
      if (t?.usdPrice) fromStore[key] = t.usdPrice;
    }
    if (Object.keys(fromStore).length > 0) setUsd((u) => ({ ...fromStore, ...u }));
    // DeFiLlama keys prices by chain: price each token on the chain it lives on.
    const byChain = new Map<string, string[]>();
    for (const p of positions) {
      const chain = p.chainId === BASE_CHAIN_ID ? 'base' : p.chainId === 4663 ? null : 'ethereum';
      if (!chain) continue;
      byChain.set(chain, [...(byChain.get(chain) ?? []), p.token0, p.token1]);
    }
    Promise.all([...byChain].map(([chain, list]) => getTokenPricesUsd([...new Set(list)], chain).catch(() => ({}))))
      .then((parts) => setUsd({ ...fromStore, ...Object.assign({}, ...parts) }))
      .catch(() => {});
  }, [positions]);

  /** Gauge actions for a staked Aerodrome position: claim AERO, or unstake
   * (which also claims) so the NFT is back in the wallet for NPM actions. */
  async function gaugeAction(pos: LiquidityPosition, action: 'claim' | 'unstake' | 'stake') {
    if (!connectedAddress || !canTransact) return;
    if (action === 'stake' ? !pos.stakeable || !pos.positionManager : !pos.staked) return;
    setBusyId(posKey(pos));
    try {
      await runCalls(config, {
        account: connectedAddress as `0x${string}`,
        calls: action === 'claim'
          ? buildClaimCalls(pos, connectedAddress as `0x${string}`)
          : action === 'unstake'
            ? buildUnstakeCalls(pos)
            : buildStakeCalls(pos.stakeable!.kind ?? 'gauge', pos.stakeable!.gauge, pos.positionManager!, pos.id, connectedAddress as `0x${string}`),
        label: `${action === 'claim' ? `Claim ${pos.staked?.rewardSymbol ?? 'rewards'}` : action === 'unstake' ? 'Unstake' : 'Stake'} ${pos.symbol0}/${pos.symbol1}`,
        track, chainId: pos.chainId ?? 1,
      });
      await load();
    } catch { /* surfaced via the global tx pill */ }
    finally { setBusyId(null); }
  }

  async function collect(pos: LiquidityPosition) {
    if (!connectedAddress || !canTransact) return;
    setBusyId(posKey(pos));
    try {
      await runCalls(config, {
        account: connectedAddress as `0x${string}`,
        calls: pos.protocol === 'uniswap-v4'
          ? buildV4Collect(pos, connectedAddress as `0x${string}`, v4DeploymentOf(pos))
          : buildCollect(pos.id, connectedAddress as `0x${string}`, v3DeploymentOf(pos)),
        label: `Collect ${pos.symbol0}/${pos.symbol1} fees`,
        track, chainId: (pos.chainId ?? 1) as number,
      });
      await load();
    } catch { /* surfaced via the global tx pill */ }
    finally { setBusyId(null); }
  }

  /**
   * Live fee APR per position: the pool's 24h fees (Discover snapshot) times
   * this position's share of the pool's in-range liquidity (read on-chain),
   * annualised over the position's value. Out-of-range positions earn zero.
   * One liquidity read per position, refreshed with the list.
   */
  const [liveApr, setLiveApr] = useState<Record<string, number>>({});
  useEffect(() => {
    if (positions.length === 0 || !discoverPools?.length) return;
    let live = true;
    (async () => {
      const out: Record<string, number> = {};
      await Promise.all(positions.map(async (p) => {
        if (!p.inRange || p.liquidity === 0n) { out[posKey(p)] = 0; return; }
        const chainId = p.chainId ?? 1;
        const set = new Set([p.token0.toLowerCase(), p.token1.toLowerCase()]);
        const row = discoverPools.find((r) => (r.chainId ?? DISCOVERY_CHAINS.find((c) => c.chain === r.chain)?.chainId) === chainId
          && r.feeTier === p.fee && (r.underlyingTokens ?? []).length === 2 && r.underlyingTokens!.every((t) => set.has(t.toLowerCase()))
          && (p.protocol === 'uniswap-v4' ? /^0x[0-9a-f]{64}$/i.test(r.id) : /^0x[0-9a-f]{40}$/i.test(r.id)));
        if (!row) return;
        const fees24h = row.fees24hUsd ?? (row.tvlUsd * (row.apyBase ?? 0)) / 100 / 365;
        if (!(fees24h > 0)) return;
        const client = getPublicClient(config, { chainId });
        if (!client) return;
        try {
          const poolL = p.protocol === 'uniswap-v4'
            ? await client.readContract({ address: v4DeploymentOf(p).stateView, abi: STATE_VIEW_ABI, functionName: 'getLiquidity', args: [row.id as `0x${string}`] }) as bigint
            : await client.readContract({ address: row.id as `0x${string}`, abi: POOL_ABI, functionName: 'liquidity' }) as bigint;
          const value = valueOf(p);
          if (poolL === 0n || !(value > 0)) return;
          const share = Number(p.liquidity) / Number(poolL);
          out[posKey(p)] = (fees24h * Math.min(share, 1) * 365 / value) * 100;
        } catch { /* leave unknown */ }
      }));
      if (live) setLiveApr(out);
    })();
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions, discoverPools, usd]);

  /**
   * Compound: collect the fees, swap only what the range needs so both sides
   * fit, then increase liquidity on the same NFT. Fees go to the wallet in
   * step one (V3 has no in-contract compounding), so the increase step is
   * capped to what the wallet gained. V4 is collected and increased the same
   * way; native ETH pools keep a gas reserve.
   */
  async function compound(pos: LiquidityPosition) {
    if (!connectedAddress || !canTransact) return;
    const acct = connectedAddress as `0x${string}`;
    const chainId = (pos.chainId ?? 1) as number;
    const client = getPublicClient(config, { chainId });
    if (!client) return;
    const isV4 = pos.protocol === 'uniswap-v4';
    const native0 = isV4 && isNativeCurrency(pos.token0);
    const slippage = lpSlippageBps(chainId, SLIPPAGE_BPS);
    const readBals = async (): Promise<[bigint, bigint]> => {
      const erc = native0 ? [pos.token1] : [pos.token0, pos.token1];
      const res = await withSafeMulticall(client).multicall({
        contracts: erc.map((a) => ({ address: a, abi: erc20Abi, functionName: 'balanceOf' as const, args: [acct] as const })),
        allowFailure: true,
      });
      const get = (r: (typeof res)[number] | undefined) => (r && r.status === 'success' ? (r.result as bigint) : 0n);
      if (native0) return [await client.getBalance({ address: acct }), get(res[0])];
      return [get(res[0]), get(res[1])];
    };
    setBusyId(posKey(pos));
    try {
      const [before0, before1] = await readBals();
      await runCalls(config, {
        account: acct,
        calls: isV4 ? buildV4Collect(pos, acct, v4DeploymentOf(pos)) : buildCollect(pos.id, acct, v3DeploymentOf(pos)),
        label: `Compound · collect ${pos.symbol0}/${pos.symbol1} fees`, track, chainId,
      });
      const [after0, after1] = await readBals();
      // Only what the collect brought in is reinvested, never the rest of the wallet.
      let budget0 = after0 > before0 ? after0 - before0 : 0n;
      let budget1 = after1 > before1 ? after1 - before1 : 0n;
      if (budget0 === 0n && budget1 === 0n) throw new Error('No fees came in to compound');
      const plan = rebalancePlan(pos.sqrtPriceX96, pos.tickLower, pos.tickUpper, budget0, budget1);
      if (plan.sellSide !== null && plan.swapFraction > 0.02) {
        const swap = await buildSwapGap({
          sellSide: plan.sellSide, swapFraction: plan.swapFraction, budget0, budget1,
          token0: pos.token0, token1: pos.token1, decimals0: pos.decimals0, decimals1: pos.decimals1,
          native0, account: acct, slippageBps: slippage, chainId,
        }).catch(() => null);
        if (swap) {
          await runCalls(config, { account: acct, calls: swap.calls, label: `Compound · balance ${pos.symbol0}/${pos.symbol1}`, track, chainId });
          budget0 = swap.budget0; budget1 = swap.budget1;
        }
      }
      const [live0, live1] = await readBals();
      const a0 = budget0 < live0 ? budget0 : live0;
      const a1 = budget1 < live1 ? budget1 : live1;
      const L = liquidityForAmounts(pos.sqrtPriceX96, pos.tickLower, pos.tickUpper, a0, a1);
      if (L === 0n) throw new Error('Fees are too small to add at this range');
      const calls = isV4
        ? buildV4Increase(pos, L, maxIn(a0, slippage), maxIn(a1, slippage), acct, v4DeploymentOf(pos))
        : buildIncrease(pos, a0, a1, slippage, null, v3DeploymentOf(pos));
      await runCalls(config, { account: acct, calls, label: `Compound · add to ${pos.symbol0}/${pos.symbol1}`, track, chainId });
      await load();
    } catch (e) {
      setActionNote((e as { shortMessage?: string })?.shortMessage ?? (e as Error)?.message ?? 'Compound failed');
    } finally { setBusyId(null); }
  }

  const valueOf = (p: LiquidityPosition) => {
    const p0 = usd[p.token0.toLowerCase()] ?? 0;
    const p1 = usd[p.token1.toLowerCase()] ?? 0;
    return parseFloat(formatUnits(p.amount0, p.decimals0)) * p0 + parseFloat(formatUnits(p.amount1, p.decimals1)) * p1;
  };
  const feesValueOf = (p: LiquidityPosition) => {
    const p0 = usd[p.token0.toLowerCase()] ?? 0;
    const p1 = usd[p.token1.toLowerCase()] ?? 0;
    return parseFloat(formatUnits(p.fees0, p.decimals0)) * p0 + parseFloat(formatUnits(p.fees1, p.decimals1)) * p1;
  };
  const totalValueUsd = positions.reduce((s, p) => s + valueOf(p), 0);
  const pendingFeesUsd = positions.reduce((s, p) => s + feesValueOf(p), 0);
  const inRangeCount = positions.filter((p) => p.inRange && p.liquidity > 0n).length;
  const feePositions = positions.filter((p) => (p.fees0 > 0n || p.fees1 > 0n) && !p.staked);
  const collectingAll = busyId === 'collect-all';

  /** One confirmation per chain: every position's collect goes out as a
   * single EIP-5792 bundle (sequential fallback lives in runCalls). */
  async function collectAll() {
    if (!connectedAddress || !canTransact || feePositions.length === 0) return;
    setBusyId('collect-all');
    try {
      const byChain = new Map<number, LiquidityPosition[]>();
      for (const p of feePositions) byChain.set(p.chainId ?? 1, [...(byChain.get(p.chainId ?? 1) ?? []), p]);
      for (const [chainId, list] of byChain) {
        await runCalls(config, {
          account: connectedAddress as `0x${string}`,
          calls: list.flatMap((pos) => pos.protocol === 'uniswap-v4'
            ? buildV4Collect(pos, connectedAddress as `0x${string}`, v4DeploymentOf(pos))
            : buildCollect(pos.id, connectedAddress as `0x${string}`, v3DeploymentOf(pos))),
          label: `Collect fees from ${list.length} position${list.length === 1 ? '' : 's'}`,
          track, chainId,
        });
      }
      await load();
    } catch { /* surfaced via the global tx pill */ }
    finally { setBusyId(null); }
  }

  useEffect(() => {
    onSummary?.({ valueUsd: totalValueUsd, feesUsd: pendingFeesUsd, count: positions.length, inRange: inRangeCount, loading: loading || krystalLoading });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalValueUsd, pendingFeesUsd, positions.length, inRangeCount, loading, krystalLoading]);

  if (!address) {
    return showEmpty ? (
      <Glass padding={16} radius={18}>
        <div style={{ color: btb.textMuted, fontSize: 13, textAlign: 'center' }}>Connect your wallet to see your LP positions.</div>
      </Glass>
    ) : null;
  }
  if (!loading && !krystalLoading && positions.length === 0 && (krystal?.positions?.length ?? 0) === 0) {
    // Portfolio still renders the smart-account overview: a wallet may have no
    // directly-owned NFT because every position is held by its fixed-owner
    // account. Embedded Earn views keep their previous compact empty behavior.
    if (!showEmpty) return null;
  }

  // Chain-read history for positions the provider does not cover (Robinhood
  // and any V3-style position Krystal misses): deposits, withdrawals and
  // fees claimed from the manager's events, priced at the time where possible.
  const [chainHistory, setChainHistory] = useState<Record<string, PositionHistory>>({});
  useEffect(() => {
    const todo = positions.filter((p) => p.protocol !== 'uniswap-v4' && p.liquidity >= 0n && !krystal?.positions?.some((item) => krystalMatches(p, item)) && !chainHistory[posKey(p)]);
    if (todo.length === 0 || krystalLoading) return;
    let live = true;
    (async () => {
      const out: Record<string, PositionHistory> = {};
      await Promise.all(todo.slice(0, 12).map(async (p) => {
        const chainId = p.chainId ?? 1;
        const client = getPublicClient(config, { chainId });
        if (!client) return;
        try {
          const h = await fetchPositionHistory(client, chainId, v3DeploymentOf(p), p.id,
            { token0: p.token0, token1: p.token1, decimals0: p.decimals0, decimals1: p.decimals1 },
            { p0: usd[p.token0.toLowerCase()] ?? 0, p1: usd[p.token1.toLowerCase()] ?? 0 });
          out[posKey(p)] = h;
        } catch { /* stays unknown */ }
      }));
      if (live && Object.keys(out).length > 0) setChainHistory((prev) => ({ ...prev, ...out }));
    })();
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions, krystal, krystalLoading, usd]);

  // Closed ledger for chains the provider does not index: empty positions
  // still in the wallet, with their lifetime numbers from chain history.
  const [chainClosed, setChainClosed] = useState<KrystalPositionAnalytics[]>([]);
  useEffect(() => {
    if (!address) return;
    const chainId = 4663;
    if (!LP_CHAINS.includes(chainId as LpChainId)) return;
    const client = getPublicClient(config, { chainId });
    if (!client) return;
    let live = true;
    (async () => {
      const dexes: LpDex[] = ['uniswap', 'pancakeswap', 'sushiswap', 'giga', 'ramses', 'up'];
      const rows: KrystalPositionAnalytics[] = [];
      await Promise.all(dexes.map(async (dex) => {
        const d = v3DeploymentFor(dex, chainId);
        if (!d) return;
        const abi = d.compactPositions ? RAMSES_NPM_ABI : d.slipstream ? SLIPSTREAM_NPM_ABI : V3_NPM_ABI;
        const empties = await fetchEmptyPositions(client, d, address as `0x${string}`, abi).catch(() => []);
        await Promise.all(empties.map(async (e) => {
          try {
            const meta = await withSafeMulticall(client).multicall({ contracts: [
              { address: e.token0, abi: erc20Abi, functionName: 'symbol' }, { address: e.token0, abi: erc20Abi, functionName: 'decimals' },
              { address: e.token1, abi: erc20Abi, functionName: 'symbol' }, { address: e.token1, abi: erc20Abi, functionName: 'decimals' },
            ], allowFailure: true });
            const sym0 = meta[0].status === 'success' ? String(meta[0].result) : 'T0', dec0 = meta[1].status === 'success' ? Number(meta[1].result) : 18;
            const sym1 = meta[2].status === 'success' ? String(meta[2].result) : 'T1', dec1 = meta[3].status === 'success' ? Number(meta[3].result) : 18;
            const p0 = usd[e.token0.toLowerCase()] ?? 0, p1 = usd[e.token1.toLowerCase()] ?? 0;
            const h = await fetchPositionHistory(client, chainId, d, e.tokenId, { token0: e.token0, token1: e.token1, decimals0: dec0, decimals1: dec1 }, { p0, p1 });
            if (h.depositsUsd <= 0 && h.events.length === 0) return;
            const pnl = h.withdrawalsUsd + h.feesClaimedUsd - h.depositsUsd;
            const last = h.events[h.events.length - 1]?.timestamp ?? 0;
            rows.push({
              chainId, chainName: 'Robinhood Chain', tokenId: e.tokenId.toString(), status: 'CLOSED',
              pnl, returnOnInvestment: h.depositsUsd > 0 ? (pnl / h.depositsUsd) * 100 : 0, compareWithHodl: 0,
              apr: 0, feeApr: 0, farmApr: 0, totalDepositValue: h.depositsUsd, totalWithdrawValue: h.withdrawalsUsd, currentPositionValue: 0,
              createdTime: h.openedAt ?? 0, closedTime: last,
              feePending: [{ token: { symbol: sym0 } }, { token: { symbol: sym1 } }],
              feesClaimed: [{ token: { symbol: sym0 }, quotes: { usd: { value: parseFloat(formatUnits(h.feesClaimed0, dec0)) * p0 } } }, { token: { symbol: sym1 }, quotes: { usd: { value: parseFloat(formatUnits(h.feesClaimed1, dec1)) * p1 } } }],
              pool: { project: d.label ?? dex },
            });
          } catch { /* skip */ }
        }));
      }));
      if (live) setChainClosed(rows.sort((a, b) => b.closedTime - a.closedTime));
    })();
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, config, usd]);

  /** Provider analytics, or the same shape synthesised from chain history. */
  const analyticsOf = (p: LiquidityPosition): KrystalPositionAnalytics | undefined => {
    const fromKrystal = krystal?.positions?.find((item) => krystalMatches(p, item));
    if (fromKrystal) return fromKrystal;
    const h = chainHistory[posKey(p)];
    if (!h || h.depositsUsd <= 0) return undefined;
    const p0 = usd[p.token0.toLowerCase()] ?? 0, p1 = usd[p.token1.toLowerCase()] ?? 0;
    const value = parseFloat(formatUnits(p.amount0, p.decimals0)) * p0 + parseFloat(formatUnits(p.amount1, p.decimals1)) * p1;
    const pending = parseFloat(formatUnits(p.fees0, p.decimals0)) * p0 + parseFloat(formatUnits(p.fees1, p.decimals1)) * p1;
    const pnl = value + pending + h.withdrawalsUsd + h.feesClaimedUsd - h.depositsUsd;
    // HODL: the deposited token amounts at today's prices, less what was withdrawn.
    const hodl = parseFloat(formatUnits(h.deposits0 - h.withdrawals0, p.decimals0)) * p0 + parseFloat(formatUnits(h.deposits1 - h.withdrawals1, p.decimals1)) * p1;
    const ageDays = h.openedAt ? Math.max((Date.now() / 1000 - h.openedAt) / 86400, 1 / 24) : 0;
    const feesTotal = h.feesClaimedUsd + pending;
    const apr = ageDays > 0 && h.depositsUsd > 0 ? (feesTotal / h.depositsUsd) * (365 / ageDays) * 100 : 0;
    return {
      chainId: p.chainId ?? 1, chainName: p.chainName ?? '', tokenId: p.id.toString(), status: p.inRange ? 'IN_RANGE' : 'OUT_RANGE',
      pnl, returnOnInvestment: (pnl / h.depositsUsd) * 100, compareWithHodl: value + pending - hodl,
      apr, feeApr: apr, farmApr: 0,
      totalDepositValue: h.depositsUsd, totalWithdrawValue: h.withdrawalsUsd, currentPositionValue: value,
      createdTime: h.openedAt ?? 0, closedTime: 0,
      feesClaimed: [{ token: { symbol: p.symbol0, decimals: p.decimals0 }, balance: h.feesClaimed0.toString(), quotes: { usd: { value: parseFloat(formatUnits(h.feesClaimed0, p.decimals0)) * p0 } } },
                    { token: { symbol: p.symbol1, decimals: p.decimals1 }, balance: h.feesClaimed1.toString(), quotes: { usd: { value: parseFloat(formatUnits(h.feesClaimed1, p.decimals1)) * p1 } } }],
      feePending: [{ token: { symbol: p.symbol0 }, quotes: { usd: { value: parseFloat(formatUnits(p.fees0, p.decimals0)) * p0 } } }, { token: { symbol: p.symbol1 }, quotes: { usd: { value: parseFloat(formatUnits(p.fees1, p.decimals1)) * p1 } } }],
      pool: { project: protocolBadgeLabel(p) },
    };
  };
  const krystalStats = krystal?.statsByChain?.all ?? krystal?.statsByChain?.['1'];
  const otherChainPositions = (krystal?.positions ?? []).filter((item) =>
    item.chainId !== 1 && !(item.status?.toUpperCase().includes('CLOSED') || item.closedTime > 0) &&
    !positions.some((p) => krystalMatches(p, item)),
  );
  const closedHistory = [
    ...(krystal?.positions ?? []).filter((item) => item.status?.toUpperCase().includes('CLOSED') || item.closedTime > 0),
    ...chainClosed,
  ];

  // Out-of-range positions with liquidity first, since they are the ones that
  // need a decision; then by value.
  const orderedPositions = [...positions].sort((a, b) => {
    const na = a.liquidity > 0n && !a.inRange ? 1 : 0, nb = b.liquidity > 0n && !b.inRange ? 1 : 0;
    return nb - na || valueOf(b) - valueOf(a);
  });
  const needsAttention = positions.filter((p) => p.liquidity > 0n && !p.inRange);
  const idleUsd = needsAttention.reduce((sum, p) => sum + valueOf(p), 0);
  const attentionBlock = needsAttention.length > 0 && (
    <div style={{ borderRadius: 16, border: '1px solid rgba(var(--amber-rgb), 0.3)', background: 'rgba(var(--amber-rgb), 0.07)', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: 220 }}>
        <div style={{ color: btb.amber, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .4 }}>Needs attention</div>
        <div style={{ color: btb.text, fontSize: 13.5, fontWeight: 700, marginTop: 2 }}>
          {needsAttention.length} position{needsAttention.length === 1 ? '' : 's'} out of range{idleUsd > 0 ? `, ${'$'}${idleUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })} earning nothing` : ''}
        </div>
        <div style={{ color: btb.textMuted, fontSize: 12, marginTop: 2 }}>{needsAttention.map((p) => `${p.symbol0}/${p.symbol1}`).join(', ')}. Listed first below.</div>
      </div>
      {canTransact && canActOn(needsAttention[0]) && (
        <LpButton tone="amber" label={`Rebalance ${needsAttention[0].symbol0}/${needsAttention[0].symbol1}`} onClick={() => setRebalance(needsAttention[0])} disabled={busyId != null}/>
      )}
    </div>
  );

  /** One position card, same layout on desktop and phone: header, three
   * stat boxes, range bar, history list, equal-width actions. */
  const renderPositionCard = (p: LiquidityPosition) => {
    const hasFees = p.fees0 > 0n || p.fees1 > 0n;
    const hasLiquidity = p.liquidity > 0n;
    const canRebalance = hasLiquidity && canActOn(p);
    const busy = busyId === posKey(p);
    const v = valueOf(p);
    const f = feesValueOf(p);
    const a = analyticsOf(p);
    const alertRow = alerts.list?.find((r) => r.chainId === (p.chainId ?? 1) && r.protocol === p.protocol && r.tokenId === p.id.toString());
    const money = (n: number) => `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
    const krystalLogo = (symbol: string) => a?.currentAmounts?.find((amt) => amt.token?.symbol?.toUpperCase() === symbol.toUpperCase())?.token?.logo;
    const logo0 = logoFor(p.token0, p.chainId ?? 1, p.symbol0) ?? krystalLogo(p.symbol0) ?? snapshotLogo(p.token0, p.chainId ?? 1);
    const logo1 = logoFor(p.token1, p.chainId ?? 1, p.symbol1) ?? krystalLogo(p.symbol1) ?? snapshotLogo(p.token1, p.chainId ?? 1);
    const shareData = (): ShareCardData => {
      const usdOf = (rows?: { quotes?: { usd?: { value?: number } } }[]) => (rows ?? []).reduce((sum, r) => sum + (r.quotes?.usd?.value ?? 0), 0);
      const claimed = usdOf(a?.feesClaimed);
      const pending = a ? usdOf(a.feePending) : f;
      const ageMs = a?.createdTime ? Date.now() - a.createdTime * (a.createdTime < 1e12 ? 1000 : 1) : undefined;
      const feesEarnedUsd = claimed + pending;
      const hasFeeTokens = p.fees0 > 0n || p.fees1 > 0n;
      const feeTokens = [p.fees0 > 0n ? `${fmtAmt(p.fees0, p.decimals0)} ${p.symbol0}` : '', p.fees1 > 0n ? `${fmtAmt(p.fees1, p.decimals1)} ${p.symbol1}` : ''].filter(Boolean).join(' + ');
      const flipQuote = STABLES.has(p.symbol0.toUpperCase()) && !STABLES.has(p.symbol1.toUpperCase());
      const priceOf = (tick: number) => { const q = tickToPrice(tick, p.decimals0, p.decimals1); return flipQuote && q > 0 ? 1 / q : q; };
      // Quote as "1 BASE = x QUOTE" so the number reads as an exchange rate.
      const baseSym = flipQuote ? p.symbol1 : p.symbol0, quoteSym = flipQuote ? p.symbol0 : p.symbol1;
      const compact = (v: number) => v >= 1e6 ? `${(v / 1e6).toFixed(2)}M` : v >= 1e4 ? `${(v / 1e3).toFixed(1)}K` : fmtPrice(v);
      const fullRange = p.tickLower <= -887200 && p.tickUpper >= 887200;
      const lo = priceOf(flipQuote ? p.tickUpper : p.tickLower), hi = priceOf(flipQuote ? p.tickLower : p.tickUpper);
      return {
        holdings: [p.amount0 > 0n ? `${fmtAmt(p.amount0, p.decimals0)} ${p.symbol0}` : '', p.amount1 > 0n ? `${fmtAmt(p.amount1, p.decimals1)} ${p.symbol1}` : ''].filter(Boolean).join(' + ') || undefined,
        unclaimedFees: feeTokens || undefined,
        priceNow: `1 ${baseSym} = ${compact(priceOf(p.currentTick))} ${quoteSym}`,
        rangeLabel: fullRange ? 'Full range' : `${compact(lo)} to ${compact(hi)} ${quoteSym}`,
        positionId: p.id.toString(),
        pair: `${p.symbol0} / ${p.symbol1}`, symbol0: p.symbol0, symbol1: p.symbol1,
        dexLabel: protocolBadgeLabel(p), chainName: p.chainName ?? LP_CHAIN_NAMES[(p.chainId ?? 1) as keyof typeof LP_CHAIN_NAMES] ?? 'Ethereum',
        feeTierLabel: fmtFeeTier(p.fee), inRange: p.inRange,
        feesEarnedUsd,
        feesPer30dUsd: ageMs && ageMs > 3_600_000 ? (feesEarnedUsd / ageMs) * 30 * 86_400_000 : undefined,
        aprPct: a && a.apr > 0 ? a.apr : a && a.feeApr > 0 ? a.feeApr : liveApr[posKey(p)] != null && liveApr[posKey(p)] > 0 ? liveApr[posKey(p)] : undefined,
        pnlUsd: a?.pnl, vsHodlUsd: a?.compareWithHodl, depositUsd: a?.totalDepositValue, valueUsd: v > 0 ? v : a ? a.totalDepositValue + a.pnl : undefined, ageMs,
        logo0, logo1,
        // Staked in a gauge or MasterChef: the gauge pays emissions, not swap
        // fees, so the reward amount is the number worth showing.
        hero: p.staked && feesEarnedUsd <= 0 && p.staked.earned > 0n
          ? { label: `${p.staked.rewardSymbol.toUpperCase()} EARNED`, value: `${fmtAmt(p.staked.earned, 18)} ${p.staked.rewardSymbol}` }
          : p.staked && feesEarnedUsd <= 0 ? { label: 'STAKED FOR', value: p.staked.rewardSymbol }
          // No USD figure (no price for one side, or a chain without analytics): the fee tokens themselves are the story.
          : feesEarnedUsd < 0.01 && hasFeeTokens ? { label: 'UNCLAIMED FEES', value: feeTokens }
          : undefined,
      };
    };
    const box = lpBox(isMobile);
    const boxLabel = lpBoxLabel;
    const boxValue = lpBoxValue(isMobile);
    const line = (label: string, value: string, color: string = btb.text, bold = false) => (
      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12.5 }}>
        <span style={{ color: bold ? btb.text : btb.textMuted, fontWeight: bold ? 800 : 500 }}>{label}</span>
        <span style={{ color, fontWeight: bold ? 800 : 600 }}>{value}</span>
      </div>
    );
    return (
      <Glass key={posKey(p)} padding={isMobile ? 14 : 18} radius={20}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ display: 'flex', flexShrink: 0 }}>
            <TokenIcon symbol={p.symbol0} size={32} logoUrl={logo0} />
            <div style={{ marginLeft: -10 }}><TokenIcon symbol={p.symbol1} size={32} logoUrl={logo1} /></div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ color: btb.text, fontWeight: 800, fontSize: 16 }}>{p.symbol0}/{p.symbol1}</span>
              {editingTag === tagKeyOf(p) ? (
                <input autoFocus value={tagDraft} onChange={(e) => setTagDraft(e.target.value)} onBlur={() => commitTag(p)} onKeyDown={(e) => { if (e.key === 'Enter') commitTag(p); if (e.key === 'Escape') setEditingTag(null); }} maxLength={24} placeholder="Tag"
                  style={{ height: 22, padding: '0 8px', borderRadius: 999, border: btb.borderSoft, background: btb.surfaceSoft, color: btb.text, fontSize: 11, fontFamily: 'inherit', outline: 'none', width: 120 }}/>
              ) : (
                <span onClick={() => { if (address) { setEditingTag(tagKeyOf(p)); setTagDraft(tags[tagKeyOf(p)] ?? ''); } }} title="Tag this position" style={{ cursor: address ? 'pointer' : 'default', fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 999, border: tags[tagKeyOf(p)] ? '1px solid rgba(var(--green-rgb), 0.35)' : btb.borderSoft, background: tags[tagKeyOf(p)] ? 'rgba(var(--green-rgb), 0.1)' : 'transparent', color: tags[tagKeyOf(p)] ? btb.green : btb.textDim }}>
                  {tags[tagKeyOf(p)] ?? '+ tag'}
                </span>
              )}
              <Badge size="sm" color={btb.textMuted} bg={btb.surfaceSoft} border="none" style={{ fontSize: 11, padding: '2px 7px' }}>{fmtFeeTier(p.fee)}</Badge>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
              <span style={{ color: btb.textDim, fontSize: 11.5 }}>#{p.id.toString()}</span>
              <Badge size="sm" border="none" bg={p.inRange ? 'rgba(var(--green-rgb), 0.14)' : 'rgba(var(--amber-rgb), 0.14)'} color={p.inRange ? btb.green : btb.amber} style={{ whiteSpace: 'nowrap' }}>
                {p.inRange ? 'In range' : 'Out of range'}
              </Badge>
              <LpChainLogo chainId={p.chainId ?? 1} chainName={p.chainName ?? 'Ethereum'}/>
              <Badge size="sm" color={PROTOCOL_BADGE[p.protocol].color} bg={`${PROTOCOL_BADGE[p.protocol].color}1f`} border="none" style={{ fontSize: 10, padding: '1px 6px' }}>{protocolBadgeLabel(p)}</Badge>
            </div>
            {alertRow && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5, color: btb.textDim, fontSize: 11 }}>
                <span style={{ width: 6, height: 6, borderRadius: 999, background: fastAlerts ? btb.green : btb.textMuted }}/>
                <span>Alert on, {fastAlerts ? `checked every 5 min (${FAST_CHECK_BTB} BTB each)` : 'checked hourly'}, {checkedAgo(alertRow.lastCheckedAt)}</span>
                {!fastAlerts && canTransact && <button type="button" onClick={openFast} style={{ border: 'none', background: 'transparent', padding: 0, color: btb.green, fontSize: 11, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>Check every 5 min</button>}
              </div>
            )}
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            {v > 0 && <div style={{ color: btb.text, fontSize: isMobile ? 16 : 19, fontWeight: 800 }}>{money(v)}</div>}
            {liveApr[posKey(p)] != null && (
              <div title="Pool's 24h fees times your share of in-range liquidity, annualised" style={{ color: liveApr[posKey(p)] > 0 ? btb.green : btb.textDim, fontSize: 11.5, fontWeight: 800, marginTop: 2 }}>
                {liveApr[posKey(p)] > 0 ? `${liveApr[posKey(p)].toFixed(1)}% fee APR` : 'Earning 0% now'}
              </div>
            )}
            {p.staked && (
              <div style={{ marginTop: v > 0 ? 4 : 0 }}>
                <Badge size="sm" border="none" bg="rgba(var(--amber-rgb), 0.14)" color={btb.amber} style={{ whiteSpace: 'nowrap', padding: '3px 9px' }}>Staked</Badge>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(3, minmax(0, 1fr))', gap: 8, marginTop: 14 }}>
          <div style={box}>
            <div style={boxLabel}><TokenIcon symbol={p.symbol0} size={16} logoUrl={logo0}/>{p.symbol0}</div>
            <div style={boxValue}>{fmtAmt(p.amount0, p.decimals0)}</div>
          </div>
          <div style={box}>
            <div style={boxLabel}><TokenIcon symbol={p.symbol1} size={16} logoUrl={logo1}/>{p.symbol1}</div>
            <div style={boxValue}>{fmtAmt(p.amount1, p.decimals1)}</div>
          </div>
          {p.staked ? (
            <div style={{ ...box, gridColumn: isMobile ? '1 / -1' : undefined, background: 'rgba(var(--amber-rgb), 0.07)', border: '1px solid rgba(var(--amber-rgb), 0.22)' }}>
              <div style={boxLabel}>Rewards</div>
              <div style={{ ...boxValue, color: btb.amber }}>{fmtAmt(p.staked.earned, 18)}</div>
              <div style={{ color: 'rgba(var(--amber-rgb), 0.7)', fontSize: 11.5, marginTop: 2 }}>{p.staked.rewardSymbol} to claim</div>
            </div>
          ) : (
            <div style={{ ...box, gridColumn: isMobile ? '1 / -1' : undefined, background: hasFees ? 'rgba(var(--green-rgb), 0.07)' : box.background, border: hasFees ? '1px solid rgba(var(--green-rgb), 0.22)' : box.border }}>
              <div style={boxLabel}>Unclaimed fees</div>
              <div style={{ ...boxValue, color: hasFees ? btb.green : btb.textDim }}>{hasFees ? (f > 0 ? money(f) : `${fmtAmt(p.fees0, p.decimals0)} ${p.symbol0}`) : 'None yet'}</div>
              {hasFees && (
                <div style={{ color: 'rgba(var(--green-rgb), 0.75)', fontSize: 11.5, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {fmtAmt(p.fees0, p.decimals0)} {p.symbol0} + {fmtAmt(p.fees1, p.decimals1)} {p.symbol1}
                </div>
              )}
              {hasFees && collectGasUsd[posKey(p)] != null && (
                <div style={{ color: f > 0 && collectGasUsd[posKey(p)] > f ? btb.amber : btb.textDim, fontSize: 10.5, marginTop: 3 }}>
                  {f > 0 && collectGasUsd[posKey(p)] > f ? `Gas ~$${collectGasUsd[posKey(p)].toFixed(2)} is more than these fees; let them grow` : `Gas to collect ~$${collectGasUsd[posKey(p)].toFixed(2)}`}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ ...box, marginTop: 8 }}>
          <RangeStrip p={p}/>
        </div>

        {a && (
          <div style={{ ...box, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 7 }}>
            {line('Invested', money(a.totalDepositValue))}
            {line('Current value', money(v > 0 ? v : a.totalDepositValue + a.pnl))}
            {a.totalWithdrawValue > 0 && line('Withdrawn', money(a.totalWithdrawValue))}
            {a.feeApr > 0 && line('Fee APR', `${a.feeApr.toFixed(1)}%`, btb.textMuted)}
            {chainHistory[posKey(p)] && line('Source', chainHistory[posKey(p)].estimated ? 'chain events, priced at today\'s rates' : 'chain events', btb.textDim)}
            <div style={{ borderTop: '1px solid rgba(var(--fg-rgb), 0.08)', marginTop: 2, paddingTop: 8 }}>
              {line('P&L', `${fmtSignedMoney(a.pnl)} (${fmtSignedPercent(a.returnOnInvestment)})`, a.pnl >= 0 ? btb.green : btb.loss, true)}
            </div>
          </div>
        )}

        {(() => {
          // Two actions the position needs right now, then More for the rest.
          type Act = { key: string; label: string; tone?: 'neutral' | 'green' | 'amber' | 'danger'; solid?: boolean; onClick: () => void; disabled?: boolean };
          const acts: Act[] = [];
          if (p.staked) {
            acts.push({ key: 'claim', label: busy ? 'Working…' : `Claim ${p.staked.rewardSymbol}`, tone: 'green', onClick: () => gaugeAction(p, 'claim'), disabled: p.staked.earned === 0n || busy || !canTransact });
            acts.push({ key: 'unstake', label: 'Unstake', tone: 'amber', onClick: () => gaugeAction(p, 'unstake'), disabled: busy || !canTransact });
          } else {
            if (hasFees && p.inRange && canActOn(p)) acts.push({ key: 'compound', label: 'Compound', tone: 'green', solid: true, onClick: () => compound(p), disabled: busy || !canTransact });
            acts.push({ key: 'collect', label: busy ? 'Collecting…' : 'Collect fees', tone: 'green', solid: hasFees && !p.inRange, onClick: () => collect(p), disabled: !hasFees || busy || !canTransact });
            acts.push({ key: 'add', label: 'Add liquidity', onClick: () => setManage({ pos: p, mode: 'add' }), disabled: busy || !canTransact });
            if (p.stakeable && hasLiquidity) acts.push({ key: 'stake', label: `Stake for ${p.stakeable.rewardSymbol ?? 'rewards'}`, onClick: () => gaugeAction(p, 'stake'), disabled: busy || !canTransact });
          }
          if (canRebalance) acts.push({ key: 'rebalance', label: p.inRange ? 'Rebalance' : 'Rebalance now', tone: p.inRange ? 'neutral' : 'amber', onClick: () => setRebalance(p), disabled: busy || !canTransact });
          if (!p.staked && hasLiquidity) acts.push({ key: 'withdraw', label: 'Withdraw', tone: 'danger', onClick: () => setManage({ pos: p, mode: 'withdraw' }), disabled: busy || !canTransact });
          acts.push({ key: 'flex', label: 'Flex', onClick: () => setShare(shareData()) });
          if (hasLiquidity && canTransact) acts.push({ key: 'alert', label: alerts.has(p) ? 'Alert on' : 'Alert me', tone: alerts.has(p) ? 'green' : 'neutral', onClick: () => toggleAlert(p), disabled: busy });
          // What leads depends on the state: out of range wants Rebalance, fees want Compound or Collect, staked wants Claim.
          const lead: string[] = p.staked ? ['claim', 'unstake'] : !p.inRange && canRebalance ? ['rebalance', 'withdraw'] : hasFees ? ['compound', 'collect', 'add'] : ['add', 'rebalance'];
          const primary = lead.map((k) => acts.find((a) => a.key === k)).filter((a): a is Act => !!a).slice(0, 2);
          const rest = acts.filter((a) => !primary.includes(a));
          // Everything else stays on screen as small labelled chips, not in a
          // menu: a hidden More is where features go to be missed.
          const chipColor = (a: Act) => a.disabled ? btb.textDim : a.tone === 'danger' ? btb.loss : a.tone === 'amber' ? btb.amber : a.tone === 'green' ? btb.green : btb.textMuted;
          return (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                {primary.map((a) => {
                  const color = chipColor(a);
                  const tint = a.tone === 'danger' ? '255, 76, 107' : a.tone === 'amber' ? 'var(--amber-rgb)' : a.tone === 'green' ? 'var(--green-rgb)' : 'var(--fg-rgb)';
                  return (
                    <button key={a.key} type="button" disabled={a.disabled} onClick={a.onClick} style={{
                      height: 30, padding: '0 11px', borderRadius: 999, fontFamily: 'inherit', fontSize: 11.5, fontWeight: 800, whiteSpace: 'nowrap',
                      cursor: a.disabled ? 'default' : 'pointer',
                      color: a.disabled ? btb.textDim : a.solid ? btb.text : color,
                      background: a.disabled ? 'rgba(var(--fg-rgb), 0.04)' : `rgba(${tint}, ${a.solid ? 0.22 : 0.1})`,
                      border: a.disabled ? '1px solid rgba(var(--fg-rgb), 0.08)' : `1px solid rgba(${tint}, ${a.solid ? 0.5 : 0.3})`,
                    }}>{a.label}</button>
                  );
                })}
                  {rest.map((a) => {
                    const isAlert = a.key === 'alert';
                    const on = isAlert && a.tone === 'green';
                    const color = chipColor(a);
                    return (
                      <button key={a.key} type="button" disabled={a.disabled} onClick={a.onClick} style={{
                        height: 30, padding: '0 11px', borderRadius: 999, fontFamily: 'inherit', fontSize: 11.5, fontWeight: 750, whiteSpace: 'nowrap',
                        display: 'inline-flex', alignItems: 'center', gap: 5, cursor: a.disabled ? 'default' : 'pointer', color,
                        // The alert chip is the one users most often miss, so it gets a fill.
                        background: on ? 'rgba(var(--green-rgb), 0.14)' : isAlert ? 'rgba(var(--amber-rgb), 0.1)' : 'rgba(var(--fg-rgb), 0.04)',
                        border: on ? '1px solid rgba(var(--green-rgb), 0.35)' : isAlert ? '1px solid rgba(var(--amber-rgb), 0.3)' : '1px solid rgba(var(--fg-rgb), 0.08)',
                        ...(isAlert && !on ? { color: btb.amber } : {}),
                      }}>
                        {isAlert && !on ? 'Alert me when out of range' : a.label}
                      </button>
                    );
                  })}
              </div>
            </>
          );
        })()}
        {actionNote && <div style={{ color: btb.amber, fontSize: 11.5, marginTop: 8, lineHeight: 1.5 }}>{actionNote}</div>}
        {alertNote && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
            <span style={{ color: alertNote.startsWith('Alert on') ? btb.textMuted : btb.amber, fontSize: 11.5, lineHeight: 1.5, flex: 1, minWidth: 200 }}>{alertNote}</span>
            {/^Alerts need/.test(alertNote) && (
              <a href={`/swap?to=${CONTRACTS.BTB}`} style={{ color: btb.green, fontSize: 11.5, fontWeight: 800, textDecoration: 'none', whiteSpace: 'nowrap' }}>Get BTB</a>
            )}
          </div>
        )}
      </Glass>
    );
  };

  // ── Filters, sorting and the compact list ─────────────────────────────────
  const aprOf = (p: LiquidityPosition) => liveApr[posKey(p)] ?? analyticsOf(p)?.feeApr ?? 0;
  const chainsPresent = [...new Set(positions.map((p) => p.chainId ?? 1))];
  const protosPresent = [...new Set(positions.map((p) => p.protocol))];
  const visiblePositions = orderedPositions
    .filter((p) => chainFilter === 'all' || (p.chainId ?? 1) === chainFilter)
    .filter((p) => protoFilter === 'all' || p.protocol === protoFilter)
    .filter((p) => rangeFilter === 'all' || (rangeFilter === 'in' ? p.inRange : !p.inRange))
    .sort((a, b) => sortBy === 'value' ? valueOf(b) - valueOf(a) : sortBy === 'fees' ? feesValueOf(b) - feesValueOf(a) : sortBy === 'apr' ? aprOf(b) - aprOf(a) : 0);
  const filtered = chainFilter !== 'all' || protoFilter !== 'all' || rangeFilter !== 'all';

  const chip = (active: boolean, label: React.ReactNode, onClick: () => void, key: string) => (
    <button key={key} type="button" onClick={onClick} style={{
      height: 28, padding: '0 11px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11.5, fontWeight: 750, whiteSpace: 'nowrap',
      display: 'inline-flex', alignItems: 'center', gap: 5,
      border: active ? '1px solid rgba(var(--green-rgb), 0.4)' : btb.borderSoft,
      background: active ? 'rgba(var(--green-rgb), 0.1)' : 'transparent',
      color: active ? btb.green : btb.textMuted,
    }}>{label}</button>
  );
  const toolbar = positions.length > 1 && (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {chip(rangeFilter === 'all', `All ${positions.length}`, () => setRangeFilter('all'), 'r-all')}
        {chip(rangeFilter === 'in', `In range ${positions.filter((p) => p.inRange).length}`, () => setRangeFilter('in'), 'r-in')}
        {chip(rangeFilter === 'out', `Out of range ${positions.filter((p) => !p.inRange).length}`, () => setRangeFilter('out'), 'r-out')}
        <div style={{ flex: 1 }}/>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} aria-label="Sort positions" style={{ height: 28, padding: '0 8px', borderRadius: 999, border: btb.borderSoft, background: btb.surfaceSoft, color: btb.text, fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', outline: 'none', cursor: 'pointer' }}>
          <option value="attention">Needs attention first</option>
          <option value="value">Highest value</option>
          <option value="fees">Most fees to collect</option>
          <option value="apr">Highest fee APR</option>
        </select>
        <div style={{ display: 'inline-flex', borderRadius: 999, border: btb.borderSoft, padding: 2 }}>
          {(['cards', 'list'] as const).map((v) => (
            <button key={v} type="button" onClick={() => setView(v)} style={{ height: 24, padding: '0 10px', borderRadius: 999, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11.5, fontWeight: 750, background: view === v ? btb.surfaceSoft : 'transparent', color: view === v ? btb.text : btb.textDim }}>{v === 'cards' ? 'Cards' : 'List'}</button>
          ))}
        </div>
      </div>
      {(chainsPresent.length > 1 || protosPresent.length > 1) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {chainsPresent.length > 1 && chip(chainFilter === 'all', 'All chains', () => setChainFilter('all'), 'c-all')}
          {chainsPresent.length > 1 && chainsPresent.map((c) => chip(chainFilter === c, <><LpChainLogo chainId={c} chainName={LP_CHAIN_NAMES[c as LpChainId] ?? `Chain ${c}`}/>{LP_CHAIN_NAMES[c as LpChainId] ?? `Chain ${c}`}</>, () => setChainFilter(chainFilter === c ? 'all' : c), `c-${c}`))}
          {chainsPresent.length > 1 && protosPresent.length > 1 && <span style={{ width: 1, height: 18, background: 'rgba(var(--fg-rgb), 0.12)', margin: '0 2px' }}/>}
          {protosPresent.length > 1 && protosPresent.map((pr) => chip(protoFilter === pr, PROTOCOL_BADGE[pr].label, () => setProtoFilter(protoFilter === pr ? 'all' : pr), `p-${pr}`))}
        </div>
      )}
    </div>
  );

  /** One line per position; a click opens the full card in place. */
  const LIST_COLS = 'minmax(0, 2.5fr) minmax(120px, 1.3fr) 0.9fr 0.8fr 1fr 18px';
  const renderPositionRow = (p: LiquidityPosition, index: number) => {
    const key = posKey(p);
    const open = expanded === key;
    const v = valueOf(p), f = feesValueOf(p), apr = aprOf(p);
    const a = analyticsOf(p);
    const logo0 = logoFor(p.token0, p.chainId ?? 1, p.symbol0) ?? snapshotLogo(p.token0, p.chainId ?? 1);
    const logo1 = logoFor(p.token1, p.chainId ?? 1, p.symbol1) ?? snapshotLogo(p.token1, p.chainId ?? 1);
    const fullRange = p.tickLower <= -887200 && p.tickUpper >= 887200;
    const span = p.tickUpper - p.tickLower;
    const at = fullRange ? 0.5 : span > 0 ? (p.currentTick - p.tickLower) / span : 0.5;
    const side = at < 0 ? 'below' : at > 1 ? 'above' : null;
    const watched = alerts.has(p);
    const tone = p.inRange ? btb.green : btb.amber;
    const toneRgb = p.inRange ? 'var(--green-rgb)' : 'var(--amber-rgb)';
    const money = (n: number) => `$${n.toLocaleString('en-US', { maximumFractionDigits: n >= 1000 ? 0 : 2 })}`;
    const chainName = p.chainName ?? LP_CHAIN_NAMES[(p.chainId ?? 1) as LpChainId] ?? 'Ethereum';
    // The band sits in the middle 60% of the track so an out-of-range price still has room to show which side it left from.
    const marker = fullRange ? 50 : 20 + Math.min(1.25, Math.max(-0.25, at)) * 60;
    const rangeBar = (w: number | string) => (
      <div style={{ position: 'relative', width: w, height: 8, borderRadius: 999, background: 'rgba(var(--fg-rgb), 0.07)', flexShrink: 0 }}>
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: fullRange ? '4%' : '20%', right: fullRange ? '4%' : '20%', borderRadius: 999, background: `rgba(${toneRgb}, 0.28)` }}/>
        <div style={{ position: 'absolute', top: -3, left: `calc(${marker}% - 1.5px)`, width: 3, height: 14, borderRadius: 2, background: tone, boxShadow: `0 0 8px rgba(${toneRgb}, 0.7)` }}/>
      </div>
    );
    const label = (t: string) => <div style={{ color: btb.textDim, fontSize: 10, fontWeight: 700, marginTop: 3 }}>{t}</div>;
    return (
      <div key={key} style={{ borderTop: index === 0 ? 'none' : '1px solid rgba(var(--fg-rgb), 0.06)' }}>
        <div role="button" tabIndex={0} className="lp-row" data-open={open || undefined}
          onClick={() => setExpanded(open ? null : key)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(open ? null : key); } }}
          style={{ display: 'grid', gridTemplateColumns: isMobile ? 'minmax(0, 1fr) auto' : LIST_COLS, alignItems: 'center', gap: isMobile ? 10 : 16, padding: isMobile ? '13px 14px' : '14px 18px', cursor: 'pointer', boxShadow: `inset 3px 0 0 rgba(${toneRgb}, ${p.inRange ? 0.55 : 0.8})` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <div style={{ position: 'relative', display: 'flex', flexShrink: 0 }}>
              <TokenIcon symbol={p.symbol0} size={isMobile ? 28 : 32} logoUrl={logo0}/>
              <div style={{ marginLeft: -10, borderRadius: 999, boxShadow: '0 0 0 2px var(--bg, #0A0A0F)' }}><TokenIcon symbol={p.symbol1} size={isMobile ? 28 : 32} logoUrl={logo1}/></div>
              <div style={{ position: 'absolute', right: -4, bottom: -3, borderRadius: 999, boxShadow: '0 0 0 2px var(--bg, #0A0A0F)', lineHeight: 0 }}><LpChainLogo chainId={p.chainId ?? 1} chainName={chainName}/></div>
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                <span style={{ color: btb.text, fontSize: 14.5, fontWeight: 800, letterSpacing: -0.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.symbol0} / {p.symbol1}</span>
                <span style={{ color: btb.textMuted, fontSize: 10.5, fontWeight: 750, padding: '1px 6px', borderRadius: 6, background: 'rgba(var(--fg-rgb), 0.06)' }}>{fmtFeeTier(p.fee)}</span>
                {tags[tagKeyOf(p)] && <span style={{ color: btb.green, fontSize: 10.5, fontWeight: 750, padding: '1px 6px', borderRadius: 6, background: 'rgba(var(--green-rgb), 0.1)', whiteSpace: 'nowrap' }}>{tags[tagKeyOf(p)]}</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap', fontSize: 11, fontWeight: 650 }}>
                <span style={{ color: btb.textDim }}>{chainName}</span>
                <span style={{ color: 'rgba(var(--fg-rgb), 0.2)' }}>|</span>
                <span style={{ color: PROTOCOL_BADGE[p.protocol].color }}>{protocolBadgeLabel(p)}</span>
                {p.staked && <span style={{ color: btb.amber }}>Staked</span>}
                {watched && <span title={fastAlerts ? 'Range alert, checked every 5 minutes' : 'Range alert, checked hourly'} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: fastAlerts ? btb.green : btb.textMuted }}><span style={{ width: 5, height: 5, borderRadius: 999, background: 'currentColor' }}/>{fastAlerts ? 'Fast alert' : 'Alert'}</span>}
              </div>
              {isMobile && <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>{rangeBar(72)}<span style={{ color: tone, fontSize: 10.5, fontWeight: 750 }}>{fullRange ? 'Full range' : p.inRange ? 'In range' : `Out of range${side ? `, ${side}` : ''}`}</span></div>}
            </div>
          </div>
          {!isMobile && (
            <div>
              {rangeBar('100%')}
              <div style={{ color: tone, fontSize: 11, fontWeight: 750, marginTop: 6 }}>{fullRange ? 'Full range' : p.inRange ? 'In range' : `Out of range${side ? `, price ${side}` : ''}`}</div>
            </div>
          )}
          {!isMobile && <div style={{ textAlign: 'right' }}><div style={{ color: f > 0 ? btb.green : btb.textDim, fontSize: 13.5, fontWeight: 800 }}>{f > 0 ? money(f) : (p.fees0 > 0n || p.fees1 > 0n) ? 'Yes' : '0'}</div>{label('to collect')}</div>}
          {!isMobile && <div style={{ textAlign: 'right' }}><div style={{ color: apr > 0 ? btb.green : btb.textDim, fontSize: 13.5, fontWeight: 800 }}>{apr > 0 ? `${apr.toFixed(1)}%` : '0%'}</div>{label('fee APR')}</div>}
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: btb.text, fontSize: isMobile ? 14.5 : 15.5, fontWeight: 800, letterSpacing: -0.2 }}>{v > 0 ? money(v) : '...'}</div>
            {a && a.totalDepositValue > 0
              ? <div style={{ color: a.pnl >= 0 ? btb.green : btb.loss, fontSize: 10.5, fontWeight: 750, marginTop: 3 }}>{fmtSignedMoney(a.pnl)} ({fmtSignedPercent(a.returnOnInvestment)})</div>
              : isMobile ? <div style={{ color: f > 0 ? btb.green : btb.textDim, fontSize: 10.5, fontWeight: 750, marginTop: 3 }}>{f > 0 ? `${money(f)} fees` : apr > 0 ? `${apr.toFixed(1)}% APR` : 'no fees yet'}</div>
              : label('value')}
          </div>
          {!isMobile && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: btb.textDim, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}><path d="M6 9l6 6 6-6"/></svg>
          )}
        </div>
        {open && <div style={{ padding: isMobile ? '0 8px 10px' : '0 12px 12px' }}>{renderPositionCard(p)}</div>}
      </div>
    );
  };

  const positionTable = (
    <div style={{ borderRadius: 18, border: btb.borderSoft, background: btb.surfaceSoft, overflow: 'hidden' }}>
      <style>{`.lp-row{transition:background .15s}.lp-row:hover,.lp-row[data-open]{background:rgba(var(--fg-rgb),0.035)}.lp-row:focus-visible{outline:2px solid rgba(var(--green-rgb),0.5);outline-offset:-2px}`}</style>
      {!isMobile && (
        <div style={{ display: 'grid', gridTemplateColumns: LIST_COLS, gap: 16, padding: '10px 18px', borderBottom: '1px solid rgba(var(--fg-rgb), 0.06)', color: btb.textDim, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          <span>Position</span><span>Range</span><span style={{ textAlign: 'right' }}>Fees</span><span style={{ textAlign: 'right' }}>APR</span><span style={{ textAlign: 'right' }}>Value</span><span/>
        </div>
      )}
      {visiblePositions.map(renderPositionRow)}
    </div>
  );

  const watchedCount = alerts.list?.length ?? 0;
  const fastStrip = canTransact && connectedAddress && watchedCount > 0 && (
    <div ref={fastRef} style={{ borderRadius: 16, border: fastAlerts ? '1px solid rgba(var(--green-rgb), 0.3)' : btb.borderSoft, background: fastAlerts ? 'rgba(var(--green-rgb), 0.06)' : btb.surfaceSoft, padding: '10px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ color: btb.text, fontSize: 13, fontWeight: 800 }}>
            Range alerts on {watchedCount} position{watchedCount === 1 ? '' : 's'}, {fastAlerts ? 'checked every 5 minutes' : 'checked hourly'}
          </div>
          <div style={{ color: btb.textMuted, fontSize: 11.5, marginTop: 2 }}>
            {fastAlerts
              ? `Fast checks on. ${fmtBtb(alertCredit?.balance ?? 0)} BTB left at ${FAST_CHECK_BTB} BTB per check.`
              : `Get told within 5 minutes instead of an hour, for ${FAST_CHECK_BTB} BTB per check. Pay with BTB or your weekly rewards.`}
          </div>
        </div>
        <LpButton tone={fastAlerts ? 'neutral' : 'green'} solid={!fastAlerts} label={fastOpen ? 'Close' : fastAlerts ? 'Manage' : 'Get fast alerts'} onClick={() => setFastOpen((o) => !o)}/>
      </div>
      {fastOpen && <div style={{ marginTop: 6, marginInline: -10 }}><FastAlertsPanel address={connectedAddress} watched={watchedCount}/></div>}
    </div>
  );

  const positionList = (
    <>
      {fastStrip}
      {toolbar}
      {filtered && visiblePositions.length === 0 && positions.length > 0 && (
        <div style={{ color: btb.textMuted, fontSize: 12.5, textAlign: 'center', padding: 18 }}>
          No positions match. <button type="button" onClick={() => { setChainFilter('all'); setProtoFilter('all'); setRangeFilter('all'); }} style={{ border: 'none', background: 'transparent', color: btb.green, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5 }}>Clear filters</button>
        </div>
      )}
      {view === 'list' ? (visiblePositions.length > 0 && positionTable) : visiblePositions.map(renderPositionCard)}
    </>
  );

  const otherChainColumns: Column<KrystalPositionAnalytics>[] = [
    {
      key: 'pool', label: 'Pool', sortable: true,
      sortValue: item => `${item.chainName}${krystalSymbols(item).join('')}`,
      render: item => {
        const symbols = krystalSymbols(item);
        const symbol0 = symbols[0] ?? 'LP';
        const symbol1 = symbols[1];
        const amount0 = item.currentAmounts?.find(amount => amount.token?.symbol === symbol0);
        const amount1 = item.currentAmounts?.find(amount => amount.token?.symbol === symbol1);
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', flexShrink: 0 }}>
              <TokenIcon symbol={symbol0} logoUrl={amount0?.token?.logo} size={26} />
              {symbol1 && <div style={{ marginLeft: -8 }}><TokenIcon symbol={symbol1} logoUrl={amount1?.token?.logo} size={26} /></div>}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{symbols.length ? symbols.join(' / ') : `Position #${item.tokenId}`}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                <LpChainLogo chainId={item.chainId} chainName={item.chainName || `Chain ${item.chainId}`}/>
                <Badge size="sm" color={btb.red} bg="rgba(255,76,107,0.13)" border="none" style={{ fontSize: 10, padding: '1px 6px' }}>{compactProjectLabel(item.pool?.project, item.pool?.projectKey)}</Badge>
              </div>
            </div>
          </div>
        );
      },
    },
    {
      key: 'amounts', label: 'Position', align: 'left',
      render: item => (
        <div style={{ color: btb.textMuted, fontSize: 12.5, lineHeight: 1.5, whiteSpace: 'nowrap' }}>
          {(item.currentAmounts ?? []).slice(0, 2).map((amount, index) => <div key={`${amount.token?.symbol}-${index}`}>{krystalAmountLabel(amount)}</div>)}
          {(item.currentAmounts?.length ?? 0) === 0 && <span style={{ color: btb.textDim }}>—</span>}
        </div>
      ),
    },
    {
      key: 'value', label: 'Value', align: 'right', sortable: true, sortValue: item => item.currentPositionValue,
      render: item => <span style={{ color: btb.text, fontWeight: 700, whiteSpace: 'nowrap' }}>${item.currentPositionValue.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>,
    },
    {
      key: 'fees', label: 'Unclaimed fees', align: 'right', sortable: true, sortValue: item => sumKrystalUsd(item.feePending),
      render: item => {
        const fees = sumKrystalUsd(item.feePending);
        return fees > 0
          ? <span style={{ color: btb.green, fontWeight: 700 }}>${fees.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
          : <span style={{ color: btb.textDim }}>—</span>;
      },
    },
    {
      key: 'status', label: 'Status', align: 'left', sortable: true,
      sortValue: item => item.status?.toUpperCase() === 'IN_RANGE' ? 1 : 0,
      render: item => {
        const inRange = item.status?.toUpperCase() === 'IN_RANGE';
        return <Badge size="sm" border="none" bg={inRange ? 'rgba(var(--green-rgb), 0.14)' : 'rgba(var(--amber-rgb), 0.14)'} color={inRange ? btb.green : btb.amber} style={{ whiteSpace: 'nowrap' }}>{inRange ? 'In range' : 'Out of range'}</Badge>;
      },
    },
    {
      key: 'performance', label: 'Performance', align: 'right', sortable: true, sortValue: item => item.pnl,
      render: item => (
        <div style={{ lineHeight: 1.4, whiteSpace: 'nowrap' }}>
          <div style={{ color: item.pnl >= 0 ? btb.green : btb.loss, fontWeight: 800, fontSize: 13 }}>{fmtSignedMoney(item.pnl)} <span style={{ fontSize: 10.5 }}>({fmtSignedPercent(item.returnOnInvestment)})</span></div>
          <div style={{ color: btb.textMuted, fontSize: 10.5 }}>fees ${(sumKrystalUsd(item.feePending) + sumKrystalUsd(item.feesClaimed)).toLocaleString('en-US', { maximumFractionDigits: 2 })} · vs hold {fmtSignedMoney(item.compareWithHodl)}</div>
        </div>
      ),
    },
    {
      key: 'actions', label: '', align: 'right', width: '340px',
      render: () => <div style={{ display: 'flex', justifyContent: 'flex-end' }}><ActBtn label="Read only" onClick={() => {}} disabled /></div>,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {feePositions.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
          padding: isMobile ? '12px 14px' : '14px 18px', borderRadius: 16,
          background: 'linear-gradient(90deg, rgba(var(--green-rgb), 0.12), rgba(26,173,119,0.08))',
          border: '1px solid rgba(var(--green-rgb), 0.24)',
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: btb.green, fontSize: isMobile ? 16 : 18, fontWeight: 800, letterSpacing: -0.3 }}>
              ${pendingFeesUsd.toLocaleString('en-US', { maximumFractionDigits: 2 })} in fees to collect
            </div>
            <div style={{ color: btb.textMuted, fontSize: 12, marginTop: 2 }}>
              from {feePositions.length} position{feePositions.length === 1 ? '' : 's'}{feePositions.length > 1 ? ', one confirmation per chain' : ''}
            </div>
          </div>
          <LpButton tone="green" solid icon="gift" label={collectingAll ? 'Collecting…' : feePositions.length === 1 ? 'Collect fees' : 'Collect all'} onClick={collectAll} disabled={collectingAll || !!busyId || !canTransact} />
        </div>
      )}

      {/* Portfolio shows these same totals in its own stat tiles. */}
      {positions.length > 0 && !onSummary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: isMobile ? 6 : 10 }}>
          {([
            { label: 'Total value', value: `$${totalValueUsd.toLocaleString('en-US', { maximumFractionDigits: 2 })}`, color: btb.text },
            { label: 'Unclaimed fees', value: `$${pendingFeesUsd.toLocaleString('en-US', { maximumFractionDigits: 2 })}`, color: btb.green },
            { label: 'In range', value: `${inRangeCount} / ${positions.length}`, color: btb.text },
          ] as const).map(s => (
            <Glass key={s.label} padding={isMobile ? 10 : 16} radius={14} soft>
              <div style={{ color: btb.textMuted, fontSize: isMobile ? 9.5 : 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.label}</div>
              <div style={{ color: s.color, fontSize: isMobile ? 14 : 22, fontWeight: 800, marginTop: isMobile ? 2 : 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.value}</div>
            </Glass>
          ))}
        </div>
      )}


      {krystalStats && (
        <Glass padding={isMobile ? 12 : 16} radius={16} soft>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
            <div style={{ color: btb.text, fontSize: 13, fontWeight: 800 }}>LP history</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(5, 1fr)', gap: 8 }}>
            {[
              { label: 'Historical PnL', value: fmtSignedMoney(krystalStats.pnl), color: krystalStats.pnl >= 0 ? btb.green : btb.loss },
              { label: 'ROI', value: fmtSignedPercent(krystalStats.returnOnInvestment), color: krystalStats.returnOnInvestment >= 0 ? btb.green : btb.loss },
              { label: 'Lifetime fees', value: `$${krystalStats.totalFeeEarned.toLocaleString('en-US', { maximumFractionDigits: 2 })}`, color: btb.green },
              { label: 'Vs holding', value: fmtSignedMoney(krystalStats.compareWithHodl), color: krystalStats.compareWithHodl >= 0 ? btb.green : btb.loss },
              { label: 'Positions', value: `${krystalStats.openPositionCount} open · ${krystalStats.closedPositionCount} closed`, color: btb.text },
            ].map((item) => (
              <div key={item.label} style={{ padding: '9px 10px', borderRadius: 11, background: 'rgba(var(--fg-rgb), 0.035)', minWidth: 0 }}>
                <div style={{ color: btb.textDim, fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.35, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</div>
                <div style={{ color: item.color, fontSize: isMobile ? 13 : 14, fontWeight: 800, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.value}</div>
              </div>
            ))}
          </div>
        </Glass>
      )}

      {closedHistory.length > 0 && (
        <Glass padding={12} radius={14} soft>
          <button onClick={() => setShowClosedHistory((open) => !open)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: 'inherit' }}>
            <span style={{ color: btb.text, fontSize: 12.5, fontWeight: 800 }}>Closed LP history ({closedHistory.length})</span>
            <span style={{ color: btb.textMuted, fontSize: 11 }}>{showClosedHistory ? 'Hide' : 'Show'}</span>
          </button>
          {showClosedHistory && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
              {closedHistory.slice(0, 20).map((item) => {
                const symbols = [...new Set((item.feePending ?? []).map((amount) => amount.token?.symbol).filter(Boolean))];
                const closed = item.closedTime ? new Date(item.closedTime * 1000).toLocaleDateString() : 'closed';
                return (
                  <div key={`${item.pool?.projectKey}-${item.tokenId}`} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr auto' : '1.2fr 0.8fr 0.7fr 0.7fr', gap: 10, alignItems: 'center', padding: '9px 10px', borderRadius: 10, background: 'rgba(var(--fg-rgb), 0.035)' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: btb.text, fontSize: 12, fontWeight: 750, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{symbols.length ? symbols.join(' / ') : `Position #${item.tokenId}`}</div>
                      <div style={{ color: btb.textDim, fontSize: 9.5, marginTop: 2 }}>{item.pool?.project ?? 'LP'} · {closed}</div>
                    </div>
                    {!isMobile && <div style={{ color: btb.textMuted, fontSize: 11 }}>Deposited ${item.totalDepositValue.toLocaleString('en-US', { maximumFractionDigits: 2 })}</div>}
                    {!isMobile && <div style={{ color: btb.textMuted, fontSize: 11 }}>Withdrew ${item.totalWithdrawValue.toLocaleString('en-US', { maximumFractionDigits: 2 })}</div>}
                    <div style={{ textAlign: 'right', color: item.pnl >= 0 ? btb.green : btb.loss, fontSize: 12, fontWeight: 800 }}>{fmtSignedMoney(item.pnl)}<div style={{ fontSize: 9.5, marginTop: 1 }}>{fmtSignedPercent(item.returnOnInvestment)}</div></div>
                  </div>
                );
              })}
            </div>
          )}
        </Glass>
      )}

      {isMobile ? (
        // Card list — the 5-column table (with a 340px action column) can't
        // fit a phone; each position becomes a card with full-width actions.
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {attentionBlock}
          {loading && positions.length === 0 && (
            <div style={{ color: btb.textDim, fontSize: 13, textAlign: 'center', padding: 28 }}>Loading positions…</div>
          )}
          {!loading && !krystalLoading && positions.length === 0 && otherChainPositions.length === 0 && (
            <div style={{ color: btb.textMuted, fontSize: 13.5, textAlign: 'center', padding: 28 }}>No LP positions yet</div>
          )}
          {positionList}
          {otherChainPositions.map((item) => {
            const symbols = krystalSymbols(item);
            const symbol0 = symbols[0] ?? 'LP';
            const symbol1 = symbols[1];
            const amount0 = item.currentAmounts?.find(amount => amount.token?.symbol === symbol0);
            const amount1 = item.currentAmounts?.find(amount => amount.token?.symbol === symbol1);
            const pendingFees = sumKrystalUsd(item.feePending);
            const lifetimeFees = pendingFees + sumKrystalUsd(item.feesClaimed);
            const inRange = item.status?.toUpperCase() === 'IN_RANGE';
            return (
              <Glass key={`${item.chainId}-${item.pool?.projectKey}-${item.tokenId}`} padding={14} radius={18}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ display: 'flex', flexShrink: 0 }}>
                    <TokenIcon symbol={symbol0} logoUrl={amount0?.token?.logo} size={26} />
                    {symbol1 && <div style={{ marginLeft: -8 }}><TokenIcon symbol={symbol1} logoUrl={amount1?.token?.logo} size={26} /></div>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: btb.text, fontWeight: 700, fontSize: 14 }}>{symbols.length ? symbols.join(' / ') : `Position #${item.tokenId}`}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2, flexWrap: 'wrap' }}>
                      <LpChainLogo chainId={item.chainId} chainName={item.chainName || `Chain ${item.chainId}`}/>
                      <Badge size="sm" color={btb.red} bg="rgba(255,76,107,0.13)" border="none" style={{ fontSize: 10, padding: '1px 6px' }}>{compactProjectLabel(item.pool?.project, item.pool?.projectKey)}</Badge>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ color: btb.text, fontSize: 14, fontWeight: 800 }}>${item.currentPositionValue.toLocaleString('en-US', { maximumFractionDigits: 2 })}</div>
                    <Badge size="sm" border="none" bg={inRange ? 'rgba(var(--green-rgb), 0.14)' : 'rgba(var(--amber-rgb), 0.14)'} color={inRange ? btb.green : btb.amber} style={{ marginTop: 3, whiteSpace: 'nowrap' }}>{inRange ? 'In range' : 'Out of range'}</Badge>
                  </div>
                </div>

                {(item.currentAmounts?.length ?? 0) > 0 && (
                  <div style={{ color: btb.textMuted, fontSize: 12, marginTop: 10 }}>
                    {(item.currentAmounts ?? []).slice(0, 2).map(krystalAmountLabel).join(' + ')}
                  </div>
                )}
                {pendingFees > 0 && <div style={{ color: btb.green, fontSize: 12, marginTop: 3 }}>Fees: ${pendingFees.toLocaleString('en-US', { maximumFractionDigits: 2 })}</div>}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 9 }}>
                  <div style={{ background: 'rgba(var(--fg-rgb), 0.035)', borderRadius: 10, padding: '8px 9px' }}>
                    <div style={{ color: btb.textDim, fontSize: 9.5 }}>HISTORICAL PNL</div>
                    <div style={{ color: item.pnl >= 0 ? btb.green : btb.loss, fontSize: 12.5, fontWeight: 800, marginTop: 2 }}>{fmtSignedMoney(item.pnl)} · {fmtSignedPercent(item.returnOnInvestment)}</div>
                  </div>
                  <div style={{ background: 'rgba(var(--fg-rgb), 0.035)', borderRadius: 10, padding: '8px 9px' }}>
                    <div style={{ color: btb.textDim, fontSize: 9.5 }}>LIFETIME FEES</div>
                    <div style={{ color: btb.green, fontSize: 12.5, fontWeight: 800, marginTop: 2 }}>${lifetimeFees.toLocaleString('en-US', { maximumFractionDigits: 2 })}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', marginTop: 12 }}><LpButton full label="Read only" onClick={() => {}} disabled /></div>
              </Glass>
            );
          })}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {loading && positions.length === 0 && (
            <div style={{ color: btb.textDim, fontSize: 13, textAlign: 'center', padding: 28 }}>
              {krystalLoading ? 'Loading positions…' : 'Loading positions…'}
            </div>
          )}
          {!loading && positions.length === 0 && otherChainPositions.length === 0 && (
            <div style={{ color: btb.textMuted, fontSize: 13.5, textAlign: 'center', padding: 28 }}>No LP positions yet</div>
          )}
          {attentionBlock}
          {positionList}
          {otherChainPositions.length > 0 && (
            <div style={{ borderRadius: 16, border: btb.borderSoft, background: btb.surfaceSoft, overflow: 'hidden' }}>
            <DataTable
              columns={otherChainColumns}
              rows={otherChainPositions}
              rowKey={item => `${item.chainId}-${item.pool?.projectKey}-${item.tokenId}`}
              defaultSortKey="value"
            />
            </div>
          )}
        </div>
      )}

      {manage && connectedAddress && (
        <ManageSheet
          pos={manage.pos}
          mode={manage.mode}
          account={connectedAddress as `0x${string}`}
          onClose={() => setManage(null)}
          onDone={async () => { setManage(null); await load(); }}
        />
      )}

      {share && <SharePositionCard data={share} onClose={() => setShare(null)}/>}
      {rebalance && connectedAddress && canActOn(rebalance) && (
        <RebalanceFlow
          pos={rebalance}
          account={connectedAddress as `0x${string}`}
          onClose={() => setRebalance(null)}
          onDone={async () => { await load(); }}
        />
      )}

    </div>
  );
}

function ActBtn({ label, onClick, disabled, green }: { label: string; onClick: () => void; disabled?: boolean; green?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      height: 32, padding: '0 13px', borderRadius: 10, fontFamily: 'inherit', fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap',
      border: disabled ? '1px solid transparent' : green ? '1px solid rgba(var(--green-rgb), 0.4)' : '1px solid rgba(var(--fg-rgb), 0.14)',
      cursor: disabled ? 'default' : 'pointer',
      background: disabled ? 'rgba(var(--fg-rgb), 0.06)' : green ? 'rgba(var(--green-rgb), 0.16)' : 'rgba(var(--fg-rgb), 0.07)',
      color: disabled ? btb.textDim : green ? btb.green : btb.text,
    }}>{label}</button>
  );
}

function ManageSheet({ pos, mode, account, onClose, onDone }: {
  pos: LiquidityPosition; mode: 'add' | 'withdraw'; account: `0x${string}`;
  onClose: () => void; onDone: () => void | Promise<void>;
}) {
  const { width: sidebarWidth } = useSidebar();
  const { track } = useTx();
  const config = useConfig();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // withdraw state
  const [pct, setPct] = useState(100);
  // add state
  const side = addSide(pos.sqrtPriceX96, pos.tickLower, pos.tickUpper); // 'both' | 'token0' | 'token1'
  const inputSide: 0 | 1 = side === 'token1' ? 1 : 0;
  const [amtStr, setAmtStr] = useState('');
  const [useEth, setUseEth] = useState(true);

  const isV4 = pos.protocol === 'uniswap-v4';
  const actionSlippageBps = lpSlippageBps(pos.chainId ?? 1, SLIPPAGE_BPS);
  // Native-ETH deposit side. V3: the WETH token (user can toggle ETH vs WETH).
  // V4: currency0 = address(0) IS native ETH — always ETH, nothing to toggle.
  const chainWeth = (pos.chainId ?? 1) === 1 ? null : wrappedNativeFor(pos.chainId ?? 1).toLowerCase();
  const wethSide: 0 | 1 | null = isV4 ? null : (chainWeth ? pos.token0.toLowerCase() === chainWeth : isWeth(pos.token0)) ? 0 : (chainWeth ? pos.token1.toLowerCase() === chainWeth : isWeth(pos.token1)) ? 1 : null;
  const nativeSide: 0 | 1 | null = isV4 ? (isNativeCurrency(pos.token0) ? 0 : null) : wethSide;
  const ethMode = isV4 ? nativeSide !== null : (wethSide !== null && useEth);
  const sym0 = ethMode && nativeSide === 0 ? 'ETH' : pos.symbol0;
  const sym1 = ethMode && nativeSide === 1 ? 'ETH' : pos.symbol1;

  const inputDecimals = inputSide === 0 ? pos.decimals0 : pos.decimals1;
  const inputSymbol = inputSide === 0 ? sym0 : sym1;

  let add0 = 0n, add1 = 0n;
  try {
    if (amtStr && parseFloat(amtStr) > 0) {
      const raw = parseUnits(amtStr, inputDecimals);
      const r = addAmounts(pos.sqrtPriceX96, pos.tickLower, pos.tickUpper, inputSide, raw);
      add0 = r.amount0; add1 = r.amount1;
    }
  } catch { /* mid-typing */ }

  // wallet balances (for the Add flow) — both tokens + native ETH
  const [bal0, setBal0] = useState(0n);
  const [bal1, setBal1] = useState(0n);
  const [ethBal, setEthBal] = useState(0n);
  useEffect(() => {
    if (mode !== 'add') return;
    let live = true;
    const client = getPublicClient(config, { chainId: (pos.chainId ?? 1) as number });
    if (!client) return;
    (async () => {
      try {
        const [b0, b1] = await withSafeMulticall(client).multicall({
          contracts: [
            { address: pos.token0, abi: erc20Abi, functionName: 'balanceOf', args: [account] },
            { address: pos.token1, abi: erc20Abi, functionName: 'balanceOf', args: [account] },
          ],
          allowFailure: true,
        });
        const eb = await client.getBalance({ address: account });
        if (live) {
          setBal0(b0.status === 'success' ? (b0.result as bigint) : 0n);
          setBal1(b1.status === 'success' ? (b1.result as bigint) : 0n);
          setEthBal(eb);
        }
      } catch { /* unknown balances */ }
    })();
    return () => { live = false; };
  }, [mode, config, account, pos.token0, pos.token1]);

  const effBal0 = ethMode && nativeSide === 0 ? ethBal : bal0;
  const effBal1 = ethMode && nativeSide === 1 ? ethBal : bal1;
  const short0 = add0 > effBal0;
  const short1 = add1 > effBal1;
  const inputBal = inputSide === 0 ? effBal0 : effBal1;

  const out0 = (pos.amount0 * BigInt(pct)) / 100n;
  const out1 = (pos.amount1 * BigInt(pct)) / 100n;

  async function run() {
    setBusy(true); setErr(null);
    try {
      const calls = isV4
        ? (mode === 'withdraw'
            ? buildV4Remove(pos, pct * 100, actionSlippageBps, account, v4DeploymentOf(pos))
            : buildV4Increase(
                pos,
                liquidityForAmounts(pos.sqrtPriceX96, pos.tickLower, pos.tickUpper, add0, add1),
                maxIn(add0, actionSlippageBps), maxIn(add1, actionSlippageBps),
                account, v4DeploymentOf(pos),
              ))
        : (mode === 'withdraw'
            ? buildRemove(pos, pct * 100, actionSlippageBps, account, v3DeploymentOf(pos))
            : buildIncrease(pos, add0, add1, actionSlippageBps, ethMode ? wethSide : null, v3DeploymentOf(pos)));
      await runCalls(config, {
        account,
        calls,
        label: `${mode === 'withdraw' ? 'Withdraw' : 'Add'} ${pos.symbol0}/${pos.symbol1}`,
        track, chainId: (pos.chainId ?? 1) as number,
      });
      await onDone();
    } catch (e) {
      setErr((e as { shortMessage?: string })?.shortMessage ?? (e as Error)?.message ?? 'Failed');
    } finally { setBusy(false); }
  }

  const canRun = mode === 'withdraw' ? pct > 0 : ((add0 > 0n || add1 > 0n) && !short0 && !short1);

  return (
    <Portal>
    <div onClick={onClose} style={{ position: 'fixed', top: 0, left: sidebarWidth, right: 0, bottom: 0, zIndex: 320, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', overflowY: 'auto' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, background: 'rgba(var(--bg-rgb), 0.98)', border: '1px solid rgba(var(--fg-rgb), 0.1)', borderRadius: 28, padding: '12px 20px calc(32px + env(safe-area-inset-bottom, 0px))' }}>
        <div style={{ color: btb.text, fontSize: 19, fontWeight: 800, letterSpacing: -0.4, marginBottom: 4 }}>
          {mode === 'withdraw' ? 'Withdraw liquidity' : 'Add liquidity'}
        </div>
        <div style={{ color: btb.textMuted, fontSize: 13, marginBottom: 18 }}>{pos.symbol0} / {pos.symbol1} · {fmtFeeTier(pos.fee)} · {protocolBadgeLabel(pos)}</div>

        {mode === 'withdraw' ? (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {[25, 50, 75, 100].map((v) => (
                <button key={v} onClick={() => setPct(v)} style={{
                  flex: 1, height: 40, borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
                  background: pct === v ? 'rgba(var(--green-rgb), 0.18)' : 'rgba(var(--fg-rgb), 0.06)',
                  border: `1px solid ${pct === v ? 'rgba(var(--green-rgb), 0.5)' : 'rgba(var(--fg-rgb), 0.12)'}`,
                  color: pct === v ? 'var(--btb-green)' : btb.textMuted,
                }}>{v}%</button>
              ))}
            </div>
            <Glass padding={14} radius={14} soft>
              <div style={{ color: btb.textMuted, fontSize: 12, marginBottom: 6 }}>You receive (min, after {actionSlippageBps / 100}% slippage)</div>
              <div style={{ color: btb.text, fontSize: 15, fontWeight: 700 }}>
                ≈ {fmtAmt(out0, pos.decimals0)} {pos.symbol0} + {fmtAmt(out1, pos.decimals1)} {pos.symbol1}
              </div>
            </Glass>
          </>
        ) : (
          <>
            {wethSide !== null && (
              <div onClick={() => setUseEth((v) => !v)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: 14, background: 'rgba(var(--fg-rgb), 0.04)', borderRadius: 12, padding: '10px 14px' }}>
                <span style={{ color: btb.text, fontSize: 13, fontWeight: 600 }}>Pay with ETH <span style={{ color: btb.textDim, fontWeight: 400 }}>(instead of WETH)</span></span>
                <div style={{ width: 42, height: 24, borderRadius: 999, background: useEth ? 'var(--btb-green)' : 'rgba(var(--fg-rgb), 0.18)', position: 'relative', transition: 'background 0.2s' }}>
                  <div style={{ position: 'absolute', top: 2, left: useEth ? 20 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }}/>
                </div>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ color: btb.textMuted, fontSize: 12 }}>Amount of {inputSymbol}{side === 'both' ? ' (paired auto)' : ''}</span>
              <span style={{ color: btb.textMuted, fontSize: 12 }}>
                Balance: {fmtAmt(inputBal, inputDecimals)}
                <span onClick={() => setAmtStr(formatUnits(inputBal, inputDecimals))} style={{ color: btb.red, fontWeight: 700, marginLeft: 6, cursor: 'pointer' }}>MAX</span>
              </span>
            </div>
            <input
              value={amtStr}
              onChange={(e) => setAmtStr(e.target.value.replace(/[^0-9.]/g, ''))}
              inputMode="decimal" placeholder="0"
              style={{ width: '100%', height: 52, background: 'rgba(var(--fg-rgb), 0.06)', border: '1px solid rgba(var(--fg-rgb), 0.12)', borderRadius: 14, padding: '0 16px', color: btb.text, fontSize: 22, fontWeight: 700, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}/>
            {(add0 > 0n || add1 > 0n) && (
              <div style={{ color: btb.textMuted, fontSize: 13, marginTop: 10 }}>
                Deposit: {fmtAmt(add0, pos.decimals0)} {sym0} + {fmtAmt(add1, pos.decimals1)} {sym1}
              </div>
            )}
            {(short0 || short1) && (
              <div style={{ color: btb.loss, fontSize: 12, marginTop: 8 }}>Insufficient {short0 ? sym0 : sym1} balance</div>
            )}
            {!pos.inRange && (
              <div style={{ color: 'var(--btb-amber)', fontSize: 11, marginTop: 8 }}>Out of range — only {inputSymbol} is needed at the current price.</div>
            )}
          </>
        )}

        {err && <div style={{ color: btb.loss, fontSize: 12, marginTop: 12 }}>{err}</div>}

        <Button variant="success" size="md" onClick={() => { if (!busy) run(); }} disabled={!canRun} style={{ marginTop: 18, fontWeight: 800 }}>
          {busy ? 'Confirming…' : mode === 'withdraw' ? `Withdraw ${pct}%` : 'Add liquidity'}
        </Button>
        <div style={{ color: btb.textDim, fontSize: 11, textAlign: 'center', marginTop: 10 }}>
          Slippage-protected ({actionSlippageBps / 100}%). {mode === 'add' ? 'Token approvals are included automatically.' : 'Withdraws principal + fees to your wallet.'}
        </div>
      </div>
    </div>
    </Portal>
  );
}
