'use client';
/**
 * OPOS pair seeding, one wallet confirmation per step. Nothing runs without a
 * click: the page reads only balances and the OPOS reference price on load;
 * a token is priced (three sources, Kyber impact) the moment you act on it.
 * Hidden route: /opos-seed.
 */
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
  readReference, priceToken, buildAddLiquidity, buildBuy, buildMintOpos, buildWrap, fmt,
  OPOS, BTB, USDC, OPOS_ABI, LP_RECIPIENT, USD_PER_SIDE, TOKENS, V2_FACTORY, FACTORY_ABI, PAIR_ABI, type SeedReference, type SeedRow,
} from '../../lib/oposSeed';

export function OposSeedScreen() {
  const { address } = useConnection();
  const config = useConfig();
  const { track } = useTx();
  const [ref, setRef] = useState<SeedReference | null>(null);
  const [rows, setRows] = useState<Record<string, SeedRow>>({});
  const [err, setErr] = useState<string | null>(null);
  /** Why a row refused, shown in that row rather than only at the top. */
  const [rowErr, setRowErr] = useState<Record<string, string>>({});
  /** Key of the step currently waiting on the wallet or the chain, if any. */
  const [busy, setBusy] = useState<string | null>(null);
  const [treasury, setTreasury] = useState<string | null>(null);
  const [bal, setBal] = useState<{ eth: bigint; usdc: bigint; btb: bigint; opos: bigint; tokens: Record<string, bigint> } | null>(null);
  const [done, setDone] = useState<Record<string, string>>({});
  const [pairsToMint, setPairsToMint] = useState(5);
  const [custom, setCustom] = useState<SeedToken[]>(() => loadCustom());
  const [customInput, setCustomInput] = useState('');
  /** Per token: how much of the held balance to put in, as a decimal string. Blank means the $100 default. */
  const [amountIn, setAmountIn] = useState<Record<string, string>>({});

  const client = getPublicClient(config, { chainId: 1 });

  const list: SeedToken[] = useMemo(() => [...TOKENS, ...custom], [custom]);

  /** Existing OPOS pair per token: address and what is already in it. Read for
   * every token in one pass so a pool that exists is obvious before you add. */
  const [pairs, setPairs] = useState<Record<string, { address: `0x${string}`; opos: bigint; other: bigint } | null>>({});
  async function refreshPairs(only?: string[]) {
    if (!client) return;
    const targets = list.filter((t) => (only ? only.includes(t.symbol) : pairs[t.symbol] === undefined));
    if (targets.length === 0) return;
    const found = await withSafeMulticall(client).multicall({ contracts: targets.map((t) => ({ address: V2_FACTORY, abi: FACTORY_ABI, functionName: 'getPair' as const, args: [OPOS, t.address] as const })), allowFailure: true });
    const live: { symbol: string; address: `0x${string}` }[] = [];
    const next: Record<string, { address: `0x${string}`; opos: bigint; other: bigint } | null> = {};
    targets.forEach((t, i) => {
      const a = found[i].status === 'success' ? (found[i].result as `0x${string}`) : null;
      if (a && !/^0x0{40}$/.test(a)) live.push({ symbol: t.symbol, address: a });
      else next[t.symbol] = null;
    });
    if (live.length > 0) {
      const reads = await withSafeMulticall(client).multicall({
        contracts: live.flatMap((p) => [
          { address: p.address, abi: PAIR_ABI, functionName: 'getReserves' as const },
          { address: p.address, abi: PAIR_ABI, functionName: 'token0' as const },
        ]),
        allowFailure: true,
      });
      live.forEach((p, i) => {
        const r = reads[i * 2], t0 = reads[i * 2 + 1];
        if (r.status !== 'success' || t0.status !== 'success') { next[p.symbol] = { address: p.address, opos: 0n, other: 0n }; return; }
        const [r0, r1] = r.result as readonly [bigint, bigint, number];
        const oposFirst = (t0.result as string).toLowerCase() === OPOS.toLowerCase();
        next[p.symbol] = { address: p.address, opos: oposFirst ? r0 : r1, other: oposFirst ? r1 : r0 };
      });
    }
    setPairs((m) => ({ ...m, ...next }));
  }
  useEffect(() => { refreshPairs(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [client != null, list.length]);

  /** decimals per token, read once in one multicall so held balances render
   * before anything is priced. */
  const [decs, setDecs] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!client) return;
    const missing = list.filter((t) => decs[t.symbol] == null);
    if (missing.length === 0) return;
    withSafeMulticall(client).multicall({ contracts: missing.map((t) => ({ address: t.address, abi: erc20Abi, functionName: 'decimals' as const })), allowFailure: true })
      .then((res) => setDecs((m) => {
        const next = { ...m };
        missing.forEach((t, i) => { if (res[i].status === 'success') next[t.symbol] = Number(res[i].result); });
        return next;
      }))
      .catch(() => { /* leave unknown, priced rows fill it in */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client != null, list.length]);

  async function refreshBalances() {
    if (!address || !client) return;
    const [eth, base, tokens, tr] = await Promise.all([
      client.getBalance({ address }),
      withSafeMulticall(client).multicall({ contracts: [USDC, BTB, OPOS].map((a) => ({ address: a, abi: erc20Abi, functionName: 'balanceOf' as const, args: [address] as const })), allowFailure: true }),
      withSafeMulticall(client).multicall({ contracts: list.map((t) => ({ address: t.address, abi: erc20Abi, functionName: 'balanceOf' as const, args: [address] as const })), allowFailure: true }),
      client.readContract({ address: OPOS, abi: OPOS_ABI, functionName: 'treasury' }).catch(() => null),
    ]);
    const g = (r: { status: string; result?: unknown }) => (r.status === 'success' ? (r.result as bigint) : 0n);
    const tk: Record<string, bigint> = {};
    list.forEach((t, i) => { tk[t.symbol] = g(tokens[i]); });
    setBal({ eth, usdc: g(base[0]), btb: g(base[1]), opos: g(base[2]), tokens: tk });
    setTreasury(tr);
  }
  useEffect(() => { refreshBalances(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [address, list.length]);
  useEffect(() => {
    if (!client || ref) return;
    readReference(client).then(setRef).catch((e) => setErr((e as Error).message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client != null]);

  const isTreasury = !!address && !!treasury && address.toLowerCase() === treasury.toLowerCase();
  const oposPerPair = ref?.oposPerSide ?? 0n;
  const oposPairsHeld = bal && oposPerPair > 0n ? Number(bal.opos / oposPerPair) : 0;
  const btbPairsPossible = bal && oposPerPair > 0n ? Number((bal.btb * 1_000_000n) / oposPerPair) : 0;

  async function run(label: string, calls: { to: `0x${string}`; data: `0x${string}`; value?: bigint }[], key: string) {
    if (!address) return;
    setBusy(key); setErr(null);
    try {
      await runCalls(config, { account: address, calls, label, track, chainId: 1 });
      setDone((d) => ({ ...d, [key]: 'ok' }));
      await refreshBalances();
      if (key.startsWith('add:')) await refreshPairs([key.slice(4)]);
    } catch (e) { setErr((e as { shortMessage?: string })?.shortMessage ?? (e as Error).message); }
    finally { setBusy(null); }
  }

  /** Price a token now (kept for the session) and report whether it passes. */
  async function priced(symbol: string): Promise<SeedRow | null> {
    if (!client || !ref) return null;
    if (rows[symbol]) return rows[symbol];
    const t = list.find((x) => x.symbol === symbol)!;
    setBusy(`price:${symbol}`);
    try {
      const r = await priceToken(client, t, ref);
      setRows((m) => ({ ...m, [symbol]: r }));
      return r;
    } catch (e) { setErr((e as Error).message); return null; }
    finally { setBusy(null); }
  }

  async function addCustom() {
    if (!client) return;
    const addr = customInput.trim();
    if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) { setErr('Paste a token address'); return; }
    if (list.some((t) => t.address.toLowerCase() === addr.toLowerCase())) { setErr('Already in the list'); return; }
    setBusy('custom'); setErr(null);
    try {
      const [symbol, decimals] = await Promise.all([
        client.readContract({ address: addr as `0x${string}`, abi: erc20Abi, functionName: 'symbol' }),
        client.readContract({ address: addr as `0x${string}`, abi: erc20Abi, functionName: 'decimals' }),
      ]);
      if (!decimals && decimals !== 0) throw new Error('not an ERC20');
      const t: SeedToken = { symbol: list.some((x) => x.symbol === symbol) ? `${symbol}·${addr.slice(2, 6)}` : symbol, address: addr as `0x${string}`, via: 'WETH' };
      const next = [...custom, t];
      setCustom(next); saveCustom(next); setCustomInput('');
    } catch (e) { setErr(`Could not read that token: ${(e as Error).message}`); }
    finally { setBusy(null); }
  }
  function removeCustom(symbol: string) {
    const next = custom.filter((t) => t.symbol !== symbol);
    setCustom(next); saveCustom(next);
  }

  async function mint() {
    if (!bal || !ref) return;
    const pairs = BigInt(Math.max(1, pairsToMint));
    const want = oposPerPair * pairs;
    const need = want > bal.opos ? (want - bal.opos) / 1_000_000n + 1n : 0n;
    if (need === 0n) { setErr('Wallet already holds enough OPOS for that many pairs'); return; }
    if (need > bal.btb) { setErr(`Minting for ${pairs} pairs needs ${Number(formatUnits(need, 18)).toLocaleString()} BTB; wallet holds ${Number(formatUnits(bal.btb, 18)).toLocaleString()}. Lower the count.`); return; }
    const c = buildMintOpos(need);
    await run(`Mint OPOS for ${pairs} pairs`, [c.approve, c.mint], 'mint');
  }
  async function buy(symbol: string) {
    if (!address) return;
    const r = await priced(symbol);
    if (!r) return;
    if (!r.ok) { setErr(`${symbol} on hold: ${r.note || 'price sources disagree'}`); return; }
    const c = await buildBuy(r, address);
    await run(`Buy $${USD_PER_SIDE} ${symbol}`, [c.approve, c.swap], `buy:${symbol}`);
  }
  async function wrap(symbol: string) {
    if (!bal) return;
    const r = await priced(symbol);
    if (!r) return;
    const held = bal.tokens[symbol] ?? 0n;
    const need = r.amount > held ? r.amount - held : 0n;
    if (need === 0n) { setErr('Already holding enough WETH'); return; }
    await run(`Wrap ${formatUnits(need, 18)} ETH`, [buildWrap(need)], `buy:${symbol}`);
  }
  async function add(symbol: string, force = false) {
    const say = (m: string) => { setRowErr((x) => ({ ...x, [symbol]: m })); setErr(m); };
    setRowErr((x) => { const n = { ...x }; delete n[symbol]; return n; });
    if (!bal || !ref) { say('still reading the OPOS reference price'); return; }
    if ((bal.tokens[symbol] ?? 0n) === 0n) { say(`no ${symbol} in the wallet yet, buy or wrap first`); return; }
    if (bal.opos === 0n) { say('no OPOS in the wallet, mint first'); return; }
    const r = await priced(symbol);
    if (!r) return;
    if (!r.ok && !force) { say(`on hold: ${r.note || 'price sources disagree'}`); return; }
    const held = bal.tokens[symbol] ?? 0n;
    const typed = (amountIn[symbol] ?? '').trim();
    let amount = typed ? parseUnits(typed as `${number}`, r.dec) : (held < r.amount ? held : r.amount);
    if (amount > held) amount = held;
    if (amount === 0n) { setErr(`No ${symbol} in the wallet yet; buy first`); return; }
    // Overriding a held row: price the side from what the market actually
    // pays, not the V3 pool that disagreed.
    const priceRow = force && r.market != null && r.market > 0 ? { ...r, usd: r.market } : r;
    const c = buildAddLiquidity(priceRow, amount, ref.oposUsd, undefined, isTreasury ? 0 : 100);
    if (c.oposAmount > bal.opos) {
      const short = Number(formatUnits(c.oposAmount - bal.opos, 18));
      say(`needs ${(Number(formatUnits(c.oposAmount, 18)) / 1e9).toFixed(1)}B OPOS, wallet holds ${(Number(formatUnits(bal.opos, 18)) / 1e9).toFixed(1)}B. Mint ${(short / 1e6 / 1e6).toFixed(2)}M BTB worth, or lower the amount.`);
      return;
    }
    await run(`Add OPOS/${symbol}`, [c.approveToken, c.approveOpos, c.add], `add:${symbol}`);
  }

  const money = (v: bigint, d: number) => Number(formatUnits(v, d)).toLocaleString('en-US', { maximumFractionDigits: d > 6 ? 4 : 2 });
  const seeded = useMemo(() => Object.keys(done).filter((k) => k.startsWith('add:')).length, [done]);
  const input: React.CSSProperties = { height: 34, borderRadius: 10, border: btb.border, background: 'transparent', color: btb.text, padding: '0 10px', fontFamily: 'inherit', fontSize: 13 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 1100, margin: '0 auto' }}>
      <div>
        <div style={{ color: btb.text, fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>OPOS pair seeding</div>
        <div style={{ color: btb.textMuted, fontSize: 12.5, marginTop: 4 }}>
          Any amount of a token against the matching value in OPOS, priced at the median of the existing OPOS pools. LP tokens go to the Safe {LP_RECIPIENT.slice(0, 6)}…{LP_RECIPIENT.slice(-4)}. Every button is one wallet confirmation; a token is priced when you act on it.
        </div>
      </div>

      <Glass padding={14} radius={16} soft>
        {!address ? (
          <div style={{ color: btb.amber, fontSize: 13 }}>Connect the wallet that will seed.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, fontSize: 12.5 }}>
            <Stat label="Wallet" value={`${address.slice(0, 6)}…${address.slice(-4)}`} sub={isTreasury ? 'is the OPOS treasury (tax free)' : 'not the treasury: 1% OPOS tax on deposits, sent on top'} tone={isTreasury ? 'green' : 'amber'}/>
            <Stat label="ETH" value={bal ? money(bal.eth, 18) : '…'} sub="gas and wrapping"/>
            <Stat label="USDC" value={bal ? money(bal.usdc, 6) : '…'} sub={`$${USD_PER_SIDE} per token bought`}/>
            <Stat label="BTB" value={bal ? money(bal.btb, 18) : '…'} sub={ref ? `mints OPOS for ${btbPairsPossible} pairs` : ''}/>
            <Stat label="OPOS" value={bal ? Number(formatUnits(bal.opos, 18)).toExponential(3) : '…'} sub={ref ? `enough for ${oposPairsHeld} pairs` : ''}/>
          </div>
        )}
      </Glass>

      {ref ? (
        <Glass padding={12} radius={14} soft>
          <div style={{ color: btb.textMuted, fontSize: 12, lineHeight: 1.6 }}>
            WETH ${fmt(ref.wethUsd)} · BTB ${ref.btbUsd.toExponential(4)} · peg OPOS {ref.pegOpos.toExponential(4)} · pool median {ref.median.toExponential(4)} (gap {(ref.gap * 100).toFixed(2)}%) · seeding at the median: <b style={{ color: btb.text }}>{Number(formatUnits(ref.oposPerSide, 18)).toExponential(4)} OPOS per pool</b>.
          </div>
        </Glass>
      ) : !err && <div style={{ color: btb.textDim, fontSize: 12 }}>Reading the OPOS reference price…</div>}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ color: btb.textMuted, fontSize: 12.5 }}>Mint OPOS for</span>
        <input type="number" min={1} max={list.length} value={pairsToMint} onChange={(e) => setPairsToMint(Math.max(1, Math.min(list.length, Number(e.target.value) || 1)))} style={{ ...input, width: 64 }}/>
        <span style={{ color: btb.textMuted, fontSize: 12.5 }}>pairs</span>
        <Button variant="success" size="md" onClick={mint} loading={busy === 'mint'} disabled={busy === 'mint' || !ref || !bal}>Mint</Button>
        <span style={{ color: btb.textDim, fontSize: 12 }}>Mint as you go; BTB in the wallet covers {btbPairsPossible} pairs right now.{seeded > 0 ? ` ${seeded} seeded this session.` : ''}</span>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ color: btb.textMuted, fontSize: 12.5 }}>Add a token</span>
        <input placeholder="0x… token address on Ethereum" value={customInput} onChange={(e) => setCustomInput(e.target.value)} style={{ ...input, width: 360, maxWidth: '100%' }}/>
        <Button variant="ghost" size="md" onClick={addCustom} loading={busy === 'custom'} disabled={busy === 'custom' || !customInput}>Add to list</Button>
        <span style={{ color: btb.textDim, fontSize: 12 }}>Kept in this browser. Priced and checked like the others when you act on it.</span>
      </div>
      {err && <div style={{ color: btb.loss, fontSize: 12.5 }}>{err}</div>}

      <div style={{ overflowX: 'auto', border: btb.borderSoft, borderRadius: 14 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>{['Token', 'Existing pool', 'Price', 'Gap', 'Impact', 'Amount in', 'Held', 'Get', 'Add LP', 'Status'].map((h) => <th key={h} style={{ textAlign: 'left', padding: '8px 10px', color: btb.textDim, fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .3, borderBottom: btb.borderSoft, whiteSpace: 'nowrap' }}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {list.map((t) => {
              const r = rows[t.symbol];
              const held = bal?.tokens[t.symbol] ?? 0n;
              const dec = r?.dec ?? decs[t.symbol];
              const haveEnough = !!r && r.amount > 0n && held >= r.amount;
              const rowBusy = busy === `buy:${t.symbol}` || busy === `add:${t.symbol}` || busy === `price:${t.symbol}`;
              const isDone = done[`add:${t.symbol}`] === 'ok';
              const isCustom = custom.some((c) => c.symbol === t.symbol);
              const pair = pairs[t.symbol];
              return (
                <tr key={t.symbol} style={{ opacity: r && !r.ok ? 0.55 : 1 }}>
                  <td style={{ ...td, color: btb.text, fontWeight: 700 }}>
                    {t.symbol}
                    {isCustom && <span onClick={() => removeCustom(t.symbol)} title="Remove from list" style={{ color: btb.textDim, fontWeight: 500, cursor: 'pointer', marginLeft: 6 }}>remove</span>}
                  </td>
                  <td style={td}>
                    {pair === undefined ? <span style={{ color: btb.textDim }}>…</span>
                      : pair === null ? <span style={{ color: btb.textDim }}>none, first LP</span>
                      : (
                        <a href={`https://etherscan.io/address/${pair.address}`} target="_blank" rel="noreferrer" title={pair.address} style={{ color: btb.amber, textDecoration: 'none' }}>
                          exists{ref && pair.opos > 0n ? ` · $${fmt(Number(formatUnits(pair.opos, 18)) * ref.oposUsd * 2, 0)}` : ''}
                        </a>
                      )}
                  </td>
                  <td style={td}>{r ? (r.usd > 0 ? fmt(r.usd, 6) : 'n/a') : <span style={{ color: btb.textDim }}>priced on action</span>}</td>
                  <td style={{ ...td, color: r && r.gap <= 0.013 ? btb.green : btb.amber }}>{r && Number.isFinite(r.gap) ? `${(r.gap * 100).toFixed(2)}%` : ''}</td>
                  <td style={{ ...td, color: r && Math.abs(r.impact) <= 0.005 ? btb.textMuted : btb.amber }}>{r ? `${(r.impact * 100).toFixed(2)}%` : ''}</td>
                  <td style={td}>
                    {dec != null ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <input
                          value={amountIn[t.symbol] ?? (r && r.amount > 0n ? trimAmount(formatUnits(r.amount < held ? r.amount : held, dec)) : '')}
                          onChange={(e) => setAmountIn((m) => ({ ...m, [t.symbol]: e.target.value }))}
                          placeholder="0.0"
                          style={{ ...input, height: 28, width: 110, fontSize: 12 }}
                        />
                        <span onClick={() => setAmountIn((m) => ({ ...m, [t.symbol]: trimAmount(formatUnits(held, dec)) }))} style={{ color: btb.green, fontSize: 10.5, fontWeight: 800, cursor: 'pointer' }}>MAX</span>
                      </span>
                    ) : ''}
                  </td>
                  <td style={{ ...td, color: haveEnough ? btb.green : btb.textMuted }}>
                    {dec != null ? money(held, dec) : '…'}
                    {r && r.usd > 0 && dec != null ? <span style={{ color: btb.textDim }}> (${fmt(Number(formatUnits(held, dec)) * r.usd, 0)})</span> : null}
                  </td>
                  <td style={td}>{t.symbol !== 'USDC' && (t.symbol === 'WETH'
                    ? <Button size="sm" variant="ghost" onClick={() => wrap(t.symbol)} loading={rowBusy} disabled={rowBusy || !ref || haveEnough}>{haveEnough ? 'Held' : 'Wrap ETH'}</Button>
                    : <Button size="sm" variant="ghost" onClick={() => buy(t.symbol)} loading={rowBusy} disabled={rowBusy || !ref || haveEnough}>{haveEnough ? 'Held' : `Buy $${USD_PER_SIDE}`}</Button>)}</td>
                  <td style={td}><Button size="sm" variant={haveEnough ? 'success' : 'ghost'} onClick={() => add(t.symbol)} loading={rowBusy} disabled={rowBusy || isDone}>{isDone ? 'Seeded' : r ? `Add $${fmt(sideUsd(r, amountIn[t.symbol], held), 0)}` : 'Add LP'}</Button></td>
                  <td style={{ ...td, color: rowErr[t.symbol] ? btb.amber : isDone ? btb.green : btb.textDim, fontSize: 11, whiteSpace: 'normal', maxWidth: 300 }}>
                    {rowErr[t.symbol] ?? (isDone ? 'seeded' : r ? (r.ok ? (pair ? 'topping up an existing pool' : 'new pool') : holdReason(r)) : pair ? 'pool exists' : '')}
                    {r && !r.ok && !isDone && (
                      <span onClick={() => add(t.symbol, true)} style={{ color: btb.green, cursor: 'pointer', marginLeft: 6, fontWeight: 700 }}>add anyway at {r.market != null ? 'market' : 'this'} price</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type SeedToken = { symbol: string; address: `0x${string}`; via: 'USDC' | 'WETH' };
const CUSTOM_KEY = 'btb.oposSeed.customTokens';
function loadCustom(): SeedToken[] {
  try { return JSON.parse(localStorage.getItem(CUSTOM_KEY) ?? '[]'); } catch { return []; }
}
function saveCustom(list: SeedToken[]) {
  try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(list)); } catch { /* private mode */ }
}

/** Why a row is held, with the numbers behind it. The three sources are the
 * V3 pool, a live KyberSwap quote, and DefiLlama; they must agree within 1.3%
 * or the pair would be seeded at a price the market disagrees with, which is
 * free money for the first arbitrage bot. */
function holdReason(r: SeedRow): string {
  const parts: string[] = [];
  if (r.v3 != null) parts.push(`pool ${fmt(r.v3, 4)}`);
  if (r.market != null) parts.push(`market ${fmt(r.market, 4)}`);
  if (r.llama != null) parts.push(`Llama ${fmt(r.llama, 4)}`);
  if (Number.isFinite(r.gap) && r.gap > 0.013) return `${parts.join(' · ')} differ by ${(r.gap * 100).toFixed(2)}%, over the 1.3% limit`;
  if (Math.abs(r.impact) > 0.005) return `a $${USD_PER_SIDE} buy moves the price ${(r.impact * 100).toFixed(2)}%, over the 0.5% limit`;
  return r.note || 'price sources disagree';
}

/** Dollar value of the side that will go in: typed amount, else the default. */
function sideUsd(r: SeedRow, typed: string | undefined, held: bigint): number {
  let amount: bigint;
  try { amount = typed && typed.trim() ? parseUnits(typed.trim() as `${number}`, r.dec) : (r.amount < held ? r.amount : held); }
  catch { amount = 0n; }
  if (amount > held) amount = held;
  return Number(formatUnits(amount, r.dec)) * r.usd;
}

/** Full precision is unreadable in an input; keep enough for dust-free maxes. */
function trimAmount(v: string): string {
  const [i, f = ''] = v.split('.');
  return f ? `${i}.${f.slice(0, 8).replace(/0+$/, '')}`.replace(/\.$/, '') : i;
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
