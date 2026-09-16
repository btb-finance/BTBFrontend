'use client';
import { useState } from 'react';
import { Icon } from './Icon';
import { Button } from './Button';
import { btb } from './design-tokens';
import { Tab } from './types';
import { useChainTheme } from '../lib/ChainThemeContext';
import { WalletSwitcher } from './WalletSwitcher';
import { AlertsBell } from './AlertsBell';

// Bottom navigation shown instead of the sidebar below the mobile breakpoint.
// Four primary tabs stay visible; everything else (remaining tabs, Docs,
// wallet) lives in the "More" sheet.
const PRIMARY: { id: Tab; label: string; icon: string }[] = [
  { id: 'home',      label: 'Home',      icon: 'home' },
  { id: 'discover',  label: 'Discover',  icon: 'chart' },
  { id: 'swap',      label: 'Swap',      icon: 'swap' },
  { id: 'portfolio', label: 'Portfolio', icon: 'pie' },
];

const MORE_TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'simulate', label: 'Simulate',  icon: 'layers' },
  { id: 'nft',      label: 'NFT',       icon: 'nft' },
  { id: 'stake',    label: 'Agent',     icon: 'bolt' },
];

export function MobileNav({ tab, setTab, address, isReadOnly, onDocs, onConnect, onDisconnect, onViewAddress }: {
  tab: Tab;
  setTab: (t: Tab) => void;
  address?: string;
  isReadOnly: boolean;
  onDocs: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onViewAddress: (addr: string | undefined) => void;
}) {
  const [sheet, setSheet] = useState(false);
  const { mode, toggleMode } = useChainTheme();
  const shortAddr = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : undefined;
  const moreActive = MORE_TABS.some(i => i.id === tab);

  // Glass pill like the desktop bar; icon over label since mobile is narrow.
  const item = (active: boolean, icon: string, label: string, onClick: () => void) => (
    <div key={label} onClick={onClick} style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
      height: 50, borderRadius: 999, cursor: 'pointer',
      background: active ? btb.surfaceStrong : 'transparent',
      transition: 'background 120ms ease',
    }}>
      <Icon name={icon} size={19} color={active ? btb.text : btb.textMuted}/>
      <span style={{ color: active ? btb.text : btb.textMuted, fontSize: 10.5, fontWeight: active ? 700 : 500, whiteSpace: 'nowrap' }}>{label}</span>
    </div>
  );

  return (
    <>
      {sheet && (
        <div onClick={() => setSheet(false)} style={{
          position: 'fixed', inset: 0, zIndex: 390,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'flex-end',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            width: '100%', background: btb.glassStrong, backdropFilter: btb.blur, WebkitBackdropFilter: btb.blur,
            border: btb.border, borderBottom: 'none',
            borderRadius: '24px 24px 0 0', padding: '16px 16px calc(90px + env(safe-area-inset-bottom))',
            display: 'flex', flexDirection: 'column', gap: 14,
          }}>
            <div style={{ width: 40, height: 4, borderRadius: 999, background: 'rgba(var(--fg-rgb), 0.2)', margin: '0 auto' }}/>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}><AlertsBell compact/></div>

            {/* remaining tabs + overlays */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {[
                ...MORE_TABS.map(i => ({ ...i, onClick: () => { setTab(i.id); setSheet(false); }, active: tab === i.id })),
                { id: 'docs', label: 'Docs', icon: 'doc', onClick: () => { onDocs(); setSheet(false); }, active: false },
              ].map(i => (
                <div key={i.id} onClick={i.onClick} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                  padding: '14px 0 12px', borderRadius: 16, cursor: 'pointer',
                  background: i.active ? btb.surfaceStrong : 'rgba(var(--fg-rgb), 0.05)',
                  border: btb.borderSoft,
                }}>
                  <Icon name={i.icon} size={20} color={i.active ? btb.text : btb.textMuted}/>
                  <span style={{ color: i.active ? btb.text : btb.textMuted, fontSize: 12, fontWeight: 600 }}>{i.label}</span>
                </div>
              ))}
            </div>

            <Button size="sm" variant="ghost" fullWidth onClick={toggleMode}>{mode === 'dark' ? 'Switch to day' : 'Switch to night'}</Button>

            {address && !isReadOnly && (
              <div style={{ background: 'rgba(var(--fg-rgb), 0.05)', border: btb.borderSoft, borderRadius: 16, padding: '8px 6px' }}>
                <WalletSwitcher viewAddress={address} onViewAddress={onViewAddress} onPick={() => setSheet(false)}/>
              </div>
            )}
            {address && isReadOnly && (
              <div style={{ background: 'rgba(var(--fg-rgb), 0.05)', border: btb.borderSoft, borderRadius: 16, padding: '8px 6px' }}>
                <WalletSwitcher viewAddress={address} onViewAddress={onViewAddress} onPick={() => setSheet(false)}/>
              </div>
            )}

            {/* wallet */}
            {address ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(var(--fg-rgb), 0.05)', border: btb.borderSoft, borderRadius: 16, padding: '12px 14px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: btb.text, fontSize: 13.5, fontWeight: 700 }}>{shortAddr}</div>
                  {isReadOnly && <div style={{ color: btb.textMuted, fontSize: 11 }}>Watching (read-only)</div>}
                </div>
                <Button size="sm" variant="ghost" onClick={() => { onDisconnect(); setSheet(false); }} style={{ height: 34, width: 110 }}>
                  {isReadOnly ? 'Stop watching' : 'Disconnect'}
                </Button>
              </div>
            ) : (
              <Button size="sm" fullWidth onClick={() => { onConnect(); setSheet(false); }}>Connect wallet</Button>
            )}
          </div>
        </div>
      )}

      <div style={{
        position: 'fixed', left: 12, right: 12, bottom: 'calc(10px + env(safe-area-inset-bottom))', zIndex: 400,
        padding: 4, borderRadius: 999,
        background: btb.glass, border: btb.border, backdropFilter: btb.blur, WebkitBackdropFilter: btb.blur, boxShadow: btb.shadow,
        display: 'flex', alignItems: 'stretch', gap: 2,
      }}>
        <div style={{ position: 'absolute', top: 0, left: '10%', right: '10%', height: 1, background: 'linear-gradient(90deg, transparent, rgba(var(--fg-rgb), 0.45), transparent)', pointerEvents: 'none' }} />
        {PRIMARY.map(i => item(tab === i.id && !sheet, i.icon, i.label, () => { setSheet(false); setTab(i.id); }))}
        {item(sheet || moreActive, 'menu', 'More', () => setSheet(s => !s))}
      </div>
    </>
  );
}
