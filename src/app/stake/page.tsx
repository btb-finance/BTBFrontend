'use client'

import { useState, useEffect } from 'react'
import { useAccount, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { Header } from '@/components/Header'
import { CONTRACTS, BEAR_STAKING_ABI, BEAR_NFT_ABI, BTBB_ABI } from '@/lib/contracts'
import { formatCompact } from '@/lib/utils'
import { useProtocol } from '@/lib/protocol-context'
import { Check, ShieldCheck, Flame, Gift, Minus, Plus } from 'lucide-react'

const NFT_IMAGE_BASE = 'https://bafybeidlyvep6mqlaleervelrr2ev2bs2dxljsz3gs2wk4p5c6e23mvffu.ipfs.w3s.link'
const nftImage = (id: bigint) => `${NFT_IMAGE_BASE}/${id.toString()}.png`

type PendingAction = 'approve-then-stake' | 'stake' | 'unstake' | 'claim' | 'claim-then-redeem' | 'redeem' | null

export default function Stake() {
  const { address } = useAccount()
  const {
    stakingStats, nftStakedCount: stakedCount, nftBalance: unstakedCount,
    nftApprovedForStaking: isApproved, pendingRewards,
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

  // Enumerate unstaked NFT token IDs – render progressively as each resolves
  const unstakedNum = Number(unstakedCount || 0n)
  const { data: tokenIdData } = useReadContracts({
    contracts: address && unstakedNum > 0 ? Array.from({ length: Math.min(unstakedNum, 50) }, (_, i) => ({
      address: CONTRACTS.BEAR_NFT,
      abi: BEAR_NFT_ABI,
      functionName: 'tokenOfOwnerByIndex' as const,
      args: [address, BigInt(i)] as const,
    })) : [],
    allowFailure: true,
  })
  // Build array with resolved IDs and placeholder nulls for still-loading slots
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
    setSelectedTokens(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    )
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
  const tvl = stakingStats ? Number(stakingStats[0]).toLocaleString() : '---'
  const dailyPerNft = stakingStats && stakingStats[0] > 0n ? stakingStats[3] / stakingStats[0] : 0n
  const annualPerNft = dailyPerNft * 365n

  const stakeButtonLabel = busy && (pendingAction === 'approve-then-stake' || pendingAction === 'stake')
    ? pendingAction === 'approve-then-stake' && !isSuccess ? 'Approving...' : 'Staking...'
    : !isApproved
      ? `Approve & Stake ${selectedTokens.length} Bear${selectedTokens.length !== 1 ? 's' : ''}`
      : `Stake ${selectedTokens.length} Bear${selectedTokens.length !== 1 ? 's' : ''}`

  return (
    <div className="relative z-10 font-sans pb-32 overflow-x-hidden min-h-screen">
      <div className="fixed inset-0 z-[-1] pointer-events-none overflow-hidden">
        <div className="absolute top-1/3 right-10 w-[50rem] h-[30rem] bg-primary/10 blur-[150px] rounded-full mix-blend-screen opacity-50 block rotate-12" />
      </div>

      <Header />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-20 space-y-20">

        <div className="text-center group">
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight mb-4 text-white">Yield <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-primary">Staking Engine</span></h1>
          <p className="text-lg sm:text-xl text-text-secondary max-w-2xl mx-auto font-medium">Actively stake your Bear NFTs to accrue protocol volume transfer taxes automatically.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 bg-surface/80 rounded-2xl sm:rounded-[2.5rem] p-4 sm:p-10 border border-white/10 backdrop-blur-3xl shadow-[0_0_80px_rgba(0,0,0,0.5)] relative overflow-hidden">
          <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-primary/20 blur-[100px] pointer-events-none rounded-full translate-y-1/2" />

          <div className="space-y-1 sm:space-y-2 border-r border-white/10 pr-3 sm:pr-4 min-w-0">
             <div className="text-[10px] sm:text-xs font-bold text-text-muted uppercase tracking-wider sm:tracking-widest flex items-center gap-1.5"><ShieldCheck size={12} className="shrink-0"/> Total Staked</div>
             <div className="text-2xl sm:text-4xl font-black text-white truncate">{tvl}</div>
          </div>
          <div className="space-y-1 sm:space-y-2 md:border-r border-white/10 md:pr-4 pl-2 sm:pl-4 md:pl-0 min-w-0">
             <div className="text-[10px] sm:text-xs font-bold text-text-muted uppercase tracking-wider sm:tracking-widest flex items-center gap-1.5"><Flame size={12} className="text-orange-400 shrink-0"/> Yield / NFT</div>
             <div className="text-2xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-primary truncate">{formatCompact(dailyPerNft)}</div>
             <div className="text-[10px] sm:text-xs text-text-muted font-medium">BTBB/day (~{formatCompact(annualPerNft)}/yr)</div>
          </div>
          <div className="space-y-1 sm:space-y-2 border-r border-white/10 pr-3 sm:pr-4 min-w-0">
             <div className="text-[10px] sm:text-xs font-bold text-text-muted uppercase tracking-wider sm:tracking-widest">My Staked</div>
             <div className="text-2xl sm:text-4xl font-black text-white">{stakedCount !== undefined ? stakedCount.toString() : '---'}</div>
          </div>
          <div className="space-y-1 sm:space-y-2 pl-2 sm:pl-4 min-w-0">
             <div className="text-[10px] sm:text-xs font-bold text-text-muted uppercase tracking-wider sm:tracking-widest flex items-center gap-1.5"><Gift size={12} className="text-primary-light shrink-0"/> Pending</div>
             <div className="flex flex-col">
               <span className="text-2xl sm:text-4xl font-black text-white truncate">{formatCompact(netPending)}</span>
               <span className="text-[10px] text-text-muted">BTBB</span>
               {grossPending > 0n && (
                 <div className="flex flex-col sm:flex-row gap-1 sm:gap-3 mt-2">
                   <button onClick={handleClaim} disabled={busy} className="text-primary-light text-[10px] sm:text-xs font-bold uppercase tracking-wider hover:text-white transition-colors underline decoration-primary/50 underline-offset-4 disabled:opacity-50 whitespace-nowrap">
                     {busy && pendingAction === 'claim' ? 'Claiming...' : 'Claim BTBB'}
                   </button>
                   <button onClick={handleClaimAndRedeem} disabled={busy} className="text-orange-400 text-[10px] sm:text-xs font-bold uppercase tracking-wider hover:text-white transition-colors underline decoration-orange-400/50 underline-offset-4 disabled:opacity-50 whitespace-nowrap">
                     {busy && (pendingAction === 'claim-then-redeem' || pendingAction === 'redeem')
                       ? pendingAction === 'claim-then-redeem' && !isSuccess ? 'Claiming...' : 'Redeeming...'
                       : 'Claim as BTB'}
                   </button>
                 </div>
               )}
             </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8 lg:gap-12">

          <div className="glass p-8 rounded-[2.5rem] border border-white/10 bg-black/40 backdrop-blur-xl flex flex-col h-full min-h-[500px]">
            <div className="flex justify-between items-center mb-8 border-b border-white/10 pb-4">
              <h2 className="text-xl font-bold tracking-widest uppercase text-white">Your Vault</h2>
              <div className="flex items-center gap-2">
                {unstakedTokens.length > 0 && (
                  <button
                    onClick={() => setSelectedTokens(prev =>
                      prev.length === unstakedTokens.length ? [] : [...unstakedTokens]
                    )}
                    className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-primary-light hover:text-white transition-colors px-3 py-1.5 rounded-full border border-primary/30 hover:border-primary/60"
                  >
                    {selectedTokens.length === unstakedTokens.length ? 'Deselect All' : 'Select All'}
                  </button>
                )}
                <span className="bg-white/10 px-4 py-1.5 rounded-full text-sm font-bold">{unstakedCount?.toString() || '0'}</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-4">
              {!address ? (
                 <div className="h-full flex items-center justify-center text-text-muted font-bold tracking-widest">Connect Wallet</div>
              ) : unstakedNum > 0 ? (
                <div className="grid grid-cols-3 gap-3 sm:gap-4">
                  {unstakedSlots.map((id, i) => {
                    if (id === null) return (
                      <div key={`loading-${i}`} className="aspect-square rounded-2xl border-2 border-white/5 bg-white/5 animate-pulse" />
                    )
                    const selected = selectedTokens.includes(id)
                    return (
                      <div key={id.toString()} onClick={() => toggleToken(id)} className={`aspect-square rounded-2xl border-2 transition-all cursor-pointer relative overflow-hidden group ${selected ? 'border-primary shadow-[0_0_15px_rgba(239,68,68,0.4)]' : 'border-white/10 hover:border-white/30'}`}>
                         <img src={nftImage(id)} alt={`Bear #${id.toString()}`} className="w-full h-full object-cover" loading="lazy" />
                         <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
                         <span className="absolute bottom-2 left-2 text-xs sm:text-sm font-black text-white drop-shadow-md z-10">#{id.toString()}</span>
                         {selected && <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center z-10"><Check size={12} className="text-white"/></div>}
                         {selected && <div className="absolute inset-0 bg-primary/20 pointer-events-none" />}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-text-muted font-bold tracking-widest text-center mt-20">No Bears in vault.<br/>Mint some to stake.</div>
              )}
            </div>

            <div className="mt-8 pt-6 border-t border-white/10">
              <button onClick={handleStake} disabled={busy || selectedTokens.length === 0} className="w-full btn-primary py-5 rounded-[1.5rem] text-lg font-black tracking-widest shadow-[0_0_30px_rgba(239,68,68,0.3)] hover:shadow-[0_0_50px_rgba(239,68,68,0.5)] transition-all disabled:opacity-50 disabled:pointer-events-none uppercase">
                {stakeButtonLabel}
              </button>
            </div>
          </div>

          <div className="glass p-8 rounded-[2.5rem] border border-primary/30 bg-primary/5 backdrop-blur-xl flex flex-col h-full min-h-[500px] relative overflow-hidden">
             <div className="absolute -top-20 -right-20 w-64 h-64 bg-primary/10 blur-[80px] rounded-full pointer-events-none" />
            <div className="flex justify-between items-center mb-8 border-b border-primary/20 pb-4 relative z-10">
              <h2 className="text-xl font-bold tracking-widest uppercase text-white">Staked Protocol</h2>
              <span className="bg-primary/20 text-primary-light px-4 py-1.5 rounded-full text-sm font-bold border border-primary/30">{stakedCount?.toString() || '0'} Staked</span>
            </div>

            <div className="flex-1 flex items-center justify-center relative z-10">
              {!address ? (
                 <div className="text-primary/40 font-bold tracking-widest">Connect Wallet</div>
              ) : stakedCount && stakedCount > 0n ? (
                <div className="text-center space-y-8 w-full">
                  <div className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-primary">{stakedCount.toString()}</div>
                  <p className="text-text-muted text-sm font-bold uppercase tracking-widest">Bear NFTs Earning Rewards</p>
                  <div className="flex items-center justify-center gap-4 mt-6">
                    <button onClick={() => setUnstakeCount(c => Math.max(1, c - 1))} className="w-12 h-12 rounded-xl border border-primary/30 bg-primary/10 flex items-center justify-center text-primary hover:bg-primary/20 transition-colors"><Minus size={18} /></button>
                    <span className="text-3xl font-black text-white w-16 text-center">{unstakeCount}</span>
                    <button onClick={() => setUnstakeCount(c => Math.min(Number(stakedCount), c + 1))} className="w-12 h-12 rounded-xl border border-primary/30 bg-primary/10 flex items-center justify-center text-primary hover:bg-primary/20 transition-colors"><Plus size={18} /></button>
                  </div>
                </div>
              ) : (
                <div className="text-primary/40 text-center font-bold tracking-widest">Nothing actively staked.</div>
              )}
            </div>

            <div className="mt-8 pt-6 border-t border-primary/20 relative z-10">
              <button onClick={handleUnstake} disabled={busy || !stakedCount || stakedCount === 0n} className="w-full bg-transparent border-2 border-primary text-primary hover:bg-primary/10 py-5 rounded-[1.5rem] text-lg font-black tracking-widest transition-all disabled:opacity-50 disabled:pointer-events-none uppercase">
                {busy && pendingAction === 'unstake' ? 'Unstaking...' : `Unstake ${unstakeCount} Bear${unstakeCount > 1 ? 's' : ''}`}
              </button>
            </div>
          </div>

        </div>

      </main>
    </div>
  )
}
