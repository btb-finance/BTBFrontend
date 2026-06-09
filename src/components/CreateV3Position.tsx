'use client';
import { useEffect, useMemo, useState } from 'react';
import { useConnection, useConfig } from 'wagmi';
import { getPublicClient } from 'wagmi/actions';
import { formatUnits, parseUnits, erc20Abi } from 'viem';
import { Glass } from './Glass';
import { btb } from './design-tokens';
import { useTx } from '../lib/TxTracker';
import { runCalls } from '../lib/txRunner';
import {
  fetchPoolForMint, buildMint, rangeTicks, addAmounts, TICK_SPACINGS,
  FEE_TIERS, isWeth, type MintPool,
} from '@/protocols/dexs/uniswap';

const SLIPPAGE_BPS = 50; // 0.5%
const FEE_LABEL: Record<number, string> = { 100: '0.01%', 500: '0.05%', 3000: '0.3%', 10000: '1%' };
const RANGE_PRESETS: { label: string; pct: number | null }[] = [
  { label: '±5%', pct: 5 }, { label: '±10%', pct: 10 }, { label: '±25%', pct: 25 }, { label: 'Full', pct: null },
];

function fmtAmt(raw: bigint, decimals: number): string {
  const n = parseFloat(formatUnits(raw, decimals));
  if (n === 0) return '0';
  if (n < 0.0001) return '<0.0001';
  return n.toLocaleString('en-US', { maximumFractionDigits: 6 });
}

/**
 * Create a brand-new Uniswap V3 position (Ethereum mainnet) for a token pair.
 * Pick a fee tier + range + amount; we resolve the pool, compute the paired
 * amount, and mint with slippage protection (approvals batched in).
 */
export function CreateV3Position({ tokenA, tokenB, onClose, onDone }: {
  tokenA: `0x${string}`; tokenB: `0x${string}`;
  onClose: () => void; onDone?: () => void;
}) {
  const { address } = useConnection();
  const config = useConfig();
  const { track } = useTx();

  const [fee, setFee] = useState(3000);
  const [pool, setPool] = useState<MintPool | null>(null);
  const [loadingPool, setLoadingPool] = useState(true);
  const [rangePct, setRangePct] = useState<number | null>(10);
  const [amtStr, setAmtStr] = useState('');
  const [useEth, setUseEth] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [bal0, setBal0] = useState(0n);
  const [bal1, setBal1] = useState(0n);
  const [ethBal, setEthBal] = useState(0n);

  // Which sorted token (if any) is WETH — lets the user deposit native ETH.
  const wethSide: 0 | 1 | null = pool ? (isWeth(pool.token0) ? 0 : isWeth(pool.token1) ? 1 : null) : null;
  const ethMode = wethSide !== null && useEth;
  const sym0 = pool ? (ethMode && wethSide === 0 ? 'ETH' : pool.symbol0) : '';
  const sym1 = pool ? (ethMode && wethSide === 1 ? 'ETH' : pool.symbol1) : '';

  useEffect(() => {
    let live = true;
    setLoadingPool(true); setPool(null);
    const client = getPublicClient(config);
    if (!client) { setLoadingPool(false); return; }
    fetchPoolForMint(client, tokenA, tokenB, fee)
      .then((p) => { if (live) setPool(p); })
      .catch(() => {})
      .finally(() => { if (live) setLoadingPool(false); });
    return () => { live = false; };
  }, [config, tokenA, tokenB, fee]);

  const spacing = TICK_SPACINGS[fee];
  const ticks = useMemo(
    () => (pool && pool.exists ? rangeTicks(pool.tick, spacing, rangePct) : null),
    [pool, spacing, rangePct],
  );

  // price of token0 in token1 (human units)
  const price = useMemo(() => {
    if (!pool || !pool.exists) return 0;
    const p = (Number(pool.sqrtPriceX96) / 2 ** 96) ** 2;
    return p * 10 ** (pool.decimals0 - pool.decimals1);
  }, [pool]);

  // user inputs token0 amount; pair the rest
  const { add0, add1 } = useMemo(() => {
    if (!pool || !pool.exists || !ticks || !amtStr || parseFloat(amtStr) <= 0) return { add0: 0n, add1: 0n };
    try {
      const raw = parseUnits(amtStr, pool.decimals0);
      const r = addAmounts(pool.sqrtPriceX96, ticks.tickLower, ticks.tickUpper, 0, raw);
      return { add0: r.amount0, add1: r.amount1 };
    } catch { return { add0: 0n, add1: 0n }; }
  }, [pool, ticks, amtStr]);

  // wallet balances of both tokens (+ native ETH)
  useEffect(() => {
    let live = true;
    const client = getPublicClient(config);
    if (!client || !address || !pool) return;
    (async () => {
      try {
        const [b0, b1] = await client.multicall({
          contracts: [
            { address: pool.token0, abi: erc20Abi, functionName: 'balanceOf', args: [address as `0x${string}`] },
            { address: pool.token1, abi: erc20Abi, functionName: 'balanceOf', args: [address as `0x${string}`] },
          ],
          allowFailure: true,
        });
        const eb = await client.getBalance({ address: address as `0x${string}` });
        if (live) {
          setBal0(b0.status === 'success' ? (b0.result as bigint) : 0n);
          setBal1(b1.status === 'success' ? (b1.result as bigint) : 0n);
          setEthBal(eb);
        }
      } catch { /* read failure — treat as unknown */ }
    })();
    return () => { live = false; };
  }, [config, address, pool]);

  const effBal0 = ethMode && wethSide === 0 ? ethBal : bal0;
  const effBal1 = ethMode && wethSide === 1 ? ethBal : bal1;
  const short0 = add0 > effBal0;
  const short1 = add1 > effBal1;

  async function mint() {
    if (!address || !pool || !ticks) return;
    setBusy(true); setErr(null);
    try {
      const calls = buildMint({
        token0: pool.token0, token1: pool.token1, fee,
        tickLower: ticks.tickLower, tickUpper: ticks.tickUpper,
        amount0Desired: add0, amount1Desired: add1,
        slippageBps: SLIPPAGE_BPS, recipient: address as `0x${string}`,
        nativeEthSide: ethMode ? wethSide : null,
      });
      await runCalls(config, { account: address as `0x${string}`, calls, label: `Add ${pool.symbol0}/${pool.symbol1} liquidity`, track });
      onDone?.();
      onClose();
    } catch (e) {
      setErr((e as { shortMessage?: string })?.shortMessage ?? (e as Error)?.message ?? 'Failed');
    } finally { setBusy(false); }
  }

  const canMint = !!pool?.exists && !!ticks && (add0 > 0n || add1 > 0n) && !short0 && !short1 && !busy;

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 340, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, background: 'rgba(10,10,15,0.98)', borderTop: '1px solid rgba(255,255,255,0.1)', borderRadius: '28px 28px 0 0', padding: '12px 20px 32px', maxHeight: '88vh', overflowY: 'auto' }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.18)', margin: '0 auto 16px' }}/>
        <div style={{ color: btb.text, fontSize: 19, fontWeight: 800, letterSpacing: -0.4 }}>Add liquidity</div>
        <div style={{ color: btb.textMuted, fontSize: 13, marginTop: 2, marginBottom: 16 }}>
          {pool ? `${pool.symbol0} / ${pool.symbol1}` : 'Uniswap V3 · Ethereum'}
        </div>

        {/* Fee tier */}
        <div style={{ color: btb.textMuted, fontSize: 12, marginBottom: 6 }}>Fee tier</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {FEE_TIERS.map((f) => (
            <button key={f} onClick={() => setFee(f)} style={{
              flex: 1, height: 38, borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
              background: fee === f ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${fee === f ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.1)'}`,
              color: fee === f ? '#fff' : btb.textMuted,
            }}>{FEE_LABEL[f]}</button>
          ))}
        </div>

        {loadingPool ? (
          <div style={{ color: btb.textDim, fontSize: 13, padding: '8px 0' }}>Checking pool…</div>
        ) : !pool?.exists ? (
          <div style={{ color: '#FFB36B', fontSize: 13, padding: '8px 0' }}>No pool at this fee tier — try another.</div>
        ) : (
          <>
            <div style={{ color: btb.textMuted, fontSize: 12, marginBottom: 12 }}>
              Current price: 1 {pool.symbol0} = {price.toLocaleString('en-US', { maximumSignificantDigits: 6 })} {pool.symbol1}
            </div>

            {wethSide !== null && (
              <div onClick={() => setUseEth((v) => !v)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: 16, background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '10px 14px' }}>
                <span style={{ color: btb.text, fontSize: 13, fontWeight: 600 }}>Pay with ETH <span style={{ color: btb.textDim, fontWeight: 400 }}>(instead of WETH)</span></span>
                <div style={{ width: 42, height: 24, borderRadius: 999, background: useEth ? '#52E3A4' : 'rgba(255,255,255,0.18)', position: 'relative', transition: 'background 0.2s' }}>
                  <div style={{ position: 'absolute', top: 2, left: useEth ? 20 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }}/>
                </div>
              </div>
            )}

            {/* Range */}
            <div style={{ color: btb.textMuted, fontSize: 12, marginBottom: 6 }}>Price range</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {RANGE_PRESETS.map((r) => (
                <button key={r.label} onClick={() => setRangePct(r.pct)} style={{
                  flex: 1, height: 38, borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                  background: rangePct === r.pct ? 'rgba(82,227,164,0.18)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${rangePct === r.pct ? 'rgba(82,227,164,0.5)' : 'rgba(255,255,255,0.1)'}`,
                  color: rangePct === r.pct ? '#52E3A4' : btb.textMuted,
                }}>{r.label}</button>
              ))}
            </div>

            {/* Amount (token0) */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ color: btb.textMuted, fontSize: 12 }}>Amount of {sym0}</span>
              <span style={{ color: btb.textMuted, fontSize: 12 }}>
                Balance: {fmtAmt(effBal0, pool.decimals0)}
                <span onClick={() => setAmtStr(formatUnits(effBal0, pool.decimals0))} style={{ color: btb.red, fontWeight: 700, marginLeft: 6, cursor: 'pointer' }}>MAX</span>
              </span>
            </div>
            <input
              value={amtStr}
              onChange={(e) => setAmtStr(e.target.value.replace(/[^0-9.]/g, ''))}
              inputMode="decimal" placeholder="0"
              style={{ width: '100%', height: 52, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, padding: '0 16px', color: btb.text, fontSize: 22, fontWeight: 700, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}/>
            {(short0 || short1) && (
              <div style={{ color: btb.loss, fontSize: 12, marginTop: 8 }}>
                Insufficient {short0 ? sym0 : sym1} balance
              </div>
            )}
            {(add0 > 0n || add1 > 0n) && (
              <Glass padding={12} radius={12} soft style={{ marginTop: 10 }}>
                <div style={{ color: btb.textMuted, fontSize: 12, marginBottom: 4 }}>You deposit</div>
                <div style={{ color: btb.text, fontSize: 14, fontWeight: 700 }}>
                  {fmtAmt(add0, pool.decimals0)} {sym0} + {fmtAmt(add1, pool.decimals1)} {sym1}
                </div>
              </Glass>
            )}
          </>
        )}

        {err && <div style={{ color: btb.loss, fontSize: 12, marginTop: 12 }}>{err}</div>}

        <button onClick={mint} disabled={!canMint} style={{
          width: '100%', height: 56, borderRadius: 18, border: 'none', marginTop: 18, fontFamily: 'inherit', fontSize: 16, fontWeight: 800,
          cursor: canMint ? 'pointer' : 'default',
          background: canMint ? 'linear-gradient(135deg,#52E3A4,#1aad77)' : 'rgba(255,255,255,0.07)',
          color: canMint ? '#fff' : btb.textDim,
        }}>{busy ? 'Confirming…' : (short0 || short1) ? 'Insufficient balance' : 'Add liquidity'}</button>
        <div style={{ color: btb.textDim, fontSize: 11, textAlign: 'center', marginTop: 10, lineHeight: 1.5 }}>
          Slippage-protected ({SLIPPAGE_BPS / 100}%). Approvals included.{wethSide !== null ? ' Pay with ETH or WETH.' : ''}
        </div>
      </div>
    </div>
  );
}
