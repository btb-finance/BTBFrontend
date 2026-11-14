'use client';
/** Smart LPs: positions in this pool that stayed in range and beat holding,
 * read from the chain daily (convex/smartLpsActions.ts). One tap copies a
 * position's range, re-centred on today's price. */
import { useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import type { SmartLp } from '../../../lib/smartLps';
import { btb } from '../../design-tokens';
import { Section, fmtUsd, fmtSignedPct, fmtPct } from '../ui';

export const SMART_LPS_NOTE = 'Positions in range at least 70% of the time, ranked by result against just holding the tokens. Read from the chain daily.';

/** The rows, shared by the simulator card and the Discover sheet. */
export function SmartLpRows({ top, flip, onUse, limit }: {
  top: SmartLp[];
  /** Display orientation: flipping the price swaps and inverts the range edges. */
  flip: boolean;
  onUse: (x: SmartLp) => void;
  limit?: number;
}) {
  const edges = (lowPct: number, highPct: number) => flip
    ? [(1 / (1 + highPct / 100) - 1) * 100, (1 / (1 + lowPct / 100) - 1) * 100]
    : [lowPct, highPct];
  const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : 'unknown');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {top.slice(0, limit ?? top.length).map((x) => {
        const [lo, hi] = edges(x.lowPct, x.highPct);
        return (
          <div key={x.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(var(--fg-rgb), 0.04)', borderRadius: 12, padding: '9px 11px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: btb.text, fontSize: 13, fontWeight: 750 }}>
                {fmtPct(lo)} to {fmtSignedPct(hi)}
                <span style={{ color: btb.textDim, fontWeight: 600, fontSize: 11 }}> · {Math.round(x.days)}d{x.inRangePct != null ? ` · ${x.inRangePct}% in range` : ''}</span>
              </div>
              <div style={{ color: btb.textMuted, fontSize: 11, marginTop: 2 }}>
                fees {fmtPct(x.feeApr, 0)} APR · vs hold <span style={{ color: x.netPct >= 0 ? btb.green : btb.loss, fontWeight: 700 }}>{fmtSignedPct(x.netPct, 2)}</span>
                {x.valueUsd != null ? ` · ${fmtUsd(x.valueUsd)}` : ''} · {short(x.owner)}
              </div>
            </div>
            <button
              onClick={() => onUse(x)}
              style={{ flexShrink: 0, height: 30, padding: '0 12px', borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11.5, fontWeight: 800, background: 'rgba(var(--green-rgb), 0.16)', color: 'var(--btb-green)' }}
            >
              Use range
            </button>
          </div>
        );
      })}
    </div>
  );
}

/** The simulator card. */
export function SmartLps({ chainId, pool, flip, onUseRange, isMobile }: {
  chainId: number;
  /** Pool contract address; V4 pools are not covered yet. */
  pool?: string;
  flip: boolean;
  /** Tick offsets from the current tick: the copied range. */
  onUseRange: (dLo: number, dHi: number) => void;
  isMobile: boolean;
}) {
  const data = useQuery(api.smartLps.forPool, pool ? { chainId, pool } : 'skip');
  if (!pool || !data || data.top.length === 0) return null;
  return (
    <Section kicker="Smart LPs" title={`${data.smart} of ${data.measured} LPs here beat holding`} subtitle={SMART_LPS_NOTE}>
      <SmartLpRows top={data.top} flip={flip} onUse={(x) => onUseRange(x.dLo, x.dHi)} limit={isMobile ? 5 : 8} />
    </Section>
  );
}
