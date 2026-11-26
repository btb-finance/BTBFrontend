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
export function TxPlan({ txs, state, onState }: { txs: TxStep[]; state: StepState[]; onState: (i: number, s: StepState) => void }) {
  const config = useConfig();
  const { address, chainId: walletChain } = useConnection();
  const { switchChainAsync } = useSwitchChain();
  const { sendTransactionAsync } = useSendTransaction();
  const [busy, setBusy] = useState(false);

  const chainName = (id: number) => config.chains.find((c) => c.id === id)?.name ?? `chain ${id}`;
  const explorer = (id: number) => config.chains.find((c) => c.id === id)?.blockExplorers?.default.url;
  const next = txs.findIndex((_, i) => state[i]?.status !== 'done');

  const sign = async (i: number) => {
    const tx = txs[i];
    setBusy(true);
    onState(i, { status: 'signing' });
    try {
      if (walletChain !== tx.chainId) await switchChainAsync({ chainId: tx.chainId });
      const hash = await sendTransactionAsync({ to: tx.to as `0x${string}`, data: tx.data as `0x${string}`, value: BigInt(tx.value || '0'), chainId: tx.chainId });
      onState(i, { status: 'confirming', hash });
      const receipt = await waitForTransactionReceipt(config, { hash, chainId: tx.chainId });
      onState(i, receipt.status === 'success' ? { status: 'done', hash } : { status: 'failed', hash, error: 'The transaction reverted on chain.' });
    } catch (e) {
      const msg = (e as { shortMessage?: string }).shortMessage ?? (e as Error).message ?? 'Failed';
      onState(i, { status: 'failed', error: /reject|denied|cancel/i.test(msg) ? 'Cancelled in your wallet.' : msg.slice(0, 160) });
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
              <button type="button" className={`ag-action${isNext ? ' primary' : ''}`} disabled={!address || !isNext || busy} onClick={() => void sign(i)}>
                {st.status === 'signing' ? 'Confirm in wallet' : st.status === 'confirming' ? 'Confirming' : failedDry && isNext ? 'Sign anyway' : 'Sign'}
              </button>
            )}
          </div>
        );
      })}
      <div className="ag-plan-foot">
        {address
          ? 'Built from your request. Check the amounts in your wallet before you approve; nothing is sent without it.'
          : 'Connect a wallet you can sign with to send these. A watched address cannot sign.'}
      </div>
    </div>
  );
}
