'use client';
import { useState } from 'react';
import { btb } from './design-tokens';
import { useAlertCredit, FAST_CHECK_BTB } from '../lib/alerts';
import { readableError } from '../lib/errorText';

export const fmtBtb = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: n < 10 ? 2 : 0 });
const smallBtn = (tone: string): React.CSSProperties => ({ height: 26, padding: '0 10px', borderRadius: 999, border: btb.borderSoft, background: 'transparent', color: tone, fontSize: 11.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' });

type Credit = ReturnType<typeof useAlertCredit>;

/** "12 BTB" plus, when there are any, the unclaimed weekly rewards that back it up. */
export function BtbBalanceLine({ credit, label = 'BTB balance' }: { credit: Credit; label?: string }) {
  return (
    <div>
      <div style={{ color: btb.text, fontSize: 18, fontWeight: 800 }}>{fmtBtb(credit.total)} BTB</div>
      <div style={{ color: btb.textDim, fontSize: 11 }}>
        {credit.rewards > 0 ? `${label}: ${fmtBtb(credit.balance)} plus ${fmtBtb(credit.rewards)} in weekly rewards, used automatically` : label}
      </div>
    </div>
  );
}

/**
 * Top up the BTB balance: send BTB to the treasury, paste the hash. Credited
 * to the sending wallet, once, within a day. Shared by alerts and the agent.
 */
export function BtbTopUp({ credit }: { credit: Credit }) {
  const [txHash, setTxHash] = useState('');
  const [note, setNote] = useState<{ text: string; good: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function submit() {
    if (!txHash.trim()) return;
    setBusy(true); setNote(null);
    try {
      const problem = await credit.depositTx(txHash);
      if (!problem) setTxHash('');
      setNote(problem ? { text: problem, good: false } : { text: 'Deposit credited to the sending wallet.', good: true });
    } catch (e) { setNote({ text: readableError(e, 'Something went wrong; try again'), good: false }); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ color: btb.textMuted, fontSize: 11.5, lineHeight: 1.5 }}>
        Top up: send BTB on Ethereum from this wallet to the treasury, then paste the transaction hash. It is credited to the wallet that sent it, once, and only within a day of sending.
      </div>
      {credit.treasury && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <code style={{ flex: 1, minWidth: 0, color: btb.text, fontSize: 10.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '6px 8px', borderRadius: 8, background: btb.surfaceSoft }}>{credit.treasury}</code>
          <button type="button" onClick={() => { navigator.clipboard?.writeText(credit.treasury!).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {}); }} style={smallBtn(btb.text)}>{copied ? 'Copied' : 'Copy'}</button>
        </div>
      )}
      <form onSubmit={(e) => { e.preventDefault(); submit(); }} style={{ display: 'flex', gap: 6 }}>
        <input value={txHash} onChange={(e) => setTxHash(e.target.value)} placeholder="0x transaction hash" spellCheck={false}
          style={{ flex: 1, minWidth: 0, height: 30, padding: '0 10px', borderRadius: 999, border: btb.borderSoft, background: btb.surfaceSoft, color: btb.text, fontSize: 11.5, fontFamily: 'inherit', outline: 'none' }}/>
        <button type="submit" disabled={busy || !txHash.trim()} style={{ ...smallBtn(btb.green), height: 30 }}>{busy ? 'Checking' : 'Credit'}</button>
      </form>
      {note && <div style={{ color: note.good ? btb.green : btb.amber, fontSize: 11.5, lineHeight: 1.5 }}>{note.text}</div>}
    </div>
  );
}

/**
 * Fast checks: the BTB balance, the on/off switch and the top-up form.
 * Shown in the bell and on the portfolio. `active` gates the treasury read so
 * a closed panel costs nothing.
 */
export function FastAlertsPanel({ address, watched, active = true }: { address: string; watched: number; active?: boolean }) {
  const credit = useAlertCredit(address, { withTreasury: active });
  const [note, setNote] = useState<{ text: string; good: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  // Twelve ticks an hour, one read per position per tick.
  const perHour = watched * 12 * FAST_CHECK_BTB;

  async function toggle() {
    setBusy(true); setNote(null);
    try {
      const problem = await credit.setFast(!credit.fast);
      setNote(problem ? { text: problem, good: false } : { text: credit.fast ? 'Fast checks off. Back to hourly.' : 'Fast checks on.', good: true });
    } catch (e) { setNote({ text: readableError(e, 'Something went wrong; try again'), good: false }); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ padding: '2px 10px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <BtbBalanceLine credit={credit}/>
        <button type="button" disabled={busy} onClick={toggle}
          style={{ ...smallBtn(credit.fast ? btb.green : btb.text), height: 30, background: credit.fast ? 'rgba(var(--green-rgb), 0.12)' : 'transparent' }}>
          {busy ? (credit.fast ? 'Turning off' : 'Sign in wallet') : credit.fast ? 'Fast on' : 'Turn on fast'}
        </button>
      </div>
      <div style={{ color: btb.textMuted, fontSize: 11.5, lineHeight: 1.5 }}>
        Free alerts are checked once an hour. Fast checks run every 5 minutes for {FAST_CHECK_BTB} BTB per position per check{watched > 0 ? `, about ${fmtBtb(perHour)} BTB an hour for your ${watched}` : ''}, taken from your BTB balance and then your unclaimed weekly rewards. With nothing left, alerts drop back to hourly.
        {credit.fast && credit.total < FAST_CHECK_BTB && <span style={{ color: btb.amber }}> Nothing left to pay with, so checks are hourly right now.</span>}
      </div>
      {note && <div style={{ color: note.good ? btb.green : btb.amber, fontSize: 11.5, lineHeight: 1.5 }}>{note.text}</div>}
      <BtbTopUp credit={credit}/>
    </div>
  );
}
