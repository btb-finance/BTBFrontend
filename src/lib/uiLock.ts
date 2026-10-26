'use client';
import { useEffect, useSyncExternalStore } from 'react';

/**
 * Two app-wide states the navigation follows, as on Wind Swap:
 * - a sheet is open (Add liquidity, a deposit or withdraw sheet): the phone's bottom menu hides, so it cannot sit
 *   over the sheet's own buttons;
 * - the wallet is asking you to sign: both menus dim and stop taking taps, so a stray tap cannot leave the page in
 *   the middle of a transaction.
 * Both are counts, so overlapping sheets or prompts release only when the last one ends.
 */

let sheets = 0;
let signing = 0;
let snapshot = { sheetOpen: false, signing: false };
const listeners = new Set<() => void>();

function emit() {
  snapshot = { sheetOpen: sheets > 0, signing: signing > 0 };
  for (const l of listeners) l();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

const serverSnapshot = { sheetOpen: false, signing: false };

export function useUiLock(): { sheetOpen: boolean; signing: boolean } {
  return useSyncExternalStore(subscribe, () => snapshot, () => serverSnapshot);
}

/** Mark a sheet as open while `active`; the bottom menu hides until every open sheet closes. */
export function useSheetOpen(active: boolean) {
  useEffect(() => {
    if (!active) return;
    sheets++; emit();
    return () => { sheets--; emit(); };
  }, [active]);
}

/** Hold the menus while the wallet prompt is up. Call the returned function when the prompt is answered. */
export function beginSigning(): () => void {
  signing++; emit();
  let done = false;
  return () => { if (done) return; done = true; signing--; emit(); };
}

/** Run `prompt` (a wallet request) with the menus held, released however it ends. */
export async function whileSigning<T>(prompt: () => Promise<T>): Promise<T> {
  const release = beginSigning();
  try { return await prompt(); } finally { release(); }
}
