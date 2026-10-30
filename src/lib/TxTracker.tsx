'use client';
import { createContext, useCallback, useContext, useRef, useState, ReactNode } from 'react';
import { useConfig } from 'wagmi';
import { getConnectorClient, waitForCallsStatus } from 'wagmi/actions';
import { createPublicClient, custom, type PublicClient, type TransactionReceipt } from 'viem';
import { freshClients, receiptAnywhere } from './freshReads';
import { Icon } from '@/components/Icon';
import { btb } from '@/components/design-tokens';
import { SUPPORTED_CHAINS, type SupportedChainId } from './wagmi';
import { markLpSnapshotsStale } from './appData';

// One global place that watches every pending on-chain action (mint, swap,
// stake, approve, claim, unstake), polls confirmation every 5s, and surfaces a
// status pill. Screens call `track(...)` after submitting a tx and either
// fire-and-forget (with `onConfirmed`) or `await` the returned `done` promise
// to sequence follow-up calls.

const POLL_MS = 500;         // Base and the other L2s confirm in about 2 s; ask twice a second
const TIMEOUT_MS = 180_000;  // stop watching after 3 min

/**
 * The receipt, from whoever has it first: the wallet's own RPC (it sent the transaction, so it usually knows first)
 * and three public RPCs, asked together twice a second. One public node a block or two behind used to hold a
 * confirmed transaction at "Confirming" for many seconds, or past the timeout so it showed as failed.
 */
async function fastReceipt(config: Parameters<typeof getConnectorClient>[0], hash: `0x${string}`, chainId: SupportedChainId | undefined): Promise<TransactionReceipt> {
  const clients: PublicClient[] = chainId ? freshClients(chainId, 3) : [];
  try {
    const wallet = await getConnectorClient(config, chainId ? { chainId } : undefined);
    clients.unshift(createPublicClient({ chain: wallet.chain, transport: custom({ request: wallet.request }) }) as unknown as PublicClient);
  } catch { /* no wallet client: the public ones alone */ }
  const end = Date.now() + TIMEOUT_MS;
  for (;;) {
    const r = await receiptAnywhere(clients, hash);
    if (r) return r;
    if (Date.now() > end) throw new Error('Not seen after 3 minutes. It may still confirm: check the explorer.');
    await new Promise((res) => setTimeout(res, POLL_MS));
  }
}
const DISMISS_MS = 6_000;    // auto-hide settled pills

export type TxStatus = 'pending' | 'confirmed' | 'failed';
export type TxRecord = { id: string; label: string; status: TxStatus; hash?: `0x${string}`; chainId?: number; error?: string };
export type Settled = { status: 'confirmed' | 'failed'; error?: string; hash?: `0x${string}`; blockNumber?: bigint };

type TrackArgs = {
  label: string;
  hash?: `0x${string}`;
  callsId?: string;
  chainId?: number;
  onConfirmed?: () => void;
};
export type TrackFn = (args: TrackArgs) => { id: string; done: Promise<Settled> };

type TxCtx = { track: TrackFn; records: TxRecord[]; dismiss: (id: string) => void };
const Ctx = createContext<TxCtx | null>(null);

export function useTx(): TxCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTx must be used within <TxProvider>');
  return ctx;
}

let seq = 0;

export function TxProvider({ children }: { children: ReactNode }) {
  const config = useConfig();
  const [records, setRecords] = useState<TxRecord[]>([]);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const patch = useCallback((id: string, p: Partial<TxRecord>) => {
    setRecords(rs => rs.map(r => (r.id === id ? { ...r, ...p } : r)));
  }, []);

  const dismiss = useCallback((id: string) => {
    setRecords(rs => rs.filter(r => r.id !== id));
    const t = timers.current[id];
    if (t) { clearTimeout(t); delete timers.current[id]; }
  }, []);

  const scheduleDismiss = useCallback((id: string) => {
    timers.current[id] = setTimeout(() => dismiss(id), DISMISS_MS);
  }, [dismiss]);

  const track: TrackFn = useCallback(({ label, hash, callsId, chainId, onConfirmed }) => {
    const id = `tx-${++seq}`;
    setRecords(rs => [...rs, { id, label, status: 'pending', hash, chainId }]);

    const done: Promise<Settled> = (async () => {
      try {
        let ok = false;
        let settledHash = hash;
        let blockNumber: bigint | undefined;
        if (callsId) {
          const res = await waitForCallsStatus(config, { id: callsId, pollingInterval: POLL_MS, timeout: TIMEOUT_MS });
          ok = res.status === 'success';
          const lastReceipt = res.receipts?.[res.receipts.length - 1];
          if (lastReceipt?.transactionHash) { patch(id, { hash: lastReceipt.transactionHash }); settledHash = lastReceipt.transactionHash; }
          blockNumber = lastReceipt?.blockNumber;
        } else if (hash) {
          const receipt = await fastReceipt(config, hash, chainId as SupportedChainId | undefined);
          ok = receipt.status === 'success';
          blockNumber = receipt.blockNumber;
        }
        if (ok) {
          patch(id, { status: 'confirmed' });
          markLpSnapshotsStale();
          onConfirmed?.();
          scheduleDismiss(id);
          return { status: 'confirmed' as const, hash: settledHash, blockNumber };
        }
        patch(id, { status: 'failed', error: 'Reverted on-chain' });
        scheduleDismiss(id);
        return { status: 'failed' as const, error: 'Reverted on-chain' };
      } catch (e) {
        const error = (e as { shortMessage?: string })?.shortMessage ?? (e as Error)?.message ?? 'Confirmation failed';
        patch(id, { status: 'failed', error });
        scheduleDismiss(id);
        return { status: 'failed' as const, error };
      }
    })();

    return { id, done };
  }, [config, patch, scheduleDismiss]);

  return (
    <Ctx.Provider value={{ track, records, dismiss }}>
      {children}
      <TxPill records={records} dismiss={dismiss} />
    </Ctx.Provider>
  );
}

function TxPill({ records, dismiss }: { records: TxRecord[]; dismiss: (id: string) => void }) {
  if (records.length === 0) return null;
  const shown = records.slice(-3).reverse();
  return (
    <div style={{
      position: 'fixed', left: 0, right: 0,
      bottom: 'calc(env(safe-area-inset-bottom, 0px) + 92px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
      zIndex: 2000, pointerEvents: 'none', padding: '0 16px',
    }}>
      {shown.map(r => {
        const color = r.status === 'confirmed' ? btb.green : r.status === 'failed' ? btb.loss : '#fff';
        const explorer = r.chainId ? SUPPORTED_CHAINS.find(chain => chain.id === r.chainId)?.blockExplorers?.default.url : undefined;
        return (
          <div key={r.id} onClick={() => dismiss(r.id)} style={{
            pointerEvents: 'auto', cursor: 'pointer', width: '100%', maxWidth: 360,
            display: 'flex', alignItems: 'center', gap: 11,
            background: 'rgba(18,18,26,0.86)', backdropFilter: 'blur(20px) saturate(140%)',
            border: `1px solid ${r.status === 'pending' ? 'rgba(var(--fg-rgb), 0.16)' : color + '66'}`,
            borderRadius: 14, padding: '10px 14px', boxShadow: '0 10px 30px rgba(0,0,0,0.45)',
          }}>
            {r.status === 'pending'
              ? <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(var(--fg-rgb), 0.25)', borderTopColor: '#fff', animation: 'spin 0.8s linear infinite', flexShrink: 0 }}/>
              : <div style={{ flexShrink: 0, display: 'flex' }}><Icon name={r.status === 'confirmed' ? 'check' : 'close'} size={16} color={color}/></div>}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: 'var(--btb-text)', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.label}</div>
              <div style={{ color, fontSize: 11, fontWeight: 600 }}>
                {r.status === 'pending' ? 'Confirming…' : r.status === 'confirmed' ? 'Confirmed' : (r.error ?? 'Failed')}
              </div>
            </div>
            {r.hash && (
              <a href={`${explorer ?? 'https://etherscan.io'}/tx/${r.hash}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                style={{ flexShrink: 0, color: btb.textMuted, fontSize: 11, fontFamily: 'monospace', textDecoration: 'none' }}>tx</a>
            )}
          </div>
        );
      })}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
