'use client';

const KEY = 'btb.ref';

/** A wallet's invite code: the first 8 hex characters of its address (the server resolves it, nothing is stored). */
export function referralCode(address: string): string {
  return address.toLowerCase().slice(2, 10);
}

/** Remember the invite code from an invite link (?r=code, or an older ?ref=0x… link), unless one is already remembered. */
export function captureReferral() {
  if (typeof window === 'undefined') return;
  try {
    const q = new URLSearchParams(window.location.search);
    const raw = (q.get('r') ?? q.get('ref'))?.toLowerCase();
    const code = raw && /^0x[0-9a-f]{40}$/.test(raw) ? referralCode(raw) : raw;
    if (code && /^[0-9a-f]{8}$/.test(code) && !localStorage.getItem(KEY)) localStorage.setItem(KEY, code);
  } catch { /* private mode: the invite simply is not remembered */ }
}

/** The invite code remembered in this browser, if any (never the wallet's own). */
export function pendingReferral(self?: string): string | undefined {
  try {
    const code = localStorage.getItem(KEY) ?? undefined;
    return code && (!self || code !== referralCode(self)) ? code : undefined;
  } catch { return undefined; }
}

/** The invite link for a wallet. */
export function inviteLink(address: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://btb.finance';
  return `${origin}/?r=${referralCode(address)}`;
}
