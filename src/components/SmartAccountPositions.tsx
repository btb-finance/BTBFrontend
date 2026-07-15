'use client';

import { useCallback, useEffect, useState } from 'react';
import { useConfig } from 'wagmi';
import { useAction } from 'convex/react';
import { getPublicClient } from 'wagmi/actions';
import { encodeFunctionData, isAddress, zeroAddress } from 'viem';
import { Glass } from './Glass';
import { Badge } from './Badge';
import { Button } from './Button';
import { TokenIcon } from './TokenIcon';
import { ManagedRebalanceSheet } from './ManagedRebalanceSheet';
import { ManagedPolicySheet } from './ManagedPolicySheet';
import { ManagedAddLiquiditySheet } from './ManagedAddLiquiditySheet';
import { ManagedFundsSheet } from './ManagedFundsSheet';
import { ManagedClaimFeesSheet } from './ManagedClaimFeesSheet';
import { btb } from './design-tokens';
import { useSidebar } from '../lib/SidebarContext';
import { useTx } from '../lib/TxTracker';
import { runCalls } from '../lib/txRunner';
import {
  BTB_AGENT_REGISTRY_ABI, BTB_EARNINGS_PREFERENCES_ABI, BTB_LEGACY_LP_ACCOUNT_ABI, BTB_LP_ACCOUNT_ABI,
  configureSelfAgentCall, createAccountCall, getLegacySmartAccountDeployments, removeAgentCall,
  getSmartAccountDeployment, readSmartAccount,
  shortAddress, type RebalancePolicy, type SmartAccountChainId, type SmartAccountDeployment,
} from '../lib/smartAccount';
import {
  fetchV3Positions, fmtFeeTier, tickToPrice, ROBINHOOD_UNISWAP_V3_DEPLOYMENT, UNISWAP_V3_DEPLOYMENT,
  type LiquidityPosition, type V3Deployment,
} from '@/protocols/dexs/uniswap';
import { api } from '../../convex/_generated/api';

interface AccountState {
  chainId: SmartAccountChainId;
  chainName: string;
  deployment: SmartAccountDeployment;
  account: `0x${string}`;
  deployed: boolean;
  paused: boolean;
  earningsMode: number;
  payoutToken: `0x${string}`;
  agents: { address: `0x${string}`; roles: number }[];
}

interface ManagedItem {
  pos: LiquidityPosition;
  account: AccountState;
  policy: RebalancePolicy | null;
  earningsMode: number;
}

const CHAINS: { chainId: SmartAccountChainId; chainName: string; v3: V3Deployment; explorer: string }[] = [
  { chainId: 1, chainName: 'Ethereum', v3: UNISWAP_V3_DEPLOYMENT, explorer: 'https://etherscan.io/address/' },
  { chainId: 4663, chainName: 'Robinhood Chain', v3: ROBINHOOD_UNISWAP_V3_DEPLOYMENT, explorer: 'https://robinhoodchain.blockscout.com/address/' },
];

function fmtAmt(raw: bigint, decimals: number) {
  const n = Number(raw) / 10 ** decimals;
  if (n === 0) return '0';
  if (n < 0.0001) return '<0.0001';
  return n.toLocaleString('en-US', { maximumFractionDigits: 5 });
}

function fmtPrice(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '—';
  if (value >= 10_000) return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (value >= 100) return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (value >= 1) return value.toLocaleString('en-US', { maximumFractionDigits: 4 });
  if (value >= 0.0001) return value.toLocaleString('en-US', { maximumFractionDigits: 6 });
  return value.toExponential(3);
}

function pctFromLive(bound: number, live: number) {
  if (!Number.isFinite(bound) || !Number.isFinite(live) || live === 0) return 0;
  return (bound / live - 1) * 100;
}

function signedPct(value: number) {
  return `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(Math.abs(value) < 10 ? 1 : 0)}%`;
}

function agentRoleLabel(roles: number) {
  const labels = [];
  if (roles & 4) labels.push('create LP');
  if (roles & 8) labels.push('increase LP');
  return labels.join(' · ') || 'no permissions';
}

function ManagedRangeBar({ p, isMobile }: { p: LiquidityPosition; isMobile: boolean }) {
  const lower = tickToPrice(p.tickLower, p.decimals0, p.decimals1);
  const upper = tickToPrice(p.tickUpper, p.decimals0, p.decimals1);
  const live = tickToPrice(p.currentTick, p.decimals0, p.decimals1);
  const min = Math.min(lower, upper), max = Math.max(lower, upper);
  const marker = max > min ? Math.max(0, Math.min(100, ((live - min) / (max - min)) * 100)) : 50;
  const markerColor = p.inRange ? btb.green : btb.amber;
  return (
    <div style={{ padding: isMobile ? '12px 11px' : '14px', borderRadius: 14, background: 'rgba(255,255,255,.025)', border: btb.borderSoft }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
        <span style={{ color: btb.text, fontSize: 11.5, fontWeight: 800 }}>Price range</span>
        <span style={{ color: btb.textMuted, fontSize: 10 }}>{p.symbol1} per {p.symbol0}</span>
      </div>
      <div style={{ position: 'relative', height: 26, margin: '12px 5px 5px' }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 10, height: 6, borderRadius: 999, background: p.inRange ? 'linear-gradient(90deg,rgba(82,227,164,.24),#52E3A4,rgba(82,227,164,.24))' : 'rgba(255,179,107,.22)', boxShadow: p.inRange ? '0 0 16px rgba(82,227,164,.18)' : 'none' }}/>
        <div style={{ position: 'absolute', left: 0, top: 5, width: 2, height: 16, borderRadius: 2, background: 'rgba(255,255,255,.32)' }}/>
        <div style={{ position: 'absolute', right: 0, top: 5, width: 2, height: 16, borderRadius: 2, background: 'rgba(255,255,255,.32)' }}/>
        <div style={{ position: 'absolute', left: `${marker}%`, top: 1, transform: 'translateX(-50%)', width: 14, height: 14, borderRadius: '50%', background: markerColor, border: '3px solid #15151c', boxShadow: `0 0 0 2px ${markerColor}55, 0 0 15px ${markerColor}55` }}/>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <div>
          <div style={{ color: btb.textDim, fontSize: 9, fontWeight: 750, textTransform: 'uppercase', letterSpacing: .5 }}>Min</div>
          <div style={{ color: btb.text, fontSize: isMobile ? 11 : 12, fontWeight: 750, marginTop: 2 }}>{fmtPrice(min)}</div>
          <div style={{ color: btb.textMuted, fontSize: 9.5 }}>{signedPct(pctFromLive(min, live))}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: markerColor, fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .5 }}>Live</div>
          <div style={{ color: btb.text, fontSize: isMobile ? 11 : 12, fontWeight: 800, marginTop: 2 }}>{fmtPrice(live)}</div>
          <div style={{ color: markerColor, fontSize: 9.5 }}>{p.inRange ? 'earning fees' : 'inactive'}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: btb.textDim, fontSize: 9, fontWeight: 750, textTransform: 'uppercase', letterSpacing: .5 }}>Max</div>
          <div style={{ color: btb.text, fontSize: isMobile ? 11 : 12, fontWeight: 750, marginTop: 2 }}>{fmtPrice(max)}</div>
          <div style={{ color: btb.textMuted, fontSize: 9.5 }}>{signedPct(pctFromLive(max, live))}</div>
        </div>
      </div>
    </div>
  );
}

export function SmartAccountPositions({ address, canTransact, refreshNonce = 0 }: {
  address: `0x${string}`;
  canTransact: boolean;
  refreshNonce?: number;
}) {
  const config = useConfig();
  const { track } = useTx();
  const registerManaged = useAction(api.managedPositionMonitor.register);
  const { isMobile } = useSidebar();
  const [accounts, setAccounts] = useState<AccountState[]>([]);
  const [positions, setPositions] = useState<ManagedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [manualRebalance, setManualRebalance] = useState<ManagedItem | null>(null);
  const [editPolicy, setEditPolicy] = useState<ManagedItem | null>(null);
  const [addLiquidity, setAddLiquidity] = useState<ManagedItem | null>(null);
  const [fundAccount, setFundAccount] = useState<AccountState | null>(null);
  const [claimFees, setClaimFees] = useState<ManagedItem | null>(null);
  const [manageOpen, setManageOpen] = useState<string | null>(null);
  const [editingAccountEarnings, setEditingAccountEarnings] = useState<SmartAccountChainId | null>(null);
  const [editingPositionEarnings, setEditingPositionEarnings] = useState<ManagedItem | null>(null);
  const [earningsMode, setEarningsMode] = useState(0);
  const [payoutToken, setPayoutToken] = useState('');
  const [editingAgents, setEditingAgents] = useState<SmartAccountChainId | null>(null);
  const [newAgent, setNewAgent] = useState('');
  const [agentRoles, setAgentRoles] = useState(12);

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const foundAccounts: AccountState[] = [];
      const foundPositions: ManagedItem[] = [];
      await Promise.all(CHAINS.map(async (chain) => {
        const smartDeployment = getSmartAccountDeployment(chain.chainId);
        const client = getPublicClient(config, { chainId: chain.chainId });
        if (!smartDeployment || !client) return;
        const preference = smartDeployment.earningsPreferences && !smartDeployment.agentRegistry
          ? await client.readContract({ address: smartDeployment.earningsPreferences, abi: BTB_EARNINGS_PREFERENCES_ABI, functionName: 'preferenceOf', args: [address] }).catch(() => [0, zeroAddress] as const)
          : [0, zeroAddress] as const;

        const loadDeployment = async (deployment: SmartAccountDeployment, primary: boolean) => {
          const smart = await readSmartAccount(client, address, deployment);
          const agentAddresses = smart.deployed && deployment.agentRegistry
            ? await client.readContract({ address: deployment.agentRegistry, abi: BTB_AGENT_REGISTRY_ABI, functionName: 'agents', args: [smart.account] }).catch(() => [] as `0x${string}`[])
            : [];
          const agents = deployment.agentRegistry ? await Promise.all(agentAddresses.map(async (agent) => ({
            address: agent,
            roles: Number(await client.readContract({ address: deployment.agentRegistry!, abi: BTB_AGENT_REGISTRY_ABI, functionName: 'agentRoles', args: [smart.account, agent] }).catch(() => 0)),
          }))) : [];
          const accountState: AccountState = { ...smart, chainId: chain.chainId, chainName: chain.chainName, deployment, earningsMode: Number(preference[0]), payoutToken: preference[1], agents };
          if (primary) foundAccounts.push(accountState);
          if (!smart.deployed) return;
          const owned = await fetchV3Positions(client, smart.account, chain.v3).catch(() => []);
          const withPolicies = await Promise.all(owned.map(async (pos): Promise<ManagedItem> => {
            const raw = await client.readContract({
              address: smart.account,
              abi: deployment.agentRegistry ? BTB_LP_ACCOUNT_ABI : BTB_LEGACY_LP_ACCOUNT_ABI,
              functionName: 'policy', args: [chain.v3.positionManager, pos.id],
            }).catch(() => null);
            const policy = raw ? { ...raw, maxIdleBps: 'maxIdleBps' in raw ? Number(raw.maxIdleBps) : 10_000 } as RebalancePolicy : null;
            const earnings = deployment.agentRegistry && policy
              ? await client.readContract({
                address: smart.account, abi: BTB_LP_ACCOUNT_ABI, functionName: 'earningsConfig',
                args: [chain.v3.positionManager, pos.id],
              }).catch(() => null)
              : null;
            return {
              pos: { ...pos, chainId: chain.chainId, chainName: chain.chainName },
              account: accountState,
              policy,
              earningsMode: earnings ? Number(earnings.mode) : accountState.earningsMode,
            };
          }));
          foundPositions.push(...withPolicies);
          await Promise.allSettled(withPolicies.filter(item => item.policy).map(item => {
            const policy = item.policy!;
            return registerManaged({
              chainId: chain.chainId, owner: address, account: smart.account,
              positionManager: chain.v3.positionManager, positionId: item.pos.id.toString(),
              pool: policy.pool, token0: policy.token0, token1: policy.token1, fee: policy.fee,
              tickLower: item.pos.tickLower, tickUpper: item.pos.tickUpper,
              targetTickWidth: policy.targetTickWidth, minimumAllowedTick: policy.minimumAllowedTick,
              maximumAllowedTick: policy.maximumAllowedTick, maxSlippageBps: policy.maxSlippageBps,
              maxSwapBps: policy.maxSwapBpsOfPosition, twapSeconds: policy.twapSeconds,
              minRebalanceInterval: policy.minRebalanceInterval, expiresAt: Number(policy.expiresAt), source: 'reconciled',
            });
          }));
        };

        await loadDeployment(smartDeployment, true);
        for (const legacy of getLegacySmartAccountDeployments(chain.chainId)) {
          if (legacy.factory.toLowerCase() !== smartDeployment.factory.toLowerCase()) await loadDeployment(legacy, false);
        }
      }));
      setAccounts(foundAccounts.sort((a, b) => a.chainId - b.chainId));
      setPositions(foundPositions.sort((a, b) => a.account.chainId - b.account.chainId));
    } catch (e) {
      setErr((e as Error)?.message ?? 'Could not load managed positions');
    } finally { setLoading(false); }
  }, [address, config, refreshNonce, registerManaged]);

  useEffect(() => { load(); }, [load]);

  async function createAccount(state: AccountState) {
    setBusy(`account-${state.chainId}`); setErr(null);
    try {
      await runCalls(config, {
        account: address,
        chainId: state.chainId,
        calls: [createAccountCall(state.deployment, address)],
        label: `Create ${state.chainName} LP account`,
        track,
        verify: {
          test: async () => {
            const client = getPublicClient(config, { chainId: state.chainId });
            return !!client && (await readSmartAccount(client, address, state.deployment)).deployed;
          },
          error: 'The account transaction confirmed but the account is not visible from this RPC yet.',
        },
      });
      await load();
    } catch (e) { setErr((e as { shortMessage?: string })?.shortMessage ?? (e as Error)?.message ?? 'Failed'); }
    finally { setBusy(null); }
  }

  async function togglePause(state: AccountState) {
    setBusy(`account-${state.chainId}`); setErr(null);
    try {
      const fn = state.paused ? 'unpauseAutomation' : 'pauseAutomation';
      await runCalls(config, {
        account: address, chainId: state.chainId, label: state.paused ? 'Resume LP automation' : 'Pause LP automation', track,
        calls: [{ to: state.account, data: encodeFunctionData({ abi: BTB_LP_ACCOUNT_ABI, functionName: fn }) }],
      });
      await load();
    } catch (e) { setErr((e as { shortMessage?: string })?.shortMessage ?? (e as Error)?.message ?? 'Failed'); }
    finally { setBusy(null); }
  }

  async function saveAgent(state: AccountState) {
    const candidate = newAgent.trim();
    if (!isAddress(candidate) || agentRoles === 0) { setErr('Enter a valid agent address and choose at least one permission.'); return; }
    setBusy(`agents-${state.chainId}`); setErr(null);
    try {
      await runCalls(config, {
        account: address, chainId: state.chainId, label: `Authorize agent ${shortAddress(candidate)}`, track,
        calls: [configureSelfAgentCall(state.deployment, state.account, candidate, agentRoles)],
      });
      setNewAgent(''); setAgentRoles(12); await load();
    } catch (e) { setErr((e as { shortMessage?: string })?.shortMessage ?? (e as Error)?.message ?? 'Could not add agent'); }
    finally { setBusy(null); }
  }

  async function removeAgent(state: AccountState, agent: `0x${string}`) {
    setBusy(`agents-${state.chainId}`); setErr(null);
    try {
      await runCalls(config, {
        account: address, chainId: state.chainId, label: `Remove agent ${shortAddress(agent)}`, track,
        calls: [removeAgentCall(state.deployment, state.account, agent)],
      });
      await load();
    } catch (e) { setErr((e as { shortMessage?: string })?.shortMessage ?? (e as Error)?.message ?? 'Could not remove agent'); }
    finally { setBusy(null); }
  }

  async function saveEarnings(state: AccountState) {
    const registry = state.deployment.agentRegistry ? undefined : state.deployment.earningsPreferences;
    const token = earningsMode === 2 ? payoutToken.trim() : zeroAddress;
    if (!registry) return;
    if (earningsMode === 2 && (!isAddress(token) || token === zeroAddress)) {
      setErr('Enter a valid deployed payout-token contract address.'); return;
    }
    setBusy(`earnings-${state.chainId}`); setErr(null);
    try {
      await runCalls(config, {
        account: address, chainId: state.chainId, label: 'Save LP earnings preference', track,
        calls: [{ to: registry, data: encodeFunctionData({ abi: BTB_EARNINGS_PREFERENCES_ABI, functionName: 'setPreference', args: [earningsMode, token as `0x${string}`] }) }],
      });
      setEditingAccountEarnings(null); await load();
    } catch (e) { setErr((e as { shortMessage?: string })?.shortMessage ?? (e as Error)?.message ?? 'Failed'); }
    finally { setBusy(null); }
  }

  async function savePositionEarnings(item: ManagedItem) {
    const key = `${item.account.account}-${item.pos.id}`;
    const chain = CHAINS.find((entry) => entry.chainId === item.account.chainId)!;
    setBusy(key); setErr(null);
    try {
      await runCalls(config, {
        account: address,
        chainId: item.account.chainId,
        label: earningsMode === 1 ? `Auto-compound ${item.pos.symbol0}/${item.pos.symbol1} fees` : `Claim ${item.pos.symbol0}/${item.pos.symbol1} fees as pool tokens`,
        track,
        calls: [{
          to: item.account.account,
          data: encodeFunctionData({
            abi: BTB_LP_ACCOUNT_ABI,
            functionName: 'configureEarnings',
            args: [chain.v3.positionManager, item.pos.id, earningsMode, zeroAddress, '0x', '0x'],
          }),
        }],
      });
      setEditingPositionEarnings(null);
      await load();
    } catch (e) { setErr((e as { shortMessage?: string })?.shortMessage ?? (e as Error)?.message ?? 'Failed'); }
    finally { setBusy(null); }
  }

  async function positionAction(item: ManagedItem, mode: 'revoke' | 'withdraw' | 'claim') {
    const key = `${item.account.account}-${item.pos.id}`;
    const chain = CHAINS.find((entry) => entry.chainId === item.account.chainId)!;
    setBusy(key); setErr(null);
    try {
      const functionName = mode === 'revoke' ? 'revokeAgent' : mode === 'claim' ? 'claimPositionFees' : 'withdrawPosition';
      await runCalls(config, {
        account: address,
        chainId: item.account.chainId,
        label: mode === 'revoke' ? `Stop ${item.pos.symbol0}/${item.pos.symbol1} automation` : mode === 'claim' ? `Claim ${item.pos.symbol0}/${item.pos.symbol1} fees` : `Settle fees and return ${item.pos.symbol0}/${item.pos.symbol1} NFT`,
        track,
        calls: [{
          to: item.account.account,
          data: encodeFunctionData({ abi: BTB_LP_ACCOUNT_ABI, functionName, args: [chain.v3.positionManager, item.pos.id] }),
        }],
      });
      await load();
    } catch (e) { setErr((e as { shortMessage?: string })?.shortMessage ?? (e as Error)?.message ?? 'Failed'); }
    finally { setBusy(null); }
  }

  if (accounts.length === 0 && !loading) {
    return (
      <Glass padding={14} radius={16} soft>
        <div style={{ color: btb.text, fontSize: 13, fontWeight: 800 }}>Automatic LP management</div>
        <div style={{ color: btb.textMuted, fontSize: 11.5, marginTop: 4 }}>Smart-account deployments are not configured yet. Add the deployment addresses to enable testing.</div>
      </Glass>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      <Glass padding={isMobile ? 12 : 15} radius={16} soft>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, marginBottom: 9 }}>
          <div>
            <div style={{ color: btb.text, fontSize: 13.5, fontWeight: 850 }}>Automatic LP management</div>
            <div style={{ color: btb.textMuted, fontSize: 10.5, marginTop: 2 }}>One fixed-owner account per supported chain. The agent can rebalance only within your rules.</div>
          </div>
          {loading && <span style={{ color: btb.textDim, fontSize: 10.5 }}>Refreshing…</span>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : `repeat(${Math.max(accounts.length, 1)}, minmax(0, 1fr))`, gap: 8 }}>
          {accounts.map((state) => {
            const chain = CHAINS.find((item) => item.chainId === state.chainId)!;
            const count = positions.filter((item) => item.account.chainId === state.chainId).length;
            const isBusy = busy === `account-${state.chainId}`;
            return (
              <div key={state.chainId} style={{ borderRadius: 12, padding: 10, background: 'rgba(255,255,255,0.035)', border: btb.borderSoft }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                  <div>
                    <div style={{ color: btb.text, fontSize: 12, fontWeight: 800 }}>{state.chainName}</div>
                    <a href={`${chain.explorer}${state.account}`} target="_blank" rel="noopener noreferrer" style={{ color: btb.textDim, fontSize: 10, textDecoration: 'none' }}>{shortAddress(state.account)} ↗</a>
                  </div>
                  <Badge size="sm" border="none" bg={state.deployed ? state.paused ? 'rgba(255,179,107,0.13)' : 'rgba(82,227,164,0.13)' : 'rgba(255,255,255,0.06)'} color={state.deployed ? state.paused ? btb.amber : btb.green : btb.textDim}>
                    {state.deployed ? state.paused ? 'Paused' : `${count} managed` : 'Not created'}
                  </Badge>
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  {!state.deployed ? (
                    <Button variant="success" size="sm" onClick={() => createAccount(state)} disabled={!canTransact || isBusy} style={{ height: 31, fontSize: 11, boxShadow: 'none' }}>{isBusy ? 'Creating…' : 'Create account'}</Button>
                  ) : (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => setFundAccount(state)} disabled={!canTransact || isBusy} style={{ height: 31, fontSize: 11, border: '1px solid rgba(82,227,164,.25)', color: btb.green }}>Add funds</Button>
                      <Button variant="ghost" size="sm" onClick={() => togglePause(state)} disabled={!canTransact || isBusy} style={{ height: 31, fontSize: 11, border: btb.borderSoft }}>{isBusy ? 'Confirming…' : state.paused ? 'Resume all' : 'Pause all'}</Button>
                      {state.deployment.agentRegistry && <Button variant="ghost" size="sm" onClick={() => { setEditingAgents(editingAgents === state.chainId ? null : state.chainId); setNewAgent(''); setAgentRoles(12); }} disabled={!canTransact} style={{ height: 31, fontSize: 11, border: btb.borderSoft }}>Agents · {state.agents.length}/5</Button>}
                      {state.deployment.earningsPreferences && !state.deployment.agentRegistry && <Button variant="ghost" size="sm" onClick={() => { setEditingAccountEarnings(state.chainId); setEarningsMode(state.earningsMode); setPayoutToken(state.payoutToken === zeroAddress ? '' : state.payoutToken); }} disabled={!canTransact} style={{ height: 31, fontSize: 11, border: btb.borderSoft }}>Earnings</Button>}
                    </>
                  )}
                </div>
                {editingAccountEarnings === state.chainId && state.deployment.earningsPreferences && !state.deployment.agentRegistry && (
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: btb.borderSoft }}>
                    <select value={earningsMode} onChange={(e) => setEarningsMode(Number(e.target.value))} style={{ width: '100%', height: 32, borderRadius: 8, padding: '0 8px', color: btb.text, background: 'rgba(255,255,255,.06)', border: btb.borderSoft }}>
                      <option value={0}>Claim in pool tokens</option><option value={1}>Compound earnings</option><option value={2}>Send as one token</option>
                    </select>
                    {earningsMode === 2 && (
                      <input value={payoutToken} onChange={(e) => setPayoutToken(e.target.value)} placeholder="Token contract (for example USDG)" style={{ boxSizing: 'border-box', width: '100%', height: 32, marginTop: 6, borderRadius: 8, padding: '0 8px', color: btb.text, background: 'rgba(255,255,255,.06)', border: btb.borderSoft, outline: 'none', fontSize: 10.5 }}/>
                    )}
                    <div style={{ color: btb.textDim, fontSize: 9.5, lineHeight: 1.4, marginTop: 5 }}>Funds always go to your wallet. Conversion runs only when a protected liquid route exists.</div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 7 }}><Button variant="success" size="sm" onClick={() => saveEarnings(state)} disabled={busy === `earnings-${state.chainId}`} style={{ height: 30, fontSize: 10.5 }}>{busy === `earnings-${state.chainId}` ? 'Saving…' : 'Save'}</Button><Button variant="ghost" size="sm" onClick={() => setEditingAccountEarnings(null)} style={{ height: 30, fontSize: 10.5 }}>Cancel</Button></div>
                  </div>
                )}
                {editingAgents === state.chainId && state.deployment.agentRegistry && (
                  <div style={{ marginTop: 9, paddingTop: 9, borderTop: btb.borderSoft }}>
                    <div style={{ color: btb.text, fontSize: 11.5, fontWeight: 800 }}>Authorized agents</div>
                    <div style={{ color: btb.textDim, fontSize: 9.5, lineHeight: 1.4, marginTop: 2 }}>Maximum five for creating or increasing LPs. Set a custom rebalance agent per position under Range & rules. Agents cannot withdraw funds, transfer NFTs, change ownership, or change rules.</div>
                    {state.agents.length > 0 && <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 8 }}>
                      {state.agents.map((agent) => <div key={agent.address} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 8px', borderRadius: 9, background: 'rgba(255,255,255,.03)', border: btb.borderSoft }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div title={agent.address} style={{ color: btb.text, fontSize: 10.5, fontWeight: 750 }}>{shortAddress(agent.address)}{agent.address.toLowerCase() === state.deployment.agent.toLowerCase() ? ' · BTB' : ''}</div>
                          <div style={{ color: btb.textDim, fontSize: 9.5, marginTop: 1 }}>{agentRoleLabel(agent.roles)}</div>
                        </div>
                        <button onClick={() => removeAgent(state, agent.address)} disabled={busy === `agents-${state.chainId}`} style={{ border: 'none', background: 'transparent', color: btb.loss, padding: 4, fontFamily: 'inherit', fontSize: 9.5, fontWeight: 750, cursor: 'pointer' }}>Remove</button>
                      </div>)}
                    </div>}
                    <input value={newAgent} onChange={(event) => setNewAgent(event.target.value)} spellCheck={false} placeholder="Agent address 0x…" style={{ width: '100%', height: 36, boxSizing: 'border-box', borderRadius: 9, padding: '0 9px', marginTop: 8, color: btb.text, background: 'rgba(255,255,255,.05)', border: newAgent && !isAddress(newAgent) ? '1px solid rgba(255,107,122,.35)' : btb.borderSoft, outline: 'none', fontFamily: 'monospace', fontSize: 10.5 }}/>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 5, marginTop: 6 }}>
                      {([{ bit: 4, label: 'Create LP' }, { bit: 8, label: 'Increase LP' }] as const).map(role => {
                        const selected = (agentRoles & role.bit) !== 0;
                        return <button key={role.bit} onClick={() => setAgentRoles(value => selected ? value & ~role.bit : value | role.bit)} style={{ height: 32, borderRadius: 8, border: selected ? '1px solid rgba(82,227,164,.4)' : btb.borderSoft, background: selected ? 'rgba(82,227,164,.09)' : 'rgba(255,255,255,.025)', color: selected ? btb.green : btb.textMuted, fontFamily: 'inherit', fontSize: 9.5, fontWeight: 750, cursor: 'pointer' }}>{role.label}</button>;
                      })}
                    </div>
                    <Button variant="success" size="sm" onClick={() => saveAgent(state)} disabled={!isAddress(newAgent) || agentRoles === 0 || state.agents.length >= 5 || busy === `agents-${state.chainId}`} style={{ height: 32, fontSize: 10.5, marginTop: 7, boxShadow: 'none' }}>{busy === `agents-${state.chainId}` ? 'Saving…' : state.agents.length >= 5 ? 'Agent limit reached' : 'Add agent'}</Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {err && <div style={{ color: btb.loss, fontSize: 11, marginTop: 9, lineHeight: 1.4 }}>{err}</div>}
      </Glass>

      {positions.map((item) => {
        const p = item.pos;
        const key = `${item.account.account}-${p.id}`;
        const isBusy = busy === key;
        const active = !!item.policy?.enabled && !item.account.paused && Number(item.policy.expiresAt) > Date.now() / 1000;
        const hasFees = p.fees0 > 0n || p.fees1 > 0n;
        const policy = item.policy;
        return (
          <Glass key={key} padding={isMobile ? 12 : 16} radius={18}>
            <div style={{ display: 'flex', gap: 11, alignItems: 'center' }}>
              <div style={{ display: 'flex', flexShrink: 0 }}><TokenIcon symbol={p.symbol0} size={30}/><div style={{ marginLeft: -9 }}><TokenIcon symbol={p.symbol1} size={30}/></div></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: btb.text, fontSize: isMobile ? 15 : 16, fontWeight: 850, letterSpacing: -.25 }}>{p.symbol0} / {p.symbol1}</div>
                <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap', marginTop: 4 }}>
                  <Badge size="sm" border="none" bg={btb.surfaceSoft} color={btb.textMuted}>{p.chainName}</Badge>
                  <Badge size="sm" border="none" bg={btb.surfaceSoft} color={btb.textMuted}>{fmtFeeTier(p.fee)}</Badge>
                  <Badge size="sm" border="none" bg="rgba(106,124,255,.12)" color="#91A1FF">Uniswap V3</Badge>
                  <span style={{ color: btb.textDim, fontSize: 9.5 }}>NFT #{p.id.toString()}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <Badge size="sm" border="none" bg={p.inRange ? 'rgba(82,227,164,0.13)' : 'rgba(255,179,107,0.13)'} color={p.inRange ? btb.green : btb.amber}>{p.inRange ? 'In range' : 'Out of range'}</Badge>
                <Badge size="sm" border="none" bg={active ? 'rgba(82,227,164,0.13)' : 'rgba(255,255,255,0.06)'} color={active ? btb.green : btb.textDim}>{active ? 'Automated' : 'Stopped'}</Badge>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'minmax(0,1fr) minmax(0,1fr) minmax(280px,1.35fr)', gap: 8, marginTop: 13 }}>
              <div style={{ padding: '12px 11px', borderRadius: 14, background: 'rgba(255,255,255,.025)', border: btb.borderSoft }}>
                <div style={{ color: btb.textDim, fontSize: 9.5, fontWeight: 750, textTransform: 'uppercase', letterSpacing: .45 }}>Position</div>
                <div style={{ color: btb.text, fontSize: 12, fontWeight: 750, marginTop: 7 }}>{fmtAmt(p.amount0, p.decimals0)} <span style={{ color: btb.textMuted }}>{p.symbol0}</span></div>
                <div style={{ color: btb.text, fontSize: 12, fontWeight: 750, marginTop: 4 }}>{fmtAmt(p.amount1, p.decimals1)} <span style={{ color: btb.textMuted }}>{p.symbol1}</span></div>
              </div>
              <div style={{ padding: '12px 11px', borderRadius: 14, background: hasFees ? 'rgba(82,227,164,.035)' : 'rgba(255,255,255,.025)', border: hasFees ? '1px solid rgba(82,227,164,.14)' : btb.borderSoft }}>
                <div style={{ color: btb.textDim, fontSize: 9.5, fontWeight: 750, textTransform: 'uppercase', letterSpacing: .45 }}>Unclaimed fees</div>
                <div style={{ color: hasFees ? btb.green : btb.textDim, fontSize: 12, fontWeight: 750, marginTop: 7 }}>{fmtAmt(p.fees0, p.decimals0)} <span style={{ color: btb.textMuted }}>{p.symbol0}</span></div>
                <div style={{ color: hasFees ? btb.green : btb.textDim, fontSize: 12, fontWeight: 750, marginTop: 4 }}>{fmtAmt(p.fees1, p.decimals1)} <span style={{ color: btb.textMuted }}>{p.symbol1}</span></div>
              </div>
              <div style={{ gridColumn: isMobile ? '1 / -1' : undefined }}><ManagedRangeBar p={p} isMobile={isMobile}/></div>
            </div>

            {policy && (
              <div style={{ marginTop: 8, padding: '9px 11px', borderRadius: 12, display: 'flex', flexWrap: 'wrap', gap: '6px 12px', alignItems: 'center', background: active ? 'rgba(82,227,164,.035)' : 'rgba(255,255,255,.025)', border: active ? '1px solid rgba(82,227,164,.13)' : btb.borderSoft }}>
                <span style={{ color: active ? btb.green : btb.textDim, fontSize: 10.5, fontWeight: 800 }}>{active ? '● Automation on' : '○ Automation off'}</span>
                <span style={{ color: btb.textMuted, fontSize: 10.5 }}>Swap ≤ {policy.maxSwapBpsOfPosition / 100}%</span>
                <span style={{ color: btb.textMuted, fontSize: 10.5 }}>Slippage {policy.maxSlippageBps / 100}%</span>
                <a href={`${CHAINS.find((c) => c.chainId === item.account.chainId)!.explorer}${policy.agent}`} target="_blank" rel="noopener noreferrer" style={{ color: btb.textDim, fontSize: 10, textDecoration: 'none', marginLeft: isMobile ? 0 : 'auto' }}>Agent {shortAddress(policy.agent)} ↗</a>
              </div>
            )}
            {editingPositionEarnings === item && item.account.deployment.agentRegistry && (
              <div style={{ marginTop: 8, padding: 9, borderRadius: 10, background: 'rgba(82,227,164,.045)', border: '1px solid rgba(82,227,164,.18)' }}>
                <div style={{ color: btb.text, fontSize: 11, fontWeight: 800 }}>Fee earnings</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 7 }}>
                  <button type="button" onClick={() => setEarningsMode(0)} style={{ minHeight: 42, borderRadius: 9, border: earningsMode === 0 ? '1px solid rgba(82,227,164,.55)' : btb.borderSoft, background: earningsMode === 0 ? 'rgba(82,227,164,.1)' : 'rgba(255,255,255,.025)', color: btb.text, fontSize: 10.5, fontWeight: 750, cursor: 'pointer' }}>Claim pool tokens</button>
                  <button type="button" onClick={() => setEarningsMode(1)} style={{ minHeight: 42, borderRadius: 9, border: earningsMode === 1 ? '1px solid rgba(82,227,164,.55)' : btb.borderSoft, background: earningsMode === 1 ? 'rgba(82,227,164,.1)' : 'rgba(255,255,255,.025)', color: btb.text, fontSize: 10.5, fontWeight: 750, cursor: 'pointer' }}>Auto-compound</button>
                </div>
                <div style={{ color: btb.textDim, fontSize: 9.5, lineHeight: 1.45, marginTop: 6 }}>{earningsMode === 1 ? 'The approved agent can put earned fees back into this NFT under your swap, range and price limits.' : 'Claim sends your share of both pool tokens to your fixed owner wallet after the protocol fee.'}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}><Button variant="success" size="sm" onClick={() => savePositionEarnings(item)} disabled={isBusy} style={{ height: 30, fontSize: 10.5 }}>{isBusy ? 'Saving…' : 'Save'}</Button><Button variant="ghost" size="sm" onClick={() => setEditingPositionEarnings(null)} style={{ height: 30, fontSize: 10.5 }}>Cancel</Button></div>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'auto auto auto', justifyContent: isMobile ? 'stretch' : 'start', gap: 7, marginTop: 10 }}>
              <Button fullWidth={isMobile} variant="ghost" size="sm" onClick={() => setAddLiquidity(item)} disabled={!canTransact || isBusy} style={{ height: 36, minWidth: isMobile ? 0 : 112, fontSize: 11, border: '1px solid rgba(82,227,164,.25)', color: btb.green, borderRadius: 11 }}>Add liquidity</Button>
              {item.account.chainId === 4663 && policy && <Button fullWidth={isMobile} variant="success" size="sm" onClick={() => setManualRebalance(item)} disabled={!canTransact || isBusy} style={{ height: 36, minWidth: isMobile ? 0 : 150, fontSize: 11, boxShadow: 'none', borderRadius: 11 }}>Compound / rebalance</Button>}
              <Button fullWidth={isMobile} variant="ghost" size="sm" onClick={() => setManageOpen(manageOpen === key ? null : key)} style={{ height: 36, minWidth: isMobile ? 0 : 92, fontSize: 11, borderRadius: 11, gridColumn: isMobile ? '1 / -1' : undefined }}>{manageOpen === key ? 'Close' : 'Manage'}</Button>
            </div>
            {manageOpen === key && <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4,auto)', justifyContent: isMobile ? 'stretch' : 'start', gap: 6, marginTop: 7, paddingTop: 8, borderTop: btb.borderSoft }}>
              {item.account.chainId === 4663 && policy && <Button fullWidth={isMobile} variant="ghost" size="sm" onClick={() => setEditPolicy(item)} disabled={!canTransact || isBusy} style={{ height: 33, fontSize: 10.5, borderRadius: 10 }}>Range & rules</Button>}
              {item.account.deployment.agentRegistry && policy && <Button fullWidth={isMobile} variant="ghost" size="sm" onClick={() => { setEditingPositionEarnings(item); setEarningsMode(item.earningsMode); }} disabled={!canTransact || isBusy} style={{ height: 33, fontSize: 10.5, borderRadius: 10 }}>Fee settings</Button>}
              {policy && item.account.deployment.aggregatorSwapAdapter && <Button fullWidth={isMobile} variant="ghost" size="sm" onClick={() => setClaimFees(item)} disabled={!canTransact || isBusy} style={{ height: 33, fontSize: 10.5, borderRadius: 10 }}>Claim as token</Button>}
              {policy && !item.account.deployment.aggregatorSwapAdapter && <Button fullWidth={isMobile} variant="ghost" size="sm" onClick={() => positionAction(item, 'claim')} disabled={!canTransact || isBusy} style={{ height: 33, fontSize: 10.5, borderRadius: 10 }}>Claim fees</Button>}
              {policy?.enabled && <Button fullWidth={isMobile} variant="ghost" size="sm" onClick={() => positionAction(item, 'revoke')} disabled={!canTransact || isBusy} style={{ height: 33, fontSize: 10.5, borderRadius: 10 }}>{isBusy ? 'Confirming…' : 'Stop agent'}</Button>}
              <Button fullWidth={isMobile} variant="ghost" size="sm" onClick={() => positionAction(item, 'withdraw')} disabled={!canTransact || isBusy} style={{ height: 33, fontSize: 10.5, border: '1px solid rgba(255,179,107,0.25)', color: btb.amber, borderRadius: 10 }}>{isBusy ? 'Confirming…' : 'Return NFT'}</Button>
            </div>}
          </Glass>
        );
      })}
      {manualRebalance?.policy && <ManagedRebalanceSheet
        pos={manualRebalance.pos}
        smartAccount={manualRebalance.account.account}
        owner={address}
        policy={manualRebalance.policy}
        onClose={() => setManualRebalance(null)}
        onDone={async () => { setManualRebalance(null); await load(); }}
      />}
      {addLiquidity && <ManagedAddLiquiditySheet
        pos={addLiquidity.pos}
        pool={addLiquidity.policy?.pool}
        owner={address}
        smartAccount={addLiquidity.account.account}
        smartDeployment={addLiquidity.account.deployment}
        onClose={() => setAddLiquidity(null)}
        onDone={async () => { setAddLiquidity(null); await load(); }}
      />}
      {fundAccount && <ManagedFundsSheet
        chainId={fundAccount.chainId}
        chainName={fundAccount.chainName}
        owner={address}
        account={fundAccount.account}
        onClose={() => setFundAccount(null)}
        onDone={load}
      />}
      {claimFees?.policy && <ManagedClaimFeesSheet
        pos={claimFees.pos}
        policy={claimFees.policy}
        owner={address}
        account={claimFees.account.account}
        deployment={claimFees.account.deployment}
        v3={CHAINS.find(chain => chain.chainId === claimFees.account.chainId)!.v3}
        onClose={() => setClaimFees(null)}
        onDone={load}
      />}
      {editPolicy?.policy && <ManagedPolicySheet
        pos={editPolicy.pos}
        account={editPolicy.account.account}
        owner={address}
        policy={editPolicy.policy}
        deployment={editPolicy.account.deployment}
        onClose={() => setEditPolicy(null)}
        onDone={load}
      />}
    </div>
  );
}
