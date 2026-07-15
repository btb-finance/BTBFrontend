'use client';

import { useEffect, useState } from 'react';
import { useConfig } from 'wagmi';
import { useAction } from 'convex/react';
import { getPublicClient } from 'wagmi/actions';
import {
  encodeAbiParameters, encodeFunctionData, encodePacked, erc20Abi, formatUnits, parseUnits,
  zeroAddress, type Hex, type PublicClient,
} from 'viem';
import { Portal } from './Portal';
import { Glass } from './Glass';
import { Button } from './Button';
import { btb } from './design-tokens';
import { useSidebar } from '../lib/SidebarContext';
import { useTx } from '../lib/TxTracker';
import { runCalls } from '../lib/txRunner';
import { buildSwapGap } from '../lib/swapGap';
import {
  BTB_AGENT_REGISTRY_ABI, BTB_LP_QUOTER_ABI, EMPTY_FRESH_SWAP_ARGS, EMPTY_ZAP_LEG, INCREASE_FROM_ACCOUNT_SELECTOR,
  approvalCall, cancelInstructionCall, configureSelfAgentCall, depositTokenCall, encodeIncreaseZapRequest,
  isModularDeployment, minWithSlippage, scheduleSingleInstructionCall,
  wrapEthCall, type SmartAccountDeployment,
} from '../lib/smartAccount';
import {
  addSide, buildIncrease, getAmountsForLiquidity, isWeth, liquidityForAmounts, rebalancePlan,
  ROBINHOOD_QUOTER_V2, ROBINHOOD_SWAP_ROUTER_02, ROBINHOOD_UNISWAP_V3_DEPLOYMENT,
  ROBINHOOD_WETH, SLIPPAGE_BPS, UNISWAP_V3_DEPLOYMENT, type LiquidityPosition,
} from '@/protocols/dexs/uniswap';
import { api } from '../../convex/_generated/api';

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

async function robinhoodSwapPayload(
  client: PublicClient, pos: LiquidityPosition, sellSide: 0 | 1, amountIn: bigint,
  adapter: `0x${string}`, slippageBps: number,
): Promise<{ expectedOut: bigint; minimumOut: bigint; adapterData: Hex }> {
  const tokenIn = sellSide === 0 ? pos.token0 : pos.token1;
  const tokenOut = sellSide === 0 ? pos.token1 : pos.token0;
  const quote = await client.simulateContract({ address: ROBINHOOD_QUOTER_V2, abi: QUOTER_ABI, functionName: 'quoteExactInputSingle', args: [{ tokenIn, tokenOut, amountIn, fee: pos.fee, sqrtPriceLimitX96: 0n }] });
  const expectedOut = (quote.result as readonly [bigint, bigint, number, bigint])[0];
  const minimumOut = minWithSlippage(expectedOut, slippageBps);
  const routerCalldata = encodeFunctionData({
    abi: ROUTER02_ABI, functionName: 'exactInputSingle',
    args: [{ tokenIn, tokenOut, fee: pos.fee, recipient: adapter, amountIn, amountOutMinimum: minimumOut, sqrtPriceLimitX96: 0n }],
  });
  return {
    expectedOut,
    minimumOut,
    adapterData: encodeAbiParameters([{ type: 'address' }, { type: 'bytes' }], [ROBINHOOD_SWAP_ROUTER_02, routerCalldata]),
  };
}

function fmt(raw: bigint, decimals: number) {
  const value = Number(formatUnits(raw, decimals));
  if (!value) return '0';
  if (value < 0.0001) return '<0.0001';
  return value.toLocaleString('en-US', { maximumFractionDigits: 5 });
}

export function ManagedAddLiquiditySheet({ pos, pool, owner, smartAccount, smartDeployment, onClose, onDone }: {
  pos: LiquidityPosition;
  pool?: `0x${string}`;
  owner: `0x${string}`;
  smartAccount: `0x${string}`;
  smartDeployment: SmartAccountDeployment;
  onClose: () => void;
  onDone: () => void | Promise<void>;
}) {
  const config = useConfig();
  const { track } = useTx();
  const executeAgentZap = useAction(api.zapAgent.execute);
  const { width: sidebarWidth } = useSidebar();
  const [amountText, setAmountText] = useState('');
  const [balance0, setBalance0] = useState(0n);
  const [balance1, setBalance1] = useState(0n);
  const [ethBalance, setEthBalance] = useState(0n);
  const [accountBalance0, setAccountBalance0] = useState(0n);
  const [accountBalance1, setAccountBalance1] = useState(0n);
  const [reserved0, setReserved0] = useState(0n);
  const [reserved1, setReserved1] = useState(0n);
  const [pendingReservations, setPendingReservations] = useState<{ id: bigint; token: `0x${string}`; amount: bigint; expiresAt: bigint }[]>([]);
  const [fundSource, setFundSource] = useState<'wallet' | 'account'>('wallet');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rangeQuote, setRangeQuote] = useState<{ amount0: bigint; amount1: bigint; liquidity: bigint; swapPct: number } | null>(null);

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
  const ethMode = fundSource === 'wallet' && wethSide === fundSide && useEth;
  const inputDecimals = fundSide === 0 ? pos.decimals0 : pos.decimals1;
  const inputSymbol = ethMode ? 'ETH' : fundSide === 0 ? pos.symbol0 : pos.symbol1;
  let inputAmount = 0n;
  try { if (amountText && Number(amountText) > 0) inputAmount = parseUnits(amountText, inputDecimals); } catch { /* typing */ }
  const starting0 = fundSide === 0 ? inputAmount : 0n;
  const starting1 = fundSide === 1 ? inputAmount : 0n;
  const plan = rebalancePlan(pos.sqrtPriceX96, pos.tickLower, pos.tickUpper, starting0, starting1);
  const swapPct = plan.sellSide === null ? 0 : Math.round(plan.swapFraction * 1000) / 10;
  const usesBtbQuoter = chainId === 4663 && isModularDeployment(smartDeployment) && !!smartDeployment.quoter && !!pool;

  useEffect(() => {
    let live = true;
    const client = getPublicClient(config, { chainId });
    if (!client) return;
    Promise.all([
      client.readContract({ address: pos.token0, abi: erc20Abi, functionName: 'balanceOf', args: [owner] }).catch(() => 0n),
      client.readContract({ address: pos.token1, abi: erc20Abi, functionName: 'balanceOf', args: [owner] }).catch(() => 0n),
      client.getBalance({ address: owner }).catch(() => 0n),
      client.readContract({ address: pos.token0, abi: erc20Abi, functionName: 'balanceOf', args: [smartAccount] }).catch(() => 0n),
      client.readContract({ address: pos.token1, abi: erc20Abi, functionName: 'balanceOf', args: [smartAccount] }).catch(() => 0n),
      smartDeployment.agentRegistry ? client.readContract({ address: smartDeployment.agentRegistry, abi: BTB_AGENT_REGISTRY_ABI, functionName: 'reservedBalance', args: [smartAccount, pos.token0] }).catch(() => 0n) : 0n,
      smartDeployment.agentRegistry ? client.readContract({ address: smartDeployment.agentRegistry, abi: BTB_AGENT_REGISTRY_ABI, functionName: 'reservedBalance', args: [smartAccount, pos.token1] }).catch(() => 0n) : 0n,
      smartDeployment.agentRegistry ? client.readContract({ address: smartDeployment.agentRegistry, abi: BTB_AGENT_REGISTRY_ABI, functionName: 'nextInstructionId', args: [smartAccount] }).catch(() => 0n) : 0n,
    ]).then(async ([b0, b1, native, smart0, smart1, held0, held1, nextId]) => {
      if (!live) return;
      setBalance0(b0); setBalance1(b1); setEthBalance(native);
      setAccountBalance0(smart0); setAccountBalance1(smart1); setReserved0(held0); setReserved1(held1);
      if (!smartDeployment.agentRegistry || nextId === 0n) { setPendingReservations([]); return; }
      const first = nextId > 50n ? nextId - 50n : 0n;
      const rows = await Promise.all(Array.from({ length: Number(nextId - first) }, (_, index) => {
        const id = first + BigInt(index);
        return client.readContract({ address: smartDeployment.agentRegistry!, abi: BTB_AGENT_REGISTRY_ABI, functionName: 'instructions', args: [smartAccount, id] })
          .then(instruction => ({ id, instruction })).catch(() => null);
      }));
      if (live) setPendingReservations(rows.flatMap(row => {
        if (!row || !row.instruction[0] || Number(row.instruction[8]) !== 8) return [];
        return [{ id: row.id, token: row.instruction[2], amount: row.instruction[3], expiresAt: row.instruction[7] }];
      }));
    });
    return () => { live = false; };
  }, [owner, chainId, config, pos.token0, pos.token1, smartAccount, smartDeployment.agentRegistry]);

  useEffect(() => {
    setRangeQuote(null);
    const quoter = smartDeployment.quoter;
    if (chainId !== 4663 || !isModularDeployment(smartDeployment) || !quoter || !pool || inputAmount === 0n) return;
    let live = true;
    const timer = window.setTimeout(async () => {
      try {
        const client = getPublicClient(config, { chainId });
        if (!client) return;
        const planned = await client.readContract({
          address: quoter, abi: BTB_LP_QUOTER_ABI, functionName: 'previewSwapToRange',
          args: [pool, pos.tickLower, pos.tickUpper, starting0, starting1],
        });
        const sellSide: 0 | 1 | null = planned.tokenIn.toLowerCase() === pos.token0.toLowerCase()
          ? 0 : planned.tokenIn.toLowerCase() === pos.token1.toLowerCase() ? 1 : null;
        const sellAmount = sellSide === fundSide ? planned.amountIn : 0n;
        let have0 = starting0;
        let have1 = starting1;
        if (sellSide !== null && sellAmount > 0n) {
          const tokenIn = sellSide === 0 ? pos.token0 : pos.token1;
          const tokenOut = sellSide === 0 ? pos.token1 : pos.token0;
          const swap = await client.simulateContract({
            address: ROBINHOOD_QUOTER_V2, abi: QUOTER_ABI, functionName: 'quoteExactInputSingle',
            args: [{ tokenIn, tokenOut, amountIn: sellAmount, fee: pos.fee, sqrtPriceLimitX96: 0n }],
          });
          const amountOut = (swap.result as readonly [bigint, bigint, number, bigint])[0];
          if (sellSide === 0) { have0 -= sellAmount; have1 += amountOut; }
          else { have1 -= sellAmount; have0 += amountOut; }
        }
        const mint = await client.readContract({
          address: quoter, abi: BTB_LP_QUOTER_ABI, functionName: 'previewMint',
          args: [pool, pos.tickLower, pos.tickUpper, have0, have1],
        });
        if (live) setRangeQuote({ amount0: mint[0], amount1: mint[1], liquidity: mint[2], swapPct: Number(sellAmount * 10_000n / inputAmount) / 100 });
      } catch { if (live) setRangeQuote(null); }
    }, 250);
    return () => { live = false; window.clearTimeout(timer); };
  }, [chainId, config, fundSide, inputAmount, pool, pos.fee, pos.tickLower, pos.tickUpper, pos.token0, pos.token1, smartDeployment, starting0, starting1]);

  const accountAvailable0 = accountBalance0 > reserved0 ? accountBalance0 - reserved0 : 0n;
  const accountAvailable1 = accountBalance1 > reserved1 ? accountBalance1 - reserved1 : 0n;
  const inputBalance = fundSource === 'account'
    ? fundSide === 0 ? accountAvailable0 : accountAvailable1
    : ethMode ? ethBalance : fundSide === 0 ? balance0 : balance1;
  const selectedToken = fundSide === 0 ? pos.token0 : pos.token1;
  const selectedReservations = pendingReservations.filter(item => item.token.toLowerCase() === selectedToken.toLowerCase());
  const insufficient = inputAmount > inputBalance;
  const canAdd = inputAmount > 0n && !insufficient && (!usesBtbQuoter || (rangeQuote !== null && rangeQuote.liquidity >= 1_000n));

  async function add() {
    if (!canAdd || busy) return;
    setBusy(true); setError(null);
    try {
      const client = getPublicClient(config, { chainId });
      if (!client) throw new Error('No RPC client');
      if (chainId === 4663 && isModularDeployment(smartDeployment)) {
        if (!pool || !smartDeployment.quoter) throw new Error('BTB range quoter is not configured for this position');
        const quoter = smartDeployment.quoter;
        const poolFundingToken = fundSide === 0 ? pos.token0 : pos.token1;
        // Native funding goes straight into the smart account. The Zap wraps it
        // internally, removing wrap + approve + deposit from the owner's flow.
        const fundingToken = ethMode ? zeroAddress : poolFundingToken;
        const planned = await client.readContract({
          address: quoter, abi: BTB_LP_QUOTER_ABI, functionName: 'previewSwapToRange',
          args: [pool, pos.tickLower, pos.tickUpper, starting0, starting1],
        });
        const sellSide: 0 | 1 | null = planned.tokenIn.toLowerCase() === pos.token0.toLowerCase()
          ? 0 : planned.tokenIn.toLowerCase() === pos.token1.toLowerCase() ? 1 : null;
        const sellRaw = sellSide === fundSide ? planned.amountIn : 0n;
        const directAmount = inputAmount - sellRaw;
        let leg0 = { ...EMPTY_ZAP_LEG };
        let leg1 = { ...EMPTY_ZAP_LEG };
        let fresh0: Hex = '0x';
        let expected0 = fundSide === 0 ? directAmount : 0n;
        let expected1 = fundSide === 1 ? directAmount : 0n;

        if (sellSide !== null && sellRaw > 0n) {
          const payload = await robinhoodSwapPayload(client, pos, sellSide, sellRaw, smartDeployment.aggregatorSwapAdapter, slippageBps);
          const tokenOut = sellSide === 0 ? pos.token1 : pos.token0;
          leg0 = {
            tokenOut, amountIn: sellRaw, quotedMinimumOut: payload.minimumOut,
            path: encodePacked(['address', 'uint24', 'address'], [poolFundingToken, pos.fee, tokenOut]),
          };
          leg1 = directAmount > 0n ? { tokenOut: poolFundingToken, amountIn: directAmount, quotedMinimumOut: 0n, path: '0x' } : { ...EMPTY_ZAP_LEG };
          fresh0 = payload.adapterData;
          if (sellSide === 0) expected1 = payload.expectedOut;
          else expected0 = payload.expectedOut;
        } else {
          leg0 = { tokenOut: poolFundingToken, amountIn: inputAmount, quotedMinimumOut: 0n, path: '0x' };
        }

        const expectedUsed = await client.readContract({
          address: quoter, abi: BTB_LP_QUOTER_ABI, functionName: 'previewMint',
          args: [pool, pos.tickLower, pos.tickUpper, expected0, expected1],
        });
        if (expectedUsed[2] < 1_000n || (expectedUsed[0] === 0n && expectedUsed[1] === 0n)) {
          throw new Error('This amount is too small to create usable LP liquidity');
        }
        const pinned = encodeIncreaseZapRequest({
          account: smartAccount, positionId: pos.id, fundingToken, fundingAmount: inputAmount,
          leg0, leg1,
          amount0Min: minWithSlippage(expectedUsed[0], slippageBps),
          amount1Min: minWithSlippage(expectedUsed[1], slippageBps),
          twapSeconds: 60, maxSlippageBps: slippageBps, maxSpotTwapDeviationBps: 500,
        });
        const instructionId = await client.readContract({
          address: smartDeployment.agentRegistry, abi: BTB_AGENT_REGISTRY_ABI,
          functionName: 'nextInstructionId', args: [smartAccount],
        });
        const now = BigInt(Math.floor(Date.now() / 1000));
        const freshArgs = fresh0 === '0x'
          ? EMPTY_FRESH_SWAP_ARGS
          : encodeAbiParameters([{ type: 'bytes' }, { type: 'bytes' }], [fresh0, '0x']);
        const currentRoles = await client.readContract({
          address: smartDeployment.agentRegistry, abi: BTB_AGENT_REGISTRY_ABI,
          functionName: 'agentRoles', args: [smartAccount, smartDeployment.agent],
        });
        const calls = [
          ...(fundSource === 'account' ? [] : ethMode
            ? [{ to: smartAccount, value: inputAmount }]
            : [approvalCall(poolFundingToken, smartAccount, inputAmount)!, depositTokenCall(smartAccount, poolFundingToken, inputAmount)!]),
          ...((Number(currentRoles) & 12) === 12 ? [] : [configureSelfAgentCall(smartDeployment, smartAccount, smartDeployment.agent, 12)]),
          scheduleSingleInstructionCall(
            smartDeployment, smartAccount, smartDeployment.agent, fundingToken, inputAmount,
            now, now + 8n * 60n, 8, INCREASE_FROM_ACCOUNT_SELECTOR, pinned,
          ),
        ];
        await runCalls(config, { account: owner, chainId, calls, label: `Add to ${pos.symbol0}/${pos.symbol1} through your smart account`, track });
        await executeAgentZap({ chainId, account: smartAccount, instructionId: instructionId.toString(), pinnedArgs: pinned, freshArgs });
        await onDone();
        return;
      }
      const readBalances = async (): Promise<[bigint, bigint]> => {
        const [b0, b1] = await Promise.all([
          client.readContract({ address: pos.token0, abi: erc20Abi, functionName: 'balanceOf', args: [owner] }),
          client.readContract({ address: pos.token1, abi: erc20Abi, functionName: 'balanceOf', args: [owner] }),
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
            ? await robinhoodSwap(client, pos, plan.sellSide, sellRaw, owner, slippageBps)
            : (await buildSwapGap({ sellSide: plan.sellSide, swapFraction: plan.swapFraction, budget0, budget1, token0: pos.token0, token1: pos.token1, decimals0: pos.decimals0, decimals1: pos.decimals1, native0: false, account: owner, slippageBps }))?.calls ?? [];
          prepCalls.push(...swapCalls);
          await runCalls(config, { account: owner, chainId, calls: prepCalls, label: `Balance ${pos.symbol0}/${pos.symbol1} for the range`, track });
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
        await runCalls(config, { account: owner, chainId, calls: prepCalls, label: `Wrap ETH for ${pos.symbol0}/${pos.symbol1}`, track });
      }

      const live = await readBalances();
      budget0 = budget0 < live[0] ? budget0 : live[0];
      budget1 = budget1 < live[1] ? budget1 : live[1];
      const liquidity = liquidityForAmounts(pos.sqrtPriceX96, pos.tickLower, pos.tickUpper, budget0, budget1);
      const amounts = getAmountsForLiquidity(pos.sqrtPriceX96, pos.tickLower, pos.tickUpper, liquidity);
      if (amounts[0] === 0n && amounts[1] === 0n) throw new Error('The amount is too small to add to this range');
      const calls = buildIncrease(pos, amounts[0], amounts[1], slippageBps, null, deployment);
      await runCalls(config, { account: owner, chainId, calls, label: `Increase ${pos.symbol0}/${pos.symbol1} position`, track });
      await onDone();
    } catch (cause) {
      const value = cause as { shortMessage?: string; message?: string };
      setError(value.shortMessage ?? value.message ?? 'Could not add liquidity');
    } finally { setBusy(false); }
  }

  async function unlockPending() {
    if (busy || selectedReservations.length === 0) return;
    setBusy(true); setError(null);
    try {
      await runCalls(config, {
        account: owner, chainId,
        calls: selectedReservations.map(item => cancelInstructionCall(smartDeployment, smartAccount, item.id)),
        label: `Cancel pending ${inputSymbol} add and unlock funds`, track,
      });
      const released = selectedReservations.reduce((sum, item) => sum + item.amount, 0n);
      if (fundSide === 0) setReserved0(value => value > released ? value - released : 0n);
      else setReserved1(value => value > released ? value - released : 0n);
      setPendingReservations(value => value.filter(item => !selectedReservations.some(selected => selected.id === item.id)));
      setFundSource('account'); setUseEth(false); setAmountText('');
    } catch (cause) {
      const value = cause as { shortMessage?: string; message?: string };
      setError(value.shortMessage ?? value.message ?? 'Could not unlock the smart-account balance');
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
          <button onClick={() => setFundSource('wallet')} style={{ height: 37, borderRadius: 11, border: fundSource === 'wallet' ? '1px solid rgba(82,227,164,.48)' : btb.borderSoft, background: fundSource === 'wallet' ? 'rgba(82,227,164,.11)' : 'rgba(255,255,255,.035)', color: fundSource === 'wallet' ? btb.green : btb.textMuted, fontFamily: 'inherit', fontSize: 11, fontWeight: 750, cursor: 'pointer' }}>From wallet</button>
          <button onClick={() => { setFundSource('account'); setUseEth(false); }} style={{ height: 37, borderRadius: 11, border: fundSource === 'account' ? '1px solid rgba(82,227,164,.48)' : btb.borderSoft, background: fundSource === 'account' ? 'rgba(82,227,164,.11)' : 'rgba(255,255,255,.035)', color: fundSource === 'account' ? btb.green : btb.textMuted, fontFamily: 'inherit', fontSize: 11, fontWeight: 750, cursor: 'pointer' }}>From smart account</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginTop: 12 }}>
          {([0, 1] as const).map(sideIndex => <button key={sideIndex} onClick={() => { setFundSide(sideIndex); setUseEth(sideIndex === wethSide); setAmountText(''); }} style={{ height: 39, borderRadius: 11, border: fundSide === sideIndex ? '1px solid rgba(82,227,164,.48)' : btb.borderSoft, background: fundSide === sideIndex ? 'rgba(82,227,164,.11)' : 'rgba(255,255,255,.035)', color: fundSide === sideIndex ? btb.green : btb.textMuted, fontFamily: 'inherit', fontSize: 11.5, fontWeight: 750, cursor: 'pointer' }}>Fund with {sideIndex === wethSide ? (useEth && fundSide === sideIndex ? 'ETH' : 'WETH') : sideIndex === 0 ? pos.symbol0 : pos.symbol1}</button>)}
        </div>
        {fundSide === wethSide && <button onClick={() => { setUseEth(value => !value); setAmountText(''); }} style={{ border: 'none', display: 'block', margin: '7px 0 0 auto', padding: 0, background: 'transparent', color: btb.green, fontFamily: 'inherit', fontSize: 10.5, fontWeight: 700, cursor: 'pointer' }}>Use {useEth ? 'WETH' : 'ETH'} instead</button>}

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 14, marginBottom: 6 }}>
          <span style={{ color: btb.textMuted, fontSize: 11.5 }}>{inputSymbol} amount</span>
          <button onClick={() => setAmountText(formatUnits(inputBalance, inputDecimals))} style={{ border: 'none', padding: 0, background: 'transparent', color: btb.green, fontFamily: 'inherit', fontSize: 11, fontWeight: 750, cursor: 'pointer' }}>{fundSource === 'account' ? 'Available' : 'Balance'} {fmt(inputBalance, inputDecimals)} · MAX</button>
        </div>
        <input value={amountText} onChange={(event) => setAmountText(event.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" placeholder="0" autoFocus style={{ width: '100%', height: 52, boxSizing: 'border-box', borderRadius: 14, padding: '0 14px', outline: 'none', border: btb.borderSoft, background: 'rgba(255,255,255,.055)', color: btb.text, fontFamily: 'inherit', fontSize: 21, fontWeight: 750 }}/>
        {!usesBtbQuoter && inputAmount > 0n && swapPct > 0 && <div style={{ marginTop: 9, color: btb.textMuted, fontSize: 11.5 }}>Swap only ~{swapPct}% to {plan.sellSide === 0 ? pos.symbol1 : pos.symbol0}, then add both sides.</div>}
        {!usesBtbQuoter && inputAmount > 0n && swapPct === 0 && <div style={{ marginTop: 9, color: btb.textMuted, fontSize: 11.5 }}>No swap needed for this range.</div>}
        {rangeQuote && <Glass padding={10} radius={12} soft style={{ marginTop: 9 }}>
          <div style={{ color: btb.textMuted, fontSize: 10.5 }}>BTB range quote · {rangeQuote.swapPct > 0 ? `swap ${rangeQuote.swapPct.toFixed(1)}%` : 'no swap'}</div>
          <div style={{ color: btb.text, fontSize: 12, fontWeight: 750, marginTop: 3 }}>{fmt(rangeQuote.amount0, pos.decimals0)} {pos.symbol0} + {fmt(rangeQuote.amount1, pos.decimals1)} {pos.symbol1}</div>
          {rangeQuote.liquidity < 1_000n && <div style={{ color: btb.loss, fontSize: 10.5, marginTop: 3 }}>Amount is too small for usable liquidity.</div>}
        </Glass>}
        {insufficient && <div style={{ marginTop: 8, color: btb.loss, fontSize: 11.5 }}>Insufficient {inputSymbol}</div>}
        {selectedReservations.length > 0 && <Glass padding={10} radius={12} soft style={{ marginTop: 9, border: '1px solid rgba(255,179,107,.24)' }}>
          <div style={{ color: btb.amber, fontSize: 10.5, fontWeight: 750 }}>{fmt(selectedReservations.reduce((sum, item) => sum + item.amount, 0n), inputDecimals)} {fundSide === 0 ? pos.symbol0 : pos.symbol1} reserved by a pending add</div>
          <button onClick={unlockPending} disabled={busy} style={{ border: 'none', padding: '5px 0 0', background: 'transparent', color: btb.green, fontFamily: 'inherit', fontSize: 10.5, fontWeight: 750, cursor: 'pointer' }}>Cancel pending add & unlock</button>
        </Glass>}
        {!pos.inRange && <div style={{ marginTop: 8, color: btb.amber, fontSize: 10.5 }}>This range currently needs only one token; any unnecessary side is converted first.</div>}
        {error && <div style={{ color: btb.loss, fontSize: 11.5, lineHeight: 1.4, marginTop: 9 }}>{error}</div>}

        <Button variant="success" size="md" onClick={add} disabled={!canAdd || busy} style={{ width: '100%', marginTop: 15 }}>{busy ? 'Adding…' : 'Add to position'}</Button>
        <Button variant="ghost" size="sm" onClick={onClose} disabled={busy} style={{ width: '100%', marginTop: 7 }}>Cancel</Button>
        <div style={{ color: btb.textDim, textAlign: 'center', fontSize: 9.5, marginTop: 7 }}>You approve the exact funding limit once. The BTB agent swaps only the quoted gap and increases this NFT with {slippageBps / 100}% protection.</div>
      </div>
    </div>
  </Portal>;
}
