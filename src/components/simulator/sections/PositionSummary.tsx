'use client';
/** Section 1 — Position Summary. The at-a-glance hero AND the primary control:
 * the range bar is draggable, so setting the range here re-derives every
 * section below it against the pool's real on-chain state and fee history. */
import { useEffect, useRef, useState } from 'react';
import { btb } from '../../design-tokens';
import { TokenIcon } from '../../TokenIcon';
import { Glass } from '../../Glass';
import { fmtCompactUsd } from '../../../lib/pools';
import { fmtUsd, fmtPct, fmtPrice } from '../ui';
import type { Sim } from '../simState';

type DragKind = 'lo' | 'hi' | 'band';

export function PositionSummary({ sim, onToggleFlip, onRange, isMobile }: {
  sim: Sim;
  onToggleFlip: () => void;
  /** Commit a new range in DISPLAY price space. Drives the whole page. */
  onRange: (lo: number, hi: number) => void;
  isMobile: boolean;
}) {
  const [showFactors, setShowFactors] = useState(false);
  const [drag, setDrag] = useState<DragKind | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  // Domain and grab point are frozen for the gesture, so the px→price mapping
  // can't shift under the pointer while the range (and thus the domain) moves.
  const frozen = useRef<{ dLo: number; dHi: number; lo: number; hi: number; startX: number } | null>(null);

  // Log-space domain: the band plus 35% of its width each side, always wide
  // enough to show the live price even when it sits outside the range.
  const lo = Math.log(sim.dispLower), hi = Math.log(sim.dispUpper);
  const cur = Math.log(sim.dispPrice);
  const pad = (hi - lo) * 0.35 || 0.1;
  const live = { dLo: Math.min(lo - pad, cur - pad * 0.5), dHi: Math.max(hi + pad, cur + pad * 0.5) };
  const dom = drag && frozen.current ? { dLo: frozen.current.dLo, dHi: frozen.current.dHi } : live;

  const xPct = (p: number) => Math.max(0, Math.min(100, ((Math.log(p) - dom.dLo) / (dom.dHi - dom.dLo)) * 100));
  const bandL = xPct(sim.dispLower), bandR = xPct(sim.dispUpper), markX = xPct(sim.dispPrice);

  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => {
      const f = frozen.current;
      const rect = trackRef.current?.getBoundingClientRect();
      if (!f || !rect || rect.width === 0) return;
      const span = f.dHi - f.dLo;
      const lnAt = (clientX: number) => f.dLo + Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) * span;

      if (drag === 'band') {
        // Shift the whole range, keeping its width — the common "my range is in
        // the wrong place" gesture.
        const shift = ((e.clientX - f.startX) / rect.width) * span;
        onRange(Math.exp(Math.log(f.lo) + shift), Math.exp(Math.log(f.hi) + shift));
        return;
      }
      const p = Math.exp(lnAt(e.clientX));
      if (drag === 'lo') onRange(Math.min(p, f.hi * 0.995), f.hi);
      else onRange(f.lo, Math.max(p, f.lo * 1.005));
    };
    const up = () => { frozen.current = null; setDrag(null); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [drag, onRange]);

  const startDrag = (kind: DragKind) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    frozen.current = { ...live, lo: sim.dispLower, hi: sim.dispUpper, startX: e.clientX };
    setDrag(kind);
  };

  const statusColor = sim.inRange ? (sim.nearEdge ? btb.amber : btb.green) : btb.loss;
  const statusLabel = sim.inRange ? (sim.nearEdge ? '⚠ Near range edge' : '✓ In Range') : '✕ Out of Range';
  const accent = sim.inRange ? '#52E3A4' : '#FFB36B';

  const handle = (kind: 'lo' | 'hi', left: number) => (
    <div
      onPointerDown={startDrag(kind)}
      style={{
        position: 'absolute', left: `${left}%`, top: 0, bottom: 0, width: 34, marginLeft: -17,
        cursor: 'ew-resize', touchAction: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
      <div style={{
        width: 12, height: 30, borderRadius: 6, background: '#fff', border: `2px solid ${accent}`,
        boxShadow: drag === kind ? `0 0 12px ${accent}` : '0 2px 8px rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5,
      }}>
        <span style={{ width: 1, height: 10, background: '#8a8a92' }} />
        <span style={{ width: 1, height: 10, background: '#8a8a92' }} />
      </div>
    </div>
  );

  return (
    <Glass padding={0} radius={22}>
      <div style={{ padding: '18px 20px 16px' }}>
        {/* Header: pair · live badge · live price */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex' }}>
              <TokenIcon symbol={sim.dispBase} size={26} />
              <div style={{ marginLeft: -8 }}><TokenIcon symbol={sim.dispQuote} size={26} /></div>
            </div>
            <span style={{ color: btb.text, fontSize: 17, fontWeight: 800, letterSpacing: -0.3 }}>
              {sim.dispBase} / {sim.dispQuote}
            </span>
            <button onClick={onToggleFlip} title="Flip which token prices are quoted in" style={{
              height: 22, padding: '0 7px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 10, fontWeight: 700, background: 'rgba(255,255,255,0.07)', border: btb.borderSoft, color: btb.textMuted,
            }}>⇄</button>
          </div>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 800, color: btb.green,
            background: 'rgba(82,227,164,0.1)', border: '1px solid rgba(82,227,164,0.35)', borderRadius: 999, padding: '4px 9px',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: btb.green, boxShadow: '0 0 6px #52E3A4' }} />
            LIVE POOL DATA
          </span>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: btb.textDim, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Live Price</div>
            <div style={{ color: btb.text, fontSize: 16, fontWeight: 800, letterSpacing: -0.3 }}>
              {fmtPrice(sim.dispPrice)} <span style={{ color: btb.textDim, fontSize: 11, fontWeight: 600 }}>{sim.dispQuote}</span>
            </div>
          </div>
        </div>

        {/* Real pool numbers, straight from chain + indexer */}
        <div style={{
          display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 8, marginTop: 14,
        }}>
          {[
            { label: 'Pool TVL', value: sim.tvlUsd != null ? fmtCompactUsd(sim.tvlUsd) : '—', note: 'on chain' },
            { label: 'Pool fees / day', value: sim.poolDailyFeesUsd > 0 ? fmtUsd(sim.poolDailyFeesUsd) : '—', note: sim.hasFeeData ? '7 day average' : 'no data' },
            { label: 'Your liquidity share', value: sim.liquidityShare > 0 ? `${(sim.liquidityShare * 100).toPrecision(2)}%` : '0%', note: 'of in range liquidity' },
            { label: 'Pair volatility', value: `${(sim.sigmaDaily * 100).toFixed(1)}% / day`, note: sim.usingFallbackHistory ? 'approx history' : 'from 30 day history' },
          ].map((s) => (
            <div key={s.label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '8px 11px', minWidth: 0 }}>
              <div style={{ color: btb.textDim, fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.label}</div>
              <div style={{ color: btb.text, fontSize: 14, fontWeight: 800, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.value}</div>
              <div style={{ color: btb.textDim, fontSize: 9.5, marginTop: 1 }}>{s.note}</div>
            </div>
          ))}
        </div>

        {/* Draggable range bar — the page's primary control */}
        <div style={{ marginTop: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <span style={{ color: btb.textDim, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Range</span>
            <span style={{ color: drag ? btb.text : btb.textDim, fontSize: 10.5 }}>
              {drag ? 'every section below is recalculating' : 'drag the handles, or the band, to set your range'}
            </span>
          </div>
          <div ref={trackRef} style={{ position: 'relative', height: 40, touchAction: 'none' }}>
            {/* track */}
            <div style={{ position: 'absolute', left: 0, right: 0, top: 16, height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.07)' }} />
            {/* band (drag to shift) */}
            <div
              onPointerDown={startDrag('band')}
              style={{
                position: 'absolute', top: 13, height: 14, borderRadius: 999, cursor: 'grab', touchAction: 'none',
                left: `${bandL}%`, width: `${Math.max(bandR - bandL, 1)}%`,
                background: sim.inRange ? 'rgba(82,227,164,0.5)' : 'rgba(255,179,107,0.45)',
                boxShadow: sim.inRange ? '0 0 14px rgba(82,227,164,0.35)' : 'none',
              }} />
            {/* live price marker */}
            <div style={{ position: 'absolute', left: `${markX}%`, top: 5, transform: 'translateX(-50%)', pointerEvents: 'none' }}>
              <div style={{ width: 3, height: 30, borderRadius: 2, background: '#fff', boxShadow: '0 0 8px rgba(255,255,255,0.6)' }} />
            </div>
            {handle('lo', bandL)}
            {handle('hi', bandR)}
          </div>
          <div style={{ position: 'relative', height: 16, color: btb.textMuted, fontSize: 11.5, fontWeight: 700 }}>
            <span style={{ position: 'absolute', left: `${bandL}%`, transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}>{fmtPrice(sim.dispLower)}</span>
            <span style={{ position: 'absolute', left: `${markX}%`, transform: 'translateX(-50%)', color: btb.text, whiteSpace: 'nowrap' }}>{fmtPrice(sim.dispPrice)}</span>
            <span style={{ position: 'absolute', left: `${bandR}%`, transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}>{fmtPrice(sim.dispUpper)}</span>
          </div>
          <div style={{ color: btb.textDim, fontSize: 10.5, marginTop: 6 }}>
            Width ±{(((sim.dispUpper / sim.dispLower) ** 0.5 - 1) * 100).toFixed(1)}% · snapped to this pool&apos;s usable ticks
          </div>
        </div>

        {/* Status + stats + health */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.2fr 1fr', gap: 14, marginTop: 16 }}>
          <div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 999, padding: '5px 12px',
              background: sim.inRange ? 'rgba(82,227,164,0.12)' : 'rgba(255,107,122,0.12)',
              border: `1px solid ${sim.inRange ? 'rgba(82,227,164,0.4)' : 'rgba(255,107,122,0.4)'}`,
              color: statusColor, fontSize: 12.5, fontWeight: 800,
            }}>{statusLabel}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 12 }}>
              {[
                ['Capital', fmtUsd(sim.depositUsd)],
                ['Expected fee APR', sim.feeAprPct != null ? fmtPct(sim.feeAprPct) : 'no fee data yet'],
                [`Expected net (${sim.horizonDays}d)`, fmtUsd(sim.expectedFeesUsd + sim.depositUsd * sim.expectedIlFraction - sim.gasUsd)],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: btb.textMuted }}>{label}</span>
                  <span style={{ color: label === 'Expected fee APR' && sim.feeAprPct != null ? btb.green : btb.text, fontWeight: 800 }}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div onClick={() => setShowFactors((s) => !s)} style={{
            background: 'rgba(255,255,255,0.04)', border: btb.borderSoft, borderRadius: 16,
            padding: '12px 14px', cursor: 'pointer',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: btb.textDim, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Health Score</span>
              <span style={{ color: btb.textDim, fontSize: 10 }}>{showFactors ? '▴ less' : '▾ details'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
              <span style={{ fontSize: 22 }}>{sim.health.emoji}</span>
              <span style={{ color: sim.health.color, fontSize: 26, fontWeight: 800, letterSpacing: -0.5 }}>{sim.health.score}</span>
              <span style={{ color: btb.textDim, fontSize: 13, fontWeight: 700 }}>/ 100</span>
            </div>
            <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.08)', marginTop: 8, overflow: 'hidden' }}>
              <div style={{ width: `${sim.health.score}%`, height: '100%', borderRadius: 999, background: sim.health.color }} />
            </div>
            {sim.health.topIssue && !showFactors && (
              <div style={{ color: btb.textMuted, fontSize: 11, marginTop: 8, lineHeight: 1.45 }}>{sim.health.topIssue}</div>
            )}
            {showFactors && (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {sim.health.factors.map((f) => (
                  <div key={f.name}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                      <span style={{ color: btb.textMuted }}>{f.name} <span style={{ color: btb.textDim }}>({Math.round(f.weight * 100)}%)</span></span>
                      <span style={{ color: btb.text, fontWeight: 700 }}>{f.score}</span>
                    </div>
                    <div style={{ color: btb.textDim, fontSize: 10, lineHeight: 1.4, marginTop: 1 }}>{f.note}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Glass>
  );
}
