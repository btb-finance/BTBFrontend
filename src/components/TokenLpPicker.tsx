'use client';
import { useEffect, useState } from 'react';
import { useConfig } from 'wagmi';
import { getPublicClient } from 'wagmi/actions';
import { Glass } from './Glass';
import { Portal } from './Portal';
import { btb } from './design-tokens';
import {
  getEarnPools, addRangeAprs, mintTarget, poolsForToken, lpAddressesForToken,
  RANGE_APR_PCT, fmtApr, fmtCompactUsd, fmtFeeTier, EarnPool,
} from '../lib/pools';
import type { Token } from '../lib/TokenStore';
import { CreatePosition } from './CreatePosition';

const MAX_SUGGESTIONS = 8;

/**
 * "Add LP" from a Portfolio token: finds the best Uniswap V3/V4 and
 * PancakeSwap V3 pools that contain the token (ranked by ±5% range APR,
 * upgraded live from on-chain liquidity), and one tap opens the add-liquidity
 * sheet for the chosen pool. Native ETH matches both WETH and currency-0 pools.
 */
export function TokenLpPicker({ token, onClose }: { token: Token; onClose: () => void }) {
  const config = useConfig();
  const [pools, setPools] = useState<EarnPool[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<EarnPool | null>(null);

  useEffect(() => {
    let live = true;
    const byApr = (a: EarnPool, b: EarnPool) => (b.aprRange ?? b.apy) - (a.aprRange ?? a.apy);
    getEarnPools()
      .then((all) => {
        if (!live) return;
        const mine = poolsForToken(all, lpAddressesForToken(token.address))
          .filter((p) => mintTarget(p) !== null)
          .slice(0, MAX_SUGGESTIONS);
        setPools([...mine].sort(byApr));
        const client = getPublicClient(config);
        if (client && mine.length > 0) {
          addRangeAprs(client, mine)
            .then((ep) => { if (live) setPools([...ep].sort(byApr)); })
            .catch(() => {});
        }
      })
      .catch((e: Error) => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [token.address, config]);

  if (sheet) {
    const t = mintTarget(sheet)!;
    return (
      <CreatePosition
        tokenA={t.tokenA}
        tokenB={t.tokenB}
        v4PoolId={t.v4PoolId}
        dex={t.dex}
        initialFee={sheet.feeTier}
        fees24hUsd={sheet.fees24hUsd ?? (sheet.tvlUsd * sheet.apyBase) / 100 / 365}
        onClose={() => setSheet(null)}
        onDone={onClose}
      />
    );
  }

  return (
    <Portal>
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 330, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, background: 'rgba(10,10,15,0.98)', borderTop: '1px solid rgba(255,255,255,0.1)', borderRadius: '28px 28px 0 0', padding: '12px 20px calc(32px + env(safe-area-inset-bottom, 0px))', maxHeight: '80vh', overflowY: 'auto' }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.18)', margin: '0 auto 16px' }}/>
        <div style={{ color: btb.text, fontSize: 19, fontWeight: 800, letterSpacing: -0.4 }}>Put your {token.symbol} to work</div>
        <div style={{ color: btb.textMuted, fontSize: 13, marginTop: 2, marginBottom: 16 }}>
          Best pools for your {token.symbol} · pick one to add liquidity
        </div>

        {error && <div style={{ color: btb.loss, fontSize: 13, padding: '8px 0' }}>Couldn&apos;t load pools — {error}</div>}
        {!pools && !error && <div style={{ color: btb.textDim, fontSize: 13, padding: '8px 0' }}>Finding pools…</div>}
        {pools && pools.length === 0 && (
          <div style={{ color: btb.textMuted, fontSize: 13, padding: '8px 0' }}>
            No active Uniswap pool found for {token.symbol} on Ethereum yet.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(pools ?? []).map((p) => (
            <Glass key={p.id} padding={12} radius={14} onClick={() => setSheet(p)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <span style={{ color: btb.text, fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.pair}</span>
                    {p.feeTier !== undefined && (
                      <span style={{ flexShrink: 0, color: btb.textMuted, fontSize: 10, fontWeight: 700, background: 'rgba(255,255,255,0.08)', padding: '1px 6px', borderRadius: 999 }}>{fmtFeeTier(p.feeTier)}</span>
                    )}
                    {p.version && (
                      <span style={{ flexShrink: 0, color: '#FF007A', fontSize: 10, fontWeight: 700, background: 'rgba(255,0,122,0.12)', padding: '1px 6px', borderRadius: 999 }}>{p.version}</span>
                    )}
                  </div>
                  <div style={{ color: btb.textMuted, fontSize: 11, marginTop: 3 }}>
                    {fmtCompactUsd(p.tvlUsd)} TVL · {fmtCompactUsd(p.volume24hUsd ?? 0)} vol 24h
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ color: '#52E3A4', fontSize: 15, fontWeight: 800 }}>{fmtApr(p.aprRange ?? p.apy)}%</div>
                  <div style={{ color: btb.textMuted, fontSize: 10 }}>{p.aprRange !== undefined ? `±${RANGE_APR_PCT}% range APR` : 'pool APR'}</div>
                </div>
                <span style={{ color: btb.textDim, fontSize: 16, fontWeight: 700 }}>›</span>
              </div>
            </Glass>
          ))}
        </div>
      </div>
    </div>
    </Portal>
  );
}
