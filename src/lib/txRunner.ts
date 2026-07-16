import type { Config } from 'wagmi';
import { getAccount, getPublicClient, sendCalls, sendTransaction, switchChain } from 'wagmi/actions';
import { decodeFunctionData, erc20Abi } from 'viem';
import type { TrackFn } from './TxTracker';
import type { SupportedChainId } from './wagmi';

// A single call in a (possibly batched) action.
export type Call = {
  to: `0x${string}`;
  data?: `0x${string}`;
  value?: bigint;
  gas?: bigint;
};

export type RunResult = { lastHash?: `0x${string}` };

export type ChainStateCheck = {
  /** Return true once the confirmed transaction is visible through the RPC. */
  test: () => boolean | Promise<boolean>;
  /** Human-readable failure if the RPC never exposes the expected state. */
  error: string;
  retries?: number;
  intervalMs?: number;
};

/**
 * RPCs can trail a confirmed receipt by a block or two. Poll the actual state
 * instead of sleeping blindly or sending the transaction a second time.
 */
export async function waitForChainState(check: ChainStateCheck): Promise<void> {
  const retries = check.retries ?? 8;
  const intervalMs = check.intervalMs ?? 1_000;
  let lastError: unknown;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      if (await check.test()) return;
    } catch (error) {
      lastError = error;
    }
    if (attempt + 1 < retries) await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  const detail = lastError instanceof Error ? ` (${lastError.message})` : '';
  throw new Error(`${check.error}${detail}`);
}

/** Switch the connected wallet and wait until wagmi observes the new chain. */
async function ensureTargetChain(config: Config, chainId?: number): Promise<void> {
  if (!chainId) return;
  const target = chainId as SupportedChainId;
  if (getAccount(config).chainId !== chainId) {
    const switchedChain = await switchChain(config, { chainId: target });
    if (switchedChain.id !== chainId) {
      throw new Error(`Wallet switched to chain ${switchedChain.id}, but chain ${chainId} is required.`);
    }
  }
  await waitForChainState({
    test: () => getAccount(config).chainId === chainId,
    error: `Your wallet switched networks, but the app did not sync to chain ${chainId}. Retry the transaction.`,
    retries: 30,
    intervalMs: 500,
  });
}

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
  { account, calls, label, track, chainId, verify }: { account: `0x${string}`; calls: Call[]; label: string; track: TrackFn; chainId?: number; verify?: ChainStateCheck },
): Promise<RunResult> {
  if (calls.length === 0) return {};
  await ensureTargetChain(config, chainId);

  // Approval builders are intentionally simple and may emit an approve every
  // time. Resolve them here, globally, against current chain state so every
  // feature (swap, add LP, increase, rebalance...) skips approvals it already
  // has. This also makes retries resume at the first unfinished operation.
  const pendingCalls: Call[] = [];
  for (const call of calls) {
    if (!(await isSatisfiedApproval(config, account, call, chainId))) pendingCalls.push(call);
  }
  if (pendingCalls.length === 0) {
    if (verify) await waitForChainState(verify);
    return {};
  }

  // --- EIP-5792 atomic batch (one confirmation for the whole bundle) ---
  if (pendingCalls.length > 1) {
    try {
      await ensureTargetChain(config, chainId);
      const { id } = await sendCalls(config, {
        account,
        chainId: chainId as SupportedChainId | undefined,
        calls: pendingCalls.map(c => ({ to: c.to, data: c.data, value: c.value })),
      });
      const { done } = track({ callsId: id, label, chainId });
      const res = await done;
      if (res.status !== 'confirmed') throw new Error(res.error ?? 'Batch failed');
      if (verify) await waitForChainState(verify);
      return {};
    } catch (err) {
      // Only fall back to sequential when the wallet simply doesn't support
      // wallet_sendCalls. A user rejection or an on-chain revert must surface.
      if (!isMethodUnsupported(err)) throw err;
    }
  }

  // --- Sequential fallback / single call ---
  let lastHash: `0x${string}` | undefined;
  for (let i = 0; i < pendingCalls.length; i++) {
    const c = pendingCalls[i];
    // Re-check immediately before submission: an earlier call in this action,
    // another tab, or a just-indexed batch may already have satisfied it.
    if (await isSatisfiedApproval(config, account, c, chainId)) continue;
    await ensureTargetChain(config, chainId);
    const stepLabel = pendingCalls.length > 1 ? `${label} (${i + 1}/${pendingCalls.length})` : label;
    const hash = await sendTransaction(config, { account, chainId: chainId as SupportedChainId | undefined, to: c.to, data: c.data, value: c.value, gas: c.gas });
    lastHash = hash;
    const { done } = track({ hash, label: stepLabel, chainId });
    const res = await done;
    if (res.status !== 'confirmed') throw new Error(res.error ?? 'Transaction failed');
  }
  if (verify) await waitForChainState(verify);
  return { lastHash };
}

async function isSatisfiedApproval(config: Config, owner: `0x${string}`, call: Call, chainId?: number): Promise<boolean> {
  if (!call.data?.startsWith('0x095ea7b3')) return false;
  try {
    const decoded = decodeFunctionData({ abi: erc20Abi, data: call.data });
    if (decoded.functionName !== 'approve') return false;
    const [spender, required] = decoded.args;
    const client = getPublicClient(config, chainId ? { chainId: chainId as SupportedChainId } : undefined);
    if (!client) return false;
    const allowance = await client.readContract({
      address: call.to,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [owner, spender],
    });
    return allowance >= required;
  } catch {
    // Non-standard tokens and malformed calldata must retain their original
    // transaction rather than being incorrectly skipped.
    return false;
  }
}

function isMethodUnsupported(err: unknown): boolean {
  const e = err as { code?: number; cause?: { code?: number }; shortMessage?: string; message?: string; details?: string };
  const code = e?.code ?? e?.cause?.code;
  // Some injected wallets return JSON-RPC Invalid Params for wallet_sendCalls
  // on chains where their EIP-5792 implementation is unavailable. This helper
  // is only used around sendCalls, so treating that response as an unsupported
  // batch is safe and lets the receipt-gated sequential path take over.
  if (code === 4200 || code === -32601 || code === -32600 || code === -32602) return true;
  const msg = `${e?.shortMessage ?? ''} ${e?.message ?? ''} ${e?.details ?? ''}`.toLowerCase();
  return (
    msg.includes('wallet_sendcalls') ||
    msg.includes('does not exist') ||
    msg.includes('not found') ||
    msg.includes('not support') ||
    msg.includes('unsupported') ||
    msg.includes('invalid parameter') ||
    msg.includes('method not')
  );
}
