'use client';
import { useState, useEffect, useRef } from 'react';
import { useConnection, useConfig, useReadContract } from 'wagmi';
import { useMutation } from 'convex/react';
import { erc20Abi, encodeFunctionData } from 'viem';
import { useTx } from '@/lib/TxTracker';
import { runCalls, type Call } from '@/lib/txRunner';
import { Glass } from '../Glass';
import { Icon } from '../Icon';
import { TokenIcon } from '../TokenIcon';
import { btb } from '../design-tokens';
import { useTokenStore, Token } from '../../lib/TokenStore';
import { getKyberQuote, buildKyberTx, KyberQuote } from '../../lib/kyberswap';
import { CHAIN_META } from '../../lib/wagmi';
import { parseUnits } from 'viem';
import { api } from '../../../convex/_generated/api';

const SWAP_XP = 100;

// ─── helpers ─────────────────────────────────────────────────────────────────

function balanceNum(t: Token): number {
  const bal = parseFloat(t.balance ?? '0');
  return !bal || !isFinite(bal) ? 0 : bal;
}

function realUsdValue(t: Token): number {
  return balanceNum(t) * (t.usdPrice ?? 0);
}

function sortedTokens(tokens: Token[]): Token[] {
  // Tokens the wallet actually holds come first (even if price hasn't loaded
  // yet), ordered by USD value then by raw balance.
  return [...tokens].sort((a, b) => {
    const ah = balanceNum(a) > 0, bh = balanceNum(b) > 0;
    if (ah && !bh) return -1;
    if (bh && !ah) return 1;
    const ua = realUsdValue(a), ub = realUsdValue(b);
    if (ua !== ub) return ub - ua;
    return balanceNum(b) - balanceNum(a);
  });
}

// ─── Token picker ─────────────────────────────────────────────────────────────

function TokenPicker({ tokens, selected, onSelect, onClose }: {
  tokens: Token[]; selected: string; onSelect: (t: Token) => void; onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const sorted = sortedTokens(tokens);
  const ql = q.toLowerCase();
  const filtered = ql
    ? sorted.filter(t =>
        t.symbol.toLowerCase().includes(ql) ||
        t.name.toLowerCase().includes(ql) ||
        t.address.toLowerCase().includes(ql)
      )
    : sorted; // show every token — balance-first sorted, search-narrowable

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, minWidth: 0, maxHeight: '82vh', background: 'rgba(10,10,15,0.98)', borderTop: '1px solid rgba(255,255,255,0.1)', borderRadius: '28px 28px 0 0', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '12px 20px 0' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.18)', margin: '0 auto 16px' }}/>
          <div style={{ color: btb.text, fontSize: 18, fontWeight: 800, marginBottom: 12 }}>Select token</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.06)', border: btb.borderSoft, borderRadius: 14, padding: '10px 14px', marginBottom: 8 }}>
            <Icon name="search" size={16} color={btb.textMuted}/>
            <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search token…"
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: btb.text, fontSize: 15, fontFamily: 'inherit' }}/>
          </div>
          {!q && <div style={{ color: btb.textDim, fontSize: 11, marginBottom: 6, paddingLeft: 4 }}>Tokens with balance shown first</div>}
        </div>
        <div style={{ overflowY: 'auto', padding: '0 12px 48px' }}>
          {filtered.map(t => (
            <div key={t.address} onClick={() => { onSelect(t); onClose(); }} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 8px', borderRadius: 14,
              background: t.address === selected ? 'rgba(255,255,255,0.08)' : 'transparent', cursor: 'pointer',
            }}>
              <TokenIcon symbol={t.symbol} size={38} logoUrl={t.logoURI}/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: btb.text, fontSize: 15, fontWeight: 700 }}>{t.symbol}</div>
                <div style={{ color: btb.textMuted, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
              </div>
              {(() => {
                const bal = parseFloat(t.balance ?? '0');
                if (!bal || !isFinite(bal)) return null;
                return (
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ color: btb.text, fontSize: 13, fontWeight: 600 }}>
                      {bal.toLocaleString('en-US', { maximumFractionDigits: 4 })}
                    </div>
                    {t.usdValue != null && t.usdValue > 0 && (
                      <div style={{ color: btb.textMuted, fontSize: 11 }}>${t.usdValue.toLocaleString('en-US', { maximumFractionDigits: 2 })}</div>
                    )}
                  </div>
                );
              })()}
            </div>
          ))}
          {filtered.length === 0 && <div style={{ color: btb.textMuted, fontSize: 14, textAlign: 'center', padding: 24 }}>No tokens found</div>}
        </div>
      </div>
    </div>
  );
}


function TokenPill({ token, onClick }: { token: Token; onClick: () => void }) {
  return (
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px 6px 6px', background: 'rgba(255,255,255,0.1)', border: btb.border, borderRadius: 999, flexShrink: 0, cursor: 'pointer', maxWidth: 160 }}>
      <TokenIcon symbol={token.symbol} size={28} logoUrl={token.logoURI}/>
      <span style={{ color: btb.text, fontSize: 16, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{token.symbol}</span>
      <Icon name="down" size={14} color="rgba(255,255,255,0.7)"/>
    </div>
  );
}

function InfoRow({ label, value, last }: { label: string; value: React.ReactNode; last?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 4px', borderBottom: last ? 'none' : '1px solid rgba(255,255,255,0.06)' }}>
      <span style={{ color: btb.textMuted, fontSize: 13 }}>{label}</span>
      <span style={{ color: btb.text, fontSize: 13, fontWeight: 600 }}>{value}</span>
    </div>
  );
}

const ETH_DEFAULT:  Token = { address: 'ETH',  symbol: 'ETH',  name: 'Ethereum', decimals: 18, chainId: 1 };
const USDC_DEFAULT: Token = { address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', symbol: 'USDC', name: 'USD Coin', decimals: 6, chainId: 1 };

function nativeEthForChain(chainId: number): Token {
  return { address: 'ETH', symbol: 'ETH', name: 'Ethereum', decimals: 18, chainId };
}

type SwapStep = 'form' | 'confirm' | 'approving' | 'sending' | 'success' | 'error';

// ─── Main ─────────────────────────────────────────────────────────────────────

export function SwapScreen({ initialFrom }: { initialFrom?: Token } = {}) {
  const { tokens } = useTokenStore();
  const { address } = useConnection();
  const config = useConfig();
  const { track } = useTx();
  // KyberSwap API needs an explicit chain in its URL — we're mainnet only.
  const chainId = 1;

  const [fromToken, setFromToken] = useState<Token>(initialFrom ?? ETH_DEFAULT);
  const [toToken,   setToToken]   = useState<Token>(
    initialFrom ? nativeEthForChain(initialFrom.chainId ?? 1) : USDC_DEFAULT
  );
  const [fromAmt,   setFromAmt]   = useState('');
  const [picker,    setPicker]    = useState<'from' | 'to' | null>(null);
  const [step,      setStep]      = useState<SwapStep>('form');
  const [quote,     setQuote]     = useState<KyberQuote | null>(null);
  const [quoting,   setQuoting]   = useState(false);
  const [quoteErr,  setQuoteErr]  = useState<string | null>(null);
  const [txHash,    setTxHash]    = useState<`0x${string}` | undefined>();
  const [errMsg,    setErrMsg]    = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const awardXp = useMutation(api.users.awardXp);

  const isNativeFrom = fromToken.address === 'ETH';
  const { refetch: refetchAllowance } = useReadContract({
    address: isNativeFrom ? undefined : fromToken.address as `0x${string}`,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address && quote ? [address, quote.routerAddress as `0x${string}`] : undefined,
    query: { enabled: !isNativeFrom && !!address && !!quote },
  });

  // Pick sensible defaults once when the token list first arrives
  const defaultsAppliedRef = useRef(false);
  useEffect(() => {
    if (tokens.length === 0 || defaultsAppliedRef.current) return;
    defaultsAppliedRef.current = true;
    if (!initialFrom) {
      const eth  = tokens.find(t => t.address === 'ETH' || t.symbol === 'ETH');
      const usdc = tokens.find(t => t.symbol === 'USDC');
      if (eth)  setFromToken(eth);
      if (usdc) setToToken(usdc);
    } else {
      const live = tokens.find(t => t.address === initialFrom.address && t.chainId === initialFrom.chainId);
      if (live) setFromToken(live);
    }
  }, [tokens, initialFrom]);

  // Keep the selected from/to tokens in sync with the live store — balances
  // and prices arrive asynchronously, so the picked tokens must refresh too.
  useEffect(() => {
    if (tokens.length === 0) return;
    const liveFrom = tokens.find(t => t.address === fromToken.address);
    if (liveFrom && (liveFrom.balance !== fromToken.balance || liveFrom.usdPrice !== fromToken.usdPrice)) {
      setFromToken(liveFrom);
    }
    const liveTo = tokens.find(t => t.address === toToken.address);
    if (liveTo && (liveTo.balance !== toToken.balance || liveTo.usdPrice !== toToken.usdPrice)) {
      setToToken(liveTo);
    }
  }, [tokens, fromToken.address, toToken.address, fromToken.balance, fromToken.usdPrice, toToken.balance, toToken.usdPrice]);

  // Debounced KyberSwap quote
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!fromAmt || parseFloat(fromAmt) <= 0) { setQuote(null); return; }
    debounceRef.current = setTimeout(async () => {
      setQuoting(true);
      setQuoteErr(null);
      try {
        const amtIn = parseUnits(fromAmt, fromToken.decimals).toString();
        const q = await getKyberQuote(fromToken.address, toToken.address, amtIn, toToken.decimals, chainId);
        setQuote(q);
      } catch (e) {
        setQuoteErr((e as Error).message);
        setQuote(null);
      } finally {
        setQuoting(false);
      }
    }, 600);
  }, [fromAmt, fromToken.address, toToken.address, chainId]); // eslint-disable-line react-hooks/exhaustive-deps

  function flip() {
    setFromToken(toToken); setToToken(fromToken);
    setFromAmt(''); setQuote(null);
  }

  function reset() {
    setStep('form'); setFromAmt(''); setQuote(null); setTxHash(undefined); setErrMsg('');
  }

  async function executeSwap() {
    if (!quote || !address) return;
    try {
      const calls: Call[] = [];

      // ERC-20: approve the router first if the allowance is short. Batched with
      // the swap below so supporting wallets confirm both at once; otherwise the
      // runner approves, WAITS for it to confirm, then swaps.
      let needsApprove = false;
      if (!isNativeFrom) {
        const amountIn = BigInt(quote.routeSummary.amountIn ?? '0');
        const currentAllowance = (await refetchAllowance()).data ?? BigInt(0);
        if (currentAllowance < amountIn) {
          needsApprove = true;
          calls.push({
            to: fromToken.address as `0x${string}`,
            data: encodeFunctionData({
              abi: erc20Abi,
              functionName: 'approve',
              args: [quote.routerAddress as `0x${string}`, amountIn],
            }),
          });
        }
      }

      const tx = await buildKyberTx(quote.routeSummary, quote.routerAddress, address, address, 50, chainId);
      const txValue = isNativeFrom
        ? BigInt(quote.routeSummary.amountIn ?? '0')
        : BigInt(tx.value && tx.value !== '0' ? tx.value : '0');
      calls.push({
        to: tx.to as `0x${string}`,
        data: tx.data as `0x${string}`,
        value: txValue,
        gas: tx.gas ? BigInt(tx.gas) : undefined,
      });

      setStep(needsApprove ? 'approving' : 'sending');
      const { lastHash } = await runCalls(config, {
        account: address,
        calls,
        label: `Swap ${fromToken.symbol} → ${toToken.symbol}`,
        track,
      });

      if (lastHash) setTxHash(lastHash);
      setStep('success');
      if (address) awardXp({ walletAddress: address, amount: SWAP_XP, reason: 'swap' }).catch(() => {});
    } catch (e: any) {
      setErrMsg(e?.shortMessage ?? e?.message ?? 'Transaction failed');
      setStep('error');
    }
  }

  const fromBal = fromToken.balance ? parseFloat(fromToken.balance) : 0;
  const fromUsd = fromToken.usdPrice && fromAmt ? parseFloat(fromAmt) * fromToken.usdPrice : null;
  const toUsd   = quote?.amountOutUsd ?? null;
  const canSwap = !!quote && !!address && !quoting;

  // ── Form step ──────────────────────────────────────────────────────────────
  if (step === 'form') return (
    <div style={{ padding: 'env(safe-area-inset-top, 24px) 18px 100px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px' }}>
        <div style={{ color: btb.text, fontSize: 28, fontWeight: 800, letterSpacing: -0.6 }}>Swap</div>
        <Glass padding={0} radius={999} style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="settings" size={18}/>
        </Glass>
      </div>

      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Glass padding={18} radius={24} strong>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ color: btb.textMuted, fontSize: 13 }}>You pay</span>
            <span style={{ color: btb.textMuted, fontSize: 12 }}>
              {fromBal > 0 ? `${fromBal.toLocaleString('en-US', { maximumFractionDigits: 6 })} ${fromToken.symbol}` : '—'}
              {fromBal > 0 && <span onClick={() => setFromAmt(fromToken.balance ?? '')} style={{ color: btb.red, fontWeight: 700, marginLeft: 6, cursor: 'pointer' }}>MAX</span>}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input value={fromAmt} onChange={e => setFromAmt(e.target.value)} inputMode="decimal" placeholder="0"
              style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', color: btb.text, fontSize: 36, fontWeight: 700, letterSpacing: -1, fontFamily: 'inherit', padding: 0 }}/>
            <TokenPill token={fromToken} onClick={() => setPicker('from')}/>
          </div>
          {fromUsd != null && <div style={{ color: btb.textDim, fontSize: 13, marginTop: 4 }}>≈ ${fromUsd.toLocaleString('en-US', { maximumFractionDigits: 2 })}</div>}
        </Glass>

        <div onClick={flip} style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          width: 44, height: 44, borderRadius: 14, zIndex: 5, cursor: 'pointer',
          background: 'linear-gradient(135deg,rgba(255,255,255,0.2),rgba(255,255,255,0.08))', border: '4px solid rgba(10,10,15,0.95)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 20px rgba(255,255,255,0.2), inset 0 1px 0 rgba(255,255,255,0.3)',
        }}>
          <Icon name="swap" size={20}/>
        </div>

        <Glass padding={18} radius={24} strong>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ color: btb.textMuted, fontSize: 13 }}>You receive</span>
            <span style={{ color: btb.textMuted, fontSize: 12 }}>
              {toToken.balance ? `${parseFloat(toToken.balance).toLocaleString('en-US', { maximumFractionDigits: 4 })} ${toToken.symbol}` : '—'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, color: quoting ? btb.textMuted : btb.text, fontSize: 36, fontWeight: 700, letterSpacing: -1, fontVariantNumeric: 'tabular-nums', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {quoting ? '…' : quote ? quote.amountOutFormatted : '0'}
            </div>
            <TokenPill token={toToken} onClick={() => setPicker('to')}/>
          </div>
          {toUsd != null && <div style={{ color: btb.textDim, fontSize: 13, marginTop: 4 }}>≈ ${toUsd.toLocaleString('en-US', { maximumFractionDigits: 2 })}</div>}
        </Glass>
      </div>

      {quote && !quoting && (
        <Glass padding={14} radius={18} soft>
          <InfoRow label="Rate"         value={`1 ${fromToken.symbol} = ${quote.rate.toLocaleString('en-US', { maximumFractionDigits: 4 })} ${toToken.symbol}`}/>
          <InfoRow label="Network fee"  value={quote.gasUsd > 0 ? `~ $${quote.gasUsd.toFixed(2)}` : '—'}/>
          <InfoRow label="Price impact" value={<span style={{ color: quote.priceImpact > 2 ? btb.red : '#52E3A4' }}>{quote.priceImpact > 0 ? `${quote.priceImpact.toFixed(2)}%` : '< 0.01%'}</span>}/>
          <InfoRow label="Route" last   value={<span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Icon name="bolt" size={12} color={btb.amber}/>{quote.route}</span>}/>
        </Glass>
      )}

      {quoteErr && (
        <div style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 14, padding: '10px 14px', color: btb.red, fontSize: 13 }}>
          {quoteErr}
        </div>
      )}

      <button onClick={() => canSwap && setStep('confirm')} disabled={!canSwap} style={{
        marginTop: 4, height: 60, borderRadius: 22, border: 'none',
        cursor: canSwap ? 'pointer' : 'default',
        background: canSwap ? 'linear-gradient(135deg,rgba(255,255,255,0.95),rgba(200,210,220,0.9))' : 'rgba(255,255,255,0.08)',
        color: canSwap ? '#0A0A0F' : btb.textDim,
        fontSize: 18, fontWeight: 700, letterSpacing: -0.2, fontFamily: 'inherit',
        boxShadow: canSwap ? '0 10px 30px rgba(255,255,255,0.12), inset 0 1px 0 rgba(255,255,255,0.3)' : 'none',
        transition: 'all 0.2s',
      }}>
        {!address ? 'Connect wallet' : !fromAmt ? 'Enter amount' : quoting ? 'Getting best price…' : quoteErr ? 'No route found' : quote ? 'Review swap' : 'Enter amount'}
      </button>

      {picker && (
        <TokenPicker
          tokens={tokens}
          selected={picker === 'from' ? fromToken.address : toToken.address}
          onSelect={t => { picker === 'from' ? setFromToken(t) : setToToken(t); setFromAmt(''); setQuote(null); }}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  );

  // ── Confirm / sending step ─────────────────────────────────────────────────
  if (step === 'confirm' || step === 'approving' || step === 'sending') return (
    <div style={{ padding: 'env(safe-area-inset-top, 24px) 18px 100px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 4px' }}>
        <div onClick={() => setStep('form')} style={{ width: 36, height: 36, borderRadius: 12, background: 'rgba(255,255,255,0.08)', border: btb.borderSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <Icon name="back" size={18} color={btb.textMuted}/>
        </div>
        <div>
          <div style={{ color: btb.text, fontSize: 22, fontWeight: 800, letterSpacing: -0.4 }}>Confirm swap</div>
          {CHAIN_META[chainId] && <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}><div style={{ width: 7, height: 7, borderRadius: '50%', background: CHAIN_META[chainId].color }}/><span style={{ color: btb.textMuted, fontSize: 12 }}>{CHAIN_META[chainId].name}</span></div>}
        </div>
      </div>

      <Glass padding={0} radius={22} strong style={{ overflow: 'hidden' }}>
        {/* Pay row */}
        <div style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <TokenIcon symbol={fromToken.symbol} size={40} logoUrl={fromToken.logoURI}/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: btb.textMuted, fontSize: 12, marginBottom: 2 }}>You pay</div>
            <div style={{ color: btb.text, fontSize: 17, fontWeight: 800, letterSpacing: -0.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {parseFloat(fromAmt).toLocaleString('en-US', { maximumFractionDigits: 8 })} {fromToken.symbol}
            </div>
            {fromToken.usdPrice && <div style={{ color: btb.textDim, fontSize: 12 }}>≈ ${(parseFloat(fromAmt) * fromToken.usdPrice).toLocaleString('en-US', { maximumFractionDigits: 2 })}</div>}
          </div>
        </div>
        {/* Divider with arrow */}
        <div style={{ position: 'relative', height: 1, background: 'rgba(255,255,255,0.07)', margin: '0 18px' }}>
          <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,0.08)', border: btb.borderSoft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="down" size={14} color={btb.textMuted}/>
          </div>
        </div>
        {/* Receive row */}
        <div style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <TokenIcon symbol={toToken.symbol} size={40} logoUrl={toToken.logoURI}/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: btb.textMuted, fontSize: 12, marginBottom: 2 }}>You receive</div>
            <div style={{ color: '#52E3A4', fontSize: 17, fontWeight: 800, letterSpacing: -0.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {quote?.amountOutFormatted} {toToken.symbol}
            </div>
            {quote && quote.amountOutUsd > 0 && <div style={{ color: btb.textDim, fontSize: 12 }}>≈ ${quote.amountOutUsd.toLocaleString('en-US', { maximumFractionDigits: 2 })}</div>}
          </div>
        </div>
      </Glass>

      <Glass padding={14} radius={18} soft>
        {quote && [
          ['Rate',         `1 ${fromToken.symbol} = ${quote.rate.toLocaleString('en-US', { maximumFractionDigits: 4 })} ${toToken.symbol}`],
          ['Network fee',  quote.gasUsd > 0 ? `~ $${quote.gasUsd.toFixed(2)}` : '—'],
          ['Price impact', `${quote.priceImpact > 0 ? quote.priceImpact.toFixed(2) : '< 0.01'}%`],
          ['Slippage',     '0.5%'],
          ['Route',        quote.route],
        ].map(([label, value], i, arr) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 4px', borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
            <span style={{ color: btb.textMuted, fontSize: 13 }}>{label}</span>
            <span style={{ color: btb.text, fontSize: 13, fontWeight: 600 }}>{value}</span>
          </div>
        ))}
      </Glass>

      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={() => setStep('form')} style={{ flex: 1, height: 56, borderRadius: 18, border: btb.borderSoft, background: 'rgba(255,255,255,0.06)', color: btb.textMuted, fontSize: 15, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>Cancel</button>
        <button onClick={executeSwap} disabled={step === 'approving' || step === 'sending'} style={{
          flex: 2, height: 56, borderRadius: 18, border: 'none', cursor: 'pointer',
          background: 'linear-gradient(135deg,rgba(255,255,255,0.95),rgba(200,210,220,0.9))', color: '#0A0A0F',
          fontSize: 16, fontWeight: 700, fontFamily: 'inherit',
          boxShadow: '0 8px 24px rgba(255,255,255,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          opacity: step === 'approving' || step === 'sending' ? 0.7 : 1,
        }}>
          {step === 'approving'
            ? <><div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid rgba(0,0,0,0.2)', borderTopColor: '#0A0A0F', animation: 'spin 0.8s linear infinite' }}/> Approving…</>
            : step === 'sending'
            ? <><div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid rgba(0,0,0,0.2)', borderTopColor: '#0A0A0F', animation: 'spin 0.8s linear infinite' }}/> Swapping…</>
            : <><Icon name="swap" size={18}/> Confirm swap</>
          }
        </button>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  // ── Success step ───────────────────────────────────────────────────────────
  if (step === 'success') return (
    <div style={{ padding: 'env(safe-area-inset-top, 24px) 18px 100px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, minHeight: '70vh' }}>
      <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(82,227,164,0.15)', border: '2px solid rgba(82,227,164,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="check" size={36} color={btb.green}/>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ color: btb.text, fontSize: 24, fontWeight: 800, letterSpacing: -0.5 }}>Swap complete!</div>
        <div style={{ color: btb.textMuted, fontSize: 14, marginTop: 8 }}>
          {fromAmt} {fromToken.symbol} → {quote?.amountOutFormatted} {toToken.symbol}
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 10, padding: '4px 12px', borderRadius: 999, background: 'rgba(82,227,164,0.14)', border: '1px solid rgba(82,227,164,0.3)', color: '#52E3A4', fontSize: 13, fontWeight: 700 }}>
          <Icon name="bolt" size={13} color="#52E3A4"/> +{SWAP_XP} XP earned
        </div>
      </div>
      {txHash && (
        <a href={`https://etherscan.io/tx/${txHash}`} target="_blank" rel="noreferrer"
          style={{ color: btb.textMuted, fontSize: 12, fontFamily: 'monospace' }}>
          {txHash.slice(0, 14)}…{txHash.slice(-8)} ↗
        </a>
      )}
      <button onClick={reset} style={{ width: '100%', maxWidth: 360, height: 56, borderRadius: 18, border: 'none', cursor: 'pointer', background: 'rgba(82,227,164,0.15)', color: btb.green, fontSize: 16, fontWeight: 700, fontFamily: 'inherit', outline: '1px solid rgba(82,227,164,0.35)' }}>Swap again</button>
    </div>
  );

  // ── Error step ─────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: 'env(safe-area-inset-top, 24px) 18px 100px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, minHeight: '70vh' }}>
      <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', border: '2px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="close" size={32} color={btb.red}/>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ color: btb.text, fontSize: 22, fontWeight: 800 }}>Transaction failed</div>
        <div style={{ color: btb.textMuted, fontSize: 13, marginTop: 8, lineHeight: 1.5, maxWidth: 300 }}>{errMsg}</div>
      </div>
      <div style={{ display: 'flex', gap: 10, width: '100%', maxWidth: 360 }}>
        <button onClick={reset} style={{ flex: 1, height: 52, borderRadius: 16, border: btb.borderSoft, background: 'transparent', color: btb.textMuted, fontSize: 15, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>Cancel</button>
        <button onClick={() => setStep('confirm')} style={{ flex: 1, height: 52, borderRadius: 16, border: 'none', background: 'linear-gradient(135deg,rgba(255,255,255,0.95),rgba(200,210,220,0.9))', color: '#0A0A0F', fontSize: 15, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>Retry</button>
      </div>
    </div>
  );
}
