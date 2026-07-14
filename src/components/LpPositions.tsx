'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
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
import { useTokenStore } from '../lib/TokenStore';
import { runCalls } from '../lib/txRunner';
import { getTokenPricesUsd } from '../lib/defillama';
import {
  fetchV3Positions, buildCollect, buildRemove, buildIncrease,
  fetchV4Positions, buildV4Collect, buildV4Remove, buildV4Increase,
  addAmounts, addSide, isWeth, isNativeCurrency, liquidityForAmounts, maxIn, SLIPPAGE_BPS,
  fmtFeeTier, NATIVE_CURRENCY, UNISWAP_V3_DEPLOYMENT, type LiquidityPosition, type V3Deployment,
} from '@/protocols/dexs/uniswap';
import { fetchPancakePositions, PANCAKE_V3_DEPLOYMENT } from '@/protocols/dexs/pancakeswap';
import { UNISWAP_V4 } from '@/protocols/dexs/uniswap/v4/addresses';
import { fetchOwnedNftTokenIds } from '../lib/alchemy';
import { RebalanceSheet } from './RebalanceSheet';

/** Deployment for a V3-architecture position (Uniswap default, Pancake fork). */
function v3DeploymentOf(p: LiquidityPosition): V3Deployment {
  return p.protocol === 'pancakeswap-v3' ? PANCAKE_V3_DEPLOYMENT : UNISWAP_V3_DEPLOYMENT;
}

const PROTOCOL_BADGE: Record<LiquidityPosition['protocol'], { label: string; color: string }> = {
  'uniswap-v3': { label: 'V3', color: '#FF007A' },
  'uniswap-v4': { label: 'V4', color: '#FF007A' },
  'pancakeswap-v3': { label: 'CAKE V3', color: '#1FC7D4' },
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

const posKey = (p: LiquidityPosition) => `${p.protocol}-${p.id.toString()}`;

interface KrystalTokenAmount {
  token?: { symbol?: string; logo?: string; decimals?: number };
  balance?: string;
  quotes?: { usd?: { value?: number } };
}

interface KrystalPositionAnalytics {
  chainId: number;
  chainName: string;
  chainLogo?: string;
  tokenId: string;
  status: string;
  pnl: number;
  returnOnInvestment: number;
  compareWithHodl: number;
  apr: number;
  feeApr: number;
  farmApr: number;
  totalDepositValue: number;
  totalWithdrawValue: number;
  currentPositionValue: number;
  createdTime: number;
  closedTime: number;
  feePending?: KrystalTokenAmount[];
  feesClaimed?: KrystalTokenAmount[];
  currentAmounts?: KrystalTokenAmount[];
  pool?: { projectKey?: string; project?: string };
}

interface KrystalLpStats {
  openPositionCount: number;
  closedPositionCount: number;
  currentPositionValue: number;
  pnl: number;
  returnOnInvestment: number;
  compareWithHodl: number;
  totalFeeEarned: number;
  unclaimedFees: number;
  feeApr: number;
  farmApr: number;
}

interface KrystalLpResponse {
  positions?: KrystalPositionAnalytics[];
  statsByChain?: Record<string, KrystalLpStats>;
}

const KRYSTAL_PROTOCOL: Record<LiquidityPosition['protocol'], string> = {
  'uniswap-v3': 'uniswapv3',
  'uniswap-v4': 'uniswapv4',
  'pancakeswap-v3': 'pancakev3',
};

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
export function LpPositions({ showEmpty = false }: { showEmpty?: boolean } = {}) {
  const { isMobile } = useSidebar();
  const { address: connectedAddress } = useConnection();
  const config = useConfig();
  const { track } = useTx();
  const [positions, setPositions] = useState<LiquidityPosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [manage, setManage] = useState<{ pos: LiquidityPosition; mode: 'add' | 'withdraw' } | null>(null);
  const [rebalance, setRebalance] = useState<LiquidityPosition | null>(null);
  const [usd, setUsd] = useState<Record<string, number>>({});
  const [krystal, setKrystal] = useState<KrystalLpResponse | null>(null);
  const [krystalLoading, setKrystalLoading] = useState(false);
  const [showClosedHistory, setShowClosedHistory] = useState(false);
  // TokenStore prices cover tokens DeFiLlama doesn't index (BTB, small caps) —
  // read through a ref so balance refreshes don't retrigger the price effect.
  const { tokens: storeTokens, walletAddress } = useTokenStore();
  const address = walletAddress ?? connectedAddress;
  const canTransact = !!connectedAddress && !!address && connectedAddress.toLowerCase() === address.toLowerCase();
  const storeTokensRef = useRef(storeTokens);
  storeTokensRef.current = storeTokens;

  const load = useCallback(async () => {
    if (!address) { setPositions([]); return; }
    setLoading(true);
    try {
      const client = getPublicClient(config);
      if (!client) return;
      // Fast path: every position (V3, V4, Pancake V3) is an NFT — one
      // indexed Alchemy call enumerates all tokenIds at once, replacing the
      // balanceOf/tokenOfOwnerByIndex loops and the V4 Transfer-log scan.
      // On failure `ids` is null and each fetcher falls back to its own
      // on-chain enumeration.
      const ids = await fetchOwnedNftTokenIds(address, [
        UNISWAP_V3_DEPLOYMENT.positionManager,
        UNISWAP_V4.positionManager,
        PANCAKE_V3_DEPLOYMENT.positionManager,
      ]).catch(() => null);
      const idsFor = (contract: string) => ids?.get(contract.toLowerCase());

      // Each protocol renders as soon as it resolves and degrades
      // independently — a slow/failing V4 log scan can't hold up the V3 list.
      const merge = (protocol: LiquidityPosition['protocol']) => (items: LiquidityPosition[]) =>
        setPositions((prev) => [...prev.filter((p) => p.protocol !== protocol), ...items]);
      await Promise.allSettled([
        fetchV3Positions(client, address as `0x${string}`, undefined, idsFor(UNISWAP_V3_DEPLOYMENT.positionManager)).then(merge('uniswap-v3')),
        fetchV4Positions(client, address as `0x${string}`, idsFor(UNISWAP_V4.positionManager)).then(merge('uniswap-v4')),
        fetchPancakePositions(client, address as `0x${string}`, idsFor(PANCAKE_V3_DEPLOYMENT.positionManager)).then(merge('pancakeswap-v3')),
      ]);
    } catch { /* read failure — leave list empty */ }
    finally { setLoading(false); }
  }, [address, config]);

  useEffect(() => { load(); }, [load]);

  // Optional cost-basis/history enrichment. Failure never hides or changes the
  // on-chain position list and never affects transaction construction.
  useEffect(() => {
    let live = true;
    setKrystal(null);
    setKrystalLoading(!!address);
    if (!address) return;
    fetch(`/api/krystal/lp?address=${address}`, { cache: 'no-store' })
      .then(async (res) => res.ok ? res.json() as Promise<KrystalLpResponse> : null)
      .then((data) => { if (live && data) setKrystal(data); })
      .catch(() => {})
      .finally(() => { if (live) setKrystalLoading(false); });
    return () => { live = false; };
  }, [address]);

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
    getTokenPricesUsd(addrs)
      .then((llama) => setUsd({ ...fromStore, ...llama }))
      .catch(() => {});
  }, [positions]);

  async function collect(pos: LiquidityPosition) {
    if (!connectedAddress || !canTransact) return;
    setBusyId(posKey(pos));
    try {
      await runCalls(config, {
        account: connectedAddress as `0x${string}`,
        calls: pos.protocol === 'uniswap-v4'
          ? buildV4Collect(pos, connectedAddress as `0x${string}`)
          : buildCollect(pos.id, connectedAddress as `0x${string}`, v3DeploymentOf(pos)),
        label: `Collect ${pos.symbol0}/${pos.symbol1} fees`,
        track,
      });
      await load();
    } catch { /* surfaced via the global tx pill */ }
    finally { setBusyId(null); }
  }

  if (!address) {
    return showEmpty ? (
      <Glass padding={16} radius={18}>
        <div style={{ color: btb.textMuted, fontSize: 13, textAlign: 'center' }}>Connect your wallet to see your LP positions.</div>
      </Glass>
    ) : null;
  }
  if (!loading && !krystalLoading && positions.length === 0 && (krystal?.positions?.length ?? 0) === 0) {
    return showEmpty ? (
      <Glass padding={16} radius={18}>
        <div style={{ color: btb.textMuted, fontSize: 13, textAlign: 'center' }}>
          No LP positions yet — add one from the Earn tab.
        </div>
      </Glass>
    ) : null;
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
  const analyticsOf = (p: LiquidityPosition) => krystal?.positions?.find((item) =>
    item.tokenId === p.id.toString() && item.pool?.projectKey?.toLowerCase() === KRYSTAL_PROTOCOL[p.protocol],
  );
  const krystalStats = krystal?.statsByChain?.all ?? krystal?.statsByChain?.['1'];
  const otherChainPositions = (krystal?.positions ?? []).filter((item) =>
    item.chainId !== 1 && !(item.status?.toUpperCase().includes('CLOSED') || item.closedTime > 0),
  );
  const closedHistory = (krystal?.positions ?? []).filter((item) =>
    item.status?.toUpperCase().includes('CLOSED') || item.closedTime > 0,
  );

  const columns: Column<LiquidityPosition>[] = [
    {
      key: 'pool', label: 'Pool', sortable: true, sortValue: p => `${p.symbol0}${p.symbol1}`,
      render: p => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex' }}>
            <TokenIcon symbol={p.symbol0} size={26} />
            <div style={{ marginLeft: -8 }}><TokenIcon symbol={p.symbol1} size={26} /></div>
          </div>
          <div>
            <div style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{p.symbol0} / {p.symbol1}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
              <Badge size="sm" color={btb.textMuted} bg={btb.surfaceSoft} border="none" style={{ fontSize: 10, padding: '1px 6px' }}>{fmtFeeTier(p.fee)}</Badge>
              <Badge size="sm" color={PROTOCOL_BADGE[p.protocol].color} bg={`${PROTOCOL_BADGE[p.protocol].color}1f`} border="none" style={{ fontSize: 10, padding: '1px 6px' }}>{PROTOCOL_BADGE[p.protocol].label}</Badge>
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'amounts', label: 'Position', align: 'left',
      render: p => (
        <div style={{ color: btb.textMuted, fontSize: 12.5, lineHeight: 1.5, whiteSpace: 'nowrap' }}>
          <div>{fmtAmt(p.amount0, p.decimals0)} {p.symbol0}</div>
          <div>{fmtAmt(p.amount1, p.decimals1)} {p.symbol1}</div>
        </div>
      ),
    },
    {
      key: 'value', label: 'Value', align: 'right', sortable: true, sortValue: p => valueOf(p),
      render: p => {
        const v = valueOf(p);
        return v > 0
          ? <span style={{ color: btb.text, fontWeight: 700, whiteSpace: 'nowrap' }}>${v.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
          : <span style={{ color: btb.textDim }}>—</span>;
      },
    },
    {
      key: 'fees', label: 'Unclaimed fees', align: 'right', sortable: true, sortValue: p => feesValueOf(p),
      render: p => {
        if (p.fees0 === 0n && p.fees1 === 0n) return <span style={{ color: btb.textDim }}>—</span>;
        const v = feesValueOf(p);
        return (
          <div style={{ lineHeight: 1.4 }}>
            <div style={{ color: btb.green, fontWeight: 700, fontSize: 13 }}>
              {v > 0 ? `$${v.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : '—'}
            </div>
            <div style={{ color: btb.textMuted, fontSize: 11, whiteSpace: 'nowrap' }}>
              {fmtAmt(p.fees0, p.decimals0)} {p.symbol0} + {fmtAmt(p.fees1, p.decimals1)} {p.symbol1}
            </div>
          </div>
        );
      },
    },
    {
      key: 'status', label: 'Status', align: 'left', sortable: true, sortValue: p => (p.inRange ? 1 : 0),
      render: p => (
        <Badge size="sm" border="none" bg={p.inRange ? 'rgba(82,227,164,0.14)' : 'rgba(255,179,107,0.14)'} color={p.inRange ? btb.green : btb.amber} style={{ whiteSpace: 'nowrap' }}>
          {p.inRange ? 'In range' : 'Out of range'}
        </Badge>
      ),
    },
    {
      key: 'performance', label: 'Performance', align: 'right', sortable: true, sortValue: p => analyticsOf(p)?.pnl ?? Number.NEGATIVE_INFINITY,
      render: p => {
        const a = analyticsOf(p);
        if (!a) return <span style={{ color: btb.textDim }}>—</span>;
        const lifetimeFees = sumKrystalUsd(a.feePending) + sumKrystalUsd(a.feesClaimed);
        return (
          <div style={{ lineHeight: 1.4, whiteSpace: 'nowrap' }} title="Third-party historical estimate from Krystal">
            <div style={{ color: a.pnl >= 0 ? btb.green : btb.loss, fontWeight: 800, fontSize: 13 }}>{fmtSignedMoney(a.pnl)} <span style={{ fontSize: 10.5 }}>({fmtSignedPercent(a.returnOnInvestment)})</span></div>
            <div style={{ color: btb.textMuted, fontSize: 10.5 }}>fees ${lifetimeFees.toLocaleString('en-US', { maximumFractionDigits: 2 })} · vs hold {fmtSignedMoney(a.compareWithHodl)}</div>
            {(a.feeApr > 0 || a.farmApr > 0) && <div style={{ color: btb.textDim, fontSize: 10 }}>fee APR {a.feeApr.toFixed(1)}%{a.farmApr > 0 ? ` · farm ${a.farmApr.toFixed(1)}%` : ''}</div>}
          </div>
        );
      },
    },
    {
      key: 'actions', label: '', align: 'right', width: '340px',
      render: p => {
        const hasFees = p.fees0 > 0n || p.fees1 > 0n;
        const hasLiquidity = p.liquidity > 0n;
        const canRebalance = hasLiquidity && (p.protocol !== 'uniswap-v4' || isNativeCurrency(p.hooks ?? NATIVE_CURRENCY));
        const busy = busyId === posKey(p);
        return (
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
            <ActBtn label="Add" onClick={() => setManage({ pos: p, mode: 'add' })} disabled={busy || !canTransact}/>
            {hasLiquidity && <ActBtn label="Withdraw" onClick={() => setManage({ pos: p, mode: 'withdraw' })} disabled={busy || !canTransact}/>} 
            <ActBtn label={busy ? '…' : 'Collect'} onClick={() => collect(p)} disabled={!hasFees || busy || !canTransact} green/>
            {canRebalance && (
              <button onClick={() => setRebalance(p)} disabled={busy || !canTransact} style={{
                height: 32, padding: '0 13px', borderRadius: 10, fontFamily: 'inherit', whiteSpace: 'nowrap',
                border: p.inRange ? '1px solid rgba(255,255,255,0.14)' : '1px solid rgba(255,179,107,0.4)',
                fontSize: 11.5, fontWeight: 700, cursor: busy || !canTransact ? 'default' : 'pointer',
                background: p.inRange ? 'rgba(255,255,255,0.07)' : 'rgba(255,179,107,0.14)',
                color: p.inRange ? btb.text : btb.amber,
              }}>
                ⚖ Rebalance
              </button>
            )}
          </div>
        );
      },
    },
  ];

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
                <Badge size="sm" color={btb.textMuted} bg={btb.surfaceSoft} border="none" style={{ fontSize: 10, padding: '1px 6px' }}>{item.chainName || `Chain ${item.chainId}`}</Badge>
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
        return <Badge size="sm" border="none" bg={inRange ? 'rgba(82,227,164,0.14)' : 'rgba(255,179,107,0.14)'} color={inRange ? btb.green : btb.amber} style={{ whiteSpace: 'nowrap' }}>{inRange ? 'In range' : 'Out of range'}</Badge>;
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

      {positions.length > 0 && (
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
              <div key={item.label} style={{ padding: '9px 10px', borderRadius: 11, background: 'rgba(255,255,255,0.035)', minWidth: 0 }}>
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
                  <div key={`${item.pool?.projectKey}-${item.tokenId}`} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr auto' : '1.2fr 0.8fr 0.7fr 0.7fr', gap: 10, alignItems: 'center', padding: '9px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.035)' }}>
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
          {positions.map(p => {
            const hasFees = p.fees0 > 0n || p.fees1 > 0n;
            const hasLiquidity = p.liquidity > 0n;
            const canRebalance = hasLiquidity && (p.protocol !== 'uniswap-v4' || isNativeCurrency(p.hooks ?? NATIVE_CURRENCY));
            const busy = busyId === posKey(p);
            const value = valueOf(p);
            const analytics = analyticsOf(p);
            return (
              <Glass key={posKey(p)} padding={14} radius={18}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ display: 'flex', flexShrink: 0 }}>
                    <TokenIcon symbol={p.symbol0} size={26} />
                    <div style={{ marginLeft: -8 }}><TokenIcon symbol={p.symbol1} size={26} /></div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: btb.text, fontWeight: 700, fontSize: 14 }}>{p.symbol0} / {p.symbol1}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2, flexWrap: 'wrap' }}>
                      <Badge size="sm" color={btb.textMuted} bg={btb.surfaceSoft} border="none" style={{ fontSize: 10, padding: '1px 6px' }}>{fmtFeeTier(p.fee)}</Badge>
                      <Badge size="sm" color={PROTOCOL_BADGE[p.protocol].color} bg={`${PROTOCOL_BADGE[p.protocol].color}1f`} border="none" style={{ fontSize: 10, padding: '1px 6px' }}>{PROTOCOL_BADGE[p.protocol].label}</Badge>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    {value > 0 && (
                      <div style={{ color: btb.text, fontSize: 14, fontWeight: 800 }}>
                        ${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                      </div>
                    )}
                    <Badge size="sm" border="none" bg={p.inRange ? 'rgba(82,227,164,0.14)' : 'rgba(255,179,107,0.14)'} color={p.inRange ? btb.green : btb.amber} style={{ marginTop: value > 0 ? 3 : 0, whiteSpace: 'nowrap' }}>
                      {p.inRange ? 'In range' : 'Out of range'}
                    </Badge>
                  </div>
                </div>

                <div style={{ color: btb.textMuted, fontSize: 12, marginTop: 10 }}>
                  {fmtAmt(p.amount0, p.decimals0)} {p.symbol0} + {fmtAmt(p.amount1, p.decimals1)} {p.symbol1}
                </div>
                {hasFees && (
                  <div style={{ color: btb.green, fontSize: 12, marginTop: 3 }}>
                    Fees: {fmtAmt(p.fees0, p.decimals0)} {p.symbol0} + {fmtAmt(p.fees1, p.decimals1)} {p.symbol1}
                  </div>
                )}
                {analytics && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 9 }}>
                    <div style={{ background: 'rgba(255,255,255,0.035)', borderRadius: 10, padding: '8px 9px' }}>
                      <div style={{ color: btb.textDim, fontSize: 9.5 }}>HISTORICAL PNL</div>
                      <div style={{ color: analytics.pnl >= 0 ? btb.green : btb.loss, fontSize: 12.5, fontWeight: 800, marginTop: 2 }}>{fmtSignedMoney(analytics.pnl)} · {fmtSignedPercent(analytics.returnOnInvestment)}</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.035)', borderRadius: 10, padding: '8px 9px' }}>
                      <div style={{ color: btb.textDim, fontSize: 9.5 }}>LIFETIME FEES</div>
                      <div style={{ color: btb.green, fontSize: 12.5, fontWeight: 800, marginTop: 2 }}>${(sumKrystalUsd(analytics.feePending) + sumKrystalUsd(analytics.feesClaimed)).toLocaleString('en-US', { maximumFractionDigits: 2 })}</div>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
                  <MobileActBtn label="Add" onClick={() => setManage({ pos: p, mode: 'add' })} disabled={busy || !canTransact}/>
                  {hasLiquidity && <MobileActBtn label="Withdraw" onClick={() => setManage({ pos: p, mode: 'withdraw' })} disabled={busy || !canTransact}/>} 
                  {hasFees && <MobileActBtn label={busy ? '…' : 'Collect'} onClick={() => collect(p)} disabled={busy || !canTransact} green/>}
                  {canRebalance && (
                    <MobileActBtn
                      label="⚖ Rebalance"
                      onClick={() => setRebalance(p)}
                      disabled={busy || !canTransact}
                      amber={!p.inRange}
                    />
                  )}
                </div>
              </Glass>
            );
          })}
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
                      <Badge size="sm" color={btb.textMuted} bg={btb.surfaceSoft} border="none" style={{ fontSize: 10, padding: '1px 6px' }}>{item.chainName || `Chain ${item.chainId}`}</Badge>
                      <Badge size="sm" color={btb.red} bg="rgba(255,76,107,0.13)" border="none" style={{ fontSize: 10, padding: '1px 6px' }}>{compactProjectLabel(item.pool?.project, item.pool?.projectKey)}</Badge>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ color: btb.text, fontSize: 14, fontWeight: 800 }}>${item.currentPositionValue.toLocaleString('en-US', { maximumFractionDigits: 2 })}</div>
                    <Badge size="sm" border="none" bg={inRange ? 'rgba(82,227,164,0.14)' : 'rgba(255,179,107,0.14)'} color={inRange ? btb.green : btb.amber} style={{ marginTop: 3, whiteSpace: 'nowrap' }}>{inRange ? 'In range' : 'Out of range'}</Badge>
                  </div>
                </div>

                {(item.currentAmounts?.length ?? 0) > 0 && (
                  <div style={{ color: btb.textMuted, fontSize: 12, marginTop: 10 }}>
                    {(item.currentAmounts ?? []).slice(0, 2).map(krystalAmountLabel).join(' + ')}
                  </div>
                )}
                {pendingFees > 0 && <div style={{ color: btb.green, fontSize: 12, marginTop: 3 }}>Fees: ${pendingFees.toLocaleString('en-US', { maximumFractionDigits: 2 })}</div>}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 9 }}>
                  <div style={{ background: 'rgba(255,255,255,0.035)', borderRadius: 10, padding: '8px 9px' }}>
                    <div style={{ color: btb.textDim, fontSize: 9.5 }}>HISTORICAL PNL</div>
                    <div style={{ color: item.pnl >= 0 ? btb.green : btb.loss, fontSize: 12.5, fontWeight: 800, marginTop: 2 }}>{fmtSignedMoney(item.pnl)} · {fmtSignedPercent(item.returnOnInvestment)}</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.035)', borderRadius: 10, padding: '8px 9px' }}>
                    <div style={{ color: btb.textDim, fontSize: 9.5 }}>LIFETIME FEES</div>
                    <div style={{ color: btb.green, fontSize: 12.5, fontWeight: 800, marginTop: 2 }}>${lifetimeFees.toLocaleString('en-US', { maximumFractionDigits: 2 })}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', marginTop: 12 }}><MobileActBtn label={`${item.chainName || 'Other chain'} · Read only`} onClick={() => {}} disabled /></div>
              </Glass>
            );
          })}
        </div>
      ) : (
        <div style={{ borderRadius: 16, border: btb.borderSoft, background: btb.surfaceSoft, overflow: 'hidden' }}>
          {(positions.length > 0 || loading || otherChainPositions.length === 0) && (
            <DataTable
              columns={columns}
              rows={positions}
              rowKey={posKey}
              loading={loading && positions.length === 0}
              emptyMessage={krystalLoading ? 'Loading positions…' : 'No LP positions yet'}
              defaultSortKey="value"
            />
          )}
          {otherChainPositions.length > 0 && (
            <DataTable
              columns={otherChainColumns}
              rows={otherChainPositions}
              rowKey={item => `${item.chainId}-${item.pool?.projectKey}-${item.tokenId}`}
              defaultSortKey="value"
            />
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

      {rebalance && connectedAddress && (
        <RebalanceSheet
          pos={rebalance}
          account={connectedAddress as `0x${string}`}
          onClose={() => setRebalance(null)}
          onDone={async () => { setRebalance(null); await load(); }}
        />
      )}
    </div>
  );
}

/** Full-width-sharing action button for the mobile card layout — bigger tap
 * target than the table's compact ActBtn. */
function MobileActBtn({ label, onClick, disabled, green, amber }: {
  label: string; onClick: () => void; disabled?: boolean; green?: boolean; amber?: boolean;
}) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      flex: 1, minWidth: 90, height: 38, borderRadius: 12, border: 'none', fontFamily: 'inherit',
      fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap',
      cursor: disabled ? 'default' : 'pointer',
      background: disabled ? 'rgba(255,255,255,0.06)'
        : green ? btb.gradGreen
        : amber ? 'rgba(255,179,107,0.16)'
        : 'rgba(255,255,255,0.1)',
      color: disabled ? btb.textDim : amber ? btb.amber : '#fff',
    }}>{label}</button>
  );
}

function ActBtn({ label, onClick, disabled, green }: { label: string; onClick: () => void; disabled?: boolean; green?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      height: 32, padding: '0 13px', borderRadius: 10, fontFamily: 'inherit', fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap',
      border: disabled ? '1px solid transparent' : green ? '1px solid rgba(82,227,164,0.4)' : '1px solid rgba(255,255,255,0.14)',
      cursor: disabled ? 'default' : 'pointer',
      background: disabled ? 'rgba(255,255,255,0.06)' : green ? 'rgba(82,227,164,0.16)' : 'rgba(255,255,255,0.07)',
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
  // Native-ETH deposit side. V3: the WETH token (user can toggle ETH vs WETH).
  // V4: currency0 = address(0) IS native ETH — always ETH, nothing to toggle.
  const wethSide: 0 | 1 | null = isV4 ? null : isWeth(pos.token0) ? 0 : isWeth(pos.token1) ? 1 : null;
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
    const client = getPublicClient(config);
    if (!client) return;
    (async () => {
      try {
        const [b0, b1] = await client.multicall({
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
            ? buildV4Remove(pos, pct * 100, SLIPPAGE_BPS, account)
            : buildV4Increase(
                pos,
                liquidityForAmounts(pos.sqrtPriceX96, pos.tickLower, pos.tickUpper, add0, add1),
                maxIn(add0, SLIPPAGE_BPS), maxIn(add1, SLIPPAGE_BPS),
                account,
              ))
        : (mode === 'withdraw'
            ? buildRemove(pos, pct * 100, SLIPPAGE_BPS, account, v3DeploymentOf(pos))
            : buildIncrease(pos, add0, add1, SLIPPAGE_BPS, ethMode ? wethSide : null, v3DeploymentOf(pos)));
      await runCalls(config, {
        account,
        calls,
        label: `${mode === 'withdraw' ? 'Withdraw' : 'Add'} ${pos.symbol0}/${pos.symbol1}`,
        track,
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
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, background: 'rgba(10,10,15,0.98)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 28, padding: '12px 20px calc(32px + env(safe-area-inset-bottom, 0px))' }}>
        <div style={{ color: btb.text, fontSize: 19, fontWeight: 800, letterSpacing: -0.4, marginBottom: 4 }}>
          {mode === 'withdraw' ? 'Withdraw liquidity' : 'Add liquidity'}
        </div>
        <div style={{ color: btb.textMuted, fontSize: 13, marginBottom: 18 }}>{pos.symbol0} / {pos.symbol1} · {fmtFeeTier(pos.fee)} · {isV4 ? 'V4' : 'V3'}</div>

        {mode === 'withdraw' ? (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {[25, 50, 75, 100].map((v) => (
                <button key={v} onClick={() => setPct(v)} style={{
                  flex: 1, height: 40, borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
                  background: pct === v ? 'rgba(82,227,164,0.18)' : 'rgba(255,255,255,0.06)',
                  border: `1px solid ${pct === v ? 'rgba(82,227,164,0.5)' : 'rgba(255,255,255,0.12)'}`,
                  color: pct === v ? '#52E3A4' : btb.textMuted,
                }}>{v}%</button>
              ))}
            </div>
            <Glass padding={14} radius={14} soft>
              <div style={{ color: btb.textMuted, fontSize: 12, marginBottom: 6 }}>You receive (min, after {SLIPPAGE_BPS / 100}% slippage)</div>
              <div style={{ color: btb.text, fontSize: 15, fontWeight: 700 }}>
                ≈ {fmtAmt(out0, pos.decimals0)} {pos.symbol0} + {fmtAmt(out1, pos.decimals1)} {pos.symbol1}
              </div>
            </Glass>
          </>
        ) : (
          <>
            {wethSide !== null && (
              <div onClick={() => setUseEth((v) => !v)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: 14, background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '10px 14px' }}>
                <span style={{ color: btb.text, fontSize: 13, fontWeight: 600 }}>Pay with ETH <span style={{ color: btb.textDim, fontWeight: 400 }}>(instead of WETH)</span></span>
                <div style={{ width: 42, height: 24, borderRadius: 999, background: useEth ? '#52E3A4' : 'rgba(255,255,255,0.18)', position: 'relative', transition: 'background 0.2s' }}>
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
              style={{ width: '100%', height: 52, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, padding: '0 16px', color: btb.text, fontSize: 22, fontWeight: 700, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}/>
            {(add0 > 0n || add1 > 0n) && (
              <div style={{ color: btb.textMuted, fontSize: 13, marginTop: 10 }}>
                Deposit: {fmtAmt(add0, pos.decimals0)} {sym0} + {fmtAmt(add1, pos.decimals1)} {sym1}
              </div>
            )}
            {(short0 || short1) && (
              <div style={{ color: btb.loss, fontSize: 12, marginTop: 8 }}>Insufficient {short0 ? sym0 : sym1} balance</div>
            )}
            {!pos.inRange && (
              <div style={{ color: '#FFB36B', fontSize: 11, marginTop: 8 }}>Out of range — only {inputSymbol} is needed at the current price.</div>
            )}
          </>
        )}

        {err && <div style={{ color: btb.loss, fontSize: 12, marginTop: 12 }}>{err}</div>}

        <Button variant="success" size="md" onClick={() => { if (!busy) run(); }} disabled={!canRun} style={{ marginTop: 18, fontWeight: 800 }}>
          {busy ? 'Confirming…' : mode === 'withdraw' ? `Withdraw ${pct}%` : 'Add liquidity'}
        </Button>
        <div style={{ color: btb.textDim, fontSize: 11, textAlign: 'center', marginTop: 10 }}>
          Slippage-protected ({SLIPPAGE_BPS / 100}%). {mode === 'add' ? 'Token approvals are included automatically.' : 'Withdraws principal + fees to your wallet.'}
        </div>
      </div>
    </div>
    </Portal>
  );
}
