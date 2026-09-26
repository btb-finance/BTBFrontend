'use client';
import { useEffect, useState } from 'react';
import { useConfig } from 'wagmi';
import { getPublicClient } from 'wagmi/actions';
import { formatUnits, parseAbi, type PublicClient } from 'viem';
import { useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { btb } from './design-tokens';
import { useTx } from '../lib/TxTracker';
import { runCalls } from '../lib/txRunner';
import { readableError } from '../lib/errorText';
import { getTokenPricesUsd } from '../lib/defillama';
import { autoSupport, buildEnableCalls, enableWhenVisible, DEFAULT_INTERVAL, autoLabel } from '../lib/autoRebalance';
import { automationYearlyCost } from '../lib/seo/competitors';
import { findSickle, sicklePositions, buildVfatExit, type VfatPosition } from '@/protocols/vfat';

const RATE_ABI = parseAbi(['function rewardRate() view returns (uint256)', 'function pool() view returns (address)', 'function stakedLiquidity() view returns (uint128)']);

type Row = VfatPosition & { valueUsd: number; aprPct: number; saveUsd: number };

/**
 * Positions the user still has on vfat, with what BTB would save them a year and a one-step move: vfat's own exit,
 * then the usual move into the BTB auto wallet, restaked in the same gauge, with auto-rebalance started. On a Safe or
 * any batching wallet that is a single confirmation. Base only, the chain vfat's Sickle addresses were read on.
 */
export function VfatMigrate({ owner, onMoved }: { owner: `0x${string}`; onMoved: () => void | Promise<void> }) {
  const config = useConfig();
  const { track } = useTx();
  const enableNew = useAction(api.autoRebalanceActions.enableNew);
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let live = true;
    (async () => {
      const client = getPublicClient(config, { chainId: 8453 }) as PublicClient | undefined;
      if (!client) return;
      const sickle = await findSickle(client, owner);
      if (!sickle) { if (live) setRows([]); return; }
      const found = await sicklePositions(client, sickle).catch(() => []);
      if (found.length === 0) { if (live) setRows([]); return; }
      const prices = await getTokenPricesUsd([...new Set(found.flatMap((p) => [p.token0, p.token1, p.staked!.rewardToken]))], 'base').catch(() => ({} as Record<string, number>));
      const price = (t: string) => prices[t.toLowerCase()] ?? 0;
      const out: Row[] = [];
      for (const p of found) {
        const valueUsd = parseFloat(formatUnits(p.amount0, p.decimals0)) * price(p.token0) + parseFloat(formatUnits(p.amount1, p.decimals1)) * price(p.token1);
        // What it earns: the gauge's reward rate times this position's share of the staked liquidity (zero out of range).
        let aprPct = 0;
        if (p.inRange && valueUsd > 0) {
          const [rate, pool] = await Promise.all([
            client.readContract({ address: p.vfatGauge, abi: RATE_ABI, functionName: 'rewardRate' }).catch(() => 0n),
            client.readContract({ address: p.vfatGauge, abi: RATE_ABI, functionName: 'pool' }).catch(() => null),
          ]);
          const stakedL = pool ? await client.readContract({ address: pool, abi: RATE_ABI, functionName: 'stakedLiquidity' }).catch(() => 0n) : 0n;
          if (stakedL > 0n) aprPct = ((Number(rate) / 1e18) * 365 * 86_400 * price(p.staked!.rewardToken) * Math.min(Number(p.liquidity) / Number(stakedL), 1) / valueUsd) * 100;
        }
        const earnings = (valueUsd * aprPct) / 100;
        const saveUsd = automationYearlyCost('vfat', valueUsd, earnings) - automationYearlyCost('BTB', valueUsd, earnings, 8453);
        out.push({ ...p, valueUsd, aprPct, saveUsd });
      }
      if (live) setRows(out);
    })().catch(() => { /* vfat detection is a bonus; never block the page */ });
    return () => { live = false; };
  }, [config, owner, nonce]);

  if (rows.length === 0) return null;

  async function move(p: Row) {
    setErr(null); setBusy(`${p.id}`);
    try {
      const client = getPublicClient(config, { chainId: 8453 }) as PublicClient;
      const support = autoSupport(p);
      if (!support) throw new Error('Auto-rebalance does not support this position yet.');
      const { calls } = await buildEnableCalls(client as never, owner, p.id, support);
      await runCalls(config, { account: owner, calls: [buildVfatExit(p), ...calls], label: `Move ${p.symbol0}/${p.symbol1} from vfat to BTB`, track, chainId: 8453 });
      const res = await enableWhenVisible(() => enableNew({
        owner, chainId: 8453, positionManager: support.positionManager, tokenId: p.id.toString(),
        label: autoLabel(p), gauge: support.gauge, intervalMin: DEFAULT_INTERVAL,
      }));
      if (!res.ok) throw new Error(`Moved to BTB, but auto-rebalance did not start: ${res.reason}`);
      setNonce((n) => n + 1);
      await onMoved();
    } catch (e) {
      setErr(readableError(e, 'The move did not go through.'));
    } finally { setBusy(null); }
  }

  const money = (n: number) => `$${n.toLocaleString('en-US', { maximumFractionDigits: n >= 100 ? 0 : 2 })}`;
  const totalSave = rows.reduce((s, r) => s + Math.max(0, r.saveUsd), 0);
  return (
    <div style={{ borderRadius: 16, border: '1px solid rgba(var(--green-rgb), 0.3)', background: 'rgba(var(--green-rgb), 0.06)', padding: '12px 14px' }}>
      <div style={{ color: btb.text, fontSize: 14, fontWeight: 800 }}>
        {rows.length} position{rows.length === 1 ? '' : 's'} still on vfat
      </div>
      <div style={{ color: btb.textMuted, fontSize: 12, marginTop: 2, lineHeight: 1.5 }}>
        {totalSave >= 1
          ? <>Move {rows.length === 1 ? 'it' : 'them'} here and save about <b style={{ color: btb.green }}>{money(totalSave)} a year</b>: a flat fee per rebalance instead of a cut of your position. It stays staked and auto-rebalanced.</>
          : <>Move {rows.length === 1 ? 'it' : 'them'} here in one step, without opening vfat. It stays staked and auto-rebalanced.</>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
        {rows.map((p) => (
          <div key={`${p.positionManager}-${p.id}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 12, background: 'rgba(var(--fg-rgb), 0.04)' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: btb.text, fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.symbol0} / {p.symbol1}</div>
              <div style={{ color: btb.textMuted, fontSize: 11.5, marginTop: 1 }}>
                {money(p.valueUsd)} · {p.inRange ? `${p.aprPct.toFixed(1)}% ${p.staked!.rewardSymbol} APR` : 'out of range'}
                {p.saveUsd >= 1 && <span style={{ color: btb.green }}> · save {money(p.saveUsd)}/yr</span>}
              </div>
            </div>
            <button type="button" onClick={() => move(p)} disabled={!!busy} style={{ flexShrink: 0, height: 32, padding: '0 12px', borderRadius: 10, border: 'none', background: btb.green, color: '#000', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 800, cursor: busy ? 'default' : 'pointer', opacity: busy && busy !== `${p.id}` ? 0.5 : 1 }}>
              {busy === `${p.id}` ? 'Moving…' : 'Move to BTB'}
            </button>
          </div>
        ))}
      </div>
      {err && <div style={{ color: btb.loss, fontSize: 11.5, marginTop: 8 }}>{err}</div>}
    </div>
  );
}
