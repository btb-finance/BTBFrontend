'use client';
import { useEffect, useState } from 'react';
import { useConnection, useConfig } from 'wagmi';
import { encodeFunctionData, formatUnits } from 'viem';
import { Glass } from './Glass';
import { LpButton } from './LpCardParts';
import { btb } from './design-tokens';
import { useTx } from '../lib/TxTracker';
import { runCalls } from '../lib/txRunner';
import { fetchMerklClaims, MERKL_DISTRIBUTOR, MERKL_DISTRIBUTOR_ABI, type MerklClaim } from '../lib/merkl';
import { LP_CHAINS, LP_CHAIN_NAMES } from '@/protocols/lpChains';

/**
 * Merkl rewards the viewed wallet can claim, grouped by chain, with one
 * claim transaction per chain (the Distributor takes every token at once).
 */
export function MerklRewards({ address }: { address?: string }) {
  const { address: connected } = useConnection();
  const config = useConfig();
  const { track } = useTx();
  const [claims, setClaims] = useState<MerklClaim[]>([]);
  const [busy, setBusy] = useState<number | null>(null);
  const [nonce, setNonce] = useState(0);
  const canTransact = !!connected && !!address && connected.toLowerCase() === address.toLowerCase();

  useEffect(() => {
    if (!address) { setClaims([]); return; }
    let live = true;
    Promise.all(LP_CHAINS.map((c) => fetchMerklClaims(address, c).catch(() => [] as MerklClaim[])))
      .then((all) => { if (live) setClaims(all.flat()); });
    return () => { live = false; };
  }, [address, nonce]);

  const byChain = new Map<number, MerklClaim[]>();
  for (const c of claims) byChain.set(c.chainId, [...(byChain.get(c.chainId) ?? []), c]);
  if (byChain.size === 0) return null;

  async function claim(chainId: number, rows: MerklClaim[]) {
    if (!connected || !canTransact) return;
    const claimable = rows.filter((r) => r.claimable > 0n);
    if (claimable.length === 0) return;
    setBusy(chainId);
    try {
      const data = encodeFunctionData({ abi: MERKL_DISTRIBUTOR_ABI, functionName: 'claim', args: [
        claimable.map(() => connected as `0x${string}`), claimable.map((r) => r.token), claimable.map((r) => r.amount), claimable.map((r) => r.proofs),
      ] });
      await runCalls(config, { account: connected as `0x${string}`, calls: [{ to: MERKL_DISTRIBUTOR, data }], label: `Claim Merkl rewards on ${LP_CHAIN_NAMES[chainId as keyof typeof LP_CHAIN_NAMES] ?? chainId}`, track, chainId });
      setNonce((n) => n + 1);
    } catch { /* surfaced by the tx pill */ } finally { setBusy(null); }
  }

  return (
    <Glass padding={14} radius={16} soft>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
        <span style={{ color: btb.text, fontSize: 12.5, fontWeight: 800 }}>Merkl rewards</span>
        <span style={{ color: btb.textDim, fontSize: 10.5 }}>Extra incentives paid to LPs in campaign pools</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[...byChain.entries()].map(([chainId, rows]) => {
          const usd = rows.reduce((s, r) => s + (r.usd ?? 0), 0);
          const anyClaimable = rows.some((r) => r.claimable > 0n);
          return (
            <div key={chainId} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '9px 10px', borderRadius: 10, background: 'rgba(var(--fg-rgb), 0.035)' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ color: btb.text, fontSize: 12, fontWeight: 750 }}>{LP_CHAIN_NAMES[chainId as keyof typeof LP_CHAIN_NAMES] ?? `Chain ${chainId}`}{usd > 0 ? ` · $${usd.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : ''}</div>
                <div style={{ color: btb.textMuted, fontSize: 11, marginTop: 2 }}>
                  {rows.map((r) => `${Number(formatUnits(r.claimable, r.decimals)).toLocaleString('en-US', { maximumFractionDigits: 4 })} ${r.symbol}${r.pending > 0n ? ` (+${Number(formatUnits(r.pending, r.decimals)).toLocaleString('en-US', { maximumFractionDigits: 4 })} accruing)` : ''}`).join(', ')}
                </div>
              </div>
              <LpButton tone="green" solid={anyClaimable} label={busy === chainId ? 'Claiming…' : 'Claim'} onClick={() => claim(chainId, rows)} disabled={!anyClaimable || busy != null || !canTransact}/>
            </div>
          );
        })}
      </div>
    </Glass>
  );
}
