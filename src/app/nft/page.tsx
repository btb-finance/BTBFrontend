'use client'

import { useState, useEffect, useMemo } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { Header } from '@/components/Header'
import { CONTRACTS, BEAR_NFT_ABI } from '@/lib/contracts'
import { useProtocol } from '@/lib/protocol-context'
import { Plus, Minus } from 'lucide-react'

const NFT_IMAGE_BASE = 'https://bafybeidlyvep6mqlaleervelrr2ev2bs2dxljsz3gs2wk4p5c6e23mvffu.ipfs.w3s.link'

// Pick 4 random unique IDs from 1..total
function pickRandom(total: number, count: number) {
  const ids = new Set<number>()
  const max = Math.max(total, 1)
  while (ids.size < Math.min(count, max)) {
    ids.add(Math.floor(Math.random() * max) + 1)
  }
  return [...ids]
}

export default function NFT() {
  const { address } = useAccount()
  const { nftTotalMinted, nftRemaining, nftPrice } = useProtocol()
  const [amount, setAmount] = useState<number>(1)
  const [activeIdx, setActiveIdx] = useState(0)

  // Pick 4 random NFT IDs once when totalMinted is known — no repeated RPC
  const previewIds = useMemo(() => {
    const total = nftTotalMinted ? Number(nftTotalMinted) : 0
    return total > 0 ? pickRandom(total, 4) : [1, 2, 3, 4]
  }, [nftTotalMinted])

  // Cycle through the pre-picked images
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIdx(i => (i + 1) % previewIds.length)
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
    <div className="relative z-10 font-sans pb-32 overflow-x-hidden min-h-screen">
      <div className="fixed inset-0 z-[-1] pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 -right-40 w-[40rem] h-[40rem] bg-orange-500/10 blur-[150px] rounded-full mix-blend-screen opacity-60" />
        <div className="absolute bottom-1/4 -left-40 w-[30rem] h-[30rem] bg-primary/20 blur-[120px] rounded-full mix-blend-screen opacity-50" />
      </div>

      <Header />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-20 space-y-16">
        <div className="text-center">
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight mb-4 text-white">The <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-primary">Bear Collection</span></h1>
          <p className="text-lg sm:text-xl text-text-secondary max-w-2xl mx-auto font-medium">Mint an exclusive Bear NFT to unlock protocol transfer taxes via the staking module.</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-center max-w-5xl mx-auto">
          <div className="relative group flex items-center justify-center">
            <div className="absolute inset-0 bg-primary/30 blur-[80px] rounded-[3rem] group-hover:bg-primary/50 transition-colors duration-700" />
            <div className="relative w-full aspect-square">
              {previewIds.map((id, i) => {
                const offset = (i - activeIdx + previewIds.length) % previewIds.length
                const isActive = offset === 0
                return (
                  <div
                    key={id}
                    className="absolute inset-0 rounded-[2.5rem] border-2 overflow-hidden shadow-2xl transition-all duration-700 ease-in-out"
                    style={{
                      transform: `scale(${1 - offset * 0.06}) translateY(${offset * 16}px)`,
                      opacity: offset > 2 ? 0 : 1 - offset * 0.2,
                      zIndex: previewIds.length - offset,
                      borderColor: isActive ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.1)',
                    }}
                  >
                    <img src={`${NFT_IMAGE_BASE}/${id}.png`} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />
                    {isActive && (
                      <span className="absolute bottom-4 left-4 text-sm font-black text-white/90 drop-shadow-md animate-[fadeIn_0.4s_ease-in-out]">
                        Bear #{id}
                      </span>
                    )}
                  </div>
                )
              })}
              {/* Dots indicator */}
              <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 flex gap-2 z-20">
                {previewIds.map((_, i) => (
                  <div key={i} className={`w-2 h-2 rounded-full transition-all duration-500 ${i === activeIdx ? 'bg-primary w-6' : 'bg-white/20'}`} />
                ))}
              </div>
            </div>
          </div>

          <div className="glass p-8 sm:p-12 rounded-[3rem] border border-white/10 bg-surface/80 backdrop-blur-3xl relative overflow-hidden">
            <div className="space-y-8">
              <div>
                <div className="flex justify-between items-end mb-3">
                  <span className="text-sm font-bold text-text-muted uppercase tracking-widest">Total Minted</span>
                  <span className="text-2xl font-black text-white">{nftTotalMinted !== undefined ? Number(nftTotalMinted).toLocaleString() : '---'} <span className="text-sm font-medium text-text-muted">/ 100K</span></span>
                </div>
                <div className="h-4 bg-black/50 rounded-full overflow-hidden border border-white/5 relative">
                  <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-orange-500 to-primary rounded-full transition-all duration-1000 ease-out" style={{ width: `${Math.max(progress, 1)}%` }}>
                    <div className="w-full h-full bg-[linear-gradient(45deg,rgba(255,255,255,0.2)25%,transparent_25%,transparent_50%,rgba(255,255,255,0.2)50%,rgba(255,255,255,0.2)75%,transparent_75%,transparent)] bg-[length:1rem_1rem] animate-[stripes_1s_linear_infinite]" />
                  </div>
                </div>
              </div>

              <div className="bg-black/40 rounded-[2rem] p-6 border border-white/5">
                <div className="text-sm font-bold text-text-muted uppercase tracking-widest mb-4">Select Quantity</div>
                <div className="flex items-center justify-between bg-white/5 rounded-2xl p-2 border border-white/10 mb-4">
                  <button onClick={() => setAmount(Math.max(1, amount - 1))} className="w-14 h-14 rounded-xl flex items-center justify-center text-white hover:bg-white/10 transition-colors"><Minus size={24} /></button>
                  <input type="number" value={amount} onChange={(e) => setAmount(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))} className="w-24 bg-transparent text-center text-4xl font-black text-white outline-none" />
                  <button onClick={() => setAmount(Math.min(100, amount + 1))} className="w-14 h-14 rounded-xl flex items-center justify-center text-white hover:bg-white/10 transition-colors"><Plus size={24} /></button>
                </div>
                <div className="flex gap-2">
                  {[1, 5, 10, 20].map((num) => (
                    <button key={num} onClick={() => setAmount(num)} className={`flex-1 py-2 text-sm font-bold rounded-xl border transition-colors ${amount === num ? 'bg-primary/20 border-primary text-primary-light' : 'bg-transparent border-white/10 text-text-muted hover:border-white/30 hover:text-white'}`}>+{num}</button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex justify-between items-end mb-6">
                  <span className="text-sm font-bold text-text-muted uppercase tracking-widest">Total Price</span>
                  <span className="text-3xl font-black text-white">{(amount * ethPrice).toFixed(3)} <span className="text-xl text-primary-light">ETH</span></span>
                </div>
                {!address ? (
                  <div className="w-full py-5 rounded-[1.5rem] bg-white/5 text-center text-text-muted font-bold tracking-widest uppercase border border-white/10">Connect wallet to continue</div>
                ) : nftRemaining !== undefined && nftRemaining === 0n ? (
                  <div className="w-full py-5 rounded-[1.5rem] bg-white/5 text-center text-text-muted font-bold tracking-widest uppercase border border-white/10">Sold Out</div>
                ) : (
                  <button onClick={handleMint} disabled={isPending || isConfirming || !amount} className="w-full btn-primary py-5 rounded-[1.5rem] text-lg font-black tracking-widest shadow-[0_0_30px_rgba(239,68,68,0.3)] hover:shadow-[0_0_50px_rgba(239,68,68,0.5)] transition-all disabled:opacity-50 disabled:pointer-events-none uppercase">
                    {isPending || isConfirming ? 'Minting...' : `Mint ${amount} Bear${amount > 1 ? 's' : ''}`}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
