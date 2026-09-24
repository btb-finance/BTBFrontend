'use client';
import { useEffect, useState } from 'react';
import { useConfig } from 'wagmi';
import { getPublicClient } from 'wagmi/actions';
import { useMutation, useQuery } from 'convex/react';
import type { PublicClient } from 'viem';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { btb } from './design-tokens';
import { fmtBtb } from './FastAlerts';
import { IntervalPills } from './AutoRebalanceSheet';
import { useTx } from '../lib/TxTracker';
import { runCalls } from '../lib/txRunner';
import { useWalletSession } from '../lib/session';
import { readableError } from '../lib/errorText';
import { AUTO_CHAIN_NAMES, buildSweepCalls, buildTakeOutCalls, intervalLabel, walletGaugeCall } from '../lib/autoRebalance';
import type { LiquidityPosition } from '@/protocols/types';

type Job = NonNullable<ReturnType<typeof useAutoJobs>>['jobs'][number];

export function useAutoJobs(address?: string) {
  return useQuery(api.autoRebalance.listForAddress, address ? { address } : 'skip');
}

function ago(ms: number | null): string {
  if (!ms) return 'not yet';
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

function inTime(ms: number | null): string {
  if (!ms) return '';
  const s = Math.max(0, Math.round((ms - Date.now()) / 1000));
  if (s < 60) return 'in under a minute';
  if (s < 3600) return `in ${Math.ceil(s / 60)} min`;
  return `in ${Math.round(s / 3600)} h`;
}

/** One plain sentence and a colour for where the job stands. */
function statusOf(j: Job): { text: string; tone: string } {
  if (!j.active) return { text: j.note ?? 'Paused', tone: btb.amber };
  if (j.status === 'short') return { text: j.note ?? 'Out of range. Top up to let it rebalance.', tone: btb.amber };
  if (j.status === 'waiting') return { text: j.note ?? 'Out of range, waiting for the price to settle.', tone: btb.amber };
  if (j.lastCheckedAt == null) return { text: 'Starting. The first check runs in a few seconds.', tone: btb.textMuted };
  if (j.note && j.lastInRange === false) return { text: j.note, tone: btb.textMuted };
  if (j.lastInRange === false) return { text: 'Out of range. The next check will rebalance it.', tone: btb.amber };
  return { text: 'In range and earning fees.', tone: btb.green };
}

/**
 * One line above the LP list: how many positions auto-rebalance looks after
 * and the BTB available to pay for it. The positions themselves render in the
 * list like any other, with their auto controls inside.
 */
export function AutoRebalancePanel({ address }: { address?: string }) {
  const data = useAutoJobs(address);
  if (!address || !data || data.jobs.length === 0) return null;
  const paused = data.jobs.filter((j) => !j.active).length;
  return (
    <div style={{ borderRadius: 16, border: '1px solid rgba(var(--green-rgb), 0.25)', background: 'rgba(var(--green-rgb), 0.05)', padding: '10px 12px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
      <div style={{ color: btb.text, fontSize: 13, fontWeight: 800 }}>
        Auto-rebalance on {data.jobs.length} position{data.jobs.length === 1 ? '' : 's'}{paused ? `, ${paused} paused` : ''}
      </div>
      <div style={{ color: btb.textMuted, fontSize: 11.5 }}>{fmtBtb(data.balance)} BTB available</div>
    </div>
  );
}

export type AutoJob = Job;

/** The auto box inside an auto-rebalanced position's card: where it stands, what it cost, and the owner's controls. */
export function AutoJobControls({ job, pos, address, canTransact, onChanged }: { job: Job; pos?: LiquidityPosition; address: string; canTransact: boolean; onChanged?: () => void | Promise<void> }) {
  const config = useConfig();
  const { track } = useTx();
  const session = useWalletSession(address);
  const changeInterval = useMutation(api.autoRebalance.changeInterval);
  const setActive = useMutation(api.autoRebalance.setActive);
  const stop = useMutation(api.autoRebalance.stop);
  const setGauge = useMutation(api.autoRebalance.setGauge);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const status = statusOf(job);
  const id = job.id as Id<'autoRebalances'>;
  // Re-render every 30 s so "checked 3 min ago" stays true.
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 30_000); return () => clearInterval(t); }, []);

  async function withSession<T extends { ok: boolean; reason?: string }>(label: string, fn: (token: string) => Promise<T>) {
    setErr(null); setBusy(label);
    try {
      const token = await session.ensure();
      const res = await fn(token);
      if (!res.ok) { if (/sign-in expired/i.test(res.reason ?? '')) session.forget(); throw new Error(res.reason); }
      return true;
    } catch (e) { setErr(readableError(e, 'Something went wrong; try again.')); return false; }
    finally { setBusy(null); }
  }

  async function onChain(label: string, build: (client: PublicClient) => Promise<{ to: `0x${string}`; data?: `0x${string}` }[]>) {
    const client = getPublicClient(config, { chainId: job.chainId as never }) as PublicClient;
    const calls = await build(client);
    if (calls.length === 0) return;
    await runCalls(config, { account: address as `0x${string}`, calls, label, track, chainId: job.chainId });
  }

  async function takeOut() {
    setErr(null); setBusy('Taking it out');
    try {
      await onChain(`Take out ${job.label}`, (c) => buildTakeOutCalls(c, job));
      setBusy(null);
      await withSession('Stopping', (t) => stop({ sessionToken: t, id }));
      await onChanged?.();
    } catch (e) { setErr(readableError(e, 'Could not take the position out.')); }
    finally { setBusy(null); }
  }

  /** Stake or unstake inside the auto wallet, and tell auto-rebalance whether to keep it staked. */
  async function gauge(kind: 'stake' | 'unstake' | 'claim') {
    const target = kind === 'stake' ? pos?.stakeable?.gauge : (pos?.staked?.gauge ?? job.gauge ?? undefined);
    if (!target) return;
    setErr(null); setBusy(kind === 'stake' ? 'Staking' : kind === 'unstake' ? 'Unstaking' : 'Claiming');
    try {
      await onChain(kind === 'claim' ? `Claim ${pos?.staked?.rewardSymbol ?? 'rewards'}` : `${kind === 'stake' ? 'Stake' : 'Unstake'} ${job.label}`,
        async () => [walletGaugeCall(job.wallet, kind, target, job.tokenId)]);
      setBusy(null);
      if (kind !== 'claim') await withSession('Saving', (t) => setGauge({ sessionToken: t, id, gauge: kind === 'stake' ? target : null }));
      await onChanged?.();
    } catch (e) { setErr(readableError(e, 'That did not go through.')); }
    finally { setBusy(null); }
  }

  async function sweep() {
    setErr(null); setBusy('Sending');
    try { await onChain('Send spare tokens', (c) => buildSweepCalls(c, job)); await onChanged?.(); }
    catch (e) { setErr(readableError(e, 'Could not send the spare tokens.')); }
    finally { setBusy(null); }
  }

  const chip = (label: string, onClick: () => void, tone: string = btb.textMuted) => (
    <button type="button" disabled={!!busy || !canTransact} onClick={onClick} style={{
      height: 28, padding: '0 11px', borderRadius: 999, fontFamily: 'inherit', fontSize: 11.5, fontWeight: 800, whiteSpace: 'nowrap',
      cursor: busy || !canTransact ? 'default' : 'pointer', color: busy || !canTransact ? btb.textDim : tone,
      background: 'rgba(var(--fg-rgb), 0.04)', border: '1px solid rgba(var(--fg-rgb), 0.08)',
    }}>{label}</button>
  );

  return (
    <div style={{ marginTop: 12, borderRadius: 14, border: '1px solid rgba(var(--green-rgb), 0.25)', background: 'rgba(var(--green-rgb), 0.05)', padding: '10px 12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: btb.text, fontSize: 13, fontWeight: 800 }}>Auto-rebalance{job.gauge ? ', staked' : ''}</div>
          <div style={{ color: status.tone, fontSize: 12, marginTop: 2 }}>{status.text}</div>
        </div>
        <div style={{ color: btb.textMuted, fontSize: 11.5, textAlign: 'right' }}>
          <div>Every {intervalLabel(job.intervalMin)}{job.active && job.nextCheckAt ? `, next ${inTime(job.nextCheckAt)}` : ''}</div>
          <div>Checked {ago(job.lastCheckedAt)}</div>
        </div>
      </div>
      <div style={{ color: btb.textDim, fontSize: 11.5, marginTop: 6 }}>
        {job.rebalances} rebalance{job.rebalances === 1 ? '' : 's'}{job.lastRebalancedAt ? ` (last ${ago(job.lastRebalancedAt)})` : ''}, {fmtBtb(job.spentBtb)} BTB used so far, {fmtBtb(job.rebalanceBtb)} BTB per rebalance on {AUTO_CHAIN_NAMES[job.chainId]}
      </div>
      {editing && (
        <div style={{ marginTop: 8 }}>
          <IntervalPills value={job.intervalMin} disabled={!!busy} onChange={async (min) => {
            if (await withSession('Saving', (t) => changeInterval({ sessionToken: t, id, intervalMin: min }))) setEditing(false);
          }}/>
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
        {chip(editing ? 'Done' : 'Change interval', () => setEditing((e) => !e))}
        {job.active
          ? chip('Pause', () => withSession('Pausing', (t) => setActive({ sessionToken: t, id, active: false })), btb.amber)
          : chip('Resume', () => withSession('Resuming', (t) => setActive({ sessionToken: t, id, active: true })), btb.green)}
        {pos?.stakeable && !pos.staked && chip(`Stake for ${pos.stakeable.rewardSymbol ?? 'rewards'}`, () => gauge('stake'), btb.green)}
        {pos?.staked && pos.staked.earned > 0n && chip(`Claim ${pos.staked.rewardSymbol}`, () => gauge('claim'), btb.green)}
        {(pos?.staked || (job.gauge && !pos?.stakeable)) && chip('Unstake', () => gauge('unstake'), btb.amber)}
        {chip('Send spare tokens to me', sweep)}
        {chip('Take out', takeOut, btb.loss)}
        {busy && <span style={{ color: btb.textMuted, fontSize: 11.5, alignSelf: 'center' }}>{busy}</span>}
      </div>
      {err && <div style={{ color: btb.loss, fontSize: 11.5, marginTop: 6 }}>{err}</div>}
    </div>
  );
}
