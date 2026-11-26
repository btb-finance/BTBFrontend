'use client';
/**
 * Simulate XP is once a day per key, so after the server has answered for a key today the app skips asking again.
 * Browser storage only; when it is unavailable the app just asks.
 */
const dayKey = (key: string) => `btb-xp:${Math.floor(Date.now() / 86_400_000)}:${key}`;
export function xpDoneToday(key: string): boolean {
  try { return localStorage.getItem(dayKey(key)) === '1'; } catch { return false; }
}
export function markXpDone(key: string) {
  try { localStorage.setItem(dayKey(key), '1'); } catch { /* storage blocked */ }
}
