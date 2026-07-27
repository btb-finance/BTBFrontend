'use client';
import { useMemo, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { QUESTS, CATEGORY_LABELS, type Quest } from '../../convex/questCatalog';
import { Glass } from './Glass';
import { SectionHeader } from './SectionHeader';
import { Icon } from './Icon';
import { Button } from './Button';
import { btb } from './design-tokens';
import { readableError } from '../lib/errorText';

const MS_PER_DAY = 86_400_000;
const WEEK_MS = 604_800_000;
const FIRST_FRIDAY_MS = 86_400_000;

/** Mirrors convex/rewards.ts — epochs are anchored to Friday 00:00 UTC. */
const epochIdAt = (t: number) => Math.floor((t - FIRST_FRIDAY_MS) / WEEK_MS);

type Submission = {
  _id: string;
  questId: string;
  status: string;
  xp: number;
  submittedAt: number;
  reviewNote?: string;
};

const fmt = (n: number) => n.toLocaleString('en-US');

function countdown(ms: number) {
  if (ms <= 0) return 'now';
  const d = Math.floor(ms / MS_PER_DAY);
  const h = Math.floor((ms % MS_PER_DAY) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/** BTB wei → a short human string. Payouts are 18-decimal. */
function formatBtb(raw: string) {
  const value = BigInt(raw);
  const whole = value / 10n ** 18n;
  const frac = (value % 10n ** 18n) / 10n ** 14n; // 4 dp
  return `${fmt(Number(whole))}.${frac.toString().padStart(4, '0')}`;
}

/**
 * Where a quest stands for this wallet right now. Cadence rules mirror
 * convex/quests.ts — the server re-checks all of them, this only decides what
 * the row looks like.
 */
function questState(quest: Quest, submissions: Submission[], now: number) {
  const mine = submissions.filter(s => s.questId === quest.id);
  const open = mine.filter(s => s.status !== 'rejected');
  const lastRejected = mine.find(s => s.status === 'rejected');

  if (quest.verify === 'auto') return { kind: 'auto' as const, note: null };
  if (open.some(s => s.status === 'pending')) return { kind: 'pending' as const, note: null };
  if (quest.cadence === 'once' && open.length > 0) return { kind: 'done' as const, note: null };

  if (quest.cadence === 'daily') {
    const since = now - (now % MS_PER_DAY);
    if (open.some(s => s.submittedAt >= since)) {
      return { kind: 'cooldown' as const, note: countdown(since + MS_PER_DAY - now) };
    }
  }
  if (quest.cadence === 'weekly') {
    const epoch = epochIdAt(now);
    if (open.some(s => epochIdAt(s.submittedAt) === epoch)) {
      return { kind: 'cooldown' as const, note: countdown(FIRST_FRIDAY_MS + (epoch + 1) * WEEK_MS - now) };
    }
  }
  return { kind: 'open' as const, note: lastRejected?.reviewNote ?? null };
}

const STATUS_STYLE: Record<string, { label: string; color: string }> = {
  auto:     { label: 'Auto',    color: btb.textDim },
  pending:  { label: 'Review',  color: '#FFB36B' },
  done:     { label: 'Done',    color: '#52E3A4' },
  cooldown: { label: '',        color: btb.textDim },
};

/** One task = one line. Tapping it expands the proof field underneath. */
function QuestRow({
  quest, state, onSubmit, busy, last,
}: {
  quest: Quest;
  state: ReturnType<typeof questState>;
  onSubmit: (proof: string) => Promise<void>;
  busy: boolean;
  last: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [proof, setProof] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submittable = state.kind === 'open';
  const status = STATUS_STYLE[state.kind];

  const send = async () => {
    setError(null);
    if (!proof.trim()) {
      setError(quest.proof === 'text' ? 'Write something first' : 'Add your link first');
      return;
    }
    try {
      await onSubmit(proof);
      setProof('');
      setOpen(false);
    } catch (e) {
      setError(readableError(e, 'Could not submit'));
    }
  };

  return (
    <div style={{
      borderBottom: last ? 'none' : btb.borderSoft,
      opacity: state.kind === 'done' || state.kind === 'cooldown' ? 0.5 : 1,
    }}>
      <div
        onClick={() => submittable && setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 11, padding: '12px 2px',
          cursor: submittable ? 'pointer' : 'default',
        }}
      >
        <Icon name={quest.icon} size={17} color={quest.color}/>

        <span style={{
          flex: 1, minWidth: 0, color: btb.text, fontSize: 14, fontWeight: 600,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {quest.title}
        </span>

        {status?.label && (
          <span style={{ color: status.color, fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
            {status.label}
          </span>
        )}
        {state.kind === 'cooldown' && state.note && (
          <span style={{ color: btb.textDim, fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
            {state.note}
          </span>
        )}

        <span style={{ color: quest.color, fontSize: 13.5, fontWeight: 800, flexShrink: 0, minWidth: 60, textAlign: 'right' }}>
          +{fmt(quest.xp)}
        </span>

        {submittable && (
          <Icon name={open ? 'up' : 'down'} size={15} color={btb.textDim}/>
        )}
      </div>

      {submittable && open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, padding: '0 2px 14px' }}>
          <div style={{ color: btb.textMuted, fontSize: 13, lineHeight: 1.55 }}>{quest.description}</div>
          {state.note && <div style={{ color: '#FFB36B', fontSize: 12.5 }}>Rejected: {state.note}</div>}
          <textarea
            value={proof}
            onChange={e => setProof(e.target.value)}
            placeholder={quest.proofHint ?? 'Paste your proof'}
            rows={quest.proof === 'text' ? 3 : 2}
            style={{
              width: '100%', resize: 'vertical', padding: '9px 11px', borderRadius: 11,
              background: 'rgba(255,255,255,0.06)', border: btb.borderSoft, color: btb.text,
              fontSize: 13.5, fontFamily: 'inherit', outline: 'none',
            }}
          />
          {error && <div style={{ color: btb.loss, fontSize: 12.5 }}>{error}</div>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 1 }}>
            {/* Deliberately not disabled on an empty field: a greyed-out button
                explains nothing, and submit() already answers with the reason. */}
            <Button size="md" variant="success" fullWidth={false} icon="send" loading={busy} onClick={send}>
              Submit
            </Button>
            {quest.link && (
              <Button
                size="md" variant="successSoft" fullWidth={false} icon="launch"
                href={quest.link} target="_blank"
                onClick={e => e.stopPropagation()}
              >
                Open
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function QuestBoard({ address, onConnect }: { address?: string; onConnect: () => void }) {
  const [busyQuest, setBusyQuest] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const now = Date.now();

  const user = useQuery(api.users.getUser, address ? { walletAddress: address } : 'skip');
  const rewards = useQuery(api.rewards.getStatus, address ? { walletAddress: address } : 'skip');
  const submissions = useQuery(api.quests.listForWallet, { walletAddress: address }) as Submission[] | undefined;
  const submit = useMutation(api.quests.submit);
  const requestPayout = useMutation(api.rewards.requestPayout);

  const rows = useMemo(() => submissions ?? [], [submissions]);
  const pendingXp = useMemo(
    () => rows.filter(s => s.status === 'pending').reduce((sum, s) => sum + s.xp, 0),
    [rows],
  );

  const grouped = useMemo(() => {
    const order: Quest['category'][] = ['social', 'content', 'product', 'community'];
    return order.map(category => ({ category, quests: QUESTS.filter(q => q.category === category) }));
  }, []);

  const onSubmitProof = async (questId: string, proof: string) => {
    setBusyQuest(questId);
    try {
      await submit({ walletAddress: address!, questId, proof });
    } finally {
      setBusyQuest(null);
    }
  };

  const claim = async () => {
    setClaimError(null);
    setClaiming(true);
    try {
      await requestPayout({ walletAddress: address! });
    } catch (e) {
      setClaimError(readableError(e, 'Could not enter this week'));
    } finally {
      setClaiming(false);
    }
  };

  const myPoints = rewards?.myPoints ?? 0;
  const share = rewards && rewards.requestedPointsTotal > 0 && rewards.hasRequested
    ? (myPoints / rewards.requestedPointsTotal) * 100
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* XP + weekly entry, one card */}
      <Glass padding={20} radius={22} strong>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <span style={{ color: btb.textMuted, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            XP this week
          </span>
          <span style={{ color: btb.textMuted, fontSize: 13, fontWeight: 600 }}>
            Pays in {rewards ? countdown(rewards.endsAt - now) : '—'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 2 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
            <span style={{ color: btb.text, fontSize: 34, fontWeight: 800, letterSpacing: -1 }}>
              {address ? fmt(Math.round(myPoints)) : '—'}
            </span>
            {pendingXp > 0 && (
              <span style={{ color: '#FFB36B', fontSize: 13, fontWeight: 700 }}>+{fmt(pendingXp)} in review</span>
            )}
          </div>

          {/* An entry needs XP, so below the threshold this is a hint rather
              than a dead button the user cannot do anything about. */}
          {!address ? (
            <Button size="md" variant="successSoft" fullWidth={false} icon="wallet" onClick={onConnect}>Connect</Button>
          ) : rewards?.hasRequested ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: btb.green, fontSize: 13.5, fontWeight: 700, flexShrink: 0 }}>
              <Icon name="check" size={15} color={btb.green}/>
              Entered
            </span>
          ) : myPoints > 0 ? (
            <Button size="md" variant="success" fullWidth={false} icon="gift" loading={claiming} onClick={claim}>
              Enter this week
            </Button>
          ) : (
            <span style={{ color: btb.textDim, fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
              Earn XP to enter
            </span>
          )}
        </div>

        {/* one-line facts */}
        <div style={{
          display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12, paddingTop: 11,
          borderTop: btb.borderSoft, color: btb.textMuted, fontSize: 13, fontWeight: 600,
        }}>
          <span>{rewards ? fmt(rewards.requesterCount) : '—'} entered</span>
          {share !== null && (
            <>
              <span style={{ color: btb.textDim }}>·</span>
              <span style={{ color: btb.green }}>your share ≈ {share.toFixed(1)}%</span>
            </>
          )}
          <span style={{ color: btb.textDim }}>·</span>
          <span>{address ? fmt(user?.currentStreak ?? 0) : '—'}d streak</span>
          <span style={{ color: btb.textDim }}>·</span>
          <span>{address ? fmt(Math.round(user?.points ?? 0)) : '—'} lifetime</span>
        </div>

        {rewards?.lastEpoch?.awardedRaw && (
          <div style={{ color: btb.textMuted, fontSize: 13, marginTop: 8 }}>
            Last week you earned <span style={{ color: btb.green, fontWeight: 700 }}>{formatBtb(rewards.lastEpoch.awardedRaw)} BTB</span>.
          </div>
        )}
        {claimError && <div style={{ color: btb.loss, fontSize: 13, marginTop: 8 }}>{claimError}</div>}
      </Glass>

      {/* task list */}
      {grouped.map(({ category, quests }) => (
        <div key={category} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SectionHeader title={CATEGORY_LABELS[category]} right={`${quests.length} tasks`}/>
          <Glass padding={16} radius={20}>
          {quests.map((quest, i) => (
            <QuestRow
              key={quest.id}
              last={i === quests.length - 1}
              quest={quest}
              state={questState(quest, rows, now)}
              busy={busyQuest === quest.id}
              onSubmit={address ? (proof) => onSubmitProof(quest.id, proof) : async () => { onConnect(); }}
            />
          ))}
          </Glass>
        </div>
      ))}
    </div>
  );
}
