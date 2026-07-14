'use client';

import { useMemo, useState } from 'react';
import { useConfig } from 'wagmi';
import { getPublicClient } from 'wagmi/actions';
import { encodeAbiParameters, encodeFunctionData, formatUnits, zeroAddress } from 'viem';
import { Portal } from './Portal';
import { Glass } from './Glass';
import { Button } from './Button';
import { btb } from './design-tokens';
import { useSidebar } from '../lib/SidebarContext';
import { useTx } from '../lib/TxTracker';
import { runCalls } from '../lib/txRunner';
import { BTB_LP_ACCOUNT_ABI, type RebalancePolicy } from '../lib/smartAccount';
import {
  fetchV3Positions, getAmountsForLiquidity, heldHeavyRange, liquidityForAmounts,
  rangeTicks, rebalancePlan, ROBINHOOD_QUOTER_V2, ROBINHOOD_UNISWAP_V3_DEPLOYMENT,
  type LiquidityPosition,
} from '@/protocols/dexs/uniswap';

const QUOTER_ABI = [{ type: 'function', name: 'quoteExactInputSingle', stateMutability: 'nonpayable', inputs: [{ name: 'params', type: 'tuple', components: [{ name: 'tokenIn', type: 'address' }, { name: 'tokenOut', type: 'address' }, { name: 'amountIn', type: 'uint256' }, { name: 'fee', type: 'uint24' }, { name: 'sqrtPriceLimitX96', type: 'uint160' }] }], outputs: [{ name: 'amountOut', type: 'uint256' }, { name: 'sqrtPriceX96After', type: 'uint160' }, { name: 'initializedTicksCrossed', type: 'uint32' }, { name: 'gasEstimate', type: 'uint256' }] }] as const;
const WIDTHS = [5, 10, 25] as const;
const SLIPPAGE_BPS = 500n;

function amount(raw: bigint, decimals: number) {
  const n = Number(formatUnits(raw, decimals));
  return n === 0 ? '0' : n.toLocaleString('en-US', { maximumFractionDigits: 5 });
}

export function ManagedRebalanceSheet({ pos, smartAccount, owner, policy, onClose, onDone }: {
  pos: LiquidityPosition;
  smartAccount: `0x${string}`;
  owner: `0x${string}`;
  policy: RebalancePolicy;
  onClose: () => void;
  onDone: () => void | Promise<void>;
}) {
  const config = useConfig();
  const { track } = useTx();
  const { width: sidebarWidth } = useSidebar();
  const [widthPct, setWidthPct] = useState<number>(10);
  const [strategy, setStrategy] = useState<'keep' | 'balanced'>('keep');
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const spacing = ROBINHOOD_UNISWAP_V3_DEPLOYMENT.tickSpacings[pos.fee] ?? 60;
  const holdings0 = pos.amount0 + pos.fees0;
  const holdings1 = pos.amount1 + pos.fees1;
  const heavySide: 0 | 1 = Number(holdings0) * (Number(pos.sqrtPriceX96) / 2 ** 96) ** 2 >= Number(holdings1) ? 0 : 1;
  const previewRange = useMemo(() => {
    const centered = rangeTicks(pos.currentTick, spacing, widthPct);
    const candidate = strategy === 'balanced' ? centered : heldHeavyRange(pos.currentTick, spacing, centered.tickUpper - centered.tickLower, heavySide);
    return {
      tickLower: Math.max(candidate.tickLower, policy.minimumAllowedTick),
      tickUpper: Math.min(candidate.tickUpper, policy.maximumAllowedTick),
    };
  }, [pos.currentTick, spacing, widthPct, strategy, heavySide, policy.minimumAllowedTick, policy.maximumAllowedTick]);

  async function rebalance() {
    setRunning(true); setErr(null);
    try {
      const client = getPublicClient(config, { chainId: 4663 });
      if (!client) throw new Error('Robinhood RPC is unavailable');
      const live = (await fetchV3Positions(client, smartAccount, ROBINHOOD_UNISWAP_V3_DEPLOYMENT, [pos.id]))[0];
      if (!live) throw new Error('This position is no longer held by your smart account');

      const centered = rangeTicks(live.currentTick, spacing, widthPct);
      const candidate = strategy === 'balanced' ? centered : heldHeavyRange(live.currentTick, spacing, centered.tickUpper - centered.tickLower, heavySide);
      const tickLower = Math.max(candidate.tickLower, policy.minimumAllowedTick);
      const tickUpper = Math.min(candidate.tickUpper, policy.maximumAllowedTick);
      if (tickLower >= tickUpper) throw new Error('This range is outside your automation rules. Expand the allowed range first.');

      // Performance fee applies only to collected fees, never principal.
      const netFee0 = live.fees0 * BigInt(10_000 - policy.performanceFeeBps) / 10_000n;
      const netFee1 = live.fees1 * BigInt(10_000 - policy.performanceFeeBps) / 10_000n;
      let budget0 = live.amount0 + netFee0;
      let budget1 = live.amount1 + netFee1;
      const plan = rebalancePlan(live.sqrtPriceX96, tickLower, tickUpper, budget0, budget1);

      let tokenIn: `0x${string}` = zeroAddress;
      let tokenOut: `0x${string}` = zeroAddress;
      let amountIn = 0n;
      let quotedMinimumOut = 0n;
      let expectedOut = 0n;
      let swapData: `0x${string}` = '0x';
      if (plan.sellSide !== null && plan.swapFraction > 0.0005) {
        tokenIn = plan.sellSide === 0 ? live.token0 : live.token1;
        tokenOut = plan.sellSide === 0 ? live.token1 : live.token0;
        const inputBudget = plan.sellSide === 0 ? budget0 : budget1;
        const planned = inputBudget * BigInt(Math.round(plan.swapFraction * 10_000)) / 10_000n;
        const policyPctCap = inputBudget * BigInt(policy.maxSwapBpsOfPosition) / 10_000n;
        const absoluteCap = plan.sellSide === 0 ? policy.maximumToken0PerExecution : policy.maximumToken1PerExecution;
        amountIn = planned < policyPctCap ? planned : policyPctCap;
        if (amountIn > absoluteCap) amountIn = absoluteCap;
        if (amountIn > 0n) {
          const quote = await client.simulateContract({ address: ROBINHOOD_QUOTER_V2, abi: QUOTER_ABI, functionName: 'quoteExactInputSingle', args: [{ tokenIn, tokenOut, amountIn, fee: live.fee, sqrtPriceLimitX96: 0n }] });
          expectedOut = (quote.result as readonly [bigint, bigint, number, bigint])[0];
          quotedMinimumOut = expectedOut * (10_000n - SLIPPAGE_BPS) / 10_000n;
          swapData = encodeAbiParameters([{ type: 'uint24' }, { type: 'uint160' }], [live.fee, 0n]);
          if (plan.sellSide === 0) { budget0 -= amountIn; budget1 += expectedOut; }
          else { budget1 -= amountIn; budget0 += expectedOut; }
        } else { tokenIn = zeroAddress; tokenOut = zeroAddress; }
      }

      const liquidity = liquidityForAmounts(live.sqrtPriceX96, tickLower, tickUpper, budget0, budget1);
      const [mint0, mint1] = getAmountsForLiquidity(live.sqrtPriceX96, tickLower, tickUpper, liquidity);
      const nonce = await client.readContract({ address: smartAccount, abi: BTB_LP_ACCOUNT_ABI, functionName: 'nextNonce' });
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
      const min = (v: bigint) => v * (10_000n - SLIPPAGE_BPS) / 10_000n;
      const request = {
        newTickLower: tickLower, newTickUpper: tickUpper, tokenIn, tokenOut, amountIn, quotedMinimumOut,
        removeAmount0Min: min(live.amount0), removeAmount1Min: min(live.amount1),
        mintAmount0Min: min(mint0), mintAmount1Min: min(mint1), deadline, nonce,
      };
      await runCalls(config, {
        account: owner, chainId: 4663, label: `Rebalance ${live.symbol0}/${live.symbol1} in one transaction`, track,
        calls: [{ to: smartAccount, data: encodeFunctionData({ abi: BTB_LP_ACCOUNT_ABI, functionName: 'rebalance', args: [ROBINHOOD_UNISWAP_V3_DEPLOYMENT.positionManager, live.id, request, swapData] }) }],
      });
      setDone(true);
      await onDone();
    } catch (e) {
      setErr((e as { shortMessage?: string })?.shortMessage ?? (e as Error)?.message ?? 'Rebalance failed');
    } finally { setRunning(false); }
  }

  return <Portal>
    <div onClick={running ? undefined : onClose} style={{ position: 'fixed', inset: 0, left: sidebarWidth, zIndex: 340, background: 'rgba(0,0,0,.68)', backdropFilter: 'blur(8px)', display: 'grid', placeItems: 'center', padding: 18 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 460, borderRadius: 24, padding: 18, background: '#0b0b10', border: btb.border, boxShadow: '0 24px 80px rgba(0,0,0,.55)' }}>
        <div style={{ color: btb.text, fontSize: 19, fontWeight: 850 }}>{done ? 'Position rebalanced' : 'Rebalance it yourself'}</div>
        <div style={{ color: btb.textMuted, fontSize: 12, marginTop: 4 }}>{pos.symbol0} / {pos.symbol1} · one owner-signed transaction</div>
        {!done && <>
          <Glass padding={12} radius={14} soft style={{ marginTop: 14 }}>
            <div style={{ color: btb.textMuted, fontSize: 11 }}>Position funds</div>
            <div style={{ color: btb.text, fontWeight: 750, marginTop: 3 }}>{amount(holdings0, pos.decimals0)} {pos.symbol0} + {amount(holdings1, pos.decimals1)} {pos.symbol1}</div>
          </Glass>
          <div style={{ color: btb.textMuted, fontSize: 11, marginTop: 14 }}>Strategy</div>
          <div style={{ display: 'flex', gap: 7, marginTop: 6 }}>
            <Button size="sm" variant={strategy === 'keep' ? 'success' : 'ghost'} onClick={() => setStrategy('keep')}>Keep my {heavySide === 0 ? pos.symbol0 : pos.symbol1}</Button>
            <Button size="sm" variant={strategy === 'balanced' ? 'success' : 'ghost'} onClick={() => setStrategy('balanced')}>Balanced</Button>
          </div>
          <div style={{ color: btb.textMuted, fontSize: 11, marginTop: 14 }}>New range width</div>
          <div style={{ display: 'flex', gap: 7, marginTop: 6 }}>{WIDTHS.map((w) => <Button key={w} size="sm" variant={widthPct === w ? 'success' : 'ghost'} onClick={() => setWidthPct(w)}>±{w}%</Button>)}</div>
          <div style={{ color: btb.textDim, fontSize: 10.5, marginTop: 10 }}>Ticks {previewRange.tickLower} → {previewRange.tickUpper} · 5% swap protection · unused amount returns to your wallet</div>
          {err && <div style={{ color: btb.loss, fontSize: 11.5, lineHeight: 1.45, marginTop: 10 }}>{err}</div>}
          <Button variant="success" size="md" disabled={running} onClick={rebalance} style={{ width: '100%', marginTop: 16 }}>{running ? 'Building and checking transaction…' : 'Rebalance now'}</Button>
        </>}
        <Button variant="ghost" size="sm" disabled={running} onClick={onClose} style={{ width: '100%', marginTop: 8 }}>{done ? 'Close' : 'Cancel'}</Button>
      </div>
    </div>
  </Portal>;
}
