'use client';

import { useEffect, useState } from 'react';
import { useConfig } from 'wagmi';
import { getPublicClient } from 'wagmi/actions';
import { erc20Abi, formatUnits, parseUnits } from 'viem';
import { Portal } from './Portal';
import { Glass } from './Glass';
import { Button } from './Button';
import { btb } from './design-tokens';
import { useSidebar } from '../lib/SidebarContext';
import { useTx } from '../lib/TxTracker';
import { runCalls } from '../lib/txRunner';
import {
  addAmounts, addSide, buildIncrease, isWeth, ROBINHOOD_UNISWAP_V3_DEPLOYMENT,
  ROBINHOOD_WETH, SLIPPAGE_BPS, UNISWAP_V3_DEPLOYMENT, type LiquidityPosition,
} from '@/protocols/dexs/uniswap';

function fmt(raw: bigint, decimals: number) {
  const value = Number(formatUnits(raw, decimals));
  if (!value) return '0';
  if (value < 0.0001) return '<0.0001';
  return value.toLocaleString('en-US', { maximumFractionDigits: 5 });
}

export function ManagedAddLiquiditySheet({ pos, account, onClose, onDone }: {
  pos: LiquidityPosition;
  account: `0x${string}`;
  onClose: () => void;
  onDone: () => void | Promise<void>;
}) {
  const config = useConfig();
  const { track } = useTx();
  const { width: sidebarWidth } = useSidebar();
  const [amountText, setAmountText] = useState('');
  const [useEth, setUseEth] = useState(true);
  const [balance0, setBalance0] = useState(0n);
  const [balance1, setBalance1] = useState(0n);
  const [ethBalance, setEthBalance] = useState(0n);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chainId = (pos.chainId ?? 1) as 1 | 4663;
  const deployment = chainId === 4663 ? ROBINHOOD_UNISWAP_V3_DEPLOYMENT : UNISWAP_V3_DEPLOYMENT;
  const slippageBps = chainId === 4663 ? 500 : SLIPPAGE_BPS;
  const side = addSide(pos.sqrtPriceX96, pos.tickLower, pos.tickUpper);
  const inputSide: 0 | 1 = side === 'token1' ? 1 : 0;
  const chainWeth = chainId === 4663 ? ROBINHOOD_WETH.toLowerCase() : null;
  const wethSide: 0 | 1 | null = (chainWeth ? pos.token0.toLowerCase() === chainWeth : isWeth(pos.token0))
    ? 0 : (chainWeth ? pos.token1.toLowerCase() === chainWeth : isWeth(pos.token1)) ? 1 : null;
  const ethMode = wethSide !== null && useEth;
  const symbol0 = ethMode && wethSide === 0 ? 'ETH' : pos.symbol0;
  const symbol1 = ethMode && wethSide === 1 ? 'ETH' : pos.symbol1;
  const inputDecimals = inputSide === 0 ? pos.decimals0 : pos.decimals1;
  const inputSymbol = inputSide === 0 ? symbol0 : symbol1;

  let amount0 = 0n, amount1 = 0n;
  try {
    if (amountText && Number(amountText) > 0) {
      const calculated = addAmounts(pos.sqrtPriceX96, pos.tickLower, pos.tickUpper, inputSide, parseUnits(amountText, inputDecimals));
      amount0 = calculated.amount0;
      amount1 = calculated.amount1;
    }
  } catch { /* User is still typing. */ }

  useEffect(() => {
    let live = true;
    const client = getPublicClient(config, { chainId });
    if (!client) return;
    Promise.all([
      client.readContract({ address: pos.token0, abi: erc20Abi, functionName: 'balanceOf', args: [account] }).catch(() => 0n),
      client.readContract({ address: pos.token1, abi: erc20Abi, functionName: 'balanceOf', args: [account] }).catch(() => 0n),
      client.getBalance({ address: account }).catch(() => 0n),
    ]).then(([b0, b1, native]) => { if (live) { setBalance0(b0); setBalance1(b1); setEthBalance(native); } });
    return () => { live = false; };
  }, [account, chainId, config, pos.token0, pos.token1]);

  const effective0 = ethMode && wethSide === 0 ? ethBalance : balance0;
  const effective1 = ethMode && wethSide === 1 ? ethBalance : balance1;
  const inputBalance = inputSide === 0 ? effective0 : effective1;
  const short0 = amount0 > effective0;
  const short1 = amount1 > effective1;
  const canAdd = (amount0 > 0n || amount1 > 0n) && !short0 && !short1;

  async function add() {
    if (!canAdd || busy) return;
    setBusy(true); setError(null);
    try {
      const calls = buildIncrease(pos, amount0, amount1, slippageBps, ethMode ? wethSide : null, deployment);
      await runCalls(config, { account, chainId, calls, label: `Add more to ${pos.symbol0}/${pos.symbol1}`, track });
      await onDone();
    } catch (cause) {
      const value = cause as { shortMessage?: string; message?: string };
      setError(value.shortMessage ?? value.message ?? 'Could not add liquidity');
    } finally { setBusy(false); }
  }

  return <Portal>
    <div onClick={busy ? undefined : onClose} style={{ position: 'fixed', inset: 0, left: sidebarWidth, zIndex: 350, display: 'grid', placeItems: 'center', padding: 18, background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(9px)' }}>
      <div onClick={(event) => event.stopPropagation()} style={{ width: '100%', maxWidth: 460, borderRadius: 24, padding: 18, boxSizing: 'border-box', background: '#0b0b10', border: btb.border, boxShadow: '0 24px 80px rgba(0,0,0,.55)' }}>
        <div style={{ color: btb.text, fontSize: 19, fontWeight: 850 }}>Add more liquidity</div>
        <div style={{ color: btb.textMuted, fontSize: 12, marginTop: 4 }}>{pos.symbol0} / {pos.symbol1} · NFT #{pos.id.toString()}</div>

        <Glass padding={11} radius={13} soft style={{ marginTop: 14 }}>
          <div style={{ color: btb.green, fontSize: 11, fontWeight: 750 }}>Automation stays on</div>
          <div style={{ color: btb.textMuted, fontSize: 10.5, lineHeight: 1.45, marginTop: 2 }}>New funds join this position. Its range, agent limits and ownership do not change.</div>
        </Glass>

        {wethSide !== null && <button onClick={() => setUseEth(value => !value)} style={{ width: '100%', marginTop: 12, height: 38, padding: '0 11px', borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: btb.borderSoft, background: 'rgba(255,255,255,.035)', color: btb.text, fontFamily: 'inherit', cursor: 'pointer' }}>
          <span style={{ fontSize: 11.5, fontWeight: 700 }}>Pay with {useEth ? 'ETH' : 'WETH'}</span>
          <span style={{ color: btb.green, fontSize: 10.5 }}>Switch</span>
        </button>}

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 14, marginBottom: 6 }}>
          <span style={{ color: btb.textMuted, fontSize: 11.5 }}>{inputSymbol} amount{side === 'both' ? ' · pair calculated' : ''}</span>
          <button onClick={() => setAmountText(formatUnits(inputBalance, inputDecimals))} style={{ border: 'none', padding: 0, background: 'transparent', color: btb.green, fontFamily: 'inherit', fontSize: 11, fontWeight: 750, cursor: 'pointer' }}>Balance {fmt(inputBalance, inputDecimals)} · MAX</button>
        </div>
        <input value={amountText} onChange={(event) => setAmountText(event.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" placeholder="0" autoFocus style={{ width: '100%', height: 52, boxSizing: 'border-box', borderRadius: 14, padding: '0 14px', outline: 'none', border: btb.borderSoft, background: 'rgba(255,255,255,.055)', color: btb.text, fontFamily: 'inherit', fontSize: 21, fontWeight: 750 }}/>
        {(amount0 > 0n || amount1 > 0n) && <div style={{ marginTop: 9, color: btb.textMuted, fontSize: 11.5 }}>Adds {fmt(amount0, pos.decimals0)} {symbol0} + {fmt(amount1, pos.decimals1)} {symbol1}</div>}
        {(short0 || short1) && <div style={{ marginTop: 8, color: btb.loss, fontSize: 11.5 }}>Insufficient {short0 ? symbol0 : symbol1}</div>}
        {!pos.inRange && <div style={{ marginTop: 8, color: btb.amber, fontSize: 10.5 }}>The position is out of range, so only {inputSymbol} is needed right now.</div>}
        {error && <div style={{ color: btb.loss, fontSize: 11.5, lineHeight: 1.4, marginTop: 9 }}>{error}</div>}

        <Button variant="success" size="md" onClick={add} disabled={!canAdd || busy} style={{ width: '100%', marginTop: 15 }}>{busy ? 'Adding…' : 'Add to position'}</Button>
        <Button variant="ghost" size="sm" onClick={onClose} disabled={busy} style={{ width: '100%', marginTop: 7 }}>Cancel</Button>
        <div style={{ color: btb.textDim, textAlign: 'center', fontSize: 9.5, marginTop: 7 }}>Approvals and the liquidity increase are prepared together. Up to {slippageBps / 100}% protection.</div>
      </div>
    </div>
  </Portal>;
}
