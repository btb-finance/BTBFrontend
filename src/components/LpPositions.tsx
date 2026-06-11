'use client';
import { useCallback, useEffect, useState } from 'react';
import { useConnection, useConfig } from 'wagmi';
import { getPublicClient } from 'wagmi/actions';
import { formatUnits, parseUnits, erc20Abi } from 'viem';
import { Glass } from './Glass';
import { Portal } from './Portal';
import { btb } from './design-tokens';
import { useTx } from '../lib/TxTracker';
import { runCalls } from '../lib/txRunner';
import {
  fetchV3Positions, buildCollect, buildRemove, buildIncrease,
  fetchV4Positions, buildV4Collect, buildV4Remove, buildV4Increase,
  addAmounts, addSide, isWeth, isNativeCurrency, liquidityForAmounts, maxIn,
  fmtFeeTier, type LiquidityPosition,
} from '@/protocols/dexs/uniswap';

const SLIPPAGE_BPS = 50; // 0.5%

function fmtAmt(raw: bigint, decimals: number): string {
  const n = parseFloat(formatUnits(raw, decimals));
  if (n === 0) return '0';
  if (n < 0.0001) return '<0.0001';
  return n.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

const posKey = (p: LiquidityPosition) => `${p.protocol}-${p.id.toString()}`;

/**
 * The connected wallet's live Uniswap V3 + V4 liquidity positions (Ethereum
 * mainnet) with Collect/Add/Withdraw actions. Shared by the Earn and Portfolio
 * screens. Renders nothing when there are no positions.
 */
export function LpPositions() {
  const { address } = useConnection();
  const config = useConfig();
  const { track } = useTx();
  const [positions, setPositions] = useState<LiquidityPosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [manage, setManage] = useState<{ pos: LiquidityPosition; mode: 'add' | 'withdraw' } | null>(null);

  const load = useCallback(async () => {
    if (!address) { setPositions([]); return; }
    setLoading(true);
    try {
      const client = getPublicClient(config);
      if (!client) return;
      // Each protocol degrades independently — one failing read can't blank the other.
      const [v3, v4] = await Promise.allSettled([
        fetchV3Positions(client, address as `0x${string}`),
        fetchV4Positions(client, address as `0x${string}`),
      ]);
      setPositions([
        ...(v3.status === 'fulfilled' ? v3.value : []),
        ...(v4.status === 'fulfilled' ? v4.value : []),
      ]);
    } catch { /* read failure — leave list empty */ }
    finally { setLoading(false); }
  }, [address, config]);

  useEffect(() => { load(); }, [load]);

  async function collect(pos: LiquidityPosition) {
    if (!address) return;
    setBusyId(posKey(pos));
    try {
      await runCalls(config, {
        account: address as `0x${string}`,
        calls: pos.protocol === 'uniswap-v4'
          ? buildV4Collect(pos, address as `0x${string}`)
          : buildCollect(pos.id, address as `0x${string}`),
        label: `Collect ${pos.symbol0}/${pos.symbol1} fees`,
        track,
      });
      await load();
    } catch { /* surfaced via the global tx pill */ }
    finally { setBusyId(null); }
  }

  if (!address) return null;
  if (!loading && positions.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
        <span style={{ color: btb.text, fontSize: 17, fontWeight: 800, letterSpacing: -0.3 }}>Your Positions</span>
        <span style={{ color: btb.textDim, fontSize: 12 }}>Uniswap V3 + V4 · Ethereum</span>
      </div>

      {loading && positions.length === 0 && (
        <Glass padding={16} radius={18}><div style={{ color: btb.textDim, fontSize: 13 }}>Loading positions…</div></Glass>
      )}

      {positions.map((p) => {
        const hasFees = p.fees0 > 0n || p.fees1 > 0n;
        const hasLiquidity = p.liquidity > 0n;
        const busy = busyId === posKey(p);
        return (
          <Glass key={posKey(p)} padding={14} radius={18}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
              <span style={{ color: btb.text, fontSize: 15, fontWeight: 700 }}>{p.symbol0} / {p.symbol1}</span>
              <span style={{ color: btb.textMuted, fontSize: 11, background: 'rgba(255,255,255,0.07)', padding: '1px 7px', borderRadius: 999 }}>{fmtFeeTier(p.fee)}</span>
              <span style={{ color: '#FF007A', fontSize: 10, fontWeight: 700, background: 'rgba(255,0,122,0.12)', border: '1px solid rgba(255,0,122,0.3)', padding: '1px 7px', borderRadius: 999 }}>{p.protocol === 'uniswap-v4' ? 'V4' : 'V3'}</span>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 999,
                background: p.inRange ? 'rgba(82,227,164,0.14)' : 'rgba(255,179,107,0.14)',
                color: p.inRange ? '#52E3A4' : '#FFB36B',
              }}>{p.inRange ? 'In range' : 'Out of range'}</span>
            </div>
            <div style={{ color: btb.textMuted, fontSize: 12 }}>
              {fmtAmt(p.amount0, p.decimals0)} {p.symbol0} + {fmtAmt(p.amount1, p.decimals1)} {p.symbol1}
            </div>
            {hasFees && (
              <div style={{ color: '#52E3A4', fontSize: 11, marginTop: 3 }}>
                Fees: {fmtAmt(p.fees0, p.decimals0)} {p.symbol0} + {fmtAmt(p.fees1, p.decimals1)} {p.symbol1}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <ActBtn label="Add" onClick={() => setManage({ pos: p, mode: 'add' })} disabled={busy}/>
              {hasLiquidity && <ActBtn label="Withdraw" onClick={() => setManage({ pos: p, mode: 'withdraw' })} disabled={busy}/>}
              <ActBtn label={busy ? '…' : 'Collect'} onClick={() => collect(p)} disabled={!hasFees || busy} green/>
            </div>
          </Glass>
        );
      })}

      {manage && (
        <ManageSheet
          pos={manage.pos}
          mode={manage.mode}
          account={address as `0x${string}`}
          onClose={() => setManage(null)}
          onDone={async () => { setManage(null); await load(); }}
        />
      )}
    </div>
  );
}

function ActBtn({ label, onClick, disabled, green }: { label: string; onClick: () => void; disabled?: boolean; green?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      flex: 1, height: 36, borderRadius: 12, border: 'none', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
      cursor: disabled ? 'default' : 'pointer',
      background: disabled ? 'rgba(255,255,255,0.06)' : green ? 'linear-gradient(135deg,#52E3A4,#1aad77)' : 'rgba(255,255,255,0.1)',
      color: disabled ? btb.textDim : '#fff',
    }}>{label}</button>
  );
}

function ManageSheet({ pos, mode, account, onClose, onDone }: {
  pos: LiquidityPosition; mode: 'add' | 'withdraw'; account: `0x${string}`;
  onClose: () => void; onDone: () => void | Promise<void>;
}) {
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
            ? buildRemove(pos, pct * 100, SLIPPAGE_BPS, account)
            : buildIncrease(pos, add0, add1, SLIPPAGE_BPS, ethMode ? wethSide : null));
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
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 320, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, background: 'rgba(10,10,15,0.98)', borderTop: '1px solid rgba(255,255,255,0.1)', borderRadius: '28px 28px 0 0', padding: '12px 20px calc(32px + env(safe-area-inset-bottom, 0px))' }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.18)', margin: '0 auto 16px' }}/>
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

        <button onClick={run} disabled={!canRun || busy} style={{
          width: '100%', height: 56, borderRadius: 18, border: 'none', marginTop: 18, fontFamily: 'inherit', fontSize: 16, fontWeight: 800,
          cursor: canRun && !busy ? 'pointer' : 'default',
          background: canRun ? 'linear-gradient(135deg,#52E3A4,#1aad77)' : 'rgba(255,255,255,0.07)',
          color: canRun ? '#fff' : btb.textDim,
        }}>
          {busy ? 'Confirming…' : mode === 'withdraw' ? `Withdraw ${pct}%` : 'Add liquidity'}
        </button>
        <div style={{ color: btb.textDim, fontSize: 11, textAlign: 'center', marginTop: 10 }}>
          Slippage-protected ({SLIPPAGE_BPS / 100}%). {mode === 'add' ? 'Token approvals are included automatically.' : 'Withdraws principal + fees to your wallet.'}
        </div>
      </div>
    </div>
    </Portal>
  );
}
