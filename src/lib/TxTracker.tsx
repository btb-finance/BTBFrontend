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
import { readableError } from './errorText';
import { useTxStep } from './txRunner';

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
    if (Date.now() > end) throw new Error('Still not confirmed after 3 minutes. It may yet go through, so check the explorer before trying again.');
    await new Promise((res) => setTimeout(res, POLL_MS));
  }
}
const DISMISS_MS = 6_000;    // auto-hide a confirmed pill
const DISMISS_FAIL_MS = 14_000; // a failure stays long enough to read

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

  const scheduleDismiss = useCallback((id: string, failed = false) => {
    timers.current[id] = setTimeout(() => dismiss(id), failed ? DISMISS_FAIL_MS : DISMISS_MS);
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
        const reverted = 'The network rejected it. Your tokens did not move; only the network fee was spent.';
        patch(id, { status: 'failed', error: reverted });
        scheduleDismiss(id, true);
        return { status: 'failed' as const, error: reverted };
      } catch (e) {
        const error = readableError(e, 'Could not confirm it. Check the explorer before trying again.');
        patch(id, { status: 'failed', error });
        scheduleDismiss(id, true);
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
  // While the wallet is asking, say so and say what for: every action gets this from the runner, no screen sets it.
  const step = useTxStep();
  const signing = step?.phase === 'sign';
  if (records.length === 0 && !signing) return null;
  const shown = records.slice(-3).reverse();
  return (
    <div style={{
      // Top of the screen, clear of the pinned action buttons and the bottom menu.
      position: 'fixed', left: 0, right: 0,
      top: 'calc(env(safe-area-inset-top, 0px) + 12px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
      zIndex: 2000, pointerEvents: 'none', padding: '0 12px',
    }}>
      {signing && (
        <div style={{
          pointerEvents: 'auto', width: '100%', maxWidth: 380, boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 12,
          background: 'rgba(var(--bg-rgb), 0.96)', backdropFilter: 'blur(20px) saturate(140%)', WebkitBackdropFilter: 'blur(20px) saturate(140%)',
          border: '1px solid rgba(var(--green-rgb), 0.35)', borderRadius: 18, padding: '12px 14px', boxShadow: '0 12px 36px rgba(0,0,0,0.35)',
        }}>
          <span style={{ width: 32, height: 32, borderRadius: 999, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(var(--green-rgb), 0.14)' }}>
            <Icon name="wallet" size={15} color={btb.green}/>
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: btb.text, fontSize: 13.5, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{step.label}</div>
            <div style={{ color: btb.green, fontSize: 12, fontWeight: 600, marginTop: 2 }}>
              {step.approve ? `Allow the app to use your ${step.token ?? 'token'}. Confirm in your wallet` : 'Confirm in your wallet'}
            </div>
          </div>
        </div>
      )}
      {shown.map(r => {
        const chain = r.chainId ? SUPPORTED_CHAINS.find(c => c.id === r.chainId) : undefined;
        const explorer = chain?.blockExplorers?.default.url;
        const ok = r.status === 'confirmed', bad = r.status === 'failed';
        const tone = ok ? 'var(--green-rgb)' : bad ? 'var(--loss-rgb)' : 'var(--fg-rgb)';
        return (
          <div key={r.id} style={{
            pointerEvents: 'auto', width: '100%', maxWidth: 380, boxSizing: 'border-box',
            display: 'flex', alignItems: bad ? 'flex-start' : 'center', gap: 12,
            background: 'rgba(var(--bg-rgb), 0.96)', backdropFilter: 'blur(20px) saturate(140%)', WebkitBackdropFilter: 'blur(20px) saturate(140%)',
            border: `1px solid rgba(${tone}, ${r.status === 'pending' ? 0.14 : 0.4})`,
            borderRadius: 18, padding: '12px 12px 12px 14px', boxShadow: '0 12px 36px rgba(0,0,0,0.35)',
          }}>
            <span style={{ width: 32, height: 32, borderRadius: 999, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: ok ? btb.green : bad ? `rgba(${tone}, 0.14)` : 'rgba(var(--fg-rgb), 0.06)' }}>
              {r.status === 'pending'
                ? <span style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(var(--fg-rgb), 0.18)', borderTopColor: 'var(--btb-text)', animation: 'spin 0.8s linear infinite' }}/>
                : <Icon name={ok ? 'check' : 'close'} size={15} color={ok ? '#04140c' : btb.loss}/>}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: btb.text, fontSize: 13.5, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.label}</div>
              <div style={{ color: ok ? btb.green : bad ? btb.loss : btb.textMuted, fontSize: 12, fontWeight: 600, lineHeight: 1.4, marginTop: 2 }}>
                {r.status === 'pending' ? `Waiting for ${chain?.name ?? 'the network'} to confirm` : ok ? `Done on ${chain?.name ?? 'chain'}` : (r.error ?? 'It did not go through.')}
              </div>
            </div>
            {r.hash && (
              <a href={`${explorer ?? 'https://etherscan.io'}/tx/${r.hash}`} target="_blank" rel="noreferrer"
                style={{ flexShrink: 0, alignSelf: 'center', height: 28, padding: '0 10px', borderRadius: 999, display: 'flex', alignItems: 'center', background: 'rgba(var(--fg-rgb), 0.06)', color: btb.textMuted, fontSize: 11.5, fontWeight: 800, textDecoration: 'none' }}>View</a>
            )}
            <button type="button" onClick={() => dismiss(r.id)} aria-label="Dismiss"
              style={{ flexShrink: 0, alignSelf: 'center', width: 26, height: 26, borderRadius: 999, border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
              <Icon name="close" size={12} color={btb.textDim}/>
            </button>
          </div>
        );
      })}
    </div>
  );
}
