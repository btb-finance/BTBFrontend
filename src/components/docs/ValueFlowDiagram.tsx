'use client';
import { btb } from '../design-tokens';
import { useSidebar } from '../../lib/SidebarContext';
import { ASSET } from './palette';

/**
 * How value moves through BTB, drawn as one map: boxes for where things sit, lines coloured by what moves, a label
 * on every line, and numbered notes under it. Plain SVG on a fixed canvas that scales to the column; on a phone it
 * keeps a readable width and scrolls sideways.
 *
 * Keep it true to the code: the 1% swap fee (BTB_SWAP_FEE_BPS), the pot from the token fees split by the week's
 * points (convex/rewards), the in-app BTB balance held by the treasury (convex/credit.ts).
 */

// The docs' shared colours (palette.ts), so the map and the transaction flows read the same.
const C = {
  lp: ASSET.lp.color,
  fees: ASSET.fees.color,
  btb: ASSET.btb.color,
  signal: ASSET.points.color,
};

type Node = { id: string; x: number; y: number; w: number; title: string; sub: string; hot?: boolean };
const H = 76;
const NODES: Node[] = [
  { id: 'you', x: 40, y: 250, w: 170, title: 'You', sub: 'LPs and users' },
  { id: 'dex', x: 380, y: 40, w: 220, title: 'DEX pools', sub: 'Uniswap · Aerodrome · Metric' },
  { id: 'auto', x: 760, y: 40, w: 200, title: 'Your auto wallet', sub: 'a smart account you own' },
  { id: 'agent', x: 760, y: 250, w: 200, title: 'BTB agent', sub: 'checks · rebalances' },
  { id: 'swap', x: 380, y: 250, w: 220, title: 'Swap & bridge', sub: 'KyberSwap · LI.FI' },
  { id: 'treasury', x: 560, y: 440, w: 200, title: 'BTB treasury', sub: 'fees · BTB balances', hot: true },
  { id: 'token', x: 840, y: 440, w: 140, title: 'BTB token', sub: 'transfer fees' },
  { id: 'pot', x: 280, y: 440, w: 200, title: 'Friday pot', sub: 'BTB, split by points' },
  { id: 'points', x: 40, y: 440, w: 170, title: 'Your points', sub: 'XP this week' },
];

type Edge = { d: string; color: keyof typeof C; label: string; at: [number, number]; dashed?: boolean };
const EDGES: Edge[] = [
  { d: 'M125 250 C125 130 210 78 372 78', color: 'lp', label: 'add liquidity', at: [232, 96] },
  { d: 'M440 116 C440 200 300 258 218 266', color: 'fees', label: 'swap fees earned', at: [356, 196] },
  { d: 'M600 78 L752 78', color: 'lp', label: 'move in', at: [676, 78] },
  { d: 'M860 250 L860 124', color: 'signal', label: 'rebalance · compound', at: [860, 187], dashed: true },
  { d: 'M210 290 L372 290', color: 'fees', label: 'swap · bridge', at: [291, 290] },
  { d: 'M560 326 C560 400 610 410 640 432', color: 'fees', label: '1% swap fee', at: [584, 384] },
  { d: 'M840 478 L768 478', color: 'btb', label: 'token fees', at: [804, 418] },
  { d: 'M560 478 L488 478', color: 'btb', label: 'turned into BTB', at: [524, 418] },
  { d: 'M125 326 L125 432', color: 'signal', label: 'check-ins · swaps · LP', at: [125, 380], dashed: true },
  { d: 'M210 478 L272 478', color: 'signal', label: 'sets your share', at: [241, 418], dashed: true },
  { d: 'M330 440 C330 380 270 330 218 312', color: 'btb', label: 'your share, Fridays', at: [318, 372] },
  { d: 'M700 440 C700 380 790 360 830 334', color: 'btb', label: 'your BTB balance pays', at: [760, 384], dashed: true },
];

const NOTES: { title: string; text: string }[] = [
  { title: 'Find and add', text: 'Discover and Simulate are free. You add liquidity into a DEX pool and the position is yours: in your wallet, or in a gauge when staked.' },
  { title: 'Earn the pool fees', text: 'Every trade through your range pays you its fee. Staked positions earn the gauge rewards instead, and Merkl campaigns pay on top.' },
  { title: 'Let it rebalance', text: 'Optional. Move a position into your auto wallet and the BTB agent moves it back into range when the price leaves. Only you can take it out.' },
  { title: 'Swap and bridge', text: 'Best route across every DEX on the network, or to another network. 1% of a swap goes to BTB; bridging costs only the route fees.' },
  { title: 'Get paid on Friday', text: "The week's token fees are turned into BTB and split by points: everything you did in the app this week. Claim it, or keep it as your BTB balance to pay for the agent, alerts and auto-rebalance." },
];

export function ValueFlowDiagram() {
  const { isMobile } = useSidebar();
  const legend: [string, string, boolean?][] = [['LP positions', C.lp], ['Trading fees', C.fees], ['BTB', C.btb], ['Signal, no transfer', C.signal, true]];
  return (
    <div style={{ borderRadius: 20, border: '1px solid rgba(var(--fg-rgb), 0.1)', background: 'rgba(var(--fg-rgb), 0.025)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 12 : 22, flexWrap: 'wrap', padding: isMobile ? '12px 14px' : '14px 22px', borderBottom: '1px solid rgba(var(--fg-rgb), 0.08)' }}>
        <span style={{ color: btb.textDim, fontSize: 11, fontWeight: 800, letterSpacing: 2.5, textTransform: 'uppercase' }}>What moves</span>
        {legend.map(([label, color, dashed]) => (
          <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: btb.textMuted, fontSize: 12.5 }}>
            {dashed
              ? <svg width="18" height="4" aria-hidden="true"><path d="M0 2h18" stroke={color} strokeWidth="2" strokeDasharray="4 3"/></svg>
              : <span style={{ width: 9, height: 9, borderRadius: '50%', background: color }}/>}
            {label}
          </span>
        ))}
      </div>

      {/* The map: a fixed canvas that scales; on a phone it keeps its width and scrolls sideways. */}
      <div style={{ overflowX: 'auto', padding: isMobile ? '10px 8px' : '18px 18px 8px' }}>
        <svg viewBox="0 0 1000 560" role="img" aria-label="How value flows through BTB" style={{ display: 'block', width: '100%', minWidth: isMobile ? 760 : 0, height: 'auto' }}>
          <defs>
            {(Object.keys(C) as (keyof typeof C)[]).map((k) => (
              <marker key={k} id={`vf-arrow-${k}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0 0 L10 5 L0 10 z" fill={C[k]}/>
              </marker>
            ))}
          </defs>

          {EDGES.map((e, i) => (
            <g key={i}>
              <path d={e.d} fill="none" stroke={C[e.color]} strokeWidth={2} strokeDasharray={e.dashed ? '5 5' : undefined} markerEnd={`url(#vf-arrow-${e.color})`} opacity={0.95}/>
              {/* A dot where it leaves, as on a wire diagram. */}
              <circle cx={Number(e.d.split(' ')[0].slice(1))} cy={Number(e.d.split(' ')[1])} r={3.5} fill={C[e.color]}/>
            </g>
          ))}

          {NODES.map((n) => (
            <g key={n.id}>
              <rect x={n.x} y={n.y} width={n.w} height={H} rx={14}
                fill={n.hot ? 'rgba(240,180,60,0.12)' : 'rgba(var(--bg-rgb), 0.92)'}
                stroke={n.hot ? C.btb : 'rgba(var(--fg-rgb), 0.18)'} strokeWidth={n.hot ? 2 : 1.2}/>
              <text x={n.x + n.w / 2} y={n.y + 33} textAnchor="middle" fill={btb.text} style={{ fontSize: 17, fontWeight: 800, fontFamily: 'inherit' }}>{n.title}</text>
              <text x={n.x + n.w / 2} y={n.y + 55} textAnchor="middle" fill={btb.textMuted} style={{ fontSize: 11.5, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{n.sub}</text>
            </g>
          ))}

          {/* Labels last, so they sit on top of the lines they name. */}
          {EDGES.map((e, i) => {
            const w = e.label.length * 6.6 + 22;
            return (
              <g key={`l${i}`}>
                <rect x={e.at[0] - w / 2} y={e.at[1] - 12} width={w} height={24} rx={12} fill="rgba(var(--bg-rgb), 0.96)" stroke="rgba(var(--fg-rgb), 0.16)"/>
                <text x={e.at[0]} y={e.at[1] + 4.5} textAnchor="middle" fill={btb.text} style={{ fontSize: 12, fontFamily: 'inherit' }}>{e.label}</text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* The loop in words, numbered in the order a user meets it. */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(220px, 1fr))', borderTop: '1px solid rgba(var(--fg-rgb), 0.08)' }}>
        {NOTES.map((n, i) => (
          <div key={n.title} style={{ padding: isMobile ? '14px 16px' : '18px 20px', borderRight: isMobile ? undefined : '1px solid rgba(var(--fg-rgb), 0.06)', borderBottom: '1px solid rgba(var(--fg-rgb), 0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, border: `1.5px solid ${C.btb}`, color: C.btb, fontSize: 13, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
              <span style={{ color: btb.text, fontSize: 15, fontWeight: 800 }}>{n.title}</span>
            </div>
            <div style={{ color: btb.textMuted, fontSize: 13.5, lineHeight: 1.55 }}>{n.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
