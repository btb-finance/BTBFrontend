'use client'

import { useState, useEffect } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseEther } from 'viem'
import { Header } from '@/components/Header'
import { CONTRACTS, ERC20_ABI, BTBB_ABI } from '@/lib/contracts'
import { formatToken, formatCompact } from '@/lib/utils'
import { useProtocol } from '@/lib/protocol-context'
import { ArrowDownUp } from 'lucide-react'

type PendingAction = 'approve-then-wrap' | 'wrap' | 'unwrap' | null

export default function Wrap() {
  const { address } = useAccount()
  const { btbBalance, btbbBalance, btbAllowanceForBtbb, btbbStats, refetch } = useProtocol()
  const [amount, setAmount] = useState('')
  const [direction, setDirection] = useState<'wrap' | 'unwrap'>('wrap')
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const [savedAmount, setSavedAmount] = useState(0n)

  const { data: hash, writeContract, isPending, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  useEffect(() => {
    if (!isSuccess || !pendingAction) return
    const chain = async () => {
      await refetch()
      if (pendingAction === 'approve-then-wrap') {
        reset()
        setPendingAction('wrap')
        writeContract({
          address: CONTRACTS.BTBB,
          abi: BTBB_ABI,
          functionName: 'mint',
          args: [savedAmount],
        })
      } else {
        setPendingAction(null)
        setAmount('')
        reset()
      }
    }
    chain()
  }, [isSuccess])

  const handleMax = () => {
    const bal = direction === 'wrap' ? btbBalance : btbbBalance
    if (bal !== undefined) {
      setAmount(formatToken(bal, 18, 18).replace(/0+$/, '').replace(/\.$/, ''))
    }
  }

  const handleAction = () => {
    if (!amount || isNaN(Number(amount))) return
    const parsed = parseEther(amount)

    if (direction === 'wrap') {
      if (btbAllowanceForBtbb !== undefined && btbAllowanceForBtbb < parsed) {
        setSavedAmount(parsed)
        setPendingAction('approve-then-wrap')
        writeContract({
          address: CONTRACTS.BTB,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [CONTRACTS.BTBB, parsed],
        })
      } else {
        setPendingAction('wrap')
        writeContract({
          address: CONTRACTS.BTBB,
          abi: BTBB_ABI,
          functionName: 'mint',
          args: [parsed],
        })
      }
    } else {
      setPendingAction('unwrap')
      writeContract({
        address: CONTRACTS.BTBB,
        abi: BTBB_ABI,
        functionName: 'redeem',
        args: [parsed],
      })
    }
  }

  const parsedAmount = amount && !isNaN(Number(amount)) ? parseEther(amount) : 0n
  const needsApproval = direction === 'wrap' && btbAllowanceForBtbb !== undefined && btbAllowanceForBtbb < parsedAmount
  const bal = direction === 'wrap' ? btbBalance : btbbBalance
  const hasEnough = bal !== undefined && bal >= parsedAmount
  const busy = isPending || isConfirming

  const buttonLabel = busy
    ? pendingAction === 'approve-then-wrap' && !isSuccess
      ? 'Approving...'
      : pendingAction === 'wrap' ? 'Wrapping...' : 'Unwrapping...'
    : needsApproval
      ? 'Approve & Wrap to BTBB'
      : direction === 'wrap' ? 'Wrap to BTBB' : 'Unwrap to BTB'

  return (
    <div className="relative z-10 font-sans pb-32 overflow-x-hidden min-h-screen">
      <div className="fixed inset-0 z-[-1] pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-[40rem] h-[40rem] bg-primary/10 blur-[150px] rounded-full mix-blend-screen opacity-60" />
        <div className="absolute bottom-0 left-0 w-[30rem] h-[30rem] bg-primary-dark/20 blur-[120px] rounded-full mix-blend-screen opacity-50" />
      </div>

      <Header />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-20">
        <div className="text-center mb-16">
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight mb-4 text-white">Asset <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-light to-primary">Wrapping</span></h1>
          <p className="text-lg sm:text-xl text-text-secondary max-w-2xl mx-auto font-medium">Wrap BTB for BTBB seamlessly at a 1:1 ratio. No slippage. Zero fees.</p>
        </div>

        <div className="grid lg:grid-cols-5 gap-8 lg:gap-12 items-start max-w-5xl mx-auto">
          <div className="lg:col-span-3 glass p-6 sm:p-8 rounded-[2rem] border border-primary/20 bg-surface/80 backdrop-blur-3xl shadow-[0_0_60px_rgba(0,0,0,0.5)] relative overflow-hidden">
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-primary/10 blur-[80px] rounded-full pointer-events-none" />
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white tracking-widest uppercase">Perform Swap</h2>
            </div>

            <div className="space-y-4 relative">
              <div className="bg-black/40 rounded-[1.5rem] p-5 border border-white/5 transition-all focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/50 relative overflow-hidden">
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-bold text-text-muted uppercase tracking-wider">From {direction === 'wrap' ? 'BTB' : 'BTBB'}</span>
                  <div className="text-sm font-bold text-text-muted flex gap-2">
                    Balance: <button onClick={handleMax} className="text-primary-light hover:text-white transition-colors">{bal !== undefined ? formatToken(bal) : '---'}</button>
                  </div>
                </div>
                <div className="flex items-center">
                  <input type="text" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full bg-transparent text-4xl sm:text-5xl font-black text-white outline-none placeholder:text-white/10" />
                  <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-xl border border-white/10 shrink-0">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-primary to-primary-dark shadow-inner" />
                    <span className="font-bold text-white tracking-wider">{direction === 'wrap' ? 'BTB' : 'BTBB'}</span>
                  </div>
                </div>
              </div>

              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-12 h-12 bg-surface rounded-2xl flex items-center justify-center border border-white/10 hover:border-primary/50 hover:bg-primary/10 transition-all cursor-pointer shadow-xl group" onClick={() => setDirection(d => d === 'wrap' ? 'unwrap' : 'wrap')}>
                <ArrowDownUp size={20} className="text-primary-light group-hover:scale-110 transition-transform" />
              </div>

              <div className="bg-black/20 rounded-[1.5rem] p-5 border border-white/5 pointer-events-none opacity-80">
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-bold text-text-muted uppercase tracking-wider">To {direction === 'wrap' ? 'BTBB' : 'BTB'}</span>
                </div>
                <div className="flex items-center">
                  <div className="w-full text-4xl sm:text-5xl font-black text-white/50 truncate">{amount || '0.00'}</div>
                  <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-xl border border-white/10 shrink-0">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-white/20 to-white/10 shadow-inner" />
                    <span className="font-bold text-white tracking-wider">{direction === 'wrap' ? 'BTBB' : 'BTB'}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8">
              {!address ? (
                <div className="w-full py-5 rounded-[1.5rem] bg-white/5 text-center text-text-muted font-bold tracking-widest uppercase border border-white/10 backdrop-blur-md">Connect wallet to continue</div>
              ) : !hasEnough && amount ? (
                <div className="w-full py-5 rounded-[1.5rem] bg-red-500/10 text-center text-red-500 font-bold tracking-widest border border-red-500/20 backdrop-blur-md">Insufficient Balance</div>
              ) : (
                <button onClick={handleAction} disabled={busy || !amount || !hasEnough} className="w-full btn-primary py-5 rounded-[1.5rem] text-lg font-black tracking-widest shadow-[0_0_30px_rgba(239,68,68,0.3)] hover:shadow-[0_0_50px_rgba(239,68,68,0.5)] transition-all disabled:opacity-50 disabled:pointer-events-none uppercase">
                  {buttonLabel}
                </button>
              )}
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div className="glass p-8 rounded-[2rem] border border-white/10 bg-surface/50 backdrop-blur-xl">
              <h3 className="text-sm font-bold text-primary-light uppercase tracking-widest mb-6 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary-light animate-pulse" /> Protocol Liquidity
              </h3>
              <div className="space-y-6">
                <div>
                  <div className="text-xs font-bold text-text-muted uppercase tracking-widest mb-1">Total BTB Locked</div>
                  <div className="text-3xl font-black text-white">{btbbStats ? formatCompact(btbbStats[0]) : '---'}</div>
                </div>
                <div className="h-px bg-white/10" />
                <div>
                  <div className="text-xs font-bold text-text-muted uppercase tracking-widest mb-1">BTBB Supply</div>
                  <div className="text-3xl font-black text-white">{btbbStats ? formatCompact(btbbStats[1]) : '---'}</div>
                </div>
              </div>
            </div>
            <div className="glass p-6 rounded-[2rem] border border-primary/20 bg-primary/5">
              <div className="flex justify-between items-center text-sm font-bold">
                <span className="text-text-muted uppercase tracking-widest">Protocol Tax</span>
                <span className="text-primary-light text-lg">1% <span className="text-xs text-text-muted font-normal lowercase">distributed to stakers</span></span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
