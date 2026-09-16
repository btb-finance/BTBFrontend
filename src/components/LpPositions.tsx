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
import { fetchAerodromeStakedByIds, AERODROME_CL_DEPLOYMENTS, BASE_CHAIN_ID } from '@/protocols/dexs/aerodrome';
import { withStakeTargets, fetchStakedPositions, stakingSupported, stakingDeploymentsFor, buildStakeCalls, buildUnstakeCalls, buildClaimCalls } from '@/protocols/staking';
import { LP_CHAINS, LP_CHAIN_NAMES, v3DeploymentFor, v4DeploymentFor, v4DeployBlockFor, deploymentOfPosition, v4DeploymentOfPosition, canActOnPosition, wrappedNativeFor, lpSlippageBps } from '@/protocols/lpChains';
import { Icon } from './Icon';
import { RangeBar, LpButton, lpBox, lpBoxLabel, lpBoxValue, fmtPrice } from './LpCardParts';
import { STABLES, DISCOVERY_CHAINS } from '../lib/pools';
import { useDiscoverPools } from '../lib/discoverPools';
import { RebalanceFlow } from './RebalanceFlow';
import { SharePositionCard, type ShareCardData } from './SharePositionCard';
import { withSafeMulticall } from '@/lib/safeMulticall';
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
  const [usd, setUsd] = useState<Record<string, number>>({});

  const [showClosedHistory, setShowClosedHistory] = useState(false);
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
        const aero = chainId === 8453 ? AERODROME_CL_DEPLOYMENTS : [];

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

  const analyticsOf = (p: LiquidityPosition) => krystal?.positions?.find((item) => krystalMatches(p, item));
  const krystalStats = krystal?.statsByChain?.all ?? krystal?.statsByChain?.['1'];
  const otherChainPositions = (krystal?.positions ?? []).filter((item) =>
    item.chainId !== 1 && !(item.status?.toUpperCase().includes('CLOSED') || item.closedTime > 0) &&
    !positions.some((p) => krystalMatches(p, item)),
  );
  const closedHistory = (krystal?.positions ?? []).filter((item) =>
    item.status?.toUpperCase().includes('CLOSED') || item.closedTime > 0,
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
      const quoteLabel = flipQuote ? `${p.symbol0}/${p.symbol1}` : `${p.symbol1}/${p.symbol0}`;
      const fullRange = p.tickLower <= -887200 && p.tickUpper >= 887200;
      const lo = priceOf(flipQuote ? p.tickUpper : p.tickLower), hi = priceOf(flipQuote ? p.tickLower : p.tickUpper);
      return {
        holdings: [p.amount0 > 0n ? `${fmtAmt(p.amount0, p.decimals0)} ${p.symbol0}` : '', p.amount1 > 0n ? `${fmtAmt(p.amount1, p.decimals1)} ${p.symbol1}` : ''].filter(Boolean).join(' + ') || undefined,
        unclaimedFees: feeTokens || undefined,
        priceNow: `${fmtPrice(priceOf(p.currentTick))} ${quoteLabel}`,
        rangeLabel: fullRange ? 'Full range' : `${fmtPrice(lo)} to ${fmtPrice(hi)}`,
        positionId: p.id.toString(),
        pair: `${p.symbol0} / ${p.symbol1}`, symbol0: p.symbol0, symbol1: p.symbol1,
        dexLabel: protocolBadgeLabel(p), chainName: p.chainName ?? LP_CHAIN_NAMES[(p.chainId ?? 1) as keyof typeof LP_CHAIN_NAMES] ?? 'Ethereum',
        feeTierLabel: fmtFeeTier(p.fee), inRange: p.inRange,
        feesEarnedUsd,
        feesPer30dUsd: ageMs && ageMs > 3_600_000 ? (feesEarnedUsd / ageMs) * 30 * 86_400_000 : undefined,
        aprPct: a && a.apr > 0 ? a.apr : a && a.feeApr > 0 ? a.feeApr : undefined,
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
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            {v > 0 && <div style={{ color: btb.text, fontSize: isMobile ? 16 : 19, fontWeight: 800 }}>{money(v)}</div>}
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
            </div>
          )}
        </div>

        <div style={{ ...box, marginTop: 8 }}>
          <RangeBar p={p}/>
        </div>

        {a && (
          <div style={{ ...box, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 7 }}>
            {line('Invested', money(a.totalDepositValue))}
            {line('Current value', money(v > 0 ? v : a.totalDepositValue + a.pnl))}
            {a.totalWithdrawValue > 0 && line('Withdrawn', money(a.totalWithdrawValue))}
            {a.feeApr > 0 && line('Fee APR', `${a.feeApr.toFixed(1)}%`, btb.textMuted)}
            <div style={{ borderTop: '1px solid rgba(var(--fg-rgb), 0.08)', marginTop: 2, paddingTop: 8 }}>
              {line('P&L', `${fmtSignedMoney(a.pnl)} (${fmtSignedPercent(a.returnOnInvestment)})`, a.pnl >= 0 ? btb.green : btb.loss, true)}
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${isMobile ? 2 : 'auto-fit'}, minmax(${isMobile ? 0 : 130}px, 1fr))`, gap: 8, marginTop: 12 }}>
          {p.staked ? (
            <>
              <LpButton full tone="green" label={busy ? 'Working…' : `Claim ${p.staked.rewardSymbol}`} onClick={() => gaugeAction(p, 'claim')} disabled={p.staked.earned === 0n || busy || !canTransact}/>
              <LpButton full tone="amber" label="Unstake" onClick={() => gaugeAction(p, 'unstake')} disabled={busy || !canTransact}/>
            </>
          ) : (
            <>
              <LpButton full tone="green" solid={hasFees} label={busy ? 'Collecting…' : 'Collect fees'} onClick={() => collect(p)} disabled={!hasFees || busy || !canTransact}/>
              <LpButton full label="Add liquidity" onClick={() => setManage({ pos: p, mode: 'add' })} disabled={busy || !canTransact}/>
              {p.stakeable && hasLiquidity && <LpButton full label={`Stake for ${p.stakeable.rewardSymbol ?? 'rewards'}`} onClick={() => gaugeAction(p, 'stake')} disabled={busy || !canTransact}/>}
            </>
          )}
          {canRebalance && <LpButton full tone={p.inRange ? 'neutral' : 'amber'} label={p.inRange ? 'Rebalance' : 'Rebalance now'} onClick={() => setRebalance(p)} disabled={busy || !canTransact}/>}
          {!p.staked && hasLiquidity && <LpButton full tone="danger" label="Withdraw" onClick={() => setManage({ pos: p, mode: 'withdraw' })} disabled={busy || !canTransact}/>}
          <LpButton full label="Flex" onClick={() => setShare(shareData())}/>
        </div>
      </Glass>
    );
  };

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
          {loading && positions.length === 0 && (
            <div style={{ color: btb.textDim, fontSize: 13, textAlign: 'center', padding: 28 }}>Loading positions…</div>
          )}
          {!loading && !krystalLoading && positions.length === 0 && otherChainPositions.length === 0 && (
            <div style={{ color: btb.textMuted, fontSize: 13.5, textAlign: 'center', padding: 28 }}>No LP positions yet</div>
          )}
          {[...positions].sort((a, b) => valueOf(b) - valueOf(a)).map(renderPositionCard)}
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
          {[...positions].sort((a, b) => valueOf(b) - valueOf(a)).map(renderPositionCard)}
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
