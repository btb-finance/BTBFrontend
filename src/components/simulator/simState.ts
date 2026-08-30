/**
 * Simulator derivation layer — the single source of truth for every number on
 * the simulator page. Sections NEVER compute their own APY, IL, or fee figures;
 * they read this object, so the sticky footer can't disagree with the charts.
 *
 * Conventions (same as v3/simulate.ts):
 *  - pool space: price of token0 in token1, human units;
 *  - display space: the volatile token quoted in the other (flip-aware);
 *  - USD values hold the DISPLAY QUOTE token's USD price constant over the
 *    horizon (the stable side on stable-quoted pairs) and let the other token
 *    move with the pool price — exact for stable pairs, a stated approximation
 *    otherwise. The IL fraction itself is numeraire-invariant;
 *  - all float math is display-grade, never used to size a transaction.
 */
import { formatUnits } from 'viem';
import { STABLES } from '../../lib/pools';
import {
  impermanentLossFraction, unitAmounts, tickToPrice, getAmountsForLiquidity, backtestRange,
  type MintPool, type PoolDay, type BacktestResult,
} from '@/protocols/dexs/uniswap';
import {
  estimateSigmaDaily, estimateDriftDaily, rangeCoverage,
  expectedTimeInRange, pathInRangeFraction, normPdf,
} from './math/probability';
import { healthScore, type Health } from './math/healthScore';
import { buildScenarios, type Scenario } from './math/scenarios';

export type Strategy = 'conservative' | 'balanced' | 'aggressive' | 'custom';

/** Strategy presets as multiples of σ over the horizon — the range half-width
 * is k·σ_H in log space, so "Conservative" means the same thing (≈95% terminal
 * coverage) on a stable pair and a meme coin alike. */
export const STRATEGY_SIGMA: Record<Exclude<Strategy, 'custom'>, number> = {
  conservative: 2, balanced: 1, aggressive: 0.5,
};

export const HORIZONS = [
  { d: 7, label: '1 week' }, { d: 30, label: '1 month' },
  { d: 90, label: '3 months' }, { d: 180, label: '6 months' },
];

export interface SimInputs {
  pool: MintPool;
  feeTier: number;
  history: PoolDay[] | null;         // indexed per-day price, fees, and liquidity snapshots
  /** True when `history` was synthesized from volume×fee (no indexed data). */
  historyEstimated?: boolean;
  /** Pool creation timestamp (ms) — feeds the pool-age signal. */
  poolCreatedAt?: number | null;
  fallbackCloses: number[] | null;   // pool-space closes (GeckoTerminal, rescaled)
  fees24hUsd?: number;               // whole-pool daily fees fallback
  tokenUsd: { p0: number; p1: number } | null;
  tvlUsd: number | null;
  depositUsd: number;
  tickLower: number;
  tickUpper: number;
  horizonDays: number;
  /** Sensitivity override: display-space price move in percent. 0 = model median. */
  movePct: number;
  flip: boolean;
  gasUsd: number;
  /** Gauge/emission APR (staking route) shown separately from swap fees. */
  rewardAprPct?: number;
  rewardLabel?: string;
  /** Reinvest fees into the position — geometric fee accumulation. */
  compound?: boolean;
}

export interface WaterfallLeg {
  label: string;
  usd: number;              // signed delta (start/final carry the absolute value)
  kind: 'start' | 'delta' | 'final';
  note: string;
}

export interface TimelineStep {
  label: string;
  days: number;
  /** Modelled fee estimate based on trailing pool fees and expected time in range. */
  feesUsd: number;
  /** LP-versus-holding difference at ±1σ model price paths, signed fractions. */
  ilAtMinus1s: number;
  ilAtPlus1s: number;
  inRangeProb: number;      // model terminal coverage at this step
}

export interface RiskAxis { name: string; risk: number; note: string }

export interface Sim {
  // identity + orientation
  sym0: string; sym1: string;
  dispBase: string; dispQuote: string;
  flip: boolean;
  feeTier: number;
  // pricing
  price: number; priceLower: number; priceUpper: number;
  dispPrice: number; dispLower: number; dispUpper: number;
  inRange: boolean;
  nearEdge: boolean;
  // deposit
  depositUsd: number;
  amount0: number; amount1: number;
  value0Usd: number; value1Usd: number;
  liquidityShare: number;
  // fees
  poolDailyFeesUsd: number;
  poolVolume7dUsd: number | null;
  volumeToTvl7d: number | null;
  dailyFeeUsd: number;
  feeAprPct: number | null;
  dailyFeeSeries: { date: number; feesUsd: number }[];
  hasFeeData: boolean;
  // model
  sigmaDaily: number; driftDaily: number;
  /** True when sigmaDaily was clamped up to the pair-type floor (junk/short
   * candle history) — the figure is an assumption, not a measurement. */
  sigmaAssumed: boolean;
  coverage: number;
  timeInRange: number;
  expectedFeesUsd: number;
  nearestEdgePct: number | null;
  usingFallbackHistory: boolean;
  /** Range-edge/management estimates — what active LPs actually plan around. */
  historyEstimated: boolean;
  poolAgeDays: number | null;
  timeToEdgeDays: number | null;
  rebalancesPerMonth: number | null;
  ilAtEdge: number | null;
  /** Daily fee income and adverse-selection (LVR) rate, % of deposit. */
  feeDailyPct: number | null;
  lvrDailyPct: number | null;
  rewardAprPct?: number;
  rewardLabel?: string;
  // functions of an end price (POOL space)
  hodlUsd(p1: number): number;
  lpUsd(p1: number): number;
  ilFraction(p1: number): number;
  feesTo(p1: number): number;
  netUsd(p1: number): number;
  dispToPool(disp: number): number;
  poolToDisp(pool: number): number;
  // headline end state (movePct applied)
  movePct: number;
  endPrice: number; dispEndPrice: number;
  // outcomes
  waterfall: WaterfallLeg[];
  comparison: { label: string; valueUsd: number; isYou?: boolean }[];
  scenarios: (Scenario & { roiPct: number; feesUsd: number; ilPct: number; endPoolPrice: number })[];
  worstUsd: number; bestUsd: number;
  probPositive: number;
  expectedIlFraction: number;
  netAprPct: number;
  health: Health;
  timeline: TimelineStep[];
  risk: RiskAxis[];
  /** Historical daily-snapshot replay for this range. Null when no subgraph history. */
  backtest: BacktestResult | null;
  /** Real daily closes in DISPLAY space with in-range flags, for the backtest chart. */
  backtestDays: { disp: number; inRange: boolean }[];
  // misc for charts
  histCloses: number[];     // pool space, oldest → newest
  horizonDays: number;
  tvlUsd: number | null;
  gasUsd: number;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export function deriveSim(i: SimInputs): Sim | null {
  const { pool, tokenUsd, depositUsd } = i;
  if (!pool.exists || !tokenUsd || !(depositUsd > 0)) return null;

  const price = ((Number(pool.sqrtPriceX96) / 2 ** 96) ** 2) * 10 ** (pool.decimals0 - pool.decimals1);
  if (!(price > 0)) return null;
  const priceLower = tickToPrice(i.tickLower, pool.decimals0, pool.decimals1);
  const priceUpper = tickToPrice(i.tickUpper, pool.decimals0, pool.decimals1);
  if (!(priceLower > 0) || !(priceUpper > priceLower)) return null;

  const flip = i.flip;
  const poolToDisp = (p: number) => (flip ? (p > 0 ? 1 / p : 0) : p);
  const dispToPool = poolToDisp; // inversion is its own inverse; identity stays identity

  const dispPrice = poolToDisp(price);
  const dispLower = flip ? poolToDisp(priceUpper) : priceLower;
  const dispUpper = flip ? poolToDisp(priceLower) : priceUpper;

  const inRange = price >= priceLower && price <= priceUpper;
  const halfWidthLog = Math.log(priceUpper / priceLower) / 2;
  const edgeDist = inRange
    ? Math.min(Math.log(price / priceLower), Math.log(priceUpper / price))
    : 0;
  const nearEdge = inRange && halfWidthLog > 0 && edgeDist / halfWidthLog < 0.15;

  // ── Entry composition ──────────────────────────────────────────────────────
  const ua = unitAmounts(price, priceLower, priceUpper);
  const unitValueToken1 = ua.x * price + ua.y;
  if (!(unitValueToken1 > 0)) return null;
  const usd1 = tokenUsd.p1;
  const scale = depositUsd / (unitValueToken1 * usd1);
  const amount0 = ua.x * scale;
  const amount1 = ua.y * scale;
  const value0Usd = amount0 * price * usd1;
  const value1Usd = amount1 * usd1;

  // ── Liquidity share (same approach as the CreatePosition sheet) ────────────
  const [u0, u1] = getAmountsForLiquidity(pool.sqrtPriceX96, i.tickLower, i.tickUpper, 10n ** 18n);
  const unitUsd = parseFloat(formatUnits(u0, pool.decimals0)) * tokenUsd.p0
    + parseFloat(formatUnits(u1, pool.decimals1)) * tokenUsd.p1;
  const userL = unitUsd > 0 ? (Number(10n ** 18n) * depositUsd) / unitUsd : 0;
  const poolL = Number(pool.liquidity);
  const liquidityShare = userL + poolL > 0 ? userL / (userL + poolL) : 0;

  // ── Fee model ──────────────────────────────────────────────────────────────
  const todayBucket = Math.floor(Date.now() / 1000 / 86400) * 86400;
  const completeDays = (i.history ?? []).filter((d) => d.date < todayBucket);
  const recent = completeDays.slice(-7);
  const poolVolume7dUsd = recent.length > 0 ? recent.reduce((s, d) => s + d.volumeUsd, 0) : null;
  const volumeToTvl7d = poolVolume7dUsd != null && i.tvlUsd != null && i.tvlUsd > 0
    ? poolVolume7dUsd / i.tvlUsd
    : null;
  const poolDailyFeesUsd = recent.length > 0
    ? recent.reduce((s, d) => s + d.feesUsd, 0) / recent.length
    : i.fees24hUsd ?? 0;
  const hasFeeData = poolDailyFeesUsd > 0;
  const dailyFeeUsd = inRange ? poolDailyFeesUsd * liquidityShare : 0;
  const feeAprPct = depositUsd > 0 && poolDailyFeesUsd > 0
    ? (poolDailyFeesUsd * liquidityShare * 365 / depositUsd) * 100
    : null;
  const dailyFeeSeries = completeDays.map((d) => ({ date: d.date, feesUsd: d.feesUsd * liquidityShare }));

  // ── Volatility model ───────────────────────────────────────────────────────
  const histCloses = i.history && i.history.length > 1
    ? i.history.map((d) => d.price0)
    : i.fallbackCloses ?? [];
  const usingFallbackHistory = !(i.history && i.history.length > 1);
  // Candle feeds can lie — GeckoTerminal has emitted flat placeholder candles
  // (every close = 1.0) for new or mis-indexed pools — and short series say
  // little. A volatility below what the pair's own composition makes possible
  // defaults to a razor-thin range and promises fee income the first real
  // price move destroys (a $10k position showed +$6k/month off 0.1%/day on a
  // WETH pair), so clamp from below by pair type.
  const sigmaFloor = (() => {
    const s0 = STABLES.has((pool.symbol0 ?? '').toUpperCase());
    const s1 = STABLES.has((pool.symbol1 ?? '').toUpperCase());
    if (s0 && s1) return 0.0005; // stable/stable — genuinely calm
    if (s0 || s1) return 0.015;  // one side is a real asset; even calm weeks of ETH run ~1-2%/day
    return 0.03;                 // volatile/volatile
  })();
  const rawSigma = estimateSigmaDaily(histCloses);
  const sigmaAssumed = rawSigma < sigmaFloor || histCloses.length < 6;
  const sigmaDaily = Math.max(rawSigma, sigmaFloor);
  // Drift in DISPLAY orientation so "the trend" points the way users read it.
  const dispCloses = flip ? histCloses.map((c) => (c > 0 ? 1 / c : 0)) : histCloses;
  const driftDaily = estimateDriftDaily(dispCloses);

  const H = i.horizonDays;
  const coverage = rangeCoverage(price, priceLower, priceUpper, sigmaDaily, H);
  const timeInRange = expectedTimeInRange(price, priceLower, priceUpper, sigmaDaily, H);
  const perDayShare = poolDailyFeesUsd * liquidityShare; // fee/day while in range
  // Compounding: fees reinvested at a constant daily rate r grow the stream
  // geometrically — ((1+r)^H − 1)/r in place of a flat H.
  const rDaily = depositUsd > 0 ? perDayShare / depositUsd : 0;
  const horizonFactor = i.compound && rDaily > 0
    ? (Math.pow(1 + rDaily, H) - 1) / rDaily
    : H;
  const expectedFeesUsd = perDayShare * timeInRange * horizonFactor;
  const nearestEdgePct = inRange
    ? Math.min(price / priceLower - 1, priceUpper / price - 1) * 100
    : null;

  // ── Value functions (pool space) ───────────────────────────────────────────
  // Numeraire = the display quote token (the stable on stable-quoted pairs):
  // flipped pairs (stable is token0) value in token0, otherwise in token1.
  // The IL ratio (posVal/hodlVal) is identical in either numeraire.
  const usd0 = tokenUsd.p0;
  const hodlUsd = (p1: number) => (flip
    ? (amount0 + amount1 / p1) * usd0
    : (amount0 * p1 + amount1) * usd1);
  const ilFraction = (p1: number) => impermanentLossFraction(price, p1, priceLower, priceUpper);
  const lpUsd = (p1: number) => hodlUsd(p1) * (1 + ilFraction(p1));
  const feesTo = (p1: number) => perDayShare * H * pathInRangeFraction(price, p1, priceLower, priceUpper);
  const netUsd = (p1: number) => lpUsd(p1) + feesTo(p1) - i.gasUsd - depositUsd;

  // ── Headline end price (sensitivity slider applies in display space) ───────
  const moveFactor = 1 + i.movePct / 100;
  const dispEndPrice = dispPrice * Math.max(moveFactor, 0.01);
  const endPrice = flip ? (dispEndPrice > 0 ? 1 / dispEndPrice : price) : dispEndPrice;

  // ── Probability grid: P(net > 0), E[IL], percentile outcomes ───────────────
  // Worst/best are percentiles of the OUTCOME distribution, not the outcome at
  // a price percentile: net PnL isn't monotonic in price (IL is a hump, fees
  // stop outside the range), and on a flipped pair a low pool price is a HIGH
  // display price — so evaluating at the 5th-percentile price can hand back the
  // better outcome. Sample the price grid, then take weighted quantiles of net.
  const sH = sigmaDaily * Math.sqrt(Math.max(H, 1));
  const grid: { net: number; w: number }[] = [];
  let probPositive = 0, wSum = 0, expectedIlFraction = 0;
  for (let z = -4; z <= 4.0001; z += 0.05) {
    const w = normPdf(z);
    const p1 = price * Math.exp(sH * z);
    const net = netUsd(p1);
    grid.push({ net, w });
    if (net > 0) probPositive += w;
    expectedIlFraction += ilFraction(p1) * w;
    wSum += w;
  }
  probPositive /= wSum;
  expectedIlFraction /= wSum;

  /** Weighted q-quantile of the sampled net outcome. */
  const netQuantile = (q: number): number => {
    const sorted = [...grid].sort((a, b) => a.net - b.net);
    const target = q * wSum;
    let acc = 0;
    for (const g of sorted) {
      acc += g.w;
      if (acc >= target) return g.net;
    }
    return sorted[sorted.length - 1].net;
  };
  const worstUsd = netQuantile(0.05);
  const bestUsd = netQuantile(0.95);

  // ── Waterfall at the headline end price ────────────────────────────────────
  // At the median (movePct 0) the fee leg is the probability-weighted estimate;
  // with a slider move it's the straight-path figure, so the two views agree
  // wherever they overlap.
  const wfFees = i.movePct === 0 ? expectedFeesUsd : feesTo(endPrice);
  const priceGain = hodlUsd(endPrice) - depositUsd;
  const ilLeg = lpUsd(endPrice) - hodlUsd(endPrice);
  const finalUsd = depositUsd + priceGain + wfFees + ilLeg - i.gasUsd;
  const waterfall: WaterfallLeg[] = [
    { label: 'Start', usd: depositUsd, kind: 'start', note: 'Your deposit at today’s prices.' },
    { label: 'Price move', usd: priceGain, kind: 'delta', note: 'What just holding the entry tokens would gain or lose from the price change.' },
    { label: 'Fees', usd: wfFees, kind: 'delta', note: 'Your share of pool trading fees while the price stays in your range.' },
    { label: 'IL', usd: ilLeg, kind: 'delta', note: 'Impermanent loss: the LP position vs simply holding the same tokens.' },
    { label: 'Gas', usd: -i.gasUsd, kind: 'delta', note: 'Estimated cost to mint and later collect, at typical mainnet gas.' },
    { label: 'Final', usd: finalUsd, kind: 'final', note: 'Estimated position value plus collected fees at the horizon.' },
  ];

  // ── Comparison vs simple alternatives, same end price ──────────────────────
  // Per-token USD growth factors under the fixed-numeraire convention above:
  // the display quote token holds its USD value, the other follows the pool.
  const hold0Factor = flip ? 1 : endPrice / price;
  const hold1Factor = flip ? price / endPrice : 1;
  const comparison = [
    { label: 'Your LP', valueUsd: lpUsd(endPrice) + wfFees - i.gasUsd, isYou: true },
    { label: `Hold ${pool.symbol0}`, valueUsd: depositUsd * hold0Factor },
    { label: `Hold ${pool.symbol1}`, valueUsd: depositUsd * hold1Factor },
    { label: '50/50 hold', valueUsd: depositUsd * (hold0Factor + hold1Factor) / 2 },
  ];

  // ── Scenarios ──────────────────────────────────────────────────────────────
  const scenarios = buildScenarios(dispPrice, sigmaDaily, H, driftDaily).map((sc) => {
    const p1 = flip ? (sc.endPrice > 0 ? 1 / sc.endPrice : price) : sc.endPrice;
    const fees = feesTo(p1);
    const net = lpUsd(p1) + fees - i.gasUsd - depositUsd;
    return {
      ...sc,
      endPoolPrice: p1,
      roiPct: (net / depositUsd) * 100,
      feesUsd: fees,
      ilPct: ilFraction(p1) * 100,
    };
  });

  // ── Health ─────────────────────────────────────────────────────────────────
  const health = healthScore({
    price, priceLower, priceUpper, coverage,
    feeAprPct: feeAprPct ?? 0,
    expectedIlFraction,
    expectedFeeFraction: expectedFeesUsd / depositUsd,
    tvlUsd: i.tvlUsd,
  });

  // ── Timeline ───────────────────────────────────────────────────────────────
  const STEPS = [
    { label: 'Today', days: 0 }, { label: 'Week 1', days: 7 }, { label: 'Week 2', days: 14 },
    { label: 'Month 1', days: 30 }, { label: 'Month 3', days: 90 }, { label: 'Month 6', days: 180 },
  ];
  const timeline: TimelineStep[] = STEPS.map(({ label, days }) => {
    if (days === 0) {
      return { label, days, feesUsd: 0, ilAtMinus1s: 0, ilAtPlus1s: 0, inRangeProb: inRange ? 1 : 0 };
    }
    const tir = expectedTimeInRange(price, priceLower, priceUpper, sigmaDaily, days);
    const fees = perDayShare * days * tir;
    const st = sigmaDaily * Math.sqrt(days);
    const ilDown = ilFraction(price * Math.exp(-st));
    const ilUp = ilFraction(price * Math.exp(st));
    return {
      label, days, feesUsd: fees, ilAtMinus1s: ilDown, ilAtPlus1s: ilUp,
      inRangeProb: rangeCoverage(price, priceLower, priceUpper, sigmaDaily, days),
    };
  });

  // ── Risk radar (0 = calm, 100 = risky) ─────────────────────────────────────
  const feeCv = (() => {
    const vals = dailyFeeSeries.map((d) => d.feesUsd).filter((v) => v > 0);
    if (vals.length < 5) return null;
    const m = vals.reduce((s, v) => s + v, 0) / vals.length;
    const sd = Math.sqrt(vals.reduce((s, v) => s + (v - m) ** 2, 0) / (vals.length - 1));
    return m > 0 ? sd / m : null;
  })();
  const oneSided = Math.abs(value0Usd / depositUsd - 0.5) * 2;
  const risk: RiskAxis[] = [
    { name: 'Volatility', risk: Math.round(clamp01((sigmaDaily - 0.005) / 0.075) * 100), note: `Pair moves about ${(sigmaDaily * 100).toFixed(1)}% a day.` },
    { name: 'Liquidity', risk: Math.round((1 - (i.tvlUsd == null ? 0.5 : clamp01((Math.log10(Math.max(i.tvlUsd, 1)) - 4) / 3))) * 100), note: i.tvlUsd != null ? `Pool TVL ${i.tvlUsd >= 1e6 ? `$${(i.tvlUsd / 1e6).toFixed(1)}M` : `$${Math.round(i.tvlUsd / 1e3)}k`}.` : 'Pool TVL unknown.' },
    { name: 'Range', risk: Math.round(clamp01(1 - halfWidthLog / (2 * Math.max(sH, 1e-6))) * 100), note: 'How narrow your range is vs how far this pair typically moves.' },
    { name: 'Fees', risk: feeCv == null ? 50 : Math.round(clamp01(feeCv / 1.5) * 100), note: feeCv == null ? 'Not enough fee history to judge steadiness.' : 'How much daily fee income swings day to day.' },
    { name: 'Exposure', risk: Math.round(oneSided * 100), note: `Entry is ${Math.round((value0Usd / depositUsd) * 100)}% ${pool.symbol0} / ${Math.round((value1Usd / depositUsd) * 100)}% ${pool.symbol1}.` },
    { name: 'IL', risk: Math.round(clamp01(Math.abs(expectedIlFraction) / 0.1) * 100), note: `Expected impermanent loss about ${(expectedIlFraction * 100).toFixed(1)}% at the horizon.` },
  ];

  const netAprPct = ((expectedFeesUsd + depositUsd * expectedIlFraction - i.gasUsd) / depositUsd) * (365 / H) * 100;

  // ── Adverse selection (LVR) — the rebalancing benchmark LPs quote ──────────
  // Instantaneous relative LVR of a CL position while in range: −½σ²p²V''/V
  // with V = L(2√p − √a − p/√b) reduces to σ²√p / (4(2√p − √a − p/√b)) per
  // day. Full-range limit is the textbook σ²/8.
  const sqrtP = Math.sqrt(price);
  const posUnits = 2 * sqrtP - Math.sqrt(priceLower) - price / Math.sqrt(priceUpper);
  const lvrDailyPct = inRange && posUnits > 0 && sigmaDaily > 0
    ? (sigmaDaily * sigmaDaily * sqrtP) / (4 * posUnits) * 100
    : null;
  const feeDailyPct = depositUsd > 0 && perDayShare > 0 ? (perDayShare / depositUsd) * 100 : null;

  // ── Historical replay: real indexed pool prices/fees, with each day's
  // recorded liquidity used to estimate this new position's fee share.
  const backtest = i.history && i.history.length >= 2
    ? backtestRange({
        history: i.history.map((d) => ({ price0: d.price0, feesUsd: d.feesUsd, liquidity: d.liquidity })),
        priceLower, priceUpper,
        userLiquidity: userL, activeLiquidity: poolL,
        depositUsd,
      })
    : null;
  const backtestDays = (i.history ?? []).map((d) => ({
    disp: poolToDisp(d.price0),
    inRange: d.price0 >= priceLower && d.price0 <= priceUpper,
  }));

  return {
    sym0: pool.symbol0, sym1: pool.symbol1,
    dispBase: flip ? pool.symbol1 : pool.symbol0,
    dispQuote: flip ? pool.symbol0 : pool.symbol1,
    flip, feeTier: i.feeTier,
    price, priceLower, priceUpper, dispPrice, dispLower, dispUpper,
    inRange, nearEdge,
    depositUsd, amount0, amount1, value0Usd, value1Usd, liquidityShare,
    poolDailyFeesUsd, poolVolume7dUsd, volumeToTvl7d, dailyFeeUsd, feeAprPct, dailyFeeSeries, hasFeeData,
    sigmaDaily, sigmaAssumed, driftDaily, coverage, timeInRange, expectedFeesUsd, nearestEdgePct, usingFallbackHistory,
    historyEstimated: i.historyEstimated ?? false,
    poolAgeDays: i.poolCreatedAt != null ? Math.max(0, Math.round((Date.now() - i.poolCreatedAt) / 86_400_000)) : null,
    // Median first-passage of a zero-drift random walk to the nearer range
    // edge: (distance/σ)² in days. Then what active management implies.
    timeToEdgeDays: nearestEdgePct != null && nearestEdgePct > 0 && sigmaDaily > 0
      ? (nearestEdgePct / 100 / sigmaDaily) ** 2
      : null,
    rebalancesPerMonth: nearestEdgePct != null && nearestEdgePct > 0 && sigmaDaily > 0
      ? Math.min(30 / ((nearestEdgePct / 100 / sigmaDaily) ** 2), 99)
      : null,
    ilAtEdge: inRange ? Math.min(ilFraction(priceLower), ilFraction(priceUpper)) : null,
    feeDailyPct, lvrDailyPct,
    rewardAprPct: i.rewardAprPct, rewardLabel: i.rewardLabel,
    hodlUsd, lpUsd, ilFraction, feesTo, netUsd, dispToPool, poolToDisp,
    movePct: i.movePct, endPrice, dispEndPrice,
    waterfall, comparison, scenarios, worstUsd, bestUsd, probPositive, expectedIlFraction,
    netAprPct, health, timeline, risk,
    backtest, backtestDays,
    histCloses, horizonDays: H, tvlUsd: i.tvlUsd, gasUsd: i.gasUsd,
  };
}
