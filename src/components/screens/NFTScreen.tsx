'use client';
import { useState, useEffect } from 'react';
import { useConnection, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { useMutation } from 'convex/react';
import { parseEther, formatUnits } from 'viem';
import { Glass } from '../Glass';
import { Icon } from '../Icon';
import { btb } from '../design-tokens';
import { CONTRACTS } from '../../lib/wagmi';
import { BEAR_NFT_ABI, BEAR_STAKING_ABI } from '../../contracts/abis';
import { api } from '../../../convex/_generated/api';

const ZERO = '0x0000000000000000000000000000000000000000' as `0x${string}`;
const MINT_XP = 1000; // per NFT minted

// ─── Shared helpers ───────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Glass padding={12} radius={16} soft style={{ textAlign: 'center' }}>
      <div style={{ color: btb.textMuted, fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ color: btb.text, fontSize: 14, fontWeight: 800, marginTop: 4 }}>{value}</div>
    </Glass>
  );
}

const spinStyle: React.CSSProperties = { width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.25)', borderTopColor: '#fff', animation: 'nftspin 0.8s linear infinite', flexShrink: 0 };

function PrimaryBtn({ label, icon, loading, disabled, onClick, green }: {
  label: string; icon: string; loading?: boolean; disabled?: boolean; onClick?: () => void; green?: boolean;
}) {
  const active = !disabled && !loading;
  return (
    <button onClick={onClick} disabled={!active} style={{
      flex: 1, width: '100%', height: 60, borderRadius: 18, border: 'none',
      cursor: active ? 'pointer' : 'default',
      background: !active ? 'rgba(255,255,255,0.07)'
        : green ? 'linear-gradient(135deg,#52E3A4,#1aad77)'
        : 'linear-gradient(135deg,rgba(255,255,255,0.18),rgba(255,255,255,0.08))',
      color: !active ? btb.textDim : '#fff',
      fontSize: 17, fontWeight: 700, fontFamily: 'inherit',
      boxShadow: !active ? 'none' : green ? '0 8px 20px rgba(82,227,164,0.3)' : '0 8px 20px rgba(255,255,255,0.12)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      opacity: loading ? 0.75 : 1, transition: 'opacity 0.2s',
    }}>
      {loading ? <><div style={spinStyle}/>{label}</> : <><Icon name={icon} size={18}/>{label}</>}
    </button>
  );
}

function ErrBox({ err }: { err: Error | null }) {
  if (!err) return null;
  return (
    <div style={{ background: 'rgba(255,107,122,0.12)', border: '1px solid rgba(255,107,122,0.35)', borderRadius: 14, padding: '10px 14px', color: btb.loss, fontSize: 13 }}>
      {(err as any)?.shortMessage ?? err.message}
    </div>
  );
}

// ─── Mint tab ────────────────────────────────────────────────────────────────

function MintTab({ address }: { address?: string }) {
  // qty is backed by a string so the input can be cleared/typed freely
  // (e.g. type "200"); `qty` below is the clamped number actually minted.
  const [qtyStr, setQtyStr] = useState('1');
  const addr = (address ?? ZERO) as `0x${string}`;

  const { data, refetch, isLoading } = useReadContracts({
    contracts: [
      { address: CONTRACTS.BEAR_NFT, abi: BEAR_NFT_ABI, functionName: 'totalMinted'     },
      { address: CONTRACTS.BEAR_NFT, abi: BEAR_NFT_ABI, functionName: 'pricePerNFT'     },
      { address: CONTRACTS.BEAR_NFT, abi: BEAR_NFT_ABI, functionName: 'remainingSupply' },
      { address: CONTRACTS.BEAR_NFT, abi: BEAR_NFT_ABI, functionName: 'balanceOf', args: [addr] },
    ] as const,
    query: { refetchInterval: 20_000 },
  });

  const minted      = Number(data?.[0]?.result ?? 0);
  const priceWei    = (data?.[1]?.result as bigint | undefined) ?? parseEther('0.01');
  const remaining   = Number(data?.[2]?.result ?? 100_000);
  const userBalance = address ? Number(data?.[3]?.result ?? 0) : 0;
  const priceEth    = parseFloat(formatUnits(priceWei, 18));
  const pct         = (minted / 100_000) * 100;
  // 200 NFTs mint in a single tx, so that's the per-tx cap (or whatever's left).
  const maxQty      = Math.max(1, Math.min(remaining || 200, 200));
  // Clamped quantity actually used for cost, the tx, and XP.
  const qty         = Math.min(maxQty, Math.max(1, parseInt(qtyStr || '1', 10) || 1));
  const setQty      = (n: number) => setQtyStr(String(Math.min(maxQty, Math.max(1, n))));

  const awardXp = useMutation(api.users.awardXp);
  const { writeContract, data: txHash, isPending, error: writeErr, reset } = useWriteContract();
  const { isSuccess, isLoading: confirming } = useWaitForTransactionReceipt({ hash: txHash });
  useEffect(() => {
    if (!isSuccess) return;
    if (address) awardXp({ walletAddress: address, amount: MINT_XP * qty, reason: 'mint' }).catch(() => {});
    refetch();
    reset();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess]);

  function doMint() {
    writeContract({
      address: CONTRACTS.BEAR_NFT,
      abi: BEAR_NFT_ABI,
      functionName: 'buyNFT',
      args: [BigInt(qty)],
      value: priceWei * BigInt(qty),
    });
  }

  const loading = isPending || confirming;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* NFT artwork card */}
      <Glass padding={16} radius={28} strong>
        <div style={{
          height: 120, borderRadius: 20, position: 'relative', overflow: 'hidden',
          background: 'linear-gradient(135deg,#0F172A 0%,#334155 35%,#FFFFFF 65%,rgba(255,255,255,0.7) 85%,#F59E0B 100%)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25), 0 16px 40px rgba(255,255,255,0.2)',
        }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 25% 20%, rgba(255,255,255,0.4), transparent 45%)' }}/>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 80% 75%, rgba(240,180,255,0.35), transparent 50%)' }}/>
          {/* Bear SVG */}
          <svg viewBox="0 0 200 200" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.28 }}>
            <ellipse cx="100" cy="130" rx="55" ry="50" fill="#fff"/>
            <circle cx="100" cy="85" r="42" fill="#fff"/>
            <circle cx="68" cy="52" r="18" fill="#fff"/>
            <circle cx="132" cy="52" r="18" fill="#fff"/>
            <circle cx="92" cy="88" r="7" fill="#0F172A"/>
            <circle cx="108" cy="88" r="7" fill="#0F172A"/>
            <ellipse cx="100" cy="102" rx="10" ry="6" fill="#0F172A"/>
          </svg>
          <div style={{ position: 'absolute', bottom: 14, left: 16, color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', textShadow: '0 1px 6px rgba(0,0,0,0.5)' }}>
            BTB BEAR {isLoading ? '…' : `· #${minted + 1}`}
          </div>
          {userBalance > 0 && (
            <div style={{ position: 'absolute', top: 14, right: 14, background: 'rgba(82,227,164,0.2)', border: '1px solid rgba(82,227,164,0.4)', color: '#52E3A4', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 999 }}>
              You own {userBalance}
            </div>
          )}
        </div>

        <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ color: btb.text, fontSize: 20, fontWeight: 800, letterSpacing: -0.4 }}>BTB Bear NFT</div>
            <div style={{ color: btb.textMuted, fontSize: 13, marginTop: 2 }}>Stake to earn BTBB rewards</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: btb.amber, fontSize: 16, fontWeight: 800 }}>{priceEth} ETH</div>
            <div style={{ color: btb.textMuted, fontSize: 11 }}>per NFT</div>
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ color: btb.textMuted, fontSize: 12 }}>
              {isLoading ? 'Loading…' : `${minted.toLocaleString()} / 100,000 minted`}
            </span>
            <span style={{ color: btb.text, fontSize: 12, fontWeight: 700 }}>{pct.toFixed(2)}%</span>
          </div>
          <div style={{ height: 6, borderRadius: 6, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: 'linear-gradient(90deg,#FFFFFF,rgba(255,255,255,0.7),#F59E0B)', boxShadow: '0 0 10px rgba(255,255,255,0.2)', transition: 'width 0.5s' }}/>
          </div>
        </div>
      </Glass>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
        <StatCard label="Max supply"  value="100,000" />
        <StatCard label="Remaining"   value={isLoading ? '…' : remaining.toLocaleString()} />
        <StatCard label="Royalty"     value="5%" />
      </div>

      {/* Quantity selector */}
      <Glass padding={16} radius={22}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ color: btb.text, fontSize: 15, fontWeight: 600 }}>Quantity</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => setQty(qty - 1)}
              style={{ width: 38, height: 38, borderRadius: 12, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)', color: '#fff', fontSize: 22, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              −
            </button>
            <input
              value={qtyStr}
              onChange={(e) => setQtyStr(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))}
              onBlur={() => setQtyStr(String(qty))}
              inputMode="numeric"
              aria-label="Mint quantity"
              style={{
                width: 70, height: 38, textAlign: 'center',
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)',
                borderRadius: 12, color: btb.text, fontSize: 20, fontWeight: 700, fontFamily: 'inherit',
                outline: 'none', MozAppearance: 'textfield',
              }}
            />
            <button onClick={() => setQty(qty + 1)}
              style={{ width: 38, height: 38, borderRadius: 12, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)', color: '#fff', fontSize: 22, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              +
            </button>
          </div>
        </div>
        {/* Quick-select — 200 is the max that fits in a single mint tx. */}
        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          {[1, 10, 50, 100, maxQty].filter((v, i, a) => a.indexOf(v) === i).map(v => (
            <button key={v} onClick={() => setQty(v)}
              style={{
                flex: 1, height: 34, borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 13, fontWeight: 700,
                background: qty === v ? 'rgba(245,158,11,0.18)' : 'rgba(255,255,255,0.06)',
                border: `1px solid ${qty === v ? 'rgba(245,158,11,0.5)' : 'rgba(255,255,255,0.12)'}`,
                color: qty === v ? btb.amber : btb.textMuted,
              }}>
              {v === maxQty && v > 100 ? `Max ${v}` : v}
            </button>
          ))}
        </div>
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ color: btb.textMuted, fontSize: 13 }}>Total cost</span>
          <div style={{ color: btb.text, fontWeight: 800, fontSize: 22, letterSpacing: -0.4 }}>
            {(priceEth * qty).toFixed(4)} <span style={{ color: btb.textMuted, fontSize: 14, fontWeight: 600 }}>ETH</span>
          </div>
        </div>
      </Glass>

      {isSuccess && (
        <div style={{ background: 'rgba(82,227,164,0.1)', border: '1px solid rgba(82,227,164,0.3)', borderRadius: 14, padding: '10px 14px', color: '#52E3A4', fontSize: 13, fontWeight: 600 }}>
          Minted {qty} BTB Bear NFT{qty > 1 ? 's' : ''}! · +{(MINT_XP * qty).toLocaleString('en-US')} XP
        </div>
      )}
      <ErrBox err={writeErr}/>

      <PrimaryBtn
        label={loading ? 'Minting…' : !address ? 'Connect wallet' : remaining === 0 ? 'Sold out' : `Mint ${qty} NFT${qty > 1 ? 's' : ''}`}
        icon="bolt" loading={loading} disabled={!address || remaining === 0}
        onClick={doMint} green
      />
    </div>
  );
}

// ─── Stake tab ───────────────────────────────────────────────────────────────

function StakeTab({ address }: { address?: string }) {
  const [unstakeCount, setUnstakeCount] = useState(1);
  const addr = (address ?? ZERO) as `0x${string}`;

  // Pool stats + user info in one batch
  const { data, refetch, isLoading } = useReadContracts({
    contracts: [
      { address: CONTRACTS.BEAR_STAKING, abi: BEAR_STAKING_ABI, functionName: 'getStats'         },
      { address: CONTRACTS.BEAR_STAKING, abi: BEAR_STAKING_ABI, functionName: 'getUserInfo',       args: [addr] },
      { address: CONTRACTS.BEAR_STAKING, abi: BEAR_STAKING_ABI, functionName: 'pendingRewardsNet', args: [addr] },
      { address: CONTRACTS.BEAR_NFT,     abi: BEAR_NFT_ABI,     functionName: 'balanceOf',         args: [addr] },
      { address: CONTRACTS.BEAR_NFT,     abi: BEAR_NFT_ABI,     functionName: 'isApprovedForAll',  args: [addr, CONTRACTS.BEAR_STAKING] },
    ] as const,
    query: { refetchInterval: 15_000 },
  });

  const stats        = data?.[0]?.result as readonly [bigint, bigint, bigint, bigint, bigint] | undefined;
  const userInfo     = data?.[1]?.result as readonly [bigint, bigint, bigint] | undefined;
  const pendingRaw   = (data?.[2]?.result as bigint | undefined) ?? BigInt(0);
  const myBalance    = address ? Number(data?.[3]?.result ?? 0) : 0;
  const isApproved   = (data?.[4]?.result as boolean | undefined) ?? false;

  const totalStaked      = Number(stats?.[0] ?? 0);
  const totalRewardsBig  = stats?.[1] ?? BigInt(0);
  const rewards24hBig    = stats?.[3] ?? BigInt(0);
  // Contract's estimatedAPR = (annualRewards_wei * 1e4) / totalStaked.
  // Divide by 1e22 (1e18 token decimals × 1e4 bps scale) → BTBB per NFT per year.
  const aprRawBig        = stats?.[4] ?? BigInt(0);
  const myStaked         = Number(userInfo?.[0] ?? 0);

  const pendingBtbb       = parseFloat(formatUnits(pendingRaw, 18));
  const totalRewardsBtbb  = parseFloat(formatUnits(totalRewardsBig, 18));
  const rewards24hBtbb    = parseFloat(formatUnits(rewards24hBig, 18));
  const annualBtbbPerNft  = totalStaked > 0 && aprRawBig > 0n ? parseFloat(formatUnits(aprRawBig, 22)) : 0;
  const cappedUnstake     = Math.min(unstakeCount, myStaked);

  const { writeContract, data: txHash, isPending, error: writeErr, reset } = useWriteContract();
  const { isSuccess, isLoading: confirming } = useWaitForTransactionReceipt({ hash: txHash });
  useEffect(() => { if (isSuccess) { refetch(); reset(); } }, [isSuccess]);

  // Fetch wallet token IDs for staking — gas-safe batch cap.
  const STAKE_BATCH = 25;
  const { data: tokenData } = useReadContracts({
    contracts: Array.from({ length: Math.min(myBalance, STAKE_BATCH) }, (_, i) => ({
      address: CONTRACTS.BEAR_NFT,
      abi: BEAR_NFT_ABI,
      functionName: 'tokenOfOwnerByIndex' as const,
      args: [addr, BigInt(i)] as [`0x${string}`, bigint],
    })),
    query: { enabled: myBalance > 0 },
  });
  const walletTokenIds = (tokenData ?? []).map(r => r?.result as bigint).filter(Boolean);

  const loading = isPending || confirming;

  function doApprove()  { writeContract({ address: CONTRACTS.BEAR_NFT,     abi: BEAR_NFT_ABI,     functionName: 'setApprovalForAll', args: [CONTRACTS.BEAR_STAKING, true] }); }
  function doStakeAll() { writeContract({ address: CONTRACTS.BEAR_STAKING, abi: BEAR_STAKING_ABI, functionName: 'stake',            args: [walletTokenIds]               }); }
  function doUnstake()  { writeContract({ address: CONTRACTS.BEAR_STAKING, abi: BEAR_STAKING_ABI, functionName: 'unstake',          args: [BigInt(cappedUnstake)]        }); }
  function doClaim()    { writeContract({ address: CONTRACTS.BEAR_STAKING, abi: BEAR_STAKING_ABI, functionName: 'claim',            args: []                              }); }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Pool stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
        <StatCard label="Total staked"  value={isLoading ? '…' : totalStaked.toLocaleString()} />
        <StatCard label="BTBB / NFT yr" value={isLoading ? '…' : annualBtbbPerNft > 0 ? annualBtbbPerNft.toLocaleString('en-US', { maximumFractionDigits: 1 }) : '—'} />
        <StatCard label="Rewards 24h"   value={isLoading ? '…' : rewards24hBtbb > 0 ? `${rewards24hBtbb.toLocaleString('en-US', { maximumFractionDigits: 0 })} BTBB` : '—'} />
      </div>

      {/* Pending rewards */}
      <Glass padding={20} radius={22} strong>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ color: btb.textMuted, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Pending rewards</div>
            <div style={{ color: '#52E3A4', fontSize: 34, fontWeight: 800, letterSpacing: -1.2, marginTop: 6 }}>
              {isLoading ? '…' : pendingBtbb.toLocaleString('en-US', { maximumFractionDigits: 6 })}
            </div>
            <div style={{ color: btb.textMuted, fontSize: 12, marginTop: 2 }}>BTBB · net after 1% transfer tax</div>
          </div>
          <div style={{ width: 54, height: 54, borderRadius: 18, background: 'rgba(82,227,164,0.12)', border: '1px solid rgba(82,227,164,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name="gift" size={26} color="#52E3A4"/>
          </div>
        </div>
        <button onClick={doClaim} disabled={!address || pendingBtbb < 0.000001 || loading} style={{
          marginTop: 16, width: '100%', height: 60, borderRadius: 18, border: 'none',
          cursor: address && pendingBtbb >= 0.000001 && !loading ? 'pointer' : 'default',
          background: address && pendingBtbb >= 0.000001 ? 'linear-gradient(135deg,#52E3A4,#1aad77)' : 'rgba(255,255,255,0.07)',
          color: address && pendingBtbb >= 0.000001 ? '#fff' : btb.textDim,
          fontSize: 17, fontWeight: 700, fontFamily: 'inherit',
          boxShadow: address && pendingBtbb >= 0.000001 ? '0 6px 16px rgba(82,227,164,0.25)' : 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          {loading ? <><div style={spinStyle}/>Processing…</> : <><Icon name="receive" size={18}/>Claim rewards</>}
        </button>
      </Glass>

      {/* My position */}
      <Glass padding={16} radius={22}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ color: btb.text, fontSize: 16, fontWeight: 700 }}>My position</span>
          {!address && <span style={{ color: btb.textMuted, fontSize: 13 }}>Not connected</span>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          {[
            { label: 'Staked', value: isLoading ? '…' : String(myStaked), sub: 'NFTs' },
            { label: 'In wallet', value: isLoading ? '…' : String(myBalance), sub: 'NFTs' },
          ].map(({ label, value, sub }) => (
            <div key={label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: '12px 14px' }}>
              <div style={{ color: btb.textMuted, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
              <div style={{ color: btb.text, fontSize: 28, fontWeight: 800, marginTop: 4, letterSpacing: -0.5 }}>{value}</div>
              <div style={{ color: btb.textMuted, fontSize: 11 }}>{sub}</div>
            </div>
          ))}
        </div>

        {address ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Stake flow */}
            {myBalance > 0 && (
              !isApproved
                ? <PrimaryBtn label={loading ? 'Approving…' : 'Approve NFTs for staking'} icon="check" loading={loading} onClick={doApprove}/>
                : <>
                    <PrimaryBtn label={loading ? 'Staking…' : `Stake ${Math.min(myBalance, STAKE_BATCH)} NFT${Math.min(myBalance, STAKE_BATCH) > 1 ? 's' : ''}`} icon="layers" loading={loading} disabled={walletTokenIds.length === 0} onClick={doStakeAll}/>
                    {myBalance > STAKE_BATCH && (
                      <div style={{ color: btb.textMuted, fontSize: 11, textAlign: 'center' }}>
                        Staking first {STAKE_BATCH} of {myBalance}. Run again to stake the rest.
                      </div>
                    )}
                  </>
            )}

            {/* Unstake flow */}
            {myStaked > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: '8px 16px', flexShrink: 0 }}>
                  <button onClick={() => setUnstakeCount(c => Math.max(1, c - 1))} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer', padding: 0, lineHeight: 1 }}>−</button>
                  <span style={{ color: btb.text, fontSize: 18, fontWeight: 700, minWidth: 24, textAlign: 'center' }}>{cappedUnstake}</span>
                  <button onClick={() => setUnstakeCount(c => Math.min(myStaked, c + 1))} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer', padding: 0, lineHeight: 1 }}>+</button>
                </div>
                <PrimaryBtn label={loading ? 'Unstaking…' : 'Unstake'} icon="send" loading={loading} onClick={doUnstake} green/>
              </div>
            )}

            {myBalance === 0 && myStaked === 0 && !isLoading && (
              <div style={{ color: btb.textMuted, fontSize: 13, textAlign: 'center', padding: '8px 0' }}>
                Mint BTB Bear NFTs on the Mint tab, then stake them here to earn BTBB.
              </div>
            )}
          </div>
        ) : null}
      </Glass>

      {/* Protocol info */}
      <Glass padding={14} radius={18} soft>
        {[
          ['Reward token',  'BTBB (BTB Bear)'],
          ['Reward source', '1% tax on all BTBB transfers'],
          ['On claim tax',  '1% BTBB transfer tax'],
          ['Pool type',     'Fungible · equal share per NFT'],
        ].map(([l, v], i, a) => (
          <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 4px', borderBottom: i < a.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
            <span style={{ color: btb.textMuted, fontSize: 13 }}>{l}</span>
            <span style={{ color: btb.text, fontSize: 13, fontWeight: 600 }}>{v}</span>
          </div>
        ))}
      </Glass>

      <ErrBox err={writeErr}/>
    </div>
  );
}

// ─── NFTScreen ───────────────────────────────────────────────────────────────

export function NFTScreen() {
  const { address } = useConnection();
  const [tab, setTab] = useState<'mint' | 'stake'>('mint');

  return (
    <div style={{ padding: 'env(safe-area-inset-top, 24px) 18px 100px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px' }}>
        <div style={{ color: btb.text, fontSize: 28, fontWeight: 800, letterSpacing: -0.6 }}>BTB Bear</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999, background: 'rgba(226,232,240,0.2)', border: '1px solid rgba(255,255,255,0.2)' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.7)', boxShadow: '0 0 8px rgba(255,255,255,0.7)', display: 'inline-block' }}/>
          <span style={{ color: '#fff', fontSize: 12, fontWeight: 700, letterSpacing: 0.3 }}>LIVE</span>
        </div>
      </div>

      {/* Tabs */}
      <Glass padding={4} radius={18} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
        {(['mint', 'stake'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            height: 42, borderRadius: 14, border: 'none', cursor: 'pointer',
            background: tab === t ? 'linear-gradient(135deg,rgba(255,255,255,0.18),rgba(255,255,255,0.08))' : 'transparent',
            color: tab === t ? '#fff' : btb.textMuted,
            fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
            boxShadow: tab === t ? '0 4px 12px rgba(255,255,255,0.1)' : 'none',
            transition: 'all 0.2s', textTransform: 'capitalize',
          }}>{t === 'mint' ? 'Mint NFT' : 'Stake & Earn'}</button>
        ))}
      </Glass>

      {tab === 'mint'  && <MintTab  address={address}/>}
      {tab === 'stake' && <StakeTab address={address}/>}

      <style>{`@keyframes nftspin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
