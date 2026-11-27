'use client';
import { useState } from 'react';
import { useConfig, useConnection, useSendTransaction, useSwitchChain } from 'wagmi';
import { waitForTransactionReceipt } from 'wagmi/actions';
import { formatEther } from 'viem';
import type { TxStep } from '@/lib/ask/agent';
import { Icon } from './AskFrame';

/** Where each step stands in this browser: its hash once sent, and whether it confirmed. */
export type StepState = { hash?: string; status: 'idle' | 'signing' | 'confirming' | 'done' | 'failed'; error?: string };

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/**
 * Transactions the agent built (build_tx) as numbered steps. The person signs each in their own wallet, in order:
 * a step unlocks once the one before it has confirmed. Nothing is sent without their wallet's approval.
 */
export function TxPlan({ txs, state, onState, onRebuilt }: {
  txs: TxStep[]; state: StepState[]; onState: (i: number, s: StepState) => void;
  /** A swap step was rebuilt with a fresh quote: keep the new one with the chat. */
  onRebuilt?: (i: number, step: TxStep) => void;
}) {
  const config = useConfig();
  const { address, chainId: walletChain } = useConnection();
  const { switchChainAsync } = useSwitchChain();
  const { sendTransactionAsync } = useSendTransaction();
  const [busy, setBusy] = useState(false);

  const chainName = (id: number) => config.chains.find((c) => c.id === id)?.name ?? `chain ${id}`;
  const explorer = (id: number) => config.chains.find((c) => c.id === id)?.blockExplorers?.default.url;
  const next = txs.findIndex((_, i) => state[i]?.status !== 'done');
  // Steps are built for one wallet (approvals, balances, dry runs): another connected account must not sign them.
  const builtFor = txs.find((t) => t.from)?.from;
  const wrongWallet = !!(builtFor && address && builtFor.toLowerCase() !== address.toLowerCase());

  const sign = async (i: number) => {
    let tx = txs[i];
    setBusy(true);
    onState(i, { status: 'signing' });
    try {
      // A swap quote goes stale in a couple of minutes: rebuild it right before signing when it is older than one.
      if (tx.swap && address && Date.now() - (tx.builtAt ?? 0) > 60_000) {
        const r = await fetch('/api/ask/swap', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ swap: tx.swap, wallet: address }) });
        const b = await r.json().catch(() => ({})) as { step?: TxStep; error?: string };
        if (!b.step) throw new Error(b.error ?? 'Could not refresh the quote.');
        tx = b.step;
        onRebuilt?.(i, b.step);
      }
      if (walletChain !== tx.chainId) await switchChainAsync({ chainId: tx.chainId });
      // Send from the connected account explicitly, so the wallet never guesses another one.
      const hash = await sendTransactionAsync({ account: address, to: tx.to as `0x${string}`, data: tx.data as `0x${string}`, value: BigInt(tx.value || '0'), chainId: tx.chainId });
      onState(i, { status: 'confirming', hash });
      const receipt = await waitForTransactionReceipt(config, { hash, chainId: tx.chainId });
      onState(i, receipt.status === 'success' ? { status: 'done', hash } : { status: 'failed', hash, error: 'The transaction reverted on chain.' });
    } catch (e) {
      const msg = (e as { shortMessage?: string }).shortMessage ?? (e as Error).message ?? 'Failed';
      // EIP-1193 4100: the wallet has not let this site use this account (locked, switched, or connection gone stale).
      const unauthorized = /not been authorized|unauthorized|4100/i.test(msg);
      onState(i, {
        status: 'failed',
        error: unauthorized
          ? `Your wallet has not allowed btb.finance to use ${address ? short(address) : 'this account'}. Open the wallet, unlock it and allow this site for that account, or use Disconnect, then Connect wallet, and sign again.`
          : /reject|denied|cancel/i.test(msg) ? 'Cancelled in your wallet.' : msg.slice(0, 160),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ag-plan">
      <div className="ag-plan-head">
        <span>Ready to sign on {chainName(txs[0].chainId)}</span>
        <span className="ag-plan-sub">{txs.length === 1 ? '1 step' : `${txs.length} steps, in order`}</span>
      </div>
      {txs.map((tx, i) => {
        const st = state[i] ?? { status: 'idle' };
        const url = explorer(tx.chainId);
        const isNext = i === next;
        const failedDry = tx.dryRun === 'reverted';
        return (
          <div key={i} className={`ag-plan-step${st.status === 'done' ? ' done' : ''}`}>
            <span className="ag-plan-num">{st.status === 'done' ? <Icon name="check" size={13}/> : i + 1}</span>
            <div className="ag-plan-main">
              <div className="ag-plan-label">{tx.label}</div>
              <div className="ag-plan-meta">
                <code>{tx.fn}</code> on {url ? <a href={`${url}/address/${tx.to}`} target="_blank" rel="noreferrer">{short(tx.to)}</a> : short(tx.to)}
                {BigInt(tx.value || '0') > 0n && <> with {formatEther(BigInt(tx.value))} {tx.chainId === 56 ? 'BNB' : 'ETH'}</>}
              </div>
              {tx.swap && <div className="ag-plan-dry">Quote refreshes when you sign if it is over a minute old</div>}
              <div className={`ag-plan-dry${failedDry ? ' bad' : ''}`}>
                {tx.dryRun === 'passed' && 'Dry run passed'}
                {tx.dryRun === 'after-previous' && `Dry run waits for step ${i}: it needs that approval on chain first`}
                {tx.dryRun === 'skipped' && 'Dry run skipped'}
                {failedDry && `Dry run failed: ${tx.dryRunNote ?? 'it would revert now'}`}
              </div>
              {tx.warnings.map((w) => <div key={w} className="ag-plan-warn">{w}</div>)}
              {st.status === 'failed' && <div className="ag-plan-dry bad">{st.error}</div>}
              {st.hash && url && <a className="ag-plan-tx" href={`${url}/tx/${st.hash}`} target="_blank" rel="noreferrer">View transaction</a>}
            </div>
            {st.status !== 'done' && (
              <button type="button" className={`ag-action${isNext ? ' primary' : ''}`} disabled={!address || !isNext || busy || wrongWallet} onClick={() => void sign(i)}>
                {st.status === 'signing' ? 'Confirm in wallet' : st.status === 'confirming' ? 'Confirming' : failedDry && isNext ? 'Sign anyway' : 'Sign'}
              </button>
            )}
          </div>
        );
      })}
      {wrongWallet && (
        <div className="ag-plan-foot ag-error">
          These steps were built for {short(builtFor!)}, but your connected wallet is {short(address!)}. Switch to {short(builtFor!)} in your wallet (or ask again for this wallet) to sign.
        </div>
      )}
      <div className="ag-plan-foot">
        {address
          ? 'Built from your request. Check the amounts in your wallet before you approve; nothing is sent without it.'
          : 'Connect a wallet you can sign with to send these. A watched address cannot sign.'}
      </div>
    </div>
  );
}
