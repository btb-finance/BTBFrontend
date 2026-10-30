'use client';
/**
 * Check-ins and multi-wallet clusters, for admins only (hidden route /checkins; wallets listed in ADMIN_WALLETS in the
 * Convex environment). Daily check-ins with how many browsers and IPs they came from, this week's clusters (wallets
 * paid as one person on Friday), wallets that only share an IP (shown, not acted on), and last week's adjustments.
 */
import { useQuery } from 'convex/react';
import { useConnection } from 'wagmi';
import { api } from '../../../convex/_generated/api';
import { Button } from '../Button';
import { btb } from '../design-tokens';
import { useWalletSession } from '../../lib/session';

const short = (a: string) => `${a.slice(0, 6)}...${a.slice(-4)}`;
const dayLabel = (d: number) => new Date(d * 86_400_000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export function CheckinsScreen() {
  const { address } = useConnection();
  const session = useWalletSession(address);
  const data = useQuery(api.sybil.adminStats, session.token ? { sessionToken: session.token } : 'skip');
  const card = { borderRadius: 16, padding: 16, border: btb.borderSoft, background: 'rgba(var(--fg-rgb), 0.04)' } as const;
  const label = { color: btb.textDim, fontSize: 11.5, fontWeight: 700 } as const;

  if (!address) return <div style={{ color: btb.textMuted, fontSize: 13 }}>Connect an admin wallet.</div>;
  if (!session.token) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 420 }}>
        <div style={{ color: btb.textMuted, fontSize: 13 }}>Admins sign in once to read this page.</div>
        <Button variant="success" size="md" fullWidth={false} onClick={() => session.ensure().catch(() => {})}>Sign in</Button>
      </div>
    );
  }
  if (data === undefined) return <div style={{ color: btb.textDim, fontSize: 13 }}>Loading...</div>;
  if (!data.ok) return <div style={{ color: btb.loss, fontSize: 13 }}>{data.reason}</div>;

  const max = Math.max(1, ...data.days.map((d) => d.wallets));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 1000, margin: '0 auto', width: '100%' }}>
      <div style={{ color: btb.text, fontSize: 22, fontWeight: 800 }}>Check-ins</div>

      <div style={card}>
        <div style={label}>Last 14 days: wallets that checked in, with the browsers and IPs they came from</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(14, minmax(0, 1fr))', gap: 6, alignItems: 'end', height: 140, marginTop: 12 }}>
          {data.days.map((d) => (
            <div key={d.day} title={`${dayLabel(d.day)}: ${d.wallets} wallets, ${d.devices} browsers, ${d.ips} IPs, ${d.newWallets} new`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
              <span style={{ color: btb.text, fontSize: 11, fontWeight: 800 }}>{d.wallets}</span>
              <div style={{ width: '100%', height: `${(d.wallets / max) * 100}%`, minHeight: 3, borderRadius: 6, background: d.devices < d.wallets ? btb.amber : btb.green }}/>
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(14, minmax(0, 1fr))', gap: 6, marginTop: 4 }}>
          {data.days.map((d) => <span key={d.day} style={{ color: btb.textDim, fontSize: 9.5, textAlign: 'center' }}>{dayLabel(d.day).split(' ')[1]}</span>)}
        </div>
        <div style={{ overflowX: 'auto', marginTop: 12 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, fontVariantNumeric: 'tabular-nums' }}>
            <thead><tr>{['Day', 'Wallets', 'Browsers', 'IPs', 'New wallets'].map((h) => <th key={h} style={{ ...label, textAlign: h === 'Day' ? 'left' : 'right', padding: '6px 8px' }}>{h}</th>)}</tr></thead>
            <tbody>
              {[...data.days].reverse().map((d) => (
                <tr key={d.day} style={{ borderTop: btb.borderSoft }}>
                  <td style={{ padding: '6px 8px', color: btb.text, fontWeight: 700 }}>{dayLabel(d.day)}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', color: btb.text }}>{d.wallets}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', color: d.devices < d.wallets ? btb.amber : btb.textMuted }}>{d.devices}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', color: btb.textMuted }}>{d.ips}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', color: btb.textMuted }}>{d.newWallets}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={card}>
        <div style={label}>This week: {data.walletsThisWeek} wallets checked in. Clusters below are paid as one person on Friday.</div>
        {data.clusters.length === 0 && <div style={{ color: btb.textMuted, fontSize: 12.5, marginTop: 8 }}>No clusters this week.</div>}
        {data.clusters.map((c, i) => (
          <div key={i} style={{ marginTop: 10, paddingTop: 10, borderTop: btb.borderSoft }}>
            <div style={{ color: btb.amber, fontSize: 12.5, fontWeight: 800 }}>{c.wallets.length} wallets: {c.links.join(', ')}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
              {c.wallets.map((w) => (
                <a key={w.wallet} href={`https://etherscan.io/address/${w.wallet}`} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 12, fontFamily: 'ui-monospace, monospace', color: btb.text, padding: '3px 8px', borderRadius: 8, background: 'rgba(var(--fg-rgb), 0.06)', textDecoration: 'none' }}>
                  {short(w.wallet)} <span style={{ color: btb.textDim }}>{Math.round(w.points)} XP</span>
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>

      {data.sharedIp.length > 0 && (
        <div style={card}>
          <div style={label}>Same IP only (homes, offices, mobile networks): shown, not acted on</div>
          {data.sharedIp.map((g, i) => (
            <div key={i} style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {g.wallets.map((w) => <span key={w.wallet} style={{ fontSize: 12, fontFamily: 'ui-monospace, monospace', color: btb.textMuted }}>{short(w.wallet)} ({Math.round(w.points)} XP)</span>)}
            </div>
          ))}
        </div>
      )}

      {data.lastWeekAdjusted.length > 0 && (
        <div style={card}>
          <div style={label}>Last Friday: wallets whose share was changed, and why</div>
          {data.lastWeekAdjusted.map((r) => (
            <div key={r.wallet} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12.5, marginTop: 8 }}>
              <span style={{ fontFamily: 'ui-monospace, monospace', color: btb.text }}>{short(r.wallet)}</span>
              <span style={{ color: btb.textMuted, flex: 1, minWidth: 0 }}>{r.note}</span>
              <span style={{ color: btb.text, fontWeight: 700 }}>{Math.round(r.points)} to {Math.round(r.counted)} XP</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
