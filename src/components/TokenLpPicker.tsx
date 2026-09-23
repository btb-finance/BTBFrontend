'use client';
import { useEffect, useMemo, useState } from 'react';
import { Glass } from './Glass';
import { Portal } from './Portal';
import { Badge } from './Badge';
import { btb } from './design-tokens';
import { useSidebar } from '../lib/SidebarContext';
import {
  mintTarget, poolsForToken, lpAddressesForToken,
  RANGE_APR_PCT, fmtApr, fmtCompactUsd, fmtFeeTier, EarnPool,
} from '../lib/pools';
import { useDiscoverPools, prefetchDiscoverPools } from '../lib/discoverPools';
import type { Token } from '../lib/TokenStore';
import { CreatePosition } from './CreatePosition';
import type { LpChainId } from '../protocols/lpChains';

const MAX_SUGGESTIONS = 8;

/**
 * "Add LP" from a Portfolio token: the best pools from the Discover list that
 * contain the token, ranked by range APR, and one tap opens the add-liquidity
 * sheet for the chosen pool. Native ETH matches both WETH and currency-0 pools.
 */
export function TokenLpPicker({ token, onClose }: { token: Token; onClose: () => void }) {
  const { width: sidebarWidth } = useSidebar();
  const [sheet, setSheet] = useState<EarnPool | null>(null);

  // Pools come from the Discover store the app shell already loaded (the
  // same rows Discover shows, range APRs included); nothing is fetched here
  // unless the store is empty, and then prefetch fills the shared store.
  const { pools: discover, loading } = useDiscoverPools();
  useEffect(() => { prefetchDiscoverPools(); }, []);
  const pools = useMemo(() => {
    if (discover.length === 0) return loading ? null : [];
    // Rank the full candidate set before truncating: slicing first would drop
    // lower-TVL pools that out-earn the big ones on range APR. Same chain as
    // the token, and only pools the app can mint on.
    const chainId = token.chainId ?? 1;
    return poolsForToken(discover, lpAddressesForToken(token.address, token.chainId ?? 1))
      .filter((p) => mintTarget(p)?.chainId === chainId)
      .sort((a, b) => (b.aprRange ?? b.apy) - (a.aprRange ?? a.apy))
      .slice(0, MAX_SUGGESTIONS);
  }, [discover, loading, token.address, token.chainId]);

  if (sheet) {
    const t = mintTarget(sheet)!;
    return (
      <CreatePosition
        tokenA={t.tokenA}
        tokenB={t.tokenB}
        v4PoolId={t.v4PoolId}
        dex={t.dex}
        chainId={t.chainId}
        initialFee={t.dex === 'aerodrome' ? undefined : sheet.feeTier}
        fees24hUsd={sheet.fees24hUsd ?? (sheet.tvlUsd * sheet.apyBase) / 100 / 365}
        onClose={() => setSheet(null)}
        onDone={onClose}
      />
    );
  }

  return (
    <Portal>
    <div onClick={onClose} style={{ position: 'fixed', top: 0, left: sidebarWidth, right: 0, bottom: 0, zIndex: 330, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', overflowY: 'auto' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, background: 'rgba(var(--bg-rgb), 0.98)', border: '1px solid rgba(var(--fg-rgb), 0.1)', borderRadius: 28, padding: '12px 20px calc(32px + env(safe-area-inset-bottom, 0px))', maxHeight: '80vh', overflowY: 'auto' }}>
        <div style={{ color: btb.text, fontSize: 19, fontWeight: 800, letterSpacing: -0.4 }}>Put your {token.symbol} to work</div>
        <div style={{ color: btb.textMuted, fontSize: 13, marginTop: 2, marginBottom: 16 }}>
          Best pools for your {token.symbol} · pick one to add liquidity
        </div>

        {!pools && <div style={{ color: btb.textDim, fontSize: 13, padding: '8px 0' }}>Loading pools…</div>}
        {pools && pools.length === 0 && (
          <div style={{ color: btb.textMuted, fontSize: 13, padding: '8px 0' }}>
            No pool the app can mint on was found for {token.symbol} on this chain yet.
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
                      <Badge size="sm" color={btb.textMuted} bg="rgba(var(--fg-rgb), 0.08)" border="none">{fmtFeeTier(p.feeTier)}</Badge>
                    )}
                    {p.version && (
                      <Badge size="sm" color="#FF007A" bg="rgba(255,0,122,0.12)" border="none">{p.version}</Badge>
                    )}
                  </div>
                  <div style={{ color: btb.textMuted, fontSize: 11, marginTop: 3 }}>
                    {fmtCompactUsd(p.tvlUsd)} TVL · {fmtCompactUsd(p.volume24hUsd ?? 0)} vol 24h
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ color: 'var(--btb-green)', fontSize: 15, fontWeight: 800 }}>{fmtApr(p.aprRange ?? p.apy)}</div>
                  <div style={{ color: btb.textMuted, fontSize: 10 }}>
                    {p.requiresStaking
                      ? `stake LP · ${(p.rewardTokenSymbols ?? ['gauge']).join(' + ')}`
                      : p.aprRange !== undefined ? `±${RANGE_APR_PCT}% range APR` : 'pool APR'}
                  </div>
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
