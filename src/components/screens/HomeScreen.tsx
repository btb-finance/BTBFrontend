'use client';
import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { Glass } from '../Glass';
import { Icon } from '../Icon';
import { TokenIcon } from '../TokenIcon';
import { btb } from '../design-tokens';
import { Tab } from '../TabBar';
import { useTokenStore } from '../../lib/TokenStore';
import { api } from '../../../convex/_generated/api';

function fmtUsd(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const ACTIONS = [
  { name: 'Swap',    icon: 'swap',    action: 'swap' },
  { name: 'Send',    icon: 'send',    action: 'send' },
  { name: 'Receive', icon: 'receive', action: 'receive' },
  { name: 'Bridge',  icon: 'bridge',  action: 'bridge' },
];

const PRODUCTS_PREVIEW = [
  { icon: 'bank',   color: '#52E3A4', bg: 'rgba(82,227,164,0.15)',  name: 'Lending',   tag: 'Live' },
  { icon: 'chart',  color: '#FFFFFF', bg: 'rgba(255,255,255,0.1)',   name: 'Perps',     tag: 'New' },
  { icon: 'bridge', color: '#FFB36B', bg: 'rgba(255,179,107,0.15)', name: 'Bridge',    tag: 'Live' },
  { icon: 'vault',  color: '#94A3B8', bg: 'rgba(157,92,255,0.15)',  name: 'Vaults',    tag: 'Live' },
  { icon: 'launch', color: '#FFFFFF', bg: 'rgba(255,255,255,0.1)',   name: 'Launchpad', tag: 'Live' },
];

export function HomeScreen({ goto, address, onDisconnect, onReceive, onSend, onDocs, onProducts }: {
  goto: (t: Tab) => void;
  address?: string;
  onDisconnect?: () => void;
  onReceive?: () => void;
  onSend?: () => void;
  onDocs?: () => void;
  onProducts?: () => void;
}) {
  const shortAddr = address ? `${address.slice(0,6)}…${address.slice(-4)}` : '—';
  const { positions, loadingBalances } = useTokenStore();
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 5)  return 'Good night';
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  // Same source as portfolio
  const totalUsd = positions.reduce((s, t) => s + (t.usdValue ?? 0), 0);
  const balanceParts = totalUsd > 0
    ? ['$' + Math.floor(totalUsd).toLocaleString('en-US'), '.' + String(Math.round((totalUsd % 1) * 100)).padStart(2,'0')]
    : loadingBalances ? ['—', ''] : ['$0', '.00'];

  // Holdings preview — same cached snapshot the Portfolio screen uses.
  const heldTokens = [...positions]
    .filter(t => parseFloat(t.balance ?? '0') > 0)
    .sort((a, b) => (b.usdValue ?? 0) - (a.usdValue ?? 0));
  const topHoldings = heldTokens.slice(0, 12);

  const [toast, setToast] = useState<string | null>(null);
  function flashToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }
  function showComingSoon(label: string) {
    flashToast(`${label} — coming soon`);
  }

  // ── Check-in / XP ──────────────────────────────────────────────────────────
  // Mirror of the backend reward curve (convex/users.ts dailyXpForStreak):
  // day 1 = 10 XP, +2 per consecutive day, capped at 50.
  const dailyXpFor = (s: number) => Math.min(10 + (s - 1) * 2, 50);

  const profile = useQuery(api.users.getUser, address ? { walletAddress: address } : 'skip');
  const checkIn = useMutation(api.users.checkIn);
  const [busy, setBusy] = useState(false);

  const xp = profile?.points ?? 0;
  const streak = profile?.currentStreak ?? 0;
  const MS_DAY = 86_400_000;
  const now = Date.now();
  const dailyDone = !!profile?.lastCheckIn && profile.lastCheckIn >= now - (now % MS_DAY);
  // The streak the next check-in would land on (resets if a day was missed).
  const yesterdayStart = now - (now % MS_DAY) - MS_DAY;
  const stillConsecutive = !!profile?.lastCheckIn && profile.lastCheckIn >= yesterdayStart;
  const nextStreak = dailyDone ? streak : (stillConsecutive ? streak + 1 : 1);
  const nextDailyXp = dailyXpFor(nextStreak);
  const daysToWeekly = (7 - (streak % 7)) % 7 || (dailyDone ? 7 : 0);

  async function doDaily() {
    if (!address || dailyDone || busy) return;
    setBusy(true);
    try {
      const r = await checkIn({ walletAddress: address });
      if (r && 'alreadyCheckedIn' in r && r.alreadyCheckedIn) { flashToast('Already checked in today'); return; }
      if (r && 'dailyXp' in r) {
        const gained = Number(r.dailyXp ?? 0);
        const bonus = Number(('weekMilestone' in r ? r.weekMilestone : 0) ?? 0);
        const day = Number(r.newStreak ?? nextStreak);
        flashToast(bonus ? `+${gained + bonus} XP · ${day}-day bonus!` : `+${gained} XP · day ${day}`);
      }
    } catch { flashToast('Check-in failed'); }
    finally { setBusy(false); }
  }

  function handleAction(action: string) {
    if (action === 'receive') { onReceive?.(); return; }
    if (action === 'send')    { onSend?.();    return; }
    if (action === 'swap')    { goto('swap');  return; }
    if (action === 'bridge')  { showComingSoon('Bridge'); return; }
  }

  return (
    <div style={{ padding: 'env(safe-area-inset-top, 24px) 18px 100px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px' }}>
        <div>
          <div style={{ color: btb.textMuted, fontSize: 13, fontWeight: 500 }}>{greeting}</div>
          <div style={{ color: btb.text, fontSize: 19, fontWeight: 700, letterSpacing: -0.3 }}>{shortAddr}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Glass padding={0} radius={999} onClick={onDocs} style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <Icon name="settings" size={18}/>
          </Glass>
          <Glass padding={0} radius={999} onClick={onDisconnect} style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <Icon name="close" size={16}/>
          </Glass>
        </div>
      </div>

      {/* balance card */}
      <Glass padding={22} radius={28} strong>
        <div style={{ color: btb.textMuted, fontSize: 13, fontWeight: 500 }}>Total balance</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
          {loadingBalances && totalUsd === 0
            ? <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.18)', borderTopColor: '#fff', animation: 'spin 0.8s linear infinite' }}/>
            : <>
                <span style={{ color: btb.text, fontSize: 40, fontWeight: 800, letterSpacing: -1.5 }}>{balanceParts[0]}</span>
                <span style={{ color: btb.text, fontSize: 22, fontWeight: 700, letterSpacing: -0.5, opacity: 0.7 }}>{balanceParts[1]}</span>
              </>
          }
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>

        <div style={{ color: btb.textMuted, fontSize: 12, marginTop: 4 }}>
          {positions.length} {positions.length === 1 ? 'token' : 'tokens'}
        </div>
      </Glass>

      {/* quick actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        {ACTIONS.map(a => (
          <Glass key={a.name} padding={12} radius={18} onClick={() => handleAction(a.action)}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 12,
              background: 'linear-gradient(135deg, rgba(226,232,240,0.85), rgba(30,41,59,0.85))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3)',
            }}>
              <Icon name={a.icon} size={18}/>
            </div>
            <span style={{ color: btb.text, fontSize: 12, fontWeight: 600 }}>{a.name}</span>
          </Glass>
        ))}
      </div>

      {/* featured NFT */}
      <Glass padding={16} radius={22} onClick={() => goto('nft')}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: 'linear-gradient(135deg,#7B4FE0,rgba(255,255,255,0.7) 55%,#F59E0B)',
            position: 'relative', overflow: 'hidden',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35), 0 8px 20px rgba(123,79,224,0.4)',
          }}>
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 30% 25%, rgba(255,255,255,0.45), transparent 55%)' }}/>
            <div style={{ position: 'absolute', top: 6, left: 10, width: 12, height: 12, borderRadius: '50%', background: 'rgba(255,255,255,0.25)' }}/>
            <div style={{ position: 'absolute', top: 6, right: 10, width: 12, height: 12, borderRadius: '50%', background: 'rgba(255,255,255,0.25)' }}/>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="bolt" size={13} color="rgba(255,255,255,0.7)"/>
              <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase' }}>Live mint</span>
            </div>
            <div style={{ color: btb.text, fontSize: 16, fontWeight: 700, marginTop: 2 }}>BTB Bear NFT</div>
            <div style={{ color: btb.textMuted, fontSize: 12, marginTop: 2 }}>0.01 ETH · Max 100,000 supply</div>
          </div>
          <Icon name="arrow" size={18} color="rgba(255,255,255,0.6)"/>
        </div>
      </Glass>

      {/* earn XP — quests */}
      {address && (
        <Glass padding={0} radius={22}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px 10px' }}>
            <div>
              <div style={{ color: btb.text, fontSize: 15, fontWeight: 800, letterSpacing: -0.3 }}>Earn XP</div>
              <div style={{ color: btb.textDim, fontSize: 11, marginTop: 1 }}>Redeem for BTB later</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: '#52E3A4', fontSize: 18, fontWeight: 800, letterSpacing: -0.4 }}>{xp.toLocaleString('en-US')} XP</div>
              {streak > 0 && <div style={{ color: '#FFB36B', fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3, justifyContent: 'flex-end' }}><Icon name="fire" size={11} color="#FFB36B"/>{streak}-day streak</div>}
            </div>
          </div>

          {/* daily check-in quest (actionable) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ width: 36, height: 36, borderRadius: 11, background: 'rgba(255,179,107,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name="fire" size={18} color="#FFB36B"/>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: btb.text, fontSize: 13.5, fontWeight: 700 }}>Daily check-in</div>
              <div style={{ color: btb.textMuted, fontSize: 11 }}>
                {daysToWeekly === 0 ? 'Weekly bonus on next check-in!' : `+${nextDailyXp} XP · ${daysToWeekly}d to weekly bonus`}
              </div>
            </div>
            <button onClick={doDaily} disabled={dailyDone || busy} style={{
              flexShrink: 0, height: 34, padding: '0 14px', borderRadius: 11, border: 'none', fontFamily: 'inherit',
              cursor: dailyDone || busy ? 'default' : 'pointer',
              background: dailyDone ? 'rgba(82,227,164,0.12)' : 'linear-gradient(135deg,#52E3A4,#1aad77)',
              color: dailyDone ? '#52E3A4' : '#fff', fontSize: 12.5, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            }}>
              {dailyDone ? <><Icon name="check" size={13} color="#52E3A4"/>Done</> : busy ? '…' : `+${nextDailyXp}`}
            </button>
          </div>

          {/* action quests (navigate) */}
          {[
            { icon: 'swap', color: '#FFFFFF', bg: 'rgba(255,255,255,0.1)',  title: 'Swap any token',   xp: 100,  tab: 'swap' as Tab },
            { icon: 'nft',  color: '#FFB36B', bg: 'rgba(255,179,107,0.15)', title: 'Mint a BTB Bear',  xp: 1000, tab: 'nft'  as Tab },
          ].map(q => (
            <div key={q.title} onClick={() => goto(q.tab)} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer',
              borderTop: '1px solid rgba(255,255,255,0.05)',
            }}>
              <div style={{ width: 36, height: 36, borderRadius: 11, background: q.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name={q.icon} size={18} color={q.color}/>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: btb.text, fontSize: 13.5, fontWeight: 700 }}>{q.title}</div>
                <div style={{ color: btb.textMuted, fontSize: 11 }}>Earn +{q.xp.toLocaleString('en-US')} XP</div>
              </div>
              <span style={{ flexShrink: 0, color: '#52E3A4', fontSize: 12.5, fontWeight: 800 }}>+{q.xp.toLocaleString('en-US')}</span>
              <Icon name="arrow" size={15} color="rgba(255,255,255,0.35)"/>
            </div>
          ))}
        </Glass>
      )}

      {/* more from btb */}
      <div style={{ padding: '8px 6px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: btb.text, fontSize: 18, fontWeight: 700, letterSpacing: -0.3 }}>More from BTB</span>
        <span onClick={onProducts} style={{ color: btb.red, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>See all →</span>
      </div>
      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
        {PRODUCTS_PREVIEW.map(p => (
          <Glass key={p.name} padding={14} radius={18} onClick={onProducts} style={{ flexShrink: 0, width: 90, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: p.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={p.icon} size={20} color={p.color}/>
            </div>
            <div style={{ color: btb.text, fontSize: 12, fontWeight: 700, textAlign: 'center' }}>{p.name}</div>
            <div style={{
              background: p.tag === 'New' ? 'rgba(255,255,255,0.1)' : 'rgba(82,227,164,0.12)',
              color: p.tag === 'New' ? btb.red : '#52E3A4',
              fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
            }}>{p.tag}</div>
          </Glass>
        ))}
        <div onClick={onProducts} style={{
          flexShrink: 0, width: 90, minHeight: 110,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
          borderRadius: 18, border: '1.5px dashed rgba(255,255,255,0.18)', cursor: 'pointer',
        }}>
          <Icon name="plus" size={22} color={btb.textMuted}/>
          <div style={{ color: btb.textMuted, fontSize: 11, fontWeight: 600, textAlign: 'center' }}>All products</div>
        </div>
      </div>

      {/* holdings — cached snapshot, tap to open full portfolio */}
      {topHoldings.length > 0 && (
        <Glass padding={0} radius={22}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px 10px' }}>
            <span style={{ color: btb.text, fontSize: 14, fontWeight: 700 }}>
              Your tokens <span style={{ color: btb.textMuted, fontWeight: 600 }}>· {heldTokens.length}</span>
            </span>
            {heldTokens.length > topHoldings.length && (
              <span onClick={() => goto('portfolio')} style={{ color: btb.textMuted, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>See all →</span>
            )}
          </div>
          {topHoldings.map((t) => {
            const bal = parseFloat(t.balance ?? '0');
            const balStr = bal >= 1000 ? bal.toLocaleString('en-US', { maximumFractionDigits: 2 })
              : bal >= 0.01 ? bal.toLocaleString('en-US', { maximumFractionDigits: 4 })
              : bal.toExponential(2);
            return (
              <div key={(t.address ?? '') + t.symbol} onClick={() => goto('portfolio')} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', cursor: 'pointer',
                borderTop: '1px solid rgba(255,255,255,0.05)',
              }}>
                <TokenIcon symbol={t.symbol} size={34} logoUrl={t.logoURI}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: btb.text, fontSize: 14, fontWeight: 700 }}>{t.symbol}</div>
                  <div style={{ color: btb.textMuted, fontSize: 11.5, marginTop: 1 }}>{balStr}</div>
                </div>
                <div style={{ color: btb.text, fontSize: 13.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                  ${fmtUsd(t.usdValue ?? 0)}
                </div>
              </div>
            );
          })}
        </Glass>
      )}

      {/* coming-soon toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)',
          zIndex: 150, maxWidth: 'calc(100% - 36px)',
          padding: '12px 18px', borderRadius: 14,
          background: 'rgba(20,3,8,0.92)', border: '1px solid rgba(255,179,107,0.35)',
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          color: '#FFB36B', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
          boxShadow: '0 8px 28px rgba(0,0,0,0.4)',
        }}>{toast}</div>
      )}
    </div>
  );
}
