'use client';
/**
 * A small card that tells a sAERO holder when a position could earn noticeably more in other pools (and is free to move),
 * or when they still hold a veAERO lock from before the Aero launch that needs the upgrade. Shown anywhere in the app
 * except Allocate itself; dismissing it hides that message for a day. Wallets with no sAERO read one balance and stop.
 */
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from 'convex/react';
import { useConfig } from 'wagmi';
import { getPublicClient } from 'wagmi/actions';
import { erc20Abi, type Address, type PublicClient } from 'viem';
import { api } from '../../convex/_generated/api';
import { btb } from './design-tokens';
import { Icon } from './Icon';
import { useSidebar } from '../lib/SidebarContext';
import { AERO, AERO_CHAIN_ID, cooldownLeft, planFor, readPositions, worthMoving, type SaeroPosition } from '../lib/aero/allocator';
import type { AllocatorSnapshot } from '../lib/aero/allocatorSnapshot';

const HIDE_MS = 24 * 3600_000;
const hiddenKey = (address: string, what: string) => `btb:aeroNudge:${address.toLowerCase()}:${what}`;
function isHidden(key: string) {
  try { return Date.now() - Number(localStorage.getItem(key) ?? 0) < HIDE_MS; } catch { return false; }
}

export function AeroNudge({ address, onOpen }: { address?: string; onOpen: () => void }) {
  const config = useConfig();
  const { isMobile } = useSidebar();
  const [positions, setPositions] = useState<SaeroPosition[] | null>(null);
  const [oldLocks, setOldLocks] = useState(0);
  const [, setTick] = useState(0);
  const [nowSec] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    setPositions(null); setOldLocks(0);
    const client = getPublicClient(config, { chainId: AERO_CHAIN_ID }) as PublicClient | undefined;
    if (!address || !client) return;
    let live = true;
    client.readContract({ address: AERO.legacyVe, abi: erc20Abi, functionName: 'balanceOf', args: [address as Address] })
      .then((n) => { if (live) setOldLocks(Number(n)); }).catch(() => {});
    readPositions(client, address as Address)
      .then((list) => { if (live) setPositions(list.filter((p) => p.staked > 0 && p.idleRaw + p.onBaseRaw > 0n)); })
      .catch(() => {});
    return () => { live = false; };
  }, [address, config]);

  // The gauge snapshot is only fetched for wallets that hold sAERO.
  const row = useQuery(api.aeroAllocator.snapshot, positions && positions.length > 0 ? {} : 'skip');
  const snap = useMemo(() => (row ? (JSON.parse(row.json) as AllocatorSnapshot) : null), [row]);

  const better = useMemo(() => {
    if (!snap || !positions) return null;
    let best: { id: string; now: number; could: number } | null = null;
    for (const p of positions) {
      if (cooldownLeft(p.lastAllocatedSec, snap.cooldownSec, nowSec) > 0) continue;
      const plan = planFor(snap.gauges, p, p.power);
      if (worthMoving(plan.current, plan.splitUsd) && (!best || plan.splitUsd - plan.current! > best.could - best.now)) {
        best = { id: p.tokenId.toString(), now: plan.current!, could: plan.splitUsd };
      }
    }
    return best;
  }, [snap, positions, nowSec]);

  if (!address) return null;
  const msg = better && !isHidden(hiddenKey(address, `move:${better.id}`))
    ? { key: hiddenKey(address, `move:${better.id}`), title: 'You can improve your allocation',
        text: `sAERO #${better.id} earns $${better.now.toFixed(2)} a day now. The best split pays about $${better.could.toFixed(2)}.`, cta: 'Improve', go: onOpen }
    : oldLocks > 0 && !isHidden(hiddenKey(address, 'upgrade'))
    ? { key: hiddenKey(address, 'upgrade'), title: 'Upgrade your veAERO',
        text: `You hold ${oldLocks} veAERO lock${oldLocks === 1 ? '' : 's'} from before the Aero launch. Upgrade 1:1 to sAERO to earn again.`, cta: 'Upgrade', go: () => window.open('https://aero.xyz', '_blank', 'noopener') }
    : null;
  if (!msg) return null;

  const hide = () => { try { localStorage.setItem(msg.key, String(Date.now())); } catch { /* shows again next visit */ } setTick((t) => t + 1); };
  return (
    <div style={{
      // Above the agent button, which sits in the bottom right corner.
      position: 'fixed', zIndex: 380, right: isMobile ? 12 : 24, left: isMobile ? 12 : 'auto',
      bottom: isMobile ? 'calc(140px + env(safe-area-inset-bottom, 0px))' : 88, width: isMobile ? 'auto' : 340,
      padding: '12px 14px', borderRadius: 16, background: btb.glassStrong, backdropFilter: btb.blur, WebkitBackdropFilter: btb.blur,
      border: '1px solid rgba(var(--green-rgb), 0.35)', boxShadow: btb.shadow, display: 'flex', gap: 10, alignItems: 'flex-start',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: btb.text, fontSize: 13.5, fontWeight: 800 }}>{msg.title}</div>
        <div style={{ color: btb.textMuted, fontSize: 12, marginTop: 3, lineHeight: 1.45 }}>{msg.text}</div>
        <button type="button" onClick={() => { hide(); msg.go(); }} style={{
          marginTop: 9, height: 32, padding: '0 14px', borderRadius: 10, border: 'none', background: btb.green, color: '#000',
          fontFamily: 'inherit', fontSize: 12.5, fontWeight: 800, cursor: 'pointer',
        }}>{msg.cta}</button>
      </div>
      <button type="button" onClick={hide} aria-label="Dismiss" style={{ flexShrink: 0, padding: 4, border: 'none', background: 'transparent', cursor: 'pointer' }}>
        <Icon name="close" size={13} color={btb.textDim}/>
      </button>
    </div>
  );
}
