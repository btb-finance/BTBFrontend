'use client';
/** Section 12 — Deploy Summary. Sticky footer with the six numbers that
 * matter, always visible, plus the button that turns the simulation into a
 * real position (the existing CreatePosition mint flow, prefilled). */
import { btb } from '../../design-tokens';
import { Button } from '../../Button';
import { fmtUsd, fmtSignedUsd, fmtPct } from '../ui';
import type { Sim } from '../simState';

export function DeployFooter({ sim, onDeploy, canDeploy, isMobile }: {
  sim: Sim;
  onDeploy: () => void;
  canDeploy: boolean;
  isMobile: boolean;
}) {
  const m1 = sim.timeline.find((t) => t.days === 30);
  const expected30d = m1 ? m1.expectedValueUsd - sim.depositUsd : null;

  const cells: { label: string; value: string; color?: string }[] = [
    { label: 'Investment', value: fmtUsd(sim.depositUsd) },
    { label: 'Expected APR', value: fmtPct(sim.netAprPct), color: sim.netAprPct >= 0 ? btb.green : btb.loss },
    { label: 'Expected 30D', value: expected30d != null ? fmtSignedUsd(expected30d) : '—', color: expected30d != null && expected30d >= 0 ? btb.green : btb.loss },
    { label: 'Worst Case', value: fmtSignedUsd(sim.worstUsd), color: btb.loss },
    { label: 'Best Case', value: fmtSignedUsd(sim.bestUsd), color: btb.green },
    { label: 'Prob. Positive', value: `${Math.round(sim.probPositive * 100)}%`, color: sim.probPositive >= 0.5 ? btb.green : btb.amber },
  ];
  const shown = isMobile ? [cells[1], cells[2], cells[5]] : cells;

  return (
    <div style={{
      position: 'sticky', bottom: isMobile ? 'calc(64px + env(safe-area-inset-bottom, 0px))' : 0, zIndex: 20,
      padding: isMobile ? '0 0 10px' : '0 0 14px',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 14,
        background: 'rgba(10,10,15,0.94)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
        border: '1px solid rgba(255,255,255,0.12)', borderRadius: 18, padding: isMobile ? '10px 12px' : '12px 18px',
        boxShadow: '0 -6px 28px rgba(0,0,0,0.45)',
      }}>
        <div style={{ display: 'flex', gap: isMobile ? 10 : 18, flex: 1, minWidth: 0, overflowX: 'auto' }}>
          {shown.map((c) => (
            <div key={c.label} style={{ flexShrink: 0 }}>
              <div style={{ color: btb.textDim, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap' }}>{c.label}</div>
              <div style={{ color: c.color ?? btb.text, fontSize: isMobile ? 13 : 14.5, fontWeight: 800, letterSpacing: -0.2, whiteSpace: 'nowrap' }}>{c.value}</div>
            </div>
          ))}
        </div>
        {canDeploy ? (
          <Button variant="success" size="sm" onClick={onDeploy} style={{ flexShrink: 0, fontWeight: 800, fontSize: 13, padding: '0 18px' }}>
            Deploy Position
          </Button>
        ) : (
          <span style={{ color: btb.textDim, fontSize: 11, flexShrink: 0, maxWidth: 150, lineHeight: 1.3 }}>
            Deploy not available for this pool in app
          </span>
        )}
      </div>
    </div>
  );
}
