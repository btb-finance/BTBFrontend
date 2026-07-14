'use client';

import { useEffect, useState } from 'react';
import { useConfig } from 'wagmi';
import { getPublicClient } from 'wagmi/actions';
import { encodeFunctionData, erc20Abi, formatUnits, parseUnits, type PublicClient } from 'viem';
import { Portal } from './Portal';
import { Glass } from './Glass';
import { Button } from './Button';
import { btb } from './design-tokens';
import { useSidebar } from '../lib/SidebarContext';
import { useTx } from '../lib/TxTracker';
import { runCalls } from '../lib/txRunner';
import { buildSwapGap } from '../lib/swapGap';
import { wrapEthCall } from '../lib/smartAccount';
import {
  addSide, buildIncrease, getAmountsForLiquidity, isWeth, liquidityForAmounts, rebalancePlan,
  ROBINHOOD_QUOTER_V2, ROBINHOOD_SWAP_ROUTER_02, ROBINHOOD_UNISWAP_V3_DEPLOYMENT,
  ROBINHOOD_WETH, SLIPPAGE_BPS, UNISWAP_V3_DEPLOYMENT, type LiquidityPosition,
} from '@/protocols/dexs/uniswap';

const QUOTER_ABI = [{ type: 'function', name: 'quoteExactInputSingle', stateMutability: 'nonpayable', inputs: [{ name: 'params', type: 'tuple', components: [{ name: 'tokenIn', type: 'address' }, { name: 'tokenOut', type: 'address' }, { name: 'amountIn', type: 'uint256' }, { name: 'fee', type: 'uint24' }, { name: 'sqrtPriceLimitX96', type: 'uint160' }] }], outputs: [{ name: 'amountOut', type: 'uint256' }, { name: 'sqrtPriceX96After', type: 'uint160' }, { name: 'initializedTicksCrossed', type: 'uint32' }, { name: 'gasEstimate', type: 'uint256' }] }] as const;
const ROUTER02_ABI = [{ type: 'function', name: 'exactInputSingle', stateMutability: 'payable', inputs: [{ name: 'params', type: 'tuple', components: [{ name: 'tokenIn', type: 'address' }, { name: 'tokenOut', type: 'address' }, { name: 'fee', type: 'uint24' }, { name: 'recipient', type: 'address' }, { name: 'amountIn', type: 'uint256' }, { name: 'amountOutMinimum', type: 'uint256' }, { name: 'sqrtPriceLimitX96', type: 'uint160' }] }], outputs: [{ name: 'amountOut', type: 'uint256' }] }] as const;

async function robinhoodSwap(client: PublicClient, pos: LiquidityPosition, sellSide: 0 | 1, amountIn: bigint, account: `0x${string}`, slippageBps: number) {
  const tokenIn = sellSide === 0 ? pos.token0 : pos.token1;
  const tokenOut = sellSide === 0 ? pos.token1 : pos.token0;
  const quote = await client.simulateContract({ address: ROBINHOOD_QUOTER_V2, abi: QUOTER_ABI, functionName: 'quoteExactInputSingle', args: [{ tokenIn, tokenOut, amountIn, fee: pos.fee, sqrtPriceLimitX96: 0n }] });
  const expectedOut = (quote.result as readonly [bigint, bigint, number, bigint])[0];
  const amountOutMinimum = expectedOut * BigInt(10_000 - slippageBps) / 10_000n;
  return [
    { to: tokenIn, data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [ROBINHOOD_SWAP_ROUTER_02, amountIn] }) },
    { to: ROBINHOOD_SWAP_ROUTER_02, data: encodeFunctionData({ abi: ROUTER02_ABI, functionName: 'exactInputSingle', args: [{ tokenIn, tokenOut, fee: pos.fee, recipient: account, amountIn, amountOutMinimum, sqrtPriceLimitX96: 0n }] }) },
  ];
}

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
  const [fundSide, setFundSide] = useState<0 | 1>(wethSide ?? inputSide);
  const [useEth, setUseEth] = useState(wethSide !== null);
  const ethMode = wethSide === fundSide && useEth;
  const inputDecimals = fundSide === 0 ? pos.decimals0 : pos.decimals1;
  const inputSymbol = ethMode ? 'ETH' : fundSide === 0 ? pos.symbol0 : pos.symbol1;
  let inputAmount = 0n;
  try { if (amountText && Number(amountText) > 0) inputAmount = parseUnits(amountText, inputDecimals); } catch { /* typing */ }
  const starting0 = fundSide === 0 ? inputAmount : 0n;
  const starting1 = fundSide === 1 ? inputAmount : 0n;
  const plan = rebalancePlan(pos.sqrtPriceX96, pos.tickLower, pos.tickUpper, starting0, starting1);
  const swapPct = plan.sellSide === null ? 0 : Math.round(plan.swapFraction * 1000) / 10;

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

  const inputBalance = ethMode ? ethBalance : fundSide === 0 ? balance0 : balance1;
  const insufficient = inputAmount > inputBalance;
  const canAdd = inputAmount > 0n && !insufficient;

  async function add() {
    if (!canAdd || busy) return;
    setBusy(true); setError(null);
    try {
      const client = getPublicClient(config, { chainId });
      if (!client) throw new Error('No RPC client');
      const readBalances = async (): Promise<[bigint, bigint]> => {
        const [b0, b1] = await Promise.all([
          client.readContract({ address: pos.token0, abi: erc20Abi, functionName: 'balanceOf', args: [account] }),
          client.readContract({ address: pos.token1, abi: erc20Abi, functionName: 'balanceOf', args: [account] }),
        ]);
        return [b0, b1];
      };
      const before = await readBalances();
      let budget0 = starting0, budget1 = starting1;
      const prepCalls = ethMode ? [wrapEthCall((fundSide === 0 ? pos.token0 : pos.token1), inputAmount)!] : [];

      if (plan.sellSide !== null && plan.swapFraction > 0.0005) {
        const sellBudget = plan.sellSide === 0 ? budget0 : budget1;
        const sellRaw = sellBudget * BigInt(Math.min(10_000, Math.max(0, Math.round(plan.swapFraction * 10_000)))) / 10_000n;
        if (sellRaw > 0n) {
          const swapCalls = chainId === 4663
            ? await robinhoodSwap(client, pos, plan.sellSide, sellRaw, account, slippageBps)
            : (await buildSwapGap({ sellSide: plan.sellSide, swapFraction: plan.swapFraction, budget0, budget1, token0: pos.token0, token1: pos.token1, decimals0: pos.decimals0, decimals1: pos.decimals1, native0: false, account, slippageBps }))?.calls ?? [];
          prepCalls.push(...swapCalls);
          await runCalls(config, { account, chainId, calls: prepCalls, label: `Balance ${pos.symbol0}/${pos.symbol1} for the range`, track });
          const after = await readBalances();
          if (plan.sellSide === 0) {
            budget0 = inputAmount - sellRaw;
            budget1 = after[1] > before[1] ? after[1] - before[1] : 0n;
          } else {
            budget1 = inputAmount - sellRaw;
            budget0 = after[0] > before[0] ? after[0] - before[0] : 0n;
          }
        }
      } else if (prepCalls.length) {
        await runCalls(config, { account, chainId, calls: prepCalls, label: `Wrap ETH for ${pos.symbol0}/${pos.symbol1}`, track });
      }

      const live = await readBalances();
      budget0 = budget0 < live[0] ? budget0 : live[0];
      budget1 = budget1 < live[1] ? budget1 : live[1];
      const liquidity = liquidityForAmounts(pos.sqrtPriceX96, pos.tickLower, pos.tickUpper, budget0, budget1);
      const amounts = getAmountsForLiquidity(pos.sqrtPriceX96, pos.tickLower, pos.tickUpper, liquidity);
      if (amounts[0] === 0n && amounts[1] === 0n) throw new Error('The amount is too small to add to this range');
      const calls = buildIncrease(pos, amounts[0], amounts[1], slippageBps, null, deployment);
      await runCalls(config, { account, chainId, calls, label: `Increase ${pos.symbol0}/${pos.symbol1} position`, track });
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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginTop: 12 }}>
          {([0, 1] as const).map(sideIndex => <button key={sideIndex} onClick={() => { setFundSide(sideIndex); setUseEth(sideIndex === wethSide); setAmountText(''); }} style={{ height: 39, borderRadius: 11, border: fundSide === sideIndex ? '1px solid rgba(82,227,164,.48)' : btb.borderSoft, background: fundSide === sideIndex ? 'rgba(82,227,164,.11)' : 'rgba(255,255,255,.035)', color: fundSide === sideIndex ? btb.green : btb.textMuted, fontFamily: 'inherit', fontSize: 11.5, fontWeight: 750, cursor: 'pointer' }}>Fund with {sideIndex === wethSide ? (useEth && fundSide === sideIndex ? 'ETH' : 'WETH') : sideIndex === 0 ? pos.symbol0 : pos.symbol1}</button>)}
        </div>
        {fundSide === wethSide && <button onClick={() => { setUseEth(value => !value); setAmountText(''); }} style={{ border: 'none', display: 'block', margin: '7px 0 0 auto', padding: 0, background: 'transparent', color: btb.green, fontFamily: 'inherit', fontSize: 10.5, fontWeight: 700, cursor: 'pointer' }}>Use {useEth ? 'WETH' : 'ETH'} instead</button>}

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 14, marginBottom: 6 }}>
          <span style={{ color: btb.textMuted, fontSize: 11.5 }}>{inputSymbol} amount</span>
          <button onClick={() => setAmountText(formatUnits(inputBalance, inputDecimals))} style={{ border: 'none', padding: 0, background: 'transparent', color: btb.green, fontFamily: 'inherit', fontSize: 11, fontWeight: 750, cursor: 'pointer' }}>Balance {fmt(inputBalance, inputDecimals)} · MAX</button>
        </div>
        <input value={amountText} onChange={(event) => setAmountText(event.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" placeholder="0" autoFocus style={{ width: '100%', height: 52, boxSizing: 'border-box', borderRadius: 14, padding: '0 14px', outline: 'none', border: btb.borderSoft, background: 'rgba(255,255,255,.055)', color: btb.text, fontFamily: 'inherit', fontSize: 21, fontWeight: 750 }}/>
        {inputAmount > 0n && swapPct > 0 && <div style={{ marginTop: 9, color: btb.textMuted, fontSize: 11.5 }}>Swap only ~{swapPct}% to {plan.sellSide === 0 ? pos.symbol1 : pos.symbol0}, then add both sides.</div>}
        {inputAmount > 0n && swapPct === 0 && <div style={{ marginTop: 9, color: btb.textMuted, fontSize: 11.5 }}>No swap needed for this range.</div>}
        {insufficient && <div style={{ marginTop: 8, color: btb.loss, fontSize: 11.5 }}>Insufficient {inputSymbol}</div>}
        {!pos.inRange && <div style={{ marginTop: 8, color: btb.amber, fontSize: 10.5 }}>This range currently needs only one token; any unnecessary side is converted first.</div>}
        {error && <div style={{ color: btb.loss, fontSize: 11.5, lineHeight: 1.4, marginTop: 9 }}>{error}</div>}

        <Button variant="success" size="md" onClick={add} disabled={!canAdd || busy} style={{ width: '100%', marginTop: 15 }}>{busy ? 'Adding…' : 'Add to position'}</Button>
        <Button variant="ghost" size="sm" onClick={onClose} disabled={busy} style={{ width: '100%', marginTop: 7 }}>Cancel</Button>
        <div style={{ color: btb.textDim, textAlign: 'center', fontSize: 9.5, marginTop: 7 }}>Swap only the range gap, then increase this NFT. Up to {slippageBps / 100}% protection.</div>
      </div>
    </div>
  </Portal>;
}
