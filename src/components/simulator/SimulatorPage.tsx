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
import { useSidebar } from '../../lib/SidebarContext';
import { STABLES } from '../../lib/pools';
import {
  nearestUsableTick, fmtFeeTier, isNativeCurrency, UNISWAP_V3_DEPLOYMENT,
  type V4MintPool,
} from '@/protocols/dexs/uniswap';
import { PANCAKE_V3_DEPLOYMENT } from '@/protocols/dexs/pancakeswap';
import { useSimPools, usePoolExtras } from './useSimData';
import { deriveSim, STRATEGY_SIGMA, type Strategy } from './simState';
import { estimateSigmaDaily } from './math/probability';
import { PositionSummary } from './sections/PositionSummary';
import { RealBacktest } from './sections/RealBacktest';
import { StrategyBuilder } from './sections/StrategyBuilder';
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

/** Flat mint + collect gas estimate (USD) used in every net figure — a stated
 * approximation at typical mainnet gas, not a live quote. */
const GAS_EST_USD = 8;

/** What the Simulate screen knows about a pool it found — structurally
 * compatible with its FoundPool rows. */
export interface SimPoolChoice {
  protocol: 'uniswap-v3' | 'uniswap-v4' | 'pancakeswap-v3';
  feeTier: number;
  v4PoolId?: `0x${string}`;
  tvlUsd?: number;
  apy?: number;
  fees24hUsd?: number;
}

export function SimulatorPage({ tokenA, tokenB, selected, siblings, onClose }: {
  /** Token addresses for V3-architecture pools ('eth' allowed). Unused for V4. */
  tokenA?: string;
  tokenB?: string;
  selected: SimPoolChoice;
  /** Same-protocol pools at other fee tiers, for the fee tier cards' TVL/APR. */
  siblings: SimPoolChoice[];
  onClose: () => void;
}) {
  const { width: sidebarWidth, isMobile } = useSidebar();
  const isV4 = selected.protocol === 'uniswap-v4';
  const dex = selected.protocol === 'pancakeswap-v3' ? 'pancakeswap' : 'uniswap';
  const deployment = dex === 'pancakeswap' ? PANCAKE_V3_DEPLOYMENT : UNISWAP_V3_DEPLOYMENT;

  const [feeTier, setFeeTier] = useState(selected.feeTier);
  const [depositStr, setDepositStr] = useState('10000');
  const [strategy, setStrategy] = useState<Strategy>('balanced');
  const [customTicks, setCustomTicks] = useState<{ tickLower: number; tickUpper: number } | null>(null);
  const [horizonDays, setHorizonDays] = useState(30);
  const [movePct, setMovePct] = useState(0);
  const [flipManual, setFlipManual] = useState<boolean | null>(null);
  const [deploying, setDeploying] = useState(false);

  const { pools, loading, error, retry } = useSimPools(tokenA, tokenB, selected.v4PoolId, dex);

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

  const { history, fallbackCloses, tokenUsd, tickLiq } = usePoolExtras(pool, isV4, selected.v4PoolId, dex, spacing);

  // Per-tier market data (TVL/APR/fees) from the Simulate screen's findings.
  const tierData = (fee: number) => siblings.find((s) => s.feeTier === fee) ?? (fee === selected.feeTier ? selected : undefined);
  const current = tierData(feeTier);

  // ── Orientation: quote the volatile token in the stablecoin, like the sheet ──
  const autoFlip = useMemo(() => {
    if (!pool) return false;
    const s0 = STABLES.has((pool.symbol0 ?? '').toUpperCase());
    const s1 = STABLES.has((pool.symbol1 ?? '').toUpperCase());
    return s0 && !s1;
  }, [pool]);
  const flip = flipManual ?? autoFlip;

  const price = pool ? ((Number(pool.sqrtPriceX96) / 2 ** 96) ** 2) * 10 ** (pool.decimals0 - pool.decimals1) : 0;
  const poolToDisp = (p: number) => (flip ? (p > 0 ? 1 / p : 0) : p);

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

  const depositUsd = parseFloat(depositStr) || 0;

  const sim = useMemo(() => {
    if (!pool || !ticks) return null;
    return deriveSim({
      pool, feeTier, history, fallbackCloses,
      fees24hUsd: current?.fees24hUsd ?? (current?.tvlUsd != null && current?.apy != null ? (current.tvlUsd * current.apy) / 100 / 365 : undefined),
      tokenUsd, tvlUsd: current?.tvlUsd ?? null,
      depositUsd, tickLower: ticks.tickLower, tickUpper: ticks.tickUpper,
      horizonDays, movePct, flip, gasUsd: GAS_EST_USD,
    });
  }, [pool, feeTier, history, fallbackCloses, current, tokenUsd, depositUsd, ticks, horizonDays, movePct, flip]);

  // Any range drag (summary bar, price chart, depth chart) lands here: display
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

  const dispCloses = useMemo(() => (histCloses.length > 1 ? histCloses.map(poolToDisp) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [histCloses, flip]);
  const dispTickLiq = useMemo(() => {
    if (!tickLiq || !pool) return null;
    const scale = 10 ** (pool.decimals0 - pool.decimals1);
    return tickLiq.map((p) => ({ ...p, price: poolToDisp(p.price * scale) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickLiq, pool, flip]);

  const canDeploy = !isV4 || (!!v4Pool && isNativeCurrency(v4Pool.hooks));
  const dexLabel = dex === 'pancakeswap' ? 'PancakeSwap V3' : `Uniswap ${isV4 ? 'V4' : 'V3'}`;

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
                {pool ? `${pool.symbol0} / ${pool.symbol1} · ${fmtFeeTier(feeTier)} · ${dexLabel}` : `${dexLabel} · Ethereum`}
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
              {sim && (
                <PositionSummary
                  sim={sim}
                  onToggleFlip={() => setFlipManual(!flip)}
                  onRange={onDispRange}
                  {...sectionProps}
                />
              )}
              {!sim && depositUsd > 0 && (
                <div style={{ color: btb.amber, fontSize: 12.5, background: 'rgba(255,179,107,0.08)', border: '1px solid rgba(255,179,107,0.3)', borderRadius: 14, padding: '12px 14px' }}>
                  Waiting for USD price data for this pair. The builder below works; the analytics appear as soon as prices load.
                </div>
              )}

              {sim && <RealBacktest sim={sim} {...sectionProps} />}

              <StrategyBuilder
                {...sectionProps}
                depositStr={depositStr}
                setDepositStr={setDepositStr}
                feeOptions={deployment.feeTiers.map((f) => ({
                  fee: f,
                  exists: !!pools?.[f]?.exists,
                  tvlUsd: tierData(f)?.tvlUsd,
                  aprPct: tierData(f)?.apy,
                }))}
                feeTier={feeTier}
                setFeeTier={(f) => { setFeeTier(f); setCustomTicks(null); }}
                feeLocked={isV4}
                strategy={strategy}
                setStrategy={(s) => { setStrategy(s); setCustomTicks(null); }}
                sigmaDaily={sigmaDaily}
                horizonDays={horizonDays}
                dispCloses={dispCloses}
                dispPrice={poolToDisp(price)}
                dispLower={sim ? sim.dispLower : 0}
                dispUpper={sim ? sim.dispUpper : 0}
                onDispRange={onDispRange}
                dispTickLiq={dispTickLiq}
                dispBase={flip ? pool.symbol1 : pool.symbol0}
                dispQuote={flip ? pool.symbol0 : pool.symbol1}
              />

              {sim && (
                <>
                  <PriceDistribution sim={sim} />
                  <FeePanel sim={sim} {...sectionProps} />
                  <ILPanel sim={sim} />
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
            tokenA={!isV4 ? (tokenA as `0x${string}`) : undefined}
            tokenB={!isV4 ? (tokenB as `0x${string}`) : undefined}
            initialFee={!isV4 ? feeTier : undefined}
            initialTicks={ticks}
            v4PoolId={selected.v4PoolId}
            dex={dex}
            fees24hUsd={current?.fees24hUsd}
            onClose={() => setDeploying(false)}
            onDone={() => { setDeploying(false); onClose(); }}
          />
        )}
      </div>
    </Portal>
  );
}
