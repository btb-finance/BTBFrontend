'use client';
import { useEffect, useState } from 'react';
import { useAction, useMutation, useQuery } from 'convex/react';
import { useSignMessage } from 'wagmi';
import { api } from '../../convex/_generated/api';
import { alertAuthMessage, FAST_ON_ACTION } from '../../convex/alertMessages';

export { FAST_CHECK_BTB, HOURLY_CHECK_MS, DEPOSIT_MAX_AGE_MS, AGENT_MESSAGE_BTB, AGENT_FREE_PER_DAY } from '../../convex/alertMessages';
import { usePolledQuery } from './polledQuery';
import { useWalletSession } from './session';
import type { LiquidityPosition } from '@/protocols/types';

export const ALERT_MIN_BTB = 10_000;

/** True inside wallet in-app browsers, which have no Web Push. The inbox carries alerts there. */
export function isWalletBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const w = window as unknown as { ethereum?: { isTrust?: boolean; isSafePal?: boolean; isTokenPocket?: boolean; isMetaMask?: boolean; isCoinbaseWallet?: boolean } };
  return /Trust|SafePal|TokenPocket|imToken|BitKeep|Bitget|OKApp|MetaMaskMobile|CoinbaseWallet|Rainbow|Phantom/i.test(ua)
    || !!(w.ethereum && (w.ethereum.isTrust || w.ethereum.isSafePal || w.ethereum.isTokenPocket));
}

export function pushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && !isWalletBrowser();
}

/** iOS needs the site installed to the home screen before push works. */
export function needsHomeScreen(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const standalone = (navigator as unknown as { standalone?: boolean }).standalone === true || window.matchMedia?.('(display-mode: standalone)').matches;
  return ios && !standalone;
}

function toKey(base64: string): Uint8Array {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** "checked 4m ago" for an alert's last read. Shared by the bell and the position cards. */
export function checkedAgo(t: number | null): string {
  if (!t) return 'not checked yet';
  const m = Math.round((Date.now() - t) / 60_000);
  return m < 1 ? 'checked just now' : m < 60 ? `checked ${m}m ago` : `checked ${Math.round(m / 60)}h ago`;
}

export function positionKey(p: LiquidityPosition) {
  return { chainId: p.chainId ?? 1, protocol: p.protocol, tokenId: p.id.toString() };
}

type Signed = { ok: boolean; reason?: string } | null | undefined;

/**
 * Runs an alert change with the wallet's signed session: one signature per device, then none for 30 days. A token
 * the server no longer accepts is dropped and the change retried once with a fresh sign-in.
 */
export function useSignedCall(address?: string) {
  const session = useWalletSession(address);
  async function run<R extends Signed>(fn: (sessionToken: string) => Promise<R>): Promise<R> {
    const res = await fn(await session.ensure());
    if (res && !res.ok && /sign-in expired/i.test(res.reason ?? '')) { session.forget(); return fn(await session.ensure()); }
    return res;
  }
  return { run, token: session.token };
}

export function useAlerts(address?: string) {
  const list = useQuery(api.alerts.listForAddress, address ? { address } : 'skip');
  const subscribe = useAction(api.alertsActions.subscribe);
  const unsubscribe = useMutation(api.alerts.unsubscribe);
  const savePush = useMutation(api.alerts.savePushSubscription);
  const inbox = usePolledQuery(api.alerts.inbox, address ? { address } : 'skip', 60_000);
  const markRead = useMutation(api.alerts.markRead);
  const signed = useSignedCall(address);

  const has = (p: LiquidityPosition) => {
    const k = positionKey(p);
    return !!list?.some((a) => a.chainId === k.chainId && a.protocol === k.protocol && a.tokenId === k.tokenId);
  };

  /** Register the service worker and store this device's push subscription. Silent when unsupported. */
  async function enablePush(): Promise<'on' | 'denied' | 'unsupported'> {
    if (!address || !pushSupported()) return 'unsupported';
    const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapid) return 'unsupported';
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return 'denied';
    const reg = await navigator.serviceWorker.register('/sw.js');
    const sub = await reg.pushManager.getSubscription() ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(vapid) as BufferSource });
    const json = sub.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return 'unsupported';
    await signed.run((sessionToken) => savePush({ sessionToken, endpoint: json.endpoint!, p256dh: json.keys!.p256dh!, auth: json.keys!.auth!, userAgent: navigator.userAgent.slice(0, 120) }));
    return 'on';
  }

  /** Returns null on success, otherwise a sentence to show the user. */
  async function toggle(p: LiquidityPosition, label: string): Promise<string | null> {
    if (!address) return 'Connect a wallet first';
    const k = positionKey(p);
    if (has(p)) { const off = await signed.run((sessionToken) => unsubscribe({ sessionToken, ...k })); return off.ok ? null : off.reason; }
    const res = await signed.run((sessionToken) => subscribe({ sessionToken, ...k, label, inRange: p.inRange }));
    if (!res.ok) return res.reason;
    await enablePush().catch(() => 'unsupported');
    return null;
  }

  /** Stop one alert by its key, for rows whose position is not on screen. */
  const stop = (k: { chainId: number; protocol: string; tokenId: string }) => address ? signed.run((sessionToken) => unsubscribe({ sessionToken, chainId: k.chainId, protocol: k.protocol, tokenId: k.tokenId })) : Promise.resolve();

  return { list, has, toggle, stop, enablePush, inbox, unread: (inbox ?? []).filter((e) => !e.read).length, markRead: () => { if (signed.token) void markRead({ sessionToken: signed.token }); } };
}

/** The wallet's BTB balance (fast checks and agent messages draw on it), whether fast checks are on, and how to top it up. */
export function useAlertCredit(address?: string, { withTreasury = false } = {}) {
  const credit = useQuery(api.alerts.creditFor, address ? { address } : 'skip');
  const deposit = useAction(api.alertsActions.depositFromTx);
  const enable = useAction(api.alertsActions.enableFast);
  const readTreasury = useAction(api.alertsActions.depositAddress);
  const turnOff = useMutation(api.alerts.turnFastOff);
  const signedCall = useSignedCall(address);
  const { signMessageAsync } = useSignMessage();
  const [treasury, setTreasury] = useState<string | null>(null);
  useEffect(() => { if (withTreasury && address && !treasury) readTreasury({}).then(setTreasury).catch(() => {}); }, [withTreasury, address, treasury, readTreasury]);

  async function signed(action: string) {
    const issuedAt = Date.now();
    const signature = await signMessageAsync({ message: alertAuthMessage(address!, action, issuedAt) });
    return { issuedAt, signature };
  }

  /** Each returns null on success, otherwise a sentence to show. */
  async function setFast(on: boolean): Promise<string | null> {
    if (!address) return 'Connect a wallet first';
    if (!on) { const res = await signedCall.run((sessionToken) => turnOff({ sessionToken })); return res.ok ? null : res.reason; }
    const res = await enable({ address, ...(await signed(FAST_ON_ACTION)) });
    return res.ok ? null : res.reason;
  }
  async function depositTx(txHash: string): Promise<string | null> {
    const res = await deposit({ txHash });
    return res.ok ? null : res.reason;
  }
  return {
    // `rewards` is unclaimed weekly BTB, pulled in automatically once `balance` runs out; `total` is both.
    balance: credit?.balance ?? 0, rewards: credit?.rewards ?? 0, total: credit?.total ?? 0,
    fast: credit?.fast ?? false, history: credit?.history ?? [], loading: credit === undefined,
    treasury, setFast, depositTx,
  };
}
