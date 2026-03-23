'use client'

import { useState, useEffect } from 'react'
import { useAccount, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import Link from 'next/link'
import { Header } from '@/components/Header'
import { CONTRACTS, BEAR_STAKING_ABI, BEAR_NFT_ABI, BTBB_ABI } from '@/lib/contracts'
import { formatCompact } from '@/lib/utils'
import { useProtocol } from '@/lib/protocol-context'
import { Check, ShieldCheck, Flame, Gift, Minus, Plus, ArrowUpRight } from 'lucide-react'

const NFT_IMAGE_BASE = 'https://bafybeidlyvep6mqlaleervelrr2ev2bs2dxljsz3gs2wk4p5c6e23mvffu.ipfs.w3s.link'
const nftImage = (id: bigint) => `${NFT_IMAGE_BASE}/${id.toString()}.png`

type PendingAction = 'approve-then-stake' | 'stake' | 'unstake' | 'claim' | 'claim-then-redeem' | 'redeem' | null

function PageBackground() {
  return (
    <>
      <div className="fixed inset-0 -z-30 bg-[#030308]" aria-hidden />
      <div
        className="fixed inset-0 -z-20 opacity-[0.4] [mask-image:linear-gradient(to_bottom,black_40%,transparent)]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
        }}
        aria-hidden
      />
      <div
        className="fixed inset-0 -z-20 opacity-30"
        style={{
          backgroundImage: 'linear-gradient(115deg, transparent 40%, rgba(239,68,68,0.07) 50%, transparent 60%)',
        }}
        aria-hidden
      />
      <div
        className="fixed -top-1/3 left-1/2 -translate-x-1/2 w-[140%] max-w-[1100px] aspect-square rounded-full -z-20 pointer-events-none opacity-90"
        style={{
          background: 'radial-gradient(circle at 50% 40%, rgba(239,68,68,0.14) 0%, transparent 55%)',
        }}
        aria-hidden
      />
      <div
        className="fixed bottom-0 right-0 w-[80vw] h-[50vh] -z-20 pointer-events-none opacity-70"
        style={{
          background: 'radial-gradient(ellipse at 100% 100%, rgba(251,191,36,0.08) 0%, transparent 60%)',
        }}
        aria-hidden
      />
      <div className="fixed inset-x-0 top-0 h-px z-0 bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" aria-hidden />
    </>
  )
}

export default function Stake() {
  const { address } = useAccount()
  const {
    stakingStats,
    nftStakedCount: stakedCount,
    nftBalance: unstakedCount,
    nftApprovedForStaking: isApproved,
    pendingRewards,
    refetch: refetchGlobal,
  } = useProtocol()

  const [selectedTokens, setSelectedTokens] = useState<bigint[]>([])
  const [unstakeCount, setUnstakeCount] = useState(1)
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)

  useEffect(() => {
    if (stakedCount !== undefined && unstakeCount > Number(stakedCount)) {
      setUnstakeCount(Math.max(1, Number(stakedCount)))
    }
  }, [stakedCount, unstakeCount])

  const unstakedNum = Number(unstakedCount || 0)
  const { data: tokenIdData } = useReadContracts({
    contracts:
      address && unstakedNum > 0
        ? Array.from({ length: Math.min(unstakedNum, 50) }, (_, i) => ({
            address: CONTRACTS.BEAR_NFT,
            abi: BEAR_NFT_ABI,
            functionName: 'tokenOfOwnerByIndex' as const,
            args: [address, BigInt(i)] as const,
          }))
        : [],
    allowFailure: true,
  })

  const unstakedSlots: (bigint | null)[] = Array.from({ length: Math.min(unstakedNum, 50) }, (_, i) => {
    const d = tokenIdData?.[i]
    return d?.result !== undefined ? (d.result as bigint) : null
  })
  const unstakedTokens = unstakedSlots.filter((id): id is bigint => id !== null)

  const grossPending = pendingRewards ? pendingRewards[0] : 0n
  const netPending = pendingRewards ? pendingRewards[1] : 0n

  const { data: hash, writeContract, isPending, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  useEffect(() => {
    if (!isSuccess || !pendingAction) return
    const chain = async () => {
      await refetchGlobal()
      if (pendingAction === 'approve-then-stake') {
        reset()
        setPendingAction('stake')
        writeContract({
          address: CONTRACTS.BEAR_STAKING,
          abi: BEAR_STAKING_ABI,
          functionName: 'stake',
          args: [selectedTokens],
        })
      } else if (pendingAction === 'claim-then-redeem') {
        reset()
        setPendingAction('redeem')
        writeContract({
          address: CONTRACTS.BTBB,
          abi: BTBB_ABI,
          functionName: 'redeem',
          args: [netPending],
        })
      } else {
        setPendingAction(null)
        setSelectedTokens([])
        reset()
      }
    }
    chain()
  }, [isSuccess])

  const toggleToken = (id: bigint) => {
    setSelectedTokens((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]))
  }

  const handleStake = () => {
    if (selectedTokens.length === 0) return
    if (!isApproved) {
      setPendingAction('approve-then-stake')
      writeContract({
        address: CONTRACTS.BEAR_NFT,
        abi: BEAR_NFT_ABI,
        functionName: 'setApprovalForAll',
        args: [CONTRACTS.BEAR_STAKING, true],
      })
      return
    }
    setPendingAction('stake')
    writeContract({
      address: CONTRACTS.BEAR_STAKING,
      abi: BEAR_STAKING_ABI,
      functionName: 'stake',
      args: [selectedTokens],
    })
  }

  const handleUnstake = () => {
    if (!stakedCount || stakedCount === 0n || unstakeCount <= 0) return
    setPendingAction('unstake')
    writeContract({
      address: CONTRACTS.BEAR_STAKING,
      abi: BEAR_STAKING_ABI,
      functionName: 'unstake',
      args: [BigInt(unstakeCount)],
    })
  }

  const handleClaim = () => {
    setPendingAction('claim')
    writeContract({ address: CONTRACTS.BEAR_STAKING, abi: BEAR_STAKING_ABI, functionName: 'claim' })
  }

  const handleClaimAndRedeem = () => {
    setPendingAction('claim-then-redeem')
    writeContract({ address: CONTRACTS.BEAR_STAKING, abi: BEAR_STAKING_ABI, functionName: 'claim' })
  }

  const busy = isPending || isConfirming
  const tvl = stakingStats ? Number(stakingStats[0]).toLocaleString() : '—'
  const dailyPerNft = stakingStats && stakingStats[0] > 0n ? stakingStats[3] / stakingStats[0] : 0n
  const annualPerNft = dailyPerNft * 365n

  const stakeButtonLabel =
    busy && (pendingAction === 'approve-then-stake' || pendingAction === 'stake')
      ? pendingAction === 'approve-then-stake' && !isSuccess
        ? 'Approving...'
        : 'Staking...'
      : !isApproved
        ? `Approve and stake ${selectedTokens.length} Bear${selectedTokens.length !== 1 ? 's' : ''}`
        : `Stake ${selectedTokens.length} Bear${selectedTokens.length !== 1 ? 's' : ''}`

  return (
    <div className="relative z-10 min-h-dvh font-sans pb-28 overflow-x-hidden text-text">
      <PageBackground />

      <Header />

      <main className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 pb-16 space-y-10 sm:space-y-12">
        <header className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] font-mono uppercase tracking-[0.2em] text-text-secondary mb-5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/90" />
            Tax route · staking
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-semibold tracking-tight text-white leading-tight">
            Stake <span className="italic text-primary-light">Bears</span>, earn <span className="italic text-amber-300/90">BTBB</span>
          </h1>
          <p className="mt-4 text-base sm:text-lg text-text-secondary leading-relaxed">
            Select NFTs from your wallet, approve once, then stake. Rewards accrue from BTBB transfer tax; claim or redeem when you want.
          </p>
        </header>

        <section className="rounded-xl border border-white/[0.08] bg-black/40 backdrop-blur-md overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3 border-b border-white/[0.06] bg-white/[0.02]">
            <span className="text-xs font-mono uppercase tracking-widest text-text-secondary">Staking overview</span>
            <Link href="/wrap" className="text-xs font-semibold text-primary-light hover:underline inline-flex items-center gap-1">
              Need BTBB? Wrap
              <ArrowUpRight className="h-3 w-3" aria-hidden />
            </Link>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 divide-white/[0.06] lg:divide-x">
            <div className="p-4 sm:p-5">
              <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-mono uppercase tracking-wider text-text-muted mb-2">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-text-secondary" aria-hidden />
                Total staked
              </div>
              <p className="text-2xl sm:text-3xl font-semibold text-white tabular-nums truncate">{tvl}</p>
            </div>
            <div className="p-4 sm:p-5">
              <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-mono uppercase tracking-wider text-text-muted mb-2">
                <Flame className="h-3.5 w-3.5 shrink-0 text-amber-400/90" aria-hidden />
                Per NFT / day
              </div>
              <p className="text-2xl sm:text-3xl font-semibold text-primary-light tabular-nums truncate">{formatCompact(dailyPerNft)}</p>
              <p className="text-[10px] sm:text-xs text-text-muted mt-1">~{formatCompact(annualPerNft)} BTBB / yr est.</p>
            </div>
            <div className="p-4 sm:p-5">
              <div className="text-[10px] sm:text-xs font-mono uppercase tracking-wider text-text-muted mb-2">My staked</div>
              <p className="text-2xl sm:text-3xl font-semibold text-white tabular-nums">{stakedCount !== undefined ? stakedCount.toString() : '—'}</p>
            </div>
            <div className="p-4 sm:p-5">
              <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-mono uppercase tracking-wider text-text-muted mb-2">
                <Gift className="h-3.5 w-3.5 shrink-0 text-primary-light" aria-hidden />
                Pending (net)
              </div>
              <p className="text-2xl sm:text-3xl font-semibold text-white tabular-nums truncate">{formatCompact(netPending)}</p>
              <p className="text-[10px] text-text-muted mt-0.5">BTBB</p>
              {grossPending > 0n && (
                <div className="flex flex-wrap gap-2 mt-3">
                  <button
                    type="button"
                    onClick={handleClaim}
                    disabled={busy}
                    className="text-xs font-semibold text-primary-light hover:text-white underline-offset-4 hover:underline disabled:opacity-40"
                  >
                    {busy && pendingAction === 'claim' ? 'Claiming…' : 'Claim BTBB'}
                  </button>
                  <button
                    type="button"
                    onClick={handleClaimAndRedeem}
                    disabled={busy}
                    className="text-xs font-semibold text-amber-400/90 hover:text-amber-200 underline-offset-4 hover:underline disabled:opacity-40"
                  >
                    {busy && (pendingAction === 'claim-then-redeem' || pendingAction === 'redeem')
                      ? pendingAction === 'claim-then-redeem' && !isSuccess
                        ? 'Claiming…'
                        : 'Redeeming…'
                      : 'Claim as BTB'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
          <section className="rounded-xl border border-white/[0.08] bg-black/35 backdrop-blur-md flex flex-col min-h-[480px] overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-white/[0.06] bg-white/[0.02]">
              <h2 className="text-sm font-mono uppercase tracking-widest text-text-secondary">Wallet vault</h2>
              <div className="flex items-center gap-2">
                {unstakedTokens.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedTokens((prev) => (prev.length === unstakedTokens.length ? [] : [...unstakedTokens]))
                    }
                    className="rounded-md border border-white/10 px-2.5 py-1 text-[11px] font-semibold text-text-secondary hover:text-white hover:border-white/20 transition-colors"
                  >
                    {selectedTokens.length === unstakedTokens.length ? 'Clear' : 'Select all'}
                  </button>
                )}
                <span className="rounded-md border border-white/10 bg-white/[0.05] px-2.5 py-1 text-xs font-mono text-white">
                  {unstakedCount?.toString() ?? '0'} idle
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 min-h-[280px]">
              {!address ? (
                <div className="h-full min-h-[240px] flex items-center justify-center text-sm font-medium text-text-muted">Connect wallet</div>
              ) : unstakedNum > 0 ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 sm:gap-3">
                  {unstakedSlots.map((id, i) => {
                    if (id === null)
                      return <div key={`loading-${i}`} className="aspect-square rounded-lg border border-white/[0.06] bg-white/[0.04] animate-pulse" />
                    const selected = selectedTokens.includes(id)
                    return (
                      <button
                        type="button"
                        key={id.toString()}
                        onClick={() => toggleToken(id)}
                        className={`relative aspect-square rounded-lg border overflow-hidden text-left transition-all ${
                          selected
                            ? 'border-primary ring-1 ring-primary/50 shadow-[0_0_20px_rgba(239,68,68,0.2)]'
                            : 'border-white/[0.08] hover:border-white/20'
                        }`}
                      >
                        <img src={nftImage(id)} alt={`Bear #${id.toString()}`} className="h-full w-full object-cover" loading="lazy" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
                        <span className="absolute bottom-1.5 left-1.5 text-[11px] font-semibold text-white drop-shadow-sm z-10">
                          #{id.toString()}
                        </span>
                        {selected && (
                          <span className="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary z-10">
                            <Check className="h-3 w-3 text-white" aria-hidden />
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="h-full min-h-[240px] flex flex-col items-center justify-center gap-3 text-center px-4">
                  <p className="text-sm text-text-muted">No Bears in this wallet.</p>
                  <Link
                    href="/nft"
                    className="inline-flex items-center gap-1 text-sm font-semibold text-primary-light hover:underline"
                  >
                    Mint a Bear
                    <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-white/[0.06]">
              <button
                type="button"
                onClick={handleStake}
                disabled={busy || selectedTokens.length === 0}
                className="w-full rounded-md bg-primary py-3.5 text-sm font-semibold text-white hover:bg-primary-dark transition-colors disabled:opacity-40 disabled:pointer-events-none"
              >
                {stakeButtonLabel}
              </button>
            </div>
          </section>

          <section className="rounded-xl border border-primary/25 bg-primary/[0.05] backdrop-blur-md flex flex-col min-h-[480px] overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-primary/20 bg-black/20">
              <h2 className="text-sm font-mono uppercase tracking-widest text-primary-light/90">Staked</h2>
              <span className="rounded-md border border-primary/30 bg-primary/15 px-2.5 py-1 text-xs font-mono text-white">
                {stakedCount?.toString() ?? '0'} active
              </span>
            </div>

            <div className="flex-1 flex items-center justify-center p-6 min-h-[280px]">
              {!address ? (
                <p className="text-sm text-text-muted">Connect wallet</p>
              ) : stakedCount && stakedCount > 0n ? (
                <div className="text-center w-full max-w-xs space-y-6">
                  <p className="text-6xl sm:text-7xl font-semibold tabular-nums text-white tracking-tight">{stakedCount.toString()}</p>
                  <p className="text-xs font-mono uppercase tracking-widest text-text-muted">Bears earning rewards</p>
                  <div className="flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => setUnstakeCount((c) => Math.max(1, c - 1))}
                      className="flex h-11 w-11 items-center justify-center rounded-lg border border-primary/35 bg-black/30 text-primary-light hover:bg-primary/10 transition-colors"
                      aria-label="Decrease unstake count"
                    >
                      <Minus className="h-5 w-5" aria-hidden />
                    </button>
                    <span className="w-14 text-center text-2xl font-semibold tabular-nums text-white">{unstakeCount}</span>
                    <button
                      type="button"
                      onClick={() => setUnstakeCount((c) => Math.min(Number(stakedCount), c + 1))}
                      className="flex h-11 w-11 items-center justify-center rounded-lg border border-primary/35 bg-black/30 text-primary-light hover:bg-primary/10 transition-colors"
                      aria-label="Increase unstake count"
                    >
                      <Plus className="h-5 w-5" aria-hidden />
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-text-muted text-center">Nothing staked yet.</p>
              )}
            </div>

            <div className="p-4 border-t border-primary/20 bg-black/15">
              <button
                type="button"
                onClick={handleUnstake}
                disabled={busy || !stakedCount || stakedCount === 0n}
                className="w-full rounded-md border-2 border-primary/60 bg-transparent py-3.5 text-sm font-semibold text-primary-light hover:bg-primary/10 transition-colors disabled:opacity-40 disabled:pointer-events-none"
              >
                {busy && pendingAction === 'unstake' ? 'Unstaking…' : `Unstake ${unstakeCount} Bear${unstakeCount > 1 ? 's' : ''}`}
              </button>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
