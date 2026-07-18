'use client';
import { useEffect, useState } from 'react';
import { useConnection, useConfig } from 'wagmi';
import { getPublicClient } from 'wagmi/actions';
import { formatUnits } from 'viem';
import { Badge } from './Badge';
import { Icon } from './Icon';
import { btb } from './design-tokens';
import { useTokenStore } from '../lib/TokenStore';
import { ChainLogo } from './ChainLogo';
import {
  BTB_CHAIN_ID, fetchStudioLp, positionAmounts, sqrtPriceToPrice, tickToPrice,
  type StudioLpSnapshot,
} from '../lib/btbStudio';

/**
 * Read-only portfolio card for the Agent Studio smart account LP positions on
 * Robinhood Chain: token amounts, unclaimed fees, price range, and range
 * status per position, with a link into the studio to manage them.
 */
export function StudioPositions() {
  const { address: connected } = useConnection();
  const { walletAddress } = useTokenStore();
  const owner = (walletAddress ?? connected) as `0x${string}` | undefined;
  const config = useConfig();
  const [snap, setSnap] = useState<StudioLpSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!owner) { setSnap(null); return; }
    const client = getPublicClient(config, { chainId: BTB_CHAIN_ID });
    if (!client) return;
    fetchStudioLp(client, owner)
      .then(s => { if (!cancelled) setSnap(s); })
      .catch(() => { if (!cancelled) setSnap(null); });
    return () => { cancelled = true; };
  }, [owner, config]);

  if (!snap) return null;

  const goStudio = () => {
    window.history.pushState(null, '', '/studio');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const fmtP = (v: number) => v >= 1e9 || v === 0 ? v.toExponential(2)
    : v >= 1000 ? v.toLocaleString('en-US', { maximumFractionDigits: 2 }) : v.toPrecision(5);
  const fmtA = (v: number) => v === 0 ? '0' : v >= 1000 ? v.toLocaleString('en-US', { maximumFractionDigits: 2 }) : v.toPrecision(5);
  const fmtB = (v: bigint, dec: number) => {
    const n = parseFloat(formatUnits(v, dec));
    return fmtA(n);
  };

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 2px 10px' }}>
        <Icon name="bolt" size={14} color={btb.green}/>
        <span style={{ color: btb.text, fontSize: 13.5, fontWeight: 800 }}>Smart Account LP</span>
        <span title="Robinhood Chain" aria-label="Robinhood Chain" style={{ display: 'inline-flex', alignItems: 'center' }}>
          <ChainLogo chainId={4663} size={17}/>
        </span>
        <div style={{ flex: 1 }}/>
        <span onClick={goStudio} style={{
          color: btb.green, fontSize: 12, fontWeight: 700, cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 4,
        }}>
          Manage in Agent Studio <Icon name="arrow" size={11} color={btb.green}/>
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {snap.positions.map(p => {
          const inRange = snap.currentTick >= p.tickLower && snap.currentTick < p.tickUpper;
          const [rawA0, rawA1] = positionAmounts(p.liquidity, snap.sqrtPriceX96, p.tickLower, p.tickUpper);
          const amt0 = rawA0 / 10 ** snap.dec0;
          const amt1 = rawA1 / 10 ** snap.dec1;
          const pLow = tickToPrice(p.tickLower, snap.dec0, snap.dec1);
          const pHigh = tickToPrice(p.tickUpper, snap.dec0, snap.dec1);
          const pNow = sqrtPriceToPrice(snap.sqrtPriceX96, snap.dec0, snap.dec1);
          const fullRange = p.tickLower <= -887200 && p.tickUpper >= 887200;
          const hasFees = p.fees0 > 0n || p.fees1 > 0n;
          return (
            <div key={p.id.toString()} style={{
              background: btb.surfaceSoft, border: btb.borderSoft, borderRadius: 14, padding: '12px 14px',
              display: 'flex', flexDirection: 'column', gap: 10,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ color: btb.text, fontSize: 13.5, fontWeight: 800 }}>
                  {snap.sym0} / {snap.sym1} #{p.id.toString()}
                </span>
                <Badge size="sm" color={btb.textDim}>{snap.strategy.fee / 10000}%</Badge>
                {p.liquidity > 0n ? (inRange
                  ? <Badge size="sm" color={btb.green} bg="rgba(82,227,164,0.12)" border="1px solid rgba(82,227,164,0.35)">In range, earning</Badge>
                  : <Badge size="sm" color="#FFB36B" bg="rgba(255,179,107,0.12)" border="1px solid rgba(255,179,107,0.35)">Out of range</Badge>
                ) : <Badge size="sm" color={btb.textDim}>Closed</Badge>}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
                <div>
                  <div style={{ color: btb.textDim, fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>In position</div>
                  <div style={{ color: btb.text, fontSize: 12.5, fontWeight: 600, marginTop: 3 }}>
                    {fmtA(amt0)} {snap.sym0}<br/>{fmtA(amt1)} {snap.sym1}
                  </div>
                </div>
                <div>
                  <div style={{ color: btb.textDim, fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>Unclaimed fees</div>
                  <div style={{ color: hasFees ? btb.green : btb.textMuted, fontSize: 12.5, fontWeight: 700, marginTop: 3 }}>
                    {fmtB(p.fees0, snap.dec0)} {snap.sym0}<br/>{fmtB(p.fees1, snap.dec1)} {snap.sym1}
                  </div>
                </div>
                <div>
                  <div style={{ color: btb.textDim, fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>Range, {snap.sym1} per {snap.sym0}</div>
                  <div style={{ color: btb.text, fontSize: 12.5, fontWeight: 600, marginTop: 3 }}>
                    {fullRange ? 'Full range' : <>{fmtP(pLow)} to {fmtP(pHigh)}</>}
                  </div>
                </div>
                <div>
                  <div style={{ color: btb.textDim, fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>Current price</div>
                  <div style={{ color: btb.text, fontSize: 12.5, fontWeight: 600, marginTop: 3 }}>
                    {fmtP(pNow)} {snap.sym1}
                  </div>
                </div>
              </div>

              {p.liquidity > 0n && !fullRange && p.tickUpper > p.tickLower && (
                <div style={{ position: 'relative', height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.08)' }}>
                  <div style={{
                    position: 'absolute', top: 0, bottom: 0, left: '15%', right: '15%',
                    borderRadius: 999, background: inRange ? 'rgba(82,227,164,0.35)' : 'rgba(255,179,107,0.3)',
                  }}/>
                  <div style={{
                    position: 'absolute', top: -3, width: 2, height: 12, borderRadius: 2, background: '#fff',
                    left: `${Math.max(2, Math.min(98, 15 + 70 * (snap.currentTick - p.tickLower) / (p.tickUpper - p.tickLower)))}%`,
                  }}/>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
