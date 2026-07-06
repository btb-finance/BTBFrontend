'use client';
import { useMemo, useState } from 'react';
import { btb } from './design-tokens';
import { Spinner } from './Spinner';
import { usePortfolioValueHistory, ChartRange } from '../lib/usePortfolioValueHistory';
import type { Token } from '../lib/TokenStore';

const RANGES: { id: ChartRange; label: string }[] = [
  { id: '24H', label: '24H' },
  { id: '1W',  label: '1W' },
  { id: '1M',  label: '1M' },
  { id: '1Y',  label: '1Y' },
];

const W = 640, H = 180, PAD_X = 4, PAD_Y = 10;

function fmtUsd(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtTime(ts: number, tf: ChartRange) {
  const d = new Date(ts);
  if (tf === '24H') return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function PortfolioChart({ heldTokens }: { heldTokens: Token[] }) {
  const [range, setRange] = useState<ChartRange>('1W');
  const { points, loading, error } = usePortfolioValueHistory(heldTokens, range);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const { path, areaPath, xy, min, max } = useMemo(() => {
    if (points.length < 2) return { path: '', areaPath: '', xy: [] as { x: number; y: number }[], min: 0, max: 0 };
    const values = points.map(p => p.value);
    const min = Math.min(...values), max = Math.max(...values);
    const range = max - min || 1;
    const innerW = W - PAD_X * 2, innerH = H - PAD_Y * 2;
    const xy = points.map((p, i) => ({
      x: PAD_X + (i / (points.length - 1)) * innerW,
      y: PAD_Y + innerH - ((p.value - min) / range) * innerH,
    }));
    const path = xy.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const areaPath = `${path} L${xy[xy.length - 1].x.toFixed(1)},${H} L${xy[0].x.toFixed(1)},${H} Z`;
    return { path, areaPath, xy, min, max };
  }, [points]);

  const first = points[0]?.value ?? 0;
  const last = points[points.length - 1]?.value ?? 0;
  const delta = last - first;
  const deltaPct = first > 0 ? (delta / first) * 100 : 0;
  const trendColor = delta >= 0 ? btb.green : btb.loss;
  const hover = hoverIdx != null ? points[hoverIdx] : null;

  function handleMove(e: React.MouseEvent<SVGSVGElement>) {
    if (xy.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * W;
    let closest = 0, closestDist = Infinity;
    xy.forEach((p, i) => {
      const d = Math.abs(p.x - relX);
      if (d < closestDist) { closestDist = d; closest = i; }
    });
    setHoverIdx(closest);
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ color: btb.textMuted, fontSize: 12, fontWeight: 500 }}>Portfolio value</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 2 }}>
            <span style={{ color: btb.text, fontSize: 22, fontWeight: 800, letterSpacing: -0.4 }}>
              ${fmtUsd(hover ? hover.value : last)}
            </span>
            {points.length > 1 && (
              <span style={{ color: trendColor, fontSize: 12.5, fontWeight: 700 }}>
                {delta >= 0 ? '+' : ''}{fmtUsd(delta)} ({delta >= 0 ? '+' : ''}{deltaPct.toFixed(2)}%)
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {RANGES.map(r => (
            <button key={r.id} onClick={() => setRange(r.id)} style={{
              height: 26, padding: '0 10px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 11.5, fontWeight: 700,
              background: range === r.id ? btb.surfaceStrong : 'transparent',
              color: range === r.id ? btb.text : btb.textMuted,
            }}>{r.label}</button>
          ))}
        </div>
      </div>

      <div style={{ position: 'relative', height: H }}>
        {loading ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Spinner size={20} color="#fff" track="rgba(255,255,255,0.18)" />
          </div>
        ) : error || points.length < 2 ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: btb.textDim, fontSize: 12.5 }}>
            {error ? 'Chart unavailable' : 'Not enough history yet'}
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${W} ${H}`}
            width="100%"
            height={H}
            style={{ display: 'block', overflow: 'visible' }}
            onMouseMove={handleMove}
            onMouseLeave={() => setHoverIdx(null)}
          >
            {/* recessive gridlines */}
            {[0.25, 0.5, 0.75].map(f => (
              <line key={f} x1={0} x2={W} y1={H * f} y2={H * f} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
            ))}

            <defs>
              <linearGradient id="pf-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={trendColor} stopOpacity={0.22} />
                <stop offset="100%" stopColor={trendColor} stopOpacity={0} />
              </linearGradient>
            </defs>

            <path d={areaPath} fill="url(#pf-area)" stroke="none" />
            <path d={path} fill="none" stroke={trendColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

            {hoverIdx != null && xy[hoverIdx] && (
              <>
                <line x1={xy[hoverIdx].x} x2={xy[hoverIdx].x} y1={0} y2={H} stroke="rgba(255,255,255,0.18)" strokeWidth={1} />
                <circle cx={xy[hoverIdx].x} cy={xy[hoverIdx].y} r={4} fill={trendColor} stroke={btb.bg} strokeWidth={2} />
              </>
            )}
          </svg>
        )}

        {hover && (
          <div style={{
            position: 'absolute', top: 0, pointerEvents: 'none',
            left: `${Math.min(Math.max((xy[hoverIdx!].x / W) * 100, 10), 90)}%`,
            transform: 'translateX(-50%)',
            background: 'rgba(20,20,26,0.95)', border: btb.borderSoft, borderRadius: 8,
            padding: '4px 8px', whiteSpace: 'nowrap',
          }}>
            <div style={{ color: btb.text, fontSize: 11.5, fontWeight: 700 }}>${fmtUsd(hover.value)}</div>
            <div style={{ color: btb.textDim, fontSize: 10 }}>{fmtTime(hover.timestamp, range)}</div>
          </div>
        )}
      </div>
    </div>
  );
}
