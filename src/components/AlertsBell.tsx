'use client';
import { useEffect, useRef, useState } from 'react';
import { useConnection } from 'wagmi';
import { btb } from './design-tokens';
import { useAlerts, ALERT_MIN_BTB, isWalletBrowser } from '../lib/alerts';

/** Bell with unread count; opens the alert inbox. Alerts are the only thing
 * that lives here, so it stays hidden until the wallet has any. */
export function AlertsBell({ compact = false }: { compact?: boolean }) {
  const { address } = useConnection();
  const { inbox, unread, markRead, list } = useAlerts(address);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  useEffect(() => { if (open && unread > 0) markRead(); }, [open, unread, markRead]);

  if (!address || ((list?.length ?? 0) === 0 && (inbox?.length ?? 0) === 0)) return null;

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button type="button" onClick={() => setOpen(o => !o)} aria-label="Alerts" style={{
        width: compact ? 34 : 38, height: compact ? 34 : 38, borderRadius: 12, border: btb.borderSoft, background: btb.surfaceSoft, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: btb.text, position: 'relative', marginRight: 8,
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/></svg>
        {unread > 0 && <span style={{ position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 999, background: btb.green, color: '#0A0A0F', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{unread}</span>}
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 46, right: 0, width: 320, maxWidth: 'calc(100vw - 24px)', padding: 8, borderRadius: 16, background: btb.glassStrong, border: btb.border, backdropFilter: btb.blur, WebkitBackdropFilter: btb.blur, boxShadow: '0 16px 40px rgba(0,0,0,0.35)', zIndex: 120 }}>
          <div style={{ color: btb.text, fontSize: 13.5, fontWeight: 800, padding: '6px 10px 8px' }}>Range alerts</div>
          {(inbox ?? []).length === 0 && <div style={{ color: btb.textMuted, fontSize: 12.5, padding: '4px 10px 10px', lineHeight: 1.5 }}>Watching {list?.length ?? 0} position{(list?.length ?? 0) === 1 ? '' : 's'}. You will see a line here when one leaves or re-enters its range{isWalletBrowser() ? '. This browser cannot receive push, so check back here.' : ', and a push notification on this device.'}</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 340, overflowY: 'auto' }}>
            {(inbox ?? []).map(e => (
              <div key={e.id} style={{ padding: '8px 10px', borderRadius: 10, background: e.read ? 'transparent' : 'rgba(var(--green-rgb), 0.07)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ color: e.kind === 'out' ? btb.amber : btb.green, fontSize: 11, fontWeight: 800, textTransform: 'uppercase' }}>{e.kind === 'out' ? 'Out of range' : 'Back in range'}</span>
                  <span style={{ color: btb.textDim, fontSize: 10.5 }}>{new Date(e.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                </div>
                <div style={{ color: btb.text, fontSize: 12.5, marginTop: 2 }}>{e.message}</div>
              </div>
            ))}
          </div>
          <div style={{ color: btb.textDim, fontSize: 10.5, padding: '8px 10px 4px', lineHeight: 1.4 }}>Alerts stay on while the wallet holds {ALERT_MIN_BTB.toLocaleString('en-US')} BTB.</div>
        </div>
      )}
    </div>
  );
}
