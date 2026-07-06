'use client';
import { useMemo, useState } from 'react';
import { useConfig } from 'wagmi';
import { getPublicClient } from 'wagmi/actions';
import { formatUnits, erc20Abi, encodeFunctionData, type PublicClient } from 'viem';
import { Glass } from './Glass';
import { Portal } from './Portal';
import { Button } from './Button';
import { btb } from './design-tokens';
import { useSidebar } from '../lib/SidebarContext';
import { useTx } from '../lib/TxTracker';
import { runCalls, type Call } from '../lib/txRunner';
import { getKyberQuote, buildKyberTx } from '../lib/kyberswap';
import {
  buildRemove, buildMint, rangeTicks, heldHeavyRange, rebalancePlan,
  liquidityForAmounts, getAmountsForLiquidity, fmtFeeTier,
  buildV4Remove, buildV4Mint, maxIn, isNativeCurrency,
  UNISWAP_V3_DEPLOYMENT, type LiquidityPosition, type V3Deployment, type PoolKey,
} from '@/protocols/dexs/uniswap';
import { PANCAKE_V3_DEPLOYMENT } from '@/protocols/dexs/pancakeswap';

const SLIPPAGE_BPS = 50; // 0.5%
const WIDTH_PRESETS = [5, 10, 25] as const;
/** ETH held back for gas whenever a native-ETH side is swapped/deposited (V4). */
const GAS_RESERVE = 5n * 10n ** 15n; // 0.005 ETH

/** Deployment for a V3-architecture position (Uniswap default, Pancake fork). */
function v3DeploymentOf(p: LiquidityPosition): V3Deployment {
  return p.protocol === 'pancakeswap-v3' ? PANCAKE_V3_DEPLOYMENT : UNISWAP_V3_DEPLOYMENT;
}

function fmtAmt(raw: bigint, decimals: number): string {
  const n = parseFloat(formatUnits(raw, decimals));
  if (n === 0) return '0';
  if (n < 0.0001) return '<0.0001';
  return n.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

function tickToPrice(tick: number, d0: number, d1: number): number {
  return 1.0001 ** tick * 10 ** (d0 - d1);
}

function fmtPrice(p: number): string {
  if (!isFinite(p)) return '∞';
  if (p <= 1e-30) return '0';
  return parseFloat(p.toPrecision(6)).toLocaleString('en-US', { maximumSignificantDigits: 6 });
}

type Phase = 'config' | 'running' | 'done' | 'error';

/**
 * Smart rebalance for an existing Uniswap V3/V4 or PancakeSwap V3 position.
 *
 * The key idea — and what makes it "smart" — is that a position whose price has
 * run out of range is already lopsided (e.g. an ETH/USDC LP that fell out the
 * bottom now holds ~100% ETH). A naive rebalance re-centers to 50/50 and forces
 * you to sell half your ETH. Instead we:
 *
 *   1 · Withdraw the whole position (principal + fees) to your wallet.
 *   2 · Swap ONLY the gap between what you hold and what the new range needs —
 *       a band placed near the token you're heavy in needs just a few percent
 *       swapped, so you keep your exposure.
 *   3 · Mint the new position, depositing only the rebalanced funds.
 *
 * Two strategies: "Keep my <token>" (band shifted toward the held token →
 * minimal swap, you stay heavy in it) and "Balanced" (centered → ~50/50).
 *
 * V4: same flow against the singleton PositionManager. The native-ETH currency
 * (token0 = address(0)) is swapped/deposited as ETH (a gas reserve is kept) and
 * ERC-20 deposits go through Permit2 — all handled inside buildV4Mint. Hooked
 * pools can't be minted in-app, so the caller only offers rebalance for
 * unhooked V4 positions.
 */
export function RebalanceSheet({ pos, account, onClose, onDone }: {
  pos: LiquidityPosition;
  account: `0x${string}`;
  onClose: () => void;
  onDone: () => void | Promise<void>;
}) {
  const { width: sidebarWidth } = useSidebar();
  const config = useConfig();
  const { track } = useTx();
  const isV4 = pos.protocol === 'uniswap-v4';
  // V4's native ETH is always currency0; V3 pairs are ERC-20 (WETH, not native).
  const native0 = isV4 && isNativeCurrency(pos.token0);
  const deployment = v3DeploymentOf(pos);
  const spacing = (isV4 ? pos.tickSpacing : deployment.tickSpacings[pos.fee]) ?? 60;
  const poolKey: PoolKey | null = isV4
    ? { currency0: pos.token0, currency1: pos.token1, fee: pos.fee, tickSpacing: spacing, hooks: pos.hooks ?? '0x0000000000000000000000000000000000000000' }
    : null;

  const [widthPct, setWidthPct] = useState<number>(10);
  const [strategy, setStrategy] = useState<'keep' | 'balanced'>('keep');
  const [phase, setPhase] = useState<Phase>('config');
  const [stepMsg, setStepMsg] = useState('');
  const [err, setErr] = useState<string | null>(null);

  // What we'll have after withdrawing: principal + claimable fees.
  const h0 = pos.amount0 + pos.fees0;
  const h1 = pos.amount1 + pos.fees1;

  // Which token the wallet is already heavy in (by value at the pool price).
  const price = useMemo(() => (Number(pos.sqrtPriceX96) / 2 ** 96) ** 2, [pos.sqrtPriceX96]);
  const heavySide: 0 | 1 = Number(h0) * price >= Number(h1) ? 0 : 1;
  const heavySym = heavySide === 0 ? pos.symbol0 : pos.symbol1;

  // Centered band width in ticks for the chosen preset — reused to size the
  // shifted "keep" band so both strategies cover the same price width.
  const centered = useMemo(() => rangeTicks(pos.currentTick, spacing, widthPct), [pos.currentTick, spacing, widthPct]);
  const widthTicks = centered.tickUpper - centered.tickLower;

  const range = useMemo(
    () => (strategy === 'balanced' ? centered : heldHeavyRange(pos.currentTick, spacing, widthTicks, heavySide)),
    [strategy, centered, pos.currentTick, spacing, widthTicks, heavySide],
  );

  const plan = useMemo(
    () => rebalancePlan(pos.sqrtPriceX96, range.tickLower, range.tickUpper, h0, h1),
    [pos.sqrtPriceX96, range, h0, h1],
  );

  // Preview of the swap the plan implies, against the would-be holdings.
  const preview = useMemo(() => {
    if (plan.sellSide === null || plan.swapFraction <= 0.0005) return null;
    const sellRaw = plan.sellSide === 0 ? h0 : h1;
    const dec = plan.sellSide === 0 ? pos.decimals0 : pos.decimals1;
    const sym = plan.sellSide === 0 ? pos.symbol0 : pos.symbol1;
    const otherSym = plan.sellSide === 0 ? pos.symbol1 : pos.symbol0;
    const amt = parseFloat(formatUnits(sellRaw, dec)) * plan.swapFraction;
    return { sym, otherSym, amt, pct: plan.swapFraction * 100 };
  }, [plan, h0, h1, pos]);

  const pMin = tickToPrice(range.tickLower, pos.decimals0, pos.decimals1);
  const pMax = tickToPrice(range.tickUpper, pos.decimals0, pos.decimals1);

  async function readBals(client: PublicClient): Promise<readonly [bigint, bigint]> {
    // token1 is always an ERC-20; token0 is native ETH only on a V4 native pool.
    const erc = native0 ? [pos.token1] : [pos.token0, pos.token1];
    const res = await client.multicall({
      contracts: erc.map((a) => ({ address: a, abi: erc20Abi, functionName: 'balanceOf' as const, args: [account] as const })),
      allowFailure: true,
    });
    const get = (r: typeof res[number] | undefined) => (r && r.status === 'success' ? (r.result as bigint) : 0n);
    if (native0) {
      const eth = await client.getBalance({ address: account });
      return [eth, get(res[0])] as const;
    }
    return [get(res[0]), get(res[1])] as const;
  }

  /** Build the withdraw calls for whichever protocol the position belongs to. */
  function removeCalls() {
    return isV4
      ? buildV4Remove(pos, 10_000, SLIPPAGE_BPS, account)
      : buildRemove(pos, 10_000, SLIPPAGE_BPS, account, deployment);
  }

  /** Kyber token address for a side — native ETH (V4 currency0) maps to 'ETH'. */
  function kyberAddr(side: 0 | 1): string {
    return side === 0 && native0 ? 'ETH' : (side === 0 ? pos.token0 : pos.token1);
  }

  async function run() {
    setPhase('running'); setErr(null);
    try {
      const client = getPublicClient(config);
      if (!client) throw new Error('No RPC client');
      const tl = range.tickLower, tu = range.tickUpper;

      // Snapshot wallet so we only ever redeploy what THIS position returns,
      // never the user's unrelated balances of the same tokens.
      const [pre0, pre1] = await readBals(client);

      // 1 · Withdraw the whole position (principal + fees).
      setStepMsg('Withdrawing your liquidity…');
      await runCalls(config, {
        account,
        calls: removeCalls(),
        label: `Rebalance · withdraw ${pos.symbol0}/${pos.symbol1}`,
        track,
      });

      const [post0, post1] = await readBals(client);
      let budget0 = post0 > pre0 ? post0 - pre0 : 0n; // what the position returned
      let budget1 = post1 > pre1 ? post1 - pre1 : 0n;

      // 2 · Swap only the gap (re-planned against what actually came back).
      const pl = rebalancePlan(pos.sqrtPriceX96, tl, tu, budget0, budget1);
      if (pl.sellSide !== null && pl.swapFraction > 0.0005) {
        const sellBudget = pl.sellSide === 0 ? budget0 : budget1;
        const bps = Math.min(10_000, Math.max(0, Math.round(pl.swapFraction * 10_000)));
        let sellRaw = (sellBudget * BigInt(bps)) / 10_000n;
        // Selling native ETH must leave gas for the swap + mint that follow.
        const sellNative = native0 && pl.sellSide === 0;
        if (sellNative) {
          const room = budget0 > GAS_RESERVE ? budget0 - GAS_RESERVE : 0n;
          if (sellRaw > room) sellRaw = room;
        }
        if (sellRaw > 0n) {
          setStepMsg('Swapping only what the new range needs…');
          const outDec = pl.sellSide === 0 ? pos.decimals1 : pos.decimals0;
          const quote = await getKyberQuote(kyberAddr(pl.sellSide), kyberAddr(pl.sellSide === 0 ? 1 : 0), sellRaw.toString(), outDec, 1);
          const tx = await buildKyberTx(quote.routeSummary, quote.routerAddress, account, account, SLIPPAGE_BPS, 1);
          const calls: Call[] = [];
          // Native ETH needs no approval; ERC-20 must allow the Kyber router.
          if (!sellNative) {
            const inTok = pl.sellSide === 0 ? pos.token0 : pos.token1;
            calls.push({
              to: inTok,
              data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [quote.routerAddress as `0x${string}`, sellRaw] }),
            });
          }
          calls.push({
            to: tx.to as `0x${string}`,
            data: tx.data as `0x${string}`,
            value: sellNative ? sellRaw : BigInt(tx.value && tx.value !== '0' ? tx.value : '0'),
            gas: tx.gas ? BigInt(tx.gas) : undefined,
          });
          await runCalls(config, { account, calls, label: `Rebalance · swap ${pos.symbol0}/${pos.symbol1}`, track });

          // Recompute the budget from the swap: spent `sellRaw`, received the
          // quote's amount-out (conservative — actual deposit is capped to the
          // live wallet balance below).
          const out = BigInt(quote.routeSummary?.amountOut ?? quote.amountOut ?? '0');
          if (pl.sellSide === 0) { budget0 -= sellRaw; budget1 += out; }
          else { budget1 -= sellRaw; budget0 += out; }
        }
      }

      // 3 · Mint the new position with the rebalanced budget, capped to the live
      // wallet balance so a slightly optimistic swap quote can't over-deposit.
      setStepMsg('Opening your rebalanced position…');
      const [bal0, bal1] = await readBals(client);
      // For a native-ETH side, hold back gas AND the up-to-0.5% slippage headroom
      // that buildV4Mint's amount0Max (and thus msg.value) adds on top.
      const cap0 = native0
        ? (bal0 > GAS_RESERVE ? ((bal0 - GAS_RESERVE) * 9950n) / 10_000n : 0n)
        : bal0;
      const eff0 = budget0 < cap0 ? budget0 : cap0;
      const eff1 = budget1 < bal1 ? budget1 : bal1;
      const L = liquidityForAmounts(pos.sqrtPriceX96, tl, tu, eff0, eff1);
      const [a0, a1] = getAmountsForLiquidity(pos.sqrtPriceX96, tl, tu, L);
      if (a0 === 0n && a1 === 0n) throw new Error('Nothing left to deposit after the swap');
      await runCalls(config, {
        account,
        calls: isV4
          ? buildV4Mint({
              poolKey: poolKey!,
              tickLower: tl, tickUpper: tu,
              liquidity: L,
              amount0Max: maxIn(a0, SLIPPAGE_BPS), amount1Max: maxIn(a1, SLIPPAGE_BPS),
              recipient: account,
            })
          : buildMint({
              token0: pos.token0, token1: pos.token1, fee: pos.fee,
              tickLower: tl, tickUpper: tu,
              amount0Desired: a0, amount1Desired: a1,
              slippageBps: SLIPPAGE_BPS, recipient: account, deployment,
            }),
        label: `Rebalance · add ${pos.symbol0}/${pos.symbol1}`,
        track,
      });

      setPhase('done');
    } catch (e) {
      setErr((e as { shortMessage?: string })?.shortMessage ?? (e as Error)?.message ?? 'Rebalance failed');
      setPhase('error');
    }
  }

  return (
    <Portal>
    <div onClick={phase === 'running' ? undefined : onClose} style={{ position: 'fixed', top: 0, left: sidebarWidth, right: 0, bottom: 0, zIndex: 330, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', overflowY: 'auto' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, background: 'rgba(10,10,15,0.98)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 28, padding: '12px 20px calc(32px + env(safe-area-inset-bottom, 0px))', maxHeight: '90vh', overflowY: 'auto' }}>

        {phase === 'done' ? (
          <div style={{ textAlign: 'center', padding: '12px 0 4px' }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
            <div style={{ color: btb.text, fontSize: 19, fontWeight: 800, letterSpacing: -0.4 }}>Position rebalanced</div>
            <div style={{ color: btb.textMuted, fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>
              Your {pos.symbol0}/{pos.symbol1} liquidity is back in range{preview ? ` — only ${preview.pct < 1 ? '<1' : preview.pct.toFixed(0)}% was swapped, so you kept your ${heavySym}.` : '.'}
            </div>
            <Button variant="success" size="md" onClick={() => onDone()} style={{ marginTop: 20, fontWeight: 800 }}>Done</Button>
          </div>
        ) : (
          <>
            <div style={{ color: btb.text, fontSize: 19, fontWeight: 800, letterSpacing: -0.4, marginBottom: 4 }}>Smart rebalance</div>
            <div style={{ color: btb.textMuted, fontSize: 13, marginBottom: 14 }}>
              {pos.symbol0} / {pos.symbol1} · {fmtFeeTier(pos.fee)} · {pos.inRange ? 'In range' : 'Out of range'}
            </div>

            {/* Current holdings — what the withdraw will return */}
            <Glass padding={14} radius={14} soft style={{ marginBottom: 12 }}>
              <div style={{ color: btb.textMuted, fontSize: 12, marginBottom: 4 }}>You currently hold (principal + fees)</div>
              <div style={{ color: btb.text, fontSize: 15, fontWeight: 700 }}>
                {fmtAmt(h0, pos.decimals0)} {pos.symbol0} + {fmtAmt(h1, pos.decimals1)} {pos.symbol1}
              </div>
              {!pos.inRange && (
                <div style={{ color: '#FFB36B', fontSize: 12, marginTop: 8, lineHeight: 1.5 }}>
                  Price moved out of range, so you&apos;re now mostly {heavySym}. You won&apos;t be forced to sell 50% to
                  re-center — pick a strategy below and we&apos;ll swap only what the new range actually needs.
                </div>
              )}
            </Glass>

            {/* Strategy */}
            <div style={{ color: btb.textMuted, fontSize: 12, marginBottom: 6 }}>Strategy</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
              <StratCard
                active={strategy === 'keep'}
                onClick={() => setStrategy('keep')}
                title={`Keep my ${heavySym}`}
                sub="Smallest swap · stay heavy in your token"
                recommended={!pos.inRange}
              />
              <StratCard
                active={strategy === 'balanced'}
                onClick={() => setStrategy('balanced')}
                title="Balanced"
                sub="Centered range · ~50 / 50 split"
              />
            </div>

            {/* Range width */}
            <div style={{ color: btb.textMuted, fontSize: 12, margin: '14px 0 6px' }}>Range width</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              {WIDTH_PRESETS.map((v) => (
                <button key={v} onClick={() => setWidthPct(v)} style={{
                  flex: 1, height: 40, borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
                  background: widthPct === v ? 'rgba(82,227,164,0.18)' : 'rgba(255,255,255,0.06)',
                  border: `1px solid ${widthPct === v ? 'rgba(82,227,164,0.5)' : 'rgba(255,255,255,0.12)'}`,
                  color: widthPct === v ? '#52E3A4' : btb.textMuted,
                }}>±{v}%</button>
              ))}
            </div>

            {/* Plan */}
            <Glass padding={14} radius={14} soft>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: btb.textMuted, fontSize: 12 }}>New range</span>
                <span style={{ color: btb.text, fontSize: 12, fontWeight: 700 }}>
                  {fmtPrice(pMin)} – {fmtPrice(pMax)} {pos.symbol1}/{pos.symbol0}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: btb.textMuted, fontSize: 12 }}>Swap needed</span>
                {preview ? (
                  <span style={{ color: btb.text, fontSize: 13, fontWeight: 700, textAlign: 'right' }}>
                    {preview.amt.toLocaleString('en-US', { maximumFractionDigits: 4 })} {preview.sym} → {preview.otherSym}
                    <span style={{ color: preview.pct <= 15 ? '#52E3A4' : '#FFB36B', fontWeight: 800, marginLeft: 6 }}>
                      ({preview.pct < 1 ? '<1' : preview.pct.toFixed(0)}%)
                    </span>
                  </span>
                ) : (
                  <span style={{ color: '#52E3A4', fontSize: 13, fontWeight: 700 }}>None — already matched</span>
                )}
              </div>
              <div style={{ color: btb.textDim, fontSize: 11, marginTop: 10, lineHeight: 1.5 }}>
                {strategy === 'keep'
                  ? `The band sits just ${heavySide === 0 ? 'above' : 'below'} the current price, so it stays mostly ${heavySym} and only ${preview ? (preview.pct < 1 ? 'a fraction of a percent' : `~${preview.pct.toFixed(0)}%`) : 'a little'} is swapped to re-enter range.`
                  : 'The band is centered on the current price, so it holds both tokens evenly — this needs a larger swap to reach a 50/50 split.'}
              </div>
            </Glass>

            {err && <div style={{ color: btb.loss, fontSize: 12, marginTop: 12 }}>{err}</div>}

            {phase === 'running' && (
              <div style={{ color: '#52E3A4', fontSize: 13, marginTop: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 14, height: 14, border: '2px solid rgba(82,227,164,0.3)', borderTopColor: '#52E3A4', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }}/>
                {stepMsg}
              </div>
            )}

            <Button
              variant="success" size="md"
              onClick={() => { if (phase !== 'running') run(); }}
              disabled={phase === 'running'}
              style={{ marginTop: 18, fontWeight: 800 }}
            >
              {phase === 'running' ? 'Rebalancing…' : phase === 'error' ? 'Retry rebalance' : 'Rebalance position'}
            </Button>
            <div style={{ color: btb.textDim, fontSize: 11, textAlign: 'center', marginTop: 10, lineHeight: 1.5 }}>
              Withdraw → swap only the gap → re-add, each slippage-protected ({SLIPPAGE_BPS / 100}%). Confirm up to three transactions in your wallet.
            </div>
          </>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
    </Portal>
  );
}

function StratCard({ active, onClick, title, sub, recommended }: {
  active: boolean; onClick: () => void; title: string; sub: string; recommended?: boolean;
}) {
  return (
    <button onClick={onClick} style={{
      flex: 1, textAlign: 'left', padding: '12px 12px', borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit',
      background: active ? 'rgba(82,227,164,0.16)' : 'rgba(255,255,255,0.05)',
      border: `1px solid ${active ? 'rgba(82,227,164,0.5)' : 'rgba(255,255,255,0.1)'}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ color: active ? '#52E3A4' : btb.text, fontSize: 13, fontWeight: 800 }}>{title}</span>
        {recommended && (
          <span style={{ fontSize: 9, fontWeight: 800, color: '#52E3A4', background: 'rgba(82,227,164,0.16)', borderRadius: 6, padding: '1px 5px' }}>BEST</span>
        )}
      </div>
      <div style={{ color: btb.textMuted, fontSize: 11, marginTop: 4, lineHeight: 1.4 }}>{sub}</div>
    </button>
  );
}
