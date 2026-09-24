'use client';
import { useEffect, useMemo, useState } from 'react';
import { useAction, useMutation, useQuery } from 'convex/react';
import { useReadContract, useReadContracts } from 'wagmi';
import { erc20Abi, parseAbi } from 'viem';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { Glass } from '../Glass';
import { SectionHeader } from '../SectionHeader';
import { Icon } from '../Icon';
import { Button } from '../Button';
import { Badge } from '../Badge';
import { type Tab } from '../types';
import { btb } from '../design-tokens';
import { CONTRACTS } from '../../lib/wagmi';
import { readableError } from '../../lib/errorText';
import { useSidebar } from '../../lib/SidebarContext';
import { useXpToast } from '../../lib/XpToast';
import { useTokenStore } from '../../lib/TokenStore';
import { useAlertCredit } from '../../lib/alerts';
import { TopUpModal, fmtBtb } from '../FastAlerts';
import { useWalletSession } from '../../lib/session';
import { dailyXpForStreak, weekMilestoneXp, holdBonusXp, BTB_PER_BONUS_XP, HOLD_BONUS_CAP, SWAP_XP, TX_XP_DAILY_CAP, SIMULATE_XP, MINT_XP, epochIdAt, epochWindow } from '../../../convex/xpRules';

const BTB_ADDRESS = CONTRACTS.BTB;
const OPOS_ADDRESS = CONTRACTS.OPOS;
const OPOS_TREASURY_ABI = parseAbi(['function treasury() view returns (address)']);
const shortAddr = `${BTB_ADDRESS.slice(0, 6)}…${BTB_ADDRESS.slice(-4)}`;

const MS_PER_DAY = 86_400_000;
/** When the current week settles (Friday 00:00 UTC), from the shared schedule. */
const nextSettleAt = (at: number) => epochWindow(epochIdAt(at)).endsAt;

/** Parse a wei string without letting one malformed row take down the render. */
function toWei(raw: string | null | undefined): bigint {
  if (!raw) return 0n;
  try { return BigInt(raw); } catch { return 0n; }
}

/** BTB wei → short human string (payouts are 18-decimal). */
function formatBtb(raw: string | null | undefined) {
  if (!raw) return '0';
  try {
    const value = BigInt(raw);
    const whole = value / 10n ** 18n;
    const frac = ((value % 10n ** 18n) / 10n ** 14n).toString().padStart(4, '0').replace(/0+$/, ''); // up to 4 dp, no trailing zeros
    return `${Number(whole).toLocaleString('en-US')}${frac ? `.${frac}` : ''}`;
  } catch {
    return '0';
  }
}


function countdown(ms: number) {
  if (ms <= 0) return 'settling now';
  const d = Math.floor(ms / MS_PER_DAY);
  const h = Math.floor((ms % MS_PER_DAY) / 3_600_000);
  const m = Math.floor((ms % MS_PER_DAY % 3_600_000) / 60_000);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}


function shortDate(ms: number) {
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** How to earn — every row is an action inside this app, awarded automatically
 * on on-chain confirmation. No proof screenshots, no manual review.
 *
 * `href` is kept so middle-click and "open in new tab" still work, but a plain
 * click is intercepted and handled in-app: these are tabs of the same React
 * shell, and letting the browser follow the link would tear down and re-boot
 * the whole wallet stack for what is really a state change. */
type EarnAction = 'swap' | 'simulate' | 'nft';

const EARN_ROWS: { icon: string; label: string; detail: string; href: string; action: EarnAction; tint: string }[] = [
  { icon: 'wallet', label: 'Hold BTB', detail: `+1 XP per ${BTB_PER_BONUS_XP} BTB at every check-in, up to ${HOLD_BONUS_CAP.toLocaleString('en-US')} a day`, href: '/swap', action: 'swap', tint: 'var(--btb-green)' },
  { icon: 'swap', label: 'Make a swap', detail: `+${SWAP_XP} XP per swap, up to ${TX_XP_DAILY_CAP} a day`, href: '/swap', action: 'swap', tint: 'var(--btb-green)' },
  { icon: 'chart', label: 'Simulate a pool', detail: `+${SIMULATE_XP} XP a day, +${SIMULATE_XP} per chain researched`, href: '/simulate', action: 'simulate', tint: 'var(--btb-reward)' },
  { icon: 'nft', label: 'Mint a BTB Bear', detail: `+${MINT_XP.toLocaleString('en-US')} XP per Bear minted`, href: '/nft', action: 'nft', tint: 'var(--btb-amber)' },
];

/** The three-beat story: use → enter → claim. */
const STEPS: { title: string; detail: string }[] = [
  { title: 'Earn points', detail: 'Check in daily, hold BTB, swap, simulate and mint. Points land on their own, no forms.' },
  { title: 'Friday split', detail: "Everyone with points is in automatically. The week's revenue is shared by points." },
  { title: 'Claim or use it', detail: 'Claim to your wallet with no gas, or add it to your BTB balance. Untouched shares go back to the pot next Friday.' },
];

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const LABEL_STYLE = { color: btb.textDim, fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: 0.5 };
const CARD_STYLE = { background: 'rgba(var(--fg-rgb), 0.05)', border: btb.borderSoft, borderRadius: 14, padding: '11px 13px', minWidth: 0 };

/** Small stat tile used across the hero and proof grids. */
function StatTile({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={CARD_STYLE}>
      <div style={{ ...LABEL_STYLE, whiteSpace: 'nowrap' }}>{label}</div>
      <div style={{ color: color ?? btb.text, fontSize: 17, fontWeight: 800, marginTop: 3, letterSpacing: -0.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
      {sub && <div style={{ color: btb.textDim, fontSize: 10, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

/**
 * The Earn/rewards block. Lives at the top of Home rather than on its own tab —
 * it is a panel, not a screen, so it brings no page chrome of its own.
 */
export function TokenPanel({ onSwap, address, onConnect, goto }: {
  onSwap: () => void;
  address?: string;
  onConnect: () => void;
  goto: (t: Tab) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<'claim' | 'balance' | 'checkin' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { isMobile } = useSidebar();
  const showXp = useXpToast();

  // Live per-wallet state: this week's points, opt-in flag, live denominator.
  const status = useQuery(api.rewards.getStatus, address ? { walletAddress: address } : 'skip');
  // Public proof — past epochs and this wallet's payout history.
  const epochs = useQuery(api.rewards.listEpochs, { limit: 8 });
  const payouts = useQuery(api.rewards.listPayouts, address ? { walletAddress: address, limit: 10 } : 'skip');
  const user = useQuery(api.users.getUser, address ? { walletAddress: address } : 'skip');

  const claim = useMutation(api.rewards.claimReward);
  // Check-in already fires on connect (TokenStore); the hero button is for a
  // session left open past midnight, where the automatic one has not re-run.
  const checkInNow = useAction(api.checkInActions.checkIn);
  // BTB in the wallet (drives the check-in bonus) and the in-app BTB balance
  // (pays fast alerts and agent messages; weekly rewards top it up).
  const { tokens } = useTokenStore();
  const walletBtb = parseFloat(tokens.find(t => t.address.toLowerCase() === BTB_ADDRESS.toLowerCase())?.balance ?? '0');
  const [showTopUp, setShowTopUp] = useState(false);
  const credit = useAlertCredit(address, { withTreasury: showTopUp });

  const copyAddress = () => {
    navigator.clipboard?.writeText(BTB_ADDRESS).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }).catch(() => {});
  };

  const doClaim = async (payoutId: string) => {
    if (!address || busy) return;
    setBusy('claim'); setError(null);
    try {
      await claim({ payoutId: payoutId as Id<'rewardPayouts'> });
    } catch (e) {
      setError(readableError(e, 'Could not claim; try again'));
    } finally {
      setBusy(null);
    }
  };

  // Moving a share into the BTB balance makes it app-only, so it takes the
  // wallet's session (one signature, then 30 days on this device).
  const session = useWalletSession(address);
  const addToBalance = useMutation(api.rewards.addToBalance);
  const doAddToBalance = async (payoutId: string) => {
    if (!address || busy) return;
    setBusy('balance'); setError(null);
    try {
      const sessionToken = await session.ensure();
      const r = await addToBalance({ payoutId: payoutId as Id<'rewardPayouts'>, sessionToken });
      if (!r.ok) { if (/Sign in again/.test(r.reason)) session.forget(); setError(r.reason); }
    } catch (e) {
      setError(readableError(e, 'Could not add to your balance; try again'));
    } finally {
      setBusy(null);
    }
  };

  const doCheckIn = async () => {
    if (!address || busy) return;
    setBusy('checkin'); setError(null);
    try {
      const r = await checkInNow({ walletAddress: address });
      if (!r.alreadyCheckedIn) showXp((r.dailyXp ?? 0) + (r.weekMilestone ?? 0) + (r.holdBonus ?? 0), r.holdBonus ? `Day ${r.newStreak} check-in, +${r.holdBonus} for holding BTB` : `Day ${r.newStreak} check-in`);
    } catch (e) {
      setError(readableError(e, 'Could not check in; try again'));
    } finally {
      setBusy(null);
    }
  };

  // "Settles in" is a countdown — read once at render it freezes at whatever
  // the clock said when the screen mounted. The display only resolves to
  // minutes, so a minute is all the tick needs to cost.
  const [now, setNow] = useState(() => Date.now());
  const hasStatus = !!status;
  useEffect(() => {
    if (!hasStatus) return;
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, [hasStatus]);

  const endsIn = status ? status.endsAt - now : 0;
  const sharePct = status && status.myPoints > 0 && status.requestedPointsTotal > 0
    ? (status.myPoints / status.requestedPointsTotal) * 100
    : null;
  const todayStart = now - (now % MS_PER_DAY);
  // No local optimistic flag: the check-in fires on connect in TokenStore and
  // this query is reactive, so the row updates itself the moment it lands.
  const checkedIn = user?.lastCheckIn != null && user.lastCheckIn >= todayStart;

  // What the next check-in is actually worth, using the server's own rules
  // (convex/users.ts): the streak continues only if yesterday was claimed, and
  // every 7th day pays a bonus that grows each week.
  const streak = user?.currentStreak ?? 0;
  const continues = user?.lastCheckIn != null && user.lastCheckIn >= todayStart - MS_PER_DAY;
  const nextStreak = continues ? streak + 1 : 1;
  // Holder bonus the next check-in should pay: BTB held at the last check-in
  // and still held now. Only while the streak continues (server rule).
  const lastHeld = (user as { btbAtCheckIn?: number } | null | undefined)?.btbAtCheckIn;
  const holdBonus = holdBonusXp(lastHeld, walletBtb);
  const todayXp = dailyXpForStreak(nextStreak) + weekMilestoneXp(nextStreak) + (continues ? holdBonus : 0);
  const tomorrowXp = dailyXpForStreak(streak + 1) + weekMilestoneXp(streak + 1) + holdBonusXp(walletBtb, walletBtb);

  // Last week's payout for this wallet — getStatus already returns it, and the
  // screen used to throw it away. It is the most concrete proof on the page.
  const lastAward = status?.lastEpoch?.awardedRaw ?? null;
  const showLastAward = toWei(lastAward) > 0n;

  // One pass, and a malformed pot string can no longer throw mid-render.
  const visibleEpochs = useMemo(
    () => (epochs ?? []).filter(e => e.settledAt != null || toWei(e.btbPotRaw) > 0n),
    [epochs],
  );

  // These tabs live in the same React shell; following the href would re-boot
  // the entire wallet stack. Modified clicks still open a real new tab.
  const handleEarnRow = (action: EarnAction) => (event: React.MouseEvent) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    if (action === 'swap') { onSwap(); return; }
    if (action === 'simulate') { goto('simulate'); return; }
    if (action === 'nft') { goto('nft'); return; }
  };

  // The strip shows the current 7-day cycle of the streak, so day 7 (the bonus
  // day) is always the last slot. `cycleDay` is what today counts as.
  const cycleDay = checkedIn ? streak : nextStreak;
  const cycleBase = Math.floor((Math.max(cycleDay, 1) - 1) / 7) * 7;
  const strip = Array.from({ length: 7 }, (_, i) => {
    const day = cycleBase + i + 1;
    const state: 'done' | 'today' | 'future' =
      day < cycleDay || (day === cycleDay && checkedIn) ? 'done' : day === cycleDay ? 'today' : 'future';
    const xp = dailyXpForStreak(day) + weekMilestoneXp(day);
    const label = WEEKDAY[new Date(now + (day - cycleDay) * MS_PER_DAY).getDay()];
    return { day, state, xp, bonus: day % 7 === 0, label: state === 'today' ? 'Today' : label };
  });
  // Ring: progress through the cycle, r=22 → circumference ≈ 138.
  const ringOffset = 138 - (138 * (checkedIn ? cycleDay - cycleBase : cycleDay - cycleBase - 1)) / 7;

  // This week's pot, live. Friday's settlement burns the treasury's OPOS into
  // BTB (1,000,000 OPOS per BTB) and splits the treasury's whole BTB balance,
  // so today's estimate is: BTB held + OPOS / 1e6 - shares still owed from
  // last week. The epoch row only gets a pot once it settles.
  const currentEpochId = epochIdAt(now);
  const currentEpoch = epochs?.find(e => e.epochId === currentEpochId);
  const { data: treasury } = useReadContract({ address: OPOS_ADDRESS, abi: OPOS_TREASURY_ABI, functionName: 'treasury', chainId: 1 });
  const { data: holdings } = useReadContracts({
    contracts: treasury ? [
      { address: BTB_ADDRESS, abi: erc20Abi, functionName: 'balanceOf', args: [treasury], chainId: 1 },
      { address: OPOS_ADDRESS, abi: erc20Abi, functionName: 'balanceOf', args: [treasury], chainId: 1 },
    ] : [],
    query: { enabled: !!treasury, refetchInterval: 5 * 60_000 },
  });
  const owed = useQuery(api.rewards.owedRaw, {});
  const livePot = holdings && holdings[0]?.status === 'success' && holdings[1]?.status === 'success' && owed != null
    ? (() => { const p = (holdings[0].result as bigint) + (holdings[1].result as bigint) / 1_000_000n - BigInt(owed); return p > 0n ? p : 0n; })()
    : null;
  const currentPot = livePot ?? toWei(currentEpoch?.btbPotRaw);
  // The estimate uses last week's settled pot, not this week's running one:
  // early in the week the running pot is small and the estimate would look
  // like nothing. Falls back to the most recent week that had a pot.
  const lastPot = (() => {
    const settled = (epochs ?? []).filter(e => e.epochId < currentEpochId && toWei(e.btbPotRaw) > 0n).sort((a, b) => b.epochId - a.epochId);
    return settled.length > 0 ? toWei(settled[0].btbPotRaw) : 0n;
  })();
  const estPayout = sharePct != null && lastPot > 0n
    ? (lastPot * BigInt(Math.round(sharePct * 100))) / 10_000n
    : null;
  const claimable = status?.claimable ?? [];
  // Explainers are for people who have not earned yet; regulars get straight to the numbers.
  const isNew = !address || ((status?.myPoints ?? 0) === 0 && (payouts?.length ?? 0) === 0 && streak <= 1);
  const [showHistory, setShowHistory] = useState(false);

  const heroStyle = {
    position: 'relative' as const,
    overflow: 'hidden' as const,
    borderRadius: 20,
    padding: isMobile ? 14 : 16,
    border: '1px solid rgba(var(--green-rgb), 0.25)',
    background: 'radial-gradient(120% 150% at 88% -30%, rgba(var(--green-rgb), 0.20), transparent 55%), radial-gradient(90% 120% at 0% 115%, rgba(125,211,252,0.10), transparent 55%), linear-gradient(165deg, rgba(var(--fg-rgb), 0.06), rgba(var(--fg-rgb), 0.015))',
    display: 'flex', flexDirection: 'column' as const, gap: 12,
  };
  const panelStyle = { borderRadius: 24, padding: isMobile ? 18 : 24, border: btb.border, background: 'rgba(var(--fg-rgb), 0.05)', display: 'flex', flexDirection: 'column' as const, gap: 14 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* ── header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '0 4px' }}>
        <div>
          <div style={{ color: btb.text, fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>{address ? 'Your week' : 'Get paid every Friday'}</div>
          <div style={{ color: btb.textMuted, fontSize: 12, marginTop: 2 }}>
            {status ? `Week ${status.epochId} · settles in ${countdown(endsIn)}` : 'Settles Friday 00:00 UTC'}
          </div>
        </div>
        {address && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: btb.surface, border: btb.border, borderRadius: 999, padding: '6px 12px', color: btb.text, fontSize: 12, fontWeight: 700 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: btb.green }}/>
            {address.slice(0, 4)}…{address.slice(-4)}
          </span>
        )}
      </div>

      {/* ── BTB balance and top up, first thing on the page ── */}
      {address && (
        <div style={{ borderRadius: 18, padding: '12px 14px', border: '1px solid rgba(var(--green-rgb), 0.25)', background: 'rgba(var(--green-rgb), 0.06)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 150 }}>
            <div style={LABEL_STYLE}>BTB balance</div>
            <div style={{ color: btb.text, fontSize: 20, fontWeight: 800, letterSpacing: -0.4, marginTop: 2 }}>{fmtBtb(credit.total)} BTB</div>
            <div style={{ color: btb.textMuted, fontSize: 11, marginTop: 1 }}>
              {credit.rewards > 0 ? `incl. ${fmtBtb(credit.rewards)} unclaimed rewards · ` : ''}pays for auto-rebalance, alerts and the agent · {fmtBtb(walletBtb)} BTB in your wallet
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" onClick={() => setShowTopUp(true)} style={{ height: 32, padding: '0 14px', borderRadius: 999, border: '1px solid rgba(var(--green-rgb), 0.5)', background: btb.green, color: '#000', fontSize: 12.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>Top up</button>
            <button type="button" onClick={onSwap} style={{ height: 32, padding: '0 14px', borderRadius: 999, border: btb.borderSoft, background: 'transparent', color: btb.text, fontSize: 12.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>Get BTB</button>
          </div>
          {showTopUp && <TopUpModal credit={credit} onClose={() => setShowTopUp(false)}/>}
        </div>
      )}

      {/* ── the week at a glance: the numbers people come back for, in one row ── */}
      {address && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
          <StatTile label="Points this week" value={status ? status.myPoints.toLocaleString('en-US') : '—'} color={status && status.myPoints > 0 ? btb.green : undefined} sub={checkedIn ? 'checked in today' : `+${todayXp} on check-in`}/>
          <StatTile label="Your share" value={sharePct != null ? `≈ ${sharePct.toFixed(1)}%` : '—'} sub={status ? `${status.requesterCount} wallets earning` : undefined}/>
          <StatTile label="Est. Friday payout" value={estPayout != null ? `${formatBtb(estPayout.toString()).split('.')[0]} BTB` : '—'} color={estPayout != null ? btb.green : undefined} sub={estPayout != null ? `at last week's pot · in ${countdown(endsIn)}` : status ? `in ${countdown(endsIn)}` : undefined}/>
          <StatTile label="Streak" value={`${streak} day${streak === 1 ? '' : 's'}`} sub={streak > 0 ? `best ${user?.longestStreak ?? streak}` : 'check in daily'}/>
        </div>
      )}

      {/* ── ready to claim — only when there is BTB waiting ── */}
      {claimable.map(row => (
        <div key={row.payoutId} style={{ borderRadius: 24, padding: '18px 20px', border: '1px solid rgba(var(--green-rgb), 0.45)', background: 'rgba(var(--green-rgb), 0.10)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ ...LABEL_STYLE, color: 'rgba(var(--green-rgb), 0.8)' }}>Week {row.epochId} · ready</div>
            <div style={{ color: btb.green, fontSize: 24, fontWeight: 800, letterSpacing: -0.5, marginTop: 3 }}>{formatBtb(row.amountRaw)} BTB</div>
            <div style={{ color: btb.textMuted, fontSize: 10.5, marginTop: 2 }}>Claim it to your wallet (no gas) or add it to your BTB balance for the agent and fast alerts. Untouched by next Friday, it goes back into the pot for everyone.</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button size="sm" variant="successSoft" fullWidth={false} disabled={busy != null} loading={busy === 'balance'} onClick={() => doAddToBalance(row.payoutId)}>
              Add to BTB balance
            </Button>
            <Button size="sm" variant="success" fullWidth={false} disabled={busy != null} loading={busy === 'claim'} onClick={() => doClaim(row.payoutId)}>
              Claim to wallet
            </Button>
          </div>
        </div>
      ))}
      {showLastAward && claimable.length === 0 && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(var(--green-rgb), 0.10)', border: '1px solid rgba(var(--green-rgb), 0.28)', borderRadius: 12, padding: '8px 12px', alignSelf: 'flex-start' }}>
          <Icon name="receive" size={14} color={btb.green}/>
          <span style={{ color: btb.textMuted, fontSize: 11.5 }}>Last week you were paid <b style={{ color: btb.green }}>{formatBtb(lastAward)} BTB</b></span>
        </div>
      )}

      {/* ── daily check-in hero ── */}
      {address ? (
        <div style={heroStyle}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div style={LABEL_STYLE}>Daily check-in</div>
              <div style={{ color: btb.text, fontSize: 18, fontWeight: 800, letterSpacing: -0.4, lineHeight: 1.15, marginTop: 3 }}>
                {checkedIn ? `Day ${streak} done` : streak > 0 && continues ? `Day ${streak} streak` : 'Start a streak'}
              </div>
              <div style={{ color: btb.textMuted, fontSize: 12, marginTop: 3 }}>
                {checkedIn
                  ? <>Come back tomorrow for <b style={{ color: btb.green }}>+{tomorrowXp} XP</b>{walletBtb >= BTB_PER_BONUS_XP ? ', holding bonus included' : ''}</>
                  : <>Check in today for <b style={{ color: btb.green }}>+{todayXp} XP</b>{nextStreak % 7 === 0 ? ' · bonus day' : ` · day ${cycleBase + 7} pays a +${weekMilestoneXp(cycleBase + 7)} bonus`}</>}
              </div>
            </div>
            <svg width="40" height="40" viewBox="0 0 52 52" fill="none" strokeWidth="2" style={{ flexShrink: 0 }}>
              <circle cx="26" cy="26" r="22" stroke="rgba(var(--fg-rgb), 0.10)"/>
              <circle cx="26" cy="26" r="22" stroke={btb.green} strokeDasharray="138" strokeDashoffset={ringOffset} strokeLinecap="round" transform="rotate(-90 26 26)"/>
              {checkedIn
                ? <path d="M17 26l6 6 12-12" stroke={btb.green} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                : <text x="26" y="30" textAnchor="middle" fill="currentColor" style={{ color: btb.text }} fontSize="13" fontWeight="800">{cycleDay - cycleBase}/7</text>}
            </svg>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 6 }}>
            {strip.map(d => {
              const box = d.state === 'done'
                ? { background: 'rgba(var(--green-rgb), 0.22)', border: '1px solid rgba(var(--green-rgb), 0.5)', color: btb.green }
                : d.state === 'today'
                  ? { background: 'rgba(var(--fg-rgb), 0.10)', border: '1px dashed rgba(var(--green-rgb), 0.7)', color: btb.green }
                  : d.bonus
                    ? { background: 'rgba(var(--amber-rgb), 0.10)', border: '1px solid rgba(var(--amber-rgb), 0.4)', color: btb.amber }
                    : { background: 'rgba(var(--fg-rgb), 0.04)', border: btb.borderSoft, color: btb.textDim };
              return (
                <div key={d.day} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 0 }}>
                  <div style={{ ...box, width: '100%', height: 26, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, fontWeight: 800 }}>
                    {d.state === 'done' ? <Icon name="check" size={14} color={btb.green}/> : `+${d.xp}`}
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 800, color: d.state === 'today' ? btb.text : d.bonus && d.state === 'future' ? btb.amber : btb.textDim }}>
                    {d.bonus && d.state === 'future' ? 'Bonus' : d.label}
                  </span>
                </div>
              );
            })}
          </div>

          {checkedIn ? (
            <div style={{ height: 38, borderRadius: 12, background: 'rgba(var(--green-rgb), 0.12)', border: '1px solid rgba(var(--green-rgb), 0.4)', color: btb.green, fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Icon name="check" size={15} color={btb.green}/> Checked in · next in {countdown(todayStart + MS_PER_DAY - now)}
            </div>
          ) : (
            <Button size="sm" variant="success" icon="fire" loading={busy === 'checkin'} disabled={busy != null || !user} onClick={doCheckIn}>
              Check in · +{todayXp} XP
            </Button>
          )}
        </div>
      ) : (
        <div style={heroStyle}>
          <div>
            <div style={{ color: btb.text, fontSize: 28, fontWeight: 800, letterSpacing: -0.7, lineHeight: 1.1 }}>Use BTB. Get paid every Friday.</div>
            <div style={{ color: btb.textMuted, fontSize: 13.5, lineHeight: 1.5, marginTop: 8 }}>
              BTB shares its weekly revenue with the people who use it. Swaps, liquidity and a daily check-in all earn points. Points become BTB.
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 9 }}>
            <StatTile label="This week's pot" value={epochs ? `${formatBtb(currentPot.toString()).split('.')[0]} BTB` : '—'}/>
            <StatTile label="Paid last week" value={epochs ? String(epochs.find(e => e.epochId === currentEpochId - 1)?.requesterCount ?? 0) : '—'} sub="wallets"/>
            <StatTile label="Settles in" value={countdown(nextSettleAt(now) - now)} sub="Friday 00:00 UTC"/>
          </div>
          <Button size="md" variant="success" icon="wallet" onClick={onConnect}>Connect and check in</Button>
          <div style={{ color: btb.textDim, fontSize: 11, textAlign: 'center' }}>Your first check-in is worth +10 XP the moment you connect.</div>
        </div>
      )}

      {/* ── this week's split ── */}
      {address && status && (
        <div style={panelStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <span style={{ color: btb.text, fontSize: 17, fontWeight: 800, letterSpacing: -0.3 }}>This week's split</span>
            {status.myPoints > 0
              ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(var(--green-rgb), 0.12)', border: '1px solid rgba(var(--green-rgb), 0.4)', borderRadius: 999, padding: '5px 10px', color: btb.green, fontSize: 11, fontWeight: 800 }}><Icon name="check" size={12} color={btb.green}/>You are in</span>
              : <span style={{ color: btb.textDim, fontSize: 12 }}>{countdown(endsIn)} left</span>}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ height: 8, borderRadius: 999, background: 'rgba(var(--fg-rgb), 0.08)', overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(100, sharePct ?? 0)}%`, height: '100%', borderRadius: 999, background: `linear-gradient(90deg, ${btb.green}, rgba(var(--green-rgb), 0.7))`, transition: 'width .4s' }}/>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, color: btb.textDim, fontSize: 10.5, flexWrap: 'wrap' }}>
              <span title="Treasury BTB plus its OPOS at 1,000,000 OPOS per BTB (burned to BTB on Friday), less shares still owed">Pot so far: <b style={{ color: btb.text }}>{livePot != null ? '≈ ' : ''}{formatBtb(currentPot.toString()).split('.')[0]} BTB</b></span>
              {estPayout != null && <span title="Your share applied to last week's pot">Est. payout ≈ <b style={{ color: btb.green }}>{formatBtb(estPayout.toString()).split('.')[0]} BTB</b> at last week's pot</span>}
            </div>
          </div>

          <div style={{ color: btb.textDim, fontSize: 10.5, lineHeight: 1.5 }}>
            {status.myPoints > 0
              ? 'Every point you earn this week counts. Friday, the pot is split by points and your share is waiting here: claim it or add it to your BTB balance before the next Friday.'
              : 'Earn points this week and you are in automatically. Friday, the pot is split by points.'}
          </div>
          {error && <div style={{ color: btb.loss, fontSize: 11.5 }}>{error}</div>}
        </div>
      )}

      {/* ── how it works: only until the wallet has earned something; after that it is noise ── */}
      {isNew && (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <SectionHeader title="How it works" right="Every Friday"/>
        {/* Three cards across on desktop; on a phone that is three 100px
            columns of tiny text, so each beat becomes a row instead. */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
          {STEPS.map((step, i) => (
            <div key={step.title} style={{ ...CARD_STYLE, borderRadius: 16, padding: isMobile ? '12px 14px' : '14px 12px', display: 'flex', flexDirection: isMobile ? 'row' : 'column', alignItems: isMobile ? 'flex-start' : 'stretch', gap: isMobile ? 12 : 8 }}>
              <span style={{ width: 26, height: 26, borderRadius: 8, flexShrink: 0, background: 'rgba(var(--green-rgb), 0.18)', color: btb.green, fontSize: 12, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                <span style={{ color: btb.text, fontSize: 13.5, fontWeight: 800 }}>{step.title}</span>
                <span style={{ color: btb.textMuted, fontSize: isMobile ? 12 : 10.5, lineHeight: 1.45 }}>{step.detail}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
      )}

      {/* ── ways to earn ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <SectionHeader title={isNew ? 'Ways to earn' : 'Earn more points'}/>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0,1fr))', gap: 8 }}>
          {EARN_ROWS.map(row => (
            <a
              key={row.label}
              href={row.href}
              onClick={handleEarnRow(row.action)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', minHeight: 44, textDecoration: 'none',
                background: 'rgba(var(--fg-rgb), 0.05)', border: btb.borderSoft, borderRadius: 16, cursor: 'pointer',
              }}
            >
              <span style={{
                width: 36, height: 36, borderRadius: 12, flexShrink: 0,
                background: `color-mix(in srgb, ${row.tint} 16%, transparent)`,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon name={row.icon} size={18} color={row.tint}/>
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', color: btb.text, fontSize: 14, fontWeight: 700 }}>{row.label}</span>
                <span style={{ display: 'block', color: btb.textMuted, fontSize: 11, marginTop: 2 }}>{row.detail}</span>
              </span>
              <Icon name="arrow" size={14} color={btb.textDim}/>
            </a>
          ))}
        </div>
      </div>

      {/* ── history: proof the pot is real, one tap away instead of two long lists ── */}
      {((address && (payouts?.length ?? 0) > 0) || visibleEpochs.length > 0) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button type="button" onClick={() => setShowHistory(o => !o)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '12px 14px', borderRadius: 16, border: btb.borderSoft, background: 'rgba(var(--fg-rgb), 0.04)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
            <span>
              <span style={{ display: 'block', color: btb.text, fontSize: 14, fontWeight: 800 }}>History</span>
              <span style={{ display: 'block', color: btb.textMuted, fontSize: 11.5, marginTop: 2 }}>
                {address && (payouts?.length ?? 0) > 0 ? `${payouts!.length} payout${payouts!.length === 1 ? '' : 's'} to you · ` : ''}{visibleEpochs.length} past week{visibleEpochs.length === 1 ? '' : 's'}
              </span>
            </span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: btb.textDim, transform: showHistory ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}><path d="M6 9l6 6 6-6"/></svg>
          </button>
          {showHistory && address && payouts != null && payouts.length > 0 && (
            <>
              <div style={{ ...LABEL_STYLE, padding: '0 4px' }}>Your payouts</div>
              <Glass padding={8} radius={20}>
            {payouts.map(p => (
              <div key={p._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '9px 10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 30, height: 30, borderRadius: 10, background: 'rgba(var(--green-rgb), .12)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon name="receive" size={14} color={btb.green}/>
                  </span>
                  <div>
                    <div style={{ color: btb.green, fontSize: 13.5, fontWeight: 800 }}>+{formatBtb(p.amountRaw)} BTB</div>
                    <div style={{ color: btb.textDim, fontSize: 10.5, marginTop: 1 }}>Week {p.epochId} · {shortDate(p.createdAt)}</div>
                  </div>
                </div>
                {p.txHash && (
                  <a
                    href={`https://etherscan.io/tx/${p.txHash}`}
                    target="_blank" rel="noopener noreferrer"
                    style={{ color: btb.textMuted, fontSize: 11, fontWeight: 700, textDecoration: 'none', padding: '4px 9px', borderRadius: 999, border: btb.borderSoft }}
                  >
                    View tx
                  </a>
                )}
              </div>
            ))}
          </Glass>
            </>
          )}
          {showHistory && visibleEpochs.length > 0 && (
            <>
              <div style={{ ...LABEL_STYLE, padding: '0 4px' }}>Past weeks</div>
              <Glass padding={8} radius={20}>
            {visibleEpochs.map(e => (
              <div key={e._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '9px 10px' }}>
                <div>
                  <div style={{ color: btb.text, fontSize: 13, fontWeight: 750 }}>
                    Week {e.epochId} · {toWei(e.btbPotRaw) > 0n ? `${formatBtb(e.btbPotRaw)} BTB pot` : 'no pot'}
                  </div>
                  <div style={{ color: btb.textDim, fontSize: 10.5, marginTop: 1 }}>
                    {e.settledAt ? `settled ${shortDate(e.settledAt)}` : 'open'} · {e.requesterCount ?? 0} entered
                  </div>
                </div>
                <Badge color={e.state === 'paid' ? 'var(--btb-green)' : btb.textMuted} bg="rgba(var(--fg-rgb), .05)" border="none">{e.state}</Badge>
              </div>
            ))}
          </Glass>
            </>
          )}
        </div>
      )}

      {/* ── contract ── */}
      <div style={isMobile
        ? { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }
        : { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Button
          size="sm" variant="successSoft" fullWidth={!isMobile ? false : true}
          icon={copied ? 'check' : 'wallet'}
          onClick={copyAddress}
          title="Copy contract address"
          style={{ fontFamily: 'monospace', letterSpacing: 0 }}
        >
          {copied ? 'Copied' : shortAddr}
        </Button>
        <Button size="sm" variant="successSoft" fullWidth={!isMobile ? false : true} icon="launch" href={`https://etherscan.io/token/${BTB_ADDRESS}`} target="_blank">
          Etherscan
        </Button>
        <Button size="sm" variant="successSoft" fullWidth={!isMobile ? false : true} icon="twitter" href="https://x.com/BTB_Finance" target="_blank">
          Follow
        </Button>
        <Button size="sm" variant="successSoft" fullWidth={!isMobile ? false : true} icon="discord" href="https://discord.gg/bqFEPA56Tc" target="_blank">
          Discord
        </Button>
      </div>

      {/* Crawlable path to the comparison pages; they are server-rendered outside the app shell. */}
      <div style={{ marginTop: 22, color: btb.textDim, fontSize: 12, lineHeight: 1.6 }}>
        Paying for LP tools? See how BTB compares to{' '}
        <a href="/metrix-finance-alternative" style={{ color: btb.textMuted }}>Metrix Finance</a>,{' '}
        <a href="/drippy-finance-alternative" style={{ color: btb.textMuted }}>Drippy Finance</a> and{' '}
        <a href="/revert-finance-alternative" style={{ color: btb.textMuted }}>Revert</a>.
      </div>

    </div>
  );
}
