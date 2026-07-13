'use client';
/** Section 2 — Strategy Builder. Big option cards instead of tiny inputs:
 * investment amount, fee tier (with real TVL/APR on each card), a strategy
 * preset defined in units of this pair's own volatility, and a visual range
 * slider on the price history. */
import { btb } from '../../design-tokens';
import { RangeChart } from '../../RangeChart';
import { LiquidityDepthChart } from '../../LiquidityDepthChart';
import { fmtFeeTier } from '@/protocols/dexs/uniswap';
import { fmtApr, fmtCompactUsd } from '../../../lib/pools';
import { Section, OptionCard, PlusDivider, fmtPrice } from '../ui';
import { STRATEGY_SIGMA, type Strategy } from '../simState';

const AMOUNT_CHIPS = [1000, 10000, 50000];

const STRATEGY_META: { key: Exclude<Strategy, 'custom'>; title: string; blurb: string }[] = [
  { key: 'conservative', title: 'Conservative', blurb: 'Wide range. Stays in range through big swings, earns a smaller share.' },
  { key: 'balanced', title: 'Balanced', blurb: 'Covers a typical move for this pair. The sensible default.' },
  { key: 'aggressive', title: 'Aggressive', blurb: 'Tight range. Big fee share while in range, exits range easily.' },
];

export function StrategyBuilder(props: {
  isMobile: boolean;
  depositStr: string;
  setDepositStr: (s: string) => void;
  feeOptions: { fee: number; exists: boolean; tvlUsd?: number; aprPct?: number }[];
  feeTier: number;
  setFeeTier: (f: number) => void;
  feeLocked: boolean; // V4: the pool id pins one fee
  strategy: Strategy;
  setStrategy: (s: Exclude<Strategy, 'custom'>) => void;
  sigmaDaily: number;
  horizonDays: number;
  dispCloses: number[] | null;
  dispPrice: number;
  dispLower: number;
  dispUpper: number;
  onDispRange: (lo: number, hi: number) => void;
  dispTickLiq: { tick: number; price: number; liquidity: number }[] | null;
  dispBase: string;
  dispQuote: string;
}) {
  const p = props;
  const widthPct = (k: number) => {
    const s = k * p.sigmaDaily * Math.sqrt(Math.max(p.horizonDays, 1));
    return (Math.exp(s) - 1) * 100;
  };

  return (
    <Section
      kicker="Section 2"
      title="Strategy Builder"
      subtitle="Four choices build the position. Everything below recalculates as you change them."
    >
      {/* Investment */}
      <div style={{ color: btb.textDim, fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>Investment</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        {AMOUNT_CHIPS.map((v) => (
          <button key={v} onClick={() => p.setDepositStr(String(v))} style={{
            flex: 1, minWidth: 90, height: 38, borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
            background: p.depositStr === String(v) ? 'rgba(82,227,164,0.16)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${p.depositStr === String(v) ? 'rgba(82,227,164,0.5)' : 'rgba(255,255,255,0.1)'}`,
            color: p.depositStr === String(v) ? '#52E3A4' : btb.textMuted,
          }}>${v.toLocaleString('en-US')}</button>
        ))}
      </div>
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: btb.textMuted, fontSize: 20, fontWeight: 800 }}>$</span>
        <input
          value={p.depositStr}
          onChange={(e) => p.setDepositStr(e.target.value.replace(/[^0-9.]/g, ''))}
          inputMode="decimal" placeholder="10000"
          style={{
            width: '100%', height: 52, boxSizing: 'border-box', paddingLeft: 34, paddingRight: 14,
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 14,
            color: btb.text, fontSize: 22, fontWeight: 800, fontFamily: 'inherit', outline: 'none', letterSpacing: -0.3,
          }} />
      </div>

      <PlusDivider />

      {/* Fee tier */}
      <div style={{ color: btb.textDim, fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>Fee Tier</div>
      {p.feeLocked ? (
        <div style={{ color: btb.textMuted, fontSize: 12, background: 'rgba(255,255,255,0.04)', border: btb.borderSoft, borderRadius: 12, padding: '10px 13px' }}>
          {fmtFeeTier(p.feeTier)} · fixed by this V4 pool
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, flexWrap: p.isMobile ? 'wrap' : 'nowrap' }}>
          {p.feeOptions.filter((f) => f.exists).map((f) => (
            <OptionCard
              key={f.fee}
              selected={p.feeTier === f.fee}
              onClick={() => p.setFeeTier(f.fee)}
              title={fmtFeeTier(f.fee)}
              sub={[
                f.tvlUsd != null ? `TVL ${fmtCompactUsd(f.tvlUsd)}` : null,
                f.aprPct != null ? `APR ${fmtApr(f.aprPct)}` : null,
              ].filter(Boolean).join(' · ') || 'live pool'}
            />
          ))}
        </div>
      )}

      <PlusDivider />

      {/* Strategy */}
      <div style={{ color: btb.textDim, fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>Strategy</div>
      <div style={{ display: 'flex', gap: 8, flexDirection: p.isMobile ? 'column' : 'row' }}>
        {STRATEGY_META.map((s) => (
          <OptionCard
            key={s.key}
            selected={p.strategy === s.key}
            onClick={() => p.setStrategy(s.key)}
            title={s.title}
            badge={`≈ ±${widthPct(STRATEGY_SIGMA[s.key]) < 1 ? widthPct(STRATEGY_SIGMA[s.key]).toFixed(1) : Math.round(widthPct(STRATEGY_SIGMA[s.key]))}%`}
            sub={s.blurb}
          />
        ))}
      </div>
      {p.strategy === 'custom' && (
        <div style={{ color: btb.amber, fontSize: 11, marginTop: 8 }}>
          Custom range set on the chart below. Pick a preset to snap back.
        </div>
      )}

      <PlusDivider />

      {/* Price range — visual slider on the real price history */}
      <div style={{ color: btb.textDim, fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>Price Range</div>
      {p.dispCloses && p.dispCloses.length > 1 ? (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: btb.borderSoft, borderRadius: 14, padding: '12px 12px 4px' }}>
          <RangeChart
            points={p.dispCloses}
            min={p.dispLower}
            max={p.dispUpper}
            current={p.dispPrice}
            onChange={p.onDispRange}
          />
          <div style={{ color: btb.textDim, fontSize: 11, textAlign: 'center', padding: '8px 0' }}>
            30 day price · {p.dispQuote} per {p.dispBase} · drag the handles to set a custom range
          </div>
        </div>
      ) : (
        <div style={{ color: btb.textDim, fontSize: 12, padding: '14px 0' }}>Loading price history…</div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, color: btb.textMuted, fontSize: 12, fontWeight: 700 }}>
        <span>Min {fmtPrice(p.dispLower)}</span>
        <span>Max {fmtPrice(p.dispUpper)}</span>
      </div>
      {p.dispTickLiq && p.dispTickLiq.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ color: btb.textDim, fontSize: 10.5, marginBottom: 6 }}>Where other LPs put their liquidity</div>
          <div style={{ background: 'rgba(255,255,255,0.03)', border: btb.borderSoft, borderRadius: 14, padding: '10px 8px 4px' }}>
            <LiquidityDepthChart
              points={p.dispTickLiq}
              min={p.dispLower}
              max={p.dispUpper}
              current={p.dispPrice}
              onChange={p.onDispRange}
            />
          </div>
        </div>
      )}
    </Section>
  );
}
