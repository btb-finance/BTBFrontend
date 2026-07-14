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
import { btb } from './design-tokens';
import { useSidebar } from '../lib/SidebarContext';
import { useTx } from '../lib/TxTracker';
import { runCalls } from '../lib/txRunner';
import {
  BTB_EARNINGS_PREFERENCES_ABI, BTB_LP_ACCOUNT_ABI, createAccountCall, getLegacySmartAccountDeployments,
  getSmartAccountDeployment, readSmartAccount,
  shortAddress, type RebalancePolicy, type SmartAccountChainId, type SmartAccountDeployment,
} from '../lib/smartAccount';
import {
  fetchV3Positions, ROBINHOOD_UNISWAP_V3_DEPLOYMENT, UNISWAP_V3_DEPLOYMENT,
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
}

interface ManagedItem {
  pos: LiquidityPosition;
  account: AccountState;
  policy: RebalancePolicy | null;
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
  const [editingEarnings, setEditingEarnings] = useState<SmartAccountChainId | null>(null);
  const [earningsMode, setEarningsMode] = useState(0);
  const [payoutToken, setPayoutToken] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const foundAccounts: AccountState[] = [];
      const foundPositions: ManagedItem[] = [];
      await Promise.all(CHAINS.map(async (chain) => {
        const smartDeployment = getSmartAccountDeployment(chain.chainId);
        const client = getPublicClient(config, { chainId: chain.chainId });
        if (!smartDeployment || !client) return;
        const preference = smartDeployment.earningsPreferences
          ? await client.readContract({ address: smartDeployment.earningsPreferences, abi: BTB_EARNINGS_PREFERENCES_ABI, functionName: 'preferenceOf', args: [address] }).catch(() => [0, zeroAddress] as const)
          : [0, zeroAddress] as const;

        const loadDeployment = async (deployment: SmartAccountDeployment, primary: boolean) => {
          const smart = await readSmartAccount(client, address, deployment);
          const accountState: AccountState = { ...smart, chainId: chain.chainId, chainName: chain.chainName, deployment, earningsMode: Number(preference[0]), payoutToken: preference[1] };
          if (primary) foundAccounts.push(accountState);
          if (!smart.deployed) return;
          const owned = await fetchV3Positions(client, smart.account, chain.v3).catch(() => []);
          const withPolicies = await Promise.all(owned.map(async (pos): Promise<ManagedItem> => {
            const policy = await client.readContract({ address: smart.account, abi: BTB_LP_ACCOUNT_ABI, functionName: 'policy', args: [chain.v3.positionManager, pos.id] }).catch(() => null);
            return { pos: { ...pos, chainId: chain.chainId, chainName: chain.chainName }, account: accountState, policy: policy as RebalancePolicy | null };
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

  async function saveEarnings(state: AccountState) {
    const registry = state.deployment.earningsPreferences;
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
      setEditingEarnings(null); await load();
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
                      <Button variant="ghost" size="sm" onClick={() => togglePause(state)} disabled={!canTransact || isBusy} style={{ height: 31, fontSize: 11, border: btb.borderSoft }}>{isBusy ? 'Confirming…' : state.paused ? 'Resume all' : 'Pause all'}</Button>
                      {state.deployment.earningsPreferences && <Button variant="ghost" size="sm" onClick={() => { setEditingEarnings(state.chainId); setEarningsMode(state.earningsMode); setPayoutToken(state.payoutToken === zeroAddress ? '' : state.payoutToken); }} disabled={!canTransact} style={{ height: 31, fontSize: 11, border: btb.borderSoft }}>Earnings</Button>}
                    </>
                  )}
                </div>
                {editingEarnings === state.chainId && state.deployment.earningsPreferences && (
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: btb.borderSoft }}>
                    <select value={earningsMode} onChange={(e) => setEarningsMode(Number(e.target.value))} style={{ width: '100%', height: 32, borderRadius: 8, padding: '0 8px', color: btb.text, background: 'rgba(255,255,255,.06)', border: btb.borderSoft }}>
                      <option value={0}>Claim in pool tokens</option><option value={1}>Compound earnings</option><option value={2}>Send as one token</option>
                    </select>
                    {earningsMode === 2 && (
                      <input value={payoutToken} onChange={(e) => setPayoutToken(e.target.value)} placeholder="Token contract (for example USDG)" style={{ boxSizing: 'border-box', width: '100%', height: 32, marginTop: 6, borderRadius: 8, padding: '0 8px', color: btb.text, background: 'rgba(255,255,255,.06)', border: btb.borderSoft, outline: 'none', fontSize: 10.5 }}/>
                    )}
                    <div style={{ color: btb.textDim, fontSize: 9.5, lineHeight: 1.4, marginTop: 5 }}>Funds always go to your wallet. Conversion runs only when a protected liquid route exists.</div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 7 }}><Button variant="success" size="sm" onClick={() => saveEarnings(state)} disabled={busy === `earnings-${state.chainId}`} style={{ height: 30, fontSize: 10.5 }}>{busy === `earnings-${state.chainId}` ? 'Saving…' : 'Save'}</Button><Button variant="ghost" size="sm" onClick={() => setEditingEarnings(null)} style={{ height: 30, fontSize: 10.5 }}>Cancel</Button></div>
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
        return (
          <Glass key={key} padding={isMobile ? 12 : 14} radius={16}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ display: 'flex', flexShrink: 0 }}><TokenIcon symbol={p.symbol0} size={27}/><div style={{ marginLeft: -8 }}><TokenIcon symbol={p.symbol1} size={27}/></div></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: btb.text, fontSize: 13.5, fontWeight: 800 }}>{p.symbol0} / {p.symbol1}</div>
                <div style={{ color: btb.textMuted, fontSize: 10.5, marginTop: 2 }}>{p.chainName} · NFT #{p.id.toString()}</div>
              </div>
              <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <Badge size="sm" border="none" bg={p.inRange ? 'rgba(82,227,164,0.13)' : 'rgba(255,179,107,0.13)'} color={p.inRange ? btb.green : btb.amber}>{p.inRange ? 'In range' : 'Out of range'}</Badge>
                <Badge size="sm" border="none" bg={active ? 'rgba(82,227,164,0.13)' : 'rgba(255,255,255,0.06)'} color={active ? btb.green : btb.textDim}>{active ? 'Automated' : 'Stopped'}</Badge>
              </div>
            </div>
            <div style={{ color: btb.textMuted, fontSize: 11.5, marginTop: 9 }}>
              {fmtAmt(p.amount0, p.decimals0)} {p.symbol0} + {fmtAmt(p.amount1, p.decimals1)} {p.symbol1}
              {(p.fees0 > 0n || p.fees1 > 0n) && <span style={{ color: btb.green }}> · fees {fmtAmt(p.fees0, p.decimals0)} + {fmtAmt(p.fees1, p.decimals1)}</span>}
            </div>
            {item.policy && (
              <div style={{ marginTop: 7, padding: '8px 9px', borderRadius: 10, background: 'rgba(255,255,255,.03)', border: btb.borderSoft }}>
                <div style={{ color: btb.textMuted, fontSize: 10.5, lineHeight: 1.5 }}>
                  Agent <a href={`${CHAINS.find((c) => c.chainId === item.account.chainId)!.explorer}${item.policy.agent}`} target="_blank" rel="noopener noreferrer" style={{ color: btb.green, textDecoration: 'none' }}>{shortAddress(item.policy.agent)} ↗</a>
                  {' · '}target width {item.policy.targetTickWidth.toLocaleString()} ticks · fixed 10% of earned fees
                </div>
                <div style={{ color: btb.textDim, fontSize: 9.5, lineHeight: 1.45, marginTop: 2 }}>
                  Approved: rebalance only inside your range, swap at most {item.policy.maxSwapBpsOfPosition / 100}%, slippage {item.policy.maxSlippageBps / 100}%. The agent cannot claim, withdraw, transfer, change rules, or change the owner.
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
              <Button variant="ghost" size="sm" onClick={() => setAddLiquidity(item)} disabled={!canTransact || isBusy} style={{ height: 32, fontSize: 11, border: '1px solid rgba(82,227,164,.28)', color: btb.green }}>Add more</Button>
              {item.account.chainId === 4663 && item.policy && <Button variant="success" size="sm" onClick={() => setManualRebalance(item)} disabled={!canTransact || isBusy} style={{ height: 32, fontSize: 11, boxShadow: 'none' }}>Compound / rebalance</Button>}
              {item.account.chainId === 4663 && item.policy && <Button variant="ghost" size="sm" onClick={() => setEditPolicy(item)} disabled={!canTransact || isBusy} style={{ height: 32, fontSize: 11, border: btb.borderSoft }}>Change rules</Button>}
              {item.policy && <Button variant="ghost" size="sm" onClick={() => positionAction(item, 'claim')} disabled={!canTransact || isBusy} style={{ height: 32, fontSize: 11, border: btb.borderSoft }}>Claim fees</Button>}
              {item.policy?.enabled && <Button variant="ghost" size="sm" onClick={() => positionAction(item, 'revoke')} disabled={!canTransact || isBusy} style={{ height: 32, fontSize: 11, border: btb.borderSoft }}>{isBusy ? 'Confirming…' : 'Stop agent'}</Button>}
              <Button variant="ghost" size="sm" onClick={() => positionAction(item, 'withdraw')} disabled={!canTransact || isBusy} style={{ height: 32, fontSize: 11, border: '1px solid rgba(255,179,107,0.28)', color: btb.amber }}>{isBusy ? 'Confirming…' : 'Return NFT to wallet'}</Button>
            </div>
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
        account={address}
        onClose={() => setAddLiquidity(null)}
        onDone={async () => { setAddLiquidity(null); await load(); }}
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
