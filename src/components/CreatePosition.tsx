'use client';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { useConnection, useConfig } from 'wagmi';
import { getPublicClient } from 'wagmi/actions';
import { formatUnits, parseUnits, erc20Abi } from 'viem';
import { Glass } from './Glass';
import { Icon } from './Icon';
import { Portal } from './Portal';
import { Button } from './Button';
import { TokenIcon } from './TokenIcon';
import { btb } from './design-tokens';
import { useSidebar } from '../lib/SidebarContext';
import { useTx } from '../lib/TxTracker';
import { runCalls } from '../lib/txRunner';
import { AutomationRules, DEFAULT_AUTOMATION_RULES, type AutomationRuleValues } from './AutomationRules';
import {
  UINT128_MAX, approvalCall, createAccountCall, fundAndCreateCall, getSmartAccountDeployment,
  minWithSlippage, readSmartAccount, wrapEthCall, type RebalancePolicy,
} from '../lib/smartAccount';
import { buildSwapGap } from '../lib/swapGap';
import { getTokenPricesUsd } from '../lib/defillama';
import { getFeeSplit, type FeeSwitchProtocol } from '../lib/protocolFees';
import {
  fetchPoolsForMint, buildMint, rangeTicks, addAmounts, addSide, nearestUsableTick,
  liquidityForAmounts, getAmountsForLiquidity, fitRangeToBalances, getPoolHistory, hasGraphKey, V3_SUBGRAPH_ID,
  MIN_TICK, MAX_TICK, WETH, UNISWAP_V3_DEPLOYMENT, ROBINHOOD_UNISWAP_V3_DEPLOYMENT, ROBINHOOD_WETH,
  ROBINHOOD_UNISWAP_V4, UNISWAP_V4,
  fetchV4PoolForMint, buildV4Mint, maxIn, isNativeCurrency, fmtFeeTier, rebalancePlan,
  backtestRange, SLIPPAGE_BPS, GAS_RESERVE, tickToPrice,
  type MintPool, type V4MintPool, type PoolDay, type BacktestResult,
} from '@/protocols/dexs/uniswap';
import { PANCAKE_V3_DEPLOYMENT, PANCAKE_V3_SUBGRAPH_ID } from '@/protocols/dexs/pancakeswap';
import { NPM_ABI } from '@/protocols/dexs/uniswap/v3/abis';
import { STABLES } from '../lib/pools';

const RANGE_PRESETS: { label: string; pct: number | null }[] = [
  { label: '±1%', pct: 1 }, { label: '±5%', pct: 5 }, { label: '±10%', pct: 10 }, { label: 'Full', pct: null },
];
/** Projection periods for the estimated-yield dropdown. */
const YIELD_PERIODS: { d: number; label: string }[] = [
  { d: 7, label: '1 week' }, { d: 30, label: '1 month' }, { d: 90, label: '3 months' }, { d: 365, label: '1 year' },
];
/** Preset ±pct | null = full range | 'custom' (min/max inputs) | exact ticks (smart fit). */
type RangeMode = number | null | 'custom' | { tickLower: number; tickUpper: number };

function fmtAmt(raw: bigint, decimals: number): string {
  const n = parseFloat(formatUnits(raw, decimals));
  if (n === 0) return '0';
  if (n < 0.0001) return '<0.0001';
  return n.toLocaleString('en-US', { maximumFractionDigits: 6 });
}

/** Plain re-parseable price string for the min/max inputs. */
function fmtPrice(p: number): string {
  if (!isFinite(p)) return '∞';
  if (p <= 1e-30) return '0';
  return parseFloat(p.toPrecision(6)).toString();
}

/** Min/max price strings -> snapped usable ticks. '0'/'∞'/empty = open-ended. */
function ticksFromPrices(minStr: string, maxStr: string, pool: MintPool, spacing: number) {
  const ln = Math.log(1.0001);
  const toTick = (p: number) => Math.round(Math.log(p * 10 ** (pool.decimals1 - pool.decimals0)) / ln);
  const lo = parseFloat(minStr);
  const hi = parseFloat(maxStr);
  const tickLower = isFinite(lo) && lo > 0 ? nearestUsableTick(toTick(lo), spacing) : nearestUsableTick(MIN_TICK, spacing);
  let tickUpper = isFinite(hi) && hi > 0 ? nearestUsableTick(toTick(hi), spacing) : nearestUsableTick(MAX_TICK, spacing);
  if (tickUpper <= tickLower) tickUpper = tickLower + spacing;
  return { tickLower, tickUpper };
}

/**
 * Create a brand-new Uniswap V3 or V4 position (Ethereum mainnet), in two
 * mobile-friendly steps: 1 · Price range (fee tier + presets/custom range,
 * snapped to ticks) then 2 · Deposit (enter either token's amount — the other
 * side is auto-paired at the current price — with the earnings estimate) and
 * mint with slippage protection (approvals batched in).
 *
 * V3 (tokenA/tokenB given): fee tier is selectable across all tiers.
 * V4 (v4PoolId given): same flow against the singleton PoolManager — the pool
 * (with its fee/tickSpacing/hooks key) is fixed by the id, deposits go through
 * Permit2, and native-ETH pools are paid in ETH directly.
 *
 * `simulate` opens the sheet as a free earnings simulator on a SINGLE page:
 * USD amount on top (default $1,000), the range controls below, and live
 * daily/monthly/yearly fee estimates at the bottom — no wallet needed, no
 * steps. One tap switches to the real deposit flow with the same range.
 *
 * Smart fit (add mode): step 1 shows what the wallet holds and one tap
 * re-places the chosen range width so those balances deposit cleanly —
 * shifted when the token ratio is off, single-sided next to the current price
 * when only one token is held. The step-2 "insufficient balance" warning
 * offers the same fix inline.
 */
export function CreatePosition({ tokenA, tokenB, initialFee, initialTicks, fees24hUsd, tokenPricesUsd, v4PoolId, simulate, dex = 'uniswap', chainId = 1, onClose, onDone }: {
  /** V3 mint: the (unsorted) token pair. Ignored when `v4PoolId` is set. */
  tokenA?: `0x${string}`; tokenB?: `0x${string}`;
  /** Which V3-architecture DEX a token-pair mint targets (V4 is Uniswap-only). */
  dex?: 'uniswap' | 'pancakeswap';
  /** Fee tier of the pool the user clicked — preselected when valid (V3). */
  initialFee?: number;
  /** Exact starting range (e.g. handed over from the simulator page). */
  initialTicks?: { tickLower: number; tickUpper: number };
  /** Pool's recent daily LP fees (USD) — earnings fallback when no Graph key. */
  fees24hUsd?: number;
  /** Chain-native address-keyed quotes, used when global price APIs lack the token. */
  tokenPricesUsd?: Record<string, number>;
  /** V4 mint: the bytes32 pool id from the Earn list. */
  v4PoolId?: `0x${string}`;
  /** Open as the earnings simulator (USD amount, no wallet) instead of a deposit. */
  simulate?: boolean;
  chainId?: 1 | 4663;
  onClose: () => void; onDone?: () => void;
}) {
  const { width: sidebarWidth, isMobile } = useSidebar();
  const { address } = useConnection();
  const config = useConfig();
  const { track } = useTx();

  // V3-architecture deployment (Uniswap vs PancakeSwap fork) — addresses,
  // fee tiers (Pancake has 2500 instead of 3000) and tick spacings.
  const deployment = dex === 'pancakeswap' ? PANCAKE_V3_DEPLOYMENT : chainId === 4663 ? ROBINHOOD_UNISWAP_V3_DEPLOYMENT : UNISWAP_V3_DEPLOYMENT;
  const v4Deployment = chainId === 4663 ? ROBINHOOD_UNISWAP_V4 : UNISWAP_V4;
  const chainWeth = chainId === 4663 ? ROBINHOOD_WETH : WETH;
  const isChainWeth = (addr: string) => addr.toLowerCase() === chainWeth.toLowerCase();
  const [fee, setFee] = useState(
    initialFee !== undefined && deployment.feeTiers.includes(initialFee) ? initialFee : deployment.feeTiers[2],
  );
  // All fee tiers are fetched in one batch up front — switching tiers is instant.
  const [pools, setPools] = useState<Record<number, MintPool> | null>(null);
  const [loadingPool, setLoadingPool] = useState(true);
  const [poolErr, setPoolErr] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  // Default ±5% — the same band the Earn list quotes its range APR for.
  // A caller-provided exact range (simulator handoff) wins over the preset.
  const [rangeMode, setRangeMode] = useState<RangeMode>(initialTicks ?? 5);
  const [minStr, setMinStr] = useState('');
  const [maxStr, setMaxStr] = useState('');
  const [amt, setAmt] = useState<{ side: 0 | 1; str: string }>({ side: 0, str: '' });
  // Split range: accept independent token amounts and place them in the
  // closest one-sided ranges below/above the live price (Meteora-style).
  const [splitRange, setSplitRange] = useState(false);
  const [splitAmt, setSplitAmt] = useState<{ str0: string; str1: string }>({ str0: '', str1: '' });
  const [useEth, setUseEth] = useState(true);
  const [busy, setBusy] = useState(false);
  const [stepMsg, setStepMsg] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [bal0, setBal0] = useState(0n);
  const [bal1, setBal1] = useState(0n);
  const [ethBal, setEthBal] = useState(0n);
  const [history, setHistory] = useState<PoolDay[] | null>(null);
  const [usd, setUsd] = useState<Record<string, number>>({});
  // Editable LP slippage (the sticky-footer pill), in bps. Defaults to the
  // shared 0.5%; the transaction builders use THIS, not the constant.
  const [slippageBps, setSlippageBps] = useState(chainId === 4663 ? 500 : SLIPPAGE_BPS);
  const [autoManage, setAutoManage] = useState(false);
  const [automationRules, setAutomationRules] = useState<AutomationRuleValues>({
    ...DEFAULT_AUTOMATION_RULES,
    twapSeconds: chainId === 4663 ? 60 : 300,
  });
  // Two steps — Range (fee tier + price range) then Deposit (amounts + mint) —
  // so the sheet stays short on mobile instead of one long scroll.
  const [tab, setTab] = useState<'range' | 'deposit'>('range');
  // Simulator mode: step 2 takes a USD amount instead of wallet deposits.
  const [simOnly, setSimOnly] = useState(!!simulate);
  const [simUsdStr, setSimUsdStr] = useState('1000');
  // How long the simulated position is projected to run for.
  const [simDays, setSimDays] = useState(30);
  // Yield projection-period dropdown (open state).
  const [yieldOpen, setYieldOpen] = useState(false);
  // Explanation of the last "smart fit" — cleared on any manual range change.
  const [smartNote, setSmartNote] = useState<string | null>(null);
  // Smart-fit strategy for a single-token wallet: 'balanced' swaps ~half so the
  // deposit is two-sided (stays ~50/50); 'single' is the directional, converting
  // single-sided position. Balanced is the default so a stablecoin holder isn't
  // silently placed into a "convert my USDC to ETH" limit range.
  const [smartStrategy, setSmartStrategy] = useState<'balanced' | 'single'>('balanced');
  // The bar's scale is frozen for a drag gesture so the handles do not jump
  // while changing a bound causes the display domain to recalculate.
  const rangeDrag = useRef<{
    pointerId: number; target: 'low' | 'high' | 'band'; startX: number;
    domainLow: number; domainHigh: number; low: number; high: number;
  } | null>(null);
  // Pending balanced-fit swap (set by applySmartFit, executed by mintBalanced).
  const [swapPreview, setSwapPreview] = useState<
    { sellSide: 0 | 1; sellRaw: bigint; sym: string; otherSym: string; pct: number } | null
  >(null);
  // Flip the quote direction: false → token1 per token0 (pool order),
  // true → token0 per token1. Display-only; ticks/amounts stay in pool order.
  // null = follow the auto-orientation below; a boolean = the user's choice.
  const [flipManual, setFlipManual] = useState<boolean | null>(null);

  const isV4 = v4PoolId !== undefined;
  const smartDeployment = !isV4 && dex === 'uniswap' ? getSmartAccountDeployment(chainId) : null;
  // Auto-orientation: quote the volatile token in the stablecoin
  // ("1 WETH = 2,000 USDC", not "1 USDC = 0.0005 WETH") — the way people read a
  // pair. Only kicks in when exactly one side is a stablecoin; else pool order.
  const autoFlip = useMemo(() => {
    const p = pools?.[fee];
    if (!p) return false;
    const s0 = STABLES.has((p.symbol0 ?? '').toUpperCase());
    const s1 = STABLES.has((p.symbol1 ?? '').toUpperCase());
    return s0 && !s1; // token0 stable → base the volatile token1
  }, [pools, fee]);
  const flip = flipManual ?? autoFlip;
  const dexLabel = dex === 'pancakeswap' ? 'PancakeSwap V3' : `Uniswap ${isV4 ? 'V4' : 'V3'}`;
  const pool = pools?.[fee] ?? null;
  const v4Pool = isV4 ? (pool as V4MintPool | null) : null;
  const feeSwitchProtocol: FeeSwitchProtocol = dex === 'pancakeswap' ? 'pancakeswap-v3' : isV4 ? 'uniswap-v4' : 'uniswap-v3';
  const feeSplit = getFeeSplit(feeSwitchProtocol, fee);

  // Native-ETH deposit side. V3: the WETH token (toggle ETH vs WETH).
  // V4: currency0 = address(0) IS native ETH — always paid as ETH, no toggle.
  const wethSide: 0 | 1 | null = !isV4 && pool ? (isChainWeth(pool.token0) ? 0 : isChainWeth(pool.token1) ? 1 : null) : null;
  const nativeSide: 0 | 1 | null = isV4 ? (pool && isNativeCurrency(pool.token0) ? 0 : null) : wethSide;
  const ethMode = isV4 ? nativeSide !== null : (wethSide !== null && useEth);
  const sym0 = pool ? (ethMode && nativeSide === 0 ? 'ETH' : pool.symbol0) : '';
  const sym1 = pool ? (ethMode && nativeSide === 1 ? 'ETH' : pool.symbol1) : '';
  // Quote direction for everything price-shaped (price line, min/max, chart).
  const qBase = flip ? sym1 : sym0;
  const qQuote = flip ? sym0 : sym1;
  const dispPrice = (p: number) => (flip ? (p > 0 ? 1 / p : 0) : p);

  function toggleFlip() {
    // Custom min/max strings live in display space — swap & invert them so the
    // selected range is preserved. Preset/smart-fit modes resync via effect.
    if (rangeMode === 'custom') {
      const lo = parseFloat(minStr), hi = parseFloat(maxStr);
      setMinStr(isFinite(hi) && hi > 0 ? fmtPrice(1 / hi) : '');
      setMaxStr(isFinite(lo) && lo > 0 ? fmtPrice(1 / lo) : '');
    }
    setFlipManual(!flip);
  }

  useEffect(() => {
    let live = true;
    setLoadingPool(true); setPools(null); setPoolErr(null);
    const client = getPublicClient(config, { chainId });
    if (!client) { setLoadingPool(false); setPoolErr('No RPC client'); return; }
    if (v4PoolId) {
      // V4: the pool id pins one pool (fee/tickSpacing/hooks) — no tier choice.
      fetchV4PoolForMint(client, v4PoolId, v4Deployment)
        .then((p) => { if (live) { setPools({ [p.fee]: p }); setFee(p.fee); } })
        .catch((e: Error) => { if (live) setPoolErr(e?.message ?? 'network error'); })
        .finally(() => { if (live) setLoadingPool(false); });
    } else if (tokenA && tokenB) {
      fetchPoolsForMint(client, tokenA, tokenB, deployment)
        .then((record) => {
          if (!live) return;
          setPools(record);
          // If the preselected tier has no pool, jump to the deepest existing one.
          setFee((f) => {
            if (record[f]?.exists) return f;
            const best = deployment.feeTiers.filter((t) => record[t]?.exists)
              .sort((a, b) => (record[b].liquidity > record[a].liquidity ? 1 : -1))[0];
            return best ?? f;
          });
        })
        .catch((e: Error) => { if (live) setPoolErr(e?.message ?? 'network error'); })
        .finally(() => { if (live) setLoadingPool(false); });
    } else {
      setLoadingPool(false); setPoolErr('Missing token pair');
    }
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, tokenA, tokenB, v4PoolId, dex, chainId, retryNonce]);

  // 30-day price/fee history (chart + earnings sim) and token USD prices.
  useEffect(() => {
    let live = true;
    setHistory(null);
    if (!pool || !pool.exists) return;
    const seededUsd = { ...(tokenPricesUsd ?? {}) };
    setUsd(seededUsd);
    if (chainId === 1 && hasGraphKey && !isV4) { // Robinhood has no Uniswap subgraph history yet
      getPoolHistory(dex === 'pancakeswap' ? PANCAKE_V3_SUBGRAPH_ID : V3_SUBGRAPH_ID, pool.address)
        .then((h) => { if (live) setHistory(h); })
        .catch(() => {}); // chart/sim are progressive extras — never block minting
    }
    // Native ETH (V4 currency 0x0) isn't a token DeFiLlama knows — price it as WETH.
    const priceToken0 = isNativeCurrency(pool.token0) ? WETH : pool.token0;
    getTokenPricesUsd([priceToken0, pool.token1])
      .then((p) => {
        if (!live) return;
        if (priceToken0 !== pool.token0 && p[WETH.toLowerCase()]) p[pool.token0.toLowerCase()] = p[WETH.toLowerCase()];
        setUsd({ ...seededUsd, ...p });
      })
      .catch(() => {});
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool, isV4, dex, chainId, tokenPricesUsd]);

  // V4 carries its own per-pool spacing; V3's is fixed per fee tier.
  const spacing = v4Pool ? v4Pool.tickSpacing : deployment.tickSpacings[fee];

  const ticks = useMemo(() => {
    if (!pool || !pool.exists) return null;
    if (rangeMode !== null && typeof rangeMode === 'object') return rangeMode; // smart fit — exact ticks
    if (rangeMode !== 'custom') return rangeTicks(pool.tick, spacing, rangeMode);
    if (!flip) return ticksFromPrices(minStr, maxStr, pool, spacing);
    // Flipped quoting: display min/max are inverted prices, so direct min = 1/displayMax.
    const inv = (s: string) => { const v = parseFloat(s); return isFinite(v) && v > 0 ? String(1 / v) : ''; };
    return ticksFromPrices(inv(maxStr), inv(minStr), pool, spacing);
  }, [pool, spacing, rangeMode, minStr, maxStr, flip]);

  // The closest usable tick strictly below/above the live tick leaves each
  // position entirely one-sided at submission time. The tiny gap is necessary:
  // a range that includes the live price would again require both tokens.
  const splitTicks = useMemo(() => {
    if (!pool || !ticks || isV4) return null;
    const belowUpper = Math.floor((pool.tick - 1) / spacing) * spacing;
    const aboveLower = Math.ceil((pool.tick + 1) / spacing) * spacing;
    const below = ticks.tickLower < belowUpper ? { tickLower: ticks.tickLower, tickUpper: belowUpper } : null;
    const above = aboveLower < ticks.tickUpper ? { tickLower: aboveLower, tickUpper: ticks.tickUpper } : null;
    return { below, above };
  }, [pool, ticks, spacing, isV4]);

  // Keep the min/max price inputs (display space) in sync with the preset / smart fit.
  useEffect(() => {
    if (!pool || !pool.exists || rangeMode === 'custom') return;
    const t = rangeMode !== null && typeof rangeMode === 'object' ? rangeMode : rangeTicks(pool.tick, spacing, rangeMode);
    const pLo = tickToPrice(t.tickLower, pool.decimals0, pool.decimals1);
    const pHi = tickToPrice(t.tickUpper, pool.decimals0, pool.decimals1);
    setMinStr(fmtPrice(flip ? (pHi > 0 ? 1 / pHi : 0) : pLo));
    setMaxStr(fmtPrice(flip ? (pLo > 0 ? 1 / pLo : Infinity) : pHi));
  }, [pool, spacing, rangeMode, flip]);

  // price of token0 in token1 (human units)
  const price = useMemo(() => {
    if (!pool || !pool.exists) return 0;
    const p = (Number(pool.sqrtPriceX96) / 2 ** 96) ** 2;
    return p * 10 ** (pool.decimals0 - pool.decimals1);
  }, [pool]);

  // Nudge a min/max price field by ~one tick-spacing (floored to 0.1%) — the
  // +/- steppers on the range inputs. Snaps to a usable tick on commit.
  function nudgePrice(which: 'min' | 'max', dir: 1 | -1) {
    const factor = 1 + Math.max(1.0001 ** spacing - 1, 0.001);
    const curStr = which === 'min' ? minStr : maxStr;
    const cur = parseFloat(curStr);
    const base = isFinite(cur) && cur > 0 ? cur : dispPrice(price);
    if (!(base > 0)) return;
    const next = dir > 0 ? base * factor : base / factor;
    (which === 'min' ? setMinStr : setMaxStr)(fmtPrice(next));
    setRangeMode('custom'); setSmartNote(null); setSwapPreview(null);
  }


  // Which side(s) the range needs at the current price.
  const need = useMemo(
    () => (pool && pool.exists && ticks ? addSide(pool.sqrtPriceX96, ticks.tickLower, ticks.tickUpper) : 'both'),
    [pool, ticks],
  );

  // Token USD prices — a missing one is derived from the pool price.
  const tokenUsd = useMemo(() => {
    if (!pool) return null;
    let p0 = usd[pool.token0.toLowerCase()];
    let p1 = usd[pool.token1.toLowerCase()];
    if (!p0 && p1 && price > 0) p0 = price * p1;
    if (!p1 && p0 && price > 0) p1 = p0 / price;
    return p0 && p1 ? { p0, p1 } : null;
  }, [pool, usd, price]);

  // Pool price vs independent market price. Uses the RAW usd map (not tokenUsd,
  // which back-fills a missing price FROM the pool price and would always agree)
  // so it only fires when both tokens have their own market quote. A big gap
  // means the pool is thin/stale/manipulated — depositing pairs your tokens at
  // THIS pool's ratio, so you'd be adding at an off-market rate (and are easy to
  // sandwich). This is the guardrail for "I added USDC and it converted wrong".
  const priceDeviation = useMemo(() => {
    if (!pool || !pool.exists || price <= 0) return null;
    const m0 = usd[pool.token0.toLowerCase()];
    const m1 = usd[pool.token1.toLowerCase()];
    if (!m0 || !m1) return null;
    const market = m0 / m1; // token0 priced in token1, from independent USD quotes
    if (!(market > 0)) return null;
    return price / market - 1; // signed: +ve = pool price above market
  }, [pool, usd, price]);

  // Deposit amounts. Normal mode: the user types EITHER token amount and the
  // other side is paired at the current price. Simulator mode: a USD amount is
  // split into both tokens at the ratio the range requires.
  const { add0, add1 } = useMemo(() => {
    const zero = { add0: 0n, add1: 0n };
    if (!pool || !pool.exists || !ticks) return zero;
    if (simOnly) {
      const target = parseFloat(simUsdStr);
      if (!isFinite(target) || target <= 0 || !tokenUsd) return zero;
      // unit liquidity → token amounts → USD value, then scale to the target
      const [a0, a1] = getAmountsForLiquidity(pool.sqrtPriceX96, ticks.tickLower, ticks.tickUpper, 10n ** 18n);
      const unitUsd = parseFloat(formatUnits(a0, pool.decimals0)) * tokenUsd.p0
        + parseFloat(formatUnits(a1, pool.decimals1)) * tokenUsd.p1;
      if (unitUsd <= 0) return zero;
      const k = BigInt(Math.round((target / unitUsd) * 1e6)); // 1e6 fixed-point scale
      return { add0: (a0 * k) / 1_000_000n, add1: (a1 * k) / 1_000_000n };
    }
    if (splitRange) {
      try {
        return {
          add0: splitAmt.str0 && parseFloat(splitAmt.str0) > 0 ? parseUnits(splitAmt.str0, pool.decimals0) : 0n,
          add1: splitAmt.str1 && parseFloat(splitAmt.str1) > 0 ? parseUnits(splitAmt.str1, pool.decimals1) : 0n,
        };
      } catch { return zero; }
    }
    if (!amt.str || parseFloat(amt.str) <= 0) return zero;
    try {
      const raw = parseUnits(amt.str, amt.side === 0 ? pool.decimals0 : pool.decimals1);
      const r = addAmounts(pool.sqrtPriceX96, ticks.tickLower, ticks.tickUpper, amt.side, raw);
      return { add0: r.amount0, add1: r.amount1 };
    } catch { return zero; }
  }, [pool, ticks, amt, simOnly, simUsdStr, tokenUsd, splitRange, splitAmt]);

  // ── Earnings simulation (Metrix-style) ─────────────────────────────────────
  // est. daily fees = pool's avg daily LP fees × your share of in-range
  // liquidity. Your liquidity comes from LiquidityAmounts math; the pool's
  // current in-range liquidity is read on-chain. Holds while price stays in
  // range and volume stays at recent levels.
  const sim = useMemo(() => {
    if (!pool || !pool.exists || !ticks || (add0 === 0n && add1 === 0n)) return null;
    // avg daily fees over the last complete 7 days (subgraph), else the list's 24h figure
    const todayBucket = Math.floor(Date.now() / 1000 / 86400) * 86400;
    const days = (history ?? []).filter((d) => d.date < todayBucket).slice(-7);
    const avgFees = days.length > 0 ? days.reduce((s, d) => s + d.feesUsd, 0) / days.length : fees24hUsd ?? 0;
    if (avgFees <= 0) return null;

    const inRange = addSide(pool.sqrtPriceX96, ticks.tickLower, ticks.tickUpper) === 'both';
    const L = liquidityForAmounts(pool.sqrtPriceX96, ticks.tickLower, ticks.tickUpper, add0, add1);
    const share = inRange && pool.liquidity + L > 0n ? Number(L) / Number(pool.liquidity + L) : 0;
    const daily = avgFees * share;

    // deposit value in USD
    const depositUsd = tokenUsd
      ? parseFloat(formatUnits(add0, pool.decimals0)) * tokenUsd.p0 + parseFloat(formatUnits(add1, pool.decimals1)) * tokenUsd.p1
      : 0;

    return {
      daily, monthly: daily * 30, yearly: daily * 365,
      apr: depositUsd > 0 ? (daily * 365 / depositUsd) * 100 : null,
      depositUsd, sharePct: share * 100, inRange,
    };
  }, [pool, ticks, add0, add1, history, fees24hUsd, tokenUsd]);

  // ── Backtest ────────────────────────────────────────────────────────────────
  // "What would THIS range have actually done over the last N days?" — replays
  // the pool's real daily price through the chosen range: fees only on in-range
  // days, netted against realised IL. Turns the forward guess into a grounded,
  // backward-looking number. Needs history + USD prices; otherwise hidden.
  const backtest = useMemo<BacktestResult | null>(() => {
    if (!pool || !pool.exists || !ticks || !history || history.length < 2 || !tokenUsd) return null;
    if (add0 === 0n && add1 === 0n) return null;
    const priceLower = tickToPrice(ticks.tickLower, pool.decimals0, pool.decimals1);
    const priceUpper = tickToPrice(ticks.tickUpper, pool.decimals0, pool.decimals1);
    const L = liquidityForAmounts(pool.sqrtPriceX96, ticks.tickLower, ticks.tickUpper, add0, add1);
    const depositUsd = parseFloat(formatUnits(add0, pool.decimals0)) * tokenUsd.p0
      + parseFloat(formatUnits(add1, pool.decimals1)) * tokenUsd.p1;
    return backtestRange({
      history: history.map((d) => ({ price0: d.price0, feesUsd: d.feesUsd, liquidity: d.liquidity })),
      priceLower, priceUpper,
      userLiquidity: Number(L),
      activeLiquidity: Number(pool.liquidity),
      depositUsd,
    });
  }, [pool, ticks, add0, add1, history, tokenUsd]);

  // wallet balances of both tokens (+ native ETH)
  useEffect(() => {
    let live = true;
    const client = getPublicClient(config, { chainId });
    if (!client || !address || !pool) return;
    (async () => {
      try {
        const [b0, b1] = await client.multicall({
          contracts: [
            { address: pool.token0, abi: erc20Abi, functionName: 'balanceOf', args: [address as `0x${string}`] },
            { address: pool.token1, abi: erc20Abi, functionName: 'balanceOf', args: [address as `0x${string}`] },
          ],
          allowFailure: true,
        });
        const eb = await client.getBalance({ address: address as `0x${string}` });
        if (live) {
          setBal0(b0.status === 'success' ? (b0.result as bigint) : 0n);
          setBal1(b1.status === 'success' ? (b1.result as bigint) : 0n);
          setEthBal(eb);
        }
      } catch { /* read failure — treat as unknown */ }
    })();
    return () => { live = false; };
  }, [config, address, pool]);

  const effBal0 = ethMode && nativeSide === 0 ? ethBal : bal0;
  const effBal1 = ethMode && nativeSide === 1 ? ethBal : bal1;
  // The simulator doesn't spend anything — wallet balances don't apply.
  const short0 = !simOnly && add0 > effBal0;
  const short1 = !simOnly && add1 > effBal1;

  async function mint() {
    if (splitRange) { await mintSplit(); return; }
    if (!address || !pool || !ticks) return;
    setBusy(true); setErr(null);
    try {
      const calls = v4Pool
        ? buildV4Mint({
            poolKey: v4Pool.poolKey,
            tickLower: ticks.tickLower, tickUpper: ticks.tickUpper,
            // V4 mints a liquidity amount; the maxes cap what the pool may pull.
            liquidity: liquidityForAmounts(pool.sqrtPriceX96, ticks.tickLower, ticks.tickUpper, add0, add1),
            amount0Max: maxIn(add0, slippageBps), amount1Max: maxIn(add1, slippageBps),
            recipient: address as `0x${string}`, deployment: v4Deployment,
          })
        : buildMint({
            token0: pool.token0, token1: pool.token1, fee,
            tickLower: ticks.tickLower, tickUpper: ticks.tickUpper,
            amount0Desired: add0, amount1Desired: add1,
            slippageBps: slippageBps, recipient: address as `0x${string}`,
            nativeEthSide: ethMode ? wethSide : null,
            deployment,
          });
      await runCalls(config, { account: address as `0x${string}`, calls, label: `Add ${pool.symbol0}/${pool.symbol1} liquidity`, track, chainId });
      onDone?.();
      onClose();
    } catch (e) {
      setErr((e as { shortMessage?: string })?.shortMessage ?? (e as Error)?.message ?? 'Failed');
    } finally { setBusy(false); }
  }

  /** Mint independent one-sided positions on either side of the live price. */
  async function mintSplit() {
    if (!address || !pool || !splitTicks || isV4) return;
    const hasBelow = add1 > 0n && splitTicks.below;
    const hasAbove = add0 > 0n && splitTicks.above;
    if (!hasBelow && !hasAbove) {
      setErr('Widen your selected range or enter an amount for an available side.');
      return;
    }
    setBusy(true); setErr(null);
    try {
      const calls = [
        ...(hasBelow ? buildMint({
          token0: pool.token0, token1: pool.token1, fee,
          tickLower: hasBelow.tickLower, tickUpper: hasBelow.tickUpper,
          amount0Desired: 0n, amount1Desired: add1, slippageBps,
          recipient: address as `0x${string}`, nativeEthSide: ethMode ? wethSide : null, deployment,
        }) : []),
        ...(hasAbove ? buildMint({
          token0: pool.token0, token1: pool.token1, fee,
          tickLower: hasAbove.tickLower, tickUpper: hasAbove.tickUpper,
          amount0Desired: add0, amount1Desired: 0n, slippageBps,
          recipient: address as `0x${string}`, nativeEthSide: ethMode ? wethSide : null, deployment,
        }) : []),
      ];
      await runCalls(config, { account: address as `0x${string}`, calls, label: `Add split ${pool.symbol0}/${pool.symbol1} liquidity`, track, chainId });
      onDone?.();
      onClose();
    } catch (e) {
      setErr((e as { shortMessage?: string })?.shortMessage ?? (e as Error)?.message ?? 'Failed');
    } finally { setBusy(false); }
  }

  /**
   * Create the position inside the user's fixed-owner BTB account and install
   * the owner-selected rebalance policy in the same account call. Account
   * creation, optional ETH wrapping and exact ERC-20 approvals are passed to
   * the shared batch runner, with a receipt-gated fallback for older wallets.
   */
  async function mintManaged() {
    if (!address || !pool || !ticks || !smartDeployment || isV4 || dex !== 'uniswap') return;
    if (splitRange && (!splitTicks?.below || !splitTicks?.above || add0 === 0n || add1 === 0n)) {
      setErr('Auto-managed uneven mode needs both token amounts and room for one range on each side of the live price.');
      return;
    }
    const client = getPublicClient(config, { chainId });
    if (!client) { setErr('No RPC client'); return; }
    const owner = address as `0x${string}`;
    setBusy(true); setStepMsg('Preparing smart account…'); setErr(null);
    try {
      const smart = await readSmartAccount(client, owner, smartDeployment);
      const specs = splitRange
        ? [
            {
              tickLower: splitTicks!.below!.tickLower, tickUpper: splitTicks!.below!.tickUpper,
              amount0Desired: 0n, amount1Desired: add1,
              amount0Min: 0n, amount1Min: minWithSlippage(add1, slippageBps),
            },
            {
              tickLower: splitTicks!.above!.tickLower, tickUpper: splitTicks!.above!.tickUpper,
              amount0Desired: add0, amount1Desired: 0n,
              amount0Min: minWithSlippage(add0, slippageBps), amount1Min: 0n,
            },
          ]
        : [{
            tickLower: ticks.tickLower, tickUpper: ticks.tickUpper,
            amount0Desired: add0, amount1Desired: add1,
            amount0Min: minWithSlippage(add0, slippageBps), amount1Min: minWithSlippage(add1, slippageBps),
          }];
      const allowedPct = automationRules.allowedRangePct !== null && automationRules.allowedRangePct < automationRules.targetRangePct ? automationRules.targetRangePct : automationRules.allowedRangePct;
      const allowed = rangeTicks(pool.tick, spacing, allowedPct);
      const automationTarget = rangeTicks(pool.tick, spacing, automationRules.targetRangePct);
      const policy: RebalancePolicy = {
        enabled: true,
        agent: smartDeployment.agent,
        positionManager: deployment.positionManager,
        uniswapFactory: deployment.factory,
        pool: pool.address,
        swapAdapter: smartDeployment.swapAdapter,
        priceGuard: smartDeployment.priceGuard,
        token0: pool.token0,
        token1: pool.token1,
        positionId: 0n,
        fee,
        targetTickWidth: automationTarget.tickUpper - automationTarget.tickLower,
        performanceFeeBps: 1_000,
        maxSlippageBps: slippageBps,
        maxSwapBpsOfPosition: automationRules.maxSwapPct * 100,
        maxSpotTwapDeviationBps: automationRules.maxDeviationPct * 100,
        twapSeconds: automationRules.twapSeconds,
        minRebalanceInterval: automationRules.intervalSeconds,
        expiresAt: BigInt(Math.floor(Date.now() / 1000) + automationRules.expiryDays * 86_400),
        minimumAllowedTick: Math.min(allowed.tickLower, ticks.tickLower),
        maximumAllowedTick: Math.max(allowed.tickUpper, ticks.tickUpper),
        // The relative max-swap rule is the useful owner control; uint128 max
        // avoids accidental lockouts after a position converts fully to one side.
        maximumToken0PerExecution: UINT128_MAX,
        maximumToken1PerExecution: UINT128_MAX,
      };
      const beforeCount = await client.readContract({
        address: deployment.positionManager, abi: NPM_ABI, functionName: 'balanceOf', args: [smart.account],
      }).catch(() => 0n);
      const calls = [
        ...(!smart.deployed ? [createAccountCall(smartDeployment, owner)] : []),
        ...(ethMode && wethSide === 0 ? [wrapEthCall(chainWeth, add0)] : []),
        ...(ethMode && wethSide === 1 ? [wrapEthCall(chainWeth, add1)] : []),
        approvalCall(pool.token0, smart.account, add0),
        approvalCall(pool.token1, smart.account, add1),
        fundAndCreateCall(smart.account, {
          pool: pool.address,
          token0: pool.token0,
          token1: pool.token1,
          fee,
          deadline: BigInt(Math.floor(Date.now() / 1000) + 8 * 60),
          mode: splitRange ? 1 : 0,
          specs,
        }, policy),
      ].filter((call): call is NonNullable<typeof call> => call !== null);
      setStepMsg(splitRange ? 'Creating two managed LPs…' : 'Creating managed LP…');
      await runCalls(config, {
        account: owner,
        calls,
        label: `Create managed ${pool.symbol0}/${pool.symbol1} LP`,
        track,
        chainId,
        verify: {
          test: async () => (await client.readContract({ address: deployment.positionManager, abi: NPM_ABI, functionName: 'balanceOf', args: [smart.account] })) > beforeCount,
          error: 'The managed position was confirmed but is not visible from this RPC yet.',
        },
      });
      onDone?.();
      onClose();
    } catch (e) {
      setErr((e as { shortMessage?: string })?.shortMessage ?? (e as Error)?.message ?? 'Failed');
    } finally { setBusy(false); setStepMsg(''); }
  }

  /**
   * Balanced smart-fit deposit: swap only the gap (KyberSwap) so a single-token
   * wallet deposits a real two-sided position, then mint. Same audited pattern
   * as RebalanceSheet (minus the withdraw — funds come straight from the wallet).
   * Confirms up to two wallet txs (swap, then add). V4 native ETH (currency0) is
   * swapped/deposited as ETH with a gas reserve; V3 deposits the ERC-20 tokens.
   */
  async function mintBalanced() {
    if (!address || !pool || !ticks) return;
    const acct = address as `0x${string}`;
    const native0 = isV4 && nativeSide === 0; // V4 currency0 == native ETH
    const readBals = async (): Promise<[bigint, bigint]> => {
      const client = getPublicClient(config, { chainId });
      if (!client) throw new Error('No RPC client');
      const erc = native0 ? [pool.token1] : [pool.token0, pool.token1];
      const res = await client.multicall({
        contracts: erc.map((a) => ({ address: a, abi: erc20Abi, functionName: 'balanceOf' as const, args: [acct] as const })),
        allowFailure: true,
      });
      const get = (r: (typeof res)[number] | undefined) => (r && r.status === 'success' ? (r.result as bigint) : 0n);
      if (native0) return [await client.getBalance({ address: acct }), get(res[0])];
      return [get(res[0]), get(res[1])];
    };

    setBusy(true); setErr(null);
    try {
      const tl = ticks.tickLower, tu = ticks.tickUpper;
      const [live0, live1] = await readBals();
      // Deposit the whole balance; keep a gas reserve on the native side.
      let budget0 = native0 ? (live0 > GAS_RESERVE ? live0 - GAS_RESERVE : 0n) : live0;
      let budget1 = live1;

      const plan = rebalancePlan(pool.sqrtPriceX96, tl, tu, budget0, budget1);
      if (plan.sellSide !== null) {
        const swap = await buildSwapGap({
          sellSide: plan.sellSide, swapFraction: plan.swapFraction,
          budget0, budget1, token0: pool.token0, token1: pool.token1,
          decimals0: pool.decimals0, decimals1: pool.decimals1,
          native0, account: acct, slippageBps: slippageBps,
        });
        if (swap) {
          setStepMsg('Swapping only what the range needs…');
          await runCalls(config, { account: acct, calls: swap.calls, label: `Balance ${pool.symbol0}/${pool.symbol1}`, track, chainId });
          budget0 = swap.budget0;
          budget1 = swap.budget1;
        }
      }

      // Mint with the rebalanced budget, capped to the live wallet balance so an
      // optimistic swap quote can't over-deposit.
      setStepMsg('Adding your liquidity…');
      const [bal0, bal1] = await readBals();
      const cap0 = native0 ? (bal0 > GAS_RESERVE ? ((bal0 - GAS_RESERVE) * 9950n) / 10_000n : 0n) : bal0;
      const eff0 = budget0 < cap0 ? budget0 : cap0;
      const eff1 = budget1 < bal1 ? budget1 : bal1;
      const L = liquidityForAmounts(pool.sqrtPriceX96, tl, tu, eff0, eff1);
      const a0 = eff0, a1 = eff1;
      if (L === 0n) throw new Error('Nothing left to deposit after the swap');
      const calls = v4Pool
        ? buildV4Mint({
            poolKey: v4Pool.poolKey, tickLower: tl, tickUpper: tu, liquidity: L,
            amount0Max: maxIn(a0, slippageBps), amount1Max: maxIn(a1, slippageBps), recipient: acct, deployment: v4Deployment,
          })
        : buildMint({
            token0: pool.token0, token1: pool.token1, fee, tickLower: tl, tickUpper: tu,
            amount0Desired: a0, amount1Desired: a1, slippageBps: slippageBps, recipient: acct,
            nativeEthSide: null, deployment,
          });
      await runCalls(config, { account: acct, calls, label: `Add ${pool.symbol0}/${pool.symbol1} liquidity`, track, chainId });
      onDone?.();
      onClose();
    } catch (e) {
      setErr((e as { shortMessage?: string })?.shortMessage ?? (e as Error)?.message ?? 'Failed');
    } finally { setBusy(false); setStepMsg(''); }
  }

  const canSplit = !!splitTicks && ((add0 > 0n && !!splitTicks.above) || (add1 > 0n && !!splitTicks.below));
  const canManagedSplit = !!splitTicks?.below && !!splitTicks?.above && add0 > 0n && add1 > 0n;
  const canMint = !!pool?.exists && !!ticks && !busy &&
    (autoManage
      ? !!smartDeployment && !swapPreview && (splitRange ? canManagedSplit : add0 > 0n || add1 > 0n) && !short0 && !short1
      : splitRange ? canSplit && !short0 && !short1 : swapPreview ? true : (add0 > 0n || add1 > 0n) && !short0 && !short1);

  // Simulator → real deposit. Hooked V4 pools can't be minted in-app, so the
  // CTA is hidden for them. The simulated amounts prefill the deposit inputs.
  const canSwitchToAdd = !isV4 || (!!v4Pool && isNativeCurrency(v4Pool.hooks));
  function switchToAdd() {
    if (pool && (add0 > 0n || add1 > 0n)) {
      const side: 0 | 1 = need === 'token1' ? 1 : 0;
      const raw = side === 0 ? add0 : add1;
      if (raw > 0n) setAmt({ side, str: formatUnits(raw, side === 0 ? pool.decimals0 : pool.decimals1) });
    }
    setSimOnly(false);
    setTab('deposit'); // the range was already chosen in the simulator
  }

  /**
   * Smart fit: re-place the chosen range width so the wallet's balances
   * deposit cleanly (shifts the band when the ratio is off; goes single-sided
   * next to the current price when only one token is held), then prefills the
   * anchor side with its full balance.
   */
  function applySmartFit(strategyOverride?: 'balanced' | 'single') {
    if (!pool || !pool.exists || !ticks) return;
    const strat = strategyOverride ?? smartStrategy;
    setSwapPreview(null);
    const fitBal0 = ethMode && nativeSide === 0 ? (effBal0 > GAS_RESERVE ? effBal0 - GAS_RESERVE : 0n) : effBal0;
    const fitBal1 = ethMode && nativeSide === 1 ? (effBal1 > GAS_RESERVE ? effBal1 - GAS_RESERVE : 0n) : effBal1;
    // Full range can't be re-placed — fit a ±10% band instead.
    const base = rangeMode === null ? rangeTicks(pool.tick, spacing, 10) : ticks;
    const width = base.tickUpper - base.tickLower;

    // Exactly one pool token held → the range would otherwise go single-sided.
    const singleToken = (fitBal0 <= 0n) !== (fitBal1 <= 0n);
    // The balanced swap reads ERC-20 balances (+ native ETH only on a V4 native
    // pool). A V3 pool paid with native ETH isn't covered, so keep it single-sided.
    const heldSide: 0 | 1 = fitBal0 > 0n ? 0 : 1;
    const heldNativeEthV3 = !isV4 && ethMode && wethSide === heldSide;

    // BALANCED (default for a single-token wallet): centre the band on the price
    // and swap only the gap so BOTH sides deposit — a real two-sided LP that
    // stays ~50/50 instead of a directional "convert my token" position.
    if (singleToken && strat === 'balanced' && !heldNativeEthV3) {
      const half = Math.max(Math.round(width / 2 / spacing), 1) * spacing;
      const tickLower = nearestUsableTick(pool.tick - half, spacing);
      let tickUpper = nearestUsableTick(pool.tick + half, spacing);
      if (tickUpper <= tickLower) tickUpper = tickLower + spacing;
      const plan = rebalancePlan(pool.sqrtPriceX96, tickLower, tickUpper, fitBal0, fitBal1);
      setRangeMode({ tickLower, tickUpper });
      if (plan.sellSide === null || plan.swapFraction <= 0.0005) {
        // No swap needed — deposit the held side directly via the normal path.
        setAmt({ side: heldSide, str: formatUnits(heldSide === 0 ? fitBal0 : fitBal1, heldSide === 0 ? pool.decimals0 : pool.decimals1) });
        setSmartNote('Your balance already matches a centered range — both sides deposit, no swap needed.');
        return;
      }
      setAmt({ side: 0, str: '' }); // balanced flow deposits the post-swap budget, not a typed amount
      const sellBudget = plan.sellSide === 0 ? fitBal0 : fitBal1;
      const bps = Math.min(10_000, Math.max(0, Math.round(plan.swapFraction * 10_000)));
      const sellRaw = (sellBudget * BigInt(bps)) / 10_000n;
      const sym = plan.sellSide === 0 ? sym0 : sym1;
      const otherSym = plan.sellSide === 0 ? sym1 : sym0;
      setSwapPreview({ sellSide: plan.sellSide, sellRaw, sym, otherSym, pct: plan.swapFraction * 100 });
      setSmartNote(`Balanced: swaps ~${plan.swapFraction * 100 < 1 ? '<1' : Math.round(plan.swapFraction * 100)}% of your ${sym} to ${otherSym} so both sides deposit and stay ~50/50 — earns fees now, no directional conversion.`);
      return;
    }

    const fit = fitRangeToBalances(pool.sqrtPriceX96, pool.tick, width, spacing, fitBal0, fitBal1);
    if (!fit) { setSmartNote('Nothing to fit — your wallet holds neither pool token.'); return; }
    setRangeMode({ tickLower: fit.tickLower, tickUpper: fit.tickUpper });
    const bal = fit.side === 0 ? fitBal0 : fitBal1;
    setAmt({ side: fit.side, str: formatUnits(bal, fit.side === 0 ? pool.decimals0 : pool.decimals1) });
    const sym = fit.side === 0 ? sym0 : sym1;
    const other = fit.side === 0 ? sym1 : sym0;
    setSmartNote(fit.single
      ? `Single-sided: deposits ${sym} only. As price enters the range it converts to ${other} — you'd finish holding ${other}, not ${sym}. Directional, not a balanced LP.`
      : 'Range shifted to match your balances — both tokens deposit in full, same width.');
  }

  const inputStyle = (disabled: boolean): CSSProperties => ({
    width: '100%', height: 42, background: disabled ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '0 12px',
    color: disabled ? btb.textDim : btb.text, fontSize: 15, fontWeight: 700, fontFamily: 'inherit',
    outline: 'none', boxSizing: 'border-box',
  });

  // +/- stepper button for the min/max price inputs.
  const stepBtn: CSSProperties = {
    flex: 1, borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 15, fontWeight: 800, lineHeight: 1,
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: btb.textMuted,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
  };

  /** A compact, chart-free view of the selected price band and live price. */
  function renderRangeBar() {
    const low = parseFloat(minStr);
    const high = parseFloat(maxStr);
    const current = dispPrice(price);
    if (!(current > 0)) {
      return (
        <div style={{ marginBottom: 22 }}>
          <div style={{ color: btb.text, fontSize: 14, fontWeight: 750, marginBottom: 12 }}>Price range</div>
          <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.12)' }} />
          <div style={{ color: btb.textDim, fontSize: 11, marginTop: 8 }}>Loading current price…</div>
        </div>
      );
    }

    // Preserve the broad scale for normal ranges, but zoom only when a tight
    // selection would make the two handles difficult to grab.
    const isFull = rangeMode === null;
    const safeLow = isFull ? current / 100 : (isFinite(low) && low > 0 ? low : current / 100);
    const safeHigh = isFull ? current * 100 : (isFinite(high) && high > safeLow ? high : current * 100);
    const rangeLogWidth = Math.log(safeHigh / safeLow);
    const contentLow = Math.min(Math.log(safeLow), Math.log(current));
    const contentHigh = Math.max(Math.log(safeHigh), Math.log(current));
    const normalPadding = Math.log(1.15);
    const normalSpan = contentHigh - contentLow + normalPadding * 2;
    const normalRangeShare = rangeLogWidth / normalSpan;
    // Keep a tight selected band at ~28% of the track; ordinary ranges retain
    // the original 15% context on each side.
    const edgePadding = !isFull && normalRangeShare < 0.12
      ? Math.max(0.001, (rangeLogWidth / 0.28 - (contentHigh - contentLow)) / 2)
      : normalPadding;
    const domainLow = Math.exp(contentLow - edgePadding);
    const domainHigh = Math.exp(contentHigh + edgePadding);
    const logSpan = Math.log(domainHigh / domainLow) || 1;
    const pct = (value: number) => Math.max(0, Math.min(100, ((Math.log(value / domainLow) / logSpan) * 100)));
    const left = pct(safeLow);
    const right = pct(safeHigh);
    const currentPct = pct(current);
    const inRange = isFull || (current >= safeLow && current <= safeHigh);
    const lowerDistance = (safeLow / current - 1) * 100;
    const upperDistance = (safeHigh / current - 1) * 100;
    const fmtDistance = (value: number) => `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(value >= -1 && value <= 1 ? 2 : 1)}%`;
    const setCustomRange = (nextLow: number, nextHigh: number) => {
      setRangeMode('custom'); setSmartNote(null); setSwapPreview(null);
      setMinStr(fmtPrice(nextLow)); setMaxStr(fmtPrice(nextHigh));
    };
    const beginDrag = (e: ReactPointerEvent<HTMLDivElement>, target: 'low' | 'high' | 'band') => {
      e.preventDefault(); e.stopPropagation();
      rangeDrag.current = {
        pointerId: e.pointerId, target, startX: e.clientX,
        domainLow, domainHigh, low: safeLow, high: safeHigh,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
    };
    const moveDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
      const drag = rangeDrag.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      const width = e.currentTarget.getBoundingClientRect().width;
      if (width <= 0) return;
      const logDomainLow = Math.log(drag.domainLow);
      const logSpan = Math.log(drag.domainHigh / drag.domainLow);
      const xToPrice = (x: number) => Math.exp(logDomainLow + Math.max(0, Math.min(1, x / width)) * logSpan);
      const pointerPrice = xToPrice(e.clientX - e.currentTarget.getBoundingClientRect().left);
      if (drag.target === 'low') {
        setCustomRange(Math.min(pointerPrice, drag.high / 1.001), drag.high);
      } else if (drag.target === 'high') {
        setCustomRange(drag.low, Math.max(pointerPrice, drag.low * 1.001));
      } else {
        const shift = (e.clientX - drag.startX) / width * logSpan;
        setCustomRange(Math.exp(Math.log(drag.low) + shift), Math.exp(Math.log(drag.high) + shift));
      }
    };
    const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
      if (rangeDrag.current?.pointerId === e.pointerId) rangeDrag.current = null;
    };

    return (
      <div style={{ marginBottom: 22 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <span style={{ color: btb.text, fontSize: 14, fontWeight: 750 }}>Price range</span>
          <span style={{ color: inRange ? btb.green : '#FFB36B', fontSize: 11, fontWeight: 700 }}>
            {isFull ? 'Full range' : `Range ${fmtDistance(lowerDistance)} / ${fmtDistance(upperDistance)}`}
          </span>
        </div>
        <div
          onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}
          style={{ position: 'relative', height: 32, display: 'flex', alignItems: 'center', touchAction: 'none' }}>
          <div style={{ position: 'absolute', left: 0, right: 0, height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.12)' }} />
          <div onPointerDown={(e) => beginDrag(e, 'band')} title="Drag to move range" style={{ position: 'absolute', left: `${left}%`, width: `${Math.max(1, right - left)}%`, height: 6, borderRadius: 999, background: btb.green, cursor: 'grab' }} />
          <div onPointerDown={(e) => beginDrag(e, 'low')} aria-label="Lower price bound" style={{ position: 'absolute', left: `calc(${left}% - 8px)`, width: 16, height: 16, borderRadius: 999, background: btb.bg, border: `2px solid ${btb.green}`, boxSizing: 'border-box', cursor: 'ew-resize' }} />
          <div onPointerDown={(e) => beginDrag(e, 'high')} aria-label="Upper price bound" style={{ position: 'absolute', left: `calc(${right}% - 8px)`, width: 16, height: 16, borderRadius: 999, background: btb.bg, border: `2px solid ${btb.green}`, boxSizing: 'border-box', cursor: 'ew-resize' }} />
          <div title="Current price" style={{ pointerEvents: 'none', position: 'absolute', left: `calc(${currentPct}% - 1px)`, top: 2, width: 2, height: 28, borderRadius: 2, background: btb.text }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 6, color: btb.textMuted, fontSize: 12, fontWeight: 650 }}>
          <span>{isFull ? '0' : `${fmtPrice(safeLow)} (${fmtDistance(lowerDistance)})`}</span>
          <span>{isFull ? '∞' : `${fmtPrice(safeHigh)} (${fmtDistance(upperDistance)})`}</span>
        </div>
      </div>
    );
  }

  // Plain render helper (NOT a nested component — a nested component type would
  // remount the <input> on every keystroke and drop focus).
  function renderAmountInput(side: 0 | 1) {
    if (!pool) return null;
    const sym = side === 0 ? sym0 : sym1;
    const dec = side === 0 ? pool.decimals0 : pool.decimals1;
    const bal = side === 0 ? effBal0 : effBal1;
    const computed = side === 0 ? add0 : add1;
    const isShort = side === 0 ? short0 : short1;
    // The range may only take one token — the other side stays at 0.
    const disabled = !splitRange && need === (side === 0 ? 'token1' : 'token0');
    const value = splitRange ? (side === 0 ? splitAmt.str0 : splitAmt.str1) : disabled ? '0' : amt.side === side ? amt.str : computed > 0n ? formatUnits(computed, dec) : '';
    const unitUsd = side === 0 ? tokenUsd?.p0 : tokenUsd?.p1;
    const num = parseFloat(value);
    const usdVal = unitUsd && isFinite(num) ? num * unitUsd : 0;
    // Compact Orca-style card: amount + token on one row, $value + balance below.
    return (
      <div key={side} style={{
        marginBottom: 8, padding: '9px 12px', borderRadius: 14,
        background: disabled ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            value={value}
            disabled={disabled}
            onChange={(e) => {
              const str = e.target.value.replace(/[^0-9.]/g, '');
              if (splitRange) setSplitAmt((v) => side === 0 ? { ...v, str0: str } : { ...v, str1: str });
              else { setAmt({ side, str }); setSwapPreview(null); }
            }}
            inputMode="decimal" placeholder="0"
            style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', padding: 0, color: disabled ? btb.textDim : btb.text, fontSize: 20, fontWeight: 700, fontFamily: 'inherit' }}/>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <TokenIcon symbol={sym} size={20} />
            {wethSide === side && !isV4 ? (
              <div aria-label="Choose ETH or WETH" style={{ display: 'flex', padding: 2, borderRadius: 8, background: 'rgba(255,255,255,0.08)' }}>
                {([['ETH', true], ['WETH', false]] as const).map(([label, active]) => (
                  <button key={label} type="button" onClick={() => setUseEth(active)} style={{
                    height: 24, padding: '0 7px', border: 0, borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
                    color: useEth === active ? '#07110D' : btb.textMuted,
                    background: useEth === active ? btb.green : 'transparent', fontSize: 10.5, fontWeight: 800,
                  }}>{label}</button>
                ))}
              </div>
            ) : (
              <span style={{ color: btb.text, fontSize: 14, fontWeight: 700 }}>{sym}</span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 3 }}>
          <span style={{ color: btb.textDim, fontSize: 11 }}>
            {usdVal > 0 ? `$${usdVal.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : disabled ? 'not needed in this range' : ''}
          </span>
          <span style={{ color: btb.textMuted, fontSize: 11 }}>
            {fmtAmt(bal, dec)}
            {isShort && !splitRange && (
              <span onClick={() => applySmartFit()} style={{ color: '#52E3A4', fontWeight: 800, marginLeft: 8, cursor: 'pointer', padding: '3px 6px', borderRadius: 6, background: 'rgba(82,227,164,0.13)' }}>FIT RANGE</span>
            )}
            {!disabled && (
              <span onClick={() => splitRange ? setSplitAmt((v) => side === 0 ? { ...v, str0: formatUnits(bal, dec) } : { ...v, str1: formatUnits(bal, dec) }) : setAmt({ side, str: formatUnits(bal, dec) })} style={{ color: btb.red, fontWeight: 700, marginLeft: 6, cursor: 'pointer' }}>MAX</span>
            )}
          </span>
        </div>
      </div>
    );
  }

  function toggleUnevenAmounts() {
    if (!pool) return;
    if (!splitRange) {
      // Seed the independent fields from exactly what the regular deposit cards
      // currently show, including the automatically paired side.
      setSplitAmt({
        str0: add0 > 0n ? formatUnits(add0, pool.decimals0) : '',
        str1: add1 > 0n ? formatUnits(add1, pool.decimals1) : '',
      });
      setSplitRange(true);
    } else {
      // Returning to ratio-matched mode can only have one driving input. Keep
      // the side the user was editing when possible, otherwise the non-empty one.
      const preferred = amt.side === 0 ? splitAmt.str0 : splitAmt.str1;
      const fallbackSide: 0 | 1 = splitAmt.str0 ? 0 : 1;
      setAmt(preferred
        ? { side: amt.side, str: preferred }
        : { side: fallbackSide, str: fallbackSide === 0 ? splitAmt.str0 : splitAmt.str1 });
      setSplitRange(false);
    }
    setSwapPreview(null);
  }

  // Shared result blocks — rendered on the simulator's single page AND on the
  // add flow's deposit step (plain functions, same reason as renderAmountInput).
  function renderNeedWarning() {
    if (!pool || need === 'both') return null;
    const inSym = need === 'token0' ? sym0 : sym1;   // token deposited now
    const outSym = need === 'token0' ? sym1 : sym0;   // token you end up holding
    return (
      <div style={{ color: '#FFB36B', fontSize: 12, marginBottom: 10, lineHeight: 1.5 }}>
        Current price is outside this range — this is a single-sided {inSym} position. It deposits {inSym} only and earns no fees until the price reaches the range. Once it does, your {inSym} is swapped into {outSym} as the price passes through — you&apos;d finish holding {outSym}, not {inSym}. Only place this if you actually want to convert {inSym}→{outSym}.
      </div>
    );
  }

  /** Loud warning when the pool price is materially off the market price. */
  function renderPriceDeviationWarning() {
    if (priceDeviation === null || Math.abs(priceDeviation) < 0.02) return null;
    const pct = Math.abs(priceDeviation) * 100;
    const dir = priceDeviation > 0 ? 'above' : 'below';
    const severe = pct >= 5;
    return (
      <div style={{
        color: severe ? btb.loss : '#FFB36B', fontSize: 12, marginBottom: 10, lineHeight: 1.5,
        background: severe ? 'rgba(255,107,122,0.08)' : 'rgba(255,179,107,0.08)',
        border: `1px solid ${severe ? 'rgba(255,107,122,0.3)' : 'rgba(255,179,107,0.3)'}`,
        borderRadius: 12, padding: '10px 12px',
      }}>
        ⚠️ This pool&apos;s price is <b>{pct < 1 ? '<1' : pct.toFixed(1)}% {dir}</b> the market price ({pool ? `${sym0} vs ${sym1}` : ''}). Your liquidity is added at the <b>pool&apos;s</b> price, not the market&apos;s — on a thin, stale, or manipulated pool this means depositing at an off-market rate, and the position can be sandwiched. Double-check the pool and amounts before continuing.
      </div>
    );
  }

  function renderDepositSummary() {
    if (!pool || (add0 === 0n && add1 === 0n)) return null;
    const v0 = tokenUsd ? parseFloat(formatUnits(add0, pool.decimals0)) * tokenUsd.p0 : 0;
    const v1 = tokenUsd ? parseFloat(formatUnits(add1, pool.decimals1)) * tokenUsd.p1 : 0;
    const total = v0 + v1;
    const pct0 = total > 0 ? (v0 / total) * 100 : 0;
    const pct1 = total > 0 ? (v1 / total) * 100 : 0;
    return (
      <Glass padding={12} radius={12} soft>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
          <span style={{ color: btb.textMuted, fontSize: 12 }}>{simOnly ? 'You’d deposit' : 'You deposit'}</span>
          {total > 0 && <span style={{ color: btb.text, fontSize: 13, fontWeight: 800 }}>${total.toLocaleString('en-US', { maximumFractionDigits: 2 })} total</span>}
        </div>
        <div style={{ color: btb.text, fontSize: 14, fontWeight: 700 }}>
          {fmtAmt(add0, pool.decimals0)} {sym0} + {fmtAmt(add1, pool.decimals1)} {sym1}
        </div>
        {total > 0 && (
          <>
            <div style={{ display: 'flex', height: 6, borderRadius: 999, overflow: 'hidden', marginTop: 8, background: 'rgba(255,255,255,0.06)' }}>
              <div style={{ width: `${pct0}%`, background: '#52E3A4' }} />
              <div style={{ width: `${pct1}%`, background: '#5B8DEF' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, color: btb.textMuted, fontSize: 11 }}>
              <span><span style={{ color: '#52E3A4' }}>●</span> {sym0} {pct0.toFixed(1)}%</span>
              <span>{sym1} {pct1.toFixed(1)}% <span style={{ color: '#5B8DEF' }}>●</span></span>
            </div>
          </>
        )}
      </Glass>
    );
  }

  /** Backward-looking backtest of the selected range over the pool's real price. */
  function renderBacktest() {
    if (!backtest) return null;
    const b = backtest;
    const money = (v: number) => `${v < 0 ? '−' : ''}$${Math.abs(v) >= 100 ? Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 0 }) : Math.abs(v).toFixed(2)}`;
    const cell = (label: string, value: string, color: string) => (
      <div style={{ flex: 1, background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '8px 10px' }}>
        <div style={{ color: btb.textDim, fontSize: 10 }}>{label}</div>
        <div style={{ color, fontSize: 14, fontWeight: 800 }}>{value}</div>
      </div>
    );
    return (
      <Glass padding={12} radius={12} soft style={{ marginTop: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ color: btb.textMuted, fontSize: 12 }}>Historical daily-snapshot replay · last {b.days} days</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {cell('Estimated fees', money(b.feesUsd), '#52E3A4')}
          {cell('LP vs holding', `${b.ilFraction < 0 ? '−' : '+'}${Math.abs(b.ilFraction * 100).toFixed(2)}%`, b.ilFraction < 0 ? '#FFB36B' : btb.text)}
          {cell('Period fee return', `${((b.feesUsd / Math.max(b.depositUsd, 1)) * 100).toFixed(2)}%`, '#52E3A4')}
        </div>
        <div style={{ color: btb.textDim, fontSize: 10, marginTop: 8, lineHeight: 1.4 }}>
          Price closed inside your range <b>{b.daysInRange}/{b.days} days</b>. Fees are estimated from historical pool fees and daily liquidity. LP vs holding is the fixed-range price-only comparison, not a realised wallet loss. Period return is not APR.
        </div>
      </Glass>
    );
  }

  function renderEarnings() {
    if (!sim || !sim.inRange || sim.daily <= 0) return null;
    const total = sim.daily * simDays;
    // overflow visible so the period dropdown can extend below this now
    // single-row card (Glass clips by default)
    return (
      <Glass padding={12} radius={12} soft style={{ marginTop: 10, overflow: 'visible' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span style={{ color: btb.textMuted, fontSize: 12 }}>Earnings</span>
            {/* Projection-period dropdown */}
            <div style={{ position: 'relative' }}>
              <button onClick={() => setYieldOpen(o => !o)} style={{
                cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, fontWeight: 800, color: '#52E3A4',
                background: 'rgba(82,227,164,0.14)', border: '1px solid rgba(82,227,164,0.4)', borderRadius: 8, padding: '3px 8px',
              }}>{YIELD_PERIODS.find(p => p.d === simDays)?.label ?? '1 month'} ▾</button>
              {yieldOpen && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 10, minWidth: 118,
                  background: 'rgba(18,18,26,0.98)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10,
                  padding: 4, boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                }}>
                  {YIELD_PERIODS.map(p => (
                    <div key={p.d} onClick={() => { setSimDays(p.d); setYieldOpen(false); }} style={{
                      padding: '7px 10px', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                      color: simDays === p.d ? '#52E3A4' : btb.text,
                      background: simDays === p.d ? 'rgba(82,227,164,0.12)' : 'transparent',
                    }}>{p.label}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ color: '#52E3A4', fontSize: 16, fontWeight: 800, letterSpacing: -0.3 }}>
              ${total >= 100 ? total.toLocaleString('en-US', { maximumFractionDigits: 0 }) : total.toFixed(2)}
            </span>
            {sim.apr !== null && (
              <span style={{ color: btb.textDim, fontSize: 11, fontWeight: 700 }}>~{sim.apr.toFixed(1)}% APR</span>
            )}
          </div>
        </div>

        {feeSplit && feeSplit.protocolPct === 0 && isV4 && (
          <div style={{ marginTop: 8, color: btb.green, fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="check" size={12} color={btb.green} /> No protocol fee on V4. You keep 100% of swap fees.
          </div>
        )}
      </Glass>
    );
  }

  return (
    <Portal>
    <div style={{ position: 'fixed', top: 0, left: sidebarWidth, right: 0, bottom: 0, zIndex: 340, background: btb.bg, overflowY: 'auto' }}>
      <div style={{ width: '100%', padding: isMobile ? '14px 14px 96px' : '16px 24px 88px' }}>
        {/* Compact single-row header: back chevron + title, pair/dex as an
            inline subtitle — keeps the tap-to-go-back affordance without the
            tall "Back to Discover" stack eating the top of small screens. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div onClick={onClose} title="Back to Discover" style={{
            width: 30, height: 30, borderRadius: 999, flexShrink: 0, cursor: 'pointer',
            background: 'rgba(255,255,255,0.08)', border: btb.borderSoft,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="back" size={14} color={btb.textMuted}/>
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ color: btb.text, fontSize: 19, fontWeight: 800, letterSpacing: -0.4, lineHeight: 1.1 }}>{simOnly ? 'Simulate LP earnings' : 'Add liquidity'}</div>
            <div style={{ color: btb.textMuted, fontSize: 12.5, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {pool ? `${flip ? pool.symbol1 : pool.symbol0} / ${flip ? pool.symbol0 : pool.symbol1} · ${fmtFeeTier(fee)} · ${dexLabel}` : `${dexLabel} · Ethereum`}
            </div>
          </div>
        </div>

        {loadingPool ? (
          <div style={{ color: btb.textDim, fontSize: 13, padding: '8px 0' }}>Checking pool…</div>
        ) : poolErr ? (
          <div style={{ padding: '8px 0' }}>
            <div style={{ color: btb.loss, fontSize: 13 }}>Couldn&apos;t load the pool — {poolErr}</div>
            <button onClick={() => setRetryNonce((n) => n + 1)} style={{
              marginTop: 10, height: 36, padding: '0 18px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 13, fontWeight: 700, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.16)', color: btb.text,
            }}>Retry</button>
          </div>
        ) : !pool?.exists ? (
          <div style={{ color: '#FFB36B', fontSize: 13, padding: '8px 0' }}>
            {isV4 ? 'This pool can’t be minted in-app yet — manage it on Uniswap.' : 'No pool at this fee tier — try another.'}
          </div>
        ) : (
          <>
            {/* Simulator: how much to invest comes first, results update live below */}
            {simOnly && (
              <>
                <div style={{ color: btb.textMuted, fontSize: 12, marginBottom: 6 }}>How much would you invest? (USD)</div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  {[100, 1000, 10000].map((v) => (
                    <button key={v} onClick={() => setSimUsdStr(String(v))} style={{
                      flex: 1, height: 38, borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                      background: simUsdStr === String(v) ? 'rgba(82,227,164,0.18)' : 'rgba(255,255,255,0.05)',
                      border: `1px solid ${simUsdStr === String(v) ? 'rgba(82,227,164,0.5)' : 'rgba(255,255,255,0.1)'}`,
                      color: simUsdStr === String(v) ? '#52E3A4' : btb.textMuted,
                    }}>${v.toLocaleString('en-US')}</button>
                  ))}
                </div>
                <div style={{ position: 'relative', marginBottom: 16 }}>
                  <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: btb.textMuted, fontSize: 18, fontWeight: 700 }}>$</span>
                  <input
                    value={simUsdStr}
                    onChange={(e) => setSimUsdStr(e.target.value.replace(/[^0-9.]/g, ''))}
                    inputMode="decimal" placeholder="1000"
                    style={{ ...inputStyle(false), paddingLeft: 30 }}/>
                </div>
                {!tokenUsd && (
                  <div style={{ color: '#FFB36B', fontSize: 12, marginBottom: 10 }}>
                    No USD price data for this pair yet — try again in a moment.
                  </div>
                )}
              </>
            )}

            <div style={{
              width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.025)',
              border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, padding: isMobile ? 14 : 22,
            }}>
            {/* Current price + flip */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
              <span style={{ color: btb.textMuted, fontSize: 12 }}>
                1 {qBase} = {dispPrice(price).toLocaleString('en-US', { maximumSignificantDigits: 6 })} {qQuote}
              </span>
              <button onClick={toggleFlip} title="Flip which token prices are quoted in" style={{
                flexShrink: 0, height: 26, padding: '0 8px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 11, fontWeight: 700, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.14)', color: btb.textMuted,
              }}>⇄ {qQuote}/{qBase}</button>
            </div>
            {renderRangeBar()}

            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              {RANGE_PRESETS.map((r) => (
                <button key={r.label} onClick={() => { setRangeMode(r.pct); setSmartNote(null); setSwapPreview(null); }} style={{
                  flex: 1, height: 38, borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                  background: rangeMode === r.pct ? 'rgba(82,227,164,0.18)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${rangeMode === r.pct ? 'rgba(82,227,164,0.5)' : 'rgba(255,255,255,0.1)'}`,
                  color: rangeMode === r.pct ? '#52E3A4' : btb.textMuted,
                }}>{r.label}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 6 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: btb.textDim, fontSize: 11, marginBottom: 4 }}>Min price ({qQuote} per {qBase})</div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'stretch' }}>
                  <input value={minStr} inputMode="decimal" placeholder="0"
                    onChange={(e) => { setMinStr(e.target.value); setRangeMode('custom'); setSmartNote(null); setSwapPreview(null); }}
                    style={{ ...inputStyle(false), height: 44, fontSize: 15, flex: 1, minWidth: 0 }}/>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 30, flexShrink: 0 }}>
                    <button onClick={() => nudgePrice('min', 1)} style={stepBtn}>+</button>
                    <button onClick={() => nudgePrice('min', -1)} style={stepBtn}>−</button>
                  </div>
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: btb.textDim, fontSize: 11, marginBottom: 4 }}>Max price ({qQuote} per {qBase})</div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'stretch' }}>
                  <input value={maxStr} inputMode="decimal" placeholder="∞"
                    onChange={(e) => { setMaxStr(e.target.value); setRangeMode('custom'); setSmartNote(null); setSwapPreview(null); }}
                    style={{ ...inputStyle(false), height: 44, fontSize: 15, flex: 1, minWidth: 0 }}/>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 30, flexShrink: 0 }}>
                    <button onClick={() => nudgePrice('max', 1)} style={stepBtn}>+</button>
                    <button onClick={() => nudgePrice('max', -1)} style={stepBtn}>−</button>
                  </div>
                </div>
              </div>
            </div>
            {/* Smart strategy — fit the chosen width to what the wallet holds,
                so step 2 never dead-ends on "insufficient balance". */}
            {!simOnly && !splitRange && address && (
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '10px 12px', marginBottom: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: btb.textDim, fontSize: 10 }}>You hold</div>
                  <div style={{ color: btb.text, fontSize: 12, fontWeight: 700, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {fmtAmt(effBal0, pool.decimals0)} {sym0} + {fmtAmt(effBal1, pool.decimals1)} {sym1}
                  </div>
                </div>

                {/* Single-token wallets: segmented Balanced / Single-sided choice. */}
                {((effBal0 <= 0n) !== (effBal1 <= 0n)) && !(!isV4 && ethMode && wethSide === (effBal0 > 0n ? 0 : 1)) && (
                  <div style={{ display: 'flex', marginTop: 8, background: 'rgba(255,255,255,0.05)', borderRadius: 9, padding: 2 }}>
                    {([['balanced', 'Balanced'], ['single', 'Single-sided']] as const).map(([val, title]) => (
                      <button key={val} onClick={() => { setSmartStrategy(val); applySmartFit(val); }} style={{
                        flex: 1, height: 28, borderRadius: 7, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, fontWeight: 700,
                        background: smartStrategy === val ? 'rgba(82,227,164,0.2)' : 'transparent',
                        color: smartStrategy === val ? '#52E3A4' : btb.textMuted,
                      }}>{title}</button>
                    ))}
                  </div>
                )}

                {swapPreview && (
                  <div style={{ color: btb.text, fontSize: 10.5, marginTop: 7, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ color: btb.textDim }}>Swap to balance</span>
                    <span style={{ fontWeight: 700 }}>
                      {fmtAmt(swapPreview.sellRaw, swapPreview.sellSide === 0 ? pool.decimals0 : pool.decimals1)} {swapPreview.sym} → {swapPreview.otherSym}
                      <span style={{ color: swapPreview.pct <= 60 ? '#52E3A4' : '#FFB36B', fontWeight: 800, marginLeft: 6 }}>({swapPreview.pct < 1 ? '<1' : Math.round(swapPreview.pct)}%)</span>
                    </span>
                  </div>
                )}
                {smartNote && (
                  <div style={{ color: btb.textMuted, fontSize: 10.5, marginTop: 7, lineHeight: 1.45 }}>{smartNote}</div>
                )}
              </div>
            )}

            {/* Everything on one page, Orca-style — no separate "enter amounts" step */}
            {!simOnly && (
              <>
                {!isV4 && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, margin: '0 2px 8px' }}>
                    <button onClick={toggleUnevenAmounts} aria-pressed={splitRange} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 28, padding: '0 8px 0 4px', cursor: 'pointer', borderRadius: 999, border: `1px solid ${splitRange ? 'rgba(82,227,164,0.4)' : 'rgba(255,255,255,0.12)'}`, background: splitRange ? 'rgba(82,227,164,0.1)' : 'transparent', color: splitRange ? btb.green : btb.textMuted, fontFamily: 'inherit', fontSize: 11, fontWeight: 750 }}>
                      <span style={{ width: 20, height: 12, borderRadius: 999, padding: 2, boxSizing: 'border-box', background: splitRange ? btb.green : 'rgba(255,255,255,0.2)' }}><span style={{ display: 'block', width: 8, height: 8, borderRadius: '50%', background: '#fff', transform: `translateX(${splitRange ? 8 : 0}px)`, transition: 'transform 0.18s' }} /></span>
                      Use uneven amounts
                    </button>
                    {splitRange && <span style={{ color: splitTicks?.below && splitTicks?.above ? btb.green : '#FFB36B', fontSize: 10.5, textAlign: 'right' }}>{splitTicks?.below && splitTicks?.above ? `${sym1} ↓ · ${sym0} ↑` : 'Widen range slightly'}</span>}
                  </div>
                )}

                {!isV4 && dex === 'uniswap' && (
                  <div style={{ marginBottom: 9 }}>
                    <button
                      type="button"
                      disabled={!smartDeployment}
                      onClick={() => {
                        if (!smartDeployment) return;
                        setAutoManage((enabled) => !enabled);
                        setSwapPreview(null);
                      }}
                      aria-pressed={autoManage}
                      style={{
                        width: '100%', minHeight: 42, padding: '7px 10px', borderRadius: 12, cursor: smartDeployment ? 'pointer' : 'default',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontFamily: 'inherit', textAlign: 'left',
                        border: `1px solid ${autoManage ? 'rgba(82,227,164,0.4)' : 'rgba(255,255,255,0.1)'}`,
                        background: autoManage ? 'rgba(82,227,164,0.09)' : 'rgba(255,255,255,0.035)',
                        color: smartDeployment ? btb.text : btb.textDim,
                      }}
                    >
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: 12, fontWeight: 800 }}>Auto-manage this LP</span>
                        <span style={{ display: 'block', color: btb.textMuted, fontSize: 9.8, marginTop: 2, lineHeight: 1.3 }}>
                          {smartDeployment ? 'Your account holds the NFT; only your wallet can withdraw it.' : 'Smart-account contracts are not configured on this chain yet.'}
                        </span>
                      </span>
                      <span style={{ flexShrink: 0, width: 30, height: 17, borderRadius: 999, padding: 2, boxSizing: 'border-box', background: autoManage ? btb.green : 'rgba(255,255,255,0.18)' }}>
                        <span style={{ display: 'block', width: 13, height: 13, borderRadius: '50%', background: '#fff', transform: `translateX(${autoManage ? 13 : 0}px)`, transition: 'transform 0.18s' }} />
                      </span>
                    </button>
                  </div>
                )}

                {/* Amounts — enter either side, the other is paired automatically */}
                {renderAmountInput(0)}
                {renderAmountInput(1)}

                {autoManage && smartDeployment && (
                  <div style={{ marginBottom: 10 }}>
                    <AutomationRules
                      value={automationRules}
                      onChange={setAutomationRules}
                      agent={smartDeployment.agent}
                      slippageBps={slippageBps}
                      onSlippageChange={setSlippageBps}
                    />
                  </div>
                )}

                {!splitRange && renderNeedWarning()}
                {(short0 || short1) && (
                  <div style={{ color: btb.loss, fontSize: 11, margin: '-2px 2px 10px' }}>
                    Insufficient {short0 ? sym0 : sym1} — you hold {short0 ? fmtAmt(effBal0, pool.decimals0) : fmtAmt(effBal1, pool.decimals1)}.
                  </div>
                )}
              </>
            )}

            {simOnly && renderNeedWarning()}
            {renderPriceDeviationWarning()}
            {renderDepositSummary()}
            {!splitRange && renderEarnings()}
            {!splitRange && renderBacktest()}

            {err && <div style={{ color: btb.loss, fontSize: 12, marginTop: 12 }}>{err}</div>}

            {/* Deposit action lives at the end of the (shorter) right column,
                not below the full-width chart, so it's always right under the
                controls instead of scrolled past a tall candlestick chart. */}
            {simOnly ? (
              <>
                {canSwitchToAdd && (
                  <Button variant="success" size="md" onClick={switchToAdd} style={{ marginTop: 18, fontWeight: 800 }}>Add this LP</Button>
                )}
                <div style={{ color: btb.textDim, fontSize: 11, textAlign: 'center', marginTop: 10, lineHeight: 1.5 }}>
                  Free LP earnings simulator — no wallet needed. Estimates use recent pool fees and your share of in-range liquidity.
                </div>
              </>
            ) : (
              <div style={{ color: btb.textDim, fontSize: 11, textAlign: 'center', marginTop: 8, lineHeight: 1.5 }}>
                {autoManage
                  ? 'Account creation, exact approvals and LP setup are batched when your wallet supports it. Unused tokens return to your wallet.'
                  : swapPreview
                  ? `Two transactions: swap ~${swapPreview.pct < 1 ? '<1' : Math.round(swapPreview.pct)}% to balance, then add — each slippage-protected (${slippageBps / 100}%).`
                  : <>Slippage-protected ({slippageBps / 100}%). Approvals included.{wethSide !== null ? ' Pay with ETH or WETH.' : isV4 && nativeSide === 0 ? ' Paid in native ETH — unused ETH is refunded.' : ''}</>}
              </div>
            )}
            </div>
          </>
        )}
      </div>

      {/* Full-width sticky action bar keeps the final deposit action reachable. */}
      {!simOnly && pool?.exists && !loadingPool && !poolErr && (
        <div style={{
          position: 'sticky', zIndex: 5, pointerEvents: 'none',
          bottom: isMobile ? 'calc(64px + env(safe-area-inset-bottom, 0px))' : 0,
          display: 'block',
          padding: isMobile ? '0 0 10px' : '0 24px calc(12px + env(safe-area-inset-bottom, 0px))',
        }}>
          <div style={{
            pointerEvents: 'auto', display: 'flex', alignItems: 'stretch', gap: 8, minWidth: 0,
            background: 'rgba(10,10,15,0.94)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: 8,
          }}>
                <div
                  onClick={() => { const opts = [50, 100, 250, 500]; const i = opts.indexOf(slippageBps); setSlippageBps(opts[(i + 1) % opts.length]); }}
                  title="Tap to change liquidity slippage"
                  style={{
                    flexShrink: 0, cursor: 'pointer', borderRadius: 10, padding: '4px 10px', textAlign: 'center',
                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                    display: 'flex', flexDirection: 'column', justifyContent: 'center', lineHeight: 1.1,
                  }}>
                  <span style={{ color: btb.textDim, fontSize: 9 }}>Liq. slippage</span>
                  <span style={{ color: btb.text, fontSize: 12, fontWeight: 800 }}>{slippageBps / 100}%</span>
                </div>
                <Button variant="success" size="sm" onClick={() => (autoManage ? mintManaged() : swapPreview ? mintBalanced() : mint())} disabled={!canMint} style={{ flex: 1, fontWeight: 800, fontSize: 13 }}>
                  {busy ? (stepMsg || 'Confirming…') : autoManage ? (splitRange ? 'Create 2 managed LPs' : 'Create managed LP') : splitRange ? (short0 || short1 ? 'Insufficient balance' : 'Add split LPs') : swapPreview ? 'Swap & add LP' : (short0 || short1) ? 'Insufficient balance' : 'Add LP'}
                </Button>
          </div>
        </div>
      )}
    </div>
    </Portal>
  );
}
