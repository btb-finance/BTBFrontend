'use client';
import { useSyncExternalStore } from 'react';
import { btb } from '../design-tokens';
import { epochIdAt, epochWindow } from '../../../convex/xpRules';

const MS_PER_DAY = 86_400_000;

// A shared once-a-second clock; snapshots are whole seconds so React sees a stable value between ticks.
const subscribeSecond = (onTick: () => void) => { const t = setInterval(onTick, 1_000); return () => clearInterval(t); };
const nowSecond = () => Math.floor(Date.now() / 1_000) * 1_000;

/**
 * The next epoch flip, ticking every second: when this week's points are counted and the pot is shared out
 * (Friday 00:00 UTC). It keeps its own clock, so the rest of the dashboard does not re-render every second.
 */
export function EpochTimer({ epochId, bare = false, mobile: isMobile = false }: { epochId: number; bare?: boolean; mobile?: boolean }) {
  // No clock on the server (the Home preview renders this there) or while hydrating, so both render '--'; then the
  // browser's clock, ticking each second. The app mounts it client-side, where the clock is there from the start.
  const clock = useSyncExternalStore(subscribeSecond, nowSecond, () => null);
  const now = clock ?? 0;
  // Past the flip the next week's window takes over straight away, so the timer never sits at zero.
  const { startsAt, endsAt } = epochWindow(epochIdAt(now));
  const left = Math.max(0, endsAt - now);
  const parts = [
    [Math.floor(left / MS_PER_DAY), 'd'],
    [Math.floor((left % MS_PER_DAY) / 3_600_000), 'h'],
    [Math.floor((left % 3_600_000) / 60_000), 'm'],
    [Math.floor((left % 60_000) / 1_000), 's'],
  ] as const;
  const done = clock == null ? 0 : Math.min(1, Math.max(0, (now - startsAt) / (endsAt - startsAt)));
  return (
    <div style={bare ? { display: 'flex', flexDirection: 'column', gap: 10 } : { borderRadius: 18, padding: '14px 16px', border: btb.borderSoft, background: 'rgba(var(--fg-rgb), 0.04)', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: btb.textMuted, fontSize: 12, fontWeight: 700 }}>Next epoch flips in</div>
          <div style={{ color: btb.textDim, fontSize: 11, marginTop: 2 }}>Week {(clock != null && epochIdAt(now)) || epochId} · pays out Friday 00:00 UTC</div>
        </div>
        {/* On a phone the four boxes take their own full-width row, evenly split, instead of wrapping beside the label. */}
        <div style={{ display: 'flex', gap: 6, ...(isMobile ? { width: '100%' } : {}) }}>
          {parts.map(([v, unit]) => (
            <div key={unit} style={{ flex: isMobile ? 1 : undefined, minWidth: isMobile ? 0 : 48, padding: isMobile ? '8px 0' : '6px 8px', borderRadius: 10, background: 'rgba(var(--fg-rgb), 0.06)', textAlign: 'center' }}>
              <span style={{ color: btb.text, fontSize: isMobile ? 22 : 20, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{clock == null ? '--' : String(v).padStart(2, '0')}</span>
              <span style={{ color: btb.textDim, fontSize: 11, fontWeight: 700, marginLeft: 2 }}>{unit}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ height: 6, borderRadius: 999, background: 'rgba(var(--fg-rgb), 0.07)', overflow: 'hidden' }}>
        <div style={{ width: `${done * 100}%`, height: '100%', background: btb.green, borderRadius: 999 }}/>
      </div>
    </div>
  );
}
