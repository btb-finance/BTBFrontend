'use client';
import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { btb } from './design-tokens';
import { Tab } from './types';
import { useChainTheme } from '../lib/ChainThemeContext';
import { WalletSwitcher } from './WalletSwitcher';
import { AlertsBell } from './AlertsBell';

/** The LP journey, in the order a user walks it. */
const PRIMARY: { id: Tab; label: string }[] = [
  { id: 'home',      label: 'Dashboard' },
  { id: 'discover',  label: 'Discover' },
  { id: 'simulate',  label: 'Simulate' },
  { id: 'portfolio', label: 'Portfolio' },
  { id: 'swap',      label: 'Swap' },
];

/** Everything outside the LP loop lives behind one More menu. */
const MORE: { id: Tab; label: string }[] = [
  { id: 'nft',    label: 'NFT' },
  { id: 'stake',  label: 'Agent' },
];

export const TOP_NAV_HEIGHT = 60;

export function TopNav({
  tab, setTab, address, isReadOnly, onDisconnect, onDocs, onConnect, onViewAddress,
}: {
  tab: Tab;
  setTab: (t: Tab) => void;
  address?: string;
  isReadOnly: boolean;
  onViewAddress: (addr: string | undefined) => void;
  onDisconnect: () => void;
  onDocs: () => void;
  onConnect: () => void;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);
  const { mode, toggleMode } = useChainTheme();
  const shortAddr = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : undefined;
  const moreActive = MORE.some(m => m.id === tab);

  useEffect(() => {
    if (!moreOpen && !userOpen) return;
    const close = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!moreRef.current?.contains(t)) setMoreOpen(false);
      if (!userRef.current?.contains(t)) setUserOpen(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setMoreOpen(false); setUserOpen(false); } };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [moreOpen, userOpen]);

  const itemStyle = (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 7, height: 34, padding: '0 14px', borderRadius: 999, cursor: 'pointer',
    background: active ? btb.surfaceStrong : 'transparent',
    color: active ? btb.text : btb.textMuted, fontSize: 13.5, fontWeight: active ? 700 : 500, whiteSpace: 'nowrap',
    transition: 'background 120ms ease, color 120ms ease',
  });

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 100, height: TOP_NAV_HEIGHT, flexShrink: 0,
      display: 'flex', alignItems: 'center', gap: 18, padding: '0 clamp(16px, 3vw, 40px)',
      background: 'transparent',
    }}>
      <div onClick={() => setTab('home')} style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', marginRight: 6 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/btblogo.jpg" alt="BTB" width={30} height={30} style={{ width: 30, height: 30, borderRadius: 999, objectFit: 'cover' }} />
        <span style={{ color: btb.text, fontSize: 17, fontWeight: 800, letterSpacing: -0.3 }}>BTB</span>
      </div>

      <div style={{ flex: 1, minWidth: 0, display: 'flex', justifyContent: 'center' }}>
      <nav style={{
        position: 'relative', display: 'flex', alignItems: 'center', gap: 2, padding: 4, borderRadius: 999,
        background: btb.glass, border: btb.border, backdropFilter: btb.blur, WebkitBackdropFilter: btb.blur, boxShadow: btb.shadow,
      }}>
        <div style={{ position: 'absolute', top: 0, left: '10%', right: '10%', height: 1, background: 'linear-gradient(90deg, transparent, rgba(var(--fg-rgb), 0.45), transparent)', pointerEvents: 'none', borderRadius: 999 }} />
        {PRIMARY.map(item => {
          const active = tab === item.id;
          return (
            <div key={item.id} onClick={() => setTab(item.id)} style={itemStyle(active)}>
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
              background: btb.glassStrong, border: btb.border, backdropFilter: btb.blur, WebkitBackdropFilter: btb.blur, boxShadow: '0 16px 40px rgba(0,0,0,0.45)',
              display: 'flex', flexDirection: 'column', gap: 2,
            }}>
              {MORE.map(item => {
                const active = tab === item.id;
                return (
                  <div key={item.id} onClick={() => { setTab(item.id); setMoreOpen(false); }} style={{ ...itemStyle(active), height: 38, borderRadius: 10 }}>
                    <span>{item.label}</span>
                  </div>
                );
              })}
              <div style={{ height: 1, background: 'rgba(var(--fg-rgb), 0.07)', margin: '4px 6px' }} />
              <div onClick={() => { onDocs(); setMoreOpen(false); }} style={{ ...itemStyle(false), height: 38, borderRadius: 10 }}>
                <span>Docs</span>
              </div>
            </div>
          )}
        </div>
      </nav>
      </div>

      <AlertsBell/>

      {/* Day / night */}
      <button type="button" onClick={toggleMode} title={mode === 'dark' ? 'Switch to day' : 'Switch to night'} aria-label="Toggle colour mode" style={{
        width: 38, height: 38, borderRadius: 12, border: btb.borderSoft, background: btb.surfaceSoft, cursor: 'pointer', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: btb.text, marginRight: 8,
      }}>
        {mode === 'dark' ? <SunIcon/> : <MoonIcon/>}
      </button>

      {shortAddr ? (
        <div ref={userRef} style={{ position: 'relative', flexShrink: 0 }}>
          <div onClick={() => setUserOpen(o => !o)} style={{
            height: 38, padding: '0 8px 0 4px', borderRadius: 999, border: btb.borderSoft, background: btb.surfaceSoft, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <Avatar address={address!} size={30}/>
            <span style={{ display: 'inline-flex', transform: userOpen ? 'rotate(90deg)' : 'rotate(-90deg)', transition: 'transform 120ms ease' }}>
              <Icon name="chevrons" size={13} color={btb.textMuted} />
            </span>
          </div>
          {userOpen && (
            <div style={{
              position: 'absolute', top: 46, right: 0, minWidth: 230, padding: 8, borderRadius: 16,
              background: btb.glassStrong, border: btb.border, backdropFilter: btb.blur, WebkitBackdropFilter: btb.blur, boxShadow: '0 16px 40px rgba(0,0,0,0.35)',
              display: 'flex', flexDirection: 'column', gap: 2,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px 10px' }}>
                <Avatar address={address!} size={34}/>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: btb.text, fontSize: 13, fontWeight: 700, fontFamily: 'monospace' }}>{shortAddr}</div>
                  <div style={{ color: isReadOnly ? 'var(--btb-amber)' : btb.textMuted, fontSize: 11 }}>{isReadOnly ? 'Watching, read-only' : 'Connected'}</div>
                </div>
              </div>
              <div style={{ height: 1, background: 'rgba(var(--fg-rgb), 0.08)', margin: '0 6px 4px' }} />
              <WalletSwitcher viewAddress={address} onViewAddress={onViewAddress} onPick={() => setUserOpen(false)}/>
              <div style={{ height: 1, background: 'rgba(var(--fg-rgb), 0.08)', margin: '4px 6px' }} />
              <div onClick={() => { navigator.clipboard?.writeText(address!).catch(() => {}); setUserOpen(false); }} style={itemStyle(false)}><span>Copy address</span></div>
              <div onClick={() => { setTab('portfolio'); setUserOpen(false); }} style={itemStyle(false)}><span>Portfolio</span></div>
              <div onClick={() => { onDocs(); setUserOpen(false); }} style={itemStyle(false)}><span>Docs</span></div>
              <div style={{ height: 1, background: 'rgba(var(--fg-rgb), 0.08)', margin: '4px 6px' }} />
              <div onClick={() => { onDisconnect(); setUserOpen(false); }} style={{ ...itemStyle(false), color: btb.loss }}><span>{isReadOnly ? 'Stop watching' : 'Disconnect'}</span></div>
            </div>
          )}
        </div>
      ) : (
        <div onClick={onConnect} style={{
          height: 38, padding: '0 16px', borderRadius: 12, cursor: 'pointer', flexShrink: 0,
          background: btb.gradGreen, color: '#fff', fontSize: 13, fontWeight: 700,
          display: 'flex', alignItems: 'center', gap: 7,
        }}>
          Connect Wallet
        </div>
      )}
    </header>
  );
}

/** Deterministic two-colour gradient from the address, with its first hex char as the initial. */
function Avatar({ address, size }: { address: string; size: number }) {
  const h1 = parseInt(address.slice(2, 8), 16) % 360;
  const h2 = (h1 + 60) % 360;
  return (
    <span style={{
      width: size, height: size, borderRadius: 999, flexShrink: 0,
      background: `linear-gradient(135deg, hsl(${h1} 70% 55%), hsl(${h2} 70% 45%))`,
      color: '#fff', fontSize: size * 0.42, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textTransform: 'uppercase',
    }}>{address.slice(2, 3)}</span>
  );
}

function SunIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>;
}
function MoonIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>;
}
