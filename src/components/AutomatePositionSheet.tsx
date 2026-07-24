'use client';

import { useState } from 'react';
import { useConfig } from 'wagmi';
import { useAction } from 'convex/react';
import { getPublicClient } from 'wagmi/actions';
import { encodeFunctionData } from 'viem';
import { Portal } from './Portal';
import { Button } from './Button';
import { TokenIcon } from './TokenIcon';
import { AutomationRules, DEFAULT_AUTOMATION_RULES, type AutomationRuleValues } from './AutomationRules';
import { btb } from './design-tokens';
import { useSidebar } from '../lib/SidebarContext';
import { useTx } from '../lib/TxTracker';
import { runCalls } from '../lib/txRunner';
import {
  createUniversalWalletCall, getUniversalWalletDeployment, readUniversalWallet, upgradeUniversalWalletCalls,
} from '../lib/universalWallet';
import { configureUniversalLpCalls, readUniversalLpPolicy } from '../lib/universalLp';
import {
  rangeTicks, ROBINHOOD_UNISWAP_V3_DEPLOYMENT,
  type LiquidityPosition,
} from '@/protocols/dexs/uniswap';
import { FACTORY_ABI } from '@/protocols/dexs/uniswap/v3/abis';
import { api } from '../../convex/_generated/api';

const ERC721_OWNER_ABI = [
  { name: 'ownerOf', type: 'function', stateMutability: 'view', inputs: [{ type: 'uint256' }], outputs: [{ type: 'address' }] },
  { name: 'safeTransferFrom', type: 'function', stateMutability: 'nonpayable', inputs: [{ type: 'address' }, { type: 'address' }, { type: 'uint256' }], outputs: [] },
] as const;

export function AutomatePositionSheet({ pos, account, onClose, onDone }: {
  pos: LiquidityPosition;
  account: `0x${string}`;
  onClose: () => void;
  onDone: () => void | Promise<void>;
}) {
  const { width: sidebarWidth, isMobile } = useSidebar();
  const config = useConfig();
  const { track } = useTx();
  const registerManaged = useAction(api.managedPositionMonitor.register);
  const chainId = pos.chainId ?? 1;
  const deployment = ROBINHOOD_UNISWAP_V3_DEPLOYMENT;
  const smartDeployment = chainId === 4663 ? getUniversalWalletDeployment() : null;
  const [rules, setRules] = useState<AutomationRuleValues>({
    ...DEFAULT_AUTOMATION_RULES,
    twapSeconds: chainId === 4663 ? 60 : 300,
  });
  const [slippageBps, setSlippageBps] = useState(chainId === 4663 ? 500 : 50);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function enroll() {
    if (!smartDeployment || chainId !== 4663 || pos.protocol !== 'uniswap-v3') return;
    const client = getPublicClient(config, { chainId });
    if (!client) { setErr('No RPC client'); return; }
    setBusy(true); setErr(null);
    try {
      let smart = await readUniversalWallet(client, account, smartDeployment);
      const pool = await client.readContract({
        address: deployment.factory, abi: FACTORY_ABI, functionName: 'getPool', args: [pos.token0, pos.token1, pos.fee],
      });
      const spacing = deployment.tickSpacings[pos.fee];
      if (!spacing || pool === '0x0000000000000000000000000000000000000000') throw new Error('This pool is not supported by the deployed V3 factory.');
      const allowedPct = rules.allowedRangePct !== null && rules.allowedRangePct < rules.targetRangePct ? rules.targetRangePct : rules.allowedRangePct;
      const allowed = rangeTicks(pos.currentTick, spacing, allowedPct);
      const target = rangeTicks(pos.currentTick, spacing, rules.targetRangePct);
      const expiresAt = BigInt(Math.floor(Date.now() / 1000) + rules.expiryDays * 86_400);
      const targetTickWidth = target.tickUpper - target.tickLower;
      const minimumAllowedTick = Math.min(allowed.tickLower, pos.tickLower);
      const maximumAllowedTick = Math.max(allowed.tickUpper, pos.tickUpper);

      if (!smart.deployed) {
        await runCalls(config, {
          account, chainId, label: `Create my ${pos.chainName ?? 'LP'} account`, track,
          calls: [createUniversalWalletCall(smartDeployment, account)],
          verify: {
            test: async () => (await readUniversalWallet(client, account, smartDeployment)).deployed,
            error: 'Account creation confirmed, but the contract is not visible from this RPC yet.',
          },
        });
        smart = await readUniversalWallet(client, account, smartDeployment);
      }
      if (!smart.upgraded) {
        await runCalls(config, {
          account, chainId, label: 'Upgrade my BTB account for guarded LP automation', track,
          calls: upgradeUniversalWalletCalls(smart.account, smartDeployment.implementation, smart.paused),
          verify: {
            test: async () => (await readUniversalWallet(client, account, smartDeployment)).upgraded,
            error: 'The wallet upgrade confirmed, but the current implementation is not visible yet.',
          },
        });
      }

      const nftOwner = await client.readContract({
        address: deployment.positionManager, abi: ERC721_OWNER_ABI, functionName: 'ownerOf', args: [pos.id],
      });
      if (nftOwner.toLowerCase() !== smart.account.toLowerCase()) {
        if (nftOwner.toLowerCase() !== account.toLowerCase()) {
          throw new Error(`This LP NFT is owned by ${nftOwner.slice(0, 6)}…${nftOwner.slice(-4)}, not the connected wallet.`);
        }
        await runCalls(config, {
          account, chainId, label: `Move ${pos.symbol0}/${pos.symbol1} into my LP account`, track,
          calls: [{
            to: deployment.positionManager,
            data: encodeFunctionData({ abi: ERC721_OWNER_ABI, functionName: 'safeTransferFrom', args: [account, smart.account, pos.id] }),
          }],
          verify: {
            test: async () => (await client.readContract({ address: deployment.positionManager, abi: ERC721_OWNER_ABI, functionName: 'ownerOf', args: [pos.id] })).toLowerCase() === smart.account.toLowerCase(),
            error: 'The NFT transfer confirmed, but its new owner is not visible from this RPC yet.',
          },
        });
      }

      const policyCalls = await configureUniversalLpCalls({
        client, account: smart.account, deployment: smartDeployment,
        positionManager: deployment.positionManager, pool, token0: pos.token0, token1: pos.token1, fee: pos.fee,
        targetTickWidth, maximumSlippageBps: slippageBps,
        maximumToken0PerRebalance: (pos.amount0 + pos.fees0) * BigInt(rules.maxSwapPct * 100) / 10_000n,
        maximumToken1PerRebalance: (pos.amount1 + pos.fees1) * BigInt(rules.maxSwapPct * 100) / 10_000n,
        minimumTick: minimumAllowedTick, maximumTick: maximumAllowedTick, expiresAt,
      });
      await runCalls(config, {
        account, chainId, label: `Save guarded ${pos.symbol0}/${pos.symbol1} automation`, track,
        calls: policyCalls,
        verify: {
          test: async () => !!(await readUniversalLpPolicy(client, smart.account, pos.token0, pos.token1, pos.fee)),
          error: 'The automation transaction confirmed, but the guard policy is not visible yet.',
        },
      });
      await registerManaged({
        chainId, owner: account, account: smart.account, positionManager: deployment.positionManager,
        positionId: pos.id.toString(), pool, token0: pos.token0, token1: pos.token1, fee: pos.fee,
        tickLower: pos.tickLower, tickUpper: pos.tickUpper,
        targetTickWidth, minimumAllowedTick, maximumAllowedTick, maxSlippageBps: slippageBps,
        maxSwapBps: rules.maxSwapPct * 100, twapSeconds: rules.twapSeconds,
        minRebalanceInterval: rules.intervalSeconds, expiresAt: Number(expiresAt), source: 'universal-v5',
      });
      await onDone();
      onClose();
    } catch (e) {
      setErr((e as { shortMessage?: string })?.shortMessage ?? (e as Error)?.message ?? 'Failed');
    } finally { setBusy(false); }
  }

  return (
    <Portal>
      <div style={{ position: 'fixed', inset: 0, left: sidebarWidth, zIndex: 390, background: 'rgba(5,5,9,0.78)', backdropFilter: 'blur(10px)', display: 'flex', justifyContent: 'flex-end' }} onMouseDown={onClose}>
        <div onMouseDown={(event) => event.stopPropagation()} style={{ width: isMobile ? '100%' : 480, height: '100%', overflowY: 'auto', background: btb.bg, borderLeft: btb.borderSoft, padding: isMobile ? '18px 14px 96px' : '24px 22px 40px', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
            <div>
              <div style={{ color: btb.text, fontSize: 19, fontWeight: 850 }}>Auto-manage position</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: btb.textMuted, fontSize: 12, marginTop: 4 }}>
                <TokenIcon symbol={pos.symbol0} size={18}/><TokenIcon symbol={pos.symbol1} size={18}/>
                {pos.symbol0} / {pos.symbol1} · {pos.chainName ?? 'Ethereum'}
              </div>
            </div>
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 999, border: btb.borderSoft, background: 'rgba(255,255,255,0.06)', color: btb.textMuted, cursor: 'pointer', fontSize: 18 }}>×</button>
          </div>

          <div style={{ color: btb.textMuted, fontSize: 12, lineHeight: 1.55, padding: 12, borderRadius: 12, background: 'rgba(255,255,255,0.035)', border: btb.borderSoft, marginBottom: 12 }}>
            The NFT moves into the same universal smart account used by BTB trading. The agent can only remove, safely swap and re-add this pool inside the range limits you sign. It cannot transfer the NFT or withdraw funds.
          </div>

          {smartDeployment ? (
            <AutomationRules value={rules} onChange={setRules} agent={smartDeployment.agent} slippageBps={slippageBps} onSlippageChange={setSlippageBps} disabled={busy}/>
          ) : (
            <div style={{ color: btb.amber, fontSize: 12, padding: 12, borderRadius: 12, background: 'rgba(255,179,107,0.08)', border: '1px solid rgba(255,179,107,0.2)' }}>
              Guarded LP automation currently supports Uniswap V3 on Robinhood Chain.
            </div>
          )}
          {err && <div style={{ color: btb.loss, fontSize: 12, marginTop: 12, lineHeight: 1.45 }}>{err}</div>}
          <Button variant="success" size="md" onClick={enroll} disabled={busy || !smartDeployment} style={{ marginTop: 14, fontWeight: 800 }}>
            {busy ? 'Checking each confirmed step…' : 'Move to my account & enable'}
          </Button>
          <div style={{ color: btb.textDim, textAlign: 'center', fontSize: 10.5, lineHeight: 1.45, marginTop: 9 }}>
            First enrollment may create your universal account, transfer the NFT, then install its guarded pool policy. Every rebalance is one atomic agent transaction.
          </div>
        </div>
      </div>
    </Portal>
  );
}
