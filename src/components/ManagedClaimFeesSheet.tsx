'use client';

import { useEffect, useMemo, useState } from 'react';
import { useConfig } from 'wagmi';
import { getPublicClient } from 'wagmi/actions';
import { encodeFunctionData, erc20Abi, formatUnits, isAddress, zeroAddress } from 'viem';
import { Portal } from './Portal';
import { Button } from './Button';
import { btb } from './design-tokens';
import { useTx } from '../lib/TxTracker';
import { runCalls } from '../lib/txRunner';
import { buildProtectedKyberSwap, protectedV3Path } from '../lib/managedTokenRoutes';
import { BTB_LP_ACCOUNT_ABI, UINT128_MAX, type RebalancePolicy, type SmartAccountDeployment } from '../lib/smartAccount';
import { NPM_ABI } from '@/protocols/dexs/uniswap/v3/abis';
import { ROBINHOOD_WETH, WETH, type LiquidityPosition, type V3Deployment } from '@/protocols/dexs/uniswap';

const ROUTE_GUARD_ABI = [{
  name: 'quoteMinimum', type: 'function', stateMutability: 'view',
  inputs: [{ type: 'bytes' }, { type: 'uint256' }, { type: 'uint32' }, { type: 'uint16' }, { type: 'uint16' }],
  outputs: [{ type: 'address' }, { type: 'address' }, { type: 'uint256' }],
}] as const;

export function ManagedClaimFeesSheet({ pos, policy, owner, account, deployment, v3, onClose, onDone }: {
  pos: LiquidityPosition;
  policy: RebalancePolicy;
  owner: `0x${string}`;
  account: `0x${string}`;
  deployment: SmartAccountDeployment;
  v3: V3Deployment;
  onClose: () => void;
  onDone: () => void | Promise<void>;
}) {
  const config = useConfig();
  const { track } = useTx();
  const chainId = (pos.chainId ?? 1) as 1 | 4663;
  const [token, setToken] = useState('');
  const [meta, setMeta] = useState<{ symbol: string; decimals: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const validToken = useMemo(() => isAddress(token.trim()) ? token.trim() as `0x${string}` : null, [token]);

  useEffect(() => {
    let cancelled = false; setMeta(null); setError(null);
    if (!validToken) return;
    (async () => {
      const client = getPublicClient(config, { chainId });
      if (!client) throw new Error('RPC unavailable');
      const [symbol, decimals, code] = await Promise.all([
        client.readContract({ address: validToken, abi: erc20Abi, functionName: 'symbol' }),
        client.readContract({ address: validToken, abi: erc20Abi, functionName: 'decimals' }),
        client.getCode({ address: validToken }),
      ]);
      if (!code || code === '0x') throw new Error('No token contract');
      if (!cancelled) setMeta({ symbol, decimals });
    })().catch(() => { if (!cancelled) setError('This payout token is not readable on this chain.'); });
    return () => { cancelled = true; };
  }, [chainId, config, validToken]);

  async function claim() {
    if (!validToken || !meta || !deployment.aggregatorSwapAdapter || !deployment.routeGuard) return;
    setBusy(true); setError(null);
    try {
      const client = getPublicClient(config, { chainId });
      if (!client) throw new Error('RPC unavailable');
      setStage('Reading claimable fees…');
      const [preview, baseline, nonce] = await Promise.all([
        client.simulateContract({
          account, address: v3.positionManager, abi: NPM_ABI, functionName: 'collect',
          args: [{ tokenId: pos.id, recipient: account, amount0Max: UINT128_MAX, amount1Max: UINT128_MAX }],
        }),
        client.readContract({ address: account, abi: BTB_LP_ACCOUNT_ABI, functionName: 'feeBaseline', args: [v3.positionManager, pos.id] }),
        client.readContract({ address: account, abi: BTB_LP_ACCOUNT_ABI, functionName: 'nextNonce' }),
      ]);
      const collected = preview.result as readonly [bigint, bigint];
      const earned0 = collected[0] > baseline[0] ? collected[0] - baseline[0] : 0n;
      const earned1 = collected[1] > baseline[1] ? collected[1] - baseline[1] : 0n;
      const amount0 = collected[0] - earned0 * 1_000n / 10_000n;
      const amount1 = collected[1] - earned1 * 1_000n / 10_000n;
      if (amount0 === 0n && amount1 === 0n) throw new Error('There are no fees ready to claim.');

      setStage('Finding protected price paths…');
      const bridge = chainId === 4663 ? ROBINHOOD_WETH : WETH;
      const [path0, path1] = await Promise.all([
        protectedV3Path(client, v3.factory, pos.token0, validToken, bridge),
        protectedV3Path(client, v3.factory, pos.token1, validToken, bridge),
      ]);
      await Promise.all([
        amount0 > 0n && pos.token0.toLowerCase() !== validToken.toLowerCase()
          ? client.readContract({ address: deployment.routeGuard, abi: ROUTE_GUARD_ABI, functionName: 'quoteMinimum', args: [path0, amount0, policy.twapSeconds, policy.maxSlippageBps, policy.maxSpotTwapDeviationBps] })
          : Promise.resolve(null),
        amount1 > 0n && pos.token1.toLowerCase() !== validToken.toLowerCase()
          ? client.readContract({ address: deployment.routeGuard, abi: ROUTE_GUARD_ABI, functionName: 'quoteMinimum', args: [path1, amount1, policy.twapSeconds, policy.maxSlippageBps, policy.maxSpotTwapDeviationBps] })
          : Promise.resolve(null),
      ]).catch(() => { throw new Error('This token has no healthy V3 TWAP route for a protected payout.'); });
      setStage(`Building ${meta.symbol} payout…`);
      const slippageBps = Number(policy.maxSlippageBps);
      const [swap0, swap1] = await Promise.all([
        buildProtectedKyberSwap({ client, chainId, adapter: deployment.aggregatorSwapAdapter, tokenIn: pos.token0, tokenOut: validToken, amountIn: amount0, outputDecimals: meta.decimals, slippageBps }),
        buildProtectedKyberSwap({ client, chainId, adapter: deployment.aggregatorSwapAdapter, tokenIn: pos.token1, tokenOut: validToken, amountIn: amount1, outputDecimals: meta.decimals, slippageBps }),
      ]);
      const deadline = BigInt(Math.floor(Date.now() / 1_000) + 480);
      setStage('Ready for wallet confirmation…');
      await runCalls(config, {
        account: owner, chainId, track, label: `Claim ${pos.symbol0}/${pos.symbol1} fees as ${meta.symbol}`,
        calls: [
          { to: account, data: encodeFunctionData({ abi: BTB_LP_ACCOUNT_ABI, functionName: 'configureEarnings', args: [v3.positionManager, pos.id, 2, validToken, path0, path1] }) },
          { to: account, data: encodeFunctionData({ abi: BTB_LP_ACCOUNT_ABI, functionName: 'claimAndPayout', args: [v3.positionManager, pos.id, { quotedMinimumOut0: swap0.minimumOut, quotedMinimumOut1: swap1.minimumOut, deadline, nonce }, swap0.swapData, swap1.swapData] }) },
        ],
      });
      await onDone(); onClose();
    } catch (e) { setError((e as { shortMessage?: string })?.shortMessage ?? (e as Error)?.message ?? 'Fee payout failed'); }
    finally { setBusy(false); setStage(''); }
  }

  return <Portal>
    <div onMouseDown={e => { if (e.target === e.currentTarget && !busy) onClose(); }} style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(5,5,10,.72)', backdropFilter: 'blur(10px)', display: 'grid', placeItems: 'center', padding: 14 }}>
      <div style={{ width: 'min(440px,100%)', borderRadius: 20, padding: 18, background: '#17171f', border: btb.border, boxShadow: '0 24px 80px rgba(0,0,0,.5)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <div><div style={{ color: btb.text, fontSize: 16, fontWeight: 850 }}>Claim fees as one token</div><div style={{ color: btb.textMuted, fontSize: 11, marginTop: 3 }}>{pos.symbol0} / {pos.symbol1} · NFT #{pos.id.toString()}</div></div>
          <button onClick={onClose} disabled={busy} style={{ border: 0, background: 'transparent', color: btb.textMuted, fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ marginTop: 15, padding: 12, borderRadius: 13, background: 'rgba(255,255,255,.035)', border: btb.borderSoft }}>
          <div style={{ color: btb.textDim, fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .5 }}>Receive token</div>
          <input value={token} onChange={e => setToken(e.target.value)} placeholder="Token contract 0x…" spellCheck={false} style={{ width: '100%', boxSizing: 'border-box', marginTop: 7, height: 40, borderRadius: 9, border: btb.borderSoft, background: 'rgba(255,255,255,.04)', color: btb.text, padding: '0 10px', fontFamily: 'monospace', outline: 'none' }}/>
          {meta && <div style={{ color: btb.green, fontSize: 11, fontWeight: 800, marginTop: 8 }}>Receive {meta.symbol} in your wallet</div>}
        </div>
        <div style={{ color: btb.textDim, fontSize: 10, lineHeight: 1.5, marginTop: 9 }}>Both fee tokens are sold atomically. The contract checks a liquid Uniswap V3 TWAP route, your slippage limit, the approved router and the fixed wallet recipient. Tokens without a protected route are rejected.</div>
        {stage && <div style={{ color: btb.green, fontSize: 10.5, marginTop: 9 }}>{stage}</div>}
        {error && <div style={{ color: btb.loss, fontSize: 11, lineHeight: 1.4, marginTop: 9 }}>{error}</div>}
        <Button variant="success" onClick={claim} disabled={busy || !meta || !deployment.aggregatorSwapAdapter || !deployment.routeGuard} style={{ width: '100%', marginTop: 13 }}>{busy ? 'Preparing protected payout…' : meta ? `Claim as ${meta.symbol}` : 'Choose payout token'}</Button>
      </div>
    </div>
  </Portal>;
}
