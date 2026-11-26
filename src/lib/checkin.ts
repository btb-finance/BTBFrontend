'use client';
/**
 * The daily check-in request: one POST to Convex's /checkin (convex/http.ts) with a random id this browser keeps, and a hash of a few browser traits. Nothing to sign. The server adds the IP (hashed)
 * and uses all of it to pay one person one share (convex/sybil.ts).
 */
/** `needsLp`: the day counted but no daily XP was paid, because the wallet has no LP worth $1 (convex/lpGate.ts). */
export type CheckInResult = { alreadyCheckedIn: boolean; dailyXp?: number; weekMilestone?: number; holdBonus?: number; newStreak?: number; needsLp?: boolean };

const SITE_URL = process.env.NEXT_PUBLIC_CONVEX_SITE_URL
  ?? (process.env.NEXT_PUBLIC_CONVEX_URL ?? 'https://grateful-oyster-780.convex.cloud').replace('.convex.cloud', '.convex.site');

/** A random id for this browser, kept in local storage; a fresh one each visit if storage is blocked. */
function deviceId(): string {
  const key = 'btb:device';
  try {
    const have = localStorage.getItem(key);
    if (have && /^[A-Za-z0-9-]{8,64}$/.test(have)) return have;
    const id = crypto.randomUUID();
    localStorage.setItem(key, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

/** A hash of traits that rarely change for one browser (and that a new private window keeps). */
async function traitsHash(): Promise<string> {
  const n = navigator as Navigator & { deviceMemory?: number };
  const traits = [
    navigator.userAgent, navigator.language, (navigator.languages ?? []).join(','),
    Intl.DateTimeFormat().resolvedOptions().timeZone, `${screen.width}x${screen.height}x${screen.colorDepth}`,
    String(window.devicePixelRatio), String(navigator.hardwareConcurrency ?? ''), String(n.deviceMemory ?? ''), navigator.platform,
  ].join('|');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(traits));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

/** `ref`: the invite code this browser arrived with; the server links it only before the wallet's first check-in. */
export async function checkInNow(walletAddress: string, ref?: string | null): Promise<CheckInResult> {
  const fpHash = await traitsHash().catch(() => undefined);
  const res = await fetch(`${SITE_URL}/checkin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletAddress, deviceId: deviceId(), fpHash, ...(ref ? { ref } : {}) }),
    signal: AbortSignal.timeout(20_000),
  });
  const body = (await res.json().catch(() => ({}))) as CheckInResult & { error?: string };
  if (!res.ok) throw new Error(body.error ?? 'Could not check in; try again');
  return body;
}
