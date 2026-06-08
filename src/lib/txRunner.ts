import type { Config } from 'wagmi';
import { sendCalls, sendTransaction } from 'wagmi/actions';
import type { TrackFn } from './TxTracker';

// A single call in a (possibly batched) action.
export type Call = {
  to: `0x${string}`;
  data?: `0x${string}`;
  value?: bigint;
  gas?: bigint;
};

export type RunResult = { lastHash?: `0x${string}` };

/**
 * Execute one or more calls as a user action, tracking confirmation.
 *
 * - When there's more than one call, try EIP-5792 `wallet_sendCalls` first so
 *   the wallet can run e.g. approve+stake in a SINGLE confirmation (atomic on
 *   wallets that support it). Falls back to sequential txs on wallets that don't.
 * - Sequential mode submits each call and WAITS for its receipt before the next
 *   one — this is what stops an approve from racing ahead of the action that
 *   depends on it.
 *
 * Forward-looking: once native account abstraction (EIP-8141 Frame Transactions)
 * is available on mainnet, the atomic branch can be swapped for a frame/4337
 * bundle without changing any call site.
 */
export async function runCalls(
  config: Config,
  { account, calls, label, track }: { account: `0x${string}`; calls: Call[]; label: string; track: TrackFn },
): Promise<RunResult> {
  if (calls.length === 0) return {};

  // --- EIP-5792 atomic batch (one confirmation for the whole bundle) ---
  if (calls.length > 1) {
    try {
      const { id } = await sendCalls(config, {
        account,
        calls: calls.map(c => ({ to: c.to, data: c.data, value: c.value })),
      });
      const { done } = track({ callsId: id, label });
      const res = await done;
      if (res.status !== 'confirmed') throw new Error(res.error ?? 'Batch failed');
      return {};
    } catch (err) {
      // Only fall back to sequential when the wallet simply doesn't support
      // wallet_sendCalls. A user rejection or an on-chain revert must surface.
      if (!isMethodUnsupported(err)) throw err;
    }
  }

  // --- Sequential fallback / single call ---
  let lastHash: `0x${string}` | undefined;
  for (let i = 0; i < calls.length; i++) {
    const c = calls[i];
    const stepLabel = calls.length > 1 ? `${label} (${i + 1}/${calls.length})` : label;
    const hash = await sendTransaction(config, { account, to: c.to, data: c.data, value: c.value, gas: c.gas });
    lastHash = hash;
    const { done } = track({ hash, label: stepLabel });
    const res = await done;
    if (res.status !== 'confirmed') throw new Error(res.error ?? 'Transaction failed');
  }
  return { lastHash };
}

function isMethodUnsupported(err: unknown): boolean {
  const e = err as { code?: number; cause?: { code?: number }; shortMessage?: string; message?: string; details?: string };
  const code = e?.code ?? e?.cause?.code;
  if (code === 4200 || code === -32601 || code === -32600) return true; // "Unsupported Method" / "Method not found"
  const msg = `${e?.shortMessage ?? ''} ${e?.message ?? ''} ${e?.details ?? ''}`.toLowerCase();
  return (
    msg.includes('wallet_sendcalls') ||
    msg.includes('does not exist') ||
    msg.includes('not found') ||
    msg.includes('not support') ||
    msg.includes('unsupported') ||
    msg.includes('method not')
  );
}
