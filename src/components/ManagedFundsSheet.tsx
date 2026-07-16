'use client';

import { useEffect, useMemo, useState } from 'react';
import { useConfig } from 'wagmi';
import { getPublicClient } from 'wagmi/actions';
import { encodeFunctionData, erc20Abi, formatUnits, isAddress, parseUnits, zeroAddress } from 'viem';
import { Portal } from './Portal';
import { Button } from './Button';
import { btb } from './design-tokens';
import { useTx } from '../lib/TxTracker';
import { runCalls } from '../lib/txRunner';
import { approvalCall, BTB_AGENT_REGISTRY_ABI, BTB_LP_ACCOUNT_ABI, depositTokenCall, type SmartAccountDeployment } from '../lib/smartAccount';
import { fetchAccountAssets, type AccountAsset } from '../lib/accountAssets';
import { TokenIcon } from './TokenIcon';

function compact(raw: bigint, decimals: number) {
  const n = Number(formatUnits(raw, decimals));
  return n.toLocaleString('en-US', { maximumFractionDigits: 6 });
}

export function ManagedFundsSheet({ chainId, chainName, owner, account, deployment, onClose, onDone, initialMode = 'deposit', initialWalletAssets = [], initialAccountAssets = [] }: {
  chainId: 1 | 4663;
  chainName: string;
  owner: `0x${string}`;
  account: `0x${string}`;
  deployment: SmartAccountDeployment;
  onClose: () => void;
  onDone: () => void | Promise<void>;
  initialMode?: 'deposit' | 'withdraw';
  initialWalletAssets?: AccountAsset[];
  initialAccountAssets?: AccountAsset[];
}) {
  const config = useConfig();
  const { track } = useTx();
  const [token, setToken] = useState('');
  const [mode, setMode] = useState<'deposit' | 'withdraw'>(initialMode);
  const [amount, setAmount] = useState('');
  const [meta, setMeta] = useState<{ symbol: string; decimals: number; wallet: bigint; account: bigint; reserved: bigint } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walletAssets, setWalletAssets] = useState<AccountAsset[]>(initialWalletAssets);
  const [accountAssets, setAccountAssets] = useState<AccountAsset[]>(initialAccountAssets);
  const [assetsLoading, setAssetsLoading] = useState(initialWalletAssets.length === 0 && initialAccountAssets.length === 0);
  const [showContract, setShowContract] = useState(false);
  const [addressCopied, setAddressCopied] = useState(false);

  const validToken = isAddress(token.trim()) ? token.trim() as `0x${string}` : null;
  const nativeToken = token === 'native';
  const parsed = useMemo(() => {
    try { return meta && amount && Number(amount) > 0 ? parseUnits(amount, meta.decimals) : 0n; }
    catch { return 0n; }
  }, [amount, meta]);
  // Withdrawals are capped at the unreserved account balance; a pending LP instruction locks the rest.
  const withdrawable = meta ? (meta.account > meta.reserved ? meta.account - meta.reserved : 0n) : 0n;
  const available = meta ? (mode === 'deposit' ? meta.wallet : withdrawable) : 0n;

  useEffect(() => {
    const controller = new AbortController();
    setAssetsLoading(walletAssets.length === 0 && accountAssets.length === 0);
    void Promise.all([fetchAccountAssets(owner, controller.signal), fetchAccountAssets(account, controller.signal)])
      .then(([wallet, held]) => { setWalletAssets(wallet); setAccountAssets(held); })
      .catch(() => undefined)
      .finally(() => { if (!controller.signal.aborted) setAssetsLoading(false); });
    return () => controller.abort();
  }, [account, owner]);

  useEffect(() => {
    let cancelled = false;
    setMeta(null); setError(null);
    if (nativeToken) {
      const wallet = walletAssets.find(asset => asset.native);
      const held = accountAssets.find(asset => asset.native);
      const client = getPublicClient(config, { chainId });
      void (deployment.agentRegistry && client
        ? client.readContract({ address: deployment.agentRegistry, abi: BTB_AGENT_REGISTRY_ABI, functionName: 'reservedBalance', args: [account, zeroAddress] }).catch(() => 0n)
        : Promise.resolve(0n)
      ).then(reserved => {
        if (!cancelled) setMeta({ symbol: 'ETH', decimals: 18, wallet: BigInt(wallet?.rawBalance ?? 0), account: BigInt(held?.rawBalance ?? 0), reserved });
      });
      return () => { cancelled = true; };
    }
    if (!validToken) return;
    (async () => {
      const client = getPublicClient(config, { chainId });
      if (!client) throw new Error('RPC unavailable');
      const [symbol, decimals, wallet, held, reserved] = await Promise.all([
        client.readContract({ address: validToken, abi: erc20Abi, functionName: 'symbol' }),
        client.readContract({ address: validToken, abi: erc20Abi, functionName: 'decimals' }),
        client.readContract({ address: validToken, abi: erc20Abi, functionName: 'balanceOf', args: [owner] }),
        client.readContract({ address: validToken, abi: erc20Abi, functionName: 'balanceOf', args: [account] }),
        // Funds a pending LP instruction has earmarked cannot be withdrawn (the contract reverts).
        deployment.agentRegistry
          ? client.readContract({ address: deployment.agentRegistry, abi: BTB_AGENT_REGISTRY_ABI, functionName: 'reservedBalance', args: [account, validToken] }).catch(() => 0n)
          : 0n,
      ]);
      if (!cancelled) setMeta({ symbol, decimals, wallet, account: held, reserved });
    })().catch(() => { if (!cancelled) setError('This is not a readable ERC-20 contract on the selected chain.'); });
    return () => { cancelled = true; };
  }, [account, accountAssets, chainId, config, deployment.agentRegistry, nativeToken, owner, validToken, walletAssets]);

  async function deposit() {
    if ((!validToken && !nativeToken) || !meta || parsed <= 0n || parsed > available) return;
    setBusy(true); setError(null);
    try {
      await runCalls(config, {
        account: owner, chainId, track, label: mode === 'deposit' ? `Deposit ${meta.symbol} into smart account` : `Withdraw ${meta.symbol} from smart account`,
        calls: nativeToken
          ? mode === 'deposit'
            ? [{ to: account, value: parsed }]
            : [{ to: account, data: encodeFunctionData({ abi: BTB_LP_ACCOUNT_ABI, functionName: 'withdrawNative', args: [parsed] }) }]
          : mode === 'deposit'
            ? [approvalCall(validToken!, account, parsed), depositTokenCall(account, validToken!, parsed)].filter((call): call is NonNullable<typeof call> => call !== null)
            : [{ to: account, data: encodeFunctionData({ abi: BTB_LP_ACCOUNT_ABI, functionName: 'withdrawToken', args: [validToken!, parsed] }) }],
      });
      await onDone(); onClose();
    } catch (e) { setError((e as { shortMessage?: string })?.shortMessage ?? (e as Error)?.message ?? `${mode === 'deposit' ? 'Deposit' : 'Withdrawal'} failed`); }
    finally { setBusy(false); }
  }

  async function withdrawAll() {
    const tokens = accountAssets
      .filter(asset => !asset.native && asset.address && asset.balance > 0 && isAddress(asset.address))
      .map(asset => asset.address as `0x${string}`);
    const hasNative = accountAssets.some(asset => asset.native && asset.balance > 0);
    if (tokens.length === 0 && !hasNative) return;
    setBusy(true); setError(null);
    try {
      await runCalls(config, {
        account: owner, chainId, track, label: 'Withdraw all available smart-account funds',
        calls: [
          ...(tokens.length > 0 ? [{ to: account, data: encodeFunctionData({ abi: BTB_LP_ACCOUNT_ABI, functionName: 'withdrawTokens', args: [tokens] }) }] : []),
          ...(hasNative ? [{ to: account, data: encodeFunctionData({ abi: BTB_LP_ACCOUNT_ABI, functionName: 'withdrawAllNative' }) }] : []),
        ],
      });
      await onDone(); onClose();
    } catch (e) { setError((e as { shortMessage?: string })?.shortMessage ?? (e as Error)?.message ?? 'Bulk withdrawal failed'); }
    finally { setBusy(false); }
  }

  return <Portal>
    <div onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }} style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(5,5,10,.72)', backdropFilter: 'blur(10px)', display: 'grid', placeItems: 'center', padding: 14 }}>
      <div style={{ width: 'min(430px,100%)', borderRadius: 20, padding: 18, background: '#17171f', border: btb.border, boxShadow: '0 24px 80px rgba(0,0,0,.5)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <div><div style={{ color: btb.text, fontSize: 16, fontWeight: 850 }}>{mode === 'deposit' ? 'Deposit funds' : 'Withdraw funds'}</div><div style={{ color: btb.textMuted, fontSize: 11, marginTop: 3 }}>{chainName} · {account.slice(0, 6)}…{account.slice(-4)}</div></div>
          <button onClick={onClose} style={{ border: 0, background: 'transparent', color: btb.textMuted, fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ marginTop: 15, padding: 12, borderRadius: 13, background: 'rgba(255,255,255,.035)', border: btb.borderSoft }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 11 }}>
            {(['deposit', 'withdraw'] as const).map(option => <button key={option} onClick={() => { setMode(option); setAmount(''); }} style={{ height: 33, borderRadius: 9, border: mode === option ? '1px solid rgba(82,227,164,.45)' : btb.borderSoft, background: mode === option ? 'rgba(82,227,164,.1)' : 'rgba(255,255,255,.025)', color: mode === option ? btb.green : btb.textMuted, fontFamily: 'inherit', fontSize: 10.5, fontWeight: 800, textTransform: 'capitalize', cursor: 'pointer' }}>{option}</button>)}
          </div>
          {mode === 'deposit' && <div style={{ marginBottom: 11, padding: 10, borderRadius: 11, border: '1px solid rgba(82,227,164,.2)', background: 'rgba(82,227,164,.045)' }}>
            <div style={{ color: btb.textMuted, fontSize: 9.5, lineHeight: 1.45 }}>You can also send supported assets directly to this smart account on <span style={{ color: btb.text, fontWeight: 800 }}>{chainName}</span>.</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 7 }}>
              <code style={{ minWidth: 0, flex: 1, color: btb.text, fontSize: 9.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{account}</code>
              <button onClick={() => { void navigator.clipboard.writeText(account); setAddressCopied(true); window.setTimeout(() => setAddressCopied(false), 1600); }} style={{ flex: '0 0 auto', height: 29, padding: '0 10px', borderRadius: 8, border: btb.borderSoft, background: 'rgba(255,255,255,.05)', color: addressCopied ? btb.green : btb.text, fontFamily: 'inherit', fontSize: 9.5, fontWeight: 800, cursor: 'pointer' }}>{addressCopied ? 'Copied' : 'Copy address'}</button>
            </div>
            <div style={{ color: btb.textDim, fontSize: 8.5, lineHeight: 1.4, marginTop: 6 }}>Only send assets on {chainName}. Funds remain owner-controlled and can be withdrawn from this account.</div>
          </div>}
          <div style={{ color: btb.textDim, fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .5 }}>{mode === 'deposit' ? 'Your wallet assets' : 'Smart-account assets'}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 7, paddingBottom: 3, maxHeight: 132, overflowY: 'auto' }}>
            {(mode === 'deposit' ? walletAssets : accountAssets).filter(asset => asset.balance > 0).map(asset => {
              const key = asset.address ?? 'native';
              const selected = token.toLowerCase() === key.toLowerCase();
              return <button key={key} onClick={() => { setToken(key); setAmount(''); }} style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 6, height: 38, padding: '0 9px', borderRadius: 10, border: selected ? '1px solid rgba(82,227,164,.4)' : btb.borderSoft, background: selected ? 'rgba(82,227,164,.09)' : 'rgba(255,255,255,.025)', color: selected ? btb.green : btb.textMuted, fontFamily: 'inherit', cursor: 'pointer' }}><TokenIcon symbol={asset.symbol} logoUrl={asset.imageUrl} size={20}/><span style={{ fontSize: 10, fontWeight: 800 }}>{asset.symbol}</span><span style={{ fontSize: 9 }}>{asset.balance.toLocaleString('en-US', { maximumFractionDigits: 4 })}</span></button>;
            })}
          </div>
          {assetsLoading && <div style={{ color: btb.textMuted, fontSize: 10, padding: '7px 0' }}>Loading balances…</div>}
          {!assetsLoading && (mode === 'deposit' ? walletAssets : accountAssets).filter(asset => asset.balance > 0).length === 0 && <div style={{ color: btb.textMuted, fontSize: 10, padding: '7px 0' }}>No funded assets found on Robinhood Chain.</div>}
          <button onClick={() => setShowContract(value => !value)} style={{ border: 0, background: 'transparent', color: btb.textDim, padding: '6px 0 0', fontFamily: 'inherit', fontSize: 9.5, cursor: 'pointer' }}>{showContract ? 'Hide contract entry' : 'Token missing? Enter contract'}</button>
          {showContract && <><div style={{ color: btb.textDim, fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .5, marginTop: 7 }}>Token contract</div>
          <input value={token === 'native' ? '' : token} onChange={e => setToken(e.target.value)} placeholder="0x…" spellCheck={false} style={{ width: '100%', boxSizing: 'border-box', marginTop: 7, height: 38, borderRadius: 9, border: btb.borderSoft, background: 'rgba(255,255,255,.04)', color: btb.text, padding: '0 10px', fontFamily: 'monospace', outline: 'none' }}/></>}
          {meta && <div style={{ marginTop: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ color: btb.text, fontSize: 12, fontWeight: 800 }}>{meta.symbol}</span>
              <span style={{ color: btb.textMuted, fontSize: 10 }}>{mode === 'deposit' ? `Wallet ${compact(meta.wallet, meta.decimals)} · Account ${compact(meta.account, meta.decimals)}` : `Withdrawable ${compact(withdrawable, meta.decimals)}`}</span>
            </div>
            {mode === 'withdraw' && meta.reserved > 0n && <div style={{ color: btb.amber, fontSize: 9.5, marginTop: 3 }}>{compact(meta.reserved, meta.decimals)} {meta.symbol} is reserved by a pending LP instruction and stays locked.</div>}
          </div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input value={amount} onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" placeholder="Amount" style={{ flex: 1, minWidth: 0, height: 40, borderRadius: 9, border: btb.borderSoft, background: 'rgba(255,255,255,.04)', color: btb.text, padding: '0 10px', fontSize: 15, outline: 'none' }}/>
            <button onClick={() => meta && setAmount(formatUnits(available, meta.decimals))} disabled={!meta} style={{ padding: '0 12px', borderRadius: 9, border: btb.borderSoft, background: 'rgba(82,227,164,.08)', color: btb.green, fontWeight: 800, cursor: 'pointer' }}>MAX</button>
          </div>
        </div>
        <div style={{ color: btb.textDim, fontSize: 10, lineHeight: 1.45, marginTop: 9 }}>Any ERC-20 can be stored. Approved LP and instant-trade actions can use it; everything else remains withdrawable only by you.</div>
        {error && <div style={{ color: btb.loss, fontSize: 11, lineHeight: 1.4, marginTop: 9 }}>{error}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: mode === 'withdraw' ? '1fr 1fr' : '1fr', gap: 8, marginTop: 13 }}>
          <Button variant="success" onClick={deposit} disabled={busy || !meta || parsed <= 0n || parsed > available} style={{ width: '100%' }}>{busy ? mode === 'deposit' ? 'Depositing…' : 'Withdrawing…' : meta && parsed > available ? `Insufficient ${meta.symbol}` : `${mode === 'deposit' ? 'Deposit' : 'Withdraw'}${meta ? ` ${meta.symbol}` : ''}`}</Button>
          {mode === 'withdraw' && <Button variant="ghost" onClick={withdrawAll} disabled={busy || accountAssets.every(asset => asset.balance <= 0)} style={{ width: '100%', border: '1px solid rgba(255,179,107,.28)', color: btb.amber }}>{busy ? 'Withdrawing…' : 'Withdraw all'}</Button>}
        </div>
        {mode === 'withdraw' && <div style={{ color: btb.textDim, fontSize: 9, lineHeight: 1.4, marginTop: 7, textAlign: 'center' }}>One confirmation sweeps every available token and ETH. Funds reserved by active automation stay protected.</div>}
      </div>
    </div>
  </Portal>;
}
