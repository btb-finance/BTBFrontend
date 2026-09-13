'use client';
import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { btb } from './design-tokens';
import { Tab } from './types';

/** The LP journey, in the order a user walks it. */
const PRIMARY: { id: Tab; label: string; icon: string }[] = [
  { id: 'home',      label: 'Dashboard', icon: 'home' },
  { id: 'discover',  label: 'Discover',  icon: 'chart' },
  { id: 'simulate',  label: 'Simulate',  icon: 'layers' },
  { id: 'portfolio', label: 'Portfolio', icon: 'pie' },
  { id: 'swap',      label: 'Swap',      icon: 'swap' },
];

/** Everything outside the LP loop lives behind one More menu. */
const MORE: { id: Tab; label: string; icon: string }[] = [
  { id: 'nft',    label: 'NFT',          icon: 'nft' },
  { id: 'stake',  label: 'Agent',        icon: 'bolt' },
  { id: 'studio', label: 'Agent Studio', icon: 'rocket' },
];

export const TOP_NAV_HEIGHT = 60;

export function TopNav({
  tab, setTab, address, isReadOnly, onDisconnect, onDocs, onConnect,
}: {
  tab: Tab;
  setTab: (t: Tab) => void;
  address?: string;
  isReadOnly: boolean;
  onDisconnect: () => void;
  onDocs: () => void;
  onConnect: () => void;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const shortAddr = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : undefined;
  const moreActive = MORE.some(m => m.id === tab);

  useEffect(() => {
    if (!moreOpen) return;
    const close = (e: MouseEvent) => { if (!moreRef.current?.contains(e.target as Node)) setMoreOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMoreOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [moreOpen]);

  const itemStyle = (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 7, height: 36, padding: '0 12px', borderRadius: 10, cursor: 'pointer',
    background: active ? btb.surfaceStrong : 'transparent',
    color: active ? btb.text : btb.textMuted, fontSize: 13.5, fontWeight: active ? 700 : 500, whiteSpace: 'nowrap',
    transition: 'background 120ms ease, color 120ms ease',
  });

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 100, height: TOP_NAV_HEIGHT, flexShrink: 0,
      display: 'flex', alignItems: 'center', gap: 18, padding: '0 clamp(16px, 3vw, 40px)',
      background: 'rgba(10,10,15,0.82)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
      borderBottom: btb.borderSoft,
    }}>
      <div onClick={() => setTab('home')} style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', marginRight: 6 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/btblogo.jpg" alt="BTB" width={30} height={30} style={{ width: 30, height: 30, borderRadius: 999, objectFit: 'cover' }} />
        <span style={{ color: btb.text, fontSize: 17, fontWeight: 800, letterSpacing: -0.3 }}>BTB</span>
      </div>

      <nav style={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, minWidth: 0 }}>
        {PRIMARY.map(item => {
          const active = tab === item.id;
          return (
            <div key={item.id} onClick={() => setTab(item.id)} style={itemStyle(active)}>
              <Icon name={item.icon} size={16} color={active ? btb.text : btb.textMuted} />
              <span>{item.label}</span>
            </div>
          );
        })}
        <div ref={moreRef} style={{ position: 'relative' }}>
          <div onClick={() => setMoreOpen(o => !o)} style={itemStyle(moreActive)}>
            <span>{moreActive ? MORE.find(m => m.id === tab)?.label : 'More'}</span>
            <span style={{ display: 'inline-flex', transform: moreOpen ? 'rotate(90deg)' : 'rotate(-90deg)', transition: 'transform 120ms ease' }}>
              <Icon name="chevrons" size={13} color={moreActive ? btb.text : btb.textMuted} />
            </span>
          </div>
          {moreOpen && (
            <div style={{
              position: 'absolute', top: 42, left: 0, minWidth: 190, padding: 6, borderRadius: 14,
              background: 'rgba(14,14,20,0.98)', border: btb.borderSoft, boxShadow: '0 16px 40px rgba(0,0,0,0.45)',
              display: 'flex', flexDirection: 'column', gap: 2,
            }}>
              {MORE.map(item => {
                const active = tab === item.id;
                return (
                  <div key={item.id} onClick={() => { setTab(item.id); setMoreOpen(false); }} style={{ ...itemStyle(active), height: 38 }}>
                    <Icon name={item.icon} size={16} color={active ? btb.text : btb.textMuted} />
                    <span>{item.label}</span>
                  </div>
                );
              })}
              <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '4px 6px' }} />
              <div onClick={() => { onDocs(); setMoreOpen(false); }} style={{ ...itemStyle(false), height: 38 }}>
                <Icon name="doc" size={16} color={btb.textMuted} />
                <span>Docs</span>
              </div>
            </div>
          )}
        </div>
      </nav>

      {shortAddr ? (
        <div style={{
          height: 38, padding: '0 6px 0 12px', borderRadius: 12, border: btb.borderSoft, background: btb.surfaceSoft,
          display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
        }}>
          <Icon name="wallet" size={14} color={isReadOnly ? '#FFB36B' : btb.text} />
          <div style={{ lineHeight: 1.1 }}>
            {isReadOnly && <div style={{ color: '#FFB36B', fontSize: 9, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase' }}>Read-only</div>}
            <div style={{ color: btb.text, fontSize: 12.5, fontWeight: 600, fontFamily: 'monospace' }}>{shortAddr}</div>
          </div>
          <span onClick={onDisconnect} title="Disconnect" style={{
            cursor: 'pointer', color: btb.textMuted, fontSize: 11, fontWeight: 700, padding: '6px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.05)',
          }}>Exit</span>
        </div>
      ) : (
        <div onClick={onConnect} style={{
          height: 38, padding: '0 16px', borderRadius: 12, cursor: 'pointer', flexShrink: 0,
          background: btb.gradGreen, color: '#fff', fontSize: 13, fontWeight: 700,
          display: 'flex', alignItems: 'center', gap: 7,
        }}>
          <Icon name="wallet" size={15} color="#fff" />
          Connect Wallet
        </div>
      )}
    </header>
  );
}
