'use client';
/**
 * Every OPOS Uniswap V2 pair: the BTB it holds and the fees it has earned,
 * split into what the Safe can withdraw and what is burned (locked forever).
 * Also the 1% OPOS tax the treasury collects, the other income OPOS makes.
 * Read only. Hidden route: /opos-pairs.
 */
import { useEffect, useMemo, useState } from 'react';
import { useConfig } from 'wagmi';
import { getPublicClient } from 'wagmi/actions';
import { Glass } from '../Glass';
import { Button } from '../Button';
import { btb } from '../design-tokens';
import { readOposPairs, readFees24h, readOposTax, OPOS_TREASURY, type OposPairsSummary, type OposTax } from '../../lib/oposPairs';
import { LP_RECIPIENT, fmt } from '../../lib/oposSeed';

export function OposPairsScreen() {
  const config = useConfig();
  const client = getPublicClient(config, { chainId: 1 });
  const [data, setData] = useState<OposPairsSummary | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  /** undefined while loading, null when it could not be read. */
  const [fees24h, setFees24h] = useState<{ total: number; safe: number; byPair: Record<string, number> } | null | undefined>(undefined);
  const [tax, setTax] = useState<OposTax | null | undefined>(undefined);

  async function load() {
    if (!client) return;
    setLoading(true); setErr(null); setFees24h(undefined); setTax(undefined);
    readOposTax().then(setTax).catch(() => setTax(null));
    try {
      const d = await readOposPairs(client);
      setData(d);
      readFees24h(client, d.pairs).then(setFees24h).catch(() => setFees24h(null));
    }
    catch (e) { setErr((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [client != null]);

  const totals = useMemo(() => {
    const t = { held: 0, value: 0, fees: 0, safeValue: 0, safeFees: 0, burnedValue: 0, burnedFees: 0 };
    for (const p of data?.pairs ?? []) {
      const value = 2 * p.btbSide;
      t.held += p.btbSide; t.value += value; t.fees += p.feesBtb;
      t.safeValue += value * p.safe; t.safeFees += p.feesBtb * p.safe;
      t.burnedValue += value * p.burned; t.burnedFees += p.feesBtb * p.burned;
    }
    return t;
  }, [data]);

  const usd = (b: number) => (data ? `$${fmt(b * data.btbUsd, 2)}` : '');
  const btbAmt = (b: number) => `${fmt(b, 0)} BTB`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ color: btb.text, fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>OPOS pairs</div>
          <div style={{ color: btb.textMuted, fontSize: 12.5, marginTop: 4, maxWidth: 720 }}>
            Every OPOS pair on Uniswap V2 or any V2 fork, found from the known tokens and from every contract holding OPOS, valued in BTB at each pool&apos;s own price (a pool holds equal value on both sides, and 1 BTB is 1,000,000 OPOS). Fees are the 0.3% swap fee the pool has kept since it opened.
          </div>
        </div>
        <Button variant="ghost" size="md" onClick={load} loading={loading} disabled={loading}>Refresh</Button>
      </div>

      {err && <div style={{ color: btb.loss, fontSize: 12.5 }}>{err}</div>}
      {!data && !err && <div style={{ color: btb.textDim, fontSize: 12 }}>Reading every OPOS pair…</div>}

      {data && (
        <>
          <Glass padding={14} radius={16} soft>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
              <Stat label="BTB held as OPOS" value={btbAmt(totals.held)} sub={`${usd(totals.held)} across ${data.pairs.length} pairs`}/>
              <Stat label="Total pool value" value={btbAmt(totals.value)} sub={usd(totals.value)}/>
              <Stat label="Fees earned" value={btbAmt(totals.fees)} sub={usd(totals.fees)} tone="green"/>
              <Stat label="Safe can withdraw" value={btbAmt(totals.safeValue)} sub={`${usd(totals.safeValue)}, of which fees ${usd(totals.safeFees)}`} tone="green"/>
              <Stat label="Burned LP (locked)" value={btbAmt(totals.burnedValue)} sub={`${usd(totals.burnedValue)}, of which fees ${usd(totals.burnedFees)}`}/>
            </div>
            <div style={{ color: btb.textDim, fontSize: 11, marginTop: 10 }}>
              BTB ${data.btbUsd.toExponential(4)}. Safe is {LP_RECIPIENT.slice(0, 6)}…{LP_RECIPIENT.slice(-4)}. Burned LP was sent to 0xdead, so its liquidity and fees stay in the pool for good.{data.unknownHolders > 0 ? ` ${data.unknownHolders} other contracts hold OPOS but are not pairs (bots and routers).` : ''}
            </div>
          </Glass>

          <Glass padding={14} radius={16} soft>
            <div style={{ color: btb.text, fontSize: 14, fontWeight: 800, marginBottom: 10 }}>Income</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
              <Stat label="LP fees, 24h" value={pending(fees24h, (f) => btbAmt(f.total))} sub={fees24h ? `${usd(fees24h.total)}, Safe share ${usd(fees24h.safe)}` : fees24h === null ? 'needs an archive RPC' : ''} tone="green"/>
              <Stat label="1% tax, 24h" value={pending(tax, (t) => btbAmt(t.day))} sub={tax ? usd(tax.day) : ''} tone="green"/>
              <Stat label="1% tax, 7 days" value={pending(tax, (t) => btbAmt(t.week))} sub={tax ? usd(tax.week) : ''}/>
              <Stat label="1% tax, all time" value={pending(tax, (t) => btbAmt(t.all))} sub={tax ? `${usd(tax.all)}${tax.since ? ` since ${new Date(tax.since).toISOString().slice(0, 10)}` : ''}` : ''}/>
              <Stat label="Total, 24h" value={fees24h && tax ? btbAmt(fees24h.total + tax.day) : pending(fees24h && tax, () => '')} sub={fees24h && tax ? usd(fees24h.total + tax.day) : ''} tone="green"/>
            </div>
            <div style={{ color: btb.textDim, fontSize: 11, marginTop: 10 }}>
              Tax is what the treasury {OPOS_TREASURY.slice(0, 6)}…{OPOS_TREASURY.slice(-4)} received, read from Blockscout{tax && tax.ownPaid > 0 ? `, leaving out ${btbAmt(tax.ownPaid)} our own seeding wallet paid` : ''}. It funds the Friday BTB payout to users. LP fees stay in the pools; only the Safe&apos;s share can be withdrawn.
            </div>
            {tax === null && <div style={{ color: btb.amber, fontSize: 11.5, marginTop: 6 }}>Could not reach Blockscout for the tax totals; try Refresh.</div>}
          </Glass>

          <div style={{ overflowX: 'auto', border: btb.borderSoft, borderRadius: 14 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>{['Pair', 'BTB held', 'Pool value', 'Fees earned', 'Fees 24h', 'Owner', 'Pair address'].map((h) => <th key={h} style={th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {data.pairs.map((p) => (
                  <tr key={p.pair}>
                    <td style={{ ...td, color: btb.text, fontWeight: 700 }}>
                      OPOS / {p.symbol}
                      {p.dex !== 'Uniswap V2' && <span style={{ color: btb.amber, fontWeight: 600, marginLeft: 6 }}>{p.dex}</span>}
                      {!p.listed && <span title="Found by the holder scan; not in the seed list" style={{ color: btb.amber, fontWeight: 600, marginLeft: 6 }}>not in list</span>}
                    </td>
                    <td style={td}>{fmt(p.btbSide, 0)}</td>
                    <td style={td}>{fmt(2 * p.btbSide, 0)} <span style={{ color: btb.textDim }}>({usd(2 * p.btbSide)})</span></td>
                    <td style={{ ...td, color: p.feesBtb > 0 ? btb.green : btb.textMuted }}>{fmt(p.feesBtb, 0)} <span style={{ color: btb.textDim }}>({usd(p.feesBtb)})</span></td>
                    <td style={td}>{fees24h ? fmt(fees24h.byPair[p.pair] ?? 0, 0) : fees24h === null ? 'n/a' : '…'}</td>
                    <td style={td}>{owner(p)}</td>
                    <td style={td}>
                      <a href={`https://etherscan.io/address/${p.pair}`} target="_blank" rel="noreferrer" style={{ color: btb.amber, textDecoration: 'none' }}>{p.pair.slice(0, 8)}…{p.pair.slice(-6)}</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

/** A value that is still loading (undefined) or could not be read (null). */
function pending<T>(v: T | null | undefined, show: (v: T) => string): string {
  return v === undefined ? '…' : v === null ? 'n/a' : show(v);
}

function owner(p: { safe: number; burned: number; other: number }): string {
  const parts: string[] = [];
  if (p.safe >= 0.0005) parts.push(`Safe ${(p.safe * 100).toFixed(p.safe > 0.999 ? 0 : 1)}%`);
  if (p.burned >= 0.0005) parts.push(`burned ${(p.burned * 100).toFixed(p.burned > 0.999 ? 0 : 1)}%`);
  if (p.other >= 0.0005) parts.push(`others ${(p.other * 100).toFixed(1)}%`);
  return parts.join(', ');
}

const th: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', color: 'var(--btb-text-dim)', fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .3, borderBottom: btb.borderSoft, whiteSpace: 'nowrap' };
const td: React.CSSProperties = { padding: '7px 10px', borderBottom: '1px solid rgba(var(--fg-rgb), 0.05)', whiteSpace: 'nowrap', color: 'var(--btb-text-muted)' };

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'green' }) {
  return (
    <div>
      <div style={{ color: btb.textDim, fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .3 }}>{label}</div>
      <div style={{ color: tone === 'green' ? btb.green : btb.text, fontSize: 16, fontWeight: 800, marginTop: 2 }}>{value}</div>
      {sub && <div style={{ color: btb.textDim, fontSize: 10.5, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
