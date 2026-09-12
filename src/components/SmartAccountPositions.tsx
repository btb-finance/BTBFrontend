'use client';

import { useCallback, useEffect, useState } from 'react';
import { useConfig } from 'wagmi';
import { getPublicClient } from 'wagmi/actions';
import { encodeFunctionData } from 'viem';
import { Glass } from './Glass';
import { Badge } from './Badge';
import { useTokenLogos } from '../lib/TokenStore';
import { RangeBar, LpButton, lpBox, lpBoxLabel, lpBoxValue } from './LpCardParts';
import { Button } from './Button';
import { TokenIcon } from './TokenIcon';
import { ChainLogo } from './ChainLogo';
import { AutomatePositionSheet } from './AutomatePositionSheet';
import { btb } from './design-tokens';
import { useSidebar } from '../lib/SidebarContext';
import { useTx } from '../lib/TxTracker';
import { runCalls } from '../lib/txRunner';
import {
  createUniversalWalletCall, getUniversalWalletDeployment, readUniversalWallet, UNIVERSAL_WALLET_ABI,
  type UniversalWalletDeployment,
} from '../lib/universalWallet';
import { readUniversalLpPolicy, UNIVERSAL_LP_WALLET_ABI, withdrawUniversalLpCall, type UniversalLpPolicy } from '../lib/universalLp';
import {
  fetchV3Positions, fmtFeeTier, tickToPrice, ROBINHOOD_UNISWAP_V3_DEPLOYMENT, type LiquidityPosition,
} from '@/protocols/dexs/uniswap';
import { readableError } from '../lib/errorText';

type WalletState = Awaited<ReturnType<typeof readUniversalWallet>> & { deployment: UniversalWalletDeployment };
type ManagedItem = { pos: LiquidityPosition; policy: UniversalLpPolicy | null };

const CHAIN_ID = 4663 as const;
const EXPLORER = 'https://robinhoodchain.blockscout.com/address/';

async function retryLpRead<T>(read: () => Promise<T>): Promise<T> {
  try {
    return await read();
  } catch {
    await new Promise(resolve => setTimeout(resolve, 700));
    return read();
  }
}

function shortAddress(value: string) { return `${value.slice(0, 6)}…${value.slice(-4)}`; }
function fmtAmt(raw: bigint, decimals: number) {
  const n = Number(raw) / 10 ** decimals;
  if (n === 0) return '0';
  if (n < 0.01) return n.toLocaleString('en-US', { maximumSignificantDigits: 3, maximumFractionDigits: 10 });
  return n.toLocaleString('en-US', { maximumFractionDigits: 5 });
}

export function SmartAccountPositions({ address, canTransact, refreshNonce = 0 }: { address: `0x${string}`; canTransact: boolean; refreshNonce?: number }) {
  const config = useConfig();
  const { track } = useTx();
  const { isMobile } = useSidebar();
  const logoFor = useTokenLogos();
  const [wallet, setWallet] = useState<WalletState | null>(null);
  const [positions, setPositions] = useState<ManagedItem[]>([]);
  const [editing, setEditing] = useState<LiquidityPosition | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const deployment = getUniversalWalletDeployment();
      const client = getPublicClient(config, { chainId: CHAIN_ID });
      if (!deployment || !client) { setWallet(null); setPositions([]); return; }
      const state = await readUniversalWallet(client, address, deployment);
      setWallet({ ...state, deployment });
      if (!state.deployed) { setPositions([]); return; }
      const owned = await retryLpRead(() => fetchV3Positions(client, state.account, ROBINHOOD_UNISWAP_V3_DEPLOYMENT));
      const next = await Promise.all(owned.map(async pos => ({
        pos: { ...pos, chainId: CHAIN_ID, chainName: 'Robinhood Chain' },
        policy: await readUniversalLpPolicy(client, state.account, pos.token0, pos.token1, pos.fee).catch(() => null),
      })));
      setPositions(next);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load universal LP positions'); }
    finally { setLoading(false); }
  }, [address, config, refreshNonce]);

  useEffect(() => { void load(); }, [load]);

  async function createWallet() {
    if (!wallet) return;
    setBusy('wallet'); setError(null);
    try {
      await runCalls(config, { account: address, chainId: CHAIN_ID, label: 'Create my universal BTB account', track, calls: [createUniversalWalletCall(wallet.deployment, address)] });
      await load();
    } catch (cause) { setError(readableError(cause, 'That position action could not be completed')); }
    finally { setBusy(null); }
  }

  async function togglePause() {
    if (!wallet?.deployed) return;
    setBusy('wallet'); setError(null);
    try {
      await runCalls(config, { account: address, chainId: CHAIN_ID, label: wallet.paused ? 'Resume account automation' : 'Pause account automation', track, calls: [{ to: wallet.account, data: encodeFunctionData({ abi: UNIVERSAL_WALLET_ABI, functionName: 'setPaused', args: [!wallet.paused] }) }] });
      await load();
    } catch (cause) { setError(readableError(cause, 'That position action could not be completed')); }
    finally { setBusy(null); }
  }

  async function returnNft(item: ManagedItem) {
    if (!wallet?.deployed) return;
    const key = item.pos.id.toString(); setBusy(key); setError(null);
    try {
      await runCalls(config, { account: address, chainId: CHAIN_ID, label: `Return ${item.pos.symbol0}/${item.pos.symbol1} NFT`, track, calls: [withdrawUniversalLpCall(wallet.account, ROBINHOOD_UNISWAP_V3_DEPLOYMENT.positionManager, item.pos.id)] });
      await load();
    } catch (cause) { setError(readableError(cause, 'That position action could not be completed')); }
    finally { setBusy(null); }
  }

  if (!wallet && !loading) return null;
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
    <Glass padding={isMobile ? 12 : 15} radius={16} soft>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <div style={{ color: btb.text, fontSize: 13.5, fontWeight: 850 }}>Universal LP account</div>
          <div style={{ color: btb.textMuted, fontSize: 10.5, marginTop: 3 }}>An owner-only smart account that holds and automates your LP NFTs.</div>
        </div>
        {wallet && <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <ChainLogo chainId={CHAIN_ID} size={18}/>
          <a href={`${EXPLORER}${wallet.account}`} target="_blank" rel="noopener noreferrer" style={{ color: btb.textMuted, fontSize: 10.5, textDecoration: 'none' }}>{shortAddress(wallet.account)}</a>
          <Badge size="sm" border="none" bg={wallet.deployed ? wallet.paused ? 'rgba(255,179,107,.13)' : 'rgba(82,227,164,.13)' : 'rgba(255,255,255,.06)'} color={wallet.deployed ? wallet.paused ? btb.amber : btb.green : btb.textDim}>{wallet.deployed ? wallet.paused ? 'Paused' : 'Active' : 'Not created'}</Badge>
        </div>}
      </div>
      {wallet && <div style={{ display: 'flex', gap: 7, marginTop: 10 }}>
        {!wallet.deployed ? <Button variant="success" size="sm" onClick={createWallet} disabled={!canTransact || busy === 'wallet'}>{busy === 'wallet' ? 'Creating…' : 'Create account'}</Button>
          : <Button variant="ghost" size="sm" onClick={togglePause} disabled={!canTransact || busy === 'wallet'}>{busy === 'wallet' ? 'Confirming…' : wallet.paused ? 'Resume automation' : 'Pause automation'}</Button>}
      </div>}
      {error && <div style={{ color: btb.loss, fontSize: 11, marginTop: 9, lineHeight: 1.4 }}>{error}</div>}
      {loading && <div style={{ color: btb.textDim, fontSize: 10.5, marginTop: 9 }}>Refreshing account and NFT state…</div>}
    </Glass>

    {positions.map(item => {
      const p = item.pos, policy = item.policy;
      const active = !!policy?.enabled && !wallet?.paused && Number(policy.expiresAt) > Date.now() / 1000;
      const hasFees = p.fees0 > 0n || p.fees1 > 0n;
      const box = lpBox(isMobile);
      const boxValue = lpBoxValue(isMobile);
      const logo0 = logoFor(p.token0, CHAIN_ID, p.symbol0);
      const logo1 = logoFor(p.token1, CHAIN_ID, p.symbol1);
      return <Glass key={p.id.toString()} padding={isMobile ? 14 : 18} radius={20}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ display: 'flex', flexShrink: 0 }}><TokenIcon symbol={p.symbol0} size={32} logoUrl={logo0}/><div style={{ marginLeft: -10 }}><TokenIcon symbol={p.symbol1} size={32} logoUrl={logo1}/></div></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ color: btb.text, fontWeight: 800, fontSize: 16 }}>{p.symbol0}/{p.symbol1}</span>
              <Badge size="sm" color={btb.textMuted} bg={btb.surfaceSoft} border="none" style={{ fontSize: 11, padding: '2px 7px' }}>{fmtFeeTier(p.fee)}</Badge>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
              <span style={{ color: btb.textDim, fontSize: 11.5 }}>#{p.id.toString()}</span>
              <Badge size="sm" border="none" bg={p.inRange ? 'rgba(82,227,164,.14)' : 'rgba(255,179,107,.14)'} color={p.inRange ? btb.green : btb.amber} style={{ whiteSpace: 'nowrap' }}>{p.inRange ? 'In range' : 'Out of range'}</Badge>
              <ChainLogo chainId={CHAIN_ID} size={15}/>
            </div>
          </div>
          <Badge size="sm" border="none" bg={active ? 'rgba(82,227,164,.14)' : 'rgba(255,255,255,.06)'} color={active ? btb.green : btb.textDim} style={{ whiteSpace: 'nowrap', padding: '3px 9px' }}>{active ? 'Automated' : policy ? 'Stopped' : 'Manual'}</Badge>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(3, minmax(0, 1fr))', gap: 8, marginTop: 14 }}>
          <div style={box}><div style={lpBoxLabel}><TokenIcon symbol={p.symbol0} size={16} logoUrl={logo0}/>{p.symbol0}</div><div style={boxValue}>{fmtAmt(p.amount0, p.decimals0)}</div></div>
          <div style={box}><div style={lpBoxLabel}><TokenIcon symbol={p.symbol1} size={16} logoUrl={logo1}/>{p.symbol1}</div><div style={boxValue}>{fmtAmt(p.amount1, p.decimals1)}</div></div>
          <div style={{ ...box, gridColumn: isMobile ? '1 / -1' : undefined, background: hasFees ? 'rgba(82,227,164,0.07)' : box.background, border: hasFees ? '1px solid rgba(82,227,164,0.22)' : box.border }}>
            <div style={lpBoxLabel}>Unclaimed fees</div>
            <div style={{ ...boxValue, color: hasFees ? btb.green : btb.textDim }}>{hasFees ? `${fmtAmt(p.fees0, p.decimals0)} ${p.symbol0}` : 'None yet'}</div>
            {hasFees && <div style={{ color: 'rgba(82,227,164,0.75)', fontSize: 11.5, marginTop: 2 }}>+ {fmtAmt(p.fees1, p.decimals1)} {p.symbol1}</div>}
          </div>
        </div>
        <div style={{ ...box, marginTop: 8 }}><RangeBar p={p}/></div>
        {policy && <div style={{ ...box, marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: '6px 14px', background: active ? 'rgba(82,227,164,.05)' : box.background }}>
          <span style={{ color: active ? btb.green : btb.textDim, fontSize: 12, fontWeight: 800 }}>{active ? 'Guarded automation on' : 'Automation stopped'}</span>
          <span style={{ color: btb.textMuted, fontSize: 12 }}>Slippage up to {policy.maximumSlippageBps / 100}%</span>
          <span style={{ color: btb.textMuted, fontSize: 12 }}>Target {policy.targetTickWidth.toLocaleString()} ticks</span>
          <span style={{ color: btb.textMuted, fontSize: 12 }}>Allowed {policy.minimumTick.toLocaleString()} to {policy.maximumTick.toLocaleString()}</span>
        </div>}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, marginTop: 12 }}>
          <LpButton full tone="green" solid={!policy} icon="bolt" label={policy ? 'Change range rules' : 'Enable automation'} onClick={() => setEditing(p)} disabled={!canTransact || busy === p.id.toString()}/>
          <LpButton full label="Add / compound" onClick={() => {}} disabled/>
          <LpButton full tone="amber" icon="down" label={busy === p.id.toString() ? 'Confirming…' : 'Return NFT'} onClick={() => returnNft(item)} disabled={!canTransact || busy === p.id.toString()}/>
        </div>
      </Glass>;
    })}
    {wallet?.deployed && positions.length === 0 && !loading && !error && <Glass padding={14} radius={16} soft><div style={{ color: btb.text, fontSize: 12.5, fontWeight: 800 }}>No LP NFTs in this account</div><div style={{ color: btb.textMuted, fontSize: 10.5, marginTop: 3 }}>Enable automation from any Robinhood Uniswap V3 position in your portfolio. It will move into {shortAddress(wallet.account)}.</div></Glass>}
    {editing && <AutomatePositionSheet
      pos={editing}
      account={address}
      onClose={() => setEditing(null)}
      onDone={async () => { setEditing(null); await load(); }}
    />}
  </div>;
}
