'use client';
/**
 * When the live connection to BTB's servers (Convex) is down for a while, points, streaks and pools show "..." with
 * no reason given. This says so, and that nothing is lost. It waits a few seconds first, so a normal start or a
 * short blip shows nothing, and it goes away by itself once the connection is back.
 */
import { useEffect, useState } from 'react';
import { useConvexConnectionState } from 'convex/react';

const GRACE_MS = 6_000;

export function ConnectionNotice() {
  const { isWebSocketConnected, hasEverConnected } = useConvexConnectionState();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isWebSocketConnected) { setShow(false); return; }
    const t = setTimeout(() => setShow(true), GRACE_MS);
    return () => clearTimeout(t);
  }, [isWebSocketConnected]);

  if (!show) return null;
  return (
    <div role="status" aria-live="polite" style={{
      position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 2147483000,
      width: 'min(460px, calc(100vw - 32px))', boxSizing: 'border-box', padding: '10px 14px', borderRadius: 12,
      background: 'rgba(18, 18, 20, 0.96)', color: '#fff', border: '1px solid rgba(255, 200, 80, 0.45)',
      boxShadow: '0 8px 30px rgba(0, 0, 0, 0.45)', font: '500 13.5px/1.45 system-ui, sans-serif', textAlign: 'center',
    }}>
      {hasEverConnected ? 'Reconnecting to BTB servers...' : 'Cannot reach BTB servers yet. Retrying...'}
      <div style={{ color: 'rgba(255, 255, 255, 0.65)', fontWeight: 400, marginTop: 2 }}>
        Your points are safe. If this lasts, turn off a VPN or ad blocker for btb.finance, or try another browser.
      </div>
    </div>
  );
}
