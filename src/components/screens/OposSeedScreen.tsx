'use client';
import { useEffect, useMemo, useState } from 'react';
import { useConnection, useConfig } from 'wagmi';
import { getPublicClient } from 'wagmi/actions';
import { erc20Abi, formatUnits, parseUnits } from 'viem';
import { Glass } from '../Glass';
import { Button } from '../Button';
import { btb } from '../design-tokens';
import { useTx } from '../../lib/TxTracker';
import { runCalls } from '../../lib/txRunner';
import { withSafeMulticall } from '@/lib/safeMulticall';
import {
  buildSeedPlan, buildAddLiquidity, buildBuy, buildMintOpos, fmt,
  OPOS, BTB, USDC, OPOS_ABI, LP_RECIPIENT, USD_PER_SIDE, TOKENS, type SeedPlan, type SeedRow,
} from '../../lib/oposSeed';

/**
 * OPOS pair seeding from the connected wallet. Every button is one wallet
 * confirmation; nothing runs unattended. Same pricing and safety rules as
 * scripts/opos-seed-pairs.ts. Hidden route: /opos-seed.
 */
export function OposSeedScreen() {
  const { address } = useConnection();
  const config = useConfig();
  const { track } = useTx();
  const [plan, setPlan] = useState<SeedPlan | null>(null);
  const [progress, setProgress] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [treasury, setTreasury] = useState<string | null>(null);
  const [bal, setBal] = useState<{ eth: bigint; usdc: bigint; btb: bigint; opos: bigint; tokens: Record<string, bigint> } | null>(null);
  const [done, setDone] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const client = getPublicClient(config, { chainId: 1 });

  async function refreshBalances() {
    if (!address || !client) return;
    const [eth, base, tokens, tr] = await Promise.all([
      client.getBalance({ address }),
      withSafeMulticall(client).multicall({ contracts: [USDC, BTB, OPOS].map((a) => ({ address: a, abi: erc20Abi, functionName: 'balanceOf' as const, args: [address] as const })), allowFailure: true }),
      withSafeMulticall(client).multicall({ contracts: TOKENS.map((t) => ({ address: t.address, abi: erc20Abi, functionName: 'balanceOf' as const, args: [address] as const })), allowFailure: true }),
      client.readContract({ address: OPOS, abi: OPOS_ABI, functionName: 'treasury' }).catch(() => null),
    ]);
    const g = (r: { status: string; result?: unknown }) => (r.status === 'success' ? (r.result as bigint) : 0n);
    const tk: Record<string, bigint> = {};
    TOKENS.forEach((t, i) => { tk[t.symbol] = g(tokens[i]); });
    setBal({ eth, usdc: g(base[0]), btb: g(base[1]), opos: g(base[2]), tokens: tk });
    setTreasury(tr);
  }
  useEffect(() => { refreshBalances(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [address]);

  async function loadPlan() {
    if (!client) return;
    setErr(null); setPlan(null); setBusy('plan');
    try {
      const p = await buildSeedPlan(client, setProgress);
      setPlan(p);
      const sel: Record<string, boolean> = {};
      for (const r of p.rows) sel[r.symbol] = r.ok;
      setSelected(sel);
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(null); setProgress(''); }
  }

  const isTreasury = !!address && !!treasury && address.toLowerCase() === treasury.toLowerCase();
  const chosen = useMemo(() => (plan?.rows ?? []).filter((r) => selected[r.symbol]), [plan, selected]);
  const oposNeeded = plan ? plan.oposPerSide * BigInt(chosen.length) : 0n;
  const btbNeeded = oposNeeded / 1_000_000n + 1n;

  async function run(label: string, calls: { to: `0x${string}`; data: `0x${string}`; value?: bigint }[], key: string) {
    if (!address) return;
    setBusy(key); setErr(null);
    try {
      await runCalls(config, { account: address, calls, label, track, chainId: 1 });
      setDone((d) => ({ ...d, [key]: 'ok' }));
      await refreshBalances();
    } catch (e) { setErr((e as { shortMessage?: string })?.shortMessage ?? (e as Error).message); }
    finally { setBusy(null); }
  }

  async function mint() {
    if (!bal) return;
    const need = oposNeeded > bal.opos ? (oposNeeded - bal.opos) / 1_000_000n + 1n : 0n;
    if (need === 0n) { setErr('Wallet already holds enough OPOS'); return; }
    const c = buildMintOpos(need);
    await run(`Mint ${formatUnits(need * 1_000_000n, 18)} OPOS`, [c.approve, c.mint], 'mint');
  }
  async function buy(row: SeedRow) {
    if (!address) return;
    const c = await buildBuy(row, address);
    await run(`Buy $${USD_PER_SIDE} ${row.symbol}`, [c.approve, c.swap], `buy:${row.symbol}`);
  }
  async function add(row: SeedRow) {
    if (!plan || !bal) return;
    const held = bal.tokens[row.symbol] ?? 0n;
    const amount = held < row.amount ? held : row.amount;
    if (amount === 0n) { setErr(`No ${row.symbol} in the wallet yet; buy first`); return; }
    const c = buildAddLiquidity(row, amount, plan.oposUsd);
    await run(`Add OPOS/${row.symbol}`, [c.approveToken, c.approveOpos, c.add], `add:${row.symbol}`);
  }

  const money = (v: bigint, d: number) => Number(formatUnits(v, d)).toLocaleString('en-US', { maximumFractionDigits: d > 6 ? 4 : 2 });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 1100, margin: '0 auto' }}>
      <div>
        <div style={{ color: btb.text, fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>OPOS pair seeding</div>
        <div style={{ color: btb.textMuted, fontSize: 12.5, marginTop: 4 }}>
          ${USD_PER_SIDE} of OPOS against ${USD_PER_SIDE} of each token, priced at the median of the existing OPOS pools. LP tokens go to the Safe {LP_RECIPIENT.slice(0, 6)}…{LP_RECIPIENT.slice(-4)}. Every button is one wallet confirmation.
        </div>
      </div>

      <Glass padding={14} radius={16} soft>
        {!address ? (
          <div style={{ color: btb.amber, fontSize: 13 }}>Connect the wallet that will seed. It must be the OPOS treasury or every deposit is taxed 1%.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, fontSize: 12.5 }}>
            <Stat label="Wallet" value={`${address.slice(0, 6)}…${address.slice(-4)}`} sub={isTreasury ? 'is the OPOS treasury (tax free)' : `not the treasury (${treasury ? treasury.slice(0, 6) + '…' : '?'}), deposits would be taxed`} tone={isTreasury ? 'green' : 'amber'}/>
            <Stat label="ETH" value={bal ? money(bal.eth, 18) : '…'} sub="gas"/>
            <Stat label="USDC" value={bal ? money(bal.usdc, 6) : '…'} sub={`need ${chosen.length * USD_PER_SIDE} plus slippage`}/>
            <Stat label="BTB" value={bal ? money(bal.btb, 18) : '…'} sub={plan ? `need ${money(btbNeeded, 18)} to mint` : ''}/>
            <Stat label="OPOS" value={bal ? Number(formatUnits(bal.opos, 18)).toExponential(3) : '…'} sub={plan ? `need ${Number(formatUnits(oposNeeded, 18)).toExponential(3)}` : ''}/>
          </div>
        )}
      </Glass>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Button variant="success" size="md" onClick={loadPlan} loading={busy === 'plan'} disabled={!address || busy != null}>{plan ? 'Re-read prices' : 'Read prices and simulate'}</Button>
        {plan && <Button variant="ghost" size="md" onClick={mint} loading={busy === 'mint'} disabled={busy != null || !isTreasury || chosen.length === 0}>1. Mint OPOS for {chosen.length} pairs</Button>}
        {progress && <span style={{ color: btb.textMuted, fontSize: 12 }}>{progress}</span>}
      </div>
      {err && <div style={{ color: btb.loss, fontSize: 12.5 }}>{err}</div>}

      {plan && (
        <>
          <Glass padding={12} radius={14} soft>
            <div style={{ color: btb.textMuted, fontSize: 12, lineHeight: 1.6 }}>
              WETH ${fmt(plan.wethUsd)} · BTB ${plan.btbUsd.toExponential(4)} · peg OPOS {plan.pegOpos.toExponential(4)} · pool median {plan.median.toExponential(4)} (gap {(plan.gap * 100).toFixed(2)}%) · seeding at the median: <b style={{ color: btb.text }}>{Number(formatUnits(plan.oposPerSide, 18)).toExponential(4)} OPOS per pool</b>.
              {' '}{chosen.length} of {plan.rows.length} pairs selected. Held rows failed the three-source check or move more than 0.5% on a ${USD_PER_SIDE} buy; they can be re-read later.
            </div>
          </Glass>
          <div style={{ overflowX: 'auto', border: btb.borderSoft, borderRadius: 14 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>{['', 'Token', 'V3', 'Market', 'Llama', 'Gap', 'Impact', 'Token amount', 'Held', 'Buy', 'Add LP', 'Status'].map((h) => <th key={h} style={{ textAlign: 'left', padding: '8px 10px', color: btb.textDim, fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .3, borderBottom: btb.borderSoft, whiteSpace: 'nowrap' }}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {plan.rows.map((r) => {
                  const held = bal?.tokens[r.symbol] ?? 0n;
                  const haveEnough = held >= r.amount;
                  const already = !!r.pair && done[`add:${r.symbol}`] !== 'ok';
                  return (
                    <tr key={r.symbol} style={{ opacity: r.ok ? 1 : 0.55 }}>
                      <td style={td}><input type="checkbox" checked={!!selected[r.symbol]} onChange={(e) => setSelected((s) => ({ ...s, [r.symbol]: e.target.checked }))} disabled={!r.ok}/></td>
                      <td style={{ ...td, color: btb.text, fontWeight: 700 }}>{r.symbol}{r.pair && r.symbol !== 'CRV' ? <span title={r.pair} style={{ color: btb.textDim, fontWeight: 500 }}> (pair exists)</span> : null}</td>
                      <td style={td}>{r.v3 != null ? fmt(r.v3, 6) : 'n/a'}</td>
                      <td style={td}>{r.market != null ? fmt(r.market, 6) : 'n/a'}</td>
                      <td style={td}>{r.llama != null ? fmt(r.llama, 6) : 'n/a'}</td>
                      <td style={{ ...td, color: r.gap <= 0.013 ? btb.green : btb.amber }}>{Number.isFinite(r.gap) ? `${(r.gap * 100).toFixed(2)}%` : 'n/a'}</td>
                      <td style={{ ...td, color: Math.abs(r.impact) <= 0.005 ? btb.textMuted : btb.amber }}>{(r.impact * 100).toFixed(2)}%</td>
                      <td style={td}>{r.amount > 0n ? money(r.amount, r.dec) : '…'}</td>
                      <td style={{ ...td, color: haveEnough ? btb.green : btb.textMuted }}>{money(held, r.dec)}</td>
                      <td style={td}>{r.symbol !== 'USDC' && <Button size="sm" variant="ghost" onClick={() => buy(r)} loading={busy === `buy:${r.symbol}`} disabled={busy != null || !r.ok || haveEnough}>{haveEnough ? 'Held' : `Buy $${USD_PER_SIDE}`}</Button>}</td>
                      <td style={td}><Button size="sm" variant={haveEnough && isTreasury ? 'success' : 'ghost'} onClick={() => add(r)} loading={busy === `add:${r.symbol}`} disabled={busy != null || !r.ok || !haveEnough || !isTreasury || (bal?.opos ?? 0n) < plan.oposPerSide}>Add LP</Button></td>
                      <td style={{ ...td, color: done[`add:${r.symbol}`] ? btb.green : btb.textDim, fontSize: 11 }}>{done[`add:${r.symbol}`] ? 'seeded' : r.ok ? (already ? 'pair exists, topping up' : 'ready') : `hold: ${r.note || 'sources disagree'}`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

const td: React.CSSProperties = { padding: '7px 10px', borderBottom: '1px solid rgba(var(--fg-rgb), 0.05)', whiteSpace: 'nowrap', color: 'var(--btb-text-muted)' };

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'green' | 'amber' }) {
  return (
    <div>
      <div style={{ color: btb.textDim, fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .3 }}>{label}</div>
      <div style={{ color: btb.text, fontSize: 14, fontWeight: 800, marginTop: 2 }}>{value}</div>
      {sub && <div style={{ color: tone === 'green' ? btb.green : tone === 'amber' ? btb.amber : btb.textDim, fontSize: 10.5, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
