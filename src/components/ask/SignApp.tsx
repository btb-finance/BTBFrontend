'use client';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useConnection, useDisconnect } from 'wagmi';
import { Providers } from '../Providers';
import { useChainTheme } from '@/lib/ChainThemeContext';
import type { TxStep } from '@/lib/ask/agent';
import type { SignPlan } from '@/lib/signLink';

/** BTB's API on Flux: the sign page reports each signed step there so the agent can see it (sign_status). */
const STATUS_API = process.env.NEXT_PUBLIC_BTB_API ?? 'https://btbmcp.app.runonflux.io';
import { AskFrame, Icon } from './AskFrame';
import { TxPlan, type StepState } from './TxPlan';
import { SolanaSign } from './SolanaSign';

const ConnectScreen = dynamic(() => import('../screens/ConnectScreen').then((m) => m.ConnectScreen), { ssr: false });

/**
 * btb.finance/sign#<token>: transactions an assistant built with a BTB tool (Claude, ChatGPT, any agent), shown as
 * numbered steps the person signs in their own wallet. The token is checked by the server first; only the wallet the
 * steps were built for can sign them.
 */
export function SignApp() {
  return <Providers fallback={<AskFrame title="Sign"/>}><SignInner/></Providers>;
}

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

function SignInner() {
  const { address } = useConnection();
  const { disconnect } = useDisconnect();
  const { mode, toggleMode } = useChainTheme();
  const [plan, setPlan] = useState<SignPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<StepState[]>([]);
  const [steps, setSteps] = useState<TxStep[]>([]);
  const [showConnect, setShowConnect] = useState(false);
  const [left, setLeft] = useState(0);

  useEffect(() => {
    const token = window.location.hash.slice(1);
    if (!token) { setError('This page needs a signing link from your assistant.'); return; }
    fetch('/api/sign', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token }) })
      .then((r) => r.json())
      .then((b: { plan?: SignPlan; error?: string }) => {
        if (!b.plan) { setError(b.error ?? 'This link could not be opened.'); return; }
        setPlan(b.plan);
        setSteps(b.plan.steps.map((s): TxStep => ({
          label: s.label, chainId: b.plan!.chainId, to: s.to, data: s.data, value: s.value, fn: s.fn ?? s.label,
          dryRun: (s.dryRun as TxStep['dryRun']) ?? 'none', dryRunNote: s.dryRunNote, warnings: s.warnings ?? [],
          ...(s.swap ? { swap: s.swap, builtAt: s.builtAt } : {}),
        })));
      })
      .catch(() => setError('No connection. Check your internet and reload.'));
  }, []);

  // Minutes left on the link.
  useEffect(() => {
    if (!plan) return;
    const tick = () => setLeft(Math.max(0, Math.ceil((plan.exp - Date.now()) / 60_000)));
    tick();
    const t = setInterval(tick, 15_000);
    return () => clearInterval(t);
  }, [plan]);

  const solana = plan?.vm === 'solana';
  const wrongWallet = !solana && !!(plan && address && address.toLowerCase() !== plan.wallet.toLowerCase());
  const expired = !!plan && left === 0;

  return (
    <AskFrame
      title="Sign"
      footer={
        <div className="ag-row">
          {solana ? null : address ? (
            <button type="button" className="ag-wallet" onClick={() => disconnect()} title="Disconnect"><span className="ag-dot"/>{short(address)}</button>
          ) : (
            <button type="button" className="ag-wallet primary" onClick={() => setShowConnect(true)}>Connect wallet</button>
          )}
          <button type="button" className="ag-icon-btn" onClick={toggleMode} aria-label={mode === 'dark' ? 'Switch to day' : 'Switch to night'}>
            <Icon name={mode === 'dark' ? 'sun' : 'moon'}/>
          </button>
        </div>
      }
    >
      <div className="ag-thread">
        {error && (
          <div className="ag-bot">
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>Nothing to sign</h2>
            <div className="ag-error">{error}</div>
            <div className="ag-actions"><a className="ag-action primary" href="/ask">Ask BTB instead<Icon name="arrow" size={13}/></a></div>
          </div>
        )}
        {!error && !plan && <div className="ag-thinking"><span className="ag-pulse"/>Checking the link</div>}
        {plan && (
          <div className="ag-bot">
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: -0.3 }}>{plan.title}</h2>
            <div className="ag-text">
              <p>Built by BTB for <strong>{short(plan.wallet)}</strong>, at your assistant&apos;s request. Sign the steps in order in your own wallet; nothing is sent without it.</p>
            </div>
            {expired && <div className="ag-error">This link has expired. Ask your assistant to build it again.</div>}
            {wrongWallet && <div className="ag-error">Your connected wallet is {short(address!)}, but these steps were built for {short(plan.wallet)}. Switch to that wallet to sign.</div>}
            {!address && !solana && <div className="ag-plan-dry">Connect {short(plan.wallet)} to sign.</div>}
            {solana ? <SolanaSign plan={plan} expired={expired}/> : !expired && !wrongWallet ? (
              <TxPlan txs={steps} state={state} onState={(i, s) => {
                  setState((st) => Object.assign([...st], { [i]: s }));
                  // Tell the agent: report the hash once it is sent (best effort; sign_status checks it on chain).
                  if (s.hash && plan.id && (s.status === 'confirming' || s.status === 'done')) {
                    fetch(`${STATUS_API}/api/v1/sign-status`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: plan.id, step: i + 1, hash: s.hash }) }).catch(() => {});
                  }
                }}
                onRebuilt={(i, step) => setSteps((all) => all.map((x, j) => (j === i ? step : x)))}/>
            ) : null}
            {solana ? (!expired && <div className="ag-hint">Link valid for {left} more minute{left === 1 ? '' : 's'}.</div>) : steps.length > 0 && steps.every((_, i) => state[i]?.status === 'done') ? (
              <div className="ag-text">
                <p><strong>All done.</strong> Your assistant can see it now: just tell it you are done. The transaction hash{steps.length > 1 ? 'es are' : ' is'} below too:</p>
                {state.map((st, i) => st?.hash && <p key={i} style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12.5, overflowWrap: 'anywhere' }}>{st.hash}</p>)}
              </div>
            ) : !expired && !wrongWallet && <div className="ag-hint">Link valid for {left} more minute{left === 1 ? '' : 's'}.</div>}
          </div>
        )}
      </div>
      {showConnect && <ConnectScreen onConnect={() => setShowConnect(false)} onClose={() => setShowConnect(false)}/>}
    </AskFrame>
  );
}
