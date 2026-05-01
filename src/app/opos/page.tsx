'use client'

import { useEffect, useState } from 'react'
import { useAccount, useReadContracts, useWaitForTransactionReceipt, useWriteContract } from 'wagmi'
import Link from 'next/link'
import { ArrowDownUp, ArrowRight, Network, RefreshCw, Zap } from 'lucide-react'
import { Header } from '@/components/Header'
import { CONTRACTS, ERC20_ABI, OPOS_ABI } from '@/lib/contracts'
import { formatCompact, formatToken, parseTokenInput } from '@/lib/utils'

const MINT_RATIO = 1_000_000n

type Direction = 'mint' | 'burn'
type PendingAction = 'approve-then-mint' | 'mint' | 'burn' | null

export default function OPOSPage() {
  const { address } = useAccount()
  const [amount, setAmount] = useState('')
  const [direction, setDirection] = useState<Direction>('mint')
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const [savedAmount, setSavedAmount] = useState(0n)

  const { data, refetch } = useReadContracts({
    contracts: address
      ? [
          { address: CONTRACTS.BTB, abi: ERC20_ABI, functionName: 'balanceOf', args: [address] } as any,
          { address: CONTRACTS.OPOS, abi: ERC20_ABI, functionName: 'balanceOf', args: [address] } as any,
          { address: CONTRACTS.BTB, abi: ERC20_ABI, functionName: 'allowance', args: [address, CONTRACTS.OPOS] } as any,
          { address: CONTRACTS.OPOS, abi: ERC20_ABI, functionName: 'totalSupply' } as any,
        ]
      : [],
    query: { refetchInterval: 15_000 },
  })

  const btbBalance = data?.[0]?.result as bigint | undefined
  const oposBalance = data?.[1]?.result as bigint | undefined
  const btbAllowance = data?.[2]?.result as bigint | undefined
  const oposSupply = data?.[3]?.result as bigint | undefined

  const { data: hash, writeContract, isPending, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  useEffect(() => {
    if (!isSuccess || !pendingAction) return

    const chain = async () => {
      await refetch()
      if (pendingAction === 'approve-then-mint') {
        reset()
        setPendingAction('mint')
        writeContract({ address: CONTRACTS.OPOS, abi: OPOS_ABI, functionName: 'mint', args: [savedAmount] })
        return
      }

      setPendingAction(null)
      setAmount('')
      reset()
    }

    chain()
  }, [isSuccess, pendingAction, refetch, reset, savedAmount, writeContract])

  const parsedBtb = amount && !Number.isNaN(Number(amount)) ? parseTokenInput(amount, 18) : 0n
  const parsedOpos = amount && !Number.isNaN(Number(amount)) ? parseTokenInput(amount, 18) : 0n
  const previewOut = direction === 'mint' ? parsedBtb * MINT_RATIO : parsedOpos / MINT_RATIO

  const balance = direction === 'mint' ? btbBalance : oposBalance
  const requiredBalance = direction === 'mint' ? parsedBtb : parsedOpos
  const hasEnough = balance !== undefined && balance >= requiredBalance
  const needsApproval = direction === 'mint' && btbAllowance !== undefined && btbAllowance < parsedBtb && parsedBtb > 0n
  const busy = isPending || isConfirming

  const handleMax = () => {
    if (balance === undefined) return
    setAmount(formatToken(balance, 18, 18).replace(/\.?0+$/, ''))
  }

  const handleAction = () => {
    if (!amount || Number.isNaN(Number(amount))) return

    if (direction === 'mint') {
      if (needsApproval) {
        setSavedAmount(parsedBtb)
        setPendingAction('approve-then-mint')
        writeContract({ address: CONTRACTS.BTB, abi: ERC20_ABI, functionName: 'approve', args: [CONTRACTS.OPOS, parsedBtb] })
        return
      }

      setPendingAction('mint')
      writeContract({ address: CONTRACTS.OPOS, abi: OPOS_ABI, functionName: 'mint', args: [parsedBtb] })
      return
    }

    setPendingAction('burn')
    writeContract({ address: CONTRACTS.OPOS, abi: OPOS_ABI, functionName: 'burn', args: [parsedOpos] })
  }

  const fromSym = direction === 'mint' ? 'BTB' : 'OPOS'
  const toSym = direction === 'mint' ? 'OPOS' : 'BTB'

  const buttonLabel = busy
    ? pendingAction === 'approve-then-mint' && !isSuccess
      ? 'Approving BTB...'
      : pendingAction === 'mint'
        ? 'Minting OPOS...'
        : 'Redeeming BTB...'
    : needsApproval
      ? 'Approve and mint'
      : direction === 'mint'
        ? 'Mint OPOS'
        : 'Redeem for BTB'

  return (
    <div className="page-shell min-h-screen">
      <Header title="BTB Finance / OPOS" />

      <main className="page-frame">
        <section className="hero-grid">
          <div className="hero-panel surface-panel-strong flex flex-col gap-4">
            <div className="eyebrow">
              <Network className="h-4 w-4" />
              The protocol's expansion engine
            </div>
            <div>
              <h1 className="display-title">
                OPOS turns volume into{' '}
                <span className="text-[var(--color-brand)]">new revenue streams</span>.
              </h1>
              <p className="lead-copy mt-3 max-w-2xl">
                Every OPOS transfer pays a <span className="font-black text-[var(--color-ink)]">1% tax</span>. That tax
                is used to{' '}
                <span className="font-black text-[var(--color-ink)]">add new liquidity pairs</span> against other coins
                — and every new pair is another arbitrage surface that pays the protocol every time price moves. The
                more OPOS volume happens, the more pairs the protocol owns, the more arbitrage revenue flows in.
                Forever.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="metric-tile">
                <div className="metric-label">Mint ratio</div>
                <div className="metric-value">1 : 1M</div>
                <div className="mt-2 text-[0.6rem] font-bold uppercase text-[var(--color-muted)]">BTB → OPOS</div>
              </div>
              <div className="metric-tile">
                <div className="metric-label">Transfer tax</div>
                <div className="metric-value text-[var(--color-leaf)]">1%</div>
                <div className="mt-2 text-[0.6rem] font-bold uppercase text-[var(--color-muted)]">to LP expansion</div>
              </div>
              <div className="metric-tile">
                <div className="metric-label">OPOS supply</div>
                <div className="metric-value">{oposSupply !== undefined ? formatCompact(oposSupply) : '—'}</div>
                <div className="mt-2 text-[0.6rem] font-bold uppercase text-[var(--color-muted)]">circulating</div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="surface-panel">
              <div className="eyebrow">
                <Zap className="h-4 w-4" />
                Why it grows the protocol
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--color-copy)]">
                Each new pair OPOS opens — say{' '}
                <span className="font-black text-[var(--color-ink)]">OPOS / random-coin-X</span> — becomes an arbitrage
                surface. As X moves against the broader market, bots arb the OPOS pair to keep it in line, paying the
                1% tax on every trade.
              </p>
            </div>
            <div className="surface-panel">
              <div className="eyebrow">
                <RefreshCw className="h-4 w-4" />
                Operating note
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--color-copy)]">
                Minimum mint is <span className="font-black text-[var(--color-ink)]">1 BTB</span>. Minimum burn is{' '}
                <span className="font-black text-[var(--color-ink)]">1,000,000 OPOS</span>. Use whole ratios to avoid
                rounding rejections.
              </p>
            </div>
          </div>
        </section>

        {/* HOW THE EXPANSION FLYWHEEL WORKS */}
        <section className="surface-panel mt-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="eyebrow">
                <Network className="h-4 w-4" />
                The OPOS flywheel
              </div>
              <h2 className="section-title mt-4">Transfers fund pairs. Pairs fund the protocol.</h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-[var(--color-copy)]">
              OPOS is not just a token — it's an engine for building protocol-owned liquidity across the whole DEX
              ecosystem.
            </p>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="metric-tile flex flex-col gap-3">
              <span className="kicker-number">01</span>
              <h3 className="text-base font-black uppercase leading-tight text-[var(--color-ink)]">User mints OPOS from BTB</h3>
              <p className="text-sm leading-6 text-[var(--color-copy)]">
                1 BTB → 1,000,000 OPOS. The BTB sits as backing; OPOS now exists as a tradeable asset.
              </p>
            </div>
            <div className="metric-tile flex flex-col gap-3">
              <span className="kicker-number">02</span>
              <h3 className="text-base font-black uppercase leading-tight text-[var(--color-ink)]">OPOS gets traded → 1% tax</h3>
              <p className="text-sm leading-6 text-[var(--color-copy)]">
                Every transfer takes a 1% cut. The tax accumulates inside the contract as OPOS itself.
              </p>
            </div>
            <div className="metric-tile flex flex-col gap-3">
              <span className="kicker-number">03</span>
              <h3 className="text-base font-black uppercase leading-tight text-[var(--color-leaf)]">Tax → new LP against another coin</h3>
              <p className="text-sm leading-6 text-[var(--color-copy)]">
                The accumulated OPOS is paired with another coin on Uniswap, opening a new market that the protocol now
                owns the LP of.
              </p>
            </div>
            <div className="metric-tile flex flex-col gap-3">
              <span className="kicker-number">04</span>
              <h3 className="text-base font-black uppercase leading-tight text-[var(--color-leaf)]">Arbitrage on that pair pays us forever</h3>
              <p className="text-sm leading-6 text-[var(--color-copy)]">
                Every arb trade hits the 1% transfer tax again. Loop the cycle across hundreds of pairs and the
                revenue compounds.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-3 grid gap-3 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="surface-panel">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <div className="eyebrow">Supply console</div>
                <h2 className="section-title mt-4">Convert between BTB and OPOS.</h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDirection((current) => (current === 'mint' ? 'burn' : 'mint'))
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
                  <button type="button" onClick={handleMax} className="text-[var(--color-plum)]">
                    Max {balance !== undefined ? formatToken(balance, 18, 4) : '0'}
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
                  You receive {toSym}
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-full text-4xl font-black tracking-[-0.05em]">
                    {amount && previewOut > 0n ? formatToken(previewOut, 18, 4) : '0.0'}
                  </div>
                  <span className="token-pill">{toSym}</span>
                </div>
              </div>

              {!address ? (
                <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-bg-strong)] px-4 py-4 text-sm font-semibold text-[var(--color-copy)]">
                  Connect your wallet to use OPOS.
                </div>
              ) : !hasEnough && amount ? (
                <div className="rounded-lg border border-[var(--color-berry)]/40 bg-[var(--color-berry)]/10 px-4 py-4 text-sm font-semibold text-[var(--color-berry)]">
                  Insufficient balance for this conversion.
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
                {direction === 'mint' ? <Zap className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
                {direction === 'mint' ? 'Mint OPOS' : 'Burn OPOS'}
              </div>
              <div className="mt-4 space-y-3 text-sm leading-7 text-[var(--color-copy)]">
                {direction === 'mint' ? (
                  <p>
                    Lock <span className="font-black text-[var(--color-ink)]">at least 1 BTB</span> to receive
                    1,000,000 OPOS per BTB. Your BTB stays as backing inside the contract — burn whole-million OPOS
                    chunks any time to redeem it.
                  </p>
                ) : (
                  <p>
                    Burn <span className="font-black text-[var(--color-ink)]">whole 1,000,000 OPOS chunks</span> to
                    redeem the underlying BTB. Tax does not apply to mint or burn — only to transfers in between.
                  </p>
                )}
              </div>
            </div>

            <div className="surface-panel">
              <div className="eyebrow">Wallet snapshot</div>
              <div className="mt-4 grid gap-3">
                <div className="metric-tile">
                  <div className="metric-label">Your BTB</div>
                  <div className="metric-value">{btbBalance !== undefined ? formatToken(btbBalance) : '—'}</div>
                </div>
                <div className="metric-tile">
                  <div className="metric-label">Your OPOS</div>
                  <div className="metric-value">{oposBalance !== undefined ? formatToken(oposBalance) : '—'}</div>
                </div>
              </div>
            </div>

            <Link href="/stake" className="btn-secondary w-full">
              See where the rewards land
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>
    </div>
  )
}
