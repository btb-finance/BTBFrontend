'use client';
import { useState } from 'react';
import { useScrollLock } from '../lib/useScrollLock';
import { useConfig } from 'wagmi';
import { getPublicClient } from 'wagmi/actions';
import { useAction, useQuery } from 'convex/react';
import type { PublicClient } from 'viem';
import { api } from '../../convex/_generated/api';
import { Portal } from './Portal';
import { Button } from './Button';
import { Icon } from './Icon';
import { btb } from './design-tokens';
import { BtbBalanceLine, TopUpButton, fmtBtb } from './FastAlerts';
import { useSidebar } from '../lib/SidebarContext';
import { useTx } from '../lib/TxTracker';
import { runCalls } from '../lib/txRunner';
import { useWalletSession } from '../lib/session';
import { useAlertCredit } from '../lib/alerts';
import { readableError } from '../lib/errorText';
import type { LiquidityPosition } from '@/protocols/types';
import { buildUnstakeCalls } from '@/protocols/staking';
import {
  CHECK_BTB, CHECK_INTERVALS, DEFAULT_INTERVAL, REBALANCE_USD, autoLabel, autoSupport, buildEnableCalls, compoundMinUsd, dailyCheckBtb, enableWhenVisible,
  intervalLabel, rebalanceBtb,
} from '../lib/autoRebalance';

/** Pill row for picking how often a position is checked. Shared with the manage panel. */
export function IntervalPills({ value, onChange, disabled }: { value: number; onChange: (min: number) => void; disabled?: boolean }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {CHECK_INTERVALS.map((min) => {
        const on = min === value;
        return (
          <button key={min} type="button" disabled={disabled} onClick={() => onChange(min)} style={{
            height: 30, padding: '0 12px', borderRadius: 999, fontFamily: 'inherit', fontSize: 12, fontWeight: 800, cursor: disabled ? 'default' : 'pointer',
            color: on ? btb.text : btb.textMuted,
            background: on ? 'rgba(var(--green-rgb), 0.18)' : 'rgba(var(--fg-rgb), 0.04)',
            border: on ? '1px solid rgba(var(--green-rgb), 0.45)' : '1px solid rgba(var(--fg-rgb), 0.08)',
          }}>{intervalLabel(min)}</button>
        );
      })}
    </div>
  );
}

/**
 * Turn on auto-rebalance for one position: pick how often it is checked, see
 * what it costs, confirm once. The position moves into the owner's own V6
 * wallet, which the BTB agent can only rebalance, never empty.
 */
export function AutoRebalanceSheet({ pos, account, onClose, onDone }: {
  pos: LiquidityPosition;
  account: `0x${string}`;
  onClose: () => void;
  onDone: () => void | Promise<void>;
}) {
  useScrollLock(true);
  const { width: sidebarWidth } = useSidebar();
  const config = useConfig();
  const { track } = useTx();
  const session = useWalletSession(account);
  const credit = useAlertCredit(account, { withTreasury: true });
  const freeActions = useQuery(api.autoRebalance.listForAddress, { address: account })?.freeActions ?? 0;
  const enable = useAction(api.autoRebalanceActions.enable);
  const [interval, setIntervalMin] = useState<number>(DEFAULT_INTERVAL);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [compound, setCompound] = useState(false);

  const support = autoSupport(pos);
  const chainId = pos.chainId ?? 1;
  const perRebalance = rebalanceBtb(chainId);
  const perDay = dailyCheckBtb(interval);
  const label = autoLabel(pos);

  async function start() {
    if (!support) return;
    setErr(null);
    try {
      setBusy('Signing in');
      const sessionToken = await session.ensure();
      setBusy('Preparing');
      const client = getPublicClient(config, { chainId: chainId as never }) as PublicClient;
      const { calls } = await buildEnableCalls(client, account, pos.id, support, buildUnstakeCalls(pos, account));
      setBusy('Confirm in your wallet');
      await runCalls(config, { account, calls, label: `Auto-rebalance ${pos.symbol0}/${pos.symbol1}`, track, chainId });
      setBusy('Starting');
      const res = await enableWhenVisible(() => enable({
        sessionToken, chainId, positionManager: support.positionManager, tokenId: pos.id.toString(), label,
        gauge: support.gauge, intervalMin: interval, compound: !pos.staked && compound,
      }));
      if (!res.ok) { if (/sign-in expired/i.test(res.reason)) session.forget(); throw new Error(res.reason); }
      await onDone();
      onClose();
    } catch (e) {
      setErr(readableError(e, 'Could not turn on auto-rebalance.'));
    } finally {
      setBusy(null);
    }
  }

  const line = (text: React.ReactNode) => <div style={{ color: btb.textMuted, fontSize: 12.5, lineHeight: 1.55 }}>{text}</div>;
  const box: React.CSSProperties = { background: 'rgba(var(--fg-rgb), 0.04)', border: '1px solid rgba(var(--fg-rgb), 0.07)', borderRadius: 14, padding: '12px 14px' };

  return (
    <Portal>
      <div onClick={busy ? undefined : onClose} style={{ position: 'fixed', top: 0, left: sidebarWidth, right: 0, bottom: 0, zIndex: 320, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', overflowY: 'auto' }}>
        <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 460, background: 'rgba(var(--bg-rgb), 0.98)', border: '1px solid rgba(var(--fg-rgb), 0.1)', borderRadius: 28, padding: '20px 20px calc(24px + env(safe-area-inset-bottom, 0px))' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={{ color: btb.text, fontSize: 19, fontWeight: 800, letterSpacing: -0.4 }}>Auto-rebalance</div>
            {!busy && <div onClick={onClose} style={{ cursor: 'pointer' }}><Icon name="close" size={16} color={btb.textMuted}/></div>}
          </div>
          <div style={{ color: btb.textMuted, fontSize: 13, marginBottom: 14 }}>{label}{pos.staked ? `, staked for ${pos.staked.rewardSymbol}` : ''}</div>

          {!support ? (
            line(pos.staked?.kind === 'masterchef'
              ? 'This position is staked in a farm the auto wallet does not support. Unstake it first.'
              : 'Auto-rebalance works for Aerodrome and Uniswap V3 positions on Base, and UP, Giga and Uniswap V3 positions on Robinhood Chain.')
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ ...box, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ color: btb.text, fontSize: 13.5, fontWeight: 800 }}>How it works</div>
                {line('Your position moves into your own auto wallet. Only you can withdraw it, and it can only go back to you.')}
                {line('We check it as often as you choose. When the price leaves your range, we move it right next to the price with the same width. No swap, so nothing is sold.')}
                {line('A short spike does not count: the price has to stay outside for about 10 minutes first.')}
                {pos.staked && line(`It stays staked and keeps earning ${pos.staked.rewardSymbol} inside the auto wallet.`)}
              </div>

              <div>
                <div style={{ color: btb.text, fontSize: 13.5, fontWeight: 800, marginBottom: 8 }}>Check every</div>
                <IntervalPills value={interval} onChange={setIntervalMin} disabled={!!busy}/>
                <div style={{ color: btb.textDim, fontSize: 11.5, marginTop: 6 }}>Tight ranges go out of range often, so check them more often. It is your choice.</div>
              </div>

              {!pos.staked && (
                <div onClick={() => !busy && setCompound((c) => !c)} style={{ ...box, cursor: busy ? 'default' : 'pointer', display: 'flex', gap: 10, alignItems: 'flex-start', borderColor: compound ? 'rgba(var(--green-rgb), 0.35)' : undefined }}>
                  <span style={{ width: 18, height: 18, borderRadius: 6, flexShrink: 0, marginTop: 1, background: compound ? btb.green : 'transparent', border: `1px solid ${compound ? btb.green : 'rgba(var(--fg-rgb), 0.3)'}` }}/>
                  <div>
                    <div style={{ color: btb.text, fontSize: 13.5, fontWeight: 800 }}>Also auto-compound fees</div>
                    {line(`Put the fees back into the position once they are worth $${compoundMinUsd(chainId).toFixed(2)} (5 times the compound price), at most every 6 hours. Same price as a rebalance, only when it happens.`)}
                  </div>
                </div>
              )}

              <div style={{ ...box, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ color: btb.text, fontSize: 13.5, fontWeight: 800 }}>What it costs</div>
                {freeActions > 0 && (
                  <div style={{ color: btb.green, fontSize: 12.5, fontWeight: 750, lineHeight: 1.5 }}>
                    Try it free: your next {freeActions} rebalance{freeActions === 1 ? '' : 's'} or compound{freeActions === 1 ? '' : 's'} cost nothing, and checks are free until they are used. No BTB needed to start.
                  </div>
                )}
                <CostRow label="Each check" value={`${CHECK_BTB} BTB`}/>
                <CostRow label={`Checks every ${intervalLabel(interval)}`} value={`about ${fmtBtb(perDay)} BTB a day`}/>
                <CostRow label={compound && !pos.staked ? 'Each rebalance or compound, only when it happens' : 'Each rebalance, only when it happens'} value={`${fmtBtb(perRebalance)} BTB (about $${(REBALANCE_USD[chainId] ?? 0).toFixed(2)})`}/>
                <div style={{ color: btb.textDim, fontSize: 11, lineHeight: 1.5 }}>Paid from your BTB balance, then your unclaimed weekly rewards. A check or rebalance that fails is not charged. When the balance runs out, auto-rebalance pauses and tells you.</div>
              </div>

              <div style={{ ...box, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 180 }}><BtbBalanceLine credit={credit}/></div>
                <TopUpButton credit={credit}/>
                {!credit.loading && freeActions === 0 && credit.total < perRebalance && (
                  <div style={{ width: '100%', color: btb.amber, fontSize: 11.5 }}>A rebalance needs {fmtBtb(perRebalance)} BTB. Checks still run, and it rebalances once you top up.</div>
                )}
              </div>

              {err && <div style={{ color: btb.loss, fontSize: 12 }}>{err}</div>}
              <Button variant="success" size="md" onClick={start} loading={!!busy} disabled={!!busy}>
                {busy ?? 'Turn on auto-rebalance'}
              </Button>
              <div style={{ color: btb.textDim, fontSize: 10.5, lineHeight: 1.5 }}>
                One sign-in the first time, then one confirmation{pos.staked ? ' (unstake, move in and restake together)' : ''}. The first time on this chain it also creates your auto wallet, at the same address on every chain.
              </div>
            </div>
          )}
        </div>
      </div>
    </Portal>
  );
}

function CostRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12.5 }}>
      <span style={{ color: btb.textMuted }}>{label}</span>
      <span style={{ color: btb.text, fontWeight: 700, textAlign: 'right' }}>{value}</span>
    </div>
  );
}
