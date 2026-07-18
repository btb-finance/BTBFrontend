'use client';
import { Icon } from './Icon';
import { btb } from './design-tokens';
import { Tab } from './types';
import { useSidebar } from '../lib/SidebarContext';

const NAV_SECTIONS: { label: string; items: { id: Tab; label: string; icon: string }[] }[] = [
  {
    label: 'Insights',
    items: [
      { id: 'home',      label: 'Dashboard', icon: 'home' },
      { id: 'discover',  label: 'Discover',  icon: 'chart' },
      { id: 'token',     label: 'BTB Token', icon: 'bank' },
    ],
  },
  {
    label: 'DeFi Tools',
    items: [
      { id: 'swap',      label: 'Swap',      icon: 'swap' },
      { id: 'simulate',  label: 'Simulate',  icon: 'layers' },
      { id: 'portfolio', label: 'Portfolio', icon: 'pie' },
      { id: 'nft',       label: 'NFT',       icon: 'nft' },
      { id: 'stake',     label: 'Agent',     icon: 'bolt' },
      { id: 'studio',    label: 'Agent Studio', icon: 'rocket' },
    ],
  },
];

export function Sidebar({
  tab, setTab, address, isReadOnly, onDisconnect, onDocs, onEarn, onConnect,
}: {
  tab: Tab;
  setTab: (t: Tab) => void;
  address?: string;
  isReadOnly: boolean;
  onDisconnect: () => void;
  onDocs: () => void;
  onEarn: () => void;
  onConnect: () => void;
}) {
  const { collapsed, forceCollapsed, toggle, width } = useSidebar();
  const shortAddr = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : undefined;

  return (
    <div style={{
      width, flexShrink: 0, height: '100vh', position: 'sticky', top: 0,
      display: 'flex', flexDirection: 'column',
      background: 'rgba(255,255,255,0.02)',
      borderRight: btb.borderSoft,
      padding: collapsed ? '20px 10px' : '20px 14px',
      transition: 'width 0.18s ease',
      overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between', gap: 8, padding: '0 4px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/btblogo.jpg"
            alt="BTB"
            width={28}
            height={28}
            style={{ width: 28, height: 28, borderRadius: 999, objectFit: 'cover', flexShrink: 0 }}
          />
          {!collapsed && <span style={{ color: btb.text, fontSize: 17, fontWeight: 800, letterSpacing: -0.3, whiteSpace: 'nowrap' }}>BTB</span>}
        </div>
        {!collapsed && (
          <div onClick={toggle} title="Collapse sidebar" style={{
            width: 26, height: 26, borderRadius: 8, cursor: 'pointer', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(255,255,255,0.06)',
          }}>
            <Icon name="chevrons" size={14} color={btb.textMuted} />
          </div>
        )}
      </div>

      {collapsed && !forceCollapsed && (
        <div onClick={toggle} title="Expand sidebar" style={{
          width: 26, height: 26, borderRadius: 8, cursor: 'pointer', margin: '0 auto 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(255,255,255,0.06)', transform: 'rotate(180deg)',
        }}>
          <Icon name="chevrons" size={14} color={btb.textMuted} />
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column', gap: 18 }}>
        {NAV_SECTIONS.map(section => (
          <div key={section.label}>
            {!collapsed && (
              <div style={{
                color: btb.textDim, fontSize: 11, fontWeight: 700, letterSpacing: 0.6,
                textTransform: 'uppercase', padding: '0 10px 6px',
              }}>{section.label}</div>
            )}
            {section.items.map(item => {
              const active = tab === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => setTab(item.id)}
                  title={collapsed ? item.label : undefined}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    padding: collapsed ? '10px 0' : '9px 10px', borderRadius: 10, cursor: 'pointer',
                    marginBottom: 2,
                    background: active ? btb.surfaceStrong : 'transparent',
                  }}
                >
                  <Icon name={item.icon} size={17} color={active ? btb.text : btb.textMuted} />
                  {!collapsed && (
                    <span style={{ color: active ? btb.text : btb.textMuted, fontSize: 13.5, fontWeight: active ? 700 : 500, whiteSpace: 'nowrap' }}>
                      {item.label}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div
        onClick={onEarn}
        title={collapsed ? 'Earn' : undefined}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', borderRadius: 10,
          justifyContent: collapsed ? 'center' : 'flex-start', padding: collapsed ? '10px 0' : '9px 10px',
        }}
      >
        <Icon name="launch" size={17} color={btb.textMuted} />
        {!collapsed && <span style={{ color: btb.textMuted, fontSize: 13.5, fontWeight: 500, whiteSpace: 'nowrap' }}>Earn</span>}
      </div>

      <div
        onClick={onDocs}
        title={collapsed ? 'Docs' : undefined}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', borderRadius: 10,
          justifyContent: collapsed ? 'center' : 'flex-start', padding: collapsed ? '10px 0' : '9px 10px',
        }}
      >
        <Icon name="doc" size={17} color={btb.textMuted} />
        {!collapsed && <span style={{ color: btb.textMuted, fontSize: 13.5, fontWeight: 500, whiteSpace: 'nowrap' }}>Docs</span>}
      </div>

      {shortAddr ? (
        collapsed ? (
          <div onClick={onDisconnect} title={`${shortAddr} · Exit`} style={{
            marginTop: 10, height: 38, borderRadius: 10, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: btb.borderSoft, background: btb.surfaceSoft,
          }}>
            <Icon name="wallet" size={15} color={isReadOnly ? '#FFB36B' : btb.text} />
          </div>
        ) : (
          <div style={{
            marginTop: 10, padding: '10px 10px', borderRadius: 12,
            border: btb.borderSoft, background: btb.surfaceSoft,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          }}>
            <div style={{ minWidth: 0 }}>
              {isReadOnly && (
                <div style={{ color: '#FFB36B', fontSize: 9.5, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase' }}>Read-only</div>
              )}
              <div style={{ color: btb.text, fontSize: 12.5, fontWeight: 600, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {shortAddr}
              </div>
            </div>
            <span onClick={onDisconnect} style={{ cursor: 'pointer', color: btb.textMuted, fontSize: 11, fontWeight: 700, flexShrink: 0 }}>Exit</span>
          </div>
        )
      ) : (
        <div
          onClick={onConnect}
          title={collapsed ? 'Connect Wallet' : undefined}
          style={{
            marginTop: 10, height: 42, borderRadius: 12, cursor: 'pointer',
            background: btb.gradGreen, color: '#fff', fontSize: 13, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          }}
        >
          <Icon name="wallet" size={15} color="#fff" />
          {!collapsed && 'Connect Wallet'}
        </div>
      )}
    </div>
  );
}
