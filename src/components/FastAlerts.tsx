'use client';
import { useEffect, useState } from 'react';
import { useScrollLock } from '../lib/useScrollLock';
import { useAccount, useConfig } from 'wagmi';
import { getPublicClient } from 'wagmi/actions';
import { useAction } from 'convex/react';
import { encodeFunctionData, erc20Abi, formatUnits, parseUnits } from 'viem';
import { api } from '../../convex/_generated/api';
import { btb } from './design-tokens';
import { useAlertCredit, FAST_CHECK_BTB } from '../lib/alerts';
import { readableError } from '../lib/errorText';
import { useTx } from '../lib/TxTracker';
import { useSidebar } from '../lib/SidebarContext';
import { Portal } from './Portal';
import { Icon } from './Icon';
import { runCalls } from '../lib/txRunner';
import { TOP_UP_ASSETS, TOP_UP_CHAINS, TOP_UP_CHAIN_NAMES, TOP_UP_MIN_USD, TOP_UP_TREASURY } from '../../convex/topUpConfig';

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
 * Top up by paying on the chain the wallet is already on: ETH or a stablecoin
 * straight to the BTB Safe, credited as BTB at the fixed app price to the
 * wallet that paid. One confirmation, no bridge, no swap.
 */
function PayTopUp() {
  const config = useConfig();
  const { address, chainId: walletChain } = useAccount();
  const { track } = useTx();
  const quote = useAction(api.topUpActions.quote);
  const creditPayment = useAction(api.topUpActions.creditPayment);
  const [chainId, setChainId] = useState<number>(TOP_UP_CHAINS.includes(walletChain as never) ? walletChain! : TOP_UP_CHAINS[0]);
  const [symbol, setSymbol] = useState(TOP_UP_ASSETS[chainId][0].symbol);
  const [amount, setAmount] = useState('');
  const [prices, setPrices] = useState<{ btbUsd: number; ethUsd: number | null } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ text: string; good: boolean } | null>(null);

  // The wallet's balance of every payable token on every chain, read straight from each chain.
  const [held, setHeld] = useState<Record<string, bigint>>({});
  const [suggested, setSuggested] = useState<string | null>(null);
  const keyOf = (c: number, sym: string) => `${c}:${sym}`;

  useEffect(() => { quote({}).then(setPrices).catch(() => {}); }, [quote]);
  useEffect(() => {
    if (!address) return;
    let live = true;
    (async () => {
      const out: Record<string, bigint> = {};
      await Promise.all(TOP_UP_CHAINS.flatMap((c) => TOP_UP_ASSETS[c].map(async (a) => {
        const client = getPublicClient(config, { chainId: c as never });
        if (!client) return;
        out[keyOf(c, a.symbol)] = await (a.address
          ? client.readContract({ address: a.address, abi: erc20Abi, functionName: 'balanceOf', args: [address] })
          : client.getBalance({ address })).catch(() => 0n);
      })));
      if (live) setHeld(out);
    })();
    return () => { live = false; };
  }, [address, config]);

  const usdOf = (a: (typeof TOP_UP_ASSETS)[number][number], units: number) =>
    a.btb ? units * (prices?.btbUsd ?? 0) : a.stable ? units : units * (prices?.ethUsd ?? 0);
  const heldUnits = (c: number, a: (typeof TOP_UP_ASSETS)[number][number]) => Number(formatUnits(held[keyOf(c, a.symbol)] ?? 0n, a.decimals));

  // Suggest how to pay, once balances and prices are in: the biggest holding on the chain the wallet is on
  // (no network switch), else the biggest holding anywhere. At least the minimum top-up, or nothing is suggested.
  useEffect(() => {
    if (suggested || !prices || Object.keys(held).length === 0) return;
    const options = TOP_UP_CHAINS.flatMap((c) => TOP_UP_ASSETS[c].map((a) => ({ c, a, usd: usdOf(a, heldUnits(c, a)) }))).filter((o) => o.usd >= TOP_UP_MIN_USD * 1.5);
    const pick = options.filter((o) => o.c === walletChain).sort((x, y) => y.usd - x.usd)[0] ?? options.sort((x, y) => y.usd - x.usd)[0];
    if (!pick) { setSuggested('none'); return; }
    setChainId(pick.c); setSymbol(pick.a.symbol); setSuggested(keyOf(pick.c, pick.a.symbol));
  }, [held, prices]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!TOP_UP_ASSETS[chainId].some((a) => a.symbol === symbol)) setSymbol(TOP_UP_ASSETS[chainId][0].symbol); }, [chainId, symbol]);

  const asset = TOP_UP_ASSETS[chainId].find((a) => a.symbol === symbol) ?? TOP_UP_ASSETS[chainId][0];
  const n = parseFloat(amount);
  const balance = heldUnits(chainId, asset);
  const tooMuch = n > 0 && Object.keys(held).length > 0 && n > balance;
  // Max leaves some ETH behind to pay for the transaction itself.
  const maxAmount = () => {
    const reserve = asset.address ? 0 : chainId === 1 ? 0.003 : 0.0003;
    const units = Math.max(0, balance - reserve);
    return units > 0 ? String(Number(units.toPrecision(6))) : '';
  };
  const fmtHeld = (units: number) => (units === 0 ? '0' : units < 0.0001 ? '<0.0001' : units >= 1000 ? fmtBtb(units) : String(Number(units.toPrecision(4))));
  // BTB is credited one for one; dollars and ETH at the fixed BTB price.
  const usd = !(n > 0) ? 0 : asset.btb ? n * (prices?.btbUsd ?? 0) : asset.stable ? n : n * (prices?.ethUsd ?? 0);
  const btbOut = !(n > 0) || !prices ? 0 : asset.btb ? Math.floor(n) : Math.floor(usd / prices.btbUsd);

  async function pay() {
    if (!address || !(n > 0)) return;
    setNote(null); setBusy('Confirm in your wallet');
    try {
      const raw = parseUnits(amount, asset.decimals);
      const call = asset.address
        ? { to: asset.address, data: encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [TOP_UP_TREASURY, raw] }) }
        : { to: TOP_UP_TREASURY as `0x${string}`, value: raw };
      const { lastHash } = await runCalls(config, { account: address, calls: [{ ...call, label: `Top up BTB with ${amount} ${asset.symbol}` }], label: `Top up BTB with ${amount} ${asset.symbol}`, track, chainId });
      if (!lastHash) throw new Error('The payment did not go through.');
      // The payment is confirmed; credit it, giving a slow RPC a few tries to see it.
      setBusy('Crediting');
      let res = await creditPayment({ chainId, txHash: lastHash });
      for (let i = 0; i < 5 && !res.ok && /not found/i.test(res.reason); i++) {
        await new Promise((r) => setTimeout(r, 3000));
        res = await creditPayment({ chainId, txHash: lastHash });
      }
      if (res.ok) { setAmount(''); setNote({ text: `${fmtBtb(res.btb)} BTB added to your balance.`, good: true }); }
      else setNote({ text: `Paid, but not credited yet: ${res.reason} Paste this transaction hash below to retry: ${lastHash}`, good: false });
    } catch (e) { setNote({ text: readableError(e, 'The payment did not go through.'), good: false }); }
    finally { setBusy(null); }
  }

  const chip = (active: boolean): React.CSSProperties => ({ ...smallBtn(active ? btb.green : btb.textMuted), background: active ? 'rgba(var(--green-rgb), 0.12)' : 'transparent' });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ color: btb.text, fontSize: 12.5, fontWeight: 800 }}>Top up</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {TOP_UP_CHAINS.map((c) => {
          const total = TOP_UP_ASSETS[c].reduce((sum, a) => sum + usdOf(a, heldUnits(c, a)), 0);
          return <button key={c} type="button" onClick={() => setChainId(c)} style={chip(c === chainId)}>{TOP_UP_CHAIN_NAMES[c]}{total >= 0.01 ? ` $${total.toFixed(2)}` : ''}</button>;
        })}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {TOP_UP_ASSETS[chainId].map((a) => (
          <button key={a.symbol} type="button" onClick={() => setSymbol(a.symbol)} style={chip(a.symbol === asset.symbol)}>
            {a.symbol} {fmtHeld(heldUnits(chainId, a))}{suggested === keyOf(chainId, a.symbol) ? ', suggested' : ''}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" placeholder={asset.stable ? '10' : '0.005'}
          style={{ flex: 1, minWidth: 90, height: 30, padding: '0 10px', borderRadius: 999, border: btb.borderSoft, background: btb.surfaceSoft, color: btb.text, fontSize: 12, fontFamily: 'inherit', outline: 'none' }}/>
        <button type="button" disabled={balance <= 0} onClick={() => setAmount(maxAmount())} style={smallBtn(btb.textMuted)}>Max</button>
        <button type="button" disabled={!!busy || !address || usd < TOP_UP_MIN_USD || tooMuch} onClick={pay} style={{ ...smallBtn(btb.green), height: 30 }}>{busy ?? 'Pay'}</button>
      </div>
      <div style={{ color: btb.textMuted, fontSize: 11.5, lineHeight: 1.5 }}>
        {tooMuch ? `You have ${fmtHeld(balance)} ${asset.symbol} on ${TOP_UP_CHAIN_NAMES[chainId]}. ` : ''}
        {btbOut > 0 ? `You get ${fmtBtb(btbOut)} BTB${asset.btb ? '' : ` (about $${usd.toFixed(2)} at $${prices!.btbUsd} per BTB)`}. ` : `At least $${TOP_UP_MIN_USD}. `}
        {walletChain && walletChain !== chainId ? `Your wallet switches to ${TOP_UP_CHAIN_NAMES[chainId]} to pay. ` : ''}
        One confirmation, no bridge and no swap. It goes to the BTB Safe and is credited to the wallet that pays.
      </div>
      {note && <div style={{ color: note.good ? btb.green : btb.amber, fontSize: 11.5, lineHeight: 1.5, wordBreak: 'break-word' }}>{note.text}</div>}
    </div>
  );
}

/**
 * Top up the BTB balance: pay with ETH or a stablecoin on any supported chain,
 * or send BTB to the treasury and paste the hash. Credited to the paying
 * wallet, once, within a day. Shared by alerts, auto-rebalance and the agent.
 */
export function BtbTopUp({ credit }: { credit: Credit }) {
  const creditPayment = useAction(api.topUpActions.creditPayment);
  const [txHash, setTxHash] = useState('');
  const [note, setNote] = useState<{ text: string; good: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  /** A BTB deposit on Ethereum, else an ETH or stablecoin payment on any supported chain. */
  async function creditAny(hash: string): Promise<string | null> {
    const problem = await credit.depositTx(hash);
    if (!problem) return null;
    for (const chainId of TOP_UP_CHAINS) {
      const res = await creditPayment({ chainId, txHash: hash }).catch(() => null);
      if (res?.ok) return null;
      if (res && !/not found/i.test(res.reason)) return res.reason;
    }
    return problem;
  }

  async function submit() {
    if (!txHash.trim()) return;
    setBusy(true); setNote(null);
    try {
      const problem = await creditAny(txHash.trim());
      if (!problem) setTxHash('');
      setNote(problem ? { text: problem, good: false } : { text: 'Credited to the wallet that paid.', good: true });
    } catch (e) { setNote({ text: readableError(e, 'Something went wrong; try again'), good: false }); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <PayTopUp/>
      <div style={{ color: btb.textDim, fontSize: 11, marginTop: 2 }}>Paid but not credited? Paste the transaction hash.</div>
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
 * The top-up window: opens in front of whatever the user is on, so topping up
 * never means scrolling to a form far below. Closes on the backdrop or the X.
 */
export function TopUpModal({ credit, onClose }: { credit: Credit; onClose: () => void }) {
  useScrollLock(true);
  const { width: sidebarWidth } = useSidebar();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <Portal>
      <div onClick={onClose} style={{ position: 'fixed', top: 0, left: sidebarWidth, right: 0, bottom: 0, zIndex: 400, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', overflowY: 'auto' }}>
        <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 420, background: 'rgba(var(--bg-rgb), 0.98)', border: '1px solid rgba(var(--fg-rgb), 0.1)', borderRadius: 24, padding: '18px 18px calc(20px + env(safe-area-inset-bottom, 0px))', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ color: btb.text, fontSize: 18, fontWeight: 800, letterSpacing: -0.3 }}>Top up BTB balance</div>
            <div onClick={onClose} style={{ cursor: 'pointer' }}><Icon name="close" size={16} color={btb.textMuted}/></div>
          </div>
          <div style={{ background: 'rgba(var(--fg-rgb), 0.04)', border: '1px solid rgba(var(--fg-rgb), 0.07)', borderRadius: 14, padding: '12px 14px' }}>
            <BtbBalanceLine credit={credit}/>
          </div>
          <BtbTopUp credit={credit}/>
          <div style={{ color: btb.textDim, fontSize: 11, lineHeight: 1.5 }}>Your BTB balance pays for auto-rebalance, fast alerts and agent messages.</div>
        </div>
      </div>
    </Portal>
  );
}

/** A "Top up" button that opens the top-up window. */
export function TopUpButton({ credit, label = 'Top up', style }: { credit: Credit; label?: string; style?: React.CSSProperties }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} style={{ height: 30, padding: '0 12px', borderRadius: 999, border: '1px solid rgba(var(--green-rgb), 0.4)', background: 'rgba(var(--green-rgb), 0.12)', color: btb.green, fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, ...style }}>{label}</button>
      {open && <TopUpModal credit={credit} onClose={() => setOpen(false)}/>}
    </>
  );
}

/**
 * Fast checks: the BTB balance, the on/off switch and the top-up button.
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
      <TopUpButton credit={credit} label="Top up BTB balance" style={{ alignSelf: 'flex-start' }}/>
    </div>
  );
}
