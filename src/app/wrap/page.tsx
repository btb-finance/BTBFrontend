'use client'

import { useState, useEffect } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseEther } from 'viem'
import { Header } from '@/components/Header'
import { CONTRACTS, ERC20_ABI, BTBB_ABI } from '@/lib/contracts'
import { formatToken, formatCompact } from '@/lib/utils'
import { useProtocol } from '@/lib/protocol-context'
import Link from 'next/link'
import { ArrowDownUp, ArrowUpRight } from 'lucide-react'

type PendingAction = 'approve-then-wrap' | 'wrap' | 'unwrap' | null

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
      : pendingAction === 'wrap'
        ? 'Wrapping...'
        : 'Unwrapping...'
    : needsApproval
      ? 'Approve and wrap'
      : direction === 'wrap'
        ? 'Wrap to BTBB'
        : 'Unwrap to BTB'

  const fromSym = direction === 'wrap' ? 'BTB' : 'BTBB'
  const toSym = direction === 'wrap' ? 'BTBB' : 'BTB'

  return (
    <div className="relative z-10 min-h-dvh font-sans pb-28 overflow-x-hidden text-text">
      <PageBackground />

      <Header />

      <main className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 pb-16">
        <header className="mb-10 sm:mb-14 max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] font-mono uppercase tracking-[0.2em] text-text-secondary mb-5">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400/90" />
            1:1 · no slippage
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-semibold tracking-tight text-white leading-tight">
            Wrap <span className="italic text-primary-light">BTB</span> and <span className="italic text-primary-light">BTBB</span>
          </h1>
          <p className="mt-4 text-base sm:text-lg text-text-secondary leading-relaxed">
            Same amount in and out. BTBB is the taxed transfer token; wrapping is how you enter that surface.
          </p>
        </header>

        <div className="grid lg:grid-cols-5 gap-6 lg:gap-8 items-start max-w-5xl">
          <div className="lg:col-span-3 rounded-xl border border-white/[0.08] bg-black/40 backdrop-blur-md overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/[0.06] bg-white/[0.02]">
              <span className="text-xs font-mono uppercase tracking-widest text-text-secondary">Convert</span>
              <button
                type="button"
                onClick={() => setDirection((d) => (d === 'wrap' ? 'unwrap' : 'wrap'))}
                className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/[0.08] transition-colors"
              >
                <ArrowDownUp className="h-3.5 w-3.5 text-primary-light" aria-hidden />
                Flip direction
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-3">
              <div className="rounded-lg border border-white/[0.08] bg-[#07070f]/90 p-4 sm:p-5 focus-within:border-primary/35 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
                <div className="flex justify-between gap-2 mb-2 text-xs font-mono uppercase tracking-wider text-text-muted">
                  <span>From {fromSym}</span>
                  <span className="text-text-secondary normal-case">
                    Bal{' '}
                    <button type="button" onClick={handleMax} className="font-semibold text-primary-light hover:text-white transition-colors">
                      {bal !== undefined ? formatToken(bal) : '—'}
                    </button>
                  </span>
                </div>
                <div className="flex items-center gap-3 min-w-0">
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="min-w-0 flex-1 bg-transparent text-3xl sm:text-4xl font-semibold text-white outline-none placeholder:text-white/15 tabular-nums"
                  />
                  <span className="shrink-0 rounded-md border border-white/10 bg-white/[0.05] px-3 py-2 text-sm font-semibold text-white">
                    {fromSym}
                  </span>
                </div>
              </div>

              <div className="flex justify-center py-1">
                <div className="h-px w-12 bg-gradient-to-r from-transparent via-white/20 to-transparent" aria-hidden />
              </div>

              <div className="rounded-lg border border-white/[0.06] bg-black/30 p-4 sm:p-5 opacity-90">
                <div className="text-xs font-mono uppercase tracking-wider text-text-muted mb-2">To {toSym}</div>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="min-w-0 flex-1 text-3xl sm:text-4xl font-semibold text-white/45 truncate tabular-nums">{amount || '0.00'}</div>
                  <span className="shrink-0 rounded-md border border-white/10 bg-white/[0.05] px-3 py-2 text-sm font-semibold text-white">
                    {toSym}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-6 pt-0">
              {!address ? (
                <div className="w-full rounded-lg border border-white/10 bg-white/[0.03] py-4 text-center text-sm font-medium text-text-muted">
                  Connect wallet to continue
                </div>
              ) : !hasEnough && amount ? (
                <div className="w-full rounded-lg border border-red-500/25 bg-red-500/10 py-4 text-center text-sm font-semibold text-red-400">
                  Insufficient balance
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleAction}
                  disabled={busy || !amount || !hasEnough}
                  className="w-full rounded-md bg-primary py-4 text-base font-semibold text-white shadow-[0_0_0_1px_rgba(0,0,0,0.2)] hover:bg-primary-dark transition-colors disabled:opacity-40 disabled:pointer-events-none"
                >
                  {buttonLabel}
                </button>
              )}
            </div>
          </div>

          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-xl border border-white/[0.08] bg-black/35 backdrop-blur-md overflow-hidden">
              <div className="px-4 py-3 border-b border-white/[0.06] bg-white/[0.02] text-xs font-mono uppercase tracking-widest text-text-secondary">
                Pool snapshot
              </div>
              <div className="p-4 sm:p-5 space-y-5">
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-wider text-text-muted mb-1.5">BTB locked (backing)</p>
                  <p className="text-2xl font-semibold text-white tabular-nums">{btbbStats ? formatCompact(btbbStats[0]) : '—'}</p>
                </div>
                <div className="h-px bg-white/[0.06]" />
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-wider text-text-muted mb-1.5">BTBB circulating</p>
                  <p className="text-2xl font-semibold text-white tabular-nums">{btbbStats ? formatCompact(btbbStats[1]) : '—'}</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-primary/25 bg-primary/[0.06] p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-mono uppercase tracking-widest text-primary-light/90">Transfer tax</p>
                  <p className="mt-2 text-sm text-text-secondary leading-relaxed">1% on BTBB transfers flows to stakers.</p>
                </div>
                <span className="shrink-0 text-2xl font-semibold text-white">1%</span>
              </div>
            </div>

            <Link
              href="/stake"
              className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-white hover:bg-white/[0.06] transition-colors"
            >
              Next: stake Bears
              <ArrowUpRight className="h-4 w-4 opacity-70" aria-hidden />
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
