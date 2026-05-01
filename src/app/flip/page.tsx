'use client'

import { useEffect, useState } from 'react'
import { useAccount, useReadContracts, useWaitForTransactionReceipt, useWriteContract } from 'wagmi'
import { ArrowDownUp, Gift, TrendingDown, TrendingUp } from 'lucide-react'
import { Header } from '@/components/Header'
import { CONTRACTS, ERC20_ABI, FLIP_ABI } from '@/lib/contracts'
import { formatCompact, formatToken, parseTokenInput } from '@/lib/utils'

const DECIMALS = 6
const TAX_BPS = 1000n
const BASIS = 10000n

type Direction = 'up' | 'down'
type PendingAction = 'approve-then-up' | 'up' | 'down' | null

export default function FlipPage() {
  const { address } = useAccount()
  const [amount, setAmount] = useState('')
  const [direction, setDirection] = useState<Direction>('up')
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const [savedAmount, setSavedAmount] = useState(0n)

  const { data, refetch } = useReadContracts({
    contracts: address
      ? [
          { address: CONTRACTS.USDC, abi: ERC20_ABI, functionName: 'balanceOf', args: [address] } as any,
          { address: CONTRACTS.FLIP, abi: ERC20_ABI, functionName: 'balanceOf', args: [address] } as any,
          { address: CONTRACTS.USDC, abi: ERC20_ABI, functionName: 'allowance', args: [address, CONTRACTS.FLIP] } as any,
          { address: CONTRACTS.FLIP, abi: ERC20_ABI, functionName: 'totalSupply' } as any,
          { address: CONTRACTS.FLIP, abi: FLIP_ABI, functionName: 'getUSDCBalance' } as any,
          { address: CONTRACTS.FLIP, abi: FLIP_ABI, functionName: 'isFullyBacked' } as any,
        ]
      : [
          { address: CONTRACTS.FLIP, abi: ERC20_ABI, functionName: 'totalSupply' } as any,
          { address: CONTRACTS.FLIP, abi: FLIP_ABI, functionName: 'getUSDCBalance' } as any,
          { address: CONTRACTS.FLIP, abi: FLIP_ABI, functionName: 'isFullyBacked' } as any,
        ],
    query: { refetchInterval: 15_000 },
  })

  const usdcBalance = address ? (data?.[0]?.result as bigint | undefined) : undefined
  const flipBalance = address ? (data?.[1]?.result as bigint | undefined) : undefined
  const usdcAllowance = address ? (data?.[2]?.result as bigint | undefined) : undefined
  const flipSupply = address ? (data?.[3]?.result as bigint | undefined) : (data?.[0]?.result as bigint | undefined)
  const usdcReserves = address ? (data?.[4]?.result as bigint | undefined) : (data?.[1]?.result as bigint | undefined)
  const isFullyBacked = address ? (data?.[5]?.result as boolean | undefined) : (data?.[2]?.result as boolean | undefined)

  const { data: hash, writeContract, isPending, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  useEffect(() => {
    if (!isSuccess || !pendingAction) return

    const chain = async () => {
      await refetch()
      if (pendingAction === 'approve-then-up') {
        reset()
        setPendingAction('up')
        writeContract({ address: CONTRACTS.FLIP, abi: FLIP_ABI, functionName: 'flipUp', args: [savedAmount] })
        return
      }

      setPendingAction(null)
      setAmount('')
      reset()
    }

    chain()
  }, [isSuccess, pendingAction, refetch, reset, savedAmount, writeContract])

  const parsed = amount && !Number.isNaN(Number(amount)) ? parseTokenInput(amount, DECIMALS) : 0n
  const previewOut = parsed > 0n ? parsed - (parsed * TAX_BPS) / BASIS : 0n
  const balance = direction === 'up' ? usdcBalance : flipBalance
  const hasEnough = balance !== undefined && balance >= parsed
  const needsApproval = direction === 'up' && usdcAllowance !== undefined && usdcAllowance < parsed && parsed > 0n
  const busy = isPending || isConfirming

  const handleMax = () => {
    if (balance === undefined) return
    setAmount(formatToken(balance, DECIMALS, DECIMALS).replace(/\.?0+$/, ''))
  }

  const handleAction = () => {
    if (!amount || Number.isNaN(Number(amount))) return

    if (direction === 'up') {
      if (needsApproval) {
        setSavedAmount(parsed)
        setPendingAction('approve-then-up')
        writeContract({ address: CONTRACTS.USDC, abi: ERC20_ABI, functionName: 'approve', args: [CONTRACTS.FLIP, parsed] })
        return
      }

      setPendingAction('up')
      writeContract({ address: CONTRACTS.FLIP, abi: FLIP_ABI, functionName: 'flipUp', args: [parsed] })
      return
    }

    setPendingAction('down')
    writeContract({ address: CONTRACTS.FLIP, abi: FLIP_ABI, functionName: 'flipDown', args: [parsed] })
  }

  const fromSym = direction === 'up' ? 'USDC' : 'FLIP'
  const toSym = direction === 'up' ? 'FLIP' : 'USDC'

  const buttonLabel = busy
    ? pendingAction === 'approve-then-up' && !isSuccess
      ? 'Approving USDC...'
      : pendingAction === 'up'
        ? 'Flipping up...'
        : 'Flipping down...'
    : needsApproval
      ? 'Approve and flip'
      : direction === 'up'
        ? 'Flip up'
        : 'Flip down'

  return (
    <div className="page-shell min-h-screen">
      <Header title="BTB Finance / FLIP" />

      <main className="page-frame">
        <section className="hero-grid">
          <div className="hero-panel flex flex-col gap-4">
            <div className="eyebrow">
              <TrendingUp className="h-4 w-4" />
              DEX trading lane
            </div>
            <div>
              <h1 className="section-title">Buy red candles. Sell green candles.</h1>
              <p className="lead-copy mt-3 max-w-2xl">
                FLIP is the active trading lane. Watch the DEX price, buy the drop, then sell when it recovers. The
                contract mints and redeems against USDC with a 10% tax.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="metric-tile">
                <div className="metric-label">FLIP supply</div>
                <div className="metric-value">{flipSupply !== undefined ? formatCompact(flipSupply, DECIMALS) : '—'}</div>
              </div>
              <div className="metric-tile">
                <div className="metric-label">USDC backing</div>
                <div className="metric-value">{usdcReserves !== undefined ? formatCompact(usdcReserves, DECIMALS) : '—'}</div>
              </div>
              <div className="metric-tile">
                <div className="metric-label">Backing status</div>
                <div className="metric-value text-[1.2rem]">
                  {isFullyBacked === undefined ? '—' : isFullyBacked ? 'Fully backed' : 'Check reserves'}
                </div>
              </div>
            </div>
          </div>

          <div className="surface-panel space-y-4">
            <div className="eyebrow">
              <Gift className="h-4 w-4" />
              How people use FLIP
            </div>
            <p className="text-sm leading-6 text-[var(--color-copy)]">
              Passive users stake Bears. FLIP users trade price movement. You are looking for a DEX entry low enough
              that the next move up can pay you after tax.
            </p>
            <a href="https://x.com/btb_finance" target="_blank" rel="noopener noreferrer" className="btn-secondary w-full">
              View X account
            </a>
          </div>
        </section>

        <section className="mt-3 grid gap-3 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="surface-panel">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <div className="eyebrow">Trade console</div>
                <h2 className="section-title mt-4">Switch between USDC and FLIP.</h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDirection((current) => (current === 'up' ? 'down' : 'up'))
                  setAmount('')
                }}
                className="btn-secondary text-sm"
              >
                <ArrowDownUp className="h-4 w-4" />
                Reverse
              </button>
            </div>

            <div className="space-y-4">
              <div className="field-shell">
                <div className="mb-3 flex items-center justify-between gap-3 text-xs font-black uppercase tracking-[0.14em] text-[var(--color-muted)]">
                  <span>You send {fromSym}</span>
                  <button type="button" onClick={handleMax} className="text-[var(--color-leaf)]">
                    Max {balance !== undefined ? formatToken(balance, DECIMALS) : '0'}
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.0"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    className="w-full bg-transparent text-4xl font-black tracking-[-0.05em] outline-none placeholder:text-[var(--color-muted)]/50"
                  />
                  <span className="token-pill">{fromSym}</span>
                </div>
              </div>

              <div className="flex justify-center">
                <div className="rounded-md border border-[var(--color-line)] bg-[var(--color-bg-strong)] p-3">
                  <ArrowDownUp className="h-4 w-4 text-[var(--color-copy)]" />
                </div>
              </div>

              <div className="field-shell">
                <div className="mb-3 text-xs font-black uppercase tracking-[0.14em] text-[var(--color-muted)]">
                  You receive {toSym} after protocol tax
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-full text-4xl font-black tracking-[-0.05em]">
                    {amount && previewOut > 0n ? formatToken(previewOut, DECIMALS) : '0.0'}
                  </div>
                  <span className="token-pill">{toSym}</span>
                </div>
              </div>

              {!address ? (
                <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-bg-strong)] px-4 py-4 text-sm font-semibold text-[var(--color-copy)]">
                  Connect your wallet to trade FLIP.
                </div>
              ) : !hasEnough && amount ? (
                <div className="rounded-lg border border-[var(--color-berry)]/40 bg-[var(--color-berry)]/10 px-4 py-4 text-sm font-semibold text-[var(--color-berry)]">
                  Insufficient balance for this trade.
                </div>
              ) : (
                <button type="button" onClick={handleAction} disabled={busy || !amount || !hasEnough} className="btn-primary w-full">
                  {buttonLabel}
                </button>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="surface-panel">
              <div className="eyebrow">{direction === 'up' ? 'Flip up' : 'Flip down'}</div>
              <div className="mt-4 space-y-3 text-sm leading-7 text-[var(--color-copy)]">
                <p>Use `flip up` to enter the trade when you want to buy FLIP.</p>
                <p>Use `flip down` when price has moved back up and you want to exit into USDC.</p>
              </div>
            </div>

            <div className="surface-panel">
              <div className="eyebrow">
                {isFullyBacked ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                Reserve watch
              </div>
              <div className="mt-4 grid gap-3">
                <div className="metric-tile">
                  <div className="metric-label">Your USDC</div>
                  <div className="metric-value">{usdcBalance !== undefined ? formatToken(usdcBalance, DECIMALS) : '—'}</div>
                </div>
                <div className="metric-tile">
                  <div className="metric-label">Your FLIP</div>
                  <div className="metric-value">{flipBalance !== undefined ? formatToken(flipBalance, DECIMALS) : '—'}</div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
