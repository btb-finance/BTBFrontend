'use client';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useConnection, useConfig } from 'wagmi';
import { getPublicClient } from 'wagmi/actions';
import { formatUnits, parseUnits, erc20Abi } from 'viem';
import { Glass } from './Glass';
import { Portal } from './Portal';
import { RangeChart } from './RangeChart';
import { btb } from './design-tokens';
import { useTx } from '../lib/TxTracker';
import { runCalls } from '../lib/txRunner';
import { getTokenPricesUsd } from '../lib/defillama';
import {
  fetchPoolsForMint, buildMint, rangeTicks, addAmounts, addSide, nearestUsableTick,
  liquidityForAmounts, getAmountsForLiquidity, fitRangeToBalances, getPoolHistory, hasGraphKey, V3_SUBGRAPH_ID,
  TICK_SPACINGS, MIN_TICK, MAX_TICK, FEE_TIERS, isWeth, WETH,
  fetchV4PoolForMint, buildV4Mint, maxIn, isNativeCurrency, fmtFeeTier,
  type MintPool, type V4MintPool, type PoolDay,
} from '@/protocols/dexs/uniswap';

const SLIPPAGE_BPS = 50; // 0.5%
/** ETH kept aside for gas when a side is paid natively and "smart fit" uses the full balance. */
const GAS_RESERVE = 5n * 10n ** 15n; // 0.005 ETH
const FEE_LABEL: Record<number, string> = { 100: '0.01%', 500: '0.05%', 3000: '0.3%', 10000: '1%' };
const RANGE_PRESETS: { label: string; pct: number | null }[] = [
  { label: '±5%', pct: 5 }, { label: '±10%', pct: 10 }, { label: '±25%', pct: 25 }, { label: 'Full', pct: null },
];
/** Preset ±pct | null = full range | 'custom' (min/max inputs) | exact ticks (smart fit). */
type RangeMode = number | null | 'custom' | { tickLower: number; tickUpper: number };

function fmtAmt(raw: bigint, decimals: number): string {
  const n = parseFloat(formatUnits(raw, decimals));
  if (n === 0) return '0';
  if (n < 0.0001) return '<0.0001';
  return n.toLocaleString('en-US', { maximumFractionDigits: 6 });
}

/** price of token0 in token1 (human units) at a tick. */
function tickToPrice(tick: number, d0: number, d1: number): number {
  return 1.0001 ** tick * 10 ** (d0 - d1);
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
export function CreatePosition({ tokenA, tokenB, initialFee, fees24hUsd, v4PoolId, simulate, onClose, onDone }: {
  /** V3 mint: the (unsorted) token pair. Ignored when `v4PoolId` is set. */
  tokenA?: `0x${string}`; tokenB?: `0x${string}`;
  /** Fee tier of the pool the user clicked — preselected when valid (V3). */
  initialFee?: number;
  /** Pool's recent daily LP fees (USD) — earnings fallback when no Graph key. */
  fees24hUsd?: number;
  /** V4 mint: the bytes32 pool id from the Earn list. */
  v4PoolId?: `0x${string}`;
  /** Open as the earnings simulator (USD amount, no wallet) instead of a deposit. */
  simulate?: boolean;
  onClose: () => void; onDone?: () => void;
}) {
  const { address } = useConnection();
  const config = useConfig();
  const { track } = useTx();

  const [fee, setFee] = useState(
    initialFee !== undefined && (FEE_TIERS as readonly number[]).includes(initialFee) ? initialFee : 3000,
  );
  // All fee tiers are fetched in one batch up front — switching tiers is instant.
  const [pools, setPools] = useState<Record<number, MintPool> | null>(null);
  const [loadingPool, setLoadingPool] = useState(true);
  const [poolErr, setPoolErr] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  // Default ±5% — the same band the Earn list quotes its range APR for.
  const [rangeMode, setRangeMode] = useState<RangeMode>(5);
  const [minStr, setMinStr] = useState('');
  const [maxStr, setMaxStr] = useState('');
  const [amt, setAmt] = useState<{ side: 0 | 1; str: string }>({ side: 0, str: '' });
  const [useEth, setUseEth] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [bal0, setBal0] = useState(0n);
  const [bal1, setBal1] = useState(0n);
  const [ethBal, setEthBal] = useState(0n);
  const [history, setHistory] = useState<PoolDay[] | null>(null);
  const [usd, setUsd] = useState<Record<string, number>>({});
  // Two steps — Range (fee tier + price range) then Deposit (amounts + mint) —
  // so the sheet stays short on mobile instead of one long scroll.
  const [tab, setTab] = useState<'range' | 'deposit'>('range');
  // Simulator mode: step 2 takes a USD amount instead of wallet deposits.
  const [simOnly, setSimOnly] = useState(!!simulate);
  const [simUsdStr, setSimUsdStr] = useState('1000');
  // Explanation of the last "smart fit" — cleared on any manual range change.
  const [smartNote, setSmartNote] = useState<string | null>(null);
  // Flip the quote direction: false → token1 per token0 (pool order),
  // true → token0 per token1. Display-only; ticks/amounts stay in pool order.
  const [flip, setFlip] = useState(false);

  const isV4 = v4PoolId !== undefined;
  const pool = pools?.[fee] ?? null;
  const v4Pool = isV4 ? (pool as V4MintPool | null) : null;

  // Native-ETH deposit side. V3: the WETH token (toggle ETH vs WETH).
  // V4: currency0 = address(0) IS native ETH — always paid as ETH, no toggle.
  const wethSide: 0 | 1 | null = !isV4 && pool ? (isWeth(pool.token0) ? 0 : isWeth(pool.token1) ? 1 : null) : null;
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
    setFlip((v) => !v);
  }

  useEffect(() => {
    let live = true;
    setLoadingPool(true); setPools(null); setPoolErr(null);
    const client = getPublicClient(config);
    if (!client) { setLoadingPool(false); setPoolErr('No RPC client'); return; }
    if (v4PoolId) {
      // V4: the pool id pins one pool (fee/tickSpacing/hooks) — no tier choice.
      fetchV4PoolForMint(client, v4PoolId)
        .then((p) => { if (live) { setPools({ [p.fee]: p }); setFee(p.fee); } })
        .catch((e: Error) => { if (live) setPoolErr(e?.message ?? 'network error'); })
        .finally(() => { if (live) setLoadingPool(false); });
    } else if (tokenA && tokenB) {
      fetchPoolsForMint(client, tokenA, tokenB)
        .then((record) => {
          if (!live) return;
          setPools(record);
          // If the preselected tier has no pool, jump to the deepest existing one.
          setFee((f) => {
            if (record[f]?.exists) return f;
            const best = FEE_TIERS.filter((t) => record[t]?.exists)
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
  }, [config, tokenA, tokenB, v4PoolId, retryNonce]);

  // 30-day price/fee history (chart + earnings sim) and token USD prices.
  useEffect(() => {
    let live = true;
    setHistory(null);
    if (!pool || !pool.exists) return;
    if (hasGraphKey && !isV4) { // the V4 subgraph has no poolDayData — sim falls back to fees24hUsd
      getPoolHistory(V3_SUBGRAPH_ID, pool.address)
        .then((h) => { if (live) setHistory(h); })
        .catch(() => {}); // chart/sim are progressive extras — never block minting
    }
    // Native ETH (V4 currency 0x0) isn't a token DeFiLlama knows — price it as WETH.
    const priceToken0 = isNativeCurrency(pool.token0) ? WETH : pool.token0;
    getTokenPricesUsd([priceToken0, pool.token1])
      .then((p) => {
        if (!live) return;
        if (priceToken0 !== pool.token0 && p[WETH.toLowerCase()]) p[pool.token0.toLowerCase()] = p[WETH.toLowerCase()];
        setUsd(p);
      })
      .catch(() => {});
    return () => { live = false; };
  }, [pool, isV4]);

  // V4 carries its own per-pool spacing; V3's is fixed per fee tier.
  const spacing = v4Pool ? v4Pool.tickSpacing : TICK_SPACINGS[fee];
  const ticks = useMemo(() => {
    if (!pool || !pool.exists) return null;
    if (rangeMode !== null && typeof rangeMode === 'object') return rangeMode; // smart fit — exact ticks
    if (rangeMode !== 'custom') return rangeTicks(pool.tick, spacing, rangeMode);
    if (!flip) return ticksFromPrices(minStr, maxStr, pool, spacing);
    // Flipped quoting: display min/max are inverted prices, so direct min = 1/displayMax.
    const inv = (s: string) => { const v = parseFloat(s); return isFinite(v) && v > 0 ? String(1 / v) : ''; };
    return ticksFromPrices(inv(maxStr), inv(minStr), pool, spacing);
  }, [pool, spacing, rangeMode, minStr, maxStr, flip]);

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
    if (!amt.str || parseFloat(amt.str) <= 0) return zero;
    try {
      const raw = parseUnits(amt.str, amt.side === 0 ? pool.decimals0 : pool.decimals1);
      const r = addAmounts(pool.sqrtPriceX96, ticks.tickLower, ticks.tickUpper, amt.side, raw);
      return { add0: r.amount0, add1: r.amount1 };
    } catch { return zero; }
  }, [pool, ticks, amt, simOnly, simUsdStr, tokenUsd]);

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

  // wallet balances of both tokens (+ native ETH)
  useEffect(() => {
    let live = true;
    const client = getPublicClient(config);
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
    if (!address || !pool || !ticks) return;
    setBusy(true); setErr(null);
    try {
      const calls = v4Pool
        ? buildV4Mint({
            poolKey: v4Pool.poolKey,
            tickLower: ticks.tickLower, tickUpper: ticks.tickUpper,
            // V4 mints a liquidity amount; the maxes cap what the pool may pull.
            liquidity: liquidityForAmounts(pool.sqrtPriceX96, ticks.tickLower, ticks.tickUpper, add0, add1),
            amount0Max: maxIn(add0, SLIPPAGE_BPS), amount1Max: maxIn(add1, SLIPPAGE_BPS),
            recipient: address as `0x${string}`,
          })
        : buildMint({
            token0: pool.token0, token1: pool.token1, fee,
            tickLower: ticks.tickLower, tickUpper: ticks.tickUpper,
            amount0Desired: add0, amount1Desired: add1,
            slippageBps: SLIPPAGE_BPS, recipient: address as `0x${string}`,
            nativeEthSide: ethMode ? wethSide : null,
          });
      await runCalls(config, { account: address as `0x${string}`, calls, label: `Add ${pool.symbol0}/${pool.symbol1} liquidity`, track });
      onDone?.();
      onClose();
    } catch (e) {
      setErr((e as { shortMessage?: string })?.shortMessage ?? (e as Error)?.message ?? 'Failed');
    } finally { setBusy(false); }
  }

  const canMint = !!pool?.exists && !!ticks && (add0 > 0n || add1 > 0n) && !short0 && !short1 && !busy;

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
  function applySmartFit() {
    if (!pool || !pool.exists || !ticks) return;
    const fitBal0 = ethMode && nativeSide === 0 ? (effBal0 > GAS_RESERVE ? effBal0 - GAS_RESERVE : 0n) : effBal0;
    const fitBal1 = ethMode && nativeSide === 1 ? (effBal1 > GAS_RESERVE ? effBal1 - GAS_RESERVE : 0n) : effBal1;
    // Full range can't be re-placed — fit a ±10% band instead.
    const base = rangeMode === null ? rangeTicks(pool.tick, spacing, 10) : ticks;
    const fit = fitRangeToBalances(pool.sqrtPriceX96, pool.tick, base.tickUpper - base.tickLower, spacing, fitBal0, fitBal1);
    if (!fit) { setSmartNote('Nothing to fit — your wallet holds neither pool token.'); return; }
    setRangeMode({ tickLower: fit.tickLower, tickUpper: fit.tickUpper });
    const bal = fit.side === 0 ? fitBal0 : fitBal1;
    setAmt({ side: fit.side, str: formatUnits(bal, fit.side === 0 ? pool.decimals0 : pool.decimals1) });
    const sym = fit.side === 0 ? sym0 : sym1;
    setSmartNote(fit.single
      ? `You hold ${sym} only, so the range sits just ${fit.side === 0 ? 'above' : 'below'} the current price — it deposits ${sym} alone and starts earning fees once the price moves into range.`
      : 'Range shifted to match your balances — both tokens deposit in full, same width as you picked.');
  }

  const inputStyle = (disabled: boolean): CSSProperties => ({
    width: '100%', height: 48, background: disabled ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, padding: '0 14px',
    color: disabled ? btb.textDim : btb.text, fontSize: 18, fontWeight: 700, fontFamily: 'inherit',
    outline: 'none', boxSizing: 'border-box',
  });

  // Plain render helper (NOT a nested component — a nested component type would
  // remount the <input> on every keystroke and drop focus).
  function renderAmountInput(side: 0 | 1) {
    if (!pool) return null;
    const sym = side === 0 ? sym0 : sym1;
    const dec = side === 0 ? pool.decimals0 : pool.decimals1;
    const bal = side === 0 ? effBal0 : effBal1;
    const computed = side === 0 ? add0 : add1;
    // The range may only take one token — the other side stays at 0.
    const disabled = need === (side === 0 ? 'token1' : 'token0');
    const value = disabled ? '0' : amt.side === side ? amt.str : computed > 0n ? formatUnits(computed, dec) : '';
    return (
      <div key={side} style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ color: btb.textMuted, fontSize: 12 }}>{sym}{disabled ? ' (not needed in this range)' : ''}</span>
          <span style={{ color: btb.textMuted, fontSize: 12 }}>
            Balance: {fmtAmt(bal, dec)}
            {!disabled && (
              <span onClick={() => setAmt({ side, str: formatUnits(bal, dec) })} style={{ color: btb.red, fontWeight: 700, marginLeft: 6, cursor: 'pointer' }}>MAX</span>
            )}
          </span>
        </div>
        <input
          value={value}
          disabled={disabled}
          onChange={(e) => setAmt({ side, str: e.target.value.replace(/[^0-9.]/g, '') })}
          inputMode="decimal" placeholder="0"
          style={inputStyle(disabled)}/>
      </div>
    );
  }

  // Shared result blocks — rendered on the simulator's single page AND on the
  // add flow's deposit step (plain functions, same reason as renderAmountInput).
  function renderNeedWarning() {
    if (!pool || need === 'both') return null;
    return (
      <div style={{ color: '#FFB36B', fontSize: 12, marginBottom: 10 }}>
        Current price is outside this range — the position takes {need === 'token0' ? sym0 : sym1} only and won&apos;t earn fees until price enters the range.
      </div>
    );
  }

  function renderDepositSummary() {
    if (!pool || (add0 === 0n && add1 === 0n)) return null;
    return (
      <Glass padding={12} radius={12} soft>
        <div style={{ color: btb.textMuted, fontSize: 12, marginBottom: 4 }}>{simOnly ? 'You’d deposit' : 'You deposit'}</div>
        <div style={{ color: btb.text, fontSize: 14, fontWeight: 700 }}>
          {fmtAmt(add0, pool.decimals0)} {sym0} + {fmtAmt(add1, pool.decimals1)} {sym1}
          {sim && sim.depositUsd > 0 && <span style={{ color: btb.textMuted, fontWeight: 600 }}> (≈${sim.depositUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })})</span>}
        </div>
      </Glass>
    );
  }

  function renderEarnings() {
    if (!sim || !sim.inRange || sim.daily <= 0) return null;
    return (
      <Glass padding={12} radius={12} soft style={{ marginTop: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ color: btb.textMuted, fontSize: 12 }}>Estimated earnings · current volume</span>
          {sim.apr !== null && (
            <span style={{ color: '#52E3A4', fontSize: 13, fontWeight: 800 }}>~{sim.apr.toFixed(1)}% APR</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {([['Daily', sim.daily], ['Monthly', sim.monthly], ['Yearly', sim.yearly]] as const).map(([label, v]) => (
            <div key={label} style={{ flex: 1, background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '8px 10px' }}>
              <div style={{ color: btb.textDim, fontSize: 10 }}>{label}</div>
              <div style={{ color: btb.text, fontSize: 14, fontWeight: 800 }}>
                ${v >= 100 ? v.toLocaleString('en-US', { maximumFractionDigits: 0 }) : v.toFixed(2)}
              </div>
            </div>
          ))}
        </div>
        <div style={{ color: btb.textDim, fontSize: 10, marginTop: 8, lineHeight: 1.4 }}>
          {history ? '7-day avg' : 'Latest 24h'} pool fees × your {sim.sharePct < 0.01 ? '<0.01' : sim.sharePct.toFixed(2)}% share of in-range liquidity. Assumes price stays in range and volume holds — not a guarantee.
        </div>
      </Glass>
    );
  }

  return (
    <Portal>
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 340, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, background: 'rgba(10,10,15,0.98)', borderTop: '1px solid rgba(255,255,255,0.1)', borderRadius: '28px 28px 0 0', padding: '12px 20px calc(32px + env(safe-area-inset-bottom, 0px))', maxHeight: '88vh', overflowY: 'auto' }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.18)', margin: '0 auto 16px' }}/>
        <div style={{ color: btb.text, fontSize: 19, fontWeight: 800, letterSpacing: -0.4 }}>{simOnly ? 'Simulate LP earnings' : 'Add liquidity'}</div>
        <div style={{ color: btb.textMuted, fontSize: 13, marginTop: 2, marginBottom: 16 }}>
          {pool ? `${flip ? pool.symbol1 : pool.symbol0} / ${flip ? pool.symbol0 : pool.symbol1} · Uniswap ${isV4 ? 'V4' : 'V3'}` : `Uniswap ${isV4 ? 'V4' : 'V3'} · Ethereum`}
        </div>

        {/* Step tabs — add flow only; the simulator is a single live page */}
        {!simOnly && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {([['range', '1 · Price range'], ['deposit', '2 · Deposit']] as const).map(([t, label]) => {
              const active = tab === t;
              const disabled = t === 'deposit' && !(pool?.exists && ticks);
              return (
                <button key={t} onClick={() => !disabled && setTab(t)} disabled={disabled} style={{
                  flex: 1, height: 40, borderRadius: 12, cursor: disabled ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                  background: active ? 'rgba(82,227,164,0.16)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${active ? 'rgba(82,227,164,0.45)' : 'rgba(255,255,255,0.1)'}`,
                  color: active ? '#52E3A4' : disabled ? btb.textDim : btb.textMuted,
                }}>{label}</button>
              );
            })}
          </div>
        )}

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
        ) : (simOnly || tab === 'range') ? (
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

            {/* Fee tier — selectable on V3; fixed by the pool id on V4 */}
            <div style={{ color: btb.textMuted, fontSize: 12, marginBottom: 6 }}>Fee tier</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {isV4 ? (
                <span style={{
                  height: 38, padding: '0 16px', borderRadius: 12, fontSize: 13, fontWeight: 700,
                  background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.28)', color: '#fff',
                  display: 'inline-flex', alignItems: 'center',
                }}>{fmtFeeTier(fee)}</span>
              ) : FEE_TIERS.map((f) => {
                const missing = !!pools && !pools[f]?.exists;
                return (
                  <button key={f} onClick={() => { setFee(f); setSmartNote(null); }} disabled={missing} style={{
                    flex: 1, height: 38, borderRadius: 12, cursor: missing ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                    background: fee === f ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${fee === f ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.1)'}`,
                    color: fee === f ? '#fff' : btb.textMuted,
                    opacity: missing ? 0.35 : 1,
                  }} title={missing ? 'No pool at this fee tier' : undefined}>{FEE_LABEL[f]}</button>
                );
              })}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
              <span style={{ color: btb.textMuted, fontSize: 12 }}>
                Current price: 1 {qBase} = {dispPrice(price).toLocaleString('en-US', { maximumSignificantDigits: 6 })} {qQuote}
              </span>
              <button onClick={toggleFlip} title="Flip which token prices are quoted in" style={{
                flexShrink: 0, height: 28, padding: '0 10px', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 11, fontWeight: 700, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.14)', color: btb.textMuted,
              }}>⇄ {qQuote}/{qBase}</button>
            </div>

            {/* Range — presets or custom min/max price */}
            <div style={{ color: btb.textMuted, fontSize: 12, marginBottom: 6 }}>Price range</div>
            {history && history.length > 1 && (
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '10px 8px 4px', marginBottom: 10 }}>
                <RangeChart
                  points={history.map((d) => dispPrice(d.price0))}
                  min={rangeMode === null ? null : parseFloat(minStr) > 0 ? parseFloat(minStr) : null}
                  max={rangeMode === null ? null : isFinite(parseFloat(maxStr)) && parseFloat(maxStr) > 0 ? parseFloat(maxStr) : null}
                  current={dispPrice(price)}
                  onChange={(lo, hi) => {
                    setRangeMode('custom');
                    setSmartNote(null);
                    setMinStr(fmtPrice(lo));
                    setMaxStr(fmtPrice(hi));
                  }}/>
                <div style={{ color: btb.textDim, fontSize: 10, textAlign: 'center', padding: '4px 0 6px' }}>
                  30-day price · {qQuote} per {qBase} · drag the handles to set your range
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              {RANGE_PRESETS.map((r) => (
                <button key={r.label} onClick={() => { setRangeMode(r.pct); setSmartNote(null); }} style={{
                  flex: 1, height: 38, borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                  background: rangeMode === r.pct ? 'rgba(82,227,164,0.18)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${rangeMode === r.pct ? 'rgba(82,227,164,0.5)' : 'rgba(255,255,255,0.1)'}`,
                  color: rangeMode === r.pct ? '#52E3A4' : btb.textMuted,
                }}>{r.label}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 6 }}>
              <div style={{ flex: 1 }}>
                <div style={{ color: btb.textDim, fontSize: 11, marginBottom: 4 }}>Min price ({qQuote} per {qBase})</div>
                <input value={minStr} inputMode="decimal" placeholder="0"
                  onChange={(e) => { setMinStr(e.target.value); setRangeMode('custom'); setSmartNote(null); }}
                  style={{ ...inputStyle(false), height: 44, fontSize: 15 }}/>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: btb.textDim, fontSize: 11, marginBottom: 4 }}>Max price ({qQuote} per {qBase})</div>
                <input value={maxStr} inputMode="decimal" placeholder="∞"
                  onChange={(e) => { setMaxStr(e.target.value); setRangeMode('custom'); setSmartNote(null); }}
                  style={{ ...inputStyle(false), height: 44, fontSize: 15 }}/>
              </div>
            </div>
            {ticks && (
              <div style={{ color: btb.textDim, fontSize: 11, marginBottom: 16 }}>
                Ticks {ticks.tickLower} → {ticks.tickUpper} · spacing {spacing} · current tick {pool.tick}
                {rangeMode === 'custom' ? ' · snapped to nearest usable tick' : ''}
              </div>
            )}

            {/* Smart strategy — fit the chosen width to what the wallet holds,
                so step 2 never dead-ends on "insufficient balance". */}
            {!simOnly && address && (
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '12px 14px', marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: btb.textMuted, fontSize: 11 }}>You hold</div>
                    <div style={{ color: btb.text, fontSize: 13, fontWeight: 700, marginTop: 2 }}>
                      {fmtAmt(effBal0, pool.decimals0)} {sym0} + {fmtAmt(effBal1, pool.decimals1)} {sym1}
                    </div>
                  </div>
                  <button onClick={applySmartFit} style={{
                    flexShrink: 0, height: 36, padding: '0 14px', borderRadius: 11, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                    fontSize: 12, fontWeight: 800, background: 'rgba(82,227,164,0.18)', color: '#52E3A4',
                  }}>⚡ Fit to my balance</button>
                </div>
                {smartNote && (
                  <div style={{ color: '#52E3A4', fontSize: 11, marginTop: 8, lineHeight: 1.5 }}>{smartNote}</div>
                )}
              </div>
            )}

            {/* Simulator results — live as the amount/range above change */}
            {simOnly && (
              <>
                {renderNeedWarning()}
                {renderDepositSummary()}
                {renderEarnings()}
              </>
            )}
          </>
        ) : (
          <>
            {/* Step-1 recap — jump back to edit */}
            <Glass padding={12} radius={12} soft style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: btb.textMuted, fontSize: 11 }}>Range · {fmtFeeTier(fee)} fee</div>
                  <div style={{ color: btb.text, fontSize: 13, fontWeight: 700, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {rangeMode === null ? 'Full range' : `${minStr || '0'} → ${maxStr || '∞'}`} <span style={{ color: btb.textMuted, fontWeight: 400 }}>{qQuote} per {qBase}</span>
                  </div>
                  <div style={{ color: btb.textDim, fontSize: 11, marginTop: 2 }}>
                    Current: {dispPrice(price).toLocaleString('en-US', { maximumSignificantDigits: 6 })}
                  </div>
                </div>
                <button onClick={() => setTab('range')} style={{
                  flexShrink: 0, height: 32, padding: '0 14px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
                  fontSize: 12, fontWeight: 700, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.16)', color: btb.text,
                }}>Edit</button>
              </div>
            </Glass>

            {wethSide !== null && (
              <div onClick={() => setUseEth((v) => !v)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: 16, background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '10px 14px' }}>
                <span style={{ color: btb.text, fontSize: 13, fontWeight: 600 }}>Pay with ETH <span style={{ color: btb.textDim, fontWeight: 400 }}>(instead of WETH)</span></span>
                <div style={{ width: 42, height: 24, borderRadius: 999, background: useEth ? '#52E3A4' : 'rgba(255,255,255,0.18)', position: 'relative', transition: 'background 0.2s' }}>
                  <div style={{ position: 'absolute', top: 2, left: useEth ? 20 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }}/>
                </div>
              </div>
            )}

            {/* Amounts — enter either side, the other is paired automatically */}
            {renderAmountInput(0)}
            {renderAmountInput(1)}

            {renderNeedWarning()}
            {(short0 || short1) && (
              <div style={{ background: 'rgba(255,107,122,0.08)', border: '1px solid rgba(255,107,122,0.25)', borderRadius: 12, padding: '10px 12px', marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                  <span style={{ color: btb.loss, fontSize: 12 }}>
                    Insufficient {short0 ? sym0 : sym1} — you hold {short0 ? fmtAmt(effBal0, pool.decimals0) : fmtAmt(effBal1, pool.decimals1)}
                  </span>
                  <button onClick={applySmartFit} style={{
                    flexShrink: 0, height: 32, padding: '0 12px', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                    fontSize: 12, fontWeight: 800, background: 'rgba(82,227,164,0.18)', color: '#52E3A4',
                  }}>⚡ Fit range</button>
                </div>
              </div>
            )}
            {!short0 && !short1 && smartNote && (
              <div style={{ color: '#52E3A4', fontSize: 11, marginBottom: 10, lineHeight: 1.5 }}>{smartNote}</div>
            )}
            {renderDepositSummary()}
            {renderEarnings()}
          </>
        )}

        {err && <div style={{ color: btb.loss, fontSize: 12, marginTop: 12 }}>{err}</div>}

        {simOnly ? (
          <>
            {canSwitchToAdd && (
              <button onClick={switchToAdd} style={{
                width: '100%', height: 56, borderRadius: 18, border: 'none', marginTop: 18, fontFamily: 'inherit', fontSize: 16, fontWeight: 800,
                cursor: 'pointer', background: 'linear-gradient(135deg,#52E3A4,#1aad77)', color: '#fff',
              }}>Add this LP</button>
            )}
            <div style={{ color: btb.textDim, fontSize: 11, textAlign: 'center', marginTop: 10, lineHeight: 1.5 }}>
              Free LP earnings simulator — no wallet needed. Estimates use recent pool fees and your share of in-range liquidity.
            </div>
          </>
        ) : tab === 'range' ? (
          <button onClick={() => setTab('deposit')} disabled={!pool?.exists || !ticks} style={{
            width: '100%', height: 56, borderRadius: 18, border: 'none', marginTop: 18, fontFamily: 'inherit', fontSize: 16, fontWeight: 800,
            cursor: pool?.exists && ticks ? 'pointer' : 'default',
            background: pool?.exists && ticks ? 'linear-gradient(135deg,#52E3A4,#1aad77)' : 'rgba(255,255,255,0.07)',
            color: pool?.exists && ticks ? '#fff' : btb.textDim,
          }}>Next · Enter amounts</button>
        ) : (
          <>
            <button onClick={mint} disabled={!canMint} style={{
              width: '100%', height: 56, borderRadius: 18, border: 'none', marginTop: 18, fontFamily: 'inherit', fontSize: 16, fontWeight: 800,
              cursor: canMint ? 'pointer' : 'default',
              background: canMint ? 'linear-gradient(135deg,#52E3A4,#1aad77)' : 'rgba(255,255,255,0.07)',
              color: canMint ? '#fff' : btb.textDim,
            }}>{busy ? 'Confirming…' : (short0 || short1) ? 'Insufficient balance' : 'Add liquidity'}</button>
            <div style={{ color: btb.textDim, fontSize: 11, textAlign: 'center', marginTop: 10, lineHeight: 1.5 }}>
              Slippage-protected ({SLIPPAGE_BPS / 100}%). Approvals included.{wethSide !== null ? ' Pay with ETH or WETH.' : isV4 && nativeSide === 0 ? ' Paid in native ETH — unused ETH is refunded.' : ''}
            </div>
          </>
        )}
      </div>
    </div>
    </Portal>
  );
}
