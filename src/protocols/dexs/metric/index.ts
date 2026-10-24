import { encodeFunctionData, erc20Abi, getAddress, type PublicClient } from 'viem';
import {
  additionPlanToPoolLiquidityDelta, buildModifyLiquidityArgsForAddition, encodeAddLiquidityWeightedSelfCalldata,
  encodeRemoveLiquidityCalldata, getAddresses, getBinStatesExternal, getPoolImmutables, getSlot0,
  prepareAddLiquidityWeightedSelfSupportingNativePaymentCalldata, prepareLiquidityCursorBounds, MetricOmmPoolDataProviderAbi,
  MAX_UINT104, type LiquidityCursorBounds, type PoolLiquidityDelta,
} from '@metric.xyz/metric-omm-sdk-v1';
import { PriceProviderAbi } from '@metric.xyz/metric-omm-sdk-v1/abis';
import type { Call } from '@/lib/txRunner';

/**
 * Metric (docs.metric.xyz): oracle priced pools whose liquidity sits in bins set as percentages around the oracle's
 * reference price, so a position follows the price with no range to manage. A position is not an NFT: it is the
 * shares an (owner, salt) pair holds in each bin. Metric's own app gives every new position a random salt, so a
 * wallet's positions are listed from Metric's public positions API rather than guessed on chain; the amounts that
 * move funds are always read on chain before a transaction is built.
 *
 * Deposits go through Metric's LiquidityAdder (addLiquidityWeighted: it probes the pool in the same transaction and
 * scales the deposit to fit the token caps), guarded by cursor bounds so a sandwich cannot skew the ratio.
 * Withdrawals call removeLiquidity on the pool itself; there is nothing to claim, earnings compound in the bins.
 */

export const METRIC_CHAINS = [1, 56, 4663] as const;
export type MetricChainId = (typeof METRIC_CHAINS)[number];
export const METRIC_CHAIN_NAMES: Record<MetricChainId, string> = { 1: 'Ethereum', 56: 'BNB Chain', 4663: 'Robinhood Chain' };
export const isMetricChain = (chainId: number): chainId is MetricChainId => (METRIC_CHAINS as readonly number[]).includes(chainId);

const API = 'https://api.metric.xyz/public/v1/evm';

/** Largest move of the pool's distance from the oracle (percent of price) a deposit tolerates; Metric's app uses 0.5. */
export const MAX_ORACLE_DISTANCE_CHANGE_PCT = 0.5;

export function metricAddresses(chainId: number) {
  const a = getAddresses(chainId);
  if (!a) return null;
  // SDK 0.6.7 ships the adder with an invalid checksum, which viem rejects as a call target.
  return { factory: a.factory, dataProvider: a.dataProvider, liquidityAdder: getAddress(a.liquidityAdder.toLowerCase()), wrappedNative: a.wrappedNative };
}

export function metricPoolUrl(chainId: number, pool: string): string {
  return `https://app.metric.xyz/pool/${chainId}/${pool}`;
}

/** A position as Metric's API returns it, with amounts as bigints. */
export interface MetricPosition {
  chainId: MetricChainId;
  pool: `0x${string}`;
  token0: `0x${string}`;
  token1: `0x${string}`;
  salt: bigint;
  bins: { binIdx: number; shares: bigint; amount0: bigint; amount1: bigint }[];
  amount0: bigint;
  amount1: bigint;
  token0Usd: number;
  token1Usd: number;
  /** Bin range as a fraction of the reference price, e.g. -0.0003 to -0.0002. */
  lowerOffset?: number;
  upperOffset?: number;
  valueUsd?: number;
  feesEarnedUsd?: number;
  /** LP share of the spread over 7 days, annualised, in percent. */
  apr7d?: number;
  /** Trading PnL APR over 7 days (includes price moves), in percent. */
  pnlApr7d?: number;
  tier?: string;
  openedAt?: number;
}

type ApiPosition = {
  chainId: string; poolAddress: string; token0: string; token1: string; provider: string; salt: string;
  token0Amount?: string; token1Amount?: string; token0FiatPrice?: number | null; token1FiatPrice?: number | null;
  bins?: { binIdx: string; shares: string; token0Amount?: string; token1Amount?: string }[];
  range?: { lowerOffsetRatio?: number; upperOffsetRatio?: number } | null;
  classificationSummary?: { tierQualification?: string } | null;
  performance?: {
    openedAtTimestamp?: number; currentValueFiat?: number | null; feesEarnedFiat?: number | null;
    aprByPeriod?: Record<string, { apr?: number | null; pnlApr?: number | null } | undefined>;
  } | null;
};

const big = (v: string | undefined | null) => { try { return BigInt(v ?? '0'); } catch { return 0n; } };

/** Every open Metric position of `owner` on the public chains. A chain that fails to answer is skipped, not fatal. */
export async function fetchMetricPositions(owner: string): Promise<{ positions: MetricPosition[]; failed: MetricChainId[] }> {
  const failed: MetricChainId[] = [];
  const lists = await Promise.all(METRIC_CHAINS.map(async (chainId) => {
    try {
      const res = await fetch(`${API}/${chainId}/positions/${owner}?contract_version=v1&periods=7d&fiat=USD`, { signal: AbortSignal.timeout(15_000), cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      return { chainId, rows: (await res.json()) as ApiPosition[] };
    } catch {
      failed.push(chainId);
      return { chainId, rows: [] as ApiPosition[] };
    }
  }));
  const positions: MetricPosition[] = [];
  for (const { chainId, rows } of lists) {
    for (const r of rows) {
      const bins = (r.bins ?? [])
        .map((b) => ({ binIdx: Number(b.binIdx), shares: big(b.shares), amount0: big(b.token0Amount), amount1: big(b.token1Amount) }))
        .filter((b) => Number.isInteger(b.binIdx) && b.shares > 0n);
      if (bins.length === 0) continue;
      const perf = r.performance ?? undefined;
      const apr = perf?.aprByPeriod?.['7d'];
      positions.push({
        chainId,
        pool: getAddress(r.poolAddress),
        token0: getAddress(r.token0),
        token1: getAddress(r.token1),
        salt: big(r.salt),
        bins,
        amount0: big(r.token0Amount),
        amount1: big(r.token1Amount),
        token0Usd: r.token0FiatPrice ?? 0,
        token1Usd: r.token1FiatPrice ?? 0,
        lowerOffset: r.range?.lowerOffsetRatio,
        upperOffset: r.range?.upperOffsetRatio,
        valueUsd: perf?.currentValueFiat ?? undefined,
        feesEarnedUsd: perf?.feesEarnedFiat ?? undefined,
        // The API gives these as fractions (1.22 = 122%).
        apr7d: apr?.apr != null ? apr.apr * 100 : undefined,
        pnlApr7d: apr?.pnlApr != null ? apr.pnlApr * 100 : undefined,
        tier: r.classificationSummary?.tierQualification,
        openedAt: perf?.openedAtTimestamp,
      });
    }
  }
  return { positions, failed };
}

/** What the app shows about a pool, from Metric's API. */
export interface MetricPoolInfo {
  chainId: MetricChainId;
  pool: `0x${string}`;
  token0: `0x${string}`;
  token1: `0x${string}`;
  symbol0: string;
  symbol1: string;
  decimals0: number;
  decimals1: number;
  logo0?: string;
  logo1?: string;
  price0: number;
  price1: number;
  tvlUsd: number;
  /** 7 day Edge APR in percent: the LPs' share of the spread, after the curator's and Metric's cut. */
  apr7d: number;
  tier?: string;
  curator?: string;
  verifiedCurator: boolean;
  paused: boolean;
  allowlisted: boolean;
}

type ApiPool = {
  poolAddress: string; token0: string; token1: string; token0Symbol: string; token1Symbol: string;
  token0Decimals: number; token1Decimals: number; token0LogoUrl?: string | null; token1LogoUrl?: string | null;
  token0FiatPrice?: number | null; token1FiatPrice?: number | null; tvlFiat?: number | null; aprBps7d?: number | null;
  classificationSummary?: { tierQualification?: string } | null; adminUsername?: string | null; verifiedAdmin?: boolean;
  pauseLevel?: number; depositWhitelistingEnabled?: boolean;
};

/** Pool details for up to a few dozen pools on one chain, keyed by lowercase pool address. */
export async function fetchMetricPools(chainId: MetricChainId, pools: string[]): Promise<Map<string, MetricPoolInfo>> {
  const out = new Map<string, MetricPoolInfo>();
  if (pools.length === 0) return out;
  const res = await fetch(`${API}/${chainId}/metadata?count=${pools.length}&addresses=${pools.join(',')}`, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Metric pool details ${res.status}`);
  for (const p of ((await res.json()) as { data?: ApiPool[] }).data ?? []) {
    out.set(p.poolAddress.toLowerCase(), {
      chainId,
      pool: getAddress(p.poolAddress),
      token0: getAddress(p.token0),
      token1: getAddress(p.token1),
      symbol0: p.token0Symbol,
      symbol1: p.token1Symbol,
      decimals0: p.token0Decimals,
      decimals1: p.token1Decimals,
      logo0: p.token0LogoUrl ?? undefined,
      logo1: p.token1LogoUrl ?? undefined,
      price0: p.token0FiatPrice ?? 0,
      price1: p.token1FiatPrice ?? 0,
      tvlUsd: p.tvlFiat ?? 0,
      apr7d: (p.aprBps7d ?? 0) / 100,
      tier: p.classificationSummary?.tierQualification,
      curator: p.adminUsername ?? undefined,
      verifiedCurator: !!p.verifiedAdmin,
      paused: (p.pauseLevel ?? 0) > 0,
      allowlisted: !!p.depositWhitelistingEnabled,
    });
  }
  return out;
}

/** One bin of a pool: its index and the price range it covers, as fractions of the reference price. */
export interface MetricBin { idx: number; lower: number; upper: number }

export interface MetricPoolLayout {
  token0: `0x${string}`;
  token1: `0x${string}`;
  curBin: number;
  /** Where the pool sits inside the current bin, 0 (bottom) to 1 (top). */
  curPos: number;
  paused: boolean;
  minOperationalLiquidity: bigint;
  bins: MetricBin[];
}

/**
 * The pool's bins with their ranges. Bin 0 starts at the reference price and runs up; bin -1 ends at it and runs
 * down; each bin's width is its own lengthE6 (parts per million of price).
 */
export async function readMetricLayout(client: PublicClient, chainId: number, pool: `0x${string}`): Promise<MetricPoolLayout> {
  const a = metricAddresses(chainId);
  if (!a) throw new Error('Metric is not deployed on this network.');
  const [imm, slot0] = await Promise.all([getPoolImmutables(client, a.factory, pool), getSlot0(client, a.dataProvider, pool)]);
  const idxs: number[] = [];
  for (let i = imm.lowestBin; i <= imm.highestBin; i++) idxs.push(i);
  const states = await getBinStatesExternal(client, a.dataProvider, pool, idxs, a.factory);
  const len = new Map(idxs.map((i, k) => [i, Number(states.lengthsInUnits[k]) / 1e6]));
  const bins: MetricBin[] = [];
  let up = 0;
  for (let i = 0; i <= imm.highestBin; i++) { const w = len.get(i) ?? 0; bins.push({ idx: i, lower: up, upper: up + w }); up += w; }
  let down = 0;
  for (let i = -1; i >= imm.lowestBin; i--) { const w = len.get(i) ?? 0; bins.unshift({ idx: i, lower: down - w, upper: down }); down -= w; }
  return {
    token0: imm.token0, token1: imm.token1,
    curBin: slot0.curBinIdx,
    curPos: Number(slot0.curPosInBin) / Number(MAX_UINT104),
    paused: slot0.pauseLevel > 0,
    minOperationalLiquidity: imm.minimalOperationalLiquidity,
    bins,
  };
}

/** Bins from the current one outwards until each side spans `pct` percent of price (at least the current bin). */
export function binsForWidth(layout: MetricPoolLayout, pct: number): number[] {
  const cur = layout.bins.find((b) => b.idx === layout.curBin);
  if (!cur) return [];
  const mid = cur.lower + (cur.upper - cur.lower) * layout.curPos;
  const span = pct / 100;
  return layout.bins.filter((b) => b.upper > mid - span && b.lower < mid + span).map((b) => b.idx);
}

/** The price range a set of bins covers, as fractions of the reference price. */
export function rangeOf(layout: MetricPoolLayout, bins: number[]): { lower: number; upper: number } | null {
  const sel = layout.bins.filter((b) => bins.includes(b.idx));
  if (sel.length === 0) return null;
  return { lower: Math.min(...sel.map((b) => b.lower)), upper: Math.max(...sel.map((b) => b.upper)) };
}

/**
 * The price that sizes a deposit's token mix, X64 in the pool's scaled units: the pool's current bid from Metric's
 * API, as Metric's app does, else the provider's reference quote. The provider's quote goes stale within seconds
 * between market maker updates (getQuote then reverts) while deposits stay open, so it is only the fallback. The
 * caps and the cursor bounds, not this price, are what limit what a deposit can take.
 */
async function poolPriceX64(client: PublicClient, chainId: number, pool: `0x${string}`, provider: `0x${string}`): Promise<bigint | null> {
  try {
    const res = await fetch(`${API}/${chainId}/${pool}/bid_ask`, { signal: AbortSignal.timeout(10_000), cache: 'no-store' });
    if (res.ok) {
      const bid = big(((await res.json()) as { bidAdj?: string }).bidAdj);
      if (bid > 0n) return bid;
    }
  } catch { /* fall back to the provider */ }
  try {
    // The provider answers the pool, so the quote is read as if the pool asked.
    const { result } = await client.simulateContract({ address: provider, abi: PriceProviderAbi, functionName: 'getQuote', account: pool });
    return (result as readonly bigint[])[2] ?? null;
  } catch {
    return null;
  }
}

export interface MetricDepositPlan {
  weightDeltas: PoolLiquidityDelta;
  bounds: LiquidityCursorBounds;
  /** What the bins take at the current state. */
  need0: bigint;
  need1: bigint;
  /** The deposit's caps: the needs plus a small buffer for the state moving before it lands. */
  max0: bigint;
  max1: bigint;
  /** Which tokens the chosen bins take: bins above the pool's price hold token0, bins below it token1. */
  needs0: boolean;
  needs1: boolean;
  /** The wallet holds less than the bins need of that token. */
  short0: boolean;
  short1: boolean;
}

/** Headroom on each cap over the computed need, in basis points. The adder never takes more than the cap. */
const CAP_BUFFER_BPS = 50n;

/**
 * Plan a deposit worth `amount` of one token (token0 when `inToken0`), spread at equal value across `bins`, the way
 * Metric's app does: the SDK turns the value targets into per-bin shares and tells what each token they need, and
 * the caps are those needs plus a small buffer. The adder probes the pool when the deposit lands and scales the
 * shares down to fit the caps, so it never takes more than they allow.
 */
export async function planMetricDeposit(
  client: PublicClient, chainId: number, pool: `0x${string}`, bins: number[], amount: bigint, inToken0: boolean,
  /** What the wallet can spend of each token: a cap is clamped to it, and a need above it is refused. */
  have?: { token0: bigint; token1: bigint },
): Promise<MetricDepositPlan> {
  const a = metricAddresses(chainId);
  if (!a) throw new Error('Metric is not deployed on this network.');
  if (bins.length === 0) throw new Error('Pick a range first.');
  if (amount <= 0n) throw new Error('Enter an amount.');
  const [imm, slot0, provider] = await Promise.all([
    getPoolImmutables(client, a.factory, pool),
    getSlot0(client, a.dataProvider, pool),
    client.readContract({ address: a.dataProvider, abi: MetricOmmPoolDataProviderAbi, functionName: 'priceProvider', args: [pool] }) as Promise<`0x${string}`>,
  ]);
  if (slot0.pauseLevel > 0) throw new Error('This pool is paused. Deposits are closed until it reopens.');
  const priceX64 = await poolPriceX64(client, chainId, pool, provider);
  if (!priceX64 || priceX64 <= 0n) throw new Error('The pool has no live price right now. Try again in a moment.');

  const needs0 = bins.some((b) => b > slot0.curBinIdx || (b === slot0.curBinIdx && slot0.curPosInBin < MAX_UINT104));
  const needs1 = bins.some((b) => b < slot0.curBinIdx || (b === slot0.curBinIdx && slot0.curPosInBin > 0n));

  // Each bin's share of the value must stay nonzero once converted to the other token, as the SDK requires.
  const ONE_E18 = 10n ** 18n;
  const priceE18 = (priceX64 * ONE_E18) >> 64n;
  const unit0 = imm.token0ScaleMultiplier * priceE18;
  const unit1 = imm.token1ScaleMultiplier * ONE_E18;
  const per = amount / BigInt(bins.length);
  const minPer = inToken0 ? (needs1 ? (unit1 + unit0 - 1n) / unit0 : 1n) : (needs0 ? (unit0 + unit1 - 1n) / unit1 : 1n);
  if (per < minPer) throw new Error('That amount is too small to spread over this range. Enter more or pick a narrower range.');

  const [bounds, [, deltas, need0Raw, need1Raw]] = await Promise.all([
    prepareLiquidityCursorBounds({ publicClient: client, pool, maxOracleDistanceChangePercent: MAX_ORACLE_DISTANCE_CHANGE_PCT, factoryAddress: a.factory, dataProviderAddress: a.dataProvider }),
    buildModifyLiquidityArgsForAddition({
      publicClient: client, factoryAddress: a.factory, dataProviderAddress: a.dataProvider, poolAddress: pool,
      bins: bins.map((bin) => ({ bin, targetValueInToken: per, targetValueInToken0: inToken0 })), currentPriceX64: priceX64,
    }),
  ]);
  const need0 = need0Raw > 0n ? need0Raw : 0n, need1 = need1Raw > 0n ? need1Raw : 0n;
  // The adder keeps one base unit per bin back for rounding, so that much rides on top of the buffer.
  // A cap clamped to the balance is fine while it still covers the need: the adder scales the deposit to fit it.
  const cap = (need: bigint, limit?: bigint) => {
    if (need === 0n) return 0n;
    const c = need + (need * CAP_BUFFER_BPS) / 10_000n + BigInt(bins.length) + 1n;
    return limit != null && limit < c ? limit : c;
  };
  const max0 = cap(need0, have?.token0), max1 = cap(need1, have?.token1);
  return { weightDeltas: additionPlanToPoolLiquidityDelta(deltas), bounds, need0, need1, max0, max1, needs0, needs1, short0: max0 < need0, short1: max1 < need1 };
}

/**
 * The calls for a deposit: approvals to the adder (txRunner skips any already in place), then the add. With
 * `native` the wrapped native leg is paid in the chain's coin: sent as value, the unused part refunded.
 */
export function metricDepositCalls(o: {
  chainId: number; pool: `0x${string}`; token0: `0x${string}`; token1: `0x${string}`; salt: bigint;
  plan: MetricDepositPlan; native?: 0 | 1;
}): Call[] {
  const a = metricAddresses(o.chainId);
  if (!a) throw new Error('Metric is not deployed on this network.');
  const calls: Call[] = [];
  const approve = (token: `0x${string}`, amount: bigint) => calls.push({
    to: token, data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [a.liquidityAdder, amount] }),
  });
  const { max0, max1 } = o.plan;
  if (max0 > 0n && o.native !== 0) approve(o.token0, max0);
  if (max1 > 0n && o.native !== 1) approve(o.token1, max1);
  const params = { pool: o.pool, salt: o.salt, weightDeltas: o.plan.weightDeltas, maxAmountToken0: max0, maxAmountToken1: max1, ...o.plan.bounds };
  if (o.native != null) {
    calls.push({ to: a.liquidityAdder, data: prepareAddLiquidityWeightedSelfSupportingNativePaymentCalldata(params), value: o.native === 0 ? max0 : max1 });
  } else {
    calls.push({ to: a.liquidityAdder, data: encodeAddLiquidityWeightedSelfCalldata(params) });
  }
  return calls;
}

export interface MetricWithdrawPlan { deltas: PoolLiquidityDelta; out0: bigint; out1: bigint; all: boolean }

/**
 * Plan taking `pct` percent of a position out, from its on-chain shares. A bin that would be left below the pool's
 * minimal operational liquidity, or whose part is below it, is emptied instead, since the pool rejects both.
 */
export async function planMetricWithdraw(client: PublicClient, chainId: number, pool: `0x${string}`, owner: `0x${string}`, salt: bigint, bins: number[], pct: number): Promise<MetricWithdrawPlan> {
  const a = metricAddresses(chainId);
  if (!a) throw new Error('Metric is not deployed on this network.');
  const [imm, shares, states] = await Promise.all([
    getPoolImmutables(client, a.factory, pool),
    Promise.all(bins.map((bin) => client.readContract({
      address: a.dataProvider, abi: MetricOmmPoolDataProviderAbi, functionName: 'positionBinShares', args: [pool, owner, salt, bin],
    }) as Promise<bigint>)),
    getBinStatesExternal(client, a.dataProvider, pool, bins, a.factory),
  ]);
  const min = imm.minimalOperationalLiquidity;
  const binIdxs: bigint[] = [], out: bigint[] = [];
  let out0 = 0n, out1 = 0n, all = true;
  bins.forEach((bin, i) => {
    const have = shares[i];
    if (have <= 0n) return;
    let take = pct >= 100 ? have : (have * BigInt(Math.round(pct * 100))) / 10_000n;
    if (take < have && (have - take < min || take < min)) take = have;
    if (take <= 0n) return;
    if (take < have) all = false;
    binIdxs.push(BigInt(bin)); out.push(take);
    const total = states.totalShares[i];
    if (total > 0n) {
      out0 += (states.token0Balances[i] * take) / total;
      out1 += (states.token1Balances[i] * take) / total;
    }
  });
  if (binIdxs.length === 0) throw new Error('Nothing left in this position on chain.');
  return { deltas: { binIdxs, shares: out }, out0, out1, all };
}

export function metricWithdrawCall(pool: `0x${string}`, owner: `0x${string}`, salt: bigint, plan: MetricWithdrawPlan): Call {
  return { to: pool, data: encodeRemoveLiquidityCalldata({ owner, salt, deltas: plan.deltas }) };
}

/** A fresh position id: a random uint80, as Metric's app makes them. */
export function newMetricSalt(): bigint {
  const b = new Uint8Array(10);
  crypto.getRandomValues(b);
  return b.reduce((acc, x) => (acc << 8n) | BigInt(x), 0n);
}
