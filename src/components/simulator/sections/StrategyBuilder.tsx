'use client';
/** Section 2 — position setup. Range is controlled once, in the summary bar. */
import { btb } from '../../design-tokens';
import { fmtFeeTier } from '@/protocols/dexs/uniswap';
import { fmtApr, fmtCompactUsd } from '../../../lib/pools';
import { Section, OptionCard, PlusDivider } from '../ui';

const AMOUNT_CHIPS = [1000, 10000, 50000];

export function StrategyBuilder(props: {
  isMobile: boolean;
  depositStr: string;
  setDepositStr: (s: string) => void;
  feeOptions: { fee: number; exists: boolean; tvlUsd?: number; aprPct?: number }[];
  feeTier: number;
  setFeeTier: (f: number) => void;
  feeLocked: boolean; // V4: the pool id pins one fee
}) {
  const p = props;

  return (
    <Section
      kicker="Section 2"
      title="Position setup"
      subtitle="Set your investment and fee tier. Your range is controlled in the summary above."
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
    </Section>
  );
}
