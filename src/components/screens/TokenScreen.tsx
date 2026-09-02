'use client';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Glass } from '../Glass';
import { SectionHeader } from '../SectionHeader';
import { Icon } from '../Icon';
import { Button } from '../Button';
import { Screen } from '../Screen';
import { Badge } from '../Badge';
import { type Tab } from '../types';
import { btb } from '../design-tokens';
import { CONTRACTS } from '../../lib/wagmi';
import { readableError } from '../../lib/errorText';
import { useSidebar } from '../../lib/SidebarContext';

const BTB_ADDRESS = CONTRACTS.BTB;
const shortAddr = `${BTB_ADDRESS.slice(0, 6)}…${BTB_ADDRESS.slice(-4)}`;

const MS_PER_DAY = 86_400_000;

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
    const frac = (value % 10n ** 18n) / 10n ** 14n; // 4 dp
    return `${Number(whole).toLocaleString('en-US')}.${frac.toString().padStart(4, '0')}`;
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

/** Mirror of dailyXpForStreak in convex/users.ts — keep the two in step. */
function dailyXpFor(streak: number) {
  return Math.min(10 + (streak - 1) * 2, 50);
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
type EarnAction = 'swap' | 'simulate' | 'earn' | 'checkin';

const EARN_ROWS: { icon: string; label: string; detail: string; href: string; action: EarnAction; tint: string }[] = [
  { icon: 'swap', label: 'Make a swap', detail: 'Points scale with trade size', href: '/swap', action: 'swap', tint: '#52E3A4' },
  { icon: 'chart', label: 'Provide liquidity', detail: 'Open an LP position in Simulate', href: '/simulate', action: 'simulate', tint: '#7DD3FC' },
  { icon: 'stake', label: 'Stake or supply', detail: 'Points per staking / supplying action', href: '/earn', action: 'earn', tint: '#FFB36B' },
  { icon: 'fire', label: 'Daily check-in', detail: 'Escalating +10 → +50, plus a growing weekly bonus', href: '/token', action: 'checkin', tint: '#C9A7FF' },
];

/** Small stat tile used across the hero and proof grids. */
function StatTile({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.05)', border: btb.borderSoft, borderRadius: 14, padding: '11px 13px', minWidth: 0 }}>
      <div style={{ color: btb.textDim, fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>{label}</div>
      <div style={{ color: color ?? btb.text, fontSize: 17, fontWeight: 800, marginTop: 3, letterSpacing: -0.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
      {sub && <div style={{ color: btb.textDim, fontSize: 10, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export function TokenScreen({ onSwap, address, onConnect, goto, onEarn }: {
  onSwap: () => void;
  address?: string;
  onConnect: () => void;
  goto: (t: Tab) => void;
  onEarn: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<'convert' | 'checkin' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkedInToday, setCheckedInToday] = useState(false);
  const { isMobile } = useSidebar();

  // Live per-wallet state: this week's points, opt-in flag, live denominator.
  const status = useQuery(api.rewards.getStatus, address ? { walletAddress: address } : 'skip');
  // Public proof — past epochs and this wallet's payout history.
  const epochs = useQuery(api.rewards.listEpochs, { limit: 8 });
  const payouts = useQuery(api.rewards.listPayouts, address ? { walletAddress: address, limit: 10 } : 'skip');
  const user = useQuery(api.users.getUser, address ? { walletAddress: address } : 'skip');

  const convert = useMutation(api.rewards.requestPayout);
  const checkIn = useMutation(api.users.checkIn);

  const copyAddress = () => {
    navigator.clipboard?.writeText(BTB_ADDRESS).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }).catch(() => {});
  };

  const doConvert = async () => {
    if (!address || busy) return;
    setBusy('convert'); setError(null);
    try {
      await convert({ walletAddress: address });
    } catch (e) {
      setError(readableError(e, 'Could not convert — try again'));
    } finally {
      setBusy(null);
    }
  };

  const doCheckIn = async () => {
    if (!address || busy) return;
    setBusy('checkin'); setError(null);
    try {
      await checkIn({ walletAddress: address });
      setCheckedInToday(true);
    } catch (e) {
      setError(readableError(e, 'Could not check in — try again'));
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
  const checkedIn = checkedInToday || (user?.lastCheckIn != null && user.lastCheckIn >= todayStart);

  // What the next check-in is actually worth, using the server's own rules
  // (convex/users.ts): the streak continues only if yesterday was claimed, and
  // every 7th day pays a bonus that grows each week.
  const streak = user?.currentStreak ?? 0;
  const continues = user?.lastCheckIn != null && user.lastCheckIn >= todayStart - MS_PER_DAY;
  const nextStreak = continues ? streak + 1 : 1;
  const todayXp = dailyXpFor(nextStreak) + (nextStreak % 7 === 0 ? (nextStreak / 7) * 50 : 0);

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
    if (action === 'earn') { onEarn(); return; }
    if (!address) { onConnect(); return; }
    if (!checkedIn) void doCheckIn();
  };

  const heroStyle = {
    position: 'relative' as const,
    overflow: 'hidden' as const,
    borderRadius: 24,
    padding: isMobile ? 18 : 24,
    border: '1px solid rgba(82,227,164,0.25)',
    background: 'radial-gradient(120% 150% at 88% -30%, rgba(82,227,164,0.20), transparent 55%), radial-gradient(90% 120% at 0% 115%, rgba(125,211,252,0.10), transparent 55%), linear-gradient(165deg, rgba(255,255,255,0.06), rgba(255,255,255,0.015))',
  };

  return (
    <Screen gap={20}>
      {/* ── hero ── */}
      <div style={heroStyle}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: btb.green, fontSize: 10, fontWeight: 850, textTransform: 'uppercase', letterSpacing: 1.2 }}>Weekly rewards</div>
            <div style={{ color: btb.text, fontSize: isMobile ? 21 : 26, fontWeight: 800, letterSpacing: -0.6, marginTop: 4, lineHeight: 1.15 }}>
              Use the app.<br/>Get paid in BTB.
            </div>
          </div>
          <Badge color="#0A0A0F" bg={btb.gradGreen} border="none" style={{ flexShrink: 0, fontWeight: 900 }}>PAID FRIDAYS</Badge>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(3,1fr)' : 'repeat(3,minmax(0,1fr))', gap: 9, marginTop: 18 }}>
          <StatTile label="Your points this week" value={address && status ? status.myPoints.toLocaleString('en-US') : '—'} color={address && status && status.myPoints > 0 ? btb.green : undefined} sub={user ? `${user.currentStreak}d streak` : 'connect to earn'}/>
          <StatTile label="Entered this week" value={status ? String(status.requesterCount) : '—'} sub="wallets converting"/>
          <StatTile label="Settles in" value={status ? countdown(endsIn) : '—'} sub="Friday 00:00 UTC"/>
        </div>

        {address && status && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
              {status.hasRequested ? (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(82,227,164,0.12)', border: '1px solid rgba(82,227,164,0.4)', borderRadius: 12, padding: '9px 14px', color: btb.green, fontSize: 13, fontWeight: 800 }}>
                  <Icon name="check" size={15} color={btb.green} /> Locked in for Friday
                </div>
              ) : (
                <Button
                  size="md" variant="success"
                  disabled={status.myPoints <= 0 || busy === 'convert'}
                  loading={busy === 'convert'}
                  onClick={doConvert}
                >
                  {status.myPoints > 0 ? 'Convert my points' : 'Earn points first'}
                </Button>
              )}
              {sharePct != null && (
                <span style={{ color: btb.textMuted, fontSize: 12 }}>
                  Your share ≈ <b style={{ color: btb.green }}>{sharePct.toFixed(1)}%</b> of entered points
                </span>
              )}
            </div>
            {showLastAward && (
              <div style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(82,227,164,0.10)', border: '1px solid rgba(82,227,164,0.28)', borderRadius: 12, padding: '8px 12px' }}>
                <Icon name="receive" size={14} color={btb.green}/>
                <span style={{ color: btb.textMuted, fontSize: 11.5 }}>
                  Last week you were paid <b style={{ color: btb.green }}>{formatBtb(lastAward)} BTB</b>
                </span>
              </div>
            )}
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, background: 'rgba(255,255,255,0.04)', border: btb.borderSoft, borderRadius: 12, padding: '9px 12px', flexWrap: 'wrap' }}>
              <span style={{ color: btb.textMuted, fontSize: 11.5 }}>
                Daily check-in · {checkedIn
                  ? `done today ✓ · ${streak}d streak`
                  : `worth +${todayXp} XP right now${nextStreak % 7 === 0 ? ' — weekly bonus day' : ''}`}
              </span>
              <Button
                size="sm" variant="ghost" fullWidth={false}
                disabled={checkedIn || busy === 'checkin'}
                loading={busy === 'checkin'}
                onClick={doCheckIn}
              >
                {checkedIn ? 'Checked in' : 'Check in'}
              </Button>
            </div>
            <div style={{ color: btb.textDim, fontSize: 10.5, marginTop: 10, lineHeight: 1.5 }}>
              The Friday pot is the week's OPOS burn proceeds — never a fixed rate. Your payout is your
              locked points ÷ all locked points. The estimate moves as more people enter.
            </div>
            {error && <div style={{ color: btb.loss, fontSize: 11.5, marginTop: 8 }}>{error}</div>}
          </>
        )}

        {!address && (
          <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ color: btb.textMuted, fontSize: 12.5, flex: 1, minWidth: 200 }}>
              Points accrue automatically from swaps, LP positions, staking and daily check-ins.
            </div>
            <Button size="md" variant="success" icon="wallet" onClick={onConnect}>Connect to start earning</Button>
          </div>
        )}
      </div>

      {/* ── how to earn ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <SectionHeader title="How to earn"/>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0,1fr))', gap: 10 }}>
          {EARN_ROWS.map(row => (
            <a
              key={row.label}
              href={row.href}
              onClick={handleEarnRow(row.action)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', textDecoration: 'none',
                background: 'rgba(255,255,255,0.03)', border: btb.borderSoft, borderRadius: 16, cursor: 'pointer',
              }}
            >
              <span style={{
                width: 38, height: 38, borderRadius: 12, flexShrink: 0,
                background: `${row.tint}1f`, border: `1px solid ${row.tint}40`,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon name={row.icon} size={17} color={row.tint}/>
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', color: btb.text, fontSize: 14, fontWeight: 800 }}>{row.label}</span>
                <span style={{ display: 'block', color: btb.textMuted, fontSize: 11.5, marginTop: 2 }}>
                  {row.action === 'checkin' && address
                    ? (checkedIn ? `Done today ✓ · ${streak}d streak` : `Worth +${todayXp} XP right now`)
                    : row.detail}
                </span>
              </span>
              <Icon name="arrow" size={14} color={btb.textDim}/>
            </a>
          ))}
        </div>
      </div>

      {/* ── payout history — the proof ── */}
      {address && payouts != null && payouts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SectionHeader title="Your payouts"/>
          <Glass padding={8} radius={20}>
            {payouts.map(p => (
              <div key={p._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '9px 10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 30, height: 30, borderRadius: 10, background: 'rgba(82,227,164,.12)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
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
                    style={{ color: btb.textMuted, fontSize: 11, textDecoration: 'none' }}
                  >
                    tx ↗
                  </a>
                )}
              </div>
            ))}
          </Glass>
        </div>
      )}

      {/* ── past weeks — public proof the pot is real. Lazily-created empty
          epochs are hidden: a week shows once it has a pot or a settle. ── */}
      {visibleEpochs.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SectionHeader title="Past weeks"/>
          <Glass padding={8} radius={20}>
            {visibleEpochs.map(e => (
              <div key={e._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '9px 10px' }}>
                <div>
                  <div style={{ color: btb.text, fontSize: 13, fontWeight: 750 }}>
                    Week {e.epochId} · {formatBtb(e.btbPotRaw)} BTB pot
                  </div>
                  <div style={{ color: btb.textDim, fontSize: 10.5, marginTop: 1 }}>
                    {e.settledAt ? `settled ${shortDate(e.settledAt)}` : 'open'} · {e.requesterCount ?? 0} entered
                  </div>
                </div>
                <Badge color={e.state === 'paid' ? '#52E3A4' : btb.textMuted} bg="rgba(255,255,255,.05)" border="none">{e.state}</Badge>
              </div>
            ))}
          </Glass>
        </div>
      )}

      {/* ── the rules, one line each ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <SectionHeader title="How it works"/>
        <Glass padding={16} radius={20}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {[
              'Points accrue automatically from swaps, LP positions, staking and daily check-ins — awarded on on-chain confirmation, no screenshots.',
              'Tap Convert to lock your points into this week\'s split — one entry per wallet per week.',
              'Friday 00:00 UTC the week\'s OPOS burn pot is split pro-rata between everyone who entered. No fixed rate, ever.',
              'BTB arrives in your wallet automatically. No claim, no gas.',
            ].map(fact => (
              <div key={fact} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <Icon name="check" size={15} color={btb.green}/>
                <span style={{ color: btb.textMuted, fontSize: 13, lineHeight: 1.55, flex: 1 }}>{fact}</span>
              </div>
            ))}
          </div>
        </Glass>
      </div>

      {/* ── contract ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Button
          size="sm" variant="successSoft" fullWidth={false}
          icon={copied ? 'check' : 'wallet'}
          onClick={copyAddress}
          title="Copy contract address"
          style={{ fontFamily: 'monospace', letterSpacing: 0 }}
        >
          {copied ? 'Copied' : shortAddr}
        </Button>
        <Button size="sm" variant="successSoft" fullWidth={false} icon="swap" onClick={onSwap}>
          Get BTB
        </Button>
        <Button size="sm" variant="successSoft" fullWidth={false} icon="launch" href={`https://etherscan.io/token/${BTB_ADDRESS}`} target="_blank">
          Etherscan
        </Button>
        <Button size="sm" variant="successSoft" fullWidth={false} icon="twitter" href="https://x.com/BTB_Finance" target="_blank">
          Follow
        </Button>
        <Button size="sm" variant="successSoft" fullWidth={false} icon="discord" href="https://discord.gg/bqFEPA56Tc" target="_blank">
          Discord
        </Button>
      </div>

    </Screen>
  );
}
