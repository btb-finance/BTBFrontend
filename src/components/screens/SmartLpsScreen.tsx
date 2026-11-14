'use client';
/**
 * Smart LPs: the LPs who stayed in range and beat just holding, across every
 * pool the daily job tracks (convex/smartLpsActions.ts), best first. "Copy
 * range" opens Add LP with that LP's range, re-centred on today's price.
 */
import { useMemo, useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useDiscoverPools } from '../../lib/discoverPools';
import { mintTarget, type EarnPool } from '../../lib/pools';
import { CHAIN_META } from '../../lib/wagmi';
import { CreatePosition } from '../CreatePosition';
import { Glass } from '../Glass';
import { Spinner } from '../Spinner';
import { btb } from '../design-tokens';
import { useSidebar } from '../../lib/SidebarContext';
import { SMART_LPS_NOTE } from '../simulator/sections/SmartLps';
import { fmtUsd, fmtSignedPct, fmtPct } from '../simulator/ui';
import type { SmartLp } from '../../lib/smartLps';

type Row = SmartLp & { chainId: number; pool: string };

const chainName = (id: number) => (CHAIN_META as Record<number, { name?: string } | undefined>)[id]?.name ?? `Chain ${id}`;
const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : 'unknown');

/** Token0 of a pool: the lower address of its pair. Smart LP ranges are moves of token0's price. */
function token0Of(p: EarnPool): string | undefined {
  const [a, b] = (p.underlyingTokens ?? []).map((t) => t.toLowerCase());
  return a && b ? (a < b ? a : b) : undefined;
}

export function SmartLpsScreen() {
  const data = useQuery(api.smartLps.top, { limit: 150 });
  const { pools } = useDiscoverPools();
  const { isMobile } = useSidebar();
  const [chain, setChain] = useState<number | 'all'>('all');
  const [copy, setCopy] = useState<{ pool: EarnPool; row: Row } | null>(null);

  // Pool names and mint details come from the Discover list, matched by chain and pool address.
  const poolOf = useMemo(() => {
    const m = new Map<string, EarnPool>();
    for (const p of pools ?? []) if (p.chainId != null) m.set(`${p.chainId}:${p.id.toLowerCase()}`, p);
    return m;
  }, [pools]);
  const rows = useMemo(() => (data?.lps ?? [])
    .map((r) => ({ r: r as Row, p: poolOf.get(`${r.chainId}:${r.pool}`) }))
    .filter((x): x is { r: Row; p: EarnPool } => !!x.p), [data, poolOf]);
  const chains = useMemo(() => [...new Set(rows.map((x) => x.r.chainId))], [rows]);
  const shown = rows.filter((x) => chain === 'all' || x.r.chainId === chain).slice(0, 60);

  const sheet = copy ? mintTarget(copy.pool) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 1100, margin: '0 auto', width: '100%' }}>
      <div>
        <div style={{ color: btb.text, fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>Smart LPs</div>
        <div style={{ color: btb.textMuted, fontSize: 12.5, marginTop: 4, maxWidth: 720, lineHeight: 1.5 }}>
          {SMART_LPS_NOTE} Copy any range in one tap.
        </div>
      </div>

      {chains.length > 1 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['all', ...chains] as const).map((c) => (
            <button key={c} onClick={() => setChain(c)} style={{
              height: 30, padding: '0 12px', borderRadius: 99, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
              border: chain === c ? '1px solid rgba(var(--green-rgb), .5)' : btb.borderSoft,
              background: chain === c ? 'rgba(var(--green-rgb), .14)' : 'transparent',
              color: chain === c ? 'var(--btb-green)' : btb.textMuted,
            }}>{c === 'all' ? 'All chains' : chainName(c)}</button>
          ))}
        </div>
      )}

      {data === undefined ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 30 }}><Spinner /></div>
      ) : shown.length === 0 ? (
        <Glass padding={18} radius={16} soft><div style={{ color: btb.textDim, fontSize: 13 }}>No smart LPs yet. The list fills in as the daily scan measures each pool.</div></Glass>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {shown.map(({ r, p }) => {
            const canCopy = !!mintTarget(p) && !!token0Of(p);
            const sym0 = (() => {
              const t0 = token0Of(p);
              const [a] = (p.underlyingTokens ?? []).map((t) => t.toLowerCase());
              const syms = p.pair.split(/[-/]/);
              return t0 && a === t0 ? syms[0] : syms[1];
            })();
            return (
              <Glass key={`${r.chainId}:${r.pool}:${r.id}`} padding={isMobile ? 12 : 14} radius={14} soft>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
                  <div style={{ flex: 1, minWidth: isMobile ? '100%' : 0 }}>
                    <div style={{ color: btb.text, fontSize: 14, fontWeight: 800 }}>
                      {p.pair} <span style={{ color: btb.textDim, fontSize: 11.5, fontWeight: 650 }}>· {p.dex} · {chainName(r.chainId)}</span>
                    </div>
                    <div style={{ color: btb.textMuted, fontSize: 12, marginTop: 3 }}>
                      {sym0} price {fmtPct(r.lowPct)} to {fmtSignedPct(r.highPct)} · {Math.round(r.days)}d{r.inRangePct != null ? ` · ${r.inRangePct}% in range` : ''}{r.nowInRange ? '' : ' · out of range now'}
                    </div>
                    <div style={{ color: btb.textDim, fontSize: 11, marginTop: 2 }}>
                      fees {fmtPct(r.feeApr, 0)} APR{r.valueUsd != null ? ` · ${fmtUsd(r.valueUsd)}` : ''} · {short(r.owner)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ color: r.netPct >= 0 ? btb.green : btb.loss, fontSize: 16, fontWeight: 800 }}>{fmtSignedPct(r.netPct, 2)}</div>
                    <div style={{ color: btb.textDim, fontSize: 10.5 }}>vs hold</div>
                  </div>
                  <button
                    disabled={!canCopy}
                    onClick={() => setCopy({ pool: p, row: r })}
                    title={canCopy ? 'Open Add LP with this range, centred on today\'s price' : 'This DEX is not mintable in the app yet'}
                    style={{ flexShrink: 0, height: 34, padding: '0 14px', borderRadius: 10, border: 'none', cursor: canCopy ? 'pointer' : 'not-allowed', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 800, background: canCopy ? 'rgba(var(--green-rgb), 0.16)' : 'rgba(var(--fg-rgb), 0.05)', color: canCopy ? 'var(--btb-green)' : btb.textDim, width: isMobile ? '100%' : undefined }}
                  >
                    Copy range
                  </button>
                </div>
              </Glass>
            );
          })}
        </div>
      )}

      {copy && sheet && (
        <CreatePosition
          tokenA={sheet.tokenA}
          tokenB={sheet.tokenB}
          v4PoolId={sheet.v4PoolId}
          dex={sheet.dex}
          chainId={sheet.chainId}
          initialFee={sheet.dex === 'aerodrome' || sheet.dex === 'aero' ? undefined : copy.pool.feeTier}
          initialPool={/^0x[0-9a-fA-F]{40}$/.test(copy.pool.id) ? copy.pool.id : undefined}
          fees24hUsd={copy.pool.fees24hUsd ?? (copy.pool.tvlUsd * copy.pool.apyBase) / 100 / 365}
          tokenPricesUsd={copy.pool.tokenPricesUsd}
          simulate={false}
          initialRangePct={{ token: token0Of(copy.pool)!, lowerPct: copy.row.lowPct, upperPct: copy.row.highPct }}
          onClose={() => setCopy(null)}
          onDone={() => setCopy(null)}
        />
      )}
    </div>
  );
}
