'use client';
/** Section 3 — Price Distribution. The lognormal price outlook at the horizon
 * with the user's range shaded, so "my range only covers 48% of likely
 * prices" is visible instead of implied. */
import { useState } from 'react';
import { btb } from '../../design-tokens';
import { Section, fmtPrice, chart } from '../ui';
import { normPdf, normCdf } from '../math/probability';
import type { Sim } from '../simState';

const W = 640, H = 190, PAD = 14, AXIS = 20;

export function PriceDistribution({ sim }: { sim: Sim }) {
  const [hover, setHover] = useState<number | null>(null); // z position

  const s = sim.sigmaDaily * Math.sqrt(Math.max(sim.horizonDays, 1));
  const Z = 3.2;
  const zOf = (disp: number) => Math.log(disp / sim.dispPrice) / s;
  const dispOf = (z: number) => sim.dispPrice * Math.exp(s * z);
  const x = (z: number) => PAD + ((z + Z) / (2 * Z)) * (W - PAD * 2);
  const plotH = H - AXIS;

  const N = 120;
  const pts: { z: number; pdf: number }[] = [];
  for (let k = 0; k <= N; k++) {
    const z = -Z + (2 * Z * k) / N;
    pts.push({ z, pdf: normPdf(z) });
  }
  const maxPdf = normPdf(0);
  const y = (pdf: number) => plotH - PAD - (pdf / maxPdf) * (plotH - PAD * 2);

  const curve = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.z).toFixed(1)},${y(p.pdf).toFixed(1)}`).join(' ');
  const zLo = Math.max(-Z, Math.min(Z, zOf(sim.dispLower)));
  const zHi = Math.max(-Z, Math.min(Z, zOf(sim.dispUpper)));
  const bandPath = `M${x(zLo).toFixed(1)},${(plotH - PAD).toFixed(1)} `
    + pts.filter((p) => p.z >= zLo && p.z <= zHi).map((p) => `L${x(p.z).toFixed(1)},${y(p.pdf).toFixed(1)}`).join(' ')
    + ` L${x(zHi).toFixed(1)},${(plotH - PAD).toFixed(1)} Z`;

  const covPct = Math.round(sim.coverage * 100);
  const axisTicks = [-2, -1, 0, 1, 2];

  return (
    <Section
      kicker="Section 3"
      title="Price Distribution"
      subtitle={`Where the model expects the price in ${sim.horizonDays} days, from this pair's own volatility (about ${(sim.sigmaDaily * 100).toFixed(1)}% a day). Shaded part = inside your range.`}
      right={
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: covPct >= 60 ? btb.green : covPct >= 35 ? btb.amber : btb.loss, fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>{covPct}%</div>
          <div style={{ color: btb.textDim, fontSize: 10 }}>range coverage</div>
        </div>
      }
    >
      <div style={{ background: 'rgba(255,255,255,0.03)', border: btb.borderSoft, borderRadius: 14, padding: '10px 8px 2px', position: 'relative' }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          style={{ width: '100%', height: 'auto', display: 'block' }}
          onPointerMove={(e) => {
            const r = (e.target as SVGElement).closest('svg')!.getBoundingClientRect();
            const z = (((e.clientX - r.left) / r.width) * W - PAD) / (W - PAD * 2) * 2 * Z - Z;
            setHover(Math.max(-Z, Math.min(Z, z)));
          }}
          onPointerLeave={() => setHover(null)}
        >
          {/* in-range shading */}
          {zHi > zLo && <path d={bandPath} fill="rgba(82,227,164,0.18)" />}
          {/* distribution curve */}
          <path d={curve} fill="none" stroke={chart.net} strokeWidth={2} strokeLinejoin="round" />
          {/* range edges */}
          {[zLo, zHi].map((z, i) => (
            <line key={i} x1={x(z)} x2={x(z)} y1={PAD} y2={plotH - PAD} stroke={chart.fees} strokeWidth={1.4} strokeDasharray="4 3" />
          ))}
          {/* current price */}
          <line x1={x(0)} x2={x(0)} y1={PAD} y2={plotH - PAD} stroke="#fff" strokeWidth={1} opacity={0.65} />
          <text x={x(0) + 4} y={PAD + 9} fontSize={9.5} fill={btb.textMuted} fontFamily="inherit">today</text>
          {/* axis */}
          <line x1={PAD} x2={W - PAD} y1={plotH - PAD} y2={plotH - PAD} stroke={chart.grid} strokeWidth={1} />
          {axisTicks.map((z) => (
            <text key={z} x={x(z)} y={H - 6} textAnchor="middle" fontSize={9.5} fill={chart.axis} fontFamily="inherit">
              {fmtPrice(dispOf(z))}
            </text>
          ))}
          {/* hover crosshair */}
          {hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={PAD} y2={plotH - PAD} stroke="rgba(255,255,255,0.35)" strokeWidth={1} />
              <circle cx={x(hover)} cy={y(normPdf(hover))} r={4} fill={chart.net} stroke="#0A0A0F" strokeWidth={2} />
            </g>
          )}
        </svg>
        {hover !== null && (
          <div style={{
            position: 'absolute', top: 8, right: 10, background: 'rgba(12,12,18,0.95)', border: btb.borderSoft,
            borderRadius: 10, padding: '7px 10px', fontSize: 11, pointerEvents: 'none',
          }}>
            <div style={{ color: btb.text, fontWeight: 800 }}>{fmtPrice(dispOf(hover))} {sim.dispQuote}</div>
            <div style={{ color: btb.textMuted, marginTop: 2 }}>{Math.round(normCdf(hover) * 100)}% odds price ends below this</div>
          </div>
        )}
      </div>
      <div style={{ color: btb.textMuted, fontSize: 11.5, marginTop: 10, lineHeight: 1.5 }}>
        Your range covers about <b style={{ color: covPct >= 60 ? btb.green : btb.amber }}>{covPct}%</b> of
        likely prices at the horizon. {covPct < 45 ? 'A tight range like this earns a bigger fee share but will probably need rebalancing.' : covPct > 85 ? 'A range this wide rarely needs attention but dilutes your fee share.' : 'A reasonable middle ground between fee share and staying in range.'}
      </div>
    </Section>
  );
}
