'use client';

import { btb } from './design-tokens';

/**
 * Visualises the token split a concentrated-liquidity range needs at the current price, from the
 * on-chain `BTBLPQuoter.rangeValueSplitBps` readout. Turns "you need 99% ETH / 1% USDC" into a bar
 * the owner can read at a glance, so adding liquidity never feels like a blind guess.
 */
export function RangeRatioBar({ symbol0, symbol1, value0Bps, value1Bps, swapPct, note }: {
  symbol0: string;
  symbol1: string;
  value0Bps: number;
  value1Bps: number;
  swapPct?: number;
  note?: string;
}) {
  const total = value0Bps + value1Bps || 1;
  const pct0 = Math.round((value0Bps / total) * 1000) / 10;
  const pct1 = Math.round((value1Bps / total) * 1000) / 10;
  const oneSided = pct0 >= 99.5 || pct1 >= 99.5;

  return (
    <div style={{ marginTop: 9, padding: 11, borderRadius: 13, background: btb.surfaceSoft, border: btb.borderSoft }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <span style={{ color: btb.textMuted, fontSize: 10.5, fontWeight: 750, letterSpacing: 0.2 }}>
          This range needs
        </span>
        <span style={{ color: btb.textDim, fontSize: 9.5 }}>at current price</span>
      </div>

      <div style={{ display: 'flex', height: 9, borderRadius: 999, overflow: 'hidden', background: 'rgba(255,255,255,0.05)' }}>
        <div style={{ width: `${pct0}%`, background: btb.gradGreen, transition: 'width .25s ease' }} />
        <div style={{ width: `${pct1}%`, background: 'rgba(255,255,255,0.28)', transition: 'width .25s ease' }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
        <Legend dot={btb.green} pct={pct0} symbol={symbol0} align="left" />
        <Legend dot="rgba(255,255,255,0.5)" pct={pct1} symbol={symbol1} align="right" />
      </div>

      {(swapPct !== undefined || note) && (
        <div style={{ color: btb.textDim, fontSize: 10, lineHeight: 1.4, marginTop: 8 }}>
          {note ?? (oneSided
            ? `Single-sided range — the agent converts everything into ${pct0 >= pct1 ? symbol0 : symbol1}.`
            : swapPct !== undefined && swapPct > 0.05
              ? `The agent swaps only ~${swapPct.toFixed(1)}% to hit this mix, then adds both sides.`
              : 'Already balanced for this range — no swap needed.')}
        </div>
      )}
    </div>
  );
}

function Legend({ dot, pct, symbol, align }: { dot: string; pct: number; symbol: string; align: 'left' | 'right' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexDirection: align === 'right' ? 'row-reverse' : 'row' }}>
      <span style={{ width: 7, height: 7, borderRadius: 999, background: dot, flexShrink: 0 }} />
      <span style={{ color: btb.text, fontSize: 12, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
        {pct}% <span style={{ color: btb.textMuted, fontWeight: 650 }}>{symbol}</span>
      </span>
    </div>
  );
}
