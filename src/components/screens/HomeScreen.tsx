'use client';
import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { Glass } from '../Glass';
import { Icon } from '../Icon';
import { Spinner } from '../Spinner';
import { TokenIcon } from '../TokenIcon';
import { btb } from '../design-tokens';
import { DataTable, Column } from '../DataTable';
import { PortfolioChart } from '../PortfolioChart';
import { Tab } from '../types';
import { useTokenStore, Token } from '../../lib/TokenStore';
import { useSidebar } from '../../lib/SidebarContext';
import { api } from '../../../convex/_generated/api';
import { SmartTradePanel } from '../SmartTradePanel';

function fmtUsd(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function HomeScreen({ goto, address, onSend, onReceive, onConnectWallet }: {
  goto: (t: Tab) => void;
  address?: string;
  onDisconnect?: () => void;
  onReceive?: () => void;
  onSend?: () => void;
  onDocs?: () => void;
  onEarn?: () => void;
  onConnectWallet?: () => void;
}) {
  const { positions, loadingBalances } = useTokenStore();
  const { isMobile } = useSidebar();

  const totalUsd = positions.reduce((s, t) => s + (t.usdValue ?? 0), 0);
  const heldTokens = [...positions]
    .filter(t => parseFloat(t.balance ?? '0') > 0)
    .sort((a, b) => (b.usdValue ?? 0) - (a.usdValue ?? 0));

  // ── Check-in / XP ──────────────────────────────────────────────────────────
  const dailyXpFor = (s: number) => Math.min(10 + (s - 1) * 2, 50);
  const profile = useQuery(api.users.getUser, address ? { walletAddress: address } : 'skip');
  const checkIn = useMutation(api.users.checkIn);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  function flashToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }

  const xp = profile?.points ?? 0;
  const streak = profile?.currentStreak ?? 0;
  const MS_DAY = 86_400_000;
  const now = Date.now();
  const dailyDone = !!profile?.lastCheckIn && profile.lastCheckIn >= now - (now % MS_DAY);
  const yesterdayStart = now - (now % MS_DAY) - MS_DAY;
  const stillConsecutive = !!profile?.lastCheckIn && profile.lastCheckIn >= yesterdayStart;
  const nextStreak = dailyDone ? streak : (stillConsecutive ? streak + 1 : 1);
  const nextDailyXp = dailyXpFor(nextStreak);

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

  const allColumns: Column<Token>[] = [
    {
      key: 'symbol', label: 'Asset', sortable: true, sortValue: t => t.symbol,
      render: t => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <TokenIcon symbol={t.symbol} size={28} logoUrl={t.logoURI} />
          <div>
            <div style={{ fontWeight: 700 }}>{t.symbol}</div>
            <div style={{ color: btb.textMuted, fontSize: 11.5 }}>{t.name}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'balance', label: 'Balance', align: 'right', sortable: true, sortValue: t => parseFloat(t.balance ?? '0'),
      render: t => {
        const bal = parseFloat(t.balance ?? '0');
        return bal >= 1000 ? bal.toLocaleString('en-US', { maximumFractionDigits: 2 })
          : bal >= 0.01 ? bal.toLocaleString('en-US', { maximumFractionDigits: 4 })
          : bal.toExponential(2);
      },
    },
    {
      key: 'price', label: 'Price', align: 'right', sortable: true, sortValue: t => t.usdPrice ?? 0,
      render: t => t.usdPrice != null ? `$${t.usdPrice.toLocaleString('en-US', { maximumFractionDigits: t.usdPrice < 1 ? 6 : 2 })}` : '—',
    },
    {
      key: 'change', label: '24h', align: 'right', sortable: true, sortValue: t => t.changePct1d ?? 0,
      render: t => t.changePct1d != null
        ? <span style={{ color: t.changePct1d >= 0 ? btb.green : btb.loss, fontWeight: 600 }}>{t.changePct1d >= 0 ? '+' : ''}{t.changePct1d.toFixed(2)}%</span>
        : '—',
    },
    {
      key: 'value', label: 'Value', align: 'right', sortable: true, sortValue: t => t.usdValue ?? 0,
      render: t => <span style={{ fontWeight: 700 }}>${fmtUsd(t.usdValue ?? 0)}</span>,
    },
  ];
  const columns = allColumns.filter(c => !isMobile || ['symbol', 'balance', 'value'].includes(c.key));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <Glass padding={22} radius={18} strong style={{ flex: 2, minWidth: 280 }}>
          {address && heldTokens.length > 0 ? (
            <PortfolioChart heldTokens={heldTokens} />
          ) : (
            <>
              <div style={{ color: btb.textMuted, fontSize: 13, fontWeight: 500 }}>Total balance</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
                {loadingBalances && totalUsd === 0
                  ? <Spinner size={20} color="#fff" track="rgba(255,255,255,0.18)" />
                  : <span style={{ color: btb.text, fontSize: 34, fontWeight: 800, letterSpacing: -1 }}>${fmtUsd(totalUsd)}</span>
                }
              </div>
              <div style={{ color: btb.textMuted, fontSize: 12, marginTop: 6 }}>
                {positions.length} {positions.length === 1 ? 'token' : 'tokens'}
              </div>
            </>
          )}
        </Glass>

        <Glass padding={22} radius={18} style={{ flex: 1, minWidth: 240 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ color: btb.text, fontSize: 14, fontWeight: 800 }}>Earn XP</div>
              <div style={{ color: btb.textDim, fontSize: 11, marginTop: 2 }}>Redeem for BTB later</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: btb.green, fontSize: 20, fontWeight: 800 }}>{xp.toLocaleString('en-US')} XP</div>
              {streak > 0 && <div style={{ color: btb.amber, fontSize: 11, fontWeight: 600 }}>{streak}-day streak</div>}
            </div>
          </div>
          <button
            onClick={() => (!address ? onConnectWallet?.() : doDaily())}
            disabled={!!address && (dailyDone || busy)}
            style={{
              marginTop: 14, width: '100%', height: 36, borderRadius: 10, border: 'none', fontFamily: 'inherit',
              cursor: address && (dailyDone || busy) ? 'default' : 'pointer',
              background: dailyDone ? 'rgba(82,227,164,0.12)' : btb.gradGreen,
              color: dailyDone ? btb.green : '#fff', fontSize: 12.5, fontWeight: 700,
            }}
          >
            {!address ? 'Connect wallet to earn XP' : dailyDone ? 'Checked in today' : busy ? '…' : `Daily check-in · +${nextDailyXp} XP`}
          </button>
        </Glass>
      </div>

      <SmartTradePanel owner={address} onConnect={onConnectWallet}/>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ color: btb.text, fontSize: 16, fontWeight: 700 }}>Your tokens</span>
          {heldTokens.length > 0 && (
            <span onClick={() => goto('portfolio')} style={{ color: btb.textMuted, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>View portfolio →</span>
          )}
        </div>
        <div style={{ borderRadius: 16, border: btb.borderSoft, background: btb.surfaceSoft, overflow: 'hidden' }}>
          <DataTable
            columns={columns}
            rows={heldTokens}
            rowKey={t => (t.address ?? '') + t.symbol}
            loading={loadingBalances && heldTokens.length === 0}
            emptyMessage="No tokens held yet"
            defaultSortKey="value"
          />
        </div>
      </div>

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          zIndex: 150, padding: '12px 18px', borderRadius: 14,
          background: 'rgba(20,3,8,0.92)', border: '1px solid rgba(255,179,107,0.35)',
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          color: btb.amber, fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
          boxShadow: '0 8px 28px rgba(0,0,0,0.4)',
        }}>{toast}</div>
      )}
    </div>
  );
}
