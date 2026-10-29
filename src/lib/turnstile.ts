'use client';
/**
 * Cloudflare Turnstile, invisible: proof that a real browser, not a script, asked for something (today: the daily
 * check-in). No puzzle and no wallet signature for the user; the widget runs in the background and hands back a
 * one-time token that the server verifies with Cloudflare (convex/checkInActions.ts). Site key is public.
 */

export const TURNSTILE_SITE_KEY = '0x4AAAAAAFrFNhkJkVybOUzV';

type Turnstile = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  execute: (el: HTMLElement | string) => void;
  remove: (id: string) => void;
};
declare global { interface Window { turnstile?: Turnstile } }

let loading: Promise<Turnstile> | null = null;
function loadTurnstile(): Promise<Turnstile> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile did not load')));
    s.onerror = () => { loading = null; reject(new Error('Turnstile did not load')); };
    document.head.appendChild(s);
  });
  return loading;
}

/**
 * A fresh one-time token. Each call renders its own widget and removes it after, since a token works once. The box
 * sits at the bottom of the screen in case Cloudflare ever wants a click; in invisible mode it stays empty.
 */
export async function turnstileToken(action = 'checkin'): Promise<string> {
  const ts = await loadTurnstile();
  const box = document.createElement('div');
  Object.assign(box.style, { position: 'fixed', left: '50%', bottom: '16px', transform: 'translateX(-50%)', zIndex: '2000' });
  document.body.appendChild(box);
  return new Promise<string>((resolve, reject) => {
    let id = '';
    const done = (fn: () => void) => { fn(); try { ts.remove(id); } catch { /* already gone */ } box.remove(); };
    const timer = setTimeout(() => done(() => reject(new Error('Could not confirm this browser. Refresh and try again.'))), 30_000);
    id = ts.render(box, {
      sitekey: TURNSTILE_SITE_KEY,
      action,
      execution: 'execute',
      appearance: 'interaction-only',
      callback: (token: string) => { clearTimeout(timer); done(() => resolve(token)); },
      'error-callback': () => { clearTimeout(timer); done(() => reject(new Error('Could not confirm this browser. Refresh and try again.'))); },
    });
    ts.execute(box);
  });
}
