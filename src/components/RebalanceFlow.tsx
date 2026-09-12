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
import { runCalls } from '../lib/txRunner';
import { buildRemove, fetchV3Positions, SLIPPAGE_BPS, type LiquidityPosition } from '@/protocols/dexs/uniswap';
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
  const deployment = deploymentOf(pos);
  const dex = pos.protocol === 'aerodrome-cl' ? 'aerodrome' : pos.protocol === 'pancakeswap-v3' ? 'pancakeswap' : pos.protocol === 'giga-v3' ? 'giga' : pos.protocol === 'ramses-v3' ? 'ramses' : pos.protocol === 'up-v3' ? 'up' : 'uniswap';
  const slippage = lpSlippageBps(chainId, SLIPPAGE_BPS);
  const h0 = pos.amount0 + pos.fees0;
  const h1 = pos.amount1 + pos.fees1;

  async function withdraw() {
    setPhase('withdrawing'); setErr(null);
    try {
      const client = getPublicClient(config, { chainId });
      if (!client) throw new Error('No RPC client');
      if (pos.staked) {
        setStepMsg('Unstaking from the Aerodrome gauge…');
        await runCalls(config, {
          account, calls: buildUnstakeCalls(pos), label: `Rebalance · unstake ${pos.symbol0}/${pos.symbol1}`, track, chainId,
          verify: {
            test: async () => (await client.readContract({ address: deployment.positionManager, abi: NPM_ABI, functionName: 'ownerOf', args: [pos.id] })).toLowerCase() === account.toLowerCase(),
            error: 'Unstake confirmed, but the RPC still shows the NFT in the gauge. Retry in a moment.',
          },
        });
      }
      // Re-read right before building minimums: amounts move with the price.
      const live = (await fetchV3Positions(client, account, deployment, [pos.id]))[0] ?? pos;
      if (live.liquidity > 0n || live.fees0 > 0n || live.fees1 > 0n) {
        setStepMsg('Withdrawing your liquidity and fees…');
        await runCalls(config, {
          account, calls: buildRemove(live, 10_000, slippage, account, deployment), label: `Rebalance · withdraw ${pos.symbol0}/${pos.symbol1}`, track, chainId,
          verify: {
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
        tokenA={pos.token0}
        tokenB={pos.token1}
        dex={dex}
        chainId={chainId as LpChainId}
        initialFee={pos.protocol === 'aerodrome-cl' || pos.protocol === 'ramses-v3' || pos.protocol === 'up-v3' ? pos.tickSpacing : pos.fee}
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
        <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 440, background: 'rgba(10,10,15,0.98)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 28, padding: '20px 20px calc(24px + env(safe-area-inset-bottom, 0px))' }}>
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
            <Step n={2} title="Pick any new range and add">
              <div>The full Add liquidity sheet opens for this pool: presets or custom bounds, one-token smart fit, split ranges{pos.staked || pos.stakeable ? `, and restake for ${(pos.staked ?? pos.stakeable)?.rewardSymbol ?? 'rewards'}` : ''}.</div>
            </Step>
          </div>

          {err && <div style={{ color: btb.loss, fontSize: 12, marginTop: 12 }}>{err}</div>}

          <div style={{ marginTop: 16 }}>
            <Button variant="success" size="md" onClick={withdraw} loading={busy} disabled={busy}>
              {busy ? (stepMsg || 'Confirming…') : pos.staked ? 'Unstake, withdraw & choose range' : 'Withdraw & choose new range'}
            </Button>
          </div>
          <div style={{ color: btb.textDim, fontSize: 10.5, marginTop: 10, lineHeight: 1.5 }}>
            {pos.staked ? 'Two' : 'One'} wallet confirmation{pos.staked ? 's' : ''} now, then the add step has its own. Withdrawal is slippage-protected at {slippage / 100}%.
          </div>
        </div>
      </div>
    </Portal>
  );
}

function Step({ n, title, active, children }: { n: number; title: string; active?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 12, background: active ? 'rgba(82,227,164,0.06)' : 'rgba(255,255,255,0.04)', border: `1px solid ${active ? 'rgba(82,227,164,0.3)' : 'rgba(255,255,255,0.07)'}`, borderRadius: 14, padding: '12px 14px' }}>
      <span style={{ width: 24, height: 24, borderRadius: 8, flexShrink: 0, background: 'rgba(82,227,164,0.18)', color: btb.green, fontSize: 12, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{n}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ color: btb.text, fontSize: 13.5, fontWeight: 700 }}>{title}</div>
        <div style={{ color: btb.textMuted, fontSize: 12, lineHeight: 1.5, marginTop: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>{children}</div>
      </div>
    </div>
  );
}
