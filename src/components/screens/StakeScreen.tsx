'use client';
import { Glass } from '../Glass';
import { Icon } from '../Icon';
import { btb } from '../design-tokens';

/**
 * Renamed in the UI to "Agent" — your personal AI assistant that reads your
 * portfolio, summarizes positions, and answers questions about your holdings.
 * File kept as StakeScreen.tsx to avoid churning imports while the feature
 * is still pre-launch.
 */

const CAPABILITIES = [
  { icon: 'pie',    color: '#FFFFFF', bg: 'rgba(255,255,255,0.08)',  title: 'Reads your portfolio',     desc: 'Sees every balance, position, and price across all your tokens.' },
  { icon: 'chart',  color: '#52E3A4', bg: 'rgba(82,227,164,0.12)',   title: 'Tracks performance',       desc: 'Spots gainers, drawdowns, and unusual activity automatically.' },
  { icon: 'shield', color: '#FFB36B', bg: 'rgba(255,179,107,0.15)',  title: 'Watches for risk',         desc: 'Flags low-liquidity tokens, sketchy approvals, and exit windows.' },
  { icon: 'send',   color: '#94A3B8', bg: 'rgba(148,163,184,0.15)',  title: 'Suggests next moves',      desc: 'Recommends swaps, rebalances, and yield opportunities you may have missed.' },
];

export function StakeScreen() {
  return (
    <div style={{ padding: 'env(safe-area-inset-top, 24px) 18px 100px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px' }}>
        <div style={{ color: btb.text, fontSize: 28, fontWeight: 800, letterSpacing: -0.6 }}>Agent</div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 12px', borderRadius: 999,
          background: 'rgba(255,179,107,0.15)', border: '1px solid rgba(255,179,107,0.35)',
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#FFB36B', boxShadow: '0 0 8px #FFB36B' }}/>
          <span style={{ color: '#FFB36B', fontSize: 12, fontWeight: 700, letterSpacing: 0.3 }}>SOON</span>
        </div>
      </div>

      {/* hero */}
      <Glass padding={28} radius={28} strong style={{ textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(circle at 30% 0%, rgba(255,255,255,0.18), transparent 55%), radial-gradient(circle at 80% 100%, rgba(255,179,107,0.18), transparent 55%)',
          pointerEvents: 'none',
        }}/>
        <div style={{ position: 'relative' }}>
          <div style={{
            width: 76, height: 76, borderRadius: 24, margin: '0 auto 18px',
            background: 'linear-gradient(135deg, rgba(255,255,255,0.22), rgba(255,179,107,0.18))',
            border: '1px solid rgba(255,255,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 12px 32px rgba(255,179,107,0.25), inset 0 1px 0 rgba(255,255,255,0.3)',
          }}>
            <Icon name="bolt" size={36} color="#fff"/>
          </div>
          <div style={{ color: btb.text, fontSize: 24, fontWeight: 800, letterSpacing: -0.5, marginBottom: 8 }}>
            Your personal AI agent
          </div>
          <div style={{ color: btb.textMuted, fontSize: 14, lineHeight: 1.55, maxWidth: 340, margin: '0 auto' }}>
            An AI that reads your portfolio, flags risks, and surfaces opportunities — without ever holding your keys.
          </div>
        </div>
      </Glass>

      {/* what it does */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ color: btb.text, fontSize: 17, fontWeight: 700, letterSpacing: -0.3, padding: '0 4px' }}>
          What it&rsquo;ll do
        </div>
        {CAPABILITIES.map(c => (
          <Glass key={c.title} padding={14} radius={18}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div style={{
                width: 42, height: 42, borderRadius: 12, background: c.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Icon name={c.icon} size={20} color={c.color}/>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: btb.text, fontSize: 14, fontWeight: 700, marginBottom: 3 }}>{c.title}</div>
                <div style={{ color: btb.textMuted, fontSize: 12.5, lineHeight: 1.5 }}>{c.desc}</div>
              </div>
            </div>
          </Glass>
        ))}
      </div>

      {/* waitlist cta */}
      <Glass padding={18} radius={20} soft style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'rgba(82,227,164,0.12)', border: '1px solid rgba(82,227,164,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Icon name="star" size={18} color="#52E3A4"/>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ color: btb.text, fontSize: 13.5, fontWeight: 700 }}>Want early access?</div>
          <div style={{ color: btb.textMuted, fontSize: 12, marginTop: 2 }}>
            Follow <a href="https://x.com/BTB_Finance" target="_blank" rel="noreferrer" style={{ color: btb.text, textDecoration: 'underline' }}>@BTB_Finance</a> or join the <a href="https://discord.gg/bqFEPA56Tc" target="_blank" rel="noreferrer" style={{ color: btb.text, textDecoration: 'underline' }}>Discord</a> for the launch announcement.
          </div>
        </div>
      </Glass>
    </div>
  );
}
