'use client';
import { useState } from 'react';
import { useSendTransaction, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, erc20Abi } from 'viem';
import { btb } from './design-tokens';
import { Icon } from './Icon';
import { TokenIcon } from './TokenIcon';
import { useTokenStore, Token } from '../lib/TokenStore';
import { CHAIN_META } from '../lib/wagmi';

export function SendModal({ fromAddress, onClose, initialToken }: { fromAddress: string; onClose: () => void; initialToken?: Token }) {
  const { positions } = useTokenStore();
  const { sendTransactionAsync } = useSendTransaction();
  const { writeContractAsync } = useWriteContract();

  // Same source as PortfolioScreen — only tokens the wallet actually holds.
  const displayTokens = positions
    .filter(t => parseFloat(t.balance ?? '0') > 0)
    .sort((a, b) => (b.usdValue ?? 0) - (a.usdValue ?? 0))
    .slice(0, 30);

  const [to, setTo]         = useState('');
  const [amount, setAmount] = useState('');
  const [token, setToken]   = useState(initialToken?.symbol ?? displayTokens[0]?.symbol ?? 'ETH');
  const [step, setStep]     = useState<'form' | 'confirm' | 'sending' | 'sent' | 'error'>('form');
  const [toError, setToError] = useState('');
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [errMsg, setErrMsg] = useState('');

  const selectedToken = displayTokens.find(t => t.symbol === token && (!initialToken || t.chainId === initialToken.chainId))
    ?? displayTokens.find(t => t.symbol === token)
    ?? displayTokens[0];

  const { isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  function isValidAddress(v: string) { return /^0x[0-9a-fA-F]{40}$/.test(v.trim()); }

  function handleReview() {
    if (!isValidAddress(to)) { setToError('Enter a valid 0x address'); return; }
    if (!amount || parseFloat(amount) <= 0) return;
    setToError('');
    setStep('confirm');
  }

  async function handleSend() {
    if (!selectedToken) return;
    setStep('sending');
    try {
      const isNative = selectedToken.address === 'ETH' || selectedToken.address === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
      const decimals = selectedToken.decimals ?? 18;
      const amountBig = parseUnits(amount, decimals);

      let hash: `0x${string}`;
      if (isNative) {
        hash = await sendTransactionAsync({
          to: to as `0x${string}`,
          value: amountBig,
        });
      } else {
        hash = await writeContractAsync({
          address: selectedToken.address as `0x${string}`,
          abi: erc20Abi,
          functionName: 'transfer',
          args: [to as `0x${string}`, amountBig],
        });
      }

      setTxHash(hash);
      setStep('sent');
    } catch (e: any) {
      setErrMsg(e?.shortMessage ?? e?.message ?? 'Transaction failed');
      setStep('error');
    }
  }

  const bal      = selectedToken?.balance ?? '0';
  const usdPrice = selectedToken?.usdPrice ?? 0;
  const amountUsd = amount && usdPrice ? parseFloat(amount) * usdPrice : null;
  const chainName = selectedToken?.chainId ? CHAIN_META[selectedToken.chainId]?.name : null;

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 480, minWidth: 0,
        maxHeight: '90vh', overflowY: 'auto', overflowX: 'hidden',
        background: 'rgba(28,4,10,0.97)',
        borderTop: '1px solid rgba(255,255,255,0.12)', borderRadius: '28px 28px 0 0',
        padding: '12px 20px calc(32px + env(safe-area-inset-bottom, 0px))', display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <div style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)' }}/>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {step !== 'form' && step !== 'sent' && step !== 'error' && (
            <div onClick={() => setStep('form')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: btb.textMuted }}>
              <Icon name="back" size={18} color={btb.textMuted}/>
            </div>
          )}
          <span style={{ color: btb.text, fontSize: 20, fontWeight: 800, letterSpacing: -0.4 }}>
            {step === 'form' ? 'Send' : step === 'confirm' ? 'Confirm send' : step === 'sending' ? 'Sending…' : step === 'sent' ? 'Sent!' : 'Failed'}
          </span>
          <div onClick={onClose} style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(255,255,255,0.08)', border: btb.borderSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round">
              <path d="M1 1l12 12M13 1L1 13"/>
            </svg>
          </div>
        </div>

        {step === 'form' && <>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch', minWidth: 0, maxWidth: '100%' }}>
            {displayTokens.map(t => (
              <div key={t.address + t.chainId} onClick={() => { setToken(t.symbol); setAmount(''); }} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 14px 8px 8px', borderRadius: 999, flexShrink: 0, cursor: 'pointer',
                background: token === t.symbol ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)',
                border: token === t.symbol ? '1px solid rgba(255,255,255,0.2)' : btb.borderSoft,
                transition: 'all 0.15s', whiteSpace: 'nowrap',
              }}>
                <TokenIcon symbol={t.symbol} size={24} logoUrl={t.logoURI}/>
                <div style={{ lineHeight: 1.2 }}>
                  <div style={{ color: btb.text, fontSize: 13, fontWeight: 700 }}>{t.symbol}</div>
                  {t.balance && <div style={{ color: btb.textDim, fontSize: 10 }}>{parseFloat(t.balance).toLocaleString('en-US', { maximumFractionDigits: 4 })}</div>}
                </div>
              </div>
            ))}
          </div>

          <div style={{ background: 'rgba(255,255,255,0.05)', border: btb.border, borderRadius: 20, padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ color: btb.textMuted, fontSize: 12 }}>Amount</span>
              <span style={{ color: btb.textMuted, fontSize: 12 }}>
                Bal: {parseFloat(bal).toLocaleString('en-US', { maximumFractionDigits: 6 })} {token}
                <span onClick={() => setAmount(bal)} style={{ color: btb.red, fontWeight: 700, marginLeft: 6, cursor: 'pointer' }}>MAX</span>
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" inputMode="decimal" style={{
                flex: 1, minWidth: 0, width: '100%', background: 'transparent', border: 'none', outline: 'none',
                color: btb.text, fontSize: 32, fontWeight: 700, letterSpacing: -0.8, fontFamily: 'inherit',
              }}/>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, maxWidth: '45%' }}>
                <TokenIcon symbol={token} size={28} logoUrl={selectedToken?.logoURI}/>
                <span style={{ color: btb.text, fontSize: 16, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{token}</span>
              </div>
            </div>
            {amountUsd != null && <div style={{ color: btb.textDim, fontSize: 12, marginTop: 4 }}>≈ ${amountUsd.toLocaleString('en-US', { maximumFractionDigits: 2 })}</div>}
          </div>

          <div style={{ background: 'rgba(255,255,255,0.05)', border: toError ? '1px solid rgba(255,255,255,0.25)' : btb.border, borderRadius: 20, padding: '14px 16px' }}>
            <div style={{ color: btb.textMuted, fontSize: 12, marginBottom: 6 }}>To address</div>
            <input value={to} onChange={e => { setTo(e.target.value); setToError(''); }} placeholder="0x…"
              style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: btb.text, fontSize: 14, fontFamily: 'monospace', letterSpacing: 0.3 }}/>
            {toError && <div style={{ color: btb.loss, fontSize: 12, marginTop: 6 }}>{toError}</div>}
          </div>

          <button onClick={handleReview} disabled={!amount || !to} style={{
            height: 56, borderRadius: 18, border: 'none', cursor: 'pointer',
            background: (!amount || !to) ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg,rgba(255,255,255,0.18),rgba(255,255,255,0.08))',
            color: (!amount || !to) ? btb.textDim : '#fff',
            fontSize: 16, fontWeight: 700, fontFamily: 'inherit',
            boxShadow: (!amount || !to) ? 'none' : '0 8px 24px rgba(255,255,255,0.2)', transition: 'all 0.2s',
          }}>Review send</button>
        </>}

        {(step === 'confirm' || step === 'sending') && <>
          <div style={{ background: 'rgba(255,255,255,0.05)', border: btb.border, borderRadius: 20, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Row label="From"    value={`${fromAddress.slice(0,8)}…${fromAddress.slice(-6)}`}/>
            <Row label="To"      value={`${to.slice(0,8)}…${to.slice(-6)}`}/>
            <Row label="Amount"  value={`${amount} ${token}`}/>
            {chainName && <Row label="Network" value={chainName} last/>}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setStep('form')} disabled={step === 'sending'} style={{ flex: 1, height: 56, borderRadius: 18, border: btb.border, background: 'rgba(255,255,255,0.06)', color: btb.textMuted, fontSize: 15, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>Edit</button>
            <button onClick={handleSend} disabled={step === 'sending'} style={{
              flex: 2, height: 56, borderRadius: 18, border: 'none', cursor: step === 'sending' ? 'default' : 'pointer',
              background: 'linear-gradient(135deg,rgba(255,255,255,0.18),rgba(255,255,255,0.08))', color: '#fff',
              fontSize: 16, fontWeight: 700, fontFamily: 'inherit',
              boxShadow: '0 8px 24px rgba(255,255,255,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              opacity: step === 'sending' ? 0.7 : 1,
            }}>
              {step === 'sending'
                ? <><div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.2)', borderTopColor: '#fff', animation: 'spin 0.8s linear infinite' }}/> Sending…</>
                : <><Icon name="send" size={18}/> Confirm send</>
              }
            </button>
          </div>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </>}

        {step === 'sent' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, paddingTop: 16, paddingBottom: 8 }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(82,227,164,0.15)', border: '2px solid rgba(82,227,164,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="check" size={32} color={btb.green}/>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: btb.text, fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>Transaction sent</div>
              <div style={{ color: btb.textMuted, fontSize: 14, marginTop: 6 }}>{amount} {token} → {to.slice(0,8)}…{to.slice(-4)}</div>
              {isSuccess && <div style={{ color: btb.green, fontSize: 12, marginTop: 4 }}>Confirmed on-chain</div>}
            </div>
            {txHash && (
              <a href={`https://etherscan.io/tx/${txHash}`} target="_blank" rel="noreferrer"
                style={{ color: btb.textMuted, fontSize: 12, fontFamily: 'monospace' }}>
                {txHash.slice(0, 14)}…{txHash.slice(-8)} ↗
              </a>
            )}
            <button onClick={onClose} style={{ width: '100%', height: 56, borderRadius: 18, border: 'none', cursor: 'pointer', background: 'rgba(82,227,164,0.15)', color: btb.green, fontSize: 16, fontWeight: 700, fontFamily: 'inherit', outline: '1px solid rgba(82,227,164,0.35)' }}>Done</button>
          </div>
        )}

        {step === 'error' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, paddingTop: 16, paddingBottom: 8 }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(255,80,80,0.12)', border: '2px solid rgba(255,80,80,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="close" size={32} color={btb.loss}/>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: btb.text, fontSize: 20, fontWeight: 800 }}>Transaction failed</div>
              <div style={{ color: btb.textMuted, fontSize: 13, marginTop: 8, maxWidth: 280 }}>{errMsg}</div>
            </div>
            <button onClick={() => setStep('confirm')} style={{ width: '100%', height: 56, borderRadius: 18, border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.08)', color: btb.text, fontSize: 16, fontWeight: 700, fontFamily: 'inherit' }}>Try again</button>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: last ? 0 : 14, borderBottom: last ? 'none' : '1px solid rgba(255,255,255,0.06)' }}>
      <span style={{ color: btb.textMuted, fontSize: 13 }}>{label}</span>
      <span style={{ color: btb.text, fontSize: 13, fontWeight: 600, fontFamily: label === 'From' || label === 'To' ? 'monospace' : 'inherit' }}>{value}</span>
    </div>
  );
}
