'use client';
import { useState } from 'react';
import { Icon } from './Icon';
import { Button } from './Button';
import { btb } from './design-tokens';
import { Tab } from './types';

// Bottom navigation shown instead of the sidebar below the mobile breakpoint.
// Four primary tabs stay visible; everything else (remaining tabs, Earn, Docs,
// wallet) lives in the "More" sheet.
const PRIMARY: { id: Tab; label: string; icon: string }[] = [
  { id: 'home',      label: 'Home',      icon: 'home' },
  { id: 'discover',  label: 'Discover',  icon: 'chart' },
  { id: 'swap',      label: 'Swap',      icon: 'swap' },
  { id: 'portfolio', label: 'Portfolio', icon: 'pie' },
];

const MORE_TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'token',    label: 'BTB Token', icon: 'bank' },
  { id: 'simulate', label: 'Simulate',  icon: 'layers' },
  { id: 'nft',      label: 'NFT',       icon: 'nft' },
  { id: 'stake',    label: 'Agent',     icon: 'bolt' },
  { id: 'studio',   label: 'Agent Studio', icon: 'rocket' },
];

export function MobileNav({ tab, setTab, address, isReadOnly, onEarn, onDocs, onConnect, onDisconnect }: {
  tab: Tab;
  setTab: (t: Tab) => void;
  address?: string;
  isReadOnly: boolean;
  onEarn: () => void;
  onDocs: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  const [sheet, setSheet] = useState(false);
  const shortAddr = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : undefined;
  const moreActive = MORE_TABS.some(i => i.id === tab);

  const item = (active: boolean, icon: string, label: string, onClick: () => void) => (
    <div key={label} onClick={onClick} style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
      padding: '8px 0 6px', cursor: 'pointer',
    }}>
      <Icon name={icon} size={20} color={active ? btb.text : btb.textMuted}/>
      <span style={{ color: active ? btb.text : btb.textMuted, fontSize: 10.5, fontWeight: active ? 700 : 500 }}>{label}</span>
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
            width: '100%', background: 'rgba(10,10,15,0.98)',
            border: '1px solid rgba(255,255,255,0.1)', borderBottom: 'none',
            borderRadius: '24px 24px 0 0', padding: '16px 16px calc(90px + env(safe-area-inset-bottom))',
            display: 'flex', flexDirection: 'column', gap: 14,
          }}>
            <div style={{ width: 40, height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.2)', margin: '0 auto' }}/>

            {/* remaining tabs + overlays */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {[
                ...MORE_TABS.map(i => ({ ...i, onClick: () => { setTab(i.id); setSheet(false); }, active: tab === i.id })),
                { id: 'earn', label: 'Earn', icon: 'launch', onClick: () => { onEarn(); setSheet(false); }, active: false },
                { id: 'docs', label: 'Docs', icon: 'doc',    onClick: () => { onDocs(); setSheet(false); }, active: false },
              ].map(i => (
                <div key={i.id} onClick={i.onClick} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                  padding: '14px 0 12px', borderRadius: 16, cursor: 'pointer',
                  background: i.active ? btb.surfaceStrong : 'rgba(255,255,255,0.05)',
                  border: btb.borderSoft,
                }}>
                  <Icon name={i.icon} size={20} color={i.active ? btb.text : btb.textMuted}/>
                  <span style={{ color: i.active ? btb.text : btb.textMuted, fontSize: 12, fontWeight: 600 }}>{i.label}</span>
                </div>
              ))}
            </div>

            {/* wallet */}
            {address ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.05)', border: btb.borderSoft, borderRadius: 16, padding: '12px 14px' }}>
                <Icon name="wallet" size={18} color={btb.textMuted}/>
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
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 400,
        background: 'rgba(10,10,15,0.92)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        borderTop: btb.borderSoft,
        display: 'flex', alignItems: 'stretch',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        {PRIMARY.map(i => item(tab === i.id && !sheet, i.icon, i.label, () => { setSheet(false); setTab(i.id); }))}
        {item(sheet || moreActive, 'menu', 'More', () => setSheet(s => !s))}
      </div>
    </>
  );
}
