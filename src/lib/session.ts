'use client';
import { useCallback, useEffect, useState } from 'react';
import { useAction } from 'convex/react';
import { useSignMessage } from 'wagmi';
import { api } from '../../convex/_generated/api';
import { alertAuthMessage, SESSION_ACTION } from '../../convex/alertMessages';

type Stored = { token: string; expiresAt: number };
const keyOf = (address: string) => `btb.session.${address.toLowerCase()}`;

function read(address?: string): Stored | null {
  if (!address) return null;
  try {
    const s = JSON.parse(localStorage.getItem(keyOf(address)) ?? 'null') as Stored | null;
    return s && s.expiresAt > Date.now() + 60_000 ? s : null;
  } catch { return null; }
}

/**
 * A signed session for the connected wallet: one signature, then a token
 * kept on this device for 30 days. Only asked for when the wallet does
 * something that needs it (the agent), never on page load.
 */
export function useWalletSession(address?: string) {
  const [session, setSession] = useState<Stored | null>(null);
  useEffect(() => { setSession(read(address)); }, [address]);
  const start = useAction(api.sessionActions.startSession);
  const { signMessageAsync } = useSignMessage();

  /** The token, asking for the one signature only when there is none. */
  const ensure = useCallback(async (): Promise<string> => {
    if (!address) throw new Error('Connect a wallet first');
    const have = read(address);
    if (have) return have.token;
    const issuedAt = Date.now();
    const signature = await signMessageAsync({ message: alertAuthMessage(address, SESSION_ACTION, issuedAt) });
    const res = await start({ address, issuedAt, signature });
    if (!res.ok) throw new Error(res.reason);
    const s = { token: res.token, expiresAt: res.expiresAt };
    try { localStorage.setItem(keyOf(address), JSON.stringify(s)); } catch { /* private mode: lasts this page */ }
    setSession(s);
    return s.token;
  }, [address, signMessageAsync, start]);

  /** Forget a token the server no longer accepts. */
  const forget = useCallback(() => {
    if (address) try { localStorage.removeItem(keyOf(address)); } catch { /* ignore */ }
    setSession(null);
  }, [address]);

  return { token: session?.token, ensure, forget };
}
