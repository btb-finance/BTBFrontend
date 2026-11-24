import { createPublicClient, formatUnits, type PublicClient } from 'viem';
import { mainnet, base, bsc } from 'viem/chains';
import { api } from '../../../convex/_generated/api';
import { fetchV3Positions, fetchV4Positions, tickToPrice, type V3Deployment } from '@/protocols/dexs/uniswap';
import { aerodromeDeploymentsFor, aeroDeploymentFor, fetchAerodromeStakedByIds } from '@/protocols/dexs/aerodrome';
import { fetchStakedPositions, stakingDeploymentsFor } from '@/protocols/staking';
import { LP_CHAINS, LP_CHAIN_NAMES, v3DeploymentFor, v4DeploymentFor, v4DeployBlockFor, wrappedNativeFor, type LpChainId } from '@/protocols/lpChains';
import type { LiquidityPosition } from '@/protocols/types';
import { chainTransport } from '../chainRpc';
import { robinhoodChain, arcChain, robinhoodTransport } from '../wagmi';
import { getTokenPricesUsd } from '../defillama';
import { dexTokenPrices } from '../robinhoodBalances';
import type { KrystalPositionAnalytics } from '../krystal';
import { chainIdOf, chainKey, convex, round2, snapshot } from './data';

// Every LP position a wallet holds, read from the chains themselves (the same reads as the Portfolio screen), for the
// connector's wallet_positions tool. Public data, read-only. The wallet's BTB smart wallets (auto-management) are read
// too, so managed positions show up. Krystal's index, when it answers, adds PnL and the Aerodrome positions staked in
// gauges, which no on-chain read can list without knowing the gauge.

const CHAINS = { 1: mainnet, 8453: base, 56: bsc, 4663: robinhoodChain, 5042: arcChain } as const;
const KRYSTAL_CHAINS = new Set<number>([1, 56, 8453]);
const LLAMA_CHAIN: Record<number, string> = { 1: 'ethereum', 8453: 'base', 56: 'bsc' };
const DEADLINE_MS = 18_000;
const ZERO = '0x0000000000000000000000000000000000000000';

const clients = new Map<number, PublicClient>();
function clientFor(chainId: LpChainId): PublicClient {
  let c = clients.get(chainId);
  if (!c) {
    c = createPublicClient({ chain: CHAINS[chainId], transport: chainId === 4663 ? robinhoodTransport() : chainTransport(chainId) }) as PublicClient;
    clients.set(chainId, c);
  }
  return c;
}

const PROTOCOL_NAMES: Record<LiquidityPosition['protocol'], string> = {
  'uniswap-v3': 'Uniswap V3', 'uniswap-v4': 'Uniswap V4', 'pancakeswap-v3': 'PancakeSwap V3', 'aerodrome-cl': 'Aerodrome Slipstream',
  'aero-cl': 'Aero', 'giga-v3': 'Giga', 'ramses-v3': 'Ramses', 'up-v3': 'UP', 'sushiswap-v3': 'SushiSwap V3', 'alandale-cl': 'Alandale',
};

async function krystalOpen(address: string): Promise<KrystalPositionAnalytics[] | null> {
  try {
    const q = new URLSearchParams({ addresses: address, chainIds: [...KRYSTAL_CHAINS].join(','), positionStatus: 'open', orderBy: 'lastAction', orderASC: 'false', limit: '100', offset: '0' });
    const res = await fetch(`https://api.krystal.app/all/v1/lp/userPositions?${q}`, { headers: { accept: 'application/json', 'user-agent': 'BTB-Finance/1.0' }, signal: AbortSignal.timeout(5_000) });
    if (!res.ok) return null;
    const json = await res.json() as { positions?: KrystalPositionAnalytics[] };
    return (json.positions ?? []).filter((p) => !(p.status?.toUpperCase().includes('CLOSED') || p.closedTime > 0));
  } catch {
    return null;
  }
}

function withDeadline<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timed out')), ms))]);
}

type Found = LiquidityPosition & { chainId: LpChainId; owner: `0x${string}` };

export interface WalletPositionsResult {
  address: string;
  ownersRead: { address: string; kind: 'wallet' | 'BTB smart wallet' }[];
  totals: { positions: number; inRange: number; valueUsd: number | null; uncollectedFeesUsd: number | null; unpriced: number };
  positions: unknown[];
  notRead: string[];
  sources: string[];
}

export async function walletPositions(address: `0x${string}`, chain?: string): Promise<WalletPositionsResult> {
  const want = chain ? chainKey(chain) : null;
  const chains = LP_CHAINS.filter((id) => !want || chainKey(LP_CHAIN_NAMES[id]) === want);
  const [auto, krystal, snap] = await Promise.all([
    convex().query(api.autoRebalance.listForAddress, { address }).catch(() => null),
    krystalOpen(address),
    snapshot().catch(() => null),
  ]);
  const jobs = auto?.jobs ?? [];
  const smart = [...new Set(jobs.map((j) => j.wallet.toLowerCase()))].filter((w) => w !== address.toLowerCase()) as `0x${string}`[];
  const owners: `0x${string}`[] = [address, ...smart];

  const found: Found[] = [];
  const notRead: string[] = [];
  const reads: Promise<void>[] = [];
  const read = (label: string, chainId: LpChainId, owner: `0x${string}`, run: () => Promise<LiquidityPosition[]>) => {
    reads.push(withDeadline(run(), DEADLINE_MS)
      .then((items) => { for (const p of items) found.push({ ...p, chainId, owner }); })
      .catch(() => { notRead.push(`${LP_CHAIN_NAMES[chainId]} ${label}${owner === address ? '' : ' (smart wallet)'}`); }));
  };

  for (const chainId of chains) {
    const client = clientFor(chainId);
    const v3Like: { label: string; d: V3Deployment }[] = [];
    const add = (label: string, d: V3Deployment | null | undefined) => { if (d) v3Like.push({ label, d }); };
    add('Uniswap V3', v3DeploymentFor('uniswap', chainId));
    add('PancakeSwap V3', v3DeploymentFor('pancakeswap', chainId));
    add('Giga', v3DeploymentFor('giga', chainId));
    add('Ramses', v3DeploymentFor('ramses', chainId));
    add('UP', v3DeploymentFor('up', chainId));
    add('SushiSwap V3', v3DeploymentFor('sushiswap', chainId));
    add('Alandale', v3DeploymentFor('alandale', chainId));
    aerodromeDeploymentsFor(chainId).forEach((d) => add('Aerodrome Slipstream', d));
    add('Aero', aeroDeploymentFor(chainId));
    const v4 = v4DeploymentFor(chainId);
    const krystalRows = (krystal ?? []).filter((r) => r.chainId === chainId);

    for (const owner of owners) {
      for (const { label, d } of v3Like) read(label, chainId, owner, () => fetchV3Positions(client, owner, d));
      for (const d of stakingDeploymentsFor(chainId)) read('staked positions', chainId, owner, () => fetchStakedPositions(client, owner, d));
      if (v4) {
        // V4's manager cannot list an owner's positions: Krystal's ids where it indexes the chain, else a log scan.
        const ids = owner === address && krystal && KRYSTAL_CHAINS.has(chainId)
          ? krystalRows.filter((r) => r.tokenAddress?.toLowerCase() === v4.positionManager.toLowerCase()).map((r) => BigInt(r.tokenId))
          : undefined;
        read('Uniswap V4', chainId, owner, () => fetchV4Positions(client, owner, ids, v4, v4DeployBlockFor(chainId)));
      }
    }
    // Aerodrome positions in gauges: Krystal names the gauge for the wallet's own; auto-management records it for the smart wallet's.
    const staked = krystalRows.flatMap((r) => {
      const gauge = r.id?.split('_')[1];
      return r.farming && gauge && /^0x[0-9a-fA-F]{40}$/.test(gauge) && r.tokenAddress ? [{ id: BigInt(r.tokenId), gauge: gauge as `0x${string}`, manager: r.tokenAddress as `0x${string}` }] : [];
    });
    if (staked.length) read('Aerodrome gauges', chainId, address, () => fetchAerodromeStakedByIds(client, address, staked));
    for (const w of smart) {
      const mine = jobs.filter((j) => j.chainId === chainId && j.wallet.toLowerCase() === w && j.gauge)
        .map((j) => ({ id: BigInt(j.tokenId), gauge: j.gauge as `0x${string}`, manager: j.positionManager as `0x${string}` }));
      if (mine.length) read('Aerodrome gauges', chainId, w, () => fetchAerodromeStakedByIds(client, w, mine));
    }
  }
  await Promise.all(reads);

  // One row per position: the same NFT can come back from two reads (enumerated and staked).
  const seen = new Set<string>();
  const open = found.filter((p) => {
    const k = `${p.chainId}:${(p.positionManager ?? p.protocol).toLowerCase()}:${p.id}`;
    if (seen.has(k)) return false;
    seen.add(k);
    // Emptied positions whose NFT was never burned: nothing in them, nothing to collect.
    if (p.liquidity === 0n && p.fees0 === 0n && p.fees1 === 0n && !p.staked) return false;
    return true;
  });

  // Prices: the pool snapshot's own quotes first, then DeFiLlama (DexScreener on Robinhood Chain) for the rest.
  const priceOf = new Map<string, number>();
  for (const p of snap?.pools ?? []) for (const [a, v] of Object.entries(p.tokenPricesUsd ?? {})) if (v > 0) priceOf.set(`${chainIdOf(p)}:${a.toLowerCase()}`, v);
  const tokenKey = (chainId: number, a: string) => `${chainId}:${(a === ZERO ? wrappedNativeFor(chainId as LpChainId) ?? a : a).toLowerCase()}`;
  const missing = new Map<number, Set<string>>();
  for (const p of open) for (const t of [p.token0, p.token1]) {
    const k = tokenKey(p.chainId, t);
    if (!priceOf.has(k) && (LLAMA_CHAIN[p.chainId] || p.chainId === 4663)) missing.set(p.chainId, new Set([...(missing.get(p.chainId) ?? []), k.split(':')[1]]));
  }
  await Promise.all([...missing].map(async ([chainId, set]) => {
    // Robinhood Chain: DexScreener, as the Portfolio screen prices it.
    const got = await withDeadline(chainId === 4663 ? dexTokenPrices([...set]) : getTokenPricesUsd([...set], LLAMA_CHAIN[chainId]), 5_000).catch(() => ({} as Record<string, number>));
    for (const [a, v] of Object.entries(got)) priceOf.set(`${chainId}:${a}`, v);
  }));

  let value = 0, fees = 0, unpriced = 0;
  const rows = open.map((p) => {
    const a0 = Number(formatUnits(p.amount0, p.decimals0)), a1 = Number(formatUnits(p.amount1, p.decimals1));
    const f0 = Number(formatUnits(p.fees0, p.decimals0)), f1 = Number(formatUnits(p.fees1, p.decimals1));
    const p0 = priceOf.get(tokenKey(p.chainId, p.token0)), p1 = priceOf.get(tokenKey(p.chainId, p.token1));
    const valueUsd = p0 != null && p1 != null ? a0 * p0 + a1 * p1 : null;
    const feesUsd = p0 != null && p1 != null ? f0 * p0 + f1 * p1 : null;
    if (valueUsd == null) unpriced++; else { value += valueUsd; fees += feesUsd ?? 0; }
    const job = jobs.find((j) => j.chainId === p.chainId && j.tokenId === p.id.toString() && j.positionManager.toLowerCase() === (p.positionManager ?? '').toLowerCase())
      ?? jobs.find((j) => j.chainId === p.chainId && j.tokenId === p.id.toString());
    const k = krystal?.find((r) => r.chainId === p.chainId && r.tokenId === p.id.toString());
    const lo = tickToPrice(p.tickLower, p.decimals0, p.decimals1), hi = tickToPrice(p.tickUpper, p.decimals0, p.decimals1);
    return {
      chain: LP_CHAIN_NAMES[p.chainId], dex: PROTOCOL_NAMES[p.protocol] ?? p.protocol, pair: `${p.symbol0}-${p.symbol1}`,
      feePct: p.fee ? p.fee / 10_000 : null, tokenId: p.id.toString(), positionManager: p.positionManager ?? null,
      heldBy: p.owner === address ? 'wallet' : 'BTB smart wallet', owner: p.owner,
      inRange: p.inRange,
      price: { current: sig(tickToPrice(p.currentTick, p.decimals0, p.decimals1)), ...(fullRange(p.tickLower, p.tickUpper) ? { range: 'full range' } : { rangeLow: sig(lo), rangeHigh: sig(hi) }), unit: `${p.symbol1} per ${p.symbol0}` },
      amounts: { [p.symbol0]: sig(a0), [p.symbol1]: sig(a1) },
      uncollectedFees: { [p.symbol0]: sig(f0), [p.symbol1]: sig(f1) },
      valueUsd: valueUsd == null ? null : round2(valueUsd), uncollectedFeesUsd: feesUsd == null ? null : round2(feesUsd),
      staked: p.staked ? { in: p.staked.kind ?? 'gauge', reward: p.staked.rewardSymbol, earned: sig(Number(formatUnits(p.staked.earned, 18))) } : null,
      closed: p.liquidity === 0n,
      autoManaged: job ? { active: job.active, status: job.status, checkEvery: `${job.intervalMin} min`, rebalances: job.rebalances, compound: job.compound, note: job.note } : null,
      krystal: k ? { pnlUsd: round2(k.pnl), aprPct: round2(k.apr), vsHoldUsd: round2(k.compareWithHodl), depositedUsd: round2(k.totalDepositValue) } : null,
    };
  }).sort((x, y) => (y.valueUsd ?? -1) - (x.valueUsd ?? -1));

  return {
    address: address.toLowerCase(),
    ownersRead: owners.map((o) => ({ address: o, kind: o === address ? 'wallet' as const : 'BTB smart wallet' as const })),
    totals: { positions: rows.length, inRange: rows.filter((r) => r.inRange).length, valueUsd: rows.length - unpriced ? round2(value) : null, uncollectedFeesUsd: rows.length - unpriced ? round2(fees) : null, unpriced },
    positions: rows,
    notRead,
    sources: [
      `On-chain reads of ${chains.map((c) => LP_CHAIN_NAMES[c]).join(', ')}. Closed positions (no liquidity left) are not listed.`,
      krystal ? 'Krystal LP index (PnL, Aerodrome gauge positions).' : 'Krystal LP index did not answer: Aerodrome positions staked in gauges by the wallet itself may be missing, and there is no PnL.',
    ],
  };
}

/** A range at (or within one spacing of) the protocol's tick limits. */
function fullRange(lower: number, upper: number): boolean {
  return lower <= -887_000 && upper >= 887_000;
}

/** Four significant digits, as a number. */
function sig(x: number): number {
  if (!Number.isFinite(x) || x === 0) return x === 0 ? 0 : Number.NaN;
  return Number(x.toPrecision(4));
}
