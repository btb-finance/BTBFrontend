'use client';
/**
 * The site gate: every visitor passes Cloudflare's human check before btb.finance shows, once every 24 hours.
 * The inline script in src/app/layout.tsx decides before the first paint whether the gate is up (no pass yet, and
 * not a search engine or link preview bot) by putting `btb-gate` on <html>; CSS then hides the page and shows
 * this screen. The token is confirmed on the server (/human in convex/http.ts) before the pass is kept.
 */
import { useEffect, useRef, useState } from 'react';
import { TURNSTILE_SITE_KEY, gateIsUp, loadTurnstile, openGate } from '../lib/turnstile';

export const GATE_PASS_KEY = 'btb-human-until';
const PASS_MS = 24 * 60 * 60 * 1000;
const SITE_URL = process.env.NEXT_PUBLIC_CONVEX_SITE_URL
  ?? (process.env.NEXT_PUBLIC_CONVEX_URL ?? 'https://grateful-oyster-780.convex.cloud').replace('.convex.cloud', '.convex.site');

type State = 'loading' | 'checking' | 'error';

export function HumanGate() {
  const box = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<State>('loading');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [up, setUp] = useState(false);

  useEffect(() => { setUp(gateIsUp()); }, []);

  useEffect(() => {
    if (!up || !box.current) return;
    let id = '';
    let gone = false;
    const el = box.current;
    const fail = (msg: string) => { if (!gone) { setError(msg); setState('error'); } };
    const slow = setTimeout(() => fail('This is taking too long. Check your connection, then try again.'), 45_000);
    setState('loading'); setError('');
    loadTurnstile().then((ts) => {
      if (gone) return;
      setState('checking');
      id = ts.render(el, {
        sitekey: TURNSTILE_SITE_KEY,
        action: 'gate',
        theme: 'dark',
        appearance: 'always',
        callback: async (token: string) => {
          try {
            const res = await fetch(`${SITE_URL}/human`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ turnstileToken: token }),
              signal: AbortSignal.timeout(20_000),
            });
            if (!res.ok) throw new Error('rejected');
            clearTimeout(slow);
            try { localStorage.setItem(GATE_PASS_KEY, String(Date.now() + PASS_MS)); } catch { /* storage blocked: ask again next visit */ }
            if (!gone) { setUp(false); openGate(); }
          } catch {
            fail('Could not confirm this browser. Try again.');
          }
        },
        'error-callback': () => { fail('Could not confirm this browser. Turn off ad blockers or shields for btb.finance, then try again.'); return true; },
        'unsupported-callback': () => fail('This browser is not supported by the check. Try another browser.'),
      });
    }).catch((e: Error) => fail(e.message));
    return () => {
      gone = true;
      clearTimeout(slow);
      window.turnstile && id && (() => { try { window.turnstile!.remove(id); } catch { /* already gone */ } })();
    };
  }, [up, attempt]);

  return (
    <div id="btb-gate" role="dialog" aria-modal="true" aria-labelledby="btb-gate-title">
      <div className="btb-gate-card">
        <div className="btb-gate-logo">BTB</div>
        <h1 id="btb-gate-title">Checking your browser</h1>
        <p>A quick check by Cloudflare keeps bots out of BTB. It takes a few seconds and happens once a day.</p>
        <div ref={box} className="btb-gate-widget"/>
        <p className="btb-gate-status" aria-live="polite">
          {state === 'loading' ? 'Loading the check...' : state === 'checking' ? 'Confirming you are human...' : error}
        </p>
        {state === 'error' && (
          <button type="button" className="btb-gate-retry" onClick={() => setAttempt(a => a + 1)}>Try again</button>
        )}
      </div>
    </div>
  );
}
