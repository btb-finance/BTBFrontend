'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useAccount, useWaitForTransactionReceipt, useWriteContract } from 'wagmi'
import { ArrowUpRight, Images, Sparkles } from 'lucide-react'
import { Header } from '@/components/Header'
import { BEAR_NFT_ABI, CONTRACTS } from '@/lib/contracts'
import { useProtocol } from '@/lib/protocol-context'

const NFT_IMAGE_BASE = 'https://bafybeidlyvep6mqlaleervelrr2ev2bs2dxljsz3gs2wk4p5c6e23mvffu.ipfs.w3s.link'

function pickRandom(total: number, count: number) {
  const ids = new Set<number>()
  const max = Math.max(total, 1)

  while (ids.size < Math.min(count, max)) {
    ids.add(Math.floor(Math.random() * max) + 1)
  }

  return [...ids]
}

export default function NFTPage() {
  const { address } = useAccount()
  const { nftPrice, nftRemaining, nftTotalMinted } = useProtocol()
  const [amount, setAmount] = useState(1)
  const [activeIdx, setActiveIdx] = useState(0)

  const previewIds = useMemo(() => {
    const total = nftTotalMinted ? Number(nftTotalMinted) : 0
    return total > 0 ? pickRandom(total, 4) : [1, 2, 3, 4]
  }, [nftTotalMinted])

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIdx((current) => (current + 1) % previewIds.length)
    }, 3000)

    return () => clearInterval(interval)
  }, [previewIds.length])

  const { data: hash, writeContract, isPending } = useWriteContract()
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash })

  const handleMint = () => {
    if (!amount || !nftPrice) return

    writeContract({
      address: CONTRACTS.BEAR_NFT,
      abi: BEAR_NFT_ABI,
      functionName: 'buyNFT',
      args: [BigInt(amount)],
      value: nftPrice * BigInt(amount),
    })
  }

  const maxSupply = 100000
  const minted = nftTotalMinted !== undefined ? Number(nftTotalMinted) : 0
  const progress = minted > 0 ? (minted / maxSupply) * 100 : 0
  const ethPrice = nftPrice ? Number(nftPrice) / 1e18 : 0.01

  return (
    <div className="page-shell min-h-screen">
      <Header title="BTB Finance / NFT" />

      <main className="page-frame">
        <section className="hero-grid">
          <div className="hero-panel flex flex-col gap-4">
            <div className="eyebrow">
              <Sparkles className="h-4 w-4" />
              Reward access collectibles
            </div>
            <div>
              <h1 className="section-title">Mint Bears for 0.01 ETH.</h1>
              <p className="lead-copy mt-3 max-w-2xl">
                Bear NFTs are the passive-income access key. Mint one, stake it, and it earns from BTBB transfer fees
                collected by the staking pool.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="metric-tile">
                <div className="metric-label">Minted</div>
                <div className="metric-value">{minted.toLocaleString()}</div>
              </div>
              <div className="metric-tile">
                <div className="metric-label">Remaining</div>
                <div className="metric-value">{nftRemaining !== undefined ? Number(nftRemaining).toLocaleString() : '—'}</div>
              </div>
              <div className="metric-tile">
                <div className="metric-label">Price each</div>
                <div className="metric-value">{ethPrice.toFixed(3)} ETH</div>
              </div>
            </div>
          </div>

          <div className="surface-panel space-y-4">
            <div className="eyebrow">
              <Images className="h-4 w-4" />
              Collection preview
            </div>
            <div className="relative aspect-square overflow-hidden rounded-lg border border-[var(--color-line)] bg-[#101010]">
              {previewIds.map((id, index) => {
                const offset = (index - activeIdx + previewIds.length) % previewIds.length
                const isActive = offset === 0

                return (
                  <div
                    key={id}
                    className="absolute inset-3 overflow-hidden rounded-lg border border-[var(--color-line)] bg-[#090909] transition-all duration-700"
                    style={{
                      transform: `translateY(${offset * 18}px) scale(${1 - offset * 0.08})`,
                      opacity: offset > 2 ? 0 : 1 - offset * 0.25,
                      zIndex: previewIds.length - offset,
                    }}
                  >
                    <img src={`${NFT_IMAGE_BASE}/${id}.png`} alt={`Bear #${id}`} className="h-full w-full object-cover" />
                    {isActive && (
                      <div className="absolute bottom-3 left-3 rounded-md bg-black/80 px-3 py-1 text-xs font-black uppercase text-white">
                        Bear #{id}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        <section className="mt-3 grid gap-3 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="surface-panel">
            <div className="mb-5">
              <div className="eyebrow">Mint console</div>
              <h2 className="section-title mt-4">Choose quantity and mint.</h2>
            </div>

            <div className="space-y-5">
              <div className="field-shell">
                <div className="mb-4 text-xs font-black uppercase tracking-[0.14em] text-[var(--color-muted)]">
                  Quantity
                </div>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="flex items-center rounded-md border border-[var(--color-line)] bg-[var(--color-bg-strong)]">
                    <button type="button" onClick={() => setAmount((current) => Math.max(1, current - 1))} className="px-5 py-3 text-lg font-black text-[var(--color-ink)] hover:text-[var(--color-brand)]">
                      -
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={amount}
                      onChange={(event) => setAmount(Math.max(1, Math.min(100, parseInt(event.target.value, 10) || 1)))}
                      className="w-20 bg-transparent text-center text-3xl font-black tracking-[-0.05em] text-[var(--color-ink)] outline-none"
                    />
                    <button type="button" onClick={() => setAmount((current) => Math.min(100, current + 1))} className="px-5 py-3 text-lg font-black text-[var(--color-ink)] hover:text-[var(--color-brand)]">
                      +
                    </button>
                  </div>

                  <div className="grid flex-1 grid-cols-4 gap-2">
                    {[1, 5, 10, 20].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setAmount(num)}
                        className={`rounded-md border px-4 py-3 text-sm font-black uppercase tracking-[0.12em] transition ${
                          amount === num
                            ? 'border-[var(--color-brand)] bg-[var(--color-brand)] text-[#06120d]'
                            : 'border-[var(--color-line)] bg-[var(--color-bg-strong)] text-[var(--color-copy)] hover:border-[var(--color-line-strong)] hover:text-[var(--color-ink)]'
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="metric-tile">
                <div className="metric-label">Total cost</div>
                <div className="metric-value">{(amount * ethPrice).toFixed(3)} ETH</div>
              </div>

              {!address ? (
                <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-bg-strong)] px-4 py-4 text-sm font-semibold text-[var(--color-copy)]">
                  Connect your wallet to mint.
                </div>
              ) : nftRemaining !== undefined && nftRemaining === 0n ? (
                <div className="rounded-lg border border-[var(--color-berry)]/40 bg-[var(--color-berry)]/10 px-4 py-4 text-sm font-semibold text-[var(--color-berry)]">
                  Collection sold out.
                </div>
              ) : (
                <button type="button" onClick={handleMint} disabled={isPending || isConfirming || !amount} className="btn-primary w-full">
                  {isPending || isConfirming ? 'Minting...' : `Mint ${amount} Bear${amount > 1 ? 's' : ''}`}
                </button>
              )}

              <Link href="/stake" className="btn-secondary w-full">
                Go to staking next
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="surface-panel space-y-5">
            <div>
              <div className="eyebrow">Supply map</div>
              <h2 className="section-title mt-4">Track the mint curve.</h2>
            </div>

            <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-bg-strong)] p-4">
              <div className="mb-3 flex items-center justify-between text-sm font-semibold text-[var(--color-copy)]">
                <span>Mint progress</span>
                <span className="text-[var(--color-ink)]">{progress.toFixed(2)}%</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-[#0d0d0d] border border-[var(--color-line)]">
                <div className="h-full rounded-full bg-[var(--color-brand)]" style={{ width: `${Math.min(progress, 100)}%` }} />
              </div>
            </div>

            <div className="space-y-3 text-sm leading-7 text-[var(--color-copy)]">
              <p>Mint first, then move into the staking route to activate reward flow.</p>
              <p>The new page strips out the old game-like chrome and treats minting as a clear primary action.</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
