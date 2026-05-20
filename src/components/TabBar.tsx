'use client';
import { Icon } from './Icon';

type Tab = 'home' | 'swap' | 'portfolio' | 'nft' | 'stake';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'home',      label: 'Home',      icon: 'home' },
  { id: 'swap',      label: 'Swap',      icon: 'swap' },
  { id: 'portfolio', label: 'Portfolio', icon: 'pie' },
  { id: 'nft',       label: 'NFT',       icon: 'nft' },
  { id: 'stake',     label: 'Agent',     icon: 'bolt' },
];

export function TabBar({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  return (
    <div style={{
      // Center horizontally and cap width so it sits within the phone-frame
      // column on desktop; falls back to full-width on mobile.
      position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
      width: 'min(456px, calc(100% - 24px))',
      borderRadius: 28,
      background: 'rgba(20,3,8,0.4)',
      backdropFilter: 'blur(32px) saturate(180%)',
      WebkitBackdropFilter: 'blur(32px) saturate(180%)',
      border: '1px solid rgba(255,255,255,0.12)',
      boxShadow: '0 -8px 32px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.1)',
      padding: '8px 6px',
      display: 'flex',
      zIndex: 100,
    }}>
      {TABS.map(t => {
        const active = tab === t.id;
        return (
          <div key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            padding: '8px 4px', borderRadius: 20,
            background: active ? 'rgba(255,255,255,0.12)' : 'transparent',
            cursor: 'pointer', transition: 'background 0.2s', position: 'relative',
          }}>
            {active && (
              <div style={{
                position: 'absolute', top: 4, left: '50%', transform: 'translateX(-50%)',
                width: 24, height: 2, borderRadius: 2,
                background: '#FFFFFF', boxShadow: '0 0 8px #FFFFFF',
              }}/>
            )}
            <Icon name={t.icon} size={22} color={active ? '#fff' : 'rgba(255,255,255,0.5)'}/>
            <span style={{ color: active ? '#fff' : 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: 600, letterSpacing: 0.2 }}>
              {t.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export type { Tab };
