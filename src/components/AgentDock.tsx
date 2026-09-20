'use client';
import { useEffect, useState } from 'react';
import { Portal } from './Portal';
import { Icon } from './Icon';
import { btb } from './design-tokens';
import { useSidebar } from '../lib/SidebarContext';
import { useTokenStore } from '../lib/TokenStore';
import { CONTRACTS } from '../lib/wagmi';
import { AgentChat, AGENT_REQUIRED_BTB } from './screens/StakeScreen';

/**
 * The agent, one tap from anywhere: a message bubble in the corner that
 * opens a side panel (desktop) or a full-height sheet (phone) with the same
 * chat as the Agent tab. Hidden on the Agent tab itself.
 */
export function AgentDock({ hidden, onConnect, onGetBtb }: { hidden?: boolean; onConnect: () => void; onGetBtb?: () => void }) {
  const { isMobile } = useSidebar();
  const { tokens, walletAddress } = useTokenStore();
  const [open, setOpen] = useState(false);
  const btbToken = tokens.find((t) => t.address.toLowerCase() === CONTRACTS.BTB.toLowerCase());
  const balance = parseFloat(btbToken?.balance ?? '0');
  const holder = balance >= AGENT_REQUIRED_BTB;
  const fmtM = (n: number) => n >= 1e6 ? `${(n / 1e6).toLocaleString('en-US', { maximumFractionDigits: 2 })}M` : n.toLocaleString('en-US', { maximumFractionDigits: 0 });

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [open]);

  if (hidden) return null;

  return (
    <>
      <Portal>
        <button type="button" onClick={() => setOpen((o) => !o)} aria-label={open ? 'Close the BTB Agent' : 'Ask the BTB Agent'} title="BTB Agent" style={{
          position: 'fixed', right: isMobile ? 14 : 24, bottom: isMobile ? 'calc(78px + env(safe-area-inset-bottom))' : 24, zIndex: 410,
          width: 52, height: 52, borderRadius: 999, border: btb.border, cursor: 'pointer',
          background: btb.gradGreen, color: '#fff', boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
          display: open ? 'none' : 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a8 8 0 0 1-8 8H8l-5 3 1.5-4.5A8 8 0 1 1 21 12z"/></svg>
        </button>
      </Portal>

      {open && (
        <Portal>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 405, background: isMobile ? 'rgba(0,0,0,0.55)' : 'transparent' }}/>
          <div style={{
            position: 'fixed', zIndex: 406, display: 'flex', flexDirection: 'column',
            ...(isMobile
              ? { left: 0, right: 0, bottom: 0, height: '88vh', borderRadius: '24px 24px 0 0' }
              : { right: 24, bottom: 24, width: 440, height: 'min(720px, calc(100vh - 48px))', borderRadius: 24 }),
            background: btb.bg, border: btb.border, boxShadow: '0 24px 60px rgba(0,0,0,0.45)', overflow: 'hidden',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: btb.borderSoft, flexShrink: 0 }}>
              <div style={{ width: 30, height: 30, borderRadius: 10, background: btb.gradGreen, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="bolt" size={15} color="#fff"/>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: btb.text, fontSize: 14, fontWeight: 800 }}>BTB Agent</div>
                <div style={{ color: btb.textMuted, fontSize: 11 }}>{walletAddress ? (holder ? `${fmtM(balance)} BTB · 50 messages a day` : 'Free · 5 messages a day') : 'Connect a wallet to chat'}</div>
              </div>
              <div onClick={() => setOpen(false)} style={{ cursor: 'pointer', padding: 6 }}><Icon name="close" size={16} color={btb.textMuted}/></div>
            </div>
            <div style={{ flex: 1, minHeight: 0, padding: 12, display: 'flex', flexDirection: 'column' }}>
              {walletAddress ? (
                <AgentChat walletAddress={walletAddress} holder={holder} btbBalance={fmtM(balance)} onGetBtb={onGetBtb} compact/>
              ) : (
                <div style={{ margin: 'auto', textAlign: 'center', color: btb.textMuted, fontSize: 13, lineHeight: 1.6, padding: 20 }}>
                  The agent reads your holdings and positions, so it needs a wallet.
                  <div style={{ marginTop: 14 }}>
                    <button type="button" onClick={onConnect} style={{ height: 40, padding: '0 18px', borderRadius: 12, border: 'none', cursor: 'pointer', background: btb.gradGreen, color: '#fff', fontWeight: 700, fontFamily: 'inherit', fontSize: 13 }}>Connect wallet</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Portal>
      )}
    </>
  );
}
