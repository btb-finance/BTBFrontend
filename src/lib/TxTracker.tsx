'use client';
import { createContext, useCallback, useContext, useRef, useState, ReactNode } from 'react';
import { useConfig } from 'wagmi';
import { waitForTransactionReceipt, waitForCallsStatus } from 'wagmi/actions';
import { Icon } from '@/components/Icon';
import { btb } from '@/components/design-tokens';

// One global place that watches every pending on-chain action (mint, swap,
// stake, approve, claim, unstake), polls confirmation every 5s, and surfaces a
// status pill. Screens call `track(...)` after submitting a tx and either
// fire-and-forget (with `onConfirmed`) or `await` the returned `done` promise
// to sequence follow-up calls.

const POLL_MS = 5_000;       // "check every 5 sec"
const TIMEOUT_MS = 180_000;  // give up after 3 min
const DISMISS_MS = 6_000;    // auto-hide settled pills

export type TxStatus = 'pending' | 'confirmed' | 'failed';
export type TxRecord = { id: string; label: string; status: TxStatus; hash?: `0x${string}`; error?: string };
export type Settled = { status: 'confirmed' | 'failed'; error?: string };

type TrackArgs = {
  label: string;
  hash?: `0x${string}`;
  callsId?: string;
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

  const track: TrackFn = useCallback(({ label, hash, callsId, onConfirmed }) => {
    const id = `tx-${++seq}`;
    setRecords(rs => [...rs, { id, label, status: 'pending', hash }]);

    const done: Promise<Settled> = (async () => {
      try {
        let ok = false;
        if (callsId) {
          const res = await waitForCallsStatus(config, { id: callsId, pollingInterval: POLL_MS, timeout: TIMEOUT_MS });
          ok = res.status === 'success';
          const last = res.receipts?.[res.receipts.length - 1]?.transactionHash;
          if (last) patch(id, { hash: last });
        } else if (hash) {
          const receipt = await waitForTransactionReceipt(config, { hash, pollingInterval: POLL_MS, timeout: TIMEOUT_MS });
          ok = receipt.status === 'success';
        }
        if (ok) {
          patch(id, { status: 'confirmed' });
          onConfirmed?.();
          scheduleDismiss(id);
          return { status: 'confirmed' as const };
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
        return (
          <div key={r.id} onClick={() => dismiss(r.id)} style={{
            pointerEvents: 'auto', cursor: 'pointer', width: '100%', maxWidth: 360,
            display: 'flex', alignItems: 'center', gap: 11,
            background: 'rgba(18,18,26,0.86)', backdropFilter: 'blur(20px) saturate(140%)',
            border: `1px solid ${r.status === 'pending' ? 'rgba(255,255,255,0.16)' : color + '66'}`,
            borderRadius: 14, padding: '10px 14px', boxShadow: '0 10px 30px rgba(0,0,0,0.45)',
          }}>
            {r.status === 'pending'
              ? <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.25)', borderTopColor: '#fff', animation: 'spin 0.8s linear infinite', flexShrink: 0 }}/>
              : <div style={{ flexShrink: 0, display: 'flex' }}><Icon name={r.status === 'confirmed' ? 'check' : 'twitter'} size={16} color={color}/></div>}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: '#fff', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.label}</div>
              <div style={{ color, fontSize: 11, fontWeight: 600 }}>
                {r.status === 'pending' ? 'Confirming…' : r.status === 'confirmed' ? 'Confirmed' : (r.error ?? 'Failed')}
              </div>
            </div>
            {r.hash && (
              <a href={`https://etherscan.io/tx/${r.hash}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                style={{ flexShrink: 0, color: btb.textMuted, fontSize: 11, fontFamily: 'monospace', textDecoration: 'none' }}>↗</a>
            )}
          </div>
        );
      })}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
