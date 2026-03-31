'use client'

import { useState, useEffect, useMemo } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import Link from 'next/link'
import { Header } from '@/components/Header'
import { CONTRACTS, BEAR_NFT_ABI } from '@/lib/contracts'
import { useProtocol } from '@/lib/protocol-context'
import { Plus, Minus, ArrowUpRight } from 'lucide-react'

const NFT_IMAGE_BASE = 'https://bafybeidlyvep6mqlaleervelrr2ev2bs2dxljsz3gs2wk4p5c6e23mvffu.ipfs.w3s.link'

function pickRandom(total: number, count: number) {
  const ids = new Set<number>()
  const max = Math.max(total, 1)
  while (ids.size < Math.min(count, max)) {
    ids.add(Math.floor(Math.random() * max) + 1)
  }
  return [...ids]
}

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

export default function NFT() {
  const { address } = useAccount()
  const { nftTotalMinted, nftRemaining, nftPrice } = useProtocol()
  const [amount, setAmount] = useState<number>(1)
  const [activeIdx, setActiveIdx] = useState(0)

  const previewIds = useMemo(() => {
    const total = nftTotalMinted ? Number(nftTotalMinted) : 0
    return total > 0 ? pickRandom(total, 4) : [1, 2, 3, 4]
  }, [nftTotalMinted])

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIdx((i) => (i + 1) % previewIds.length)
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

  const MAX_SUPPLY = 100000
  const progress = nftTotalMinted !== undefined ? (Number(nftTotalMinted) / MAX_SUPPLY) * 100 : 0
  const ethPrice = nftPrice ? Number(nftPrice) / 1e18 : 0.01

  return (
    <div className="relative z-10 min-h-dvh font-sans pb-28 overflow-x-hidden text-text">
      <PageBackground />

      <Header />

      <main className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 pb-16 space-y-10 sm:space-y-12">
        <header className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] font-mono uppercase tracking-[0.2em] text-text-secondary mb-5">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-400/90" />
            0.01 ETH · Bear NFT
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-semibold tracking-tight text-white leading-tight">
            Mint your <span className="italic text-primary-light">Bear</span>
          </h1>
          <p className="mt-4 text-base sm:text-lg text-text-secondary leading-relaxed">
            Each mint seeds protocol liquidity. Stake the NFT to earn from BTBB transfer tax.
          </p>
        </header>

        <div className="grid lg:grid-cols-2 gap-8 lg:gap-10 items-start max-w-5xl mx-auto">
          <div className="relative flex justify-center lg:justify-start">
            <div className="relative w-full max-w-[380px] aspect-square">
              <div className="absolute inset-0 rounded-xl border border-dashed border-white/15 animate-[spin_56s_linear_infinite]" aria-hidden />
              <div className="absolute inset-3 rounded-xl border border-white/[0.06]" aria-hidden />
              <div className="absolute inset-0 flex items-center justify-center p-6">
                {previewIds.map((id, i) => {
                  const offset = (i - activeIdx + previewIds.length) % previewIds.length
                  const isActive = offset === 0
                  return (
                    <div
                      key={id}
                      className="absolute inset-4 rounded-xl border overflow-hidden shadow-2xl transition-all duration-700 ease-out"
                      style={{
                        transform: `scale(${1 - offset * 0.055}) translateY(${offset * 12}px)`,
                        opacity: offset > 2 ? 0 : 1 - offset * 0.22,
                        zIndex: previewIds.length - offset,
                        borderColor: isActive ? 'rgba(239,68,68,0.45)' : 'rgba(255,255,255,0.08)',
                      }}
                    >
                      <img src={`${NFT_IMAGE_BASE}/${id}.png`} alt={`Bear #${id}`} className="h-full w-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent pointer-events-none" />
                      {isActive && (
                        <span className="absolute bottom-3 left-3 text-xs font-semibold text-white drop-shadow-md">Bear #{id}</span>
                      )}
                    </div>
                  )
                })}
              </div>
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-20">
                {previewIds.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 rounded-full transition-all duration-500 ${i === activeIdx ? 'w-6 bg-primary' : 'w-1.5 bg-white/25'}`}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-white/[0.08] bg-black/40 backdrop-blur-md overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
            <div className="px-4 py-3 border-b border-white/[0.06] bg-white/[0.02] flex items-center justify-between gap-2">
              <span className="text-xs font-mono uppercase tracking-widest text-text-secondary">Supply</span>
              <Link href="/stake" className="text-xs font-semibold text-primary-light hover:underline inline-flex items-center gap-1">
                Stake
                <ArrowUpRight className="h-3 w-3" aria-hidden />
              </Link>
            </div>

            <div className="p-5 sm:p-6 space-y-6">
              <div>
                <div className="flex justify-between items-end gap-2 mb-3">
                  <span className="text-xs font-mono uppercase tracking-wider text-text-muted">Minted</span>
                  <span className="text-lg font-semibold text-white tabular-nums">
                    {nftTotalMinted !== undefined ? Number(nftTotalMinted).toLocaleString() : '—'}
                    <span className="text-sm font-normal text-text-muted ml-1">/ 100K</span>
                  </span>
                </div>
                <div className="h-2 rounded-full bg-black/50 border border-white/[0.06] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-500 to-primary transition-all duration-700"
                    style={{ width: `${Math.min(Math.max(progress, 0.5), 100)}%` }}
                  />
                </div>
              </div>

              <div className="rounded-lg border border-white/[0.08] bg-[#07070f]/90 p-4">
                <span className="text-xs font-mono uppercase tracking-wider text-text-muted block mb-3">Quantity</span>
                <div className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/40 p-1">
                  <button
                    type="button"
                    onClick={() => setAmount((a) => Math.max(1, a - 1))}
                    className="flex h-11 w-11 items-center justify-center rounded-md text-white hover:bg-white/10 transition-colors"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="h-5 w-5" aria-hidden />
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={amount}
                    onChange={(e) => setAmount(Math.max(1, Math.min(100, parseInt(e.target.value, 10) || 1)))}
                    className="w-20 bg-transparent text-center text-3xl font-semibold text-white outline-none tabular-nums"
                  />
                  <button
                    type="button"
                    onClick={() => setAmount((a) => Math.min(100, a + 1))}
                    className="flex h-11 w-11 items-center justify-center rounded-md text-white hover:bg-white/10 transition-colors"
                    aria-label="Increase quantity"
                  >
                    <Plus className="h-5 w-5" aria-hidden />
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-2 mt-3">
                  {[1, 5, 10, 20].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setAmount(num)}
                      className={`rounded-md border py-2 text-xs font-semibold transition-colors ${
                        amount === num
                          ? 'border-primary/50 bg-primary/15 text-primary-light'
                          : 'border-white/10 text-text-muted hover:border-white/20 hover:text-white'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-end gap-2 pt-1">
                <span className="text-xs font-mono uppercase tracking-wider text-text-muted">Total</span>
                <span className="text-2xl font-semibold text-white tabular-nums">
                  {(amount * ethPrice).toFixed(3)} <span className="text-lg text-primary-light">ETH</span>
                </span>
              </div>

              {!address ? (
                <div className="w-full rounded-lg border border-white/10 bg-white/[0.03] py-4 text-center text-sm font-medium text-text-muted">
                  Connect wallet to mint
                </div>
              ) : nftRemaining !== undefined && nftRemaining === 0n ? (
                <div className="w-full rounded-lg border border-white/10 py-4 text-center text-sm font-medium text-text-muted">Sold out</div>
              ) : (
                <button
                  type="button"
                  onClick={handleMint}
                  disabled={isPending || isConfirming || !amount}
                  className="w-full rounded-md bg-primary py-4 text-base font-semibold text-white shadow-[0_0_0_1px_rgba(0,0,0,0.2)] hover:bg-primary-dark transition-colors disabled:opacity-40 disabled:pointer-events-none"
                >
                  {isPending || isConfirming ? 'Minting…' : `Mint ${amount} Bear${amount > 1 ? 's' : ''}`}
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
