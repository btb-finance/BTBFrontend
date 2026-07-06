'use client';
import { useCallback, useEffect, useState } from 'react';
import { useConnection, useConfig } from 'wagmi';
import { getPublicClient } from 'wagmi/actions';
import { formatUnits, parseUnits, erc20Abi } from 'viem';
import { Glass } from './Glass';
import { Portal } from './Portal';
import { Button } from './Button';
import { Badge } from './Badge';
import { SectionHeader } from './SectionHeader';
import { DataTable, Column } from './DataTable';
import { TokenIcon } from './TokenIcon';
import { btb } from './design-tokens';
import { useSidebar } from '../lib/SidebarContext';
import { useTx } from '../lib/TxTracker';
import { runCalls } from '../lib/txRunner';
import { getTokenPricesUsd } from '../lib/defillama';
import {
  fetchV3Positions, buildCollect, buildRemove, buildIncrease,
  fetchV4Positions, buildV4Collect, buildV4Remove, buildV4Increase,
  addAmounts, addSide, isWeth, isNativeCurrency, liquidityForAmounts, maxIn,
  fmtFeeTier, NATIVE_CURRENCY, UNISWAP_V3_DEPLOYMENT, type LiquidityPosition, type V3Deployment,
} from '@/protocols/dexs/uniswap';
import { fetchPancakePositions, PANCAKE_V3_DEPLOYMENT } from '@/protocols/dexs/pancakeswap';
import { RebalanceSheet } from './RebalanceSheet';

/** Deployment for a V3-architecture position (Uniswap default, Pancake fork). */
function v3DeploymentOf(p: LiquidityPosition): V3Deployment {
  return p.protocol === 'pancakeswap-v3' ? PANCAKE_V3_DEPLOYMENT : UNISWAP_V3_DEPLOYMENT;
}

const PROTOCOL_BADGE: Record<LiquidityPosition['protocol'], { label: string; color: string }> = {
  'uniswap-v3': { label: 'V3', color: '#FF007A' },
  'uniswap-v4': { label: 'V4', color: '#FF007A' },
  'pancakeswap-v3': { label: 'CAKE V3', color: '#1FC7D4' },
};

const SLIPPAGE_BPS = 50; // 0.5%

function fmtAmt(raw: bigint, decimals: number): string {
  const n = parseFloat(formatUnits(raw, decimals));
  if (n === 0) return '0';
  if (n < 0.0001) return '<0.0001';
  return n.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

const posKey = (p: LiquidityPosition) => `${p.protocol}-${p.id.toString()}`;

/**
 * The connected wallet's live Uniswap V3/V4 + PancakeSwap V3 liquidity
 * positions (Ethereum mainnet) with Collect/Add/Withdraw actions. Shared by
 * the Earn and Portfolio screens. Renders nothing when there are no positions
 * (unless `showEmpty`).
 */
export function LpPositions({ showEmpty = false }: { showEmpty?: boolean } = {}) {
  const { address } = useConnection();
  const config = useConfig();
  const { track } = useTx();
  const [positions, setPositions] = useState<LiquidityPosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [manage, setManage] = useState<{ pos: LiquidityPosition; mode: 'add' | 'withdraw' } | null>(null);
  const [rebalance, setRebalance] = useState<LiquidityPosition | null>(null);
  const [usd, setUsd] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    if (!address) { setPositions([]); return; }
    setLoading(true);
    try {
      const client = getPublicClient(config);
      if (!client) return;
      // Each protocol renders as soon as it resolves and degrades
      // independently — a slow/failing V4 log scan can't hold up the V3 list.
      const merge = (protocol: LiquidityPosition['protocol']) => (items: LiquidityPosition[]) =>
        setPositions((prev) => [...prev.filter((p) => p.protocol !== protocol), ...items]);
      await Promise.allSettled([
        fetchV3Positions(client, address as `0x${string}`).then(merge('uniswap-v3')),
        fetchV4Positions(client, address as `0x${string}`).then(merge('uniswap-v4')),
        fetchPancakePositions(client, address as `0x${string}`).then(merge('pancakeswap-v3')),
      ]);
    } catch { /* read failure — leave list empty */ }
    finally { setLoading(false); }
  }, [address, config]);

  useEffect(() => { load(); }, [load]);

  // Live USD prices for every token held across positions — used only for the
  // stats strip (current value + unclaimed fees), both real on-chain amounts.
  // No cost-basis history is tracked, so P&L/ROI/APR aren't shown here — that
  // would require fabricating numbers we can't back up.
  useEffect(() => {
    if (positions.length === 0) return;
    const addrs = [...new Set(positions.flatMap((p) => [p.token0, p.token1]))];
    getTokenPricesUsd(addrs).then(setUsd).catch(() => {});
  }, [positions]);

  async function collect(pos: LiquidityPosition) {
    if (!address) return;
    setBusyId(posKey(pos));
    try {
      await runCalls(config, {
        account: address as `0x${string}`,
        calls: pos.protocol === 'uniswap-v4'
          ? buildV4Collect(pos, address as `0x${string}`)
          : buildCollect(pos.id, address as `0x${string}`, v3DeploymentOf(pos)),
        label: `Collect ${pos.symbol0}/${pos.symbol1} fees`,
        track,
      });
      await load();
    } catch { /* surfaced via the global tx pill */ }
    finally { setBusyId(null); }
  }

  if (!address) {
    return showEmpty ? (
      <Glass padding={16} radius={18}>
        <div style={{ color: btb.textMuted, fontSize: 13, textAlign: 'center' }}>Connect your wallet to see your LP positions.</div>
      </Glass>
    ) : null;
  }
  if (!loading && positions.length === 0) {
    return showEmpty ? (
      <Glass padding={16} radius={18}>
        <div style={{ color: btb.textMuted, fontSize: 13, textAlign: 'center' }}>
          No LP positions yet — add one from the Earn tab.
        </div>
      </Glass>
    ) : null;
  }

  const valueOf = (p: LiquidityPosition) => {
    const p0 = usd[p.token0.toLowerCase()] ?? 0;
    const p1 = usd[p.token1.toLowerCase()] ?? 0;
    return parseFloat(formatUnits(p.amount0, p.decimals0)) * p0 + parseFloat(formatUnits(p.amount1, p.decimals1)) * p1;
  };
  const feesValueOf = (p: LiquidityPosition) => {
    const p0 = usd[p.token0.toLowerCase()] ?? 0;
    const p1 = usd[p.token1.toLowerCase()] ?? 0;
    return parseFloat(formatUnits(p.fees0, p.decimals0)) * p0 + parseFloat(formatUnits(p.fees1, p.decimals1)) * p1;
  };
  const totalValueUsd = positions.reduce((s, p) => s + valueOf(p), 0);
  const pendingFeesUsd = positions.reduce((s, p) => s + feesValueOf(p), 0);
  const inRangeCount = positions.filter((p) => p.inRange && p.liquidity > 0n).length;

  const columns: Column<LiquidityPosition>[] = [
    {
      key: 'pool', label: 'Pool', sortable: true, sortValue: p => `${p.symbol0}${p.symbol1}`,
      render: p => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex' }}>
            <TokenIcon symbol={p.symbol0} size={26} />
            <div style={{ marginLeft: -8 }}><TokenIcon symbol={p.symbol1} size={26} /></div>
          </div>
          <div>
            <div style={{ fontWeight: 700 }}>{p.symbol0} / {p.symbol1}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2, flexWrap: 'wrap' }}>
              <Badge size="sm" color={btb.textMuted} bg={btb.surfaceSoft} border="none" style={{ fontSize: 10, padding: '1px 6px' }}>{fmtFeeTier(p.fee)}</Badge>
              <Badge size="sm" color={PROTOCOL_BADGE[p.protocol].color} bg={`${PROTOCOL_BADGE[p.protocol].color}1f`} border="none" style={{ fontSize: 10, padding: '1px 6px' }}>{PROTOCOL_BADGE[p.protocol].label}</Badge>
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'amounts', label: 'Position', align: 'left',
      render: p => (
        <span style={{ color: btb.textMuted, fontSize: 12.5 }}>
          {fmtAmt(p.amount0, p.decimals0)} {p.symbol0} + {fmtAmt(p.amount1, p.decimals1)} {p.symbol1}
        </span>
      ),
    },
    {
      key: 'fees', label: 'Unclaimed fees', align: 'left',
      render: p => (p.fees0 > 0n || p.fees1 > 0n) ? (
        <span style={{ color: btb.green, fontSize: 12.5 }}>
          {fmtAmt(p.fees0, p.decimals0)} {p.symbol0} + {fmtAmt(p.fees1, p.decimals1)} {p.symbol1}
        </span>
      ) : <span style={{ color: btb.textDim }}>—</span>,
    },
    {
      key: 'status', label: 'Status', align: 'left', sortable: true, sortValue: p => (p.inRange ? 1 : 0),
      render: p => (
        <Badge size="sm" border="none" bg={p.inRange ? 'rgba(82,227,164,0.14)' : 'rgba(255,179,107,0.14)'} color={p.inRange ? btb.green : btb.amber}>
          {p.inRange ? 'In range' : 'Out of range'}
        </Badge>
      ),
    },
    {
      key: 'actions', label: '', align: 'right', width: '340px',
      render: p => {
        const hasFees = p.fees0 > 0n || p.fees1 > 0n;
        const hasLiquidity = p.liquidity > 0n;
        const canRebalance = hasLiquidity && (p.protocol !== 'uniswap-v4' || isNativeCurrency(p.hooks ?? NATIVE_CURRENCY));
        const busy = busyId === posKey(p);
        return (
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
            <ActBtn label="Add" onClick={() => setManage({ pos: p, mode: 'add' })} disabled={busy}/>
            {hasLiquidity && <ActBtn label="Withdraw" onClick={() => setManage({ pos: p, mode: 'withdraw' })} disabled={busy}/>}
            <ActBtn label={busy ? '…' : 'Collect'} onClick={() => collect(p)} disabled={!hasFees || busy} green/>
            {canRebalance && (
              <button onClick={() => setRebalance(p)} disabled={busy} style={{
                height: 30, padding: '0 10px', borderRadius: 8, border: 'none', fontFamily: 'inherit', whiteSpace: 'nowrap',
                fontSize: 11.5, fontWeight: 700, cursor: busy ? 'default' : 'pointer',
                background: p.inRange ? 'rgba(255,255,255,0.08)' : 'rgba(255,179,107,0.16)',
                color: p.inRange ? btb.text : btb.amber,
              }}>
                ⚖ Rebalance
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <SectionHeader title="Your Positions" right="Uniswap + PancakeSwap · Ethereum"/>

      {positions.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          <Glass padding={16} radius={14} soft>
            <div style={{ color: btb.textMuted, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>Total value</div>
            <div style={{ color: btb.text, fontSize: 22, fontWeight: 800, marginTop: 4 }}>${totalValueUsd.toLocaleString('en-US', { maximumFractionDigits: 2 })}</div>
          </Glass>
          <Glass padding={16} radius={14} soft>
            <div style={{ color: btb.textMuted, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>Unclaimed fees</div>
            <div style={{ color: btb.green, fontSize: 22, fontWeight: 800, marginTop: 4 }}>${pendingFeesUsd.toLocaleString('en-US', { maximumFractionDigits: 2 })}</div>
          </Glass>
          <Glass padding={16} radius={14} soft>
            <div style={{ color: btb.textMuted, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>In range</div>
            <div style={{ color: btb.text, fontSize: 22, fontWeight: 800, marginTop: 4 }}>{inRangeCount} / {positions.length}</div>
          </Glass>
        </div>
      )}

      <div style={{ borderRadius: 16, border: btb.borderSoft, background: btb.surfaceSoft, overflow: 'hidden' }}>
        <DataTable
          columns={columns}
          rows={positions}
          rowKey={posKey}
          loading={loading && positions.length === 0}
          emptyMessage="No LP positions yet"
        />
      </div>

      {manage && (
        <ManageSheet
          pos={manage.pos}
          mode={manage.mode}
          account={address as `0x${string}`}
          onClose={() => setManage(null)}
          onDone={async () => { setManage(null); await load(); }}
        />
      )}

      {rebalance && (
        <RebalanceSheet
          pos={rebalance}
          account={address as `0x${string}`}
          onClose={() => setRebalance(null)}
          onDone={async () => { setRebalance(null); await load(); }}
        />
      )}
    </div>
  );
}

function ActBtn({ label, onClick, disabled, green }: { label: string; onClick: () => void; disabled?: boolean; green?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      height: 30, padding: '0 12px', borderRadius: 8, border: 'none', fontFamily: 'inherit', fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap',
      cursor: disabled ? 'default' : 'pointer',
      background: disabled ? 'rgba(255,255,255,0.06)' : green ? btb.gradGreen : 'rgba(255,255,255,0.1)',
      color: disabled ? btb.textDim : '#fff',
    }}>{label}</button>
  );
}

function ManageSheet({ pos, mode, account, onClose, onDone }: {
  pos: LiquidityPosition; mode: 'add' | 'withdraw'; account: `0x${string}`;
  onClose: () => void; onDone: () => void | Promise<void>;
}) {
  const { width: sidebarWidth } = useSidebar();
  const { track } = useTx();
  const config = useConfig();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // withdraw state
  const [pct, setPct] = useState(100);
  // add state
  const side = addSide(pos.sqrtPriceX96, pos.tickLower, pos.tickUpper); // 'both' | 'token0' | 'token1'
  const inputSide: 0 | 1 = side === 'token1' ? 1 : 0;
  const [amtStr, setAmtStr] = useState('');
  const [useEth, setUseEth] = useState(true);

  const isV4 = pos.protocol === 'uniswap-v4';
  // Native-ETH deposit side. V3: the WETH token (user can toggle ETH vs WETH).
  // V4: currency0 = address(0) IS native ETH — always ETH, nothing to toggle.
  const wethSide: 0 | 1 | null = isV4 ? null : isWeth(pos.token0) ? 0 : isWeth(pos.token1) ? 1 : null;
  const nativeSide: 0 | 1 | null = isV4 ? (isNativeCurrency(pos.token0) ? 0 : null) : wethSide;
  const ethMode = isV4 ? nativeSide !== null : (wethSide !== null && useEth);
  const sym0 = ethMode && nativeSide === 0 ? 'ETH' : pos.symbol0;
  const sym1 = ethMode && nativeSide === 1 ? 'ETH' : pos.symbol1;

  const inputDecimals = inputSide === 0 ? pos.decimals0 : pos.decimals1;
  const inputSymbol = inputSide === 0 ? sym0 : sym1;

  let add0 = 0n, add1 = 0n;
  try {
    if (amtStr && parseFloat(amtStr) > 0) {
      const raw = parseUnits(amtStr, inputDecimals);
      const r = addAmounts(pos.sqrtPriceX96, pos.tickLower, pos.tickUpper, inputSide, raw);
      add0 = r.amount0; add1 = r.amount1;
    }
  } catch { /* mid-typing */ }

  // wallet balances (for the Add flow) — both tokens + native ETH
  const [bal0, setBal0] = useState(0n);
  const [bal1, setBal1] = useState(0n);
  const [ethBal, setEthBal] = useState(0n);
  useEffect(() => {
    if (mode !== 'add') return;
    let live = true;
    const client = getPublicClient(config);
    if (!client) return;
    (async () => {
      try {
        const [b0, b1] = await client.multicall({
          contracts: [
            { address: pos.token0, abi: erc20Abi, functionName: 'balanceOf', args: [account] },
            { address: pos.token1, abi: erc20Abi, functionName: 'balanceOf', args: [account] },
          ],
          allowFailure: true,
        });
        const eb = await client.getBalance({ address: account });
        if (live) {
          setBal0(b0.status === 'success' ? (b0.result as bigint) : 0n);
          setBal1(b1.status === 'success' ? (b1.result as bigint) : 0n);
          setEthBal(eb);
        }
      } catch { /* unknown balances */ }
    })();
    return () => { live = false; };
  }, [mode, config, account, pos.token0, pos.token1]);

  const effBal0 = ethMode && nativeSide === 0 ? ethBal : bal0;
  const effBal1 = ethMode && nativeSide === 1 ? ethBal : bal1;
  const short0 = add0 > effBal0;
  const short1 = add1 > effBal1;
  const inputBal = inputSide === 0 ? effBal0 : effBal1;

  const out0 = (pos.amount0 * BigInt(pct)) / 100n;
  const out1 = (pos.amount1 * BigInt(pct)) / 100n;

  async function run() {
    setBusy(true); setErr(null);
    try {
      const calls = isV4
        ? (mode === 'withdraw'
            ? buildV4Remove(pos, pct * 100, SLIPPAGE_BPS, account)
            : buildV4Increase(
                pos,
                liquidityForAmounts(pos.sqrtPriceX96, pos.tickLower, pos.tickUpper, add0, add1),
                maxIn(add0, SLIPPAGE_BPS), maxIn(add1, SLIPPAGE_BPS),
                account,
              ))
        : (mode === 'withdraw'
            ? buildRemove(pos, pct * 100, SLIPPAGE_BPS, account, v3DeploymentOf(pos))
            : buildIncrease(pos, add0, add1, SLIPPAGE_BPS, ethMode ? wethSide : null, v3DeploymentOf(pos)));
      await runCalls(config, {
        account,
        calls,
        label: `${mode === 'withdraw' ? 'Withdraw' : 'Add'} ${pos.symbol0}/${pos.symbol1}`,
        track,
      });
      await onDone();
    } catch (e) {
      setErr((e as { shortMessage?: string })?.shortMessage ?? (e as Error)?.message ?? 'Failed');
    } finally { setBusy(false); }
  }

  const canRun = mode === 'withdraw' ? pct > 0 : ((add0 > 0n || add1 > 0n) && !short0 && !short1);

  return (
    <Portal>
    <div onClick={onClose} style={{ position: 'fixed', top: 0, left: sidebarWidth, right: 0, bottom: 0, zIndex: 320, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', overflowY: 'auto' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, background: 'rgba(10,10,15,0.98)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 28, padding: '12px 20px calc(32px + env(safe-area-inset-bottom, 0px))' }}>
        <div style={{ color: btb.text, fontSize: 19, fontWeight: 800, letterSpacing: -0.4, marginBottom: 4 }}>
          {mode === 'withdraw' ? 'Withdraw liquidity' : 'Add liquidity'}
        </div>
        <div style={{ color: btb.textMuted, fontSize: 13, marginBottom: 18 }}>{pos.symbol0} / {pos.symbol1} · {fmtFeeTier(pos.fee)} · {isV4 ? 'V4' : 'V3'}</div>

        {mode === 'withdraw' ? (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {[25, 50, 75, 100].map((v) => (
                <button key={v} onClick={() => setPct(v)} style={{
                  flex: 1, height: 40, borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
                  background: pct === v ? 'rgba(82,227,164,0.18)' : 'rgba(255,255,255,0.06)',
                  border: `1px solid ${pct === v ? 'rgba(82,227,164,0.5)' : 'rgba(255,255,255,0.12)'}`,
                  color: pct === v ? '#52E3A4' : btb.textMuted,
                }}>{v}%</button>
              ))}
            </div>
            <Glass padding={14} radius={14} soft>
              <div style={{ color: btb.textMuted, fontSize: 12, marginBottom: 6 }}>You receive (min, after {SLIPPAGE_BPS / 100}% slippage)</div>
              <div style={{ color: btb.text, fontSize: 15, fontWeight: 700 }}>
                ≈ {fmtAmt(out0, pos.decimals0)} {pos.symbol0} + {fmtAmt(out1, pos.decimals1)} {pos.symbol1}
              </div>
            </Glass>
          </>
        ) : (
          <>
            {wethSide !== null && (
              <div onClick={() => setUseEth((v) => !v)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: 14, background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '10px 14px' }}>
                <span style={{ color: btb.text, fontSize: 13, fontWeight: 600 }}>Pay with ETH <span style={{ color: btb.textDim, fontWeight: 400 }}>(instead of WETH)</span></span>
                <div style={{ width: 42, height: 24, borderRadius: 999, background: useEth ? '#52E3A4' : 'rgba(255,255,255,0.18)', position: 'relative', transition: 'background 0.2s' }}>
                  <div style={{ position: 'absolute', top: 2, left: useEth ? 20 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }}/>
                </div>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ color: btb.textMuted, fontSize: 12 }}>Amount of {inputSymbol}{side === 'both' ? ' (paired auto)' : ''}</span>
              <span style={{ color: btb.textMuted, fontSize: 12 }}>
                Balance: {fmtAmt(inputBal, inputDecimals)}
                <span onClick={() => setAmtStr(formatUnits(inputBal, inputDecimals))} style={{ color: btb.red, fontWeight: 700, marginLeft: 6, cursor: 'pointer' }}>MAX</span>
              </span>
            </div>
            <input
              value={amtStr}
              onChange={(e) => setAmtStr(e.target.value.replace(/[^0-9.]/g, ''))}
              inputMode="decimal" placeholder="0"
              style={{ width: '100%', height: 52, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, padding: '0 16px', color: btb.text, fontSize: 22, fontWeight: 700, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}/>
            {(add0 > 0n || add1 > 0n) && (
              <div style={{ color: btb.textMuted, fontSize: 13, marginTop: 10 }}>
                Deposit: {fmtAmt(add0, pos.decimals0)} {sym0} + {fmtAmt(add1, pos.decimals1)} {sym1}
              </div>
            )}
            {(short0 || short1) && (
              <div style={{ color: btb.loss, fontSize: 12, marginTop: 8 }}>Insufficient {short0 ? sym0 : sym1} balance</div>
            )}
            {!pos.inRange && (
              <div style={{ color: '#FFB36B', fontSize: 11, marginTop: 8 }}>Out of range — only {inputSymbol} is needed at the current price.</div>
            )}
          </>
        )}

        {err && <div style={{ color: btb.loss, fontSize: 12, marginTop: 12 }}>{err}</div>}

        <Button variant="success" size="md" onClick={() => { if (!busy) run(); }} disabled={!canRun} style={{ marginTop: 18, fontWeight: 800 }}>
          {busy ? 'Confirming…' : mode === 'withdraw' ? `Withdraw ${pct}%` : 'Add liquidity'}
        </Button>
        <div style={{ color: btb.textDim, fontSize: 11, textAlign: 'center', marginTop: 10 }}>
          Slippage-protected ({SLIPPAGE_BPS / 100}%). {mode === 'add' ? 'Token approvals are included automatically.' : 'Withdraws principal + fees to your wallet.'}
        </div>
      </div>
    </div>
    </Portal>
  );
}
