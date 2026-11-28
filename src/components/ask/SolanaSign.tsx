'use client';
import { useEffect, useState } from 'react';
import type { SignPlan } from '@/lib/signLink';
import { Icon } from './AskFrame';

/** BTB's API on Flux: builds the Solana transactions and records what was signed (sign_status). */
const API = process.env.NEXT_PUBLIC_BTB_API ?? 'https://btbmcp.app.runonflux.io';
const ROUTES: Record<string, string> = { build_pump_claim: '/api/v1/solana/pump/claim', build_pump_launch: '/api/v1/solana/pump/launch' };

/** The small part of the Wallet Standard this page uses (Phantom, Solflare, Backpack and others implement it). */
interface StdAccount { address: string; publicKey: Uint8Array }
interface StdWallet {
  name: string; icon: string; chains: readonly string[]; accounts: readonly StdAccount[];
  features: Record<string, unknown>;
}
type Connect = { connect: () => Promise<{ accounts: readonly StdAccount[] }> };
type SignAndSend = { signAndSendTransaction: (...inputs: { account: StdAccount; chain: string; transaction: Uint8Array }[]) => Promise<{ signature: Uint8Array }[]> };

/** Wallets that announce themselves through the Wallet Standard events and can sign and send on Solana. */
function useSolanaWallets(): StdWallet[] {
  const [wallets, setWallets] = useState<StdWallet[]>([]);
  useEffect(() => {
    const add = (...ws: StdWallet[]) => {
      const ok = ws.filter((w) => w.chains?.some((c) => c.startsWith('solana:')) && w.features?.['solana:signAndSendTransaction'] && w.features?.['standard:connect']);
      if (ok.length) setWallets((cur) => [...cur, ...ok.filter((w) => !cur.some((c) => c.name === w.name))]);
      return () => {};
    };
    const api = { register: add };
    const onRegister = (e: Event) => { try { (e as CustomEvent<(a: typeof api) => void>).detail(api); } catch { /* a broken wallet */ } };
    window.addEventListener('wallet-standard:register-wallet', onRegister);
    try { window.dispatchEvent(new CustomEvent('wallet-standard:app-ready', { detail: api })); } catch { /* old browser */ }
    return () => window.removeEventListener('wallet-standard:register-wallet', onRegister);
  }, []);
  return wallets;
}

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function base58(bytes: Uint8Array): string {
  let n = 0n;
  for (const b of bytes) n = n * 256n + BigInt(b);
  let s = '';
  while (n > 0n) { s = B58[Number(n % 58n)] + s; n /= 58n; }
  for (const b of bytes) { if (b !== 0) break; s = '1' + s; }
  return s;
}
const fromB64 = (b: string) => Uint8Array.from(atob(b), (c) => c.charCodeAt(0));
const short = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;

type Status = { kind: 'idle' } | { kind: 'building' } | { kind: 'signing' } | { kind: 'sent'; sig: string } | { kind: 'error'; message: string };

/**
 * Solana steps of a btb.finance/sign link: connect a Solana wallet, then each step is built fresh by BTB's API
 * (Solana transactions expire about a minute after they are built), dry-run there, and signed and sent by the wallet.
 */
export function SolanaSign({ plan, expired }: { plan: SignPlan; expired: boolean }) {
  const wallets = useSolanaWallets();
  const [wallet, setWallet] = useState<StdWallet | null>(null);
  const [account, setAccount] = useState<StdAccount | null>(null);
  const [status, setStatus] = useState<Status[]>(plan.steps.map(() => ({ kind: 'idle' })));
  const set = (i: number, s: Status) => setStatus((all) => all.map((x, j) => (j === i ? s : x)));

  async function connect(w: StdWallet) {
    try {
      const r = await (w.features['standard:connect'] as Connect).connect();
      const acct = r.accounts.find((a) => a.address === plan.wallet) ?? r.accounts[0] ?? null;
      setWallet(w); setAccount(acct);
    } catch { /* the person closed the wallet */ }
  }

  async function sign(i: number) {
    const step = plan.steps[i];
    if (!wallet || !account || !step.solana) return;
    set(i, { kind: 'building' });
    try {
      const r = await fetch(`${API}${ROUTES[step.solana.tool]}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(step.solana.args), signal: AbortSignal.timeout(30_000) });
      const body = await r.json() as { transaction?: { data: string }; simulation?: { status: string; error?: unknown }; error?: { message?: string } };
      if (!r.ok || !body.transaction) { set(i, { kind: 'error', message: body.error?.message ?? 'BTB could not build this transaction.' }); return; }
      if (body.simulation?.status === 'reverted') {
        set(i, { kind: 'error', message: `The dry run on Solana failed (${JSON.stringify(body.simulation.error)}). Nothing was sent.` });
        return;
      }
      set(i, { kind: 'signing' });
      const [out] = await (wallet.features['solana:signAndSendTransaction'] as SignAndSend).signAndSendTransaction({ account, chain: 'solana:mainnet', transaction: fromB64(body.transaction.data) });
      const sig = base58(out.signature);
      set(i, { kind: 'sent', sig });
      if (plan.id) fetch(`${API}/api/v1/sign-status`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: plan.id, step: i + 1, hash: sig }) }).catch(() => {});
    } catch (e) {
      const msg = (e as Error)?.message ?? '';
      set(i, { kind: 'error', message: /reject|cancel|denied/i.test(msg) ? 'You declined in your wallet. Nothing was sent.' : `The wallet could not send it${msg ? `: ${msg}` : ''}.` });
    }
  }

  const wrong = !!account && account.address !== plan.wallet;
  if (expired) return null;
  return (
    <div className="ag-plan">
      {!account ? (
        <div className="ag-text">
          <p>Connect the Solana wallet {short(plan.wallet)} to sign.</p>
          {wallets.length === 0 ? (
            <div className="ag-plan-dry">No Solana wallet found in this browser. Install or open Phantom, Solflare or Backpack, then reload this page.</div>
          ) : (
            <div className="ag-actions">
              {wallets.map((w) => (
                <button key={w.name} type="button" className="ag-action" onClick={() => connect(w)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {w.icon && <img src={w.icon} alt="" width={16} height={16} style={{ borderRadius: 4 }}/>}{w.name}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : wrong ? (
        <div className="ag-error">Your connected wallet is {short(account.address)}, but this was built for {short(plan.wallet)}. Switch to that wallet in {wallet?.name} and connect again.</div>
      ) : (
        plan.steps.map((s, i) => {
          const st = status[i];
          return (
            <div key={i} className="ag-plan-step">
              <div className="ag-text"><p><strong>{i + 1}. {s.label}</strong></p></div>
              {st.kind === 'sent' ? (
                <div className="ag-text"><p>Sent. <a href={`https://solscan.io/tx/${st.sig}`} target="_blank" rel="noreferrer">View on Solscan</a></p></div>
              ) : (
                <div className="ag-actions">
                  <button type="button" className="ag-action primary" disabled={st.kind === 'building' || st.kind === 'signing' || (i > 0 && status[i - 1].kind !== 'sent')} onClick={() => sign(i)}>
                    {st.kind === 'building' ? 'Building and checking' : st.kind === 'signing' ? 'Confirm in your wallet' : `Sign with ${wallet?.name}`}<Icon name="arrow" size={13}/>
                  </button>
                </div>
              )}
              {st.kind === 'error' && <div className="ag-error">{st.message}</div>}
            </div>
          );
        })
      )}
      {status.every((s) => s.kind === 'sent') && <div className="ag-text"><p><strong>All done.</strong> Your assistant can see it now: just tell it you are done.</p></div>}
    </div>
  );
}
