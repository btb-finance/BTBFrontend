'use client';
/**
 * Cloudflare Turnstile: proof that a real browser, not a script, asked for something (today: the daily check-in).
 * No wallet signature. The check is shown in a small card at the bottom of the screen so people can see what is
 * happening: a status line, Cloudflare's own widget, and a plain error with a fix if it fails or takes too long.
 * The server verifies the one-time token with Cloudflare (convex/checkInActions.ts). Site key is public.
 */

export const TURNSTILE_SITE_KEY = '0x4AAAAAAFrFNhkJkVybOUzV';

type Turnstile = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  execute: (el: HTMLElement | string) => void;
  remove: (id: string) => void;
};
declare global { interface Window { turnstile?: Turnstile } }

const LOAD_LIMIT_MS = 15_000;
const CHECK_LIMIT_MS = 45_000;
const BLOCKED_MSG = 'Could not load the human check. Turn off ad blockers or shields for btb.finance, then refresh.';
const FAILED_MSG = 'Could not confirm this browser. Refresh the page and try again.';
const SLOW_MSG = 'The human check took too long. Check your connection, then refresh and try again.';

let loading: Promise<Turnstile> | null = null;
function loadTurnstile(): Promise<Turnstile> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise<Turnstile>((resolve, reject) => {
    const fail = () => { loading = null; reject(new Error(BLOCKED_MSG)); };
    const timer = setTimeout(fail, LOAD_LIMIT_MS);
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.onload = () => { clearTimeout(timer); if (window.turnstile) resolve(window.turnstile); else fail(); };
    s.onerror = () => { clearTimeout(timer); fail(); };
    document.head.appendChild(s);
  });
  return loading;
}

/** The visible card: a status line over Cloudflare's widget. Returns setters and a close. */
function statusCard() {
  const card = document.createElement('div');
  card.setAttribute('role', 'status');
  card.setAttribute('aria-live', 'polite');
  Object.assign(card.style, {
    position: 'fixed', left: '50%', bottom: '16px', transform: 'translateX(-50%)', zIndex: '2147483000',
    width: 'min(340px, calc(100vw - 32px))', boxSizing: 'border-box', padding: '12px 14px', borderRadius: '14px',
    background: 'rgba(18, 18, 20, 0.96)', color: '#fff', border: '1px solid rgba(255, 255, 255, 0.12)',
    boxShadow: '0 8px 30px rgba(0, 0, 0, 0.45)', font: '500 14px/1.4 system-ui, sans-serif',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', textAlign: 'center',
  });
  const line = document.createElement('div');
  const widget = document.createElement('div');
  card.append(line, widget);
  document.body.appendChild(card);
  return {
    widget,
    say: (text: string, tone: 'info' | 'ok' | 'error' = 'info') => {
      line.textContent = text;
      line.style.color = tone === 'error' ? '#ff8a8a' : tone === 'ok' ? '#7ee2a8' : 'rgba(255, 255, 255, 0.85)';
    },
    close: (afterMs = 0) => setTimeout(() => card.remove(), afterMs),
  };
}

/** XP for an action (Simulate, swap, bridge, mint): a fresh token for the server's "xp" check. */
export const xpToken = (label: string) => turnstileToken('xp', label);

/**
 * Simulate XP is once a day per key, so after the server has answered for a key today the app skips asking again
 * and no human check pops up for nothing. Browser storage only; when it is unavailable the app just asks.
 */
const dayKey = (key: string) => `btb-xp:${Math.floor(Date.now() / 86_400_000)}:${key}`;
export function xpDoneToday(key: string): boolean {
  try { return localStorage.getItem(dayKey(key)) === '1'; } catch { return false; }
}
export function markXpDone(key: string) {
  try { localStorage.setItem(dayKey(key), '1'); } catch { /* storage blocked */ }
}

// One check at a time, so several XP claims at once show one card after another, not a stack.
let queue: Promise<unknown> = Promise.resolve();

/**
 * A fresh one-time token. Each call renders its own widget and removes it after, since a token works once.
 * Rejects with a message the user can act on, and leaves that message on screen for a few seconds.
 */
export function turnstileToken(action = 'checkin', label = 'Daily check-in'): Promise<string> {
  const run = queue.then(() => oneToken(action, label));
  queue = run.catch(() => undefined);
  return run;
}

async function oneToken(action: string, label: string): Promise<string> {
  const card = statusCard();
  card.say(`${label}: loading the human check...`);
  let ts: Turnstile;
  try {
    ts = await loadTurnstile();
  } catch (e) {
    card.say(BLOCKED_MSG, 'error'); card.widget.remove(); card.close(8000);
    throw e;
  }
  card.say(`${label}: confirming you are human...`);
  return new Promise<string>((resolve, reject) => {
    let id = '';
    let settled = false;
    const end = (ok: boolean, text: string, after: number) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { ts.remove(id); } catch { /* already gone */ }
      card.widget.remove();
      card.say(text, ok ? 'ok' : 'error');
      card.close(after);
    };
    const timer = setTimeout(() => { end(false, SLOW_MSG, 8000); reject(new Error(SLOW_MSG)); }, CHECK_LIMIT_MS);
    id = ts.render(card.widget, {
      sitekey: TURNSTILE_SITE_KEY,
      action,
      execution: 'execute',
      appearance: 'always',
      theme: 'dark',
      callback: (token: string) => { end(true, 'Confirmed.', 1200); resolve(token); },
      'error-callback': () => { end(false, FAILED_MSG, 8000); reject(new Error(FAILED_MSG)); return true; },
      'unsupported-callback': () => { end(false, 'This browser is not supported by the human check. Try another browser.', 8000); reject(new Error(FAILED_MSG)); },
    });
    ts.execute(card.widget);
  });
}
