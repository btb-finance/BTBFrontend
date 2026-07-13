'use client';
/** Section 8 — Risk Radar. Six risk axes on a hexagon, each explained in
 * plain language on tap so the shape is never color-and-vibes alone. */
import { useState } from 'react';
import { btb } from '../../design-tokens';
import { Section, chart } from '../ui';
import type { Sim } from '../simState';

const SIZE = 300, CX = SIZE / 2, CY = SIZE / 2 + 4, R = 100;

export function RiskRadar({ sim, isMobile }: { sim: Sim; isMobile: boolean }) {
  const [active, setActive] = useState<number | null>(null);
  const axes = sim.risk;
  const n = axes.length;

  const pt = (i: number, r: number) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) };
  };
  const poly = (rOf: (i: number) => number) =>
    axes.map((_, i) => { const p = pt(i, rOf(i)); return `${p.x.toFixed(1)},${p.y.toFixed(1)}`; }).join(' ');

  const avg = axes.reduce((s, a) => s + a.risk, 0) / n;
  const tone = avg < 35 ? btb.green : avg < 60 ? btb.amber : btb.loss;

  return (
    <Section
      kicker="Section 8"
      title="Risk Radar"
      subtitle="Six ways this position can hurt, scored 0 to 100. A small shape is a calm position; spikes show where to look."
      right={
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: tone, fontSize: 20, fontWeight: 800 }}>{Math.round(avg)}</div>
          <div style={{ color: btb.textDim, fontSize: 10 }}>avg risk</div>
        </div>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14, alignItems: 'center' }}>
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ width: '100%', maxWidth: 340, height: 'auto', display: 'block', margin: '0 auto' }}>
          {/* grid rings */}
          {[0.25, 0.5, 0.75, 1].map((f) => (
            <polygon key={f} points={poly(() => R * f)} fill="none" stroke={chart.grid} strokeWidth={1} />
          ))}
          {/* spokes */}
          {axes.map((_, i) => {
            const p = pt(i, R);
            return <line key={i} x1={CX} y1={CY} x2={p.x} y2={p.y} stroke={chart.grid} strokeWidth={1} />;
          })}
          {/* risk shape */}
          <polygon points={poly((i) => R * (axes[i].risk / 100))} fill="rgba(255,179,107,0.22)" stroke={chart.il} strokeWidth={2} strokeLinejoin="round" />
          {/* vertex dots + labels */}
          {axes.map((a, i) => {
            const v = pt(i, R * (a.risk / 100));
            const l = pt(i, R + 24);
            const isActive = active === i;
            return (
              <g key={a.name} onClick={() => setActive(isActive ? null : i)} style={{ cursor: 'pointer' }}>
                <circle cx={v.x} cy={v.y} r={isActive ? 5.5 : 4} fill={chart.il} stroke="#0A0A0F" strokeWidth={2} />
                <text x={l.x} y={l.y + 3} textAnchor="middle" fontSize={11} fontWeight={isActive ? 800 : 600}
                  fill={isActive ? btb.text : btb.textMuted} fontFamily="inherit">
                  {a.name}
                </text>
                <text x={l.x} y={l.y + 16} textAnchor="middle" fontSize={10} fontWeight={800}
                  fill={a.risk >= 60 ? btb.loss : a.risk >= 35 ? btb.amber : btb.green} fontFamily="inherit">
                  {a.risk}
                </text>
              </g>
            );
          })}
        </svg>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {axes.map((a, i) => (
            <div key={a.name} onClick={() => setActive(active === i ? null : i)} style={{
              borderRadius: 12, padding: '8px 11px', cursor: 'pointer',
              background: active === i ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.03)',
              border: active === i ? btb.border : btb.borderSoft,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: btb.text, fontSize: 12, fontWeight: 700 }}>{a.name}</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: a.risk >= 60 ? btb.loss : a.risk >= 35 ? btb.amber : btb.green }}>{a.risk}</span>
              </div>
              <div style={{ height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.07)', margin: '5px 0' }}>
                <div style={{ width: `${a.risk}%`, height: '100%', borderRadius: 999, background: a.risk >= 60 ? btb.loss : a.risk >= 35 ? btb.amber : btb.green }} />
              </div>
              <div style={{ color: btb.textDim, fontSize: 10.5, lineHeight: 1.4 }}>{a.note}</div>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}
