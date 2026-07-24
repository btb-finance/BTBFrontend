'use client';

import { useState } from 'react';
import { btb } from './design-tokens';
import { Icon } from './Icon';
const shortAddress = (value: string) => `${value.slice(0, 6)}…${value.slice(-4)}`;

export interface AutomationRuleValues {
  targetRangePct: 1 | 5 | 10 | 25 | 50;
  allowedRangePct: 10 | 25 | 50 | null;
  maxSwapPct: 10 | 25 | 50 | 100;
  maxDeviationPct: 1 | 3 | 5 | 10;
  twapSeconds: 60 | 300 | 900 | 1800;
  intervalSeconds: 900 | 3600 | 21600 | 86400;
  expiryDays: 7 | 30 | 90 | 365;
}

export const DEFAULT_AUTOMATION_RULES: AutomationRuleValues = {
  targetRangePct: 10,
  allowedRangePct: 25,
  maxSwapPct: 25,
  maxDeviationPct: 5,
  twapSeconds: 300,
  intervalSeconds: 3600,
  expiryDays: 90,
};

const controlStyle = {
  width: '100%', height: 34, borderRadius: 9, padding: '0 9px', fontFamily: 'inherit',
  color: btb.text, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
  fontSize: 11.5, fontWeight: 700, outline: 'none',
} as const;

function Rule({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const open = hovered || pinned;
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
        <span style={{ color: btb.textDim, fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.35 }}>{label}</span>
        <button
          type="button"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onClick={() => setPinned((p) => !p)}
          aria-label={`What does ${label} mean?`}
          aria-expanded={open}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 15, height: 15, flexShrink: 0, borderRadius: 999, padding: 0, cursor: 'pointer',
            border: 'none', background: 'transparent', opacity: open ? 1 : 0.6, transition: 'opacity .15s',
          }}
        >
          <Icon name="info" size={13} color={open ? btb.green : btb.textMuted} />
        </button>
      </div>
      {children}
      {open && (
        <div style={{ color: btb.textMuted, fontSize: 9.5, lineHeight: 1.4, marginTop: 5 }}>{hint}</div>
      )}
    </div>
  );
}

export function AutomationRules({ value, onChange, agent, slippageBps, onSlippageChange, disabled = false }: {
  value: AutomationRuleValues;
  onChange: (next: AutomationRuleValues) => void;
  agent: `0x${string}`;
  slippageBps: number;
  onSlippageChange: (bps: number) => void;
  disabled?: boolean;
}) {
  const set = <K extends keyof AutomationRuleValues>(key: K, next: AutomationRuleValues[K]) => onChange({ ...value, [key]: next });
  return (
    <div style={{ borderRadius: 13, padding: 11, background: 'rgba(82,227,164,0.055)', border: '1px solid rgba(82,227,164,0.18)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline', marginBottom: 9 }}>
        <div>
          <div style={{ color: btb.text, fontSize: 12.5, fontWeight: 800 }}>Automation limits</div>
          <div style={{ color: btb.textMuted, fontSize: 10, marginTop: 2 }}>The agent can rebalance, but cannot withdraw or change these rules.</div>
        </div>
        <span title={agent} style={{ color: btb.green, fontSize: 10, fontWeight: 750, flexShrink: 0 }}>Agent {shortAddress(agent)}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
        <Rule label="LP range" hint="The width the agent must use when it opens the replacement LP. You can change it later.">
          <select disabled={disabled} value={value.targetRangePct} onChange={(e) => set('targetRangePct', Number(e.target.value) as 1 | 5 | 10 | 25 | 50)} style={controlStyle}>
            <option value={1}>±1%</option><option value={5}>±5%</option><option value={10}>±10%</option><option value={25}>±25%</option><option value={50}>±50%</option>
          </select>
        </Rule>
        <Rule label="Allowed area" hint="Every future LP range must stay inside this price area around today's pool price.">
          <select disabled={disabled} value={value.allowedRangePct ?? 'full'} onChange={(e) => set('allowedRangePct', e.target.value === 'full' ? null : Number(e.target.value) as 10 | 25 | 50)} style={controlStyle}>
            <option value={10}>±10%</option><option value={25}>±25%</option><option value={50}>±50%</option><option value="full">Full range</option>
          </select>
        </Rule>
        <Rule label="Max swap" hint="When the position goes out of range, the most of it the agent may sell to build the new range.">
          <select disabled={disabled} value={value.maxSwapPct} onChange={(e) => set('maxSwapPct', Number(e.target.value) as 10 | 25 | 50 | 100)} style={controlStyle}>
            <option value={10}>10% per rebalance</option><option value={25}>25% per rebalance</option><option value={50}>50% per rebalance</option><option value={100}>100% per rebalance</option>
          </select>
        </Rule>
        <Rule label="Max slippage" hint="The on-chain TWAP quote enforces this maximum loss during the rebalance swap.">
          <select disabled={disabled} value={slippageBps} onChange={(e) => onSlippageChange(Number(e.target.value))} style={controlStyle}>
            <option value={50}>0.5%</option><option value={100}>1%</option><option value={300}>3%</option><option value={500}>5%</option><option value={1000}>10%</option><option value={2000}>20%</option>
          </select>
        </Rule>
        <Rule label="Price guard" hint="Automation stops when the live price differs too much from the pool's time-weighted price.">
          <select disabled={disabled} value={value.maxDeviationPct} onChange={(e) => set('maxDeviationPct', Number(e.target.value) as 1 | 3 | 5 | 10)} style={controlStyle}>
            <option value={1}>1% deviation</option><option value={3}>3% deviation</option><option value={5}>5% deviation</option><option value={10}>10% deviation</option>
          </select>
        </Rule>
        <Rule label="TWAP window" hint="How far back the pool oracle looks before allowing a rebalance.">
          <select disabled={disabled} value={value.twapSeconds} onChange={(e) => set('twapSeconds', Number(e.target.value) as 60 | 300 | 900 | 1800)} style={controlStyle}>
            <option value={60}>1 minute</option><option value={300}>5 minutes</option><option value={900}>15 minutes</option><option value={1800}>30 minutes</option>
          </select>
        </Rule>
        <Rule label="Cooldown" hint="Minimum time between two successful rebalances for this position.">
          <select disabled={disabled} value={value.intervalSeconds} onChange={(e) => set('intervalSeconds', Number(e.target.value) as 900 | 3600 | 21600 | 86400)} style={controlStyle}>
            <option value={900}>15 minutes</option><option value={3600}>1 hour</option><option value={21600}>6 hours</option><option value={86400}>24 hours</option>
          </select>
        </Rule>
        <Rule label="Permission expires" hint="After this time, the agent cannot rebalance until you approve new rules.">
          <select disabled={disabled} value={value.expiryDays} onChange={(e) => set('expiryDays', Number(e.target.value) as 7 | 30 | 90 | 365)} style={controlStyle}>
            <option value={7}>7 days</option><option value={30}>30 days</option><option value={90}>90 days</option><option value={365}>1 year</option>
          </select>
        </Rule>
      </div>
    </div>
  );
}
