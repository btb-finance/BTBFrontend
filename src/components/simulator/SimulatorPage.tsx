'use client';
/**
 * The full-page LP simulator — twelve sections that tell one story, all fed by
 * a single derived state object (simState.deriveSim) so every number agrees.
 *
 * Opens full-screen (like CreatePosition) from the Simulate screen's pool
 * comparison. "Deploy Position" hands the exact configured range to the real
 * CreatePosition mint flow.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Portal } from '../Portal';
import { Icon } from '../Icon';
import { btb } from '../design-tokens';
import { CreatePosition } from '../CreatePosition';
import { LiquidityDepthChart } from '../LiquidityDepthChart';
import { useSidebar } from '../../lib/SidebarContext';
import { STABLES } from '../../lib/pools';
import {
  nearestUsableTick, fmtFeeTier, isNativeCurrency, uniswapV3DeploymentForChain,
  type V4MintPool,
} from '@/protocols/dexs/uniswap';
import { PANCAKE_V3_DEPLOYMENT } from '@/protocols/dexs/pancakeswap';
import { useSimPools, usePoolExtras, useTokenSafety } from './useSimData';
import { deriveSim, STRATEGY_SIGMA, type Strategy } from './simState';
import { estimateSigmaDaily } from './math/probability';
import { Section } from './ui';
import { PositionSummary } from './sections/PositionSummary';
import { RealBacktest } from './sections/RealBacktest';
import { PriceDistribution } from './sections/PriceDistribution';
import { FeePanel } from './sections/FeePanel';
import { ILPanel } from './sections/ILPanel';
import { PnlWaterfall } from './sections/PnlWaterfall';
import { ComparisonPanel } from './sections/ComparisonPanel';
import { RiskRadar } from './sections/RiskRadar';
import { SensitivityPanel } from './sections/SensitivityPanel';
import { ScenarioCards } from './sections/ScenarioCards';
import { Timeline } from './sections/Timeline';
import { DeployFooter } from './sections/DeployFooter';
import type { ChainDataNetwork } from '../../lib/chainDataNetworks';

/** Gas is intentionally excluded from forward LP estimates. It varies by chain,
 * wallet route and market conditions; a stale flat USD charge misleads more
 * than it helps, especially on low-cost networks. */
const GAS_EST_USD = 0;

/** What the Simulate screen knows about a pool it found — structurally
 * compatible with its FoundPool rows. */
export interface SimPoolChoice {
  protocol: 'uniswap-v3' | 'uniswap-v4' | 'pancakeswap-v3';
  feeTier: number;
  address?: `0x${string}`;
  v4PoolId?: `0x${string}`;
  /** Set when the pool belongs to a DEX other than the built-in protocols —
   * a V3 fork we can simulate but not mint through. */
  dexLabel?: string;
  tvlUsd?: number;
  apy?: number;
  fees24hUsd?: number;
  /** Gauge/emission route (from the earn catalog) — shown separately from
   * swap fees since it requires staking and is paid in reward tokens. */
  aprKind?: 'fee' | 'gauge';
  aprLabel?: string;
}

export function SimulatorPage({ tokenA, tokenB, selected, siblings, chainId, chainName, wrappedNative, networks, onClose }: {
  /** Token addresses for V3-architecture pools ('eth' allowed). Unused for V4. */
  tokenA?: string;
  tokenB?: string;
  selected: SimPoolChoice;
  /** Same-protocol pools at other fee tiers, for the fee tier cards' TVL/APR. */
  siblings: SimPoolChoice[];
  chainId: number;
  chainName: string;
  wrappedNative: `0x${string}`;
  networks: ChainDataNetwork;
  onClose: () => void;
}) {
  const { width: sidebarWidth, isMobile } = useSidebar();
  const isV4 = selected.protocol === 'uniswap-v4';
  const dex = selected.protocol === 'pancakeswap-v3' ? 'pancakeswap' : 'uniswap';
  const deployment = dex === 'pancakeswap'
    ? PANCAKE_V3_DEPLOYMENT
    : uniswapV3DeploymentForChain(chainId) ?? PANCAKE_V3_DEPLOYMENT;
  // The simulator accepts the friendly `ETH` token alias, while the V3 mint
  // flow must receive its ERC-20 WETH address to resolve the pool correctly.
  const mintTokenA = tokenA?.toLowerCase() === 'eth' ? wrappedNative : tokenA as `0x${string}` | undefined;
  const mintTokenB = tokenB?.toLowerCase() === 'eth' ? wrappedNative : tokenB as `0x${string}` | undefined;

  const [feeTier, setFeeTier] = useState(selected.feeTier);
  const [depositStr, setDepositStr] = useState('10000');
  // While the field is mid-edit (cleared, "0", trailing dot) the model keeps
  // running on the last valid number — otherwise the zero deposit nulls the
  // whole simulation and unmounts the input out from under the user's hands.
  const [lastValidDeposit, setLastValidDeposit] = useState(10_000);
  const parsedDeposit = parseFloat(depositStr);
  const depositValid = Number.isFinite(parsedDeposit) && parsedDeposit > 0;
  const depositUsd = depositValid ? parsedDeposit : lastValidDeposit;
  useEffect(() => {
    if (depositValid) setLastValidDeposit(parsedDeposit);
  }, [depositValid, parsedDeposit]);
  const [strategy, setStrategy] = useState<Strategy>('balanced');
  const [customTicks, setCustomTicks] = useState<{ tickLower: number; tickUpper: number } | null>(null);
  const [horizonDays, setHorizonDays] = useState(30);
  const [movePct, setMovePct] = useState(0);
  const [flipManual, setFlipManual] = useState<boolean | null>(null);
  const [deploying, setDeploying] = useState(false);
  const [compound, setCompound] = useState(false);

  const { pools, loading, error, retry } = useSimPools(
    tokenA,
    tokenB,
    selected.v4PoolId,
    dex,
    chainId,
    wrappedNative,
    selected.address,
    selected.feeTier,
  );

  // If the chosen tier has no pool (or V4 pinned a different fee), jump to the
  // deepest existing one so the page never dead-ends on a valid pair.
  useEffect(() => {
    if (!pools) return;
    if (pools[feeTier]?.exists) return;
    const tiers = Object.keys(pools).map(Number).filter((f) => pools[f]?.exists);
    if (tiers.length > 0) {
      setFeeTier(tiers.sort((a, b) => (pools[b].liquidity > pools[a].liquidity ? 1 : -1))[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pools]);

  const pool = pools?.[feeTier]?.exists ? pools[feeTier] : null;
  const v4Pool = isV4 && pool ? (pool as V4MintPool) : null;
  const spacing = v4Pool ? v4Pool.tickSpacing : deployment.tickSpacings[feeTier] ?? 60;

  const { history, estimatedHistory, fallbackCloses, tokenUsd, tickLiq, poolCreatedAt } =
    usePoolExtras(pool, isV4, selected.v4PoolId, dex, spacing, chainId, wrappedNative, networks, feeTier);
  // Indexed history wins; on chains without a subgraph the volume-derived
  // estimate stands in, and every section it feeds is labelled estimated.
  const effectiveHistory = history ?? estimatedHistory ?? null;
  const historyEstimated = history == null && estimatedHistory != null;

  // Token safety (holder concentration, spam/honeypot) — best-effort lookups.
  const blockscoutBase = chainId === 4663 ? 'https://robinhoodchain.blockscout.com/api/v2' : undefined;
  const safetyByAddress = useTokenSafety(pool?.token0, pool?.token1, blockscoutBase, chainId);

  // Per-tier market data (TVL/APR/fees) from the Simulate screen's findings.
  const tierData = (fee: number) => siblings.find((s) => s.feeTier === fee) ?? (fee === selected.feeTier ? selected : undefined);
  const current = tierData(feeTier);

  // Third-party fork pools can run non-standard fee tiers — keep the current
  // tier selectable even when it is not one of the protocol's standard ones.
  const feeOptions = deployment.feeTiers.map((f) => ({
    fee: f,
    exists: !!pools?.[f]?.exists,
    tvlUsd: tierData(f)?.tvlUsd,
    aprPct: tierData(f)?.apy,
  }));
  if (!feeOptions.some((option) => option.fee === feeTier)) {
    feeOptions.push({ fee: feeTier, exists: true, tvlUsd: tierData(feeTier)?.tvlUsd, aprPct: tierData(feeTier)?.apy });
  }

  // ── Orientation: quote the volatile token in the stablecoin, like the sheet ──
  const autoFlip = useMemo(() => {
    if (!pool) return false;
    const s0 = STABLES.has((pool.symbol0 ?? '').toUpperCase());
    const s1 = STABLES.has((pool.symbol1 ?? '').toUpperCase());
    return s0 && !s1;
  }, [pool]);
  const flip = flipManual ?? autoFlip;

  const price = pool ? ((Number(pool.sqrtPriceX96) / 2 ** 96) ** 2) * 10 ** (pool.decimals0 - pool.decimals1) : 0;

  const histCloses = useMemo(
    () => (history && history.length > 1 ? history.map((d) => d.price0) : fallbackCloses ?? []),
    [history, fallbackCloses],
  );
  const sigmaDaily = useMemo(() => estimateSigmaDaily(histCloses), [histCloses]);

  // ── Range ticks: strategy preset (±k·σ over the horizon) or custom drag ─────
  const ticks = useMemo(() => {
    if (!pool) return null;
    if (customTicks) return customTicks;
    const k = STRATEGY_SIGMA[strategy === 'custom' ? 'balanced' : strategy];
    const half = Math.max(k * sigmaDaily * Math.sqrt(Math.max(horizonDays, 1)), Math.log(1.0001) * spacing);
    const delta = Math.max(Math.round(half / Math.log(1.0001)), spacing);
    const tickLower = nearestUsableTick(pool.tick - delta, spacing);
    let tickUpper = nearestUsableTick(pool.tick + delta, spacing);
    if (tickUpper <= tickLower) tickUpper = tickLower + spacing;
    return { tickLower, tickUpper };
  }, [pool, customTicks, strategy, sigmaDaily, horizonDays, spacing]);

  const sim = useMemo(() => {
    if (!pool || !ticks) return null;
    return deriveSim({
      pool, feeTier, history: effectiveHistory, historyEstimated, poolCreatedAt,
      fallbackCloses,
      fees24hUsd: current?.fees24hUsd ?? (current?.tvlUsd != null && current?.apy != null ? (current.tvlUsd * current.apy) / 100 / 365 : undefined),
      tokenUsd, tvlUsd: current?.tvlUsd ?? null,
      depositUsd, tickLower: ticks.tickLower, tickUpper: ticks.tickUpper,
      horizonDays, movePct, flip, gasUsd: GAS_EST_USD,
      rewardAprPct: selected.aprKind === 'gauge' ? selected.apy : undefined,
      rewardLabel: selected.aprLabel,
      compound,
    });
  }, [pool, feeTier, effectiveHistory, historyEstimated, poolCreatedAt, fallbackCloses, current, tokenUsd, depositUsd, ticks, horizonDays, movePct, flip, selected, compound]);

  // Tick liquidity converted to display space (quote-asset orientation) for
  // the depth histogram.
  const dispTickLiq = useMemo(() => {
    if (!tickLiq) return null;
    return flip
      ? tickLiq.map((p) => ({ ...p, price: p.price > 0 ? 1 / p.price : 0 })).filter((p) => p.price > 0)
      : tickLiq;
  }, [tickLiq, flip]);

  // Any range drag from the summary bar lands here: display
  // prices → snapped usable ticks → new SimState → every section re-derives.
  const onDispRange = useCallback((dLo: number, dHi: number) => {
    if (!pool || !(dLo > 0) || !(dHi > dLo)) return;
    const pLo = flip ? 1 / dHi : dLo;
    const pHi = flip ? 1 / dLo : dHi;
    const toTick = (p: number) => Math.round(Math.log(p * 10 ** (pool.decimals1 - pool.decimals0)) / Math.log(1.0001));
    const tickLower = nearestUsableTick(toTick(pLo), spacing);
    let tickUpper = nearestUsableTick(toTick(pHi), spacing);
    if (tickUpper <= tickLower) tickUpper = tickLower + spacing;
    setCustomTicks({ tickLower, tickUpper });
    setStrategy('custom');
  }, [pool, flip, spacing]);

  const deploySupported = chainId === 1 || (chainId === 4663 && dex === 'uniswap');
  const deployChainId: 1 | 4663 = chainId === 4663 ? 4663 : 1;
  // A third-party V3 fork pool is simulate-only: the deploy flow mints through
  // the Uniswap/PancakeSwap router, which would resolve a different (or no)
  // pool for the same pair+fee. The simulation itself is still exact — it reads
  // the fork pool's own state.
  const canDeploy = deploySupported && !selected.dexLabel && (!isV4 || (!!v4Pool && isNativeCurrency(v4Pool.hooks)));
  const dexLabel = selected.dexLabel ?? (dex === 'pancakeswap' ? 'PancakeSwap V3' : `Uniswap ${isV4 ? 'V4' : 'V3'}`);

  const sectionProps = { isMobile };

  return (
    <Portal>
      <div style={{ position: 'fixed', top: 0, left: sidebarWidth, right: 0, bottom: 0, zIndex: 340, background: btb.bg, overflowY: 'auto' }}>
        <div style={{ maxWidth: 860, margin: '0 auto', padding: isMobile ? '14px 14px 96px' : '18px 24px 24px' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div onClick={onClose} title="Back to pool comparison" style={{
              width: 30, height: 30, borderRadius: 999, flexShrink: 0, cursor: 'pointer',
              background: 'rgba(255,255,255,0.08)', border: btb.borderSoft,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name="back" size={14} color={btb.textMuted} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ color: btb.text, fontSize: 19, fontWeight: 800, letterSpacing: -0.4, lineHeight: 1.1 }}>LP Simulator</div>
              <div style={{ color: btb.textMuted, fontSize: 12.5, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {pool ? `${pool.symbol0} / ${pool.symbol1} · ${fmtFeeTier(feeTier)} · ${dexLabel}` : `${dexLabel} · ${chainName}`}
              </div>
            </div>
            {/* Horizon quick picker */}
            <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 3, flexShrink: 0 }}>
              {[7, 30, 90, 180].map((d) => (
                <button key={d} onClick={() => setHorizonDays(d)} style={{
                  height: 28, padding: isMobile ? '0 8px' : '0 11px', borderRadius: 9, border: 'none', cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: 11.5, fontWeight: 800,
                  background: horizonDays === d ? 'rgba(82,227,164,0.2)' : 'transparent',
                  color: horizonDays === d ? '#52E3A4' : btb.textMuted,
                }}>{d}d</button>
              ))}
            </div>
          </div>

          {loading ? (
            <div style={{ color: btb.textDim, fontSize: 13, padding: '20px 0' }}>Loading pool…</div>
          ) : error || !pool ? (
            <div style={{ padding: '10px 0' }}>
              <div style={{ color: btb.loss, fontSize: 13 }}>Couldn&apos;t load the pool{error ? ` (${error})` : ''}.</div>
              <button onClick={retry} style={{
                marginTop: 10, height: 36, padding: '0 18px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 13, fontWeight: 700, background: 'rgba(255,255,255,0.08)', border: btb.border, color: btb.text,
              }}>Retry</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Token safety — what an LP should check before depositing. */}
              {Object.keys(safetyByAddress).length > 0 && (
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ color: btb.textDim, fontSize: 9.5, fontWeight: 850, textTransform: 'uppercase', letterSpacing: 0.45 }}>Token safety</span>
                  {[pool.token0, pool.token1].map((addr) => {
                    const s = safetyByAddress[addr?.toLowerCase() ?? ''];
                    if (!s) return null;
                    const sym = addr === pool.token0 ? pool.symbol0 : pool.symbol1;
                    const flags: string[] = [];
                    if (s.spam) flags.push('SPAM-flagged');
                    if (s.honeypot) flags.push('HONEYPOT');
                    if (s.buyTaxPct != null || s.sellTaxPct != null) {
                      flags.push(`tax ${s.buyTaxPct?.toFixed(1) ?? '0'}%/${s.sellTaxPct?.toFixed(1) ?? '0'}%`);
                    }
                    const risky = s.spam || s.honeypot;
                    const warm = (s.top10Share ?? 0) > 0.5;
                    return (
                      <span
                        key={addr}
                        title={`Top 10 holders${s.top10Share != null ? ` hold ${(s.top10Share * 100).toFixed(0)}% of supply` : ''}${s.holders != null ? `, ${s.holders.toLocaleString('en-US')} holders total` : ''}${flags.length ? ` — ${flags.join(', ')}` : ''}. Source: explorer + GoPlus.`}
                        style={{
                          color: risky ? btb.loss : warm ? btb.amber : btb.textMuted,
                          fontSize: 10.5, fontWeight: 700,
                          background: risky ? 'rgba(255,107,122,.1)' : warm ? 'rgba(255,202,107,.08)' : 'rgba(255,255,255,.04)',
                          border: risky ? '1px solid rgba(255,107,122,.3)' : warm ? '1px solid rgba(255,202,107,.25)' : btb.borderSoft,
                          borderRadius: 8, padding: '3px 8px',
                        }}
                      >
                        {sym}{s.top10Share != null ? ` · top10 ${(s.top10Share * 100).toFixed(0)}%` : ''}{s.holders != null ? ` · ${s.holders.toLocaleString('en-US')} holders` : ''}{flags.length > 0 ? ` · ${flags.join(' · ')}` : ''}
                      </span>
                    );
                  })}
                </div>
              )}
              {sim && (
                <PositionSummary
                  sim={sim}
                  onToggleFlip={() => setFlipManual(!flip)}
                  onRange={onDispRange}
                  depositStr={depositStr}
                  setDepositStr={setDepositStr}
                  compound={compound}
                  setCompound={setCompound}
                  feeOptions={feeOptions}
                  feeTier={feeTier}
                  setFeeTier={(f) => { setFeeTier(f); setCustomTicks(null); }}
                  feeLocked={isV4}
                  {...sectionProps}
                />
              )}
              {!sim && depositUsd > 0 && (
                <div style={{ color: btb.amber, fontSize: 12.5, background: 'rgba(255,179,107,0.08)', border: '1px solid rgba(255,179,107,0.3)', borderRadius: 14, padding: '12px 14px' }}>
                  Waiting for USD price data for this pair. The builder below works; the analytics appear as soon as prices load.
                </div>
              )}

              {sim && <RealBacktest sim={sim} {...sectionProps} />}

              {sim && (
                <>
                  <PriceDistribution sim={sim} />
                  {dispTickLiq && dispTickLiq.length > 0 && (
                    <Section
                      kicker="Liquidity depth"
                      title="Where the pool's liquidity sits"
                      subtitle="Existing LPs concentrated by price. Tall bars are where your fees get shared with others; a lonely band earns alone but takes the full IL when price crosses it. Drag the range lines directly on the chart."
                    >
                      <LiquidityDepthChart
                        points={dispTickLiq}
                        min={sim.dispLower}
                        max={sim.dispUpper}
                        current={sim.dispPrice}
                        onChange={onDispRange}
                      />
                    </Section>
                  )}
                  <FeePanel sim={sim} {...sectionProps} />
                  <ILPanel sim={sim} isMobile={isMobile} />
                  <PnlWaterfall sim={sim} />
                  <ComparisonPanel sim={sim} />
                  <RiskRadar sim={sim} {...sectionProps} />
                  <SensitivityPanel sim={sim} movePct={movePct} setMovePct={setMovePct} {...sectionProps} />
                  <ScenarioCards sim={sim} setMovePct={setMovePct} {...sectionProps} />
                  <Timeline sim={sim} setHorizonDays={setHorizonDays} {...sectionProps} />
                  <div style={{ color: btb.textDim, fontSize: 10.5, lineHeight: 1.55, padding: '0 4px' }}>
                    Free LP simulator, no wallet needed. Estimates use this pool&apos;s recent fees, your share of in range liquidity, and a lognormal price model
                    fitted to the pair&apos;s own volatility{sim.usingFallbackHistory ? ' (approximate trend data for this pool)' : ''}. USD figures treat {sim.dispQuote} as the stable side of the pair.
                    Nothing here is financial advice or a guarantee.
                  </div>
                  <DeployFooter sim={sim} onDeploy={() => setDeploying(true)} canDeploy={canDeploy} {...sectionProps} />
                </>
              )}
            </div>
          )}
        </div>

        {deploying && ticks && (
          <CreatePosition
            tokenA={!isV4 ? mintTokenA : undefined}
            tokenB={!isV4 ? mintTokenB : undefined}
            initialFee={!isV4 ? feeTier : undefined}
            initialTicks={ticks}
            v4PoolId={selected.v4PoolId}
            dex={dex}
            chainId={deployChainId}
            fees24hUsd={current?.fees24hUsd}
            onClose={() => setDeploying(false)}
            onDone={() => { setDeploying(false); onClose(); }}
          />
        )}
      </div>
    </Portal>
  );
}
