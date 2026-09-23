'use client';
import { useEffect, useRef, useState } from 'react';
import { useConnection } from 'wagmi';
import { btb } from './design-tokens';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAlerts, ALERT_MIN_BTB, FAST_CHECK_BTB, isWalletBrowser } from '../lib/alerts';
import { FastAlertsPanel, alertErrText } from './FastAlerts';

const ago = (t: number | null) => {
  if (!t) return 'not checked yet';
  const m = Math.round((Date.now() - t) / 60_000);
  return m < 1 ? 'checked just now' : m < 60 ? `checked ${m}m ago` : `checked ${Math.round(m / 60)}h ago`;
};

const section: React.CSSProperties = { color: btb.textDim, fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .4, padding: '10px 10px 4px' };
const smallBtn = (tone: string): React.CSSProperties => ({ height: 26, padding: '0 10px', borderRadius: 999, border: btb.borderSoft, background: 'transparent', color: tone, fontSize: 11.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' });

/** Bell with unread count; opens the alert panel: watched positions, the
 * fast-check balance, and the inbox. Hidden until the wallet has any alerts. */
export function AlertsBell({ compact = false }: { compact?: boolean }) {
  const { address } = useConnection();
  const { inbox, unread, markRead, list, stop } = useAlerts(address);
  const [open, setOpen] = useState(false);
  const credit = useQuery(api.alerts.creditFor, address ? { address } : 'skip');
  const [note, setNote] = useState<{ text: string; good: boolean } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  useEffect(() => { if (open && unread > 0) markRead(); }, [open, unread, markRead]);

  if (!address || ((list?.length ?? 0) === 0 && (inbox?.length ?? 0) === 0)) return null;

  const watched = list ?? [];
  const fastLive = !!credit?.fast && credit.total >= FAST_CHECK_BTB;

  async function run(key: string, fn: () => Promise<string | null>, success: string) {
    setBusy(key); setNote(null);
    try {
      const problem = await fn();
      setNote(problem ? { text: problem, good: false } : { text: success, good: true });
    } catch (e) { setNote({ text: alertErrText(e), good: false }); }
    finally { setBusy(null); }
  }

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
        <div style={{ position: 'absolute', top: 46, right: 0, width: 340, maxWidth: 'calc(100vw - 24px)', maxHeight: 'min(640px, calc(100vh - 90px))', overflowY: 'auto', padding: 8, borderRadius: 16, background: btb.glassStrong, border: btb.border, backdropFilter: btb.blur, WebkitBackdropFilter: btb.blur, boxShadow: '0 16px 40px rgba(0,0,0,0.35)', zIndex: 120 }}>
          <div style={{ color: btb.text, fontSize: 13.5, fontWeight: 800, padding: '6px 10px 2px' }}>Range alerts</div>

          <div style={section}>Watching {watched.length} position{watched.length === 1 ? '' : 's'}</div>
          {watched.length === 0 && <div style={{ color: btb.textMuted, fontSize: 12, padding: '2px 10px 6px' }}>Nothing watched. Turn on Alert me on a position in your portfolio.</div>}
          {watched.map(a => {
            const key = `${a.chainId}:${a.protocol}:${a.tokenId}`;
            return (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 10 }}>
                <span style={{ width: 7, height: 7, borderRadius: 999, flexShrink: 0, background: a.lastInRange == null ? btb.textDim : a.lastInRange ? btb.green : btb.amber }}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: btb.text, fontSize: 12.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.label} <span style={{ color: btb.textDim, fontWeight: 600 }}>#{a.tokenId}</span></div>
                  <div style={{ color: btb.textDim, fontSize: 11 }}>{a.lastInRange == null ? 'Range unknown' : a.lastInRange ? 'In range' : 'Out of range'}, {fastLive ? 'every 5 min' : 'hourly'}, {ago(a.lastCheckedAt)}</div>
                </div>
                <button type="button" disabled={busy === key} onClick={() => run(key, async () => { await stop(a); return null; }, `Stopped watching ${a.label}.`)} style={smallBtn(btb.textMuted)}>{busy === key ? 'Stopping' : 'Stop'}</button>
              </div>
            );
          })}

          {note && <div style={{ color: note.good ? btb.green : btb.amber, fontSize: 11.5, padding: '2px 10px 4px' }}>{note.text}</div>}

          <div style={section}>Fast checks</div>
          <FastAlertsPanel address={address} watched={watched.length} active={open}/>
          <div style={section}>Recent</div>
          {(inbox ?? []).length === 0 && <div style={{ color: btb.textMuted, fontSize: 12, padding: '2px 10px 8px', lineHeight: 1.5 }}>You will see a line here when a position leaves or re-enters its range{isWalletBrowser() ? '. This browser cannot receive push, so check back here.' : ', and a push notification on this device.'}</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
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
