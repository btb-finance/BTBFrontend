'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useConnection } from 'wagmi';
import { btb } from './design-tokens';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAlerts, ALERT_MIN_BTB, FAST_CHECK_BTB, isWalletBrowser, checkedAgo } from '../lib/alerts';
import { readableError } from '../lib/errorText';
import { FastAlertsPanel } from './FastAlerts';


const section: React.CSSProperties = { color: btb.textDim, fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .4, padding: '10px 10px 6px' };
const smallBtn = (tone: string): React.CSSProperties => ({ height: 26, padding: '0 10px', borderRadius: 999, border: btb.borderSoft, background: 'transparent', color: tone, fontSize: 11.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' });

function ago(t: number): string {
  const m = Math.round((Date.now() - t) / 60_000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}h ago` : new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function dayLabel(t: number): string {
  const d = new Date(t), now = new Date();
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(now) - start(d)) / 86_400_000);
  return diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div style={{ padding: '28px 18px', textAlign: 'center' }}>
      <div style={{ color: btb.text, fontSize: 13.5, fontWeight: 800 }}>{title}</div>
      <div style={{ color: btb.textMuted, fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>{text}</div>
    </div>
  );
}

/** Bell with unread count; opens the notifications panel: recent range alerts, and the watched positions with the
 * check settings, plus a line for every XP the wallet earns. Hidden until the wallet has any of these. */
/** `bare`: no border or fill of its own, for sitting inside the top bar's grouped pill. `pill`: a 36px round button
 * matching the Portfolio card's Send and Refresh; that card clips its contents, so the panel opens in a layer on the
 * page body, under the button and the full width of the screen. */
export function AlertsBell({ compact = false, bare = false, pill = false }: { compact?: boolean; bare?: boolean; pill?: boolean }) {
  const { address } = useConnection();
  const { inbox, unread, markRead, list, stop } = useAlerts(address);
  const [open, setOpen] = useState(false);
  const credit = useQuery(api.alerts.creditFor, address ? { address } : 'skip');
  const [note, setNote] = useState<{ text: string; good: boolean } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<'activity' | 'watching'>('activity');
  // The ones unread when the panel opened stay highlighted while it is open, even though opening marks them read.
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  /** Where the panel opens when it lives on the page body (pill): just under the button. */
  const [anchor, setAnchor] = useState<{ top: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    // A window opened from the panel (the top-up) lives in a portal outside it; a tap there must not close the panel,
    // which would take the window down with it.
    const close = (e: MouseEvent) => {
      const t = e.target as Element | null;
      if (!ref.current?.contains(t) && !t?.closest?.('[data-overlay]')) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  useEffect(() => {
    if (!open) { setFresh(new Set()); return; }
    if (unread > 0) { setFresh(new Set((inbox ?? []).filter((e) => !e.read).map((e) => String(e.id)))); markRead(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, unread]);

  if (!address || ((list?.length ?? 0) === 0 && (inbox?.length ?? 0) === 0)) return null;

  const watched = list ?? [];
  const fastLive = !!credit?.fast && credit.total >= FAST_CHECK_BTB;
  const events = (inbox ?? []).map((e) => ({ ...e, id: String(e.id) }));
  // Today, Yesterday, then dates, newest first (the inbox already is).
  const groups: [string, typeof events][] = [];
  for (const e of events) {
    const day = dayLabel(e.createdAt);
    const last = groups[groups.length - 1];
    if (last && last[0] === day) last[1].push(e); else groups.push([day, [e]]);
  }

  const onBody = (node: React.ReactNode) => (pill ? createPortal(node, document.body) : node);

  async function run(key: string, fn: () => Promise<string | null>, success: string) {
    setBusy(key); setNote(null);
    try {
      const problem = await fn();
      setNote(problem ? { text: problem, good: false } : { text: success, good: true });
    } catch (e) { setNote({ text: readableError(e, 'Something went wrong; try again'), good: false }); }
    finally { setBusy(null); }
  }

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button type="button" aria-label="Alerts" onClick={() => {
        if (pill && !open && ref.current) {
          const r = ref.current.getBoundingClientRect();
          setAnchor({ top: r.bottom + 8 });
        }
        setOpen(o => !o);
      }} style={{
        width: pill ? 36 : bare ? 32 : compact ? 34 : 38, height: pill ? 36 : bare ? 32 : compact ? 34 : 38, borderRadius: bare || pill ? 999 : 12,
        border: bare ? 'none' : btb.borderSoft, background: bare ? 'transparent' : pill ? 'rgba(var(--fg-rgb), 0.07)' : btb.surfaceSoft, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: btb.text, position: 'relative', marginRight: bare || pill ? 0 : 8,
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/></svg>
        {unread > 0 && <span style={{ position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 999, background: btb.green, color: '#0A0A0F', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{unread}</span>}
      </button>
      {open && onBody(
        <div data-overlay style={{ ...(pill && anchor
          // On a phone: the full width between 12px margins, on the app background so the page behind cannot show through.
          ? { position: 'fixed', top: anchor.top, left: 12, right: 12, width: 'auto', maxHeight: `min(620px, calc(100vh - ${anchor.top + 96}px))`,
              background: `linear-gradient(${btb.glassStrong}, ${btb.glassStrong}), var(--chain-app-background, #0A0A0F)` }
          : { position: 'absolute', top: 44, right: 0, width: 380, maxWidth: 'calc(100vw - 24px)', maxHeight: 'min(620px, calc(100vh - 90px))', background: btb.glassStrong }), display: 'flex', flexDirection: 'column', borderRadius: 20, border: btb.border, backdropFilter: btb.blur, WebkitBackdropFilter: btb.blur, boxShadow: '0 20px 50px rgba(0,0,0,0.4)', zIndex: 120, overflow: 'hidden' }}>
          <div style={{ flexShrink: 0, padding: '14px 14px 10px', borderBottom: '1px solid rgba(var(--fg-rgb), 0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ color: btb.text, fontSize: 16, fontWeight: 800, letterSpacing: -0.2 }}>Notifications</div>
              <div style={{ color: btb.textDim, fontSize: 11 }}>{fresh.size > 0 ? `${fresh.size} new` : 'All caught up'}</div>
            </div>
            <div style={{ display: 'flex', gap: 4, marginTop: 10, padding: 3, borderRadius: 999, background: 'rgba(var(--fg-rgb), 0.05)' }}>
              {([['activity', 'Activity'], ['watching', `Watching ${watched.length}`]] as const).map(([id, text]) => (
                <button key={id} type="button" onClick={() => setView(id)} style={{ flex: 1, height: 28, borderRadius: 999, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 800, background: view === id ? btb.surfaceStrong : 'transparent', color: view === id ? btb.text : btb.textMuted }}>{text}</button>
              ))}
            </div>
          </div>

          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', padding: 8 }}>
            {view === 'activity' ? (
              events.length === 0 ? (
                <Empty title="Nothing yet" text={`You will see a line here for every XP you earn, and when a watched position leaves or re-enters its range${isWalletBrowser() ? '. This browser cannot receive push, so check back here.' : ', with a push on this device for range alerts.'}`}/>
              ) : groups.map(([day, rows]) => (
                <div key={day}>
                  <div style={section}>{day}</div>
                  {rows.map(e => {
                    // Range alerts ('out', 'in') have fixed wording; the agent ('auto') and XP ('xp') lines carry their own message.
                    const out = e.kind === 'out', xp = e.kind === 'xp', range = out || e.kind === 'in';
                    const tone = out ? btb.amber : btb.green;
                    return (
                      <div key={e.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px', borderRadius: 14, background: fresh.has(e.id) ? 'rgba(var(--green-rgb), 0.07)' : 'transparent' }}>
                        <span style={{ width: 32, height: 32, borderRadius: 11, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: tone, background: `color-mix(in srgb, ${tone} 15%, transparent)` }}>
                          {out
                            ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>
                            : xp
                            ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>
                            : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                            <span style={{ color: btb.text, fontSize: 13, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.label}</span>
                            <span style={{ color: btb.textDim, fontSize: 11, flexShrink: 0 }}>{ago(e.createdAt)}</span>
                          </div>
                          <div style={{ color: btb.textMuted, fontSize: 12, marginTop: 2, lineHeight: 1.45 }}>
                            {range
                              ? <><span style={{ color: tone, fontWeight: 700 }}>{out ? 'Out of range.' : 'Back in range.'}</span> {out ? 'Rebalance to keep earning fees.' : 'Earning fees again.'}</>
                              : e.message}
                          </div>
                        </div>
                        {fresh.has(e.id) && <span style={{ width: 7, height: 7, borderRadius: 999, background: btb.green, flexShrink: 0, marginTop: 6 }}/>}
                      </div>
                    );
                  })}
                </div>
              ))
            ) : (
              <>
                {watched.length === 0 && <Empty title="Nothing watched" text="Turn on Alert me on a position in your portfolio."/>}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {watched.map(a => {
                    const key = `${a.chainId}:${a.protocol}:${a.tokenId}`;
                    const tone = a.lastInRange == null ? btb.textDim : a.lastInRange ? btb.green : btb.amber;
                    return (
                      <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px', borderRadius: 14, background: 'rgba(var(--fg-rgb), 0.035)' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ color: btb.text, fontSize: 13, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.label}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, color: btb.textDim, fontSize: 11 }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: tone, fontWeight: 700 }}><span style={{ width: 6, height: 6, borderRadius: 999, background: 'currentColor' }}/>{a.lastInRange == null ? 'Unknown' : a.lastInRange ? 'In range' : 'Out of range'}</span>
                            <span>{fastLive ? 'every 5 min' : 'hourly'}, {checkedAgo(a.lastCheckedAt)}</span>
                          </div>
                        </div>
                        <button type="button" disabled={busy === key} onClick={() => run(key, async () => { await stop(a); return null; }, `Stopped watching ${a.label}.`)} style={smallBtn(btb.textMuted)}>{busy === key ? 'Stopping' : 'Stop'}</button>
                      </div>
                    );
                  })}
                </div>
                {note && <div style={{ color: note.good ? btb.green : btb.amber, fontSize: 11.5, padding: '8px 10px 0' }}>{note.text}</div>}
                <div style={section}>Checks</div>
                <FastAlertsPanel address={address} watched={watched.length} active={open}/>
                <div style={{ color: btb.textDim, fontSize: 10.5, padding: '8px 10px 4px', lineHeight: 1.4 }}>Alerts need {ALERT_MIN_BTB.toLocaleString('en-US')} BTB in the wallet. Each check costs {FAST_CHECK_BTB} BTB.</div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
