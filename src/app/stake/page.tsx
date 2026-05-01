'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAccount, useReadContracts, useWaitForTransactionReceipt, useWriteContract } from 'wagmi'
import { ArrowUpRight, Flame, Layers3 } from 'lucide-react'
import { Header } from '@/components/Header'
import { BEAR_NFT_ABI, BEAR_STAKING_ABI, BTBB_ABI, CONTRACTS } from '@/lib/contracts'
import { formatCompact } from '@/lib/utils'
import { useProtocol } from '@/lib/protocol-context'

const NFT_IMAGE_BASE = 'https://bafybeidlyvep6mqlaleervelrr2ev2bs2dxljsz3gs2wk4p5c6e23mvffu.ipfs.w3s.link'
const nftImage = (id: bigint) => `${NFT_IMAGE_BASE}/${id.toString()}.png`

type PendingAction = 'approve-then-stake' | 'stake' | 'unstake' | 'claim' | 'claim-then-redeem' | 'redeem' | null

export default function StakePage() {
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
    const data = tokenIdData?.[i]
    return data?.result !== undefined ? (data.result as bigint) : null
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
        return
      }

      if (pendingAction === 'claim-then-redeem') {
        reset()
        setPendingAction('redeem')
        writeContract({
          address: CONTRACTS.BTBB,
          abi: BTBB_ABI,
          functionName: 'redeem',
          args: [netPending],
        })
        return
      }

      setPendingAction(null)
      setSelectedTokens([])
      reset()
    }

    chain()
  }, [isSuccess, netPending, pendingAction, refetchGlobal, reset, selectedTokens, writeContract])

  const toggleToken = (id: bigint) => {
    setSelectedTokens((current) => (current.includes(id) ? current.filter((token) => token !== id) : [...current, id]))
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
  const totalStaked = stakingStats ? Number(stakingStats[0]).toLocaleString() : '—'
  const dailyPerNft = stakingStats && stakingStats[0] > 0n ? stakingStats[3] / stakingStats[0] : 0n

  const stakeButtonLabel =
    busy && (pendingAction === 'approve-then-stake' || pendingAction === 'stake')
      ? pendingAction === 'approve-then-stake' && !isSuccess
        ? 'Approving...'
        : 'Staking...'
      : !isApproved
        ? `Approve and stake ${selectedTokens.length}`
        : `Stake ${selectedTokens.length} selected`

  return (
    <div className="page-shell min-h-screen">
      <Header title="BTB Finance / Stake" />

      <main className="page-frame">
        <section className="hero-grid">
          <div className="hero-panel surface-panel-strong flex flex-col gap-4">
            <div className="eyebrow">
              <Flame className="h-4 w-4" />
              Where the income actually comes from
            </div>
            <div>
              <h1 className="display-title">
                Stake once. Get paid for{' '}
                <span className="text-[var(--color-brand)]">every trade</span>{' '}
                anyone makes.
              </h1>
              <p className="lead-copy mt-3 max-w-2xl">
                Every BTBB transfer pays a 1% tax. The staking pool collects all of it and splits it across staked
                Bears, equally. <span className="font-black text-[var(--color-ink)]">Every arbitrage bot, every swap,
                every transfer becomes your paycheck.</span> No vesting, no cliff, no expiration. The pool runs as long
                as people use BTBB.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="metric-tile">
                <div className="metric-label">Network staked</div>
                <div className="metric-value">{totalStaked}</div>
                <div className="mt-2 text-[0.6rem] font-bold uppercase text-[var(--color-muted)]">Bears earning</div>
              </div>
              <div className="metric-tile">
                <div className="metric-label">Daily per bear</div>
                <div className="metric-value text-[var(--color-leaf)]">{formatCompact(dailyPerNft)}</div>
                <div className="mt-2 text-[0.6rem] font-bold uppercase text-[var(--color-muted)]">BTBB / day est.</div>
              </div>
              <div className="metric-tile">
                <div className="metric-label">Your pending</div>
                <div className="metric-value">{formatCompact(netPending)}</div>
                <div className="mt-2 text-[0.6rem] font-bold uppercase text-[var(--color-muted)]">BTBB net of tax</div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="surface-panel">
              <div className="eyebrow">
                <Layers3 className="h-4 w-4" />
                Three steps to start
              </div>
              <div className="mt-3 space-y-2 text-sm leading-6 text-[var(--color-copy)]">
                <p><span className="font-black text-[var(--color-ink)]">1.</span> Hold (or mint) at least one Bear NFT.</p>
                <p><span className="font-black text-[var(--color-ink)]">2.</span> Approve the staking contract — once per wallet.</p>
                <p><span className="font-black text-[var(--color-ink)]">3.</span> Stake your Bears. Rewards accrue from that block onward.</p>
              </div>
              <Link href="/nft" className="btn-secondary mt-4 w-full">
                Need to mint a Bear first
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="surface-panel">
              <div className="eyebrow">No lockup</div>
              <p className="mt-3 text-sm leading-6 text-[var(--color-copy)]">
                Unstake any time. Claim any time. There is no cliff, no slashing, no penalty. Stop whenever you want
                and your Bears come back.
              </p>
            </div>
          </div>
        </section>

        {/* THE BTBB FLYWHEEL */}
        <section className="surface-panel mt-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="eyebrow">
                <Flame className="h-4 w-4" />
                The reward engine
              </div>
              <h2 className="section-title mt-4">How BTBB tax becomes your income.</h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-[var(--color-copy)]">
              The income loop is on-chain. Every step is enforced by code, not by trust.
            </p>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="metric-tile flex flex-col gap-3">
              <span className="kicker-number">01</span>
              <h3 className="text-base font-black uppercase leading-tight text-[var(--color-ink)]">User wraps BTB → BTBB</h3>
              <p className="text-sm leading-6 text-[var(--color-copy)]">
                BTBB is the taxed asset. Wrapping is what creates the surface for transfer fees.
              </p>
            </div>
            <div className="metric-tile flex flex-col gap-3">
              <span className="kicker-number">02</span>
              <h3 className="text-base font-black uppercase leading-tight text-[var(--color-ink)]">BTBB gets traded — 1% tax</h3>
              <p className="text-sm leading-6 text-[var(--color-copy)]">
                Every transfer (DEX swap, wallet send, arb route) pays 1%. The tax is collected by the BTBB contract.
              </p>
            </div>
            <div className="metric-tile flex flex-col gap-3">
              <span className="kicker-number">03</span>
              <h3 className="text-base font-black uppercase leading-tight text-[var(--color-leaf)]">Tax routes to staking pool</h3>
              <p className="text-sm leading-6 text-[var(--color-copy)]">
                The staking contract pulls accumulated tax and adds it to the global rewards balance. Anyone can trigger.
              </p>
            </div>
            <div className="metric-tile flex flex-col gap-3">
              <span className="kicker-number">04</span>
              <h3 className="text-base font-black uppercase leading-tight text-[var(--color-leaf)]">You claim your share</h3>
              <p className="text-sm leading-6 text-[var(--color-copy)]">
                Each staked Bear earns an equal share. Claim as BTBB, or auto-unwrap into BTB in one click.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-3 grid gap-3 xl:grid-cols-[1.25fr_0.75fr]">
          <div className="surface-panel">
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="eyebrow">NFT selector</div>
                <h2 className="section-title mt-4">Choose the bears you want earning.</h2>
              </div>
              {address && unstakedTokens.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedTokens((current) => (current.length === unstakedTokens.length ? [] : [...unstakedTokens]))}
                  className="btn-secondary text-sm"
                >
                  {selectedTokens.length === unstakedTokens.length ? 'Clear all' : 'Select all'}
                </button>
              )}
            </div>

            <div className="min-h-[18rem]">
              {!address ? (
                <div className="flex min-h-[18rem] items-center justify-center rounded-lg border border-[var(--color-line)] bg-[var(--color-bg-strong)] px-6 text-center text-sm font-semibold text-[var(--color-copy)]">
                  Connect your wallet to load your Bear inventory.
                </div>
              ) : unstakedNum > 0 ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {unstakedSlots.map((id, index) => {
                    if (id === null) {
                      return <div key={`loading-${index}`} className="aspect-square animate-pulse rounded-md border border-[var(--color-line)] bg-[var(--color-surface-strong)]" />
                    }

                    const selected = selectedTokens.includes(id)

                    return (
                      <button
                        type="button"
                        key={id.toString()}
                        onClick={() => toggleToken(id)}
                        className={`relative overflow-hidden rounded-md border transition ${
                          selected
                            ? 'border-[var(--color-brand)] shadow-[0_0_0_2px_rgba(49,255,154,0.35)]'
                            : 'border-[var(--color-line)] hover:-translate-y-0.5 hover:border-[var(--color-line-strong)]'
                        }`}
                      >
                        <img src={nftImage(id)} alt={`Bear #${id}`} className="aspect-square w-full object-cover" />
                        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent px-3 py-3 text-xs font-black uppercase tracking-[0.12em] text-white">
                          <span>#{id.toString()}</span>
                          <span>{selected ? 'Selected' : 'Ready'}</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="flex min-h-[18rem] flex-col items-center justify-center gap-4 rounded-lg border border-[var(--color-line)] bg-[var(--color-bg-strong)] px-6 text-center">
                  <p className="max-w-sm text-sm font-semibold leading-7 text-[var(--color-copy)]">
                    No unstaked bears found in this wallet. Mint a new one or unstake an existing position first.
                  </p>
                  <Link href="/nft" className="btn-primary">
                    Go to mint
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </div>
              )}
            </div>

            <div className="mt-5">
              <button type="button" onClick={handleStake} disabled={busy || selectedTokens.length === 0} className="btn-primary w-full">
                {stakeButtonLabel}
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="surface-panel">
              <div className="eyebrow">Rewards</div>
              <div className="mt-4 grid gap-3">
                <div className="metric-tile">
                  <div className="metric-label">Gross pending</div>
                  <div className="metric-value">{formatCompact(grossPending)}</div>
                </div>
                <div className="metric-tile">
                  <div className="metric-label">Net pending</div>
                  <div className="metric-value">{formatCompact(netPending)}</div>
                </div>
              </div>

              {grossPending > 0n ? (
                <div className="mt-4 space-y-3">
                  <button type="button" onClick={handleClaim} disabled={busy} className="btn-primary w-full">
                    {busy && pendingAction === 'claim' ? 'Claiming...' : 'Claim BTBB'}
                  </button>
                  <button type="button" onClick={handleClaimAndRedeem} disabled={busy} className="btn-secondary w-full">
                    {busy && (pendingAction === 'claim-then-redeem' || pendingAction === 'redeem') ? 'Processing...' : 'Claim and unwrap to BTB'}
                  </button>
                </div>
              ) : (
                <div className="mt-4 rounded-lg border border-[var(--color-line)] bg-[var(--color-bg-strong)] px-4 py-4 text-sm font-semibold text-[var(--color-copy)]">
                  No pending rewards to claim yet.
                </div>
              )}
            </div>

            {address && stakedCount !== undefined && stakedCount > 0n && (
              <div className="surface-panel">
                <div className="eyebrow">Unstake</div>
                <div className="mt-4 space-y-4">
                  <div className="metric-tile">
                    <div className="metric-label">Currently staked</div>
                    <div className="metric-value">{stakedCount.toString()}</div>
                  </div>

                  <div className="flex items-center rounded-md border border-[var(--color-line)] bg-[var(--color-bg-strong)]">
                    <button type="button" onClick={() => setUnstakeCount((current) => Math.max(1, current - 1))} className="px-5 py-3 text-lg font-black text-[var(--color-ink)] hover:text-[var(--color-brand)]">
                      -
                    </button>
                    <div className="flex-1 text-center text-2xl font-black tracking-[-0.05em] text-[var(--color-ink)]">{unstakeCount}</div>
                    <button
                      type="button"
                      onClick={() => setUnstakeCount((current) => Math.min(Number(stakedCount), current + 1))}
                      className="px-5 py-3 text-lg font-black text-[var(--color-ink)] hover:text-[var(--color-brand)]"
                    >
                      +
                    </button>
                  </div>

                  <button type="button" onClick={handleUnstake} disabled={busy} className="btn-secondary w-full">
                    {busy && pendingAction === 'unstake' ? 'Unstaking...' : 'Unstake selected count'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
