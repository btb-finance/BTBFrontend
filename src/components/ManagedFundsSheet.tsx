'use client';

import { useEffect, useMemo, useState } from 'react';
import { useConfig } from 'wagmi';
import { getPublicClient } from 'wagmi/actions';
import { encodeFunctionData, erc20Abi, formatUnits, isAddress, parseUnits } from 'viem';
import { Portal } from './Portal';
import { Button } from './Button';
import { btb } from './design-tokens';
import { useTx } from '../lib/TxTracker';
import { runCalls } from '../lib/txRunner';
import { approvalCall, BTB_LP_ACCOUNT_ABI, depositTokenCall } from '../lib/smartAccount';

function compact(raw: bigint, decimals: number) {
  const n = Number(formatUnits(raw, decimals));
  return n.toLocaleString('en-US', { maximumFractionDigits: 6 });
}

export function ManagedFundsSheet({ chainId, chainName, owner, account, onClose, onDone }: {
  chainId: 1 | 4663;
  chainName: string;
  owner: `0x${string}`;
  account: `0x${string}`;
  onClose: () => void;
  onDone: () => void | Promise<void>;
}) {
  const config = useConfig();
  const { track } = useTx();
  const [token, setToken] = useState('');
  const [mode, setMode] = useState<'deposit' | 'withdraw'>('deposit');
  const [amount, setAmount] = useState('');
  const [meta, setMeta] = useState<{ symbol: string; decimals: number; wallet: bigint; account: bigint } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validToken = isAddress(token.trim()) ? token.trim() as `0x${string}` : null;
  const parsed = useMemo(() => {
    try { return meta && amount && Number(amount) > 0 ? parseUnits(amount, meta.decimals) : 0n; }
    catch { return 0n; }
  }, [amount, meta]);

  useEffect(() => {
    let cancelled = false;
    setMeta(null); setError(null);
    if (!validToken) return;
    (async () => {
      const client = getPublicClient(config, { chainId });
      if (!client) throw new Error('RPC unavailable');
      const [symbol, decimals, wallet, held] = await Promise.all([
        client.readContract({ address: validToken, abi: erc20Abi, functionName: 'symbol' }),
        client.readContract({ address: validToken, abi: erc20Abi, functionName: 'decimals' }),
        client.readContract({ address: validToken, abi: erc20Abi, functionName: 'balanceOf', args: [owner] }),
        client.readContract({ address: validToken, abi: erc20Abi, functionName: 'balanceOf', args: [account] }),
      ]);
      if (!cancelled) setMeta({ symbol, decimals, wallet, account: held });
    })().catch(() => { if (!cancelled) setError('This is not a readable ERC-20 contract on the selected chain.'); });
    return () => { cancelled = true; };
  }, [account, chainId, config, owner, validToken]);

  async function deposit() {
    const available = mode === 'deposit' ? meta?.wallet ?? 0n : meta?.account ?? 0n;
    if (!validToken || !meta || parsed <= 0n || parsed > available) return;
    setBusy(true); setError(null);
    try {
      await runCalls(config, {
        account: owner, chainId, track, label: mode === 'deposit' ? `Deposit ${meta.symbol} into LP account` : `Withdraw ${meta.symbol} from LP account`,
        calls: mode === 'deposit'
          ? [approvalCall(validToken, account, parsed), depositTokenCall(account, validToken, parsed)].filter((call): call is NonNullable<typeof call> => call !== null)
          : [{ to: account, data: encodeFunctionData({ abi: BTB_LP_ACCOUNT_ABI, functionName: 'withdrawToken', args: [validToken, parsed] }) }],
      });
      await onDone(); onClose();
    } catch (e) { setError((e as { shortMessage?: string })?.shortMessage ?? (e as Error)?.message ?? 'Deposit failed'); }
    finally { setBusy(false); }
  }

  return <Portal>
    <div onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }} style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(5,5,10,.72)', backdropFilter: 'blur(10px)', display: 'grid', placeItems: 'center', padding: 14 }}>
      <div style={{ width: 'min(430px,100%)', borderRadius: 20, padding: 18, background: '#17171f', border: btb.border, boxShadow: '0 24px 80px rgba(0,0,0,.5)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <div><div style={{ color: btb.text, fontSize: 16, fontWeight: 850 }}>Add funds</div><div style={{ color: btb.textMuted, fontSize: 11, marginTop: 3 }}>{chainName} · {account.slice(0, 6)}…{account.slice(-4)}</div></div>
          <button onClick={onClose} style={{ border: 0, background: 'transparent', color: btb.textMuted, fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ marginTop: 15, padding: 12, borderRadius: 13, background: 'rgba(255,255,255,.035)', border: btb.borderSoft }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 11 }}>
            {(['deposit', 'withdraw'] as const).map(option => <button key={option} onClick={() => { setMode(option); setAmount(''); }} style={{ height: 33, borderRadius: 9, border: mode === option ? '1px solid rgba(82,227,164,.45)' : btb.borderSoft, background: mode === option ? 'rgba(82,227,164,.1)' : 'rgba(255,255,255,.025)', color: mode === option ? btb.green : btb.textMuted, fontFamily: 'inherit', fontSize: 10.5, fontWeight: 800, textTransform: 'capitalize', cursor: 'pointer' }}>{option}</button>)}
          </div>
          <div style={{ color: btb.textDim, fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .5 }}>Token contract</div>
          <input value={token} onChange={e => setToken(e.target.value)} placeholder="0x…" spellCheck={false} style={{ width: '100%', boxSizing: 'border-box', marginTop: 7, height: 38, borderRadius: 9, border: btb.borderSoft, background: 'rgba(255,255,255,.04)', color: btb.text, padding: '0 10px', fontFamily: 'monospace', outline: 'none' }}/>
          {meta && <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, gap: 8 }}><span style={{ color: btb.text, fontSize: 12, fontWeight: 800 }}>{meta.symbol}</span><span style={{ color: btb.textMuted, fontSize: 10 }}>Wallet {compact(meta.wallet, meta.decimals)} · Account {compact(meta.account, meta.decimals)}</span></div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input value={amount} onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" placeholder="Amount" style={{ flex: 1, minWidth: 0, height: 40, borderRadius: 9, border: btb.borderSoft, background: 'rgba(255,255,255,.04)', color: btb.text, padding: '0 10px', fontSize: 15, outline: 'none' }}/>
            <button onClick={() => meta && setAmount(formatUnits(mode === 'deposit' ? meta.wallet : meta.account, meta.decimals))} disabled={!meta} style={{ padding: '0 12px', borderRadius: 9, border: btb.borderSoft, background: 'rgba(82,227,164,.08)', color: btb.green, fontWeight: 800, cursor: 'pointer' }}>MAX</button>
          </div>
        </div>
        <div style={{ color: btb.textDim, fontSize: 10, lineHeight: 1.45, marginTop: 9 }}>Any ERC-20 can be stored. It is swapped only through a separately authorized LP instruction; unused funds remain withdrawable by you.</div>
        {error && <div style={{ color: btb.loss, fontSize: 11, lineHeight: 1.4, marginTop: 9 }}>{error}</div>}
        <Button variant="success" onClick={deposit} disabled={busy || !meta || parsed <= 0n || parsed > (mode === 'deposit' ? meta.wallet : meta.account)} style={{ width: '100%', marginTop: 13 }}>{busy ? mode === 'deposit' ? 'Depositing…' : 'Withdrawing…' : meta && parsed > (mode === 'deposit' ? meta.wallet : meta.account) ? `Insufficient ${meta.symbol}` : `${mode === 'deposit' ? 'Deposit' : 'Withdraw'}${meta ? ` ${meta.symbol}` : ''}`}</Button>
      </div>
    </div>
  </Portal>;
}
