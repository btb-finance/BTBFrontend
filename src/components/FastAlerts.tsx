'use client';
import { useEffect, useRef, useState } from 'react';
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
import { TokenIcon } from './TokenIcon';
import { useTokenLogos } from '../lib/TokenStore';
import { ChainLogo } from './ChainLogo';
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
function PayTopUp({ onBusy, onSuccess }: { onBusy?: (busy: boolean) => void; onSuccess?: (btb: number) => void }) {
  const config = useConfig();
  const { address, chainId: walletChain } = useAccount();
  const { track } = useTx();
  const quote = useAction(api.topUpActions.quote);
  const creditPayment = useAction(api.topUpActions.creditPayment);
  const logoFor = useTokenLogos();
  const [chainId, setChainId] = useState<number>(TOP_UP_CHAINS.includes(walletChain as never) ? walletChain! : TOP_UP_CHAINS[0]);
  const [symbol, setSymbol] = useState(TOP_UP_ASSETS[chainId][0].symbol);
  const [amount, setAmount] = useState('');
  const [prices, setPrices] = useState<{ btbUsd: number; ethUsd: number | null } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => { onBusy?.(!!busy); }, [busy, onBusy]);
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
    })().catch(() => { /* a failed read leaves what is shown as it was */ });
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
    // A one time default picked when balances first arrive; the user can change it after, so it is state, not derived.
    // eslint-disable-next-line react/set-state-in-effect
    if (!pick) { setSuggested('none'); return; }
    setChainId(pick.c); setSymbol(pick.a.symbol); setSuggested(keyOf(pick.c, pick.a.symbol));
  }, [held, prices]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!TOP_UP_ASSETS[chainId].some((a) => a.symbol === symbol)) setSymbol(TOP_UP_ASSETS[chainId][0].symbol);

  const asset = TOP_UP_ASSETS[chainId].find((a) => a.symbol === symbol) ?? TOP_UP_ASSETS[chainId][0];
  const n = parseFloat(amount);
  const balance = heldUnits(chainId, asset);
  // Compared in the token's own units, so a Max amount equal to the balance is never refused by float rounding.
  const rawAmount = (() => { try { return n > 0 ? parseUnits(amount, asset.decimals) : 0n; } catch { return 0n; } })();
  const tooMuch = rawAmount > 0n && Object.keys(held).length > 0 && rawAmount > (held[keyOf(chainId, asset.symbol)] ?? 0n);
  // Max leaves some ETH behind to pay for the transaction itself. Worked out on the exact on-chain amount: rounding a
  // float could land a hair above the balance (1.329418 shown as 1.32942), which marked it too much and disabled Pay.
  const maxAmount = () => {
    const raw = held[keyOf(chainId, asset.symbol)] ?? 0n;
    const reserve = asset.address ? 0n : parseUnits(chainId === 1 ? '0.003' : '0.0003', asset.decimals);
    return raw > reserve ? formatUnits(raw - reserve, asset.decimals) : '';
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
      setBusy('Adding BTB');
      let res = await creditPayment({ chainId, txHash: lastHash });
      for (let i = 0; i < 5 && !res.ok && /not found/i.test(res.reason); i++) {
        await new Promise((r) => setTimeout(r, 3000));
        res = await creditPayment({ chainId, txHash: lastHash });
      }
      if (res.ok) { setAmount(''); if (onSuccess) onSuccess(res.btb); else setNote({ text: `${fmtBtb(res.btb)} BTB added to your balance.`, good: true }); }
      else setNote({ text: `Paid, but not credited yet: ${res.reason} Paste this transaction hash below to retry: ${lastHash}`, good: false });
    } catch (e) { setNote({ text: readableError(e, 'The payment did not go through.'), good: false }); }
    finally { setBusy(null); }
  }

  // A preset in dollars, turned into the selected token's units at the quoted price.
  const setUsd = (d: number) => {
    if (asset.stable) { setAmount(String(d)); return; }
    if (!prices) return;
    if (asset.btb) { setAmount(String(Math.ceil(d / prices.btbUsd))); return; }
    if (prices.ethUsd) setAmount(String(Number((d / prices.ethUsd).toPrecision(4))));
  };
  const heldUsd = usdOf(asset, balance);
  const known = Object.keys(held).length > 0;
  const switching = !!walletChain && walletChain !== chainId;
  const cta = busy
    ?? (!address ? 'Connect a wallet to pay'
      : tooMuch ? `Not enough ${asset.symbol} on ${TOP_UP_CHAIN_NAMES[chainId]}`
      : !(n > 0) ? 'Enter an amount'
      : usd < TOP_UP_MIN_USD ? `At least $${TOP_UP_MIN_USD}`
      : `Pay ${amount} ${asset.symbol}`);
  const disabled = !!busy || !address || !(n > 0) || usd < TOP_UP_MIN_USD || tooMuch;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <SectionLabel>Pay on</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${TOP_UP_CHAINS.length}, minmax(0, 1fr))`, gap: 8 }}>
          {TOP_UP_CHAINS.map((c) => {
            const total = TOP_UP_ASSETS[c].reduce((sum, a) => sum + usdOf(a, heldUnits(c, a)), 0);
            const on = c === chainId;
            return (
              <button key={c} type="button" onClick={() => setChainId(c)} style={{ ...tile(on), padding: '12px 6px', minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <ChainLogo chainId={c} size={26}/>
                <span style={{ color: btb.text, fontSize: 12.5, fontWeight: 800 }}>{TOP_UP_CHAIN_NAMES[c].replace(' Chain', '')}</span>
                <span style={{ color: total >= 0.01 ? btb.textMuted : btb.textDim, fontSize: 11, fontWeight: 700, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{known ? `$${total.toFixed(2)}` : ' '}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <SectionLabel>With</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {TOP_UP_ASSETS[chainId].map((a) => {
            const on = a.symbol === asset.symbol;
            const units = heldUnits(chainId, a);
            const v = usdOf(a, units);
            return (
              <button key={a.symbol} type="button" onClick={() => setSymbol(a.symbol)} style={{ ...tile(on), padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left' }}>
                <TokenIcon symbol={a.symbol} size={32} logoUrl={logoFor(a.address ?? 'ETH', chainId, a.symbol) ?? (a.address ? undefined : logoFor('ETH', 1, 'ETH'))}/>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: btb.text, fontSize: 14, fontWeight: 800 }}>
                    {a.symbol}
                    {suggested === keyOf(chainId, a.symbol) && <span style={{ padding: '2px 7px', borderRadius: 999, background: 'rgba(var(--green-rgb), 0.14)', color: btb.green, fontSize: 10, fontWeight: 800, letterSpacing: 0.2 }}>Suggested</span>}
                  </span>
                  <span style={{ display: 'block', color: btb.textDim, fontSize: 11.5, marginTop: 2 }}>{known ? `${fmtHeld(units)} ${a.symbol}` : address ? 'Reading balance' : a.stable ? 'Dollars' : a.btb ? 'BTB token' : 'Ether'}</span>
                </span>
                <span style={{ color: v >= 0.01 ? btb.text : btb.textDim, fontSize: 13, fontWeight: 700 }}>{known && prices ? `$${v.toFixed(2)}` : ''}</span>
                <span style={{ width: 18, height: 18, borderRadius: 999, flexShrink: 0, border: on ? 'none' : '1.5px solid rgba(var(--fg-rgb), 0.2)', background: on ? btb.green : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {on && <Icon name="check" size={11} color="#04140c"/>}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ borderRadius: 18, background: btb.surfaceSoft, border: tooMuch ? '1px solid color-mix(in srgb, var(--btb-amber, #FFB36B) 50%, transparent)' : btb.borderSoft, padding: '12px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <span style={{ color: btb.textMuted, fontSize: 12, fontWeight: 700 }}>Amount</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: btb.textDim, fontSize: 11.5 }}>
            {known ? `Balance ${fmtHeld(balance)}` : ''}
            <button type="button" disabled={balance <= 0} onClick={() => setAmount(maxAmount())} style={{ ...smallBtn(btb.green), height: 22, padding: '0 8px', fontSize: 10.5, background: 'rgba(var(--green-rgb), 0.1)', border: 'none', opacity: balance <= 0 ? 0.4 : 1 }}>Max</button>
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '6px 0 10px' }}>
          <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" placeholder="0" aria-label={`Amount in ${asset.symbol}`}
            style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', color: btb.text, fontSize: 32, fontWeight: 800, letterSpacing: -0.8, fontFamily: 'inherit', padding: 0 }}/>
          <span style={{ color: btb.textMuted, fontSize: 16, fontWeight: 800 }}>{asset.symbol}</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[5, 10, 25, 50].map((d) => (
            <button key={d} type="button" onClick={() => setUsd(d)} disabled={!asset.stable && !prices}
              style={{ flex: 1, height: 30, borderRadius: 10, border: btb.borderSoft, background: known && heldUsd < d ? 'transparent' : btb.surface, color: known && heldUsd < d ? btb.textDim : btb.text, fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>${d}</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 18, background: 'linear-gradient(135deg, rgba(var(--green-rgb), 0.12), rgba(var(--green-rgb), 0.03))', border: '1px solid rgba(var(--green-rgb), 0.22)' }}>
        <TokenIcon symbol="BTB" size={34}/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: btb.textMuted, fontSize: 11.5, fontWeight: 700 }}>You get</div>
          <div style={{ color: btbOut > 0 ? btb.text : btb.textDim, fontSize: 20, fontWeight: 800, letterSpacing: -0.4 }}>{fmtBtb(btbOut)} BTB</div>
        </div>
        <div style={{ textAlign: 'right', color: btb.textDim, fontSize: 11, lineHeight: 1.5 }}>
          {usd > 0 && !asset.btb && <div style={{ color: btb.textMuted, fontWeight: 700 }}>${usd.toFixed(2)}</div>}
          {prices && <div>${prices.btbUsd} per BTB</div>}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button type="button" disabled={disabled} onClick={pay}
          style={{ height: 52, borderRadius: 16, border: 'none', background: busy ? 'rgba(var(--green-rgb), 0.16)' : disabled ? btb.surfaceStrong : btb.gradGreen, color: busy ? btb.green : disabled ? btb.textMuted : '#fff', fontSize: 15, fontWeight: 800, cursor: disabled ? 'default' : 'pointer', fontFamily: 'inherit', boxShadow: disabled ? 'none' : '0 8px 24px rgba(var(--green-rgb), 0.25)', transition: 'background .15s, box-shadow .15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          {busy && <span aria-hidden="true" style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(var(--green-rgb), 0.3)', borderTopColor: 'var(--btb-green, #52E3A4)', animation: 'spin 0.8s linear infinite', flexShrink: 0 }}/>}
          {cta}
        </button>
        {busy && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {['Confirm in wallet', 'Add BTB'].map((label, i) => {
              const step = busy === 'Adding BTB' ? 1 : 0;
              const done = i < step, now = i === step;
              return (
                <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, color: done ? btb.green : now ? btb.text : btb.textDim, fontSize: 11.5, fontWeight: 700 }}>
                  {i > 0 && <span style={{ width: 18, height: 1.5, borderRadius: 1, background: done || now ? 'rgba(var(--green-rgb), 0.5)' : 'rgba(var(--fg-rgb), 0.15)', marginRight: 2 }}/>}
                  <span style={{ width: 18, height: 18, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, background: done ? btb.green : now ? 'rgba(var(--green-rgb), 0.16)' : 'rgba(var(--fg-rgb), 0.08)', color: done ? '#04140c' : now ? btb.green : btb.textDim }}>
                    {done ? <Icon name="check" size={10} color="#04140c"/> : i + 1}
                  </span>
                  {label}
                </span>
              );
            })}
          </div>
        )}
        {busy && <div style={{ color: btb.textDim, fontSize: 11.5, textAlign: 'center' }}>Keep this window open until your BTB is added</div>}
        {switching && !busy && <div style={{ color: btb.textDim, fontSize: 11.5, textAlign: 'center' }}>Your wallet switches to {TOP_UP_CHAIN_NAMES[chainId]} to pay</div>}
      </div>
      {note && <Note {...note}/>}
    </div>
  );
}

const tile = (on: boolean): React.CSSProperties => ({
  borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit', width: '100%',
  background: on ? 'rgba(var(--green-rgb), 0.08)' : btb.surfaceSoft,
  border: on ? '1px solid rgba(var(--green-rgb), 0.55)' : btb.borderSoft,
  boxShadow: on ? '0 0 0 3px rgba(var(--green-rgb), 0.08)' : 'none',
  transition: 'background .15s, border-color .15s, box-shadow .15s',
});

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ color: btb.textMuted, fontSize: 12, fontWeight: 700, marginBottom: 8 }}>{children}</div>;
}

function Note({ text, good }: { text: string; good: boolean }) {
  return (
    <div style={{ padding: '10px 12px', borderRadius: 12, fontSize: 12, lineHeight: 1.5, wordBreak: 'break-word',
      color: good ? btb.green : btb.amber,
      background: good ? 'rgba(var(--green-rgb), 0.08)' : 'color-mix(in srgb, var(--btb-amber, #FFB36B) 10%, transparent)' }}>{text}</div>
  );
}

/**
 * Top up the BTB balance: pay with ETH or a stablecoin on any supported chain,
 * or send BTB to the treasury and paste the hash. Credited to the paying
 * wallet, once, within a day. Shared by alerts, auto-rebalance and the agent.
 */
export function BtbTopUp({ credit, onBusy, onSuccess }: { credit: Credit; onBusy?: (busy: boolean) => void; onSuccess?: (btb: number) => void }) {
  const creditPayment = useAction(api.topUpActions.creditPayment);
  const [txHash, setTxHash] = useState('');
  const [note, setNote] = useState<{ text: string; good: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [recover, setRecover] = useState(false);

  /** A BTB deposit on Ethereum, else an ETH or stablecoin payment on any supported chain. */
  async function creditAny(hash: string): Promise<string | null> {
    const problem = await credit.depositTx(hash);
    if (!problem) return null;
    // A BTB deposit's problem only matters when the hash is not a payment on any chain: a payment on Base that a node
    // had not seen yet used to come back as "not found on Ethereum", which pointed at the wrong chain.
    let found = /not found/i.test(problem) ? null : problem;
    for (const chainId of TOP_UP_CHAINS) {
      const res = await creditPayment({ chainId, txHash: hash }).catch(() => null);
      if (res?.ok) return null;
      if (res && !/not found/i.test(res.reason)) found = res.reason;
    }
    return found ?? `Not found on ${TOP_UP_CHAINS.map((c) => TOP_UP_CHAIN_NAMES[c]).join(', ')} yet. If it just confirmed, wait a few seconds and press Credit again.`;
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <PayTopUp onBusy={onBusy} onSuccess={onSuccess}/>
      {!recover ? (
        <button type="button" onClick={() => setRecover(true)} style={{ alignSelf: 'center', background: 'none', border: 'none', color: btb.textDim, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline', textUnderlineOffset: 3 }}>Paid but not credited?</button>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, borderRadius: 14, background: btb.surfaceSoft, border: btb.borderSoft }}>
          <div style={{ color: btb.textMuted, fontSize: 12, fontWeight: 700 }}>Paste the transaction hash</div>
          <form onSubmit={(e) => { e.preventDefault(); void submit(); }} style={{ display: 'flex', gap: 6 }}>
            <input value={txHash} onChange={(e) => setTxHash(e.target.value)} placeholder="0x..." spellCheck={false}
              style={{ flex: 1, minWidth: 0, height: 36, padding: '0 12px', borderRadius: 10, border: btb.borderSoft, background: btb.surface, color: btb.text, fontSize: 12, fontFamily: 'inherit', outline: 'none' }}/>
            <button type="submit" disabled={busy || !txHash.trim()} style={{ height: 36, padding: '0 14px', borderRadius: 10, border: 'none', background: 'rgba(var(--green-rgb), 0.14)', color: btb.green, fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>{busy ? 'Checking' : 'Credit'}</button>
          </form>
          {note && <Note {...note}/>}
        </div>
      )}
    </div>
  );
}

/** Eases a number from what was shown to `target` whenever it changes, so a new balance visibly counts up. */
function useCountUp(target: number, ms = 900) {
  const [shown, setShown] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const start = from.current;
    if (start === target) return;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / ms);
      const v = start + (target - start) * (1 - Math.pow(1 - k, 3));
      from.current = v;
      setShown(v);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return shown;
}

const PERKS = [
  { icon: 'bolt', title: 'One tap', sub: 'A single confirmation', bg: 'rgba(var(--green-rgb), 0.16)', fg: 'var(--btb-green, #52E3A4)' },
  { icon: 'bridge', title: 'No bridge', sub: 'Pay on the chain you are on', bg: 'color-mix(in srgb, var(--btb-reward, #C4B5FD) 18%, transparent)', fg: 'var(--btb-reward, #C4B5FD)' },
  { icon: 'shield', title: 'BTB Safe', sub: 'Credited to the wallet that pays', bg: 'color-mix(in srgb, var(--btb-amber, #FFB36B) 18%, transparent)', fg: 'var(--btb-amber, #FFB36B)' },
] as const;

/**
 * The top-up window: opens in front of whatever the user is on, so topping up
 * never means scrolling to a form far below. Closes on the backdrop or the X.
 */
export function TopUpModal({ credit, onClose }: { credit: Credit; onClose: () => void }) {
  useScrollLock(true);
  const { width: sidebarWidth } = useSidebar();
  // While a payment is between the wallet and the credit, closing would drop the in-app credit step, so the window stays.
  const [paying, setPaying] = useState(false);
  const [added, setAdded] = useState<number | null>(null);
  const close = () => { if (!paying) onClose(); };
  const shown = useCountUp(credit.total);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !paying) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, paying]);
  return (
    <Portal>
      <div data-overlay onClick={close} style={{ position: 'fixed', top: 0, left: sidebarWidth, right: 0, bottom: 0, zIndex: 400, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'max(12px, env(safe-area-inset-top, 0px)) 12px max(12px, env(safe-area-inset-bottom, 0px))', overflow: 'hidden' }}>
        <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 460, background: 'rgba(var(--bg-rgb), 0.98)', border: '1px solid rgba(var(--fg-rgb), 0.1)', maxHeight: '100%', overflowY: 'auto', overflowX: 'hidden', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch', borderRadius: 28, padding: 20, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', alignContent: 'start', gap: 18, boxSizing: 'border-box', boxShadow: '0 24px 80px rgba(0,0,0,0.5)' }}>
          <div style={{ position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', borderRadius: 20, background: 'radial-gradient(120% 140% at 0% 0%, rgba(var(--green-rgb), 0.18), transparent 60%), rgba(var(--fg-rgb), 0.04)', border: '1px solid rgba(var(--fg-rgb), 0.08)' }}>
            <button type="button" onClick={close} disabled={paying} aria-label="Close" style={{ position: 'absolute', top: 10, right: 10, width: 32, height: 32, borderRadius: 999, border: 'none', background: 'rgba(var(--fg-rgb), 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: paying ? 'default' : 'pointer', opacity: paying ? 0.35 : 1 }}>
              <Icon name="close" size={13} color={btb.textMuted}/>
            </button>
            <TokenIcon symbol="BTB" size={44}/>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: btb.textMuted, fontSize: 12, fontWeight: 700 }}>Your BTB balance</div>
              <div style={{ color: btb.text, fontSize: 28, fontWeight: 800, letterSpacing: -0.8, lineHeight: 1.15 }}>{fmtBtb(shown)} <span style={{ fontSize: 15, color: btb.textMuted }}>BTB</span></div>
              {credit.rewards > 0 && <div style={{ color: btb.textDim, fontSize: 11.5, marginTop: 2 }}>Includes {fmtBtb(credit.rewards)} in weekly rewards, used automatically</div>}
            </div>
          </div>

          {added !== null ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 10, padding: '18px 8px 4px' }}>
              <span style={{ width: 64, height: 64, borderRadius: 999, background: 'rgba(var(--green-rgb), 0.14)', boxShadow: '0 0 0 8px rgba(var(--green-rgb), 0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ width: 40, height: 40, borderRadius: 999, background: btb.green, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="check" size={20} color="#04140c"/></span>
              </span>
              <div style={{ color: btb.green, fontSize: 30, fontWeight: 800, letterSpacing: -0.8, marginTop: 6 }}>+{fmtBtb(added)} BTB</div>
              <div style={{ color: btb.textMuted, fontSize: 13 }}>Added to your balance</div>
              <button type="button" onClick={onClose} style={{ width: '100%', height: 52, marginTop: 10, borderRadius: 16, border: 'none', background: btb.gradGreen, color: '#fff', fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 8px 24px rgba(var(--green-rgb), 0.25)' }}>Done</button>
              <button type="button" onClick={() => setAdded(null)} style={{ background: 'none', border: 'none', color: btb.textDim, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline', textUnderlineOffset: 3 }}>Top up again</button>
            </div>
          ) : (
            <>
            <BtbTopUp credit={credit} onBusy={setPaying} onSuccess={(n) => { setPaying(false); setAdded(n); }}/>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
              {PERKS.map((p) => (
                <div key={p.title} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, borderRadius: 14, background: btb.surfaceSoft, border: btb.borderSoft }}>
                  <span style={{ width: 30, height: 30, borderRadius: 9, background: p.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={p.icon} size={15} color={p.fg}/></span>
                  <span>
                    <span style={{ display: 'block', color: btb.text, fontSize: 12, fontWeight: 800 }}>{p.title}</span>
                    <span style={{ display: 'block', color: btb.textDim, fontSize: 11, lineHeight: 1.4, marginTop: 2 }}>{p.sub}</span>
                  </span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', borderRadius: 12, background: 'rgba(var(--fg-rgb), 0.04)' }}>
              <span style={{ marginTop: 1, flexShrink: 0 }}><Icon name="lock" size={14} color={btb.textMuted}/></span>
              <span style={{ color: btb.textMuted, fontSize: 11.5, lineHeight: 1.5 }}>This is an in-app credit balance. It can't be withdrawn later and is only used in the app, for auto-rebalance, fast alerts and agent messages.</span>
            </div>
            </>
          )}
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
        Every alert check costs {FAST_CHECK_BTB} BTB per position, taken from your BTB balance and then your unclaimed weekly rewards. Alerts are checked once an hour; fast checks run every 5 minutes{watched > 0 ? `, about ${fmtBtb(perHour)} BTB an hour for your ${watched}` : ''}. With nothing left to pay with, alerts pause until you top up.
        {watched > 0 && credit.total < FAST_CHECK_BTB && <span style={{ color: btb.amber }}> Nothing left to pay with, so your alerts are paused right now.</span>}
      </div>
      {note && <div style={{ color: note.good ? btb.green : btb.amber, fontSize: 11.5, lineHeight: 1.5 }}>{note.text}</div>}
      <TopUpButton credit={credit} label="Top up BTB balance" style={{ alignSelf: 'flex-start' }}/>
    </div>
  );
}
