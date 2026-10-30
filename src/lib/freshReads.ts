/**
 * Reads that must see a transaction that just confirmed. Public RPCs are load-balanced and often a block or two behind,
 * and the app's fallback transport only moves on when a node errors, not when it answers from an older block. So a
 * receipt can be "not found", an allowance can still read as before the approval, or a position can still look unmoved,
 * seconds after the chain has it. Here the same read goes to a few endpoints at once and the first answer that already
 * shows the new state wins (a node can lag behind, never run ahead). Used by the page (TxTracker, txRunner) and the
 * server (autoRebalanceActions).
 */
import { createPublicClient, http, type PublicClient, type TransactionReceipt } from 'viem';
import { rpcUrls } from './chainRpc';
import { getChainClient } from './chainClient';

const cache = new Map<string, PublicClient>();

/** Up to `n` independent clients for a chain, best ranked first (the tested list when installed, else the backup). */
export function freshClients(chainId: number, n = 3): PublicClient[] {
  const chain = getChainClient(chainId)?.chain;
  const out = rpcUrls(chainId).slice(0, n).map((url) => {
    const key = `${chainId}:${url}`;
    let c = cache.get(key);
    if (!c) {
      c = createPublicClient({ chain, transport: http(url, { timeout: 8_000, retryCount: 0 }) }) as PublicClient;
      cache.set(key, c);
    }
    return c;
  });
  const fallback = getChainClient(chainId);
  return out.length ? out : fallback ? [fallback] : [];
}

/**
 * The same read on every client at once: the first answer that passes `good` wins straight away. If none does, the
 * first answer that came back at all; if every read failed, the first error.
 */
export function firstGood<T>(clients: PublicClient[], read: (c: PublicClient) => Promise<T>, good: (v: T) => boolean): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (clients.length === 0) { reject(new Error('No RPC for this chain')); return; }
    let left = clients.length;
    let firstValue: { v: T } | null = null;
    let firstError: unknown = null;
    const settle = () => {
      if (--left > 0) return;
      if (firstValue) resolve(firstValue.v); else reject(firstError ?? new Error('RPC read failed'));
    };
    for (const c of clients) {
      read(c).then((v) => {
        if (good(v)) { resolve(v); return; }
        firstValue ??= { v };
        settle();
      }, (e) => { firstError ??= e; settle(); });
    }
  });
}

/** A transaction's receipt from whichever client has it first; null when none has it yet. */
export function receiptAnywhere(clients: PublicClient[], hash: `0x${string}`): Promise<TransactionReceipt | null> {
  return firstGood(clients, (c) => c.getTransactionReceipt({ hash }).catch(() => null), (r) => r != null).catch(() => null);
}
