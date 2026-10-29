'use client';
/**
 * Allocate: where a sAERO position earns the most on Aero (Base). Every gauge pays its allocators its pool's trading fees
 * plus any incentives; your power joins the power already there, so a quiet pool with little power can beat a busy one.
 * The page ranks every pool for your amount, solves the best split, and allocates a position in one transaction.
 * Gauge data comes from the hourly snapshot (convex/aeroAllocator.ts); positions are read live from the chain.
 */
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { useWalletSession } from '../../lib/session';
import { useAlertCredit } from '../../lib/alerts';
import { TopUpModal, fmtBtb } from '../FastAlerts';
import { useConfig, useConnection } from 'wagmi';
import { getPublicClient } from 'wagmi/actions';
import { erc20Abi, type Address, type PublicClient } from 'viem';
import { api } from '../../../convex/_generated/api';
import { Button } from '../Button';
import { TokenIcon } from '../TokenIcon';
import { Icon } from '../Icon';
import { btb } from '../design-tokens';
import { useSidebar } from '../../lib/SidebarContext';
import { useTokenLogos } from '../../lib/TokenStore';
import { useTx } from '../../lib/TxTracker';
import { getChainClient } from '../../lib/chainClient';
import { ChainLogo } from '../ChainLogo';
import { runCalls } from '../../lib/txRunner';
import {
  AERO, AERO_CHAINS, AERO_CHAIN_ID, REFRESH_BTB, REFRESH_MIN_AGE_MS, allocateAbi, chainName, claimCost, type ClaimCost, allocateCall, allocateErrorText, aprPct, claimCall, claimRewardsAbi, cooldownLeft, planFor,
  readEarned, readPositions, returnAllCall, type Earned, type SaeroPosition,
} from '../../lib/aero/allocator';
import { claimCalls, dropFailingSales, priceRewards, type RewardLine, type SellTarget } from '../../lib/aero/claimSell';
import { ClaimTokenPicker, COMMON_TARGETS } from '../ClaimTokenPicker';
import type { AllocatorSnapshot, SnapGauge } from '../../lib/aero/allocatorSnapshot';

const PAGE = 25;

const usd = (n: number) => (n >= 1000 ? `$${Math.round(n).toLocaleString('en-US')}` : `$${n.toFixed(2)}`);
const num = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e4 ? `${(n / 1e3).toFixed(1)}K` : Math.round(n).toLocaleString('en-US'));
const pct = (n: number | null) => (n == null ? '...' : `${n >= 100 ? Math.round(n) : n.toFixed(1)}%`);
function wait(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function AllocateScreen({ onConnectWallet }: { onConnectWallet?: () => void }) {
  const { isMobile } = useSidebar();
  const config = useConfig();
  const { address } = useConnection();
  const { track } = useTx();
  const logo = useTokenLogos();
  const row = useQuery(api.aeroAllocator.snapshot, {});
  const snap = useMemo(() => {
    if (!row) return null;
    const s = JSON.parse(row.json) as AllocatorSnapshot;
    // Rows from before other chains were read carry no chain: they are Base.
    return { ...s, gauges: s.gauges.map((g) => ({ ...g, chainId: g.chainId ?? AERO_CHAIN_ID })) };
  }, [row]);

  const [positions, setPositions] = useState<SaeroPosition[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [amountStr, setAmountStr] = useState('');
  /** AERO in the wallet (not yet locked), whole tokens; null until read. */
  const [aeroBal, setAeroBal] = useState<number | null>(null);
  /** Aerodrome AERO and veAERO locks from before the launch, which need the upgrade on aero.xyz first. */
  const [legacy, setLegacy] = useState<{ aero: number; locks: number } | null>(null);
  const [query, setQuery] = useState('');
  const [shown, setShown] = useState(PAGE);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => { const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 30_000); return () => clearInterval(t); }, []);

  const client = getPublicClient(config, { chainId: AERO_CHAIN_ID }) as PublicClient | undefined;
  const loadPositions = async () => {
    if (!address || !client) { setPositions(null); setAeroBal(null); return; }
    // The wallet's own AERO: what it could earn once locked, shown when it has no sAERO yet.
    client.multicall({
      allowFailure: true,
      contracts: [AERO.aero, AERO.legacyAero, AERO.legacyVe].map((t) => ({ address: t, abi: erc20Abi, functionName: 'balanceOf', args: [address as Address] }) as const),
    }).then(([now, oldAero, oldLocks]) => {
      const bal = (r: typeof now) => (r.status === 'success' ? Number(r.result) : 0);
      const n = bal(now) / 1e18;
      const old = bal(oldAero) / 1e18;
      setAeroBal(n);
      setLegacy({ aero: old, locks: bal(oldLocks) });
      // Old AERO upgrades 1:1, so it counts toward what the wallet could allocate.
      const total = n + old;
      setAmountStr((s) => (s === '' && total >= 1 ? String(Math.floor(total)) : s));
    }).catch(() => setAeroBal(0));
    try {
      const list = (await readPositions(client, address as Address, (id) => getChainClient(id))).filter((p) => p.staked > 0);
      setPositions(list);
      const first = list[0];
      setSelected((s) => (s && list.some((p) => p.tokenId.toString() === s) ? s : first ? first.tokenId.toString() : null));
    } catch { setPositions([]); }
  };
  useEffect(() => { void loadPositions(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [address, client != null]);

  const position = positions?.find((p) => p.tokenId.toString() === selected) ?? null;
  // A position's split covers what an allocation from here can move: its idle power and its power on Base. Power on another
  // chain stays where it is (moving it between chains is not built yet).
  const baseBudget = position ? Number(position.idleRaw + position.onBaseRaw) / 1e18 : 0;
  const elsewhereNote = position?.elsewhere.map((e) => `${num(Number(e.amountRaw) / 1e18)} on ${chainName(e.chainId)}`).join(', ') ?? '';
  const amount = position ? baseBudget : Math.max(0, parseFloat(amountStr.replace(/,/g, '')) || 0);
  const plan = useMemo(() => (snap ? planFor(snap.gauges, position, amount) : null), [snap, position, amount]);
  const ranked = plan?.ranked ?? [];
  const split = plan?.split ?? [];
  const splitUsd = plan?.splitUsd ?? 0;
  const currentUsd = plan?.current ?? null;
  const currentBaseUsd = plan?.currentMovable ?? null;
  const byGauge = useMemo(() => new Map(snap?.gauges.map((g) => [`${g.chainId}:${g.gauge.toLowerCase()}`, g]) ?? []), [snap]);
  const bestSingle = ranked[0]?.earn ?? 0;

  // Rewards the selected position has earned and not claimed, across every gauge (ones it left too).
  // Read on every Aero chain: rewards stay on the chain they were earned on, also after the position moves away.
  const [earned, setEarned] = useState<{ id: string; earned: Earned[]; lines: RewardLine[]; costs: ClaimCost[] } | null>(null);
  const loadEarned = async () => {
    if (!position || !client || !snap || !address) { setEarned(null); return; }
    const id = position.tokenId.toString();
    const parts = await Promise.all(AERO_CHAINS.map(async (ch) => {
      const c = ch.id === AERO_CHAIN_ID ? client : getChainClient(ch.id);
      const gauges = snap.gauges.filter((g) => g.chainId === ch.id);
      if (!c || gauges.length === 0) return null;
      try {
        const e = await readEarned(c, position.tokenId, gauges, ch.id);
        if (e.byToken.size === 0) return null;
        // What sending this chain's part of the claim costs, shown before the user taps.
        const cost = await claimCost(client, c, position.tokenId, e, address as Address).catch(() => null);
        return { e, lines: await priceRewards(c, e), cost };
      } catch { return null; }
    }));
    const got = parts.filter((x): x is NonNullable<typeof x> => !!x);
    setEarned({ id, earned: got.map((x) => x.e), lines: got.flatMap((x) => x.lines), costs: got.flatMap((x) => (x.cost ? [x.cost] : [])) });
  };
  useEffect(() => { void loadEarned(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [selected, snap != null, client != null]);
  const rewards = earned && earned.id === selected ? earned : null;
  const rewardsUsd = rewards?.lines.reduce((s, l) => s + (l.usd ?? 0), 0) ?? 0;

  // The token "claim as" sells into; USDC until the user picks another (remembered on this device).
  const [target, setTarget] = useState<SellTarget>(() => {
    try { const t = JSON.parse(localStorage.getItem('btb:aeroClaimTarget') ?? 'null') as SellTarget | null; if (t?.address) return t; } catch { /* default */ }
    return COMMON_TARGETS[0];
  });
  const [picking, setPicking] = useState(false);

  // Data age, and the paid refresh: anyone can pay to rebuild it now instead of waiting for the hourly run.
  const status = useQuery(api.aeroAllocator.status, {});
  const payRefresh = useMutation(api.aeroAllocator.payRefresh);
  const session = useWalletSession(address);
  const [refreshMsg, setRefreshMsg] = useState<string | null>(null);
  // Short of BTB: the same top up as Home, opened right here, then the refresh can be paid.
  const [showTopUp, setShowTopUp] = useState(false);
  const credit = useAlertCredit(address, { withTreasury: showTopUp });
  const short = credit.total < REFRESH_BTB;
  const ageMin = status?.updatedAt ? Math.max(0, Math.floor((now * 1000 - status.updatedAt) / 60_000)) : null;
  const canPay = !!status?.updatedAt && now * 1000 - status.updatedAt >= REFRESH_MIN_AGE_MS && !status.refreshing;
  async function refreshNow() {
    setRefreshMsg(null);
    if (short) { setShowTopUp(true); return; }
    setBusy('refresh');
    try {
      const token = await session.ensure();
      const r = await payRefresh({ sessionToken: token });
      if (!r.ok) {
        if (r.reason.includes('sign-in')) session.forget();
        if (r.reason.startsWith('Not enough')) setShowTopUp(true); else setRefreshMsg(r.reason);
      }
      else setRefreshMsg('Paid. Fresh data in about a minute.');
    } catch (e) {
      setRefreshMsg((e as Error).message.split('\n')[0]);
    } finally {
      setBusy(null);
    }
  }
  const pickTarget = (t: SellTarget) => {
    setTarget(t); setPicking(false);
    try { localStorage.setItem('btb:aeroClaimTarget', JSON.stringify(t)); } catch { /* this visit only */ }
  };

  async function claim(sell: boolean) {
    if (!position || !address || !rewards) return;
    const claimable = rewards.earned.filter((e) => e.chainId === AERO_CHAIN_ID || rewards.costs.some((c) => c.chainId === e.chainId));
    setMsg(null);
    setBusy(sell ? 'sell' : 'claim');
    try {
      try {
        // A chain whose cost could not be read is left out rather than sent without enough gas.
        const c = claimCall(position.tokenId, claimable, address as Address, rewards.costs);
        await client!.simulateContract({ address: AERO.voter, abi: claimRewardsAbi, functionName: 'claimRewards', args: c.args, account: address as Address, value: c.value });
      } catch { throw new Error('The claim would fail. Refresh and try again.'); }
      const built = await claimCalls(position.tokenId, claimable, rewards.costs, rewards.lines, address as Address, sell ? target : null);
      // A sale that would fail is left out (its token kept) so it cannot undo the claim in an all-or-nothing batch.
      const { calls, sold, kept } = sell ? await dropFailingSales(client!, address as Address, built) : built;
      await runCalls(config, {
        account: address as `0x${string}`,
        calls,
        label: sell ? `Claim and sell sAERO #${position.tokenId} rewards` : `Claim sAERO #${position.tokenId} rewards`,
        track,
        chainId: AERO_CHAIN_ID,
      });
      const done = sell
        ? `Claimed${sold.length ? ` and sold ${sold.join(', ')} for ${target.symbol}` : ''}.${kept.length ? ` Kept ${kept.join(', ')} (too small to sell or no route).` : ''}`
        : 'Rewards claimed to your wallet.';
      const away = [...new Set(claimable.filter((e) => e.chainId !== AERO_CHAIN_ID).map((e) => chainName(e.chainId)))];
      setMsg({ ok: true, text: `${done}${away.length ? ` Rewards on ${away.join(', ')} arrive there in a few minutes.` : ''}` });
      await loadEarned();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message.split('\n')[0] });
    } finally {
      setBusy(null);
    }
  }

  const [chainFilter, setChainFilter] = useState<number | null>(null);
  const chainsShown = useMemo(() => AERO_CHAINS.filter((c) => ranked.some((r) => r.g.chainId === c.id)), [ranked]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ranked.filter((r) => (chainFilter == null || r.g.chainId === chainFilter)
      && (!q || `${r.g.symbol0}/${r.g.symbol1} ${r.g.symbol1}/${r.g.symbol0}`.toLowerCase().includes(q)));
  }, [ranked, query, chainFilter]);

  const cooldown = snap && position ? cooldownLeft(position.lastAllocatedSec, snap.cooldownSec, now) : 0;
  const canAllocate = !!position && !!address && cooldown === 0 && split.length > 0 && position.idleRaw + position.onBaseRaw > 0n;

  async function send(kind: 'allocate' | 'return') {
    if (!position || !address || !client) return;
    setMsg(null);
    setBusy(kind);
    try {
      const call = kind === 'allocate'
        ? allocateCall(position, split.map((p) => ({ gauge: p.gauge, pct: p.pct })), address as Address)
        : returnAllCall(position, address as Address);
      // Simulate first, so a refusal reads as a reason instead of a failed transaction.
      try {
        await client.simulateContract({ address: AERO.voter, abi: allocateAbi, functionName: 'allocate', args: call.args, account: address as Address });
      } catch (e) {
        throw new Error(allocateErrorText(e) ?? 'The allocation would fail. Refresh and try again.');
      }
      await runCalls(config, {
        account: address as `0x${string}`,
        calls: [{ to: call.to, data: call.data, value: 0n, label: kind === 'allocate' ? 'Allocate sAERO' : 'Return sAERO to idle' }],
        label: kind === 'allocate' ? `Allocate sAERO #${position.tokenId}` : `Return sAERO #${position.tokenId} to idle`,
        track,
        chainId: AERO_CHAIN_ID,
      });
      setMsg({ ok: true, text: kind === 'allocate' ? 'Allocated. Your sAERO now earns from these pools.' : 'Returned to idle.' });
      await loadPositions();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message.split('\n')[0] });
    } finally {
      setBusy(null);
    }
  }

  const pair = (g: SnapGauge, size = 26) => (
    <span style={{ position: 'relative', display: 'inline-flex', flexShrink: 0, paddingRight: 3 }}>
      <TokenIcon symbol={g.symbol0} size={size} logoUrl={logo(g.token0, g.chainId, g.symbol0)}/>
      <span style={{ marginLeft: -size * 0.35 }}><TokenIcon symbol={g.symbol1} size={size} logoUrl={logo(g.token1, g.chainId, g.symbol1)}/></span>
      {/* Which Aero chain the pool is on */}
      <span style={{ position: 'absolute', right: -2, bottom: -3, borderRadius: '50%', padding: 1.5, background: btb.bg, display: 'inline-flex' }}><ChainLogo chainId={g.chainId} size={Math.round(size * 0.45)}/></span>
    </span>
  );
  const kindChip = (g: SnapGauge) => (
    <span style={{ color: btb.textMuted, fontSize: 10.5, fontWeight: 700, padding: '1px 6px', borderRadius: 6, background: 'rgba(var(--fg-rgb), 0.06)', whiteSpace: 'nowrap' }}>
      {g.kind.startsWith('CL') ? `CL${g.feePct != null ? ` ${+g.feePct.toFixed(3)}%` : ''}` : g.kind || 'pool'}
    </span>
  );
  const card = { borderRadius: 18, padding: isMobile ? 14 : 18, border: btb.borderSoft, background: 'rgba(var(--fg-rgb), 0.04)' } as const;
  const label = { color: btb.textDim, fontSize: 11, fontWeight: 700 } as const;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 1000, margin: '0 auto', width: '100%' }}>
      {/* How old the data is, and the paid refresh */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', padding: '0 4px' }}>
        <span style={{ color: btb.textDim, fontSize: 12 }}>
          {status?.refreshing ? 'Refreshing pool data now...'
            : status?.updatedAt ? `Pool data from ${new Date(status.updatedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}, ${ageMin! < 1 ? 'just now' : `${ageMin} min ago`}. Updates every hour.`
            : 'Pool data updates every hour.'}
        </span>
        {address && canPay && (
          <button type="button" onClick={refreshNow} disabled={busy != null} title="Rebuild every pool's numbers now, paid from your BTB balance in the app" style={{
            height: 30, padding: '0 12px', borderRadius: 10, border: '1px solid rgba(var(--green-rgb), 0.35)', background: 'rgba(var(--green-rgb), 0.08)',
            color: btb.green, fontFamily: 'inherit', fontSize: 12, fontWeight: 800, cursor: 'pointer',
          }}>{busy === 'refresh' ? 'Paying...' : `Refresh now for ${REFRESH_BTB.toLocaleString('en-US')} BTB`}</button>
        )}
      </div>
      {showTopUp && (
        <>
          <div style={{ color: btb.textMuted, fontSize: 12, padding: '0 4px', marginTop: -8 }}>
            A refresh costs {REFRESH_BTB.toLocaleString('en-US')} BTB; your app balance is {fmtBtb(credit.total)} BTB. Top up, then refresh.
          </div>
          <TopUpModal credit={credit} onClose={() => setShowTopUp(false)}/>
        </>
      )}
      {refreshMsg && <div style={{ color: refreshMsg.startsWith('Paid') ? btb.green : btb.loss, fontSize: 12, padding: '0 4px', marginTop: -8 }}>{refreshMsg}</div>}

      {/* Your positions, or an amount to try */}
      <div style={card}>
        {!address ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={label}>AERO amount</div>
              <input value={amountStr} inputMode="decimal" placeholder="Enter an amount" onChange={(e) => setAmountStr(e.target.value)}
                style={{ marginTop: 6, width: '100%', boxSizing: 'border-box', height: 42, padding: '0 12px', borderRadius: 12, border: btb.border, background: 'transparent', color: btb.text, fontSize: 16, fontWeight: 800, fontFamily: 'inherit', outline: 'none' }}/>
            </div>
            <Button variant="success" size="md" fullWidth={false} onClick={onConnectWallet} style={{ alignSelf: 'flex-end' }}>Connect to allocate</Button>
          </div>
        ) : positions == null ? (
          <div style={{ color: btb.textDim, fontSize: 12.5 }}>Reading your sAERO positions...</div>
        ) : positions.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ color: btb.textMuted, fontSize: 12.5, lineHeight: 1.5 }}>
              {aeroBal == null ? 'Reading your AERO...'
                : aeroBal >= 1 ? <>You hold <b style={{ color: btb.text }}>{num(aeroBal)} AERO</b> on Base. Lock it as sAERO on aero.xyz to allocate it; below is where it would earn most.</>
                : (legacy?.aero ?? 0) >= 1 || (legacy?.locks ?? 0) > 0 ? null
                : 'This wallet has no AERO or sAERO on Base. Enter an amount to see where it would earn most.'}
              {legacy && ((legacy.aero >= 1) || legacy.locks > 0) && (
                <div style={{ color: btb.amber, marginTop: aeroBal != null && aeroBal >= 1 ? 6 : 0 }}>
                  You also hold{legacy.aero >= 1 ? <> <b>{num(legacy.aero)} old AERO</b></> : ''}{legacy.aero >= 1 && legacy.locks > 0 ? ' and' : ''}{legacy.locks > 0 ? <> <b>{legacy.locks} old veAERO lock{legacy.locks === 1 ? '' : 's'}</b></> : ''} from before the Aero launch. Upgrade 1:1 on aero.xyz to get sAERO you can allocate.
                </div>
              )}
            </div>
            <input value={amountStr} inputMode="decimal" placeholder="Enter an amount" onChange={(e) => setAmountStr(e.target.value)}
              style={{ width: '100%', maxWidth: 260, boxSizing: 'border-box', height: 42, padding: '0 12px', borderRadius: 12, border: btb.border, background: 'transparent', color: btb.text, fontSize: 16, fontWeight: 800, fontFamily: 'inherit', outline: 'none' }}/>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={label}>Your sAERO</div>
            {positions.map((p) => {
              const on = p.tokenId.toString() === selected;
              const left = snap ? cooldownLeft(p.lastAllocatedSec, snap.cooldownSec, now) : 0;
              // Where its power sits: Base and each other chain, as a share of the whole.
              const where = [{ id: AERO_CHAIN_ID, raw: p.onBaseRaw }, ...p.elsewhere.map((e) => ({ id: e.chainId, raw: e.amountRaw }))]
                .filter((x) => x.raw > 0n)
                .map((x) => `${chainName(x.id)} ${Math.min(100, Math.round((Number(x.raw) / 1e18 / Math.max(p.power, 1)) * 100))}%`);
              return (
                <button key={p.tokenId.toString()} type="button" onClick={() => { setSelected(p.tokenId.toString()); setMsg(null); }} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                  background: on ? 'rgba(var(--green-rgb), 0.1)' : 'transparent', border: `1px solid ${on ? 'rgba(var(--green-rgb), 0.45)' : 'rgba(var(--fg-rgb), 0.1)'}`,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: btb.text, fontSize: 14, fontWeight: 800 }}>#{p.tokenId.toString()} <span style={{ color: btb.textMuted, fontWeight: 700 }}>{num(p.power)} power</span></div>
                    <div style={{ color: btb.textDim, fontSize: 11.5, marginTop: 2 }}>
                      {p.isPermanent ? 'Permanent lock' : `Unlocks ${new Date(p.endSec * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                      {' · '}{where.length ? where.join(', ') : 'Idle'}
                    </div>
                  </div>
                  <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 8, color: left === 0 ? btb.green : btb.amber, background: left === 0 ? 'rgba(var(--green-rgb), 0.12)' : 'rgba(var(--amber-rgb), 0.12)' }}>
                    {left === 0 ? 'Can change' : `In ${wait(left)}`}
                  </span>
                </button>
              );
            })}
            {position && position.idleRaw + position.onBaseRaw === 0n && (
              <div style={{ color: btb.textMuted, fontSize: 11.5, lineHeight: 1.5 }}>
                #{position.tokenId.toString()} has its power on another Aero chain. This page allocates on Base; move it back on aero.xyz first.
              </div>
            )}
            {position && rewards && rewards.lines.length > 0 && (
              <div style={{ marginTop: 4, padding: '10px 12px', borderRadius: 14, background: 'rgba(var(--green-rgb), 0.06)', border: '1px solid rgba(var(--green-rgb), 0.22)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                  <span style={label}>Rewards to claim</span>
                  <span style={{ color: btb.green, fontSize: 16, fontWeight: 800 }}>{usd(rewardsUsd)}</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {rewards.lines.slice(0, 6).map((l) => (
                    <span key={`${l.chainId}:${l.token}`} title={chainName(l.chainId)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px 3px 4px', borderRadius: 999, background: 'rgba(var(--fg-rgb), 0.06)', fontSize: 11.5, color: btb.textMuted, fontWeight: 700 }}>
                      <TokenIcon symbol={l.symbol} size={16} logoUrl={logo(l.token, l.chainId, l.symbol)}/>
                      {l.chainId !== AERO_CHAIN_ID && <ChainLogo chainId={l.chainId} size={12}/>}
                      {l.amount < 0.01 ? '<0.01' : l.amount.toLocaleString('en-US', { maximumFractionDigits: l.amount >= 100 ? 0 : 3 })} {l.symbol}
                    </span>
                  ))}
                  {rewards.lines.length > 6 && <span style={{ color: btb.textDim, fontSize: 11.5, alignSelf: 'center' }}>+{rewards.lines.length - 6} more</span>}
                </div>
                {rewards.costs.some((c) => c.chainId !== AERO_CHAIN_ID) && (
                  <div style={{ color: btb.textDim, fontSize: 11.5, lineHeight: 1.45 }}>
                    One claim covers every chain. {[...new Set(rewards.costs.filter((c) => c.chainId !== AERO_CHAIN_ID).map((c) => chainName(c.chainId)))].join(', ')} rewards arrive there a few minutes later
                    (about {(Number(rewards.costs.reduce((x, c) => x + c.value, 0n)) / 1e18).toFixed(5)} ETH to send) and stay as they are; Claim as only sells Base rewards.
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 8 }}>
                  <Button variant="ghost" size="sm" disabled={busy != null} loading={busy === 'claim'} onClick={() => claim(false)}>Claim</Button>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <Button variant="success" size="sm" disabled={busy != null} loading={busy === 'sell'} onClick={() => claim(true)} style={{ flex: 1, borderRadius: '12px 4px 4px 12px' }}>Claim as {target.symbol}</Button>
                    <button type="button" onClick={() => setPicking(true)} disabled={busy != null} aria-label="Choose the token to receive" title="Choose the token to receive" style={{
                      flexShrink: 0, width: 40, borderRadius: '4px 12px 12px 4px', border: 'none', cursor: 'pointer', background: 'rgba(var(--green-rgb), 0.18)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}><Icon name="down" size={14} color={btb.green}/></button>
                  </div>
                </div>
                {picking && <ClaimTokenPicker selected={target.address} onPick={pickTarget} onClose={() => setPicking(false)}/>}
              </div>
            )}
            {position?.operator && (
              <div style={{ color: btb.amber, fontSize: 11.5, lineHeight: 1.5 }}>
                #{position.tokenId.toString()} has a manager ({position.operator.slice(0, 6)}...{position.operator.slice(-4)}), such as an Aero Autopilot, that can change its pools.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Best split */}
      <div style={{ ...card, border: '1px solid rgba(var(--green-rgb), 0.3)', background: 'radial-gradient(110% 140% at 100% 0%, rgba(var(--green-rgb), 0.12), transparent 60%), rgba(var(--fg-rgb), 0.03)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={label}>{amount > 0 ? `Best split on Base for ${num(amount)} ${position ? 'sAERO' : 'AERO'}` : 'Best split'}</div>
            {amount > 0 && <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
              <span style={{ color: btb.green, fontSize: 26, fontWeight: 800, letterSpacing: -0.6 }}>{snap ? `${usd(splitUsd)}` : '...'}</span>
              <span style={{ color: btb.textMuted, fontSize: 13, fontWeight: 700 }}>a day</span>
              {snap && <span style={{ color: btb.green, fontSize: 12, fontWeight: 800, padding: '2px 8px', borderRadius: 8, background: 'rgba(var(--green-rgb), 0.12)' }}>{pct(aprPct(splitUsd, amount, snap.aeroUsd))} APR</span>}
            </div>}
            {snap && split.length > 1 && bestSingle > 0 && (
              <div style={{ color: btb.textDim, fontSize: 11.5, marginTop: 3 }}>{usd(bestSingle)} a day in the single best pool</div>
            )}
            {currentBaseUsd != null && position && position.current.length > 0 && (
              <div style={{ color: btb.textMuted, fontSize: 12, marginTop: 3 }}>
                Base part earns {usd(currentBaseUsd)} a day now{splitUsd > currentBaseUsd ? <>, <b style={{ color: btb.green }}>+{usd(splitUsd - currentBaseUsd)}</b> with this split</> : ', already near the best'}
                {currentUsd != null && currentUsd > currentBaseUsd + 0.005 && <> · {usd(currentUsd)} a day on all chains</>}
              </div>
            )}
            {elsewhereNote && (
              <div style={{ color: btb.textDim, fontSize: 11.5, marginTop: 3 }}>{elsewhereNote} stays where it is; moving power between chains is coming next.</div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
          {snap && !(amount > 0) && <div style={{ color: btb.textDim, fontSize: 12.5 }}>Enter an amount to see the best split.</div>}
          {!snap && <div style={{ color: btb.textDim, fontSize: 12.5 }}>{row === null ? 'Pool data is being prepared. Check back in a few minutes.' : 'Loading pools...'}</div>}
          {split.map((p) => {
            const g = byGauge.get(`${AERO_CHAIN_ID}:${p.gauge.toLowerCase()}`);
            if (!g) return null;
            return (
              <div key={p.gauge} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {pair(g, 24)}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: btb.text, fontSize: 13, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.symbol0}/{g.symbol1}</span>
                  {kindChip(g)}
                </div>
                <span style={{ color: btb.text, fontSize: 13, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{p.pct.toFixed(p.pct >= 10 ? 0 : 1)}%</span>
                <span style={{ color: btb.green, fontSize: 12.5, fontWeight: 700, width: 72, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{usd(p.usdPerDay)}</span>
              </div>
            );
          })}
        </div>

        {position && (
          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            <Button variant="success" size="md" fullWidth={isMobile} disabled={!canAllocate || busy != null} loading={busy === 'allocate'} onClick={() => send('allocate')} style={{ flex: isMobile ? undefined : '0 0 auto' }}>
              {cooldown > 0 ? `Can change in ${wait(cooldown)}` : `Allocate #${position.tokenId.toString()}`}
            </Button>
            {position.onBaseRaw > 0n && cooldown === 0 && (
              <Button variant="ghost" size="md" fullWidth={isMobile} disabled={busy != null} loading={busy === 'return'} onClick={() => send('return')}>Return to idle</Button>
            )}
          </div>
        )}
        {msg && <div style={{ color: msg.ok ? btb.green : btb.loss, fontSize: 12.5, marginTop: 10 }}>{msg.text}</div>}
        {snap && (
          <div style={{ color: btb.textDim, fontSize: 11, marginTop: 10, lineHeight: 1.5 }}>
            Estimates from the last two days of fee releases plus incentives streaming now. After allocating, a position can change again in {Math.round(snap.cooldownSec / 3600)} hours.
          </div>
        )}
      </div>

      {/* Every pool, best for your amount first */}
      {snap && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '0 4px' }}>
            <span style={{ color: btb.text, fontSize: 17, fontWeight: 800 }}>All pools</span>
            <input value={query} onChange={(e) => { setQuery(e.target.value); setShown(PAGE); }} placeholder="Search a token"
              style={{ width: isMobile ? 150 : 220, height: 34, padding: '0 12px', borderRadius: 10, border: btb.borderSoft, background: 'rgba(var(--fg-rgb), 0.04)', color: btb.text, fontSize: 16, fontFamily: 'inherit', outline: 'none' }}/>
          </div>
          {chainsShown.length > 1 && (
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', padding: '0 4px' }}>
              {[null, ...chainsShown.map((c) => c.id)].map((id) => {
                const on = chainFilter === id;
                return (
                  <button key={id ?? 'all'} type="button" onClick={() => { setChainFilter(id); setShown(PAGE); }} style={{
                    flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
                    fontSize: 12.5, fontWeight: 800, color: on ? btb.text : btb.textMuted,
                    background: on ? 'rgba(var(--green-rgb), 0.14)' : 'rgba(var(--fg-rgb), 0.05)', border: `1px solid ${on ? 'rgba(var(--green-rgb), 0.45)' : 'rgba(var(--fg-rgb), 0.1)'}`,
                  }}>
                    {id != null && <ChainLogo chainId={id} size={14}/>}
                    {id == null ? 'All chains' : chainName(id)}
                  </button>
                );
              })}
            </div>
          )}
          {!isMobile && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px 80px 100px 100px 90px', gap: 10, padding: '0 14px', ...label }}>
              <span>Pool</span><span style={{ textAlign: 'right' }}>You earn a day</span><span style={{ textAlign: 'right' }}>APR</span>
              <span style={{ textAlign: 'right' }}>Fees a day</span><span style={{ textAlign: 'right' }}>Incentives</span><span style={{ textAlign: 'right' }}>Power in</span>
            </div>
          )}
          {filtered.slice(0, shown).map(({ g, weight, earn }) => {
            const apr = aprPct(earn, amount, snap.aeroUsd);
            const thin = g.feeHours < 12;
            return isMobile ? (
              <div key={`${g.chainId}:${g.gauge}`} style={{ ...card, padding: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                {pair(g)}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: btb.text, fontSize: 13.5, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.symbol0}/{g.symbol1}</span>
                    {kindChip(g)}
                  </div>
                  <div style={{ color: btb.textDim, fontSize: 11.5, marginTop: 2 }}>
                    Fees {usd(g.feesPerDay ?? 0)}{g.incentivesPerDay > 0 ? ` + ${usd(g.incentivesPerDay)} incentives` : ''} a day{thin ? ', new' : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ color: btb.green, fontSize: 14, fontWeight: 800 }}>{usd(earn)}</div>
                  <div style={{ color: btb.textMuted, fontSize: 11.5, fontWeight: 700 }}>{pct(apr)}</div>
                </div>
              </div>
            ) : (
              <div key={`${g.chainId}:${g.gauge}`} style={{ display: 'grid', gridTemplateColumns: '1fr 110px 80px 100px 100px 90px', gap: 10, alignItems: 'center', padding: '10px 14px', borderRadius: 14, border: btb.borderSoft, background: 'rgba(var(--fg-rgb), 0.03)', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  {pair(g)}
                  <span style={{ color: btb.text, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.symbol0}/{g.symbol1}</span>
                  {kindChip(g)}
                  {thin && <span title="Less than 12 hours of fee history" style={{ color: btb.amber, fontSize: 10.5, fontWeight: 800 }}>new</span>}
                </div>
                <span style={{ textAlign: 'right', color: btb.green, fontWeight: 800 }}>{usd(earn)}</span>
                <span style={{ textAlign: 'right', color: btb.text, fontWeight: 700 }}>{pct(apr)}</span>
                <span style={{ textAlign: 'right', color: btb.textMuted }}>{usd(g.feesPerDay ?? 0)}</span>
                <span style={{ textAlign: 'right', color: g.incentivesPerDay > 0 ? btb.text : btb.textDim }}>{g.incentivesPerDay > 0 ? usd(g.incentivesPerDay) : 'none'}</span>
                <span style={{ textAlign: 'right', color: btb.textMuted }}>{num(weight)}</span>
              </div>
            );
          })}
          {filtered.length > shown && (
            <Button variant="ghost" size="sm" onClick={() => setShown((n) => n + PAGE)}>Show more ({filtered.length - shown} left)</Button>
          )}
          {filtered.length === 0 && <div style={{ color: btb.textDim, fontSize: 12.5, padding: '0 4px' }}>No pool matches.</div>}
        </div>
      )}
    </div>
  );
}
