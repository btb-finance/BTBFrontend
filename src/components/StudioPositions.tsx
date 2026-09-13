'use client';
import { useEffect, useState } from 'react';
import { useConnection, useConfig } from 'wagmi';
import { getPublicClient } from 'wagmi/actions';
import { formatUnits } from 'viem';
import { Badge } from './Badge';
import { Icon } from './Icon';
import { btb } from './design-tokens';
import { useTokenStore, useTokenLogos } from '../lib/TokenStore';
import { ChainLogo } from './ChainLogo';
import { TokenIcon } from './TokenIcon';
import { Glass } from './Glass';
import { useSidebar } from '../lib/SidebarContext';
import { RangeBar, LpButton, lpBox, lpBoxLabel, lpBoxValue } from './LpCardParts';
import {
  BTB_CHAIN_ID, fetchStudioLp, positionAmounts,
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
  const { isMobile } = useSidebar();
  const logoFor = useTokenLogos();
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

  const fmtA = (v: number) => v === 0 ? '0' : v >= 1000 ? v.toLocaleString('en-US', { maximumFractionDigits: 2 })
    : v >= 0.01 ? v.toLocaleString('en-US', { maximumFractionDigits: 4 }) : v.toLocaleString('en-US', { maximumSignificantDigits: 3, maximumFractionDigits: 10 });
  const fmtB = (v: bigint, dec: number) => fmtA(parseFloat(formatUnits(v, dec)));
  const box = lpBox(isMobile);
  const boxValue = lpBoxValue(isMobile);
  const logo0 = logoFor(snap.strategy.token0, BTB_CHAIN_ID, snap.sym0);
  const logo1 = logoFor(snap.strategy.token1, BTB_CHAIN_ID, snap.sym1);

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
          const hasFees = p.fees0 > 0n || p.fees1 > 0n;
          const open = p.liquidity > 0n;
          return (
            <Glass key={p.id.toString()} padding={isMobile ? 14 : 18} radius={20}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ display: 'flex', flexShrink: 0 }}>
                  <TokenIcon symbol={snap.sym0} size={32} logoUrl={logo0} />
                  <div style={{ marginLeft: -10 }}><TokenIcon symbol={snap.sym1} size={32} logoUrl={logo1} /></div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ color: btb.text, fontWeight: 800, fontSize: 16 }}>{snap.sym0}/{snap.sym1}</span>
                    <Badge size="sm" color={btb.textMuted} bg={btb.surfaceSoft} border="none" style={{ fontSize: 11, padding: '2px 7px' }}>{snap.strategy.fee / 10000}%</Badge>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                    <span style={{ color: btb.textDim, fontSize: 11.5 }}>#{p.id.toString()}</span>
                    {open ? (
                      <Badge size="sm" border="none" bg={inRange ? 'rgba(var(--green-rgb), 0.14)' : 'rgba(var(--amber-rgb), 0.14)'} color={inRange ? btb.green : btb.amber} style={{ whiteSpace: 'nowrap' }}>{inRange ? 'In range' : 'Out of range'}</Badge>
                    ) : <Badge size="sm" border="none" bg={btb.surfaceSoft} color={btb.textDim}>Closed</Badge>}
                    <ChainLogo chainId={4663} size={15}/>
                    <Badge size="sm" color={btb.green} bg="rgba(var(--green-rgb), 0.12)" border="none" style={{ fontSize: 10, padding: '1px 6px' }}>Smart account</Badge>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(3, minmax(0, 1fr))', gap: 8, marginTop: 14 }}>
                <div style={box}>
                  <div style={lpBoxLabel}><TokenIcon symbol={snap.sym0} size={16} logoUrl={logo0}/>{snap.sym0}</div>
                  <div style={boxValue}>{fmtA(amt0)}</div>
                </div>
                <div style={box}>
                  <div style={lpBoxLabel}><TokenIcon symbol={snap.sym1} size={16} logoUrl={logo1}/>{snap.sym1}</div>
                  <div style={boxValue}>{fmtA(amt1)}</div>
                </div>
                <div style={{ ...box, gridColumn: isMobile ? '1 / -1' : undefined, background: hasFees ? 'rgba(var(--green-rgb), 0.07)' : box.background, border: hasFees ? '1px solid rgba(var(--green-rgb), 0.22)' : box.border }}>
                  <div style={lpBoxLabel}>Unclaimed fees</div>
                  <div style={{ ...boxValue, color: hasFees ? btb.green : btb.textDim }}>{hasFees ? `${fmtB(p.fees0, snap.dec0)} ${snap.sym0}` : 'None yet'}</div>
                  {hasFees && <div style={{ color: 'rgba(var(--green-rgb), 0.75)', fontSize: 11.5, marginTop: 2 }}>+ {fmtB(p.fees1, snap.dec1)} {snap.sym1}</div>}
                </div>
              </div>

              {open && (
                <div style={{ ...box, marginTop: 8 }}>
                  <RangeBar p={{ symbol0: snap.sym0, symbol1: snap.sym1, decimals0: snap.dec0, decimals1: snap.dec1, tickLower: p.tickLower, tickUpper: p.tickUpper, currentTick: snap.currentTick, inRange }}/>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, marginTop: 12 }}>
                <LpButton full tone="green" icon="bolt" label="Manage in Agent Studio" onClick={goStudio}/>
              </div>
            </Glass>
          );
        })}
      </div>
    </div>
  );
}
