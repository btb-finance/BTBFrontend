'use client';
import { useState } from 'react';
import { formatUnits } from 'viem';
import { btb } from './design-tokens';
import { useAlertCredit, FAST_CHECK_BTB } from '../lib/alerts';

export const fmtBtb = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: n < 10 ? 2 : 0 });
export const alertErrText = (e: unknown) => {
  const raw = (e as Error)?.message ?? 'Something went wrong';
  if (/rejected|denied/i.test(raw)) return 'Signature cancelled.';
  const m = raw.match(/Uncaught Error: ([^\n]+?)(?: at handler|$)/);
  return (m ? m[1] : raw.split('\n')[0]).trim();
};
const smallBtn = (tone: string): React.CSSProperties => ({ height: 26, padding: '0 10px', borderRadius: 999, border: btb.borderSoft, background: 'transparent', color: tone, fontSize: 11.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' });

/**
 * Fast checks: the alert balance, the on/off switch, weekly rewards to spend,
 * and the pasted-deposit form. Shown in the bell and on the portfolio.
 * `active` gates the treasury read so a closed panel costs nothing.
 */
export function FastAlertsPanel({ address, watched, active = true }: { address: string; watched: number; active?: boolean }) {
  const credit = useAlertCredit(address, { withTreasury: active });
  const [txHash, setTxHash] = useState('');
  const [note, setNote] = useState<{ text: string; good: boolean } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // Twelve ticks an hour, one read per position per tick.
  const perHour = watched * 12 * FAST_CHECK_BTB;

  async function run(key: string, fn: () => Promise<string | null>, success: string) {
    setBusy(key); setNote(null);
    try {
      const problem = await fn();
      setNote(problem ? { text: problem, good: false } : { text: success, good: true });
    } catch (e) { setNote({ text: alertErrText(e), good: false }); }
    finally { setBusy(null); }
  }

  return (
      <div style={{ padding: '2px 10px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div>
            <div style={{ color: btb.text, fontSize: 18, fontWeight: 800 }}>{fmtBtb(credit.balance)} BTB</div>
            <div style={{ color: btb.textDim, fontSize: 11 }}>Alert balance</div>
          </div>
          <button type="button" disabled={busy === 'fast'} onClick={() => run('fast', () => credit.setFast(!credit.fast), credit.fast ? 'Fast checks off. Back to hourly.' : 'Fast checks on.')}
            style={{ ...smallBtn(credit.fast ? btb.green : btb.text), height: 30, background: credit.fast ? 'rgba(var(--green-rgb), 0.12)' : 'transparent' }}>
            {busy === 'fast' ? (credit.fast ? 'Turning off' : 'Sign in wallet') : credit.fast ? 'Fast on' : 'Turn on fast'}
          </button>
        </div>
        <div style={{ color: btb.textMuted, fontSize: 11.5, lineHeight: 1.5 }}>
          Free alerts are checked once an hour. Fast checks run every 5 minutes for {FAST_CHECK_BTB} BTB per position per check{watched > 0 ? `, about ${fmtBtb(perHour)} BTB an hour for your ${watched}` : ''}. With no balance left, alerts drop back to hourly.
          {credit.fast && credit.balance < FAST_CHECK_BTB && <span style={{ color: btb.amber }}> Your balance is empty, so checks are hourly right now.</span>}
        </div>

        {credit.claimable.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {credit.claimable.map(c => {
              const amt = Number(formatUnits(BigInt(c.amountRaw), 18));
              return (
                <div key={c.payoutId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 10px', borderRadius: 10, background: 'rgba(var(--green-rgb), 0.07)' }}>
                  <span style={{ color: btb.text, fontSize: 12 }}>Weekly reward, {fmtBtb(amt)} BTB</span>
                  <button type="button" disabled={busy === c.payoutId} onClick={() => run(c.payoutId, () => credit.spendReward(c.payoutId), `${fmtBtb(amt)} BTB moved into your alert balance.`)} style={smallBtn(btb.green)}>
                    {busy === c.payoutId ? 'Sign in wallet' : 'Use for alerts'}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ color: btb.textMuted, fontSize: 11.5, lineHeight: 1.5 }}>
          Or top up: send BTB on Ethereum from this wallet to the treasury, then paste the transaction hash. It is credited to the wallet that sent it, once, and only within a day of sending.
        </div>
        {credit.treasury && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <code style={{ flex: 1, minWidth: 0, color: btb.text, fontSize: 10.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '6px 8px', borderRadius: 8, background: btb.surfaceSoft }}>{credit.treasury}</code>
            <button type="button" onClick={() => { navigator.clipboard?.writeText(credit.treasury!).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {}); }} style={smallBtn(btb.text)}>{copied ? 'Copied' : 'Copy'}</button>
          </div>
        )}
        <form onSubmit={(e) => { e.preventDefault(); if (txHash.trim()) run('tx', async () => { const p = await credit.depositTx(txHash); if (!p) setTxHash(''); return p; }, 'Deposit credited to the sending wallet.'); }} style={{ display: 'flex', gap: 6 }}>
          <input value={txHash} onChange={(e) => setTxHash(e.target.value)} placeholder="0x transaction hash" spellCheck={false}
            style={{ flex: 1, minWidth: 0, height: 30, padding: '0 10px', borderRadius: 999, border: btb.borderSoft, background: btb.surfaceSoft, color: btb.text, fontSize: 11.5, fontFamily: 'inherit', outline: 'none' }}/>
          <button type="submit" disabled={busy === 'tx' || !txHash.trim()} style={{ ...smallBtn(btb.green), height: 30 }}>{busy === 'tx' ? 'Checking' : 'Credit'}</button>
        </form>
        {note && <div style={{ color: note.good ? btb.green : btb.amber, fontSize: 11.5, lineHeight: 1.5 }}>{note.text}</div>}
      </div>
  );
}
