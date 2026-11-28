import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { gunzipSync, gzipSync } from 'node:zlib';

/**
 * Sign links: transactions a BTB tool built, as a btb.finance/sign link a person opens to sign them in their own
 * wallet. Any AI app can hand one over ("open this link to sign"), so building something never ends in "do it
 * yourself".
 *
 * The plan travels inside the link (gzip, base64url) with an HMAC from this server, so nothing is stored and any
 * server instance can open it. A link nobody here built, or one edited after building, fails the check; links
 * expire after 15 minutes and only sign from the wallet they were built for.
 */

export const SIGN_LINK_TTL_MS = 15 * 60_000;
const SITE = 'https://btb.finance';

export interface SignStep {
  label: string; to: string; data: string; value: string; fn?: string; dryRun?: string; dryRunNote?: string; warnings?: string[];
  /** Swaps: rebuilt with a fresh quote when signed more than a minute after builtAt (quotes go stale in about 2 minutes). */
  swap?: { chainId: number; tokenIn: string; tokenOut: string; amount: string; slippageBps: number };
  builtAt?: number;
  /** Solana steps: the BTB tool and arguments the page calls for a fresh transaction when the person signs. */
  solana?: { tool: 'build_pump_claim' | 'build_pump_launch'; args: Record<string, unknown> };
}
export interface SignPlan { v: 1; title: string; chainId: number; wallet: string; steps: SignStep[]; exp: number; /** Lets an agent ask whether the steps were signed (sign_status). */ id?: string; /** 'solana' for Solana links (built by api-rs); EVM otherwise. */ vm?: 'solana' }

/** Where the sign page reports signed steps and sign_status reads them back: BTB's API on Flux. */
export const SIGN_STATUS_API = process.env.NEXT_PUBLIC_BTB_API ?? 'https://btbmcp.app.runonflux.io';

function key(): Buffer | null {
  const secret = process.env.SIGN_LINK_SECRET ?? process.env.BTB_API_SECRET;
  // A key of its own, derived so a sign-link MAC can never be mistaken for anything else made with the same secret.
  return secret ? createHash('sha256').update(`btb-sign-link:${secret}`).digest() : null;
}

const mac = (k: Buffer, body: string) => createHmac('sha256', k).update(body).digest('base64url');

/** A btb.finance/sign link for these steps, or null when this server has no secret to seal it with. */
export function signLink(p: Omit<SignPlan, 'v' | 'exp' | 'id'>): { url: string; id: string } | null {
  const k = key();
  if (!k || !p.steps.length) return null;
  const id = randomBytes(12).toString('hex');
  const plan: SignPlan = { v: 1, ...p, exp: Date.now() + SIGN_LINK_TTL_MS, id };
  const body = gzipSync(Buffer.from(JSON.stringify(plan))).toString('base64url');
  // In the fragment: browsers never send it to any server, so the plan stays out of request logs.
  return { url: `${SITE}/sign#${body}.${mac(k, body)}`, id };
}

export type OpenResult = { ok: true; plan: SignPlan } | { ok: false; reason: 'invalid' | 'expired' | 'unavailable' };

/** Checks a token from a sign link and returns its plan. */
export function openSignToken(token: string, allowExpired = false): OpenResult {
  const k = key();
  if (!k) return { ok: false, reason: 'unavailable' };
  const [body, sig] = token.trim().replace(/^#/, '').split('.');
  if (!body || !sig || body.length > 60_000) return { ok: false, reason: 'invalid' };
  const want = Buffer.from(mac(k, body));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return { ok: false, reason: 'invalid' };
  let plan: SignPlan;
  try { plan = JSON.parse(gunzipSync(Buffer.from(body, 'base64url')).toString('utf8')) as SignPlan; }
  catch { return { ok: false, reason: 'invalid' }; }
  if (plan.v !== 1 || !Array.isArray(plan.steps)) return { ok: false, reason: 'invalid' };
  if (Date.now() > plan.exp && !allowExpired) return { ok: false, reason: 'expired' };
  return { ok: true, plan };
}

/** The plan inside a btb.finance/sign link (even an expired one), for checking what was signed. */
export function planFromLink(link: string): OpenResult {
  const token = link.includes('#') ? link.split('#')[1] : link;
  return openSignToken(token, true);
}
