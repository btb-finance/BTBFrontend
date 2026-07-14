'use client';

import { useMemo, useState } from 'react';
import { useConfig } from 'wagmi';
import { encodeFunctionData } from 'viem';
import { Portal } from './Portal';
import { Button } from './Button';
import { AutomationRules, type AutomationRuleValues } from './AutomationRules';
import { btb } from './design-tokens';
import { useSidebar } from '../lib/SidebarContext';
import { useTx } from '../lib/TxTracker';
import { runCalls } from '../lib/txRunner';
import { BTB_LP_ACCOUNT_ABI, type RebalancePolicy, type SmartAccountDeployment } from '../lib/smartAccount';
import { rangeTicks, ROBINHOOD_UNISWAP_V3_DEPLOYMENT, type LiquidityPosition } from '@/protocols/dexs/uniswap';

const TARGETS = [1, 5, 10, 25, 50] as const;
function nearest<T extends number>(value: number, choices: readonly T[]): T {
  return choices.reduce((best, next) => Math.abs(next - value) < Math.abs(best - value) ? next : best);
}

export function ManagedPolicySheet({ pos, account, owner, policy, deployment, onClose, onDone }: {
  pos: LiquidityPosition;
  account: `0x${string}`;
  owner: `0x${string}`;
  policy: RebalancePolicy;
  deployment: SmartAccountDeployment;
  onClose: () => void;
  onDone: () => void | Promise<void>;
}) {
  const config = useConfig();
  const { track } = useTx();
  const { width: sidebarWidth } = useSidebar();
  const spacing = ROBINHOOD_UNISWAP_V3_DEPLOYMENT.tickSpacings[pos.fee] ?? 60;
  const initial = useMemo((): AutomationRuleValues => {
    const targetRangePct = TARGETS.reduce((best, pct) => {
      const r = rangeTicks(pos.currentTick, spacing, pct);
      const bestR = rangeTicks(pos.currentTick, spacing, best);
      return Math.abs((r.tickUpper - r.tickLower) - policy.targetTickWidth) < Math.abs((bestR.tickUpper - bestR.tickLower) - policy.targetTickWidth) ? pct : best;
    }, 10 as typeof TARGETS[number]);
    const remainingDays = Math.max(1, Math.ceil((Number(policy.expiresAt) - Date.now() / 1000) / 86_400));
    return {
      targetRangePct,
      allowedRangePct: 25,
      maxSwapPct: nearest(policy.maxSwapBpsOfPosition / 100, [10, 25, 50, 100] as const),
      maxDeviationPct: nearest(policy.maxSpotTwapDeviationBps / 100, [1, 3, 5, 10] as const),
      twapSeconds: nearest(policy.twapSeconds, [60, 300, 900, 1800] as const),
      intervalSeconds: nearest(policy.minRebalanceInterval, [900, 3600, 21600, 86400] as const),
      expiryDays: nearest(remainingDays, [7, 30, 90, 365] as const),
    };
  }, [policy, pos.currentTick, spacing]);
  const [rules, setRules] = useState(initial);
  const [slippageBps, setSlippageBps] = useState(policy.maxSlippageBps);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setBusy(true); setErr(null);
    try {
      const allowedPct = rules.allowedRangePct !== null && rules.allowedRangePct < rules.targetRangePct ? rules.targetRangePct : rules.allowedRangePct;
      const allowed = rangeTicks(pos.currentTick, spacing, allowedPct);
      const target = rangeTicks(pos.currentTick, spacing, rules.targetRangePct);
      const next: RebalancePolicy = {
        ...policy,
        enabled: true,
        agent: deployment.agent,
        targetTickWidth: target.tickUpper - target.tickLower,
        performanceFeeBps: 1_000,
        maxSlippageBps: slippageBps,
        maxSwapBpsOfPosition: rules.maxSwapPct * 100,
        maxSpotTwapDeviationBps: rules.maxDeviationPct * 100,
        twapSeconds: rules.twapSeconds,
        minRebalanceInterval: rules.intervalSeconds,
        expiresAt: BigInt(Math.floor(Date.now() / 1000) + rules.expiryDays * 86_400),
        minimumAllowedTick: Math.min(allowed.tickLower, pos.tickLower),
        maximumAllowedTick: Math.max(allowed.tickUpper, pos.tickUpper),
      };
      await runCalls(config, {
        account: owner, chainId: 4663, label: `Update ${pos.symbol0}/${pos.symbol1} rules`, track,
        calls: [{ to: account, data: encodeFunctionData({ abi: BTB_LP_ACCOUNT_ABI, functionName: 'configurePolicy', args: [next] }) }],
      });
      await onDone();
      onClose();
    } catch (e) { setErr((e as { shortMessage?: string })?.shortMessage ?? (e as Error)?.message ?? 'Could not update rules'); }
    finally { setBusy(false); }
  }

  return <Portal>
    <div onMouseDown={onClose} style={{ position: 'fixed', inset: 0, left: sidebarWidth, zIndex: 395, background: 'rgba(5,5,9,.78)', backdropFilter: 'blur(10px)', display: 'flex', justifyContent: 'flex-end' }}>
      <div onMouseDown={(e) => e.stopPropagation()} style={{ width: 'min(100%, 480px)', height: '100%', overflowY: 'auto', background: btb.bg, borderLeft: btb.borderSoft, padding: '22px 18px 80px', boxSizing: 'border-box' }}>
        <div style={{ color: btb.text, fontSize: 19, fontWeight: 850 }}>Change LP rules</div>
        <div style={{ color: btb.textMuted, fontSize: 12, margin: '4px 0 14px' }}>{pos.symbol0} / {pos.symbol1} · owner approval replaces the old rules</div>
        <AutomationRules value={rules} onChange={setRules} agent={deployment.agent} slippageBps={slippageBps} onSlippageChange={setSlippageBps} disabled={busy}/>
        {err && <div style={{ color: btb.loss, fontSize: 12, marginTop: 10 }}>{err}</div>}
        <Button variant="success" size="md" onClick={save} disabled={busy} style={{ width: '100%', marginTop: 14 }}>{busy ? 'Saving rules…' : 'Approve new rules'}</Button>
        <Button variant="ghost" size="sm" onClick={onClose} disabled={busy} style={{ width: '100%', marginTop: 8 }}>Cancel</Button>
      </div>
    </div>
  </Portal>;
}
