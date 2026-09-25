'use client';
import { useState } from 'react';
import { useConfig } from 'wagmi';
import { getPublicClient } from 'wagmi/actions';
import { formatUnits } from 'viem';
import { Portal } from './Portal';
import { Button } from './Button';
import { Icon } from './Icon';
import { CreatePosition } from './CreatePosition';
import { btb } from './design-tokens';
import { useSidebar } from '../lib/SidebarContext';
import { useTx } from '../lib/TxTracker';
import { runCalls, supportsAtomicBatch } from '../lib/txRunner';
import { buildRemove, fetchV3Positions, fetchV4Positions, buildV4Remove, poolIdOf, SLIPPAGE_BPS, swapFreeRange, rebalancePlan, type LiquidityPosition, type PoolKey } from '@/protocols/dexs/uniswap';
import { tickToPrice } from '@/protocols/dexs/uniswap/shared';
import { fmtPrice } from './LpCardParts';
import { v4DeploymentOfPosition } from '@/protocols/lpChains';
import { NPM_ABI } from '@/protocols/dexs/uniswap/v3/abis';
import { buildUnstakeCalls } from '@/protocols/staking';
import { deploymentOfPosition, lpSlippageBps, type LpChainId } from '@/protocols/lpChains';

const deploymentOf = deploymentOfPosition;

function fmtAmt(raw: bigint, decimals: number): string {
  const n = parseFloat(formatUnits(raw, decimals));
  if (n === 0) return '0';
  if (n < 0.0001) return '<0.0001';
  return n.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

/**
 * Rebalance = withdraw, then the full Add-liquidity sheet.
 *
 * Step 1 pulls the whole position back to the wallet (unstaking from the
 * Aerodrome gauge first when needed, principal + fees in one transaction).
 * Step 2 is the same CreatePosition sheet used everywhere else — any range,
 * presets or custom bounds, smart single-token fit, split ranges, and for
 * Aerodrome a restake toggle — pre-filled with this pool so the user only
 * picks the new range and confirms.
 */
export function RebalanceFlow({ pos, account, onClose, onDone }: {
  pos: LiquidityPosition;
  account: `0x${string}`;
  onClose: () => void;
  onDone: () => void | Promise<void>;
}) {
  const { width: sidebarWidth } = useSidebar();
  const config = useConfig();
  const { track } = useTx();
  const [phase, setPhase] = useState<'confirm' | 'withdrawing' | 'add'>('confirm');
  const [stepMsg, setStepMsg] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const chainId = pos.chainId ?? 1;
  const isV4 = pos.protocol === 'uniswap-v4';
  const deployment = deploymentOf(pos);
  const v4 = v4DeploymentOfPosition(pos);
  // V4 positions are keyed by pool id, which the Add sheet needs to reopen the same pool.
  const v4PoolKey: PoolKey | null = isV4
    ? { currency0: pos.token0, currency1: pos.token1, fee: pos.fee, tickSpacing: pos.tickSpacing ?? 60, hooks: pos.hooks ?? '0x0000000000000000000000000000000000000000' }
    : null;
  const dex = pos.protocol === 'aerodrome-cl' ? 'aerodrome' : pos.protocol === 'pancakeswap-v3' ? 'pancakeswap' : pos.protocol === 'giga-v3' ? 'giga' : pos.protocol === 'ramses-v3' ? 'ramses' : pos.protocol === 'up-v3' ? 'up' : pos.protocol === 'sushiswap-v3' ? 'sushiswap' : 'uniswap';
  const slippage = lpSlippageBps(chainId, SLIPPAGE_BPS);
  const h0 = pos.amount0 + pos.fees0;
  const h1 = pos.amount1 + pos.fees1;

  // Preview: the swap the old range implies, and a suggested range of the
  // same width that fits what comes out, so the add step needs no swap.
  const spacing = pos.tickSpacing ?? deployment.tickSpacings[pos.fee] ?? 60;
  const width = Math.max(spacing, pos.tickUpper - pos.tickLower);
  const P = (Number(pos.sqrtPriceX96) / 2 ** 96) ** 2;
  const totalRaw1 = Number(h0) * P + Number(h1);
  const holdShare0 = totalRaw1 > 0 ? (Number(h0) * P) / totalRaw1 : 0.5;
  const suggested = h0 + h1 > 0n ? swapFreeRange(pos.sqrtPriceX96, pos.currentTick, width, spacing, holdShare0) : null;
  const sameRangePlan = rebalancePlan(pos.sqrtPriceX96, pos.tickLower, pos.tickUpper, h0, h1);
  const [useSuggested, setUseSuggested] = useState(true);
  const flipQuote = /^(USDC|USDT|DAI|USDG|USDE|FRAX|USDB|USD1|USDS)$/i.test(pos.symbol0) && !/^(USDC|USDT|DAI|USDG|USDE|FRAX|USDB|USD1|USDS)$/i.test(pos.symbol1);
  const priceOf = (tick: number) => { const q = tickToPrice(tick, pos.decimals0, pos.decimals1); return flipQuote && q > 0 ? 1 / q : q; };
  const rangeText = (lo: number, hi: number) => `${fmtPrice(priceOf(flipQuote ? hi : lo))} to ${fmtPrice(priceOf(flipQuote ? lo : hi))} ${flipQuote ? pos.symbol0 : pos.symbol1} per ${flipQuote ? pos.symbol1 : pos.symbol0}`;

  async function withdraw() {
    setPhase('withdrawing'); setErr(null);
    try {
      const client = getPublicClient(config, { chainId });
      if (!client) throw new Error('No RPC client');
      // Safe and other smart wallets: unstake and withdraw in ONE bundle, one signature (one Safe proposal).
      // The removal uses the position as last read; its minimums still protect against the price moving.
      if (pos.staked && pos.liquidity > 0n && await supportsAtomicBatch(config, account, chainId)) {
        setStepMsg('Unstaking and withdrawing in one transaction…');
        await runCalls(config, {
          account,
          calls: [...buildUnstakeCalls(pos, account), ...(isV4 ? buildV4Remove(pos, 10_000, slippage, account, v4) : buildRemove(pos, 10_000, slippage, account, deployment))],
          label: `Rebalance · unstake and withdraw ${pos.symbol0}/${pos.symbol1}`, track, chainId,
        });
        setPhase('add');
        return;
      }
      if (pos.staked) {
        setStepMsg(`Unstaking (pays out your ${pos.staked.rewardSymbol})…`);
        await runCalls(config, {
          account, calls: buildUnstakeCalls(pos, account), label: `Rebalance · unstake ${pos.symbol0}/${pos.symbol1}`, track, chainId,
          verify: {
            test: async () => (await client.readContract({ address: deployment.positionManager, abi: NPM_ABI, functionName: 'ownerOf', args: [pos.id] })).toLowerCase() === account.toLowerCase(),
            error: 'Unstake confirmed, but the RPC still shows the NFT in the gauge. Retry in a moment.',
          },
        });
      }
      // Re-read right before building minimums: amounts move with the price.
      const live = isV4
        ? (await fetchV4Positions(client, account, [pos.id], v4, 0n))[0] ?? pos
        : (await fetchV3Positions(client, account, deployment, [pos.id]))[0] ?? pos;
      if (live.liquidity > 0n || live.fees0 > 0n || live.fees1 > 0n) {
        setStepMsg('Withdrawing your liquidity and fees…');
        await runCalls(config, {
          account,
          calls: isV4 ? buildV4Remove(live, 10_000, slippage, account, v4) : buildRemove(live, 10_000, slippage, account, deployment),
          label: `Rebalance · withdraw ${pos.symbol0}/${pos.symbol1}`, track, chainId,
          verify: isV4 ? undefined : {
            test: async () => {
              const s = await client.readContract({ address: deployment.positionManager, abi: NPM_ABI, functionName: 'positions', args: [pos.id] });
              return s[7] === 0n && s[10] === 0n && s[11] === 0n;
            },
            error: 'Withdrawal confirmed, but the RPC still reports liquidity in the old position. Retry in a moment.',
          },
        });
      }
      setPhase('add');
    } catch (e) {
      setErr((e as { shortMessage?: string })?.shortMessage ?? (e as Error)?.message ?? 'Withdraw failed');
      setPhase('confirm');
    } finally { setStepMsg(''); }
  }

  if (phase === 'add') {
    return (
      <CreatePosition
        tokenA={isV4 ? undefined : pos.token0}
        tokenB={isV4 ? undefined : pos.token1}
        v4PoolId={v4PoolKey ? poolIdOf(v4PoolKey) : undefined}
        dex={dex}
        chainId={chainId as LpChainId}
        initialFee={pos.protocol === 'aerodrome-cl' || pos.protocol === 'ramses-v3' || pos.protocol === 'up-v3' ? pos.tickSpacing : pos.fee}
        initialTicks={useSuggested && suggested ? { tickLower: suggested.tickLower, tickUpper: suggested.tickUpper } : undefined}
        stakeByDefault={!!pos.staked}
        onClose={async () => { await onDone(); onClose(); }}
        onDone={() => {}}
      />
    );
  }

  const busy = phase === 'withdrawing';
  return (
    <Portal>
      <div onClick={busy ? undefined : onClose} style={{ position: 'fixed', top: 0, left: sidebarWidth, right: 0, bottom: 0, zIndex: 320, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', overflowY: 'auto' }}>
        <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 440, background: 'rgba(var(--bg-rgb), 0.98)', border: '1px solid rgba(var(--fg-rgb), 0.1)', borderRadius: 28, padding: '20px 20px calc(24px + env(safe-area-inset-bottom, 0px))' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ color: btb.text, fontSize: 19, fontWeight: 800, letterSpacing: -0.4 }}>Rebalance</div>
            {!busy && <div onClick={onClose} style={{ cursor: 'pointer', color: btb.textMuted }}><Icon name="close" size={16} color={btb.textMuted}/></div>}
          </div>
          <div style={{ color: btb.textMuted, fontSize: 13, marginBottom: 16 }}>
            {pos.symbol0} / {pos.symbol1} · {pos.inRange ? 'In range' : 'Out of range'}{pos.staked ? ' · staked' : ''}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Step n={1} title="Withdraw everything to your wallet" active>
              {pos.staked && <div>Unstake first (pays out your earned {pos.staked.rewardSymbol}).</div>}
              <div>Remove the position and collect fees: <b style={{ color: btb.text }}>{fmtAmt(h0, pos.decimals0)} {pos.symbol0}</b> + <b style={{ color: btb.text }}>{fmtAmt(h1, pos.decimals1)} {pos.symbol1}</b>.</div>
            </Step>
            <Step n={2} title="Pick the new range and add">
              {suggested && (
                <div onClick={() => setUseSuggested(v => !v)} style={{ cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 10px', borderRadius: 10, background: useSuggested ? 'rgba(var(--green-rgb), 0.08)' : 'rgba(var(--fg-rgb), 0.04)', border: `1px solid ${useSuggested ? 'rgba(var(--green-rgb), 0.3)' : 'rgba(var(--fg-rgb), 0.08)'}`, marginBottom: 6 }}>
                  <span style={{ width: 16, height: 16, borderRadius: 5, flexShrink: 0, marginTop: 1, background: useSuggested ? btb.green : 'transparent', border: `1px solid ${useSuggested ? btb.green : 'rgba(var(--fg-rgb), 0.3)'}` }}/>
                  <span>
                    <b style={{ color: btb.text }}>Same width, no swap</b>: {rangeText(suggested.tickLower, suggested.tickUpper)}. Uses everything that comes out as is{Math.abs(suggested.share0 - holdShare0) > 0.05 ? ' (close, a small swap may remain)' : ''}.
                  </span>
                </div>
              )}
              <div>{useSuggested && suggested ? 'The Add sheet opens on that range; change it there if you like.' : `The Add sheet opens on this pool. Keeping the old range would need to swap about ${Math.round(sameRangePlan.swapFraction * 100)}% of your ${sameRangePlan.sellSide === 0 ? pos.symbol0 : pos.symbol1}${sameRangePlan.sellSide === null ? '' : ''}.`}{pos.staked || pos.stakeable ? ` Restake for ${(pos.staked ?? pos.stakeable)?.rewardSymbol ?? 'rewards'} is a toggle.` : ''}</div>
            </Step>
          </div>

          {err && <div style={{ color: btb.loss, fontSize: 12, marginTop: 12 }}>{err}</div>}

          <div style={{ marginTop: 16 }}>
            <Button variant="success" size="md" onClick={withdraw} loading={busy} disabled={busy}>
              {busy ? (stepMsg || 'Confirming…') : pos.staked ? 'Unstake, withdraw & choose range' : 'Withdraw & choose new range'}
            </Button>
          </div>
          <div style={{ color: btb.textDim, fontSize: 10.5, marginTop: 10, lineHeight: 1.5 }}>
            {pos.staked ? 'Two wallet confirmations now (one on a Safe or smart wallet)' : 'One wallet confirmation now'}, then the add step has its own. Withdrawal is slippage-protected at {slippage / 100}%.
          </div>
        </div>
      </div>
    </Portal>
  );
}

function Step({ n, title, active, children }: { n: number; title: string; active?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 12, background: active ? 'rgba(var(--green-rgb), 0.06)' : 'rgba(var(--fg-rgb), 0.04)', border: `1px solid ${active ? 'rgba(var(--green-rgb), 0.3)' : 'rgba(var(--fg-rgb), 0.07)'}`, borderRadius: 14, padding: '12px 14px' }}>
      <span style={{ width: 24, height: 24, borderRadius: 8, flexShrink: 0, background: 'rgba(var(--green-rgb), 0.18)', color: btb.green, fontSize: 12, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{n}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ color: btb.text, fontSize: 13.5, fontWeight: 700 }}>{title}</div>
        <div style={{ color: btb.textMuted, fontSize: 12, lineHeight: 1.5, marginTop: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>{children}</div>
      </div>
    </div>
  );
}
