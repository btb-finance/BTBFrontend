'use client'

import { useEffect, useState } from 'react'
import { useAccount, useReadContracts, useWaitForTransactionReceipt, useWriteContract } from 'wagmi'
import Link from 'next/link'
import { ArrowDownUp, ArrowRight, ShieldCheck, Target, TrendingDown, TrendingUp } from 'lucide-react'
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
          <div className="hero-panel surface-panel-strong flex flex-col gap-4">
            <div className="eyebrow">
              <ShieldCheck className="h-4 w-4" />
              The first trade you can't lose
            </div>
            <div>
              <h1 className="display-title">
                FLIP is a stablecoin{' '}
                <span className="text-[var(--color-brand)]">built for day traders</span>.
              </h1>
              <p className="lead-copy mt-3 max-w-2xl">
                Buy on the DEX between <span className="font-black text-[var(--color-ink)]">$0.90 and $0.98</span>. Sell
                between <span className="font-black text-[var(--color-ink)]">$1.05 and $1.10</span>. Make 5–10% per
                trade. If price never moves up, the contract still redeems at $0.90 — that's your stop loss, written in
                code. <span className="font-black text-[var(--color-leaf)]">Forget Binance. There is no scenario where
                you get rugged here.</span>
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="metric-tile">
                <div className="metric-label">DEX floor</div>
                <div className="metric-value text-[var(--color-leaf)]">$0.90</div>
                <div className="mt-2 text-[0.6rem] font-bold uppercase text-[var(--color-muted)]">Guaranteed redeem</div>
              </div>
              <div className="metric-tile">
                <div className="metric-label">DEX ceiling</div>
                <div className="metric-value">$1.10</div>
                <div className="mt-2 text-[0.6rem] font-bold uppercase text-[var(--color-muted)]">Arb-bound mint</div>
              </div>
              <div className="metric-tile">
                <div className="metric-label">USDC backing</div>
                <div className="metric-value">{usdcReserves !== undefined ? formatCompact(usdcReserves, DECIMALS) : '—'}</div>
                <div className={`mt-2 text-[0.6rem] font-bold uppercase ${isFullyBacked ? 'text-[var(--color-leaf)]' : 'text-[var(--color-berry)]'}`}>
                  {isFullyBacked === undefined ? '—' : isFullyBacked ? 'Fully backed' : 'Check reserves'}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="surface-panel">
              <div className="eyebrow">
                <Target className="h-4 w-4" />
                The math, in one paragraph
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--color-copy)]">
                BTB, BTBB, and OPOS are paired with{' '}
                <span className="font-black text-[var(--color-ink)]">hundreds of tokens</span> on Uniswap. Every move on
                those pairs ripples into FLIP. Arbitrageurs constantly buy and sell, swinging FLIP between $0.90 and
                $1.10 — and you trade the swing.
              </p>
            </div>
            <div className="metric-tile">
              <div className="metric-label">If you catch 5 trades / month</div>
              <div className="metric-value text-[var(--color-leaf)]">~25–50%</div>
              <div className="mt-1 text-[0.65rem] font-bold uppercase text-[var(--color-muted)]">monthly return target</div>
            </div>
          </div>
        </section>

        {/* STRATEGY — the day-trading playbook */}
        <section className="surface-panel mt-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="eyebrow">
                <Target className="h-4 w-4" />
                The play
              </div>
              <h2 className="section-title mt-4">Limit buy low. Sell the swing. Repeat.</h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-[var(--color-copy)]">
              You don't predict price. You set passive limit orders in the buy zone, walk away, and let arbitrage do the
              work. The contract guarantees you can always exit.
            </p>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="metric-tile flex flex-col gap-3">
              <span className="kicker-number">01</span>
              <h3 className="text-base font-black uppercase leading-tight text-[var(--color-ink)]">Set DEX limit buys $0.98 → $0.90</h3>
              <p className="text-sm leading-6 text-[var(--color-copy)]">
                Stack passive Uniswap orders in the buy zone. The lower the fill, the bigger your floor cushion.
              </p>
            </div>
            <div className="metric-tile flex flex-col gap-3">
              <span className="kicker-number">02</span>
              <h3 className="text-base font-black uppercase leading-tight text-[var(--color-ink)]">Wait for arbitrage to swing price</h3>
              <p className="text-sm leading-6 text-[var(--color-copy)]">
                BTB, BTBB and OPOS are paired with 100+ tokens. Every move on those pairs pumps or dumps FLIP. You will
                see swings.
              </p>
            </div>
            <div className="metric-tile flex flex-col gap-3">
              <span className="kicker-number">03</span>
              <h3 className="text-base font-black uppercase leading-tight text-[var(--color-leaf)]">Sell on DEX between $1.05 and $1.10</h3>
              <p className="text-sm leading-6 text-[var(--color-copy)]">
                Above $1.10, arbitrageurs will mint FLIP via the contract and dump it on you. Sell into them. 5–10%
                round-trip.
              </p>
            </div>
            <div className="metric-tile flex flex-col gap-3">
              <span className="kicker-number">04</span>
              <h3 className="text-base font-black uppercase leading-tight text-[var(--color-ink)]">If price stays low, Flip Down for $0.90</h3>
              <p className="text-sm leading-6 text-[var(--color-copy)]">
                Tired of waiting? Burn FLIP via the contract and walk away with $0.90 USDC per token. The redemption is
                always available.
              </p>
            </div>
          </div>
        </section>

        {/* PROFIT TABLE */}
        <section className="surface-panel mt-3">
          <div className="eyebrow">
            <TrendingUp className="h-4 w-4" />
            Example trade math
          </div>
          <h2 className="section-title mt-4">If your buy fills at this price…</h2>

          <div className="mt-5 overflow-hidden rounded-md border border-[var(--color-line)] bg-[#0d0d0d]">
            <div className="grid grid-cols-4 gap-3 border-b border-[var(--color-line)] bg-[#101010] px-4 py-3 text-[0.7rem] font-black uppercase tracking-wider text-[var(--color-muted)]">
              <span>Buy fill</span>
              <span>Exit</span>
              <span>Net move</span>
              <span className="text-[var(--color-leaf)]">Profit</span>
            </div>
            {[
              { buy: '$0.95', exit: '$1.05 (DEX)', mode: 'no tax', profit: '~+10.5%', good: true },
              { buy: '$0.92', exit: '$1.08 (DEX)', mode: 'no tax', profit: '~+17.4%', good: true },
              { buy: '$0.90', exit: '$1.10 (DEX)', mode: 'no tax', profit: '~+22.2%', good: true },
              { buy: '$0.95', exit: '$0.90 (Flip Down)', mode: '−10% tax', profit: '~−5.3%', good: false },
              { buy: '$0.90', exit: '$0.90 (Flip Down)', mode: '−10% tax', profit: '~0% (break-even)', good: false },
            ].map((row, i) => (
              <div
                key={i}
                className="grid grid-cols-4 gap-3 border-b border-[var(--color-line)] px-4 py-3 text-sm last:border-0"
              >
                <span className="font-mono text-[var(--color-ink)]">{row.buy}</span>
                <span className="font-mono text-[var(--color-copy)]">{row.exit}</span>
                <span className="font-mono text-[var(--color-muted)]">{row.mode}</span>
                <span className={`font-mono font-black ${row.good ? 'text-[var(--color-leaf)]' : 'text-[var(--color-berry)]'}`}>
                  {row.profit}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs leading-5 text-[var(--color-muted)]">
            The 10% tax only hits when you use Flip Up or Flip Down (the contract). Selling on the Uniswap DEX has no
            protocol tax — only DEX fees and gas. Worst realistic case: you bought too high and panic-redeemed for
            $0.90.
          </p>
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
              <div className="eyebrow">
                {direction === 'up' ? <TrendingUp className="h-4 w-4 text-[var(--color-leaf)]" /> : <TrendingDown className="h-4 w-4 text-[var(--color-berry)]" />}
                {direction === 'up' ? 'Flip Up — when DEX is overpriced' : 'Flip Down — your stop loss'}
              </div>
              <div className="mt-4 space-y-3 text-sm leading-7 text-[var(--color-copy)]">
                {direction === 'up' ? (
                  <>
                    <p>
                      Use <span className="font-black text-[var(--color-ink)]">Flip Up</span> only when DEX FLIP trades
                      above <span className="font-black text-[var(--color-leaf)]">$1.10</span>. You deposit USDC, the
                      contract mints FLIP at $1 face minus 10% tax, and you can immediately dump that FLIP on the DEX.
                    </p>
                    <p className="text-xs uppercase font-bold tracking-wider text-[var(--color-muted)]">
                      For most users, ignore this button. Buy FLIP on the DEX instead — no tax, better fill.
                    </p>
                  </>
                ) : (
                  <>
                    <p>
                      Use <span className="font-black text-[var(--color-ink)]">Flip Down</span> when you want to exit
                      and DEX FLIP is below <span className="font-black text-[var(--color-berry)]">$0.90</span>. The
                      contract burns your FLIP and pays you{' '}
                      <span className="font-black text-[var(--color-leaf)]">$0.90 USDC per token</span> — guaranteed by
                      the on-chain reserves.
                    </p>
                    <p className="text-xs uppercase font-bold tracking-wider text-[var(--color-muted)]">
                      This is the floor that makes the strategy safe. The contract can't refuse to redeem.
                    </p>
                  </>
                )}
              </div>
            </div>

            <div className="surface-panel">
              <div className="eyebrow">
                {isFullyBacked ? (
                  <ShieldCheck className="h-4 w-4 text-[var(--color-leaf)]" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-[var(--color-berry)]" />
                )}
                Reserve watch
              </div>
              <p className="mt-3 text-xs leading-5 text-[var(--color-muted)]">
                Every FLIP in circulation is backed 1:1 by USDC inside the contract. Confirm before trusting your
                redemption.
              </p>
              <div className="mt-4 grid gap-3">
                <div className="metric-tile">
                  <div className="metric-label">FLIP supply</div>
                  <div className="metric-value">{flipSupply !== undefined ? formatCompact(flipSupply, DECIMALS) : '—'}</div>
                </div>
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

            <Link href="/stake" className="btn-secondary w-full">
              Prefer passive? Stake Bears
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>
    </div>
  )
}
