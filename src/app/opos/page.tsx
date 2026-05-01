'use client'

import { useEffect, useState } from 'react'
import { useAccount, useReadContracts, useWaitForTransactionReceipt, useWriteContract } from 'wagmi'
import { ArrowDownUp, Megaphone, RefreshCw } from 'lucide-react'
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
          <div className="hero-panel flex flex-col gap-4">
            <div className="eyebrow">
              <Megaphone className="h-4 w-4" />
              Expansion and distribution rail
            </div>
            <div>
              <h1 className="section-title">1 BTB mints 1,000,000 OPOS.</h1>
              <p className="lead-copy mt-3 max-w-2xl">
                OPOS is the expansion token. Mint with at least 1 BTB, burn in exact ratio chunks, and remember normal
                OPOS transfers take a 1% treasury tax.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="metric-tile">
                <div className="metric-label">Mint ratio</div>
                <div className="metric-value">1:1,000,000</div>
              </div>
              <div className="metric-tile">
                <div className="metric-label">OPOS supply</div>
                <div className="metric-value">{oposSupply !== undefined ? formatCompact(oposSupply) : '—'}</div>
              </div>
              <div className="metric-tile">
                <div className="metric-label">Primary use</div>
                <div className="metric-value text-[1.2rem]">Growth</div>
              </div>
            </div>
          </div>

          <div className="surface-panel space-y-4">
            <div className="eyebrow">
              <RefreshCw className="h-4 w-4" />
              Operating note
            </div>
            <p className="text-sm leading-6 text-[var(--color-copy)]">
              The contract enforces a minimum 1 BTB mint and 1,000,000 OPOS burn. Use whole ratio amounts to avoid
              failed redemptions.
            </p>
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
              <div className="eyebrow">Distribution role</div>
              <div className="mt-4 space-y-3 text-sm leading-7 text-[var(--color-copy)]">
                <p>Mint OPOS from BTB when you want exposure to the expansion layer.</p>
                <p>Burn back when you want to collapse that exposure into BTB again.</p>
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
          </div>
        </section>
      </main>
    </div>
  )
}
