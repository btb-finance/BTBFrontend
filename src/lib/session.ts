'use client';
import { useCallback, useEffect, useState } from 'react';
import { useAction } from 'convex/react';
import { useChainId, useSignMessage } from 'wagmi';
import { hashMessage, hashTypedData } from 'viem';
import { api } from '../../convex/_generated/api';
import { alertAuthMessage, loginNonce, SESSION_ACTION } from '../../convex/alertMessages';

type Stored = { token: string; expiresAt: number };
const keyOf = (address: string) => `btb.session.${address.toLowerCase()}`;
const pendingKeyOf = (address: string) => `btb.session.pending.${address.toLowerCase()}`;

/** How long we keep waiting for the rest of a multi-owner Safe to sign, per attempt. */
const SAFE_WAIT_MS = 10 * 60_000;

/**
 * The hash a Safe stores an off-chain message under: EIP-712 SafeMessage over the EIP-191 hash of the text,
 * for this Safe on this chain. Safe's own service looks the message up by it.
 */
function safeMessageHash(safe: `0x${string}`, chainId: number, text: string): `0x${string}` {
  return hashTypedData({
    domain: { chainId, verifyingContract: safe },
    types: { SafeMessage: [{ name: 'message', type: 'bytes' }] },
    primaryType: 'SafeMessage',
    message: { message: hashMessage(text) },
  });
}

/**
 * A multi-owner Safe answers a sign request with an empty signature: the message is created, and the other
 * owners confirm it in the Safe app. Poll Safe's service until enough owners have signed, then return the
 * combined signature. Null when it did not complete in time; the pending message is kept, so the next try
 * resumes waiting instead of asking for a new signature.
 */
async function waitForSafeSignature(safe: `0x${string}`, chainId: number, text: string): Promise<`0x${string}` | null> {
  const url = `https://safe-client.safe.global/v1/chains/${chainId}/messages/${safeMessageHash(safe, chainId, text)}`;
  const until = Date.now() + SAFE_WAIT_MS;
  while (Date.now() < until) {
    try {
      const r = await fetch(url);
      if (r.ok) {
        const m = await r.json() as { status?: string; preparedSignature?: string | null };
        if (m.status === 'CONFIRMED' && m.preparedSignature) return m.preparedSignature as `0x${string}`;
      }
    } catch { /* offline or not indexed yet: keep waiting */ }
    await new Promise((res) => setTimeout(res, 4000));
  }
  return null;
}

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
  const chainId = useChainId();
  /** True while a multi-owner Safe is collecting the other owners' signatures. */
  const [waitingForSafe, setWaitingForSafe] = useState(false);

  /** The token, asking for the one signature only when there is none. */
  const ensure = useCallback(async (): Promise<string> => {
    if (!address) throw new Error('Connect a wallet first');
    const have = read(address);
    if (have) return have.token;
    // A Safe message already waiting on co-owners: resume it rather than creating a second one.
    let pending: { issuedAt: number; chainId: number; secret?: string } | null = null;
    try { pending = JSON.parse(localStorage.getItem(pendingKeyOf(address)) ?? 'null'); } catch { /* ignore */ }
    if (pending && (pending.chainId !== chainId || !pending.secret || Date.now() - pending.issuedAt > 24 * 3600_000)) pending = null;

    const issuedAt = pending?.issuedAt ?? Date.now();
    // This device's login secret: never sent until the signature is done, and only its hash is in the signed text.
    const secret = pending?.secret ?? Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, '0')).join('');
    const message = alertAuthMessage(address, SESSION_ACTION, issuedAt, await loginNonce(secret));
    let signature: string = pending ? '0x' : await signMessageAsync({ message });
    if (!signature || signature === '0x') {
      try { localStorage.setItem(pendingKeyOf(address), JSON.stringify({ issuedAt, chainId, secret })); } catch { /* ignore */ }
      setWaitingForSafe(true);
      const full = await waitForSafeSignature(address as `0x${string}`, chainId, message).finally(() => setWaitingForSafe(false));
      if (!full) throw new Error('Waiting for the other Safe owners to sign. Once they have, try again; no new signature is needed.');
      signature = full;
    }
    try { localStorage.removeItem(pendingKeyOf(address)); } catch { /* ignore */ }
    const res = await start({ address, issuedAt, signature, chainId, secret });
    if (!res.ok) throw new Error(res.reason);
    const s = { token: res.token, expiresAt: res.expiresAt };
    try { localStorage.setItem(keyOf(address), JSON.stringify(s)); } catch { /* private mode: lasts this page */ }
    setSession(s);
    return s.token;
  }, [address, chainId, signMessageAsync, start]);

  /** Forget a token the server no longer accepts. */
  const forget = useCallback(() => {
    if (address) try { localStorage.removeItem(keyOf(address)); } catch { /* ignore */ }
    setSession(null);
  }, [address]);

  return { token: session?.token, ensure, forget, waitingForSafe };
}
