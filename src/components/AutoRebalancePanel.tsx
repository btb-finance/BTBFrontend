'use client';
import { useEffect, useState } from 'react';
import { useConfig } from 'wagmi';
import { getPublicClient } from 'wagmi/actions';
import { useAction, useMutation, useQuery } from 'convex/react';
import { encodeFunctionData, parseAbi, type PublicClient } from 'viem';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { btb } from './design-tokens';
import { fmtBtb } from './FastAlerts';
import { IntervalPills } from './AutoRebalanceSheet';
import { useTx } from '../lib/TxTracker';
import { runCalls } from '../lib/txRunner';
import { useWalletSession } from '../lib/session';
import { readableError } from '../lib/errorText';
import { AUTO_CHAIN_NAMES, LATEST_WALLET_VERSION, MAX_ACTIONS_PER_DAY, WALLET_ABI, REWARD_COMPOUND_CHAINS, REWARD_TOKEN, buildSweepCalls, buildTakeOutCalls, compoundMinUsd, intervalLabel, isFarmManager, stakeAdapterFor, swapAdapterCalls, upgradeCalls, walletGaugeCall, walletVersion } from '../lib/autoRebalance';
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

const OWNER_OF_ABI = parseAbi(['function ownerOf(uint256 tokenId) view returns (address)']);

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    <WalletUpdates address={address} jobs={data.jobs}/>
    <div style={{ borderRadius: 16, border: '1px solid rgba(var(--green-rgb), 0.25)', background: 'rgba(var(--green-rgb), 0.05)', padding: '10px 12px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
      <div style={{ color: btb.text, fontSize: 13, fontWeight: 800 }}>
        Auto-rebalance on {data.jobs.length} position{data.jobs.length === 1 ? '' : 's'}{paused ? `, ${paused} paused` : ''}
      </div>
      <div style={{ color: btb.textMuted, fontSize: 11.5 }}>
        {data.freeActions > 0 ? <span style={{ color: btb.green, fontWeight: 750 }}>{data.freeActions} free action{data.freeActions === 1 ? '' : 's'} left, </span> : null}
        {fmtBtb(data.balance)} BTB available
      </div>
    </div>
    </div>
  );
}

/** What each auto wallet version adds, in plain words; an update shows everything newer than the wallet. */
const WALLET_CHANGES: { version: number; text: string }[] = [
  { version: 2, text: 'Giga farm staking: Giga positions can be staked for GIGA inside the auto wallet and stay staked through every rebalance.' },
  { version: 3, text: 'Withdraw everything in one confirmation: every leftover token and any ETH come out together, and a broken or spam token is skipped instead of blocking the rest.' },
];
const WALLET_SAME = 'Nothing else changes: same address, same positions, same settings. Only you can upgrade, and only to versions BTB has approved.';

/** An update box for each auto wallet still on an older version, with a one-confirmation upgrade. */
function WalletUpdates({ address, jobs }: { address: string; jobs: Job[] }) {
  const config = useConfig();
  const { track } = useTx();
  const [old, setOld] = useState<{ chainId: number; wallet: string; version: number }[]>([]);
  const [busy, setBusy] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const walletsKey = [...new Set(jobs.map((j) => `${j.chainId}:${j.wallet.toLowerCase()}`))].sort().join(',');

  useEffect(() => {
    let live = true;
    (async () => {
      const found: { chainId: number; wallet: string; version: number }[] = [];
      await Promise.all(walletsKey.split(',').filter(Boolean).map(async (k) => {
        const [c, wallet] = k.split(':');
        const client = getPublicClient(config, { chainId: Number(c) as never }) as PublicClient | undefined;
        const version = client ? await walletVersion(client, wallet) : LATEST_WALLET_VERSION;
        if (version < LATEST_WALLET_VERSION) found.push({ chainId: Number(c), wallet, version });
      }));
      if (live) setOld(found.sort((a, b) => a.chainId - b.chainId));
    })();
    return () => { live = false; };
  }, [walletsKey, nonce, config]);

  async function upgrade(chainId: number, wallet: string) {
    setErr(null); setBusy(chainId);
    try {
      const client = getPublicClient(config, { chainId: chainId as never }) as PublicClient;
      const calls = await upgradeCalls(client, wallet);
      if (calls.length) await runCalls(config, { account: address as `0x${string}`, calls, label: `Update auto wallet on ${AUTO_CHAIN_NAMES[chainId] ?? 'chain'}`, track, chainId });
      setNonce((n) => n + 1);
    } catch (e) { setErr(readableError(e, 'The update did not go through.')); }
    finally { setBusy(null); }
  }

  if (old.length === 0) return null;
  return (
    <div style={{ borderRadius: 16, border: '1px solid rgba(var(--fg-rgb), 0.14)', background: 'rgba(var(--fg-rgb), 0.04)', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ color: btb.text, fontSize: 13.5, fontWeight: 800 }}>Auto wallet update available (version {LATEST_WALLET_VERSION})</div>
      {WALLET_CHANGES.filter((c) => c.version > Math.min(...old.map((o) => o.version))).map((c) => <div key={c.text} style={{ color: btb.textMuted, fontSize: 12, lineHeight: 1.5 }}>{c.text}</div>)}
      <div style={{ color: btb.textMuted, fontSize: 12, lineHeight: 1.5 }}>{WALLET_SAME}</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {old.map((o) => (
          <button key={o.chainId} disabled={busy != null} onClick={() => upgrade(o.chainId, o.wallet)}
            style={{ cursor: busy != null ? 'default' : 'pointer', border: 'none', borderRadius: 999, padding: '7px 14px', background: btb.green, color: '#000', fontSize: 12, fontWeight: 800, opacity: busy != null && busy !== o.chainId ? 0.5 : 1 }}>
            {busy === o.chainId ? 'Updating…' : `Update on ${AUTO_CHAIN_NAMES[o.chainId] ?? 'chain'}`}
          </button>
        ))}
      </div>
      {err && <div style={{ color: btb.loss, fontSize: 12 }}>{err}</div>}
    </div>
  );
}

export type AutoJob = Job;

/** The auto box inside an auto-rebalanced position's card: where it stands, what it cost, and the owner's controls. */
export function AutoJobControls({ job, pos, address, canTransact, onChanged, onAdd }: { job: Job; pos?: LiquidityPosition; address: string; canTransact: boolean; onChanged?: () => void | Promise<void>; onAdd?: () => void }) {
  const config = useConfig();
  const { track } = useTx();
  const session = useWalletSession(address);
  const changeInterval = useMutation(api.autoRebalance.changeInterval);
  const setActive = useMutation(api.autoRebalance.setActive);
  const syncJob = useAction(api.autoRebalanceActions.syncJob);
  const setCompound = useMutation(api.autoRebalance.setCompound);
  const isStaked = !!pos?.staked || !!job.gauge;
  // Giga's farm pays GIGA (sold through USDG); gauges pay the chain's reward token.
  const farm = isFarmManager(job.chainId, job.positionManager);
  const rewardsOk = (REWARD_COMPOUND_CHAINS as readonly number[]).includes(job.chainId);
  const rewardSym = pos?.staked?.rewardSymbol ?? (farm ? 'GIGA' : REWARD_TOKEN[job.chainId]?.symbol ?? 'rewards');

  /** Auto-compound on or off. Staked on Base: first make sure the wallet may sell rewards (one confirmation, once). */
  async function toggleCompound() {
    const on = !job.compound;
    if (on && isStaked && rewardsOk) {
      setErr(null); setBusy('Allowing reward sales');
      try { await onChain('Allow selling rewards', (c) => swapAdapterCalls(c, job.wallet, job.chainId)); }
      catch (e) { setErr(readableError(e, 'That did not go through.')); setBusy(null); return; }
      setBusy(null);
    }
    await withSession('Saving', (t) => setCompound({ sessionToken: t, id, on }));
  }
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const status = statusOf(job);
  const id = job.id as Id<'autoRebalances'>;
  // Re-render every 30 s so "checked 3 min ago" stays true.
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 30_000); return () => clearInterval(t); }, []);

  // The wallet's cap on agent actions per UTC day, shown once it is getting close.
  const [details, setDetails] = useState(false);
  const [limit, setLimit] = useState<{ used: number; max: number } | null>(null);
  const [limitNonce, setLimitNonce] = useState(0);
  useEffect(() => {
    const client = getPublicClient(config, { chainId: job.chainId as never }) as PublicClient | undefined;
    if (!client) return;
    const w = job.wallet as `0x${string}`;
    Promise.all([
      client.readContract({ address: w, abi: WALLET_ABI, functionName: 'actionsToday' }),
      client.readContract({ address: w, abi: WALLET_ABI, functionName: 'actionDay' }),
      client.readContract({ address: w, abi: WALLET_ABI, functionName: 'maxActionsPerDay' }),
    ]).then(([used, day, max]) => setLimit({ used: Number(day) === Math.floor(Date.now() / 86_400_000) ? Number(used) : 0, max: Number(max) }))
      .catch(() => {});
  }, [config, job.chainId, job.wallet, job.lastCheckedAt, limitNonce]);

  async function raiseLimit() {
    setErr(null); setBusy('Raising the limit');
    try {
      await onChain(`Raise daily agent limit to ${MAX_ACTIONS_PER_DAY}`, async () => [{
        to: job.wallet as `0x${string}`, data: encodeFunctionData({ abi: WALLET_ABI, functionName: 'setMaxActionsPerDay', args: [MAX_ACTIONS_PER_DAY] }),
      }]);
      setLimitNonce((n) => n + 1);
    } catch (e) { setErr(readableError(e, 'The limit was not changed.')); }
    finally { setBusy(null); }
  }

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
    setErr(null); setBusy('Withdrawing');
    let failure: unknown = null;
    try {
      await onChain(`Withdraw ${job.label} from auto wallet`, (c) => buildTakeOutCalls(c, job, address as `0x${string}`));
    } catch (e) { failure = e; }
    // Stop as soon as the position is back with the owner, even when a later step (the leftover tokens) was
    // rejected or failed: otherwise the app keeps showing a position that is no longer in the auto wallet.
    const client = getPublicClient(config, { chainId: job.chainId as never }) as PublicClient | undefined;
    const holder = await client?.readContract({ address: job.positionManager as `0x${string}`, abi: OWNER_OF_ABI, functionName: 'ownerOf', args: [BigInt(job.tokenId)] }).catch(() => null);
    const out = !failure || holder?.toLowerCase() === address.toLowerCase();
    try {
      if (out) {
        setBusy(null);
        await syncJob({ id }).catch(() => null);
        await onChanged?.();
      }
      if (failure) setErr(out
        ? 'The position is back in your wallet. The leftover tokens were not sent; they stay in your auto wallet until you withdraw them.'
        : readableError(failure, 'Could not take the position out.'));
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
        async (c) => [
          // Farm staking needs wallet version 2; an older wallet is upgraded in the same confirmation.
          ...(kind === 'stake' && pos?.stakeable?.kind === 'masterchef' ? await upgradeCalls(c, job.wallet) : []),
          walletGaugeCall(job.wallet, kind, target, job.tokenId, stakeAdapterFor(job.chainId, job.positionManager)),
        ]);
      setBusy(null);
      // The server reads the stake from the chain: no sign-in, so a Safe does not need a second multisig message.
      if (kind !== 'claim') await syncJob({ id }).catch(() => null);
      await onChanged?.();
    } catch (e) { setErr(readableError(e, 'That did not go through.')); }
    finally { setBusy(null); }
  }

  async function sweep() {
    setErr(null); setBusy('Sending');
    // Only loose tokens move: no position changes, so there is nothing to reload.
    try { await onChain('Withdraw leftover tokens', (c) => buildSweepCalls(c, job, false, address as `0x${string}`)); }
    catch (e) { setErr(readableError(e, 'Could not withdraw the leftover tokens.')); }
    finally { setBusy(null); }
  }

  const btn = (label: string, onClick: () => void, tone: string = btb.text, wide = false) => (
    <button type="button" disabled={!!busy || !canTransact} onClick={onClick} style={{
      gridColumn: wide ? '1 / -1' : undefined, minHeight: 36, padding: '6px 10px', borderRadius: 12, fontFamily: 'inherit', fontSize: 12.5, fontWeight: 800,
      lineHeight: 1.2, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0, cursor: busy || !canTransact ? 'default' : 'pointer', color: busy || !canTransact ? btb.textDim : tone,
      background: 'rgba(var(--fg-rgb), 0.05)', border: '1px solid rgba(var(--fg-rgb), 0.1)',
    }}>{label}</button>
  );
  const limitWarning = !!limit && limit.used >= limit.max * 0.75;
  // Buttons before Withdraw leftover; when that makes it the odd one out, it takes the whole row.
  const gridCount = [onAdd && pos, true, true, !isStaked || rewardsOk, pos?.stakeable && !pos.staked, pos?.staked && pos.staked.earned > 0n,
    pos?.staked || (job.gauge && !pos?.stakeable), limit && limit.max < MAX_ACTIONS_PER_DAY && limitWarning].filter(Boolean).length;
  const oddButtons = gridCount % 2 === 0;
  const compoundText = isStaked && !rewardsOk
    ? 'Compounding staking rewards is not available on this chain yet.'
    : isStaked
      ? job.compound
        ? `Auto-compound ${rewardSym} on: once the ${rewardSym} is worth $${compoundMinUsd(job.chainId).toFixed(2)}, it is unstaked, the ${rewardSym} is sold for this pair at no worse than the market average less ${job.chainId === 4663 ? 3 : 1}%, added to the position, and staked again. At most every 6 hours${job.lastCompoundedAt ? `, last ${ago(job.lastCompoundedAt)}` : ''}.`
        : `Auto-compound ${rewardSym} off: ${rewardSym} collects in your auto wallet.`
      : job.compound
        ? `Auto-compound on: fees go back into the position once they are worth $${compoundMinUsd(job.chainId).toFixed(2)} (5 times the compound price), at most every 6 hours${job.lastCompoundedAt ? `, last ${ago(job.lastCompoundedAt)}` : ''}.`
        : 'Auto-compound off: fees wait in the position until you collect them.';

  return (
    <div style={{ marginTop: 12, borderRadius: 14, border: '1px solid rgba(var(--green-rgb), 0.25)', background: 'rgba(var(--green-rgb), 0.05)', padding: '10px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ color: btb.text, fontSize: 13, fontWeight: 800 }}>Auto-rebalance{job.gauge ? ', staked' : ''}</div>
        <button type="button" onClick={() => setDetails((d) => !d)} style={{ padding: 0, border: 'none', background: 'transparent', color: btb.textMuted, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
          {details ? 'Hide details' : 'Details'}
        </button>
      </div>
      <div style={{ color: status.tone, fontSize: 12, marginTop: 2, lineHeight: 1.4 }}>{status.text}</div>
      {/* One short line; everything else is under Details so the card stays short on a phone. */}
      <div style={{ color: btb.textMuted, fontSize: 11.5, marginTop: 4, lineHeight: 1.4 }}>
        Every {intervalLabel(job.intervalMin)} · {job.rebalances} rebalance{job.rebalances === 1 ? '' : 's'} · {fmtBtb(job.spentBtb)} BTB used
      </div>
      {limitWarning && (
        <div style={{ color: limit!.used >= limit!.max ? btb.amber : btb.textDim, fontSize: 11.5, marginTop: 4 }}>
          Agent actions today: {limit!.used} of {limit!.max} (a staked rebalance uses 3; resets at midnight UTC).
        </div>
      )}
      {details && (
        <div style={{ color: btb.textDim, fontSize: 11.5, marginTop: 4, lineHeight: 1.5, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div>Checked {ago(job.lastCheckedAt)}{job.active && job.nextCheckAt ? `, next ${inTime(job.nextCheckAt)}` : ''}. {job.rebalances} rebalance{job.rebalances === 1 ? '' : 's'}{job.lastRebalancedAt ? ` (last ${ago(job.lastRebalancedAt)})` : ''}{job.compounds > 0 ? `, ${job.compounds} compound${job.compounds === 1 ? '' : 's'}` : ''}, {fmtBtb(job.spentBtb)} BTB used so far, {fmtBtb(job.rebalanceBtb)} BTB per rebalance or compound on {AUTO_CHAIN_NAMES[job.chainId]}.</div>
          <div style={{ color: job.compound && !isStaked ? btb.green : btb.textDim }}>{compoundText}</div>
        </div>
      )}
      {editing && (
        <div style={{ marginTop: 8 }}>
          <IntervalPills value={job.intervalMin} disabled={!!busy} onChange={async (min) => {
            if (await withSession('Saving', (t) => changeInterval({ sessionToken: t, id, intervalMin: min }))) setEditing(false);
          }}/>
        </div>
      )}
      {/* Viewing someone else's wallet: no controls at all. The server refuses them anyway (signed owner only). */}
      {!canTransact && <div style={{ color: btb.textDim, fontSize: 11.5, marginTop: 8 }}>Viewing only. Only the owner's wallet can change this.</div>}
      {canTransact && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6, marginTop: 10 }}>
          {onAdd && pos && btn('Increase liquidity', onAdd, btb.green)}
          {btn(editing ? 'Done' : 'Change interval', () => setEditing((e) => !e))}
          {job.active
            ? btn('Pause', () => withSession('Pausing', (t) => setActive({ sessionToken: t, id, active: false })), btb.amber)
            : btn('Resume', () => withSession('Resuming', (t) => setActive({ sessionToken: t, id, active: true })), btb.green)}
          {(!isStaked || rewardsOk) && btn(`Compound: ${job.compound ? 'on' : 'off'}`, toggleCompound, job.compound ? btb.green : btb.textMuted)}
          {pos?.stakeable && !pos.staked && btn(`Stake for ${pos.stakeable.rewardSymbol ?? 'rewards'}`, () => gauge('stake'), btb.green)}
          {pos?.staked && pos.staked.earned > 0n && btn(`Claim ${pos.staked.rewardSymbol}`, () => gauge('claim'), btb.green)}
          {(pos?.staked || (job.gauge && !pos?.stakeable)) && btn('Unstake', () => gauge('unstake'), btb.amber)}
          {limit && limit.max < MAX_ACTIONS_PER_DAY && limitWarning && btn(`Raise daily limit to ${MAX_ACTIONS_PER_DAY}`, raiseLimit, btb.green)}
          {btn('Withdraw leftover', sweep, btb.textMuted, oddButtons)}
          {btn('Withdraw LP and stop auto', takeOut, btb.loss, true)}
        </div>
      )}
      {busy && <div style={{ color: btb.textMuted, fontSize: 11.5, marginTop: 6 }}>{busy}</div>}
      {err && <div style={{ color: btb.loss, fontSize: 11.5, marginTop: 6 }}>{err}</div>}
    </div>
  );
}
