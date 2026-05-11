'use client'
import { useMemo, useState } from 'react'
import { useAccount, useWaitForTransactionReceipt, useWriteContract } from 'wagmi'
import { BEAR_NFT_ABI, CONTRACTS } from '@/lib/contracts'
import { useProtocol } from '@/lib/protocol-context'

const BASE = 'https://bafybeidlyvep6mqlaleervelrr2ev2bs2dxljsz3gs2wk4p5c6e23mvffu.ipfs.w3s.link'

export default function NFTTab() {
  const { address } = useAccount()
  const { nftPrice, nftRemaining, nftTotalMinted } = useProtocol()
  const [qty, setQty] = useState(1)

  const previewId = useMemo(() => {
    const total = nftTotalMinted ? Number(nftTotalMinted) : 0
    return total > 0 ? Math.floor(Math.random() * total) + 1 : 1
  }, [nftTotalMinted])

  const { data: hash, writeContract, isPending } = useWriteContract()
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash })

  const mint = () => {
    if (!qty || !nftPrice) return
    writeContract({ address: CONTRACTS.BEAR_NFT, abi: BEAR_NFT_ABI, functionName: 'buyNFT', args: [BigInt(qty)], value: nftPrice * BigInt(qty) })
  }

  const minted = nftTotalMinted !== undefined ? Number(nftTotalMinted) : 0
  const ethPrice = nftPrice ? Number(nftPrice) / 1e18 : 0.01
  const progress = (minted / 100000) * 100
  const busy = isPending || isConfirming
  const qpct = [1, 5, 10, 20]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingTop: '0.5rem' }}>
      {/* Preview + stats */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
          <div style={{ width: 100, height: 100, borderRadius: 16, overflow: 'hidden', border: '1px solid var(--color-line)', flexShrink: 0 }}>
            <img src={`${BASE}/${previewId}.png`} alt={`Bear #${previewId}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 900, fontSize: '1.25rem', lineHeight: 1.2 }}>Bear NFT</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)', margin: '0.25rem 0 0.6rem' }}>1 Bear = 1 share of all staking rewards</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
              {[['Minted', minted.toLocaleString()], ['Price', `${ethPrice.toFixed(3)} ETH`]].map(([l,v]) => (
                <div key={l} style={{ padding: '0.5rem 0.6rem', borderRadius: 10, background: '#0e0e0e', border: '1px solid var(--color-line)' }}>
                  <div className="stat-label">{l}</div>
                  <div style={{ fontWeight: 900, fontSize: '0.95rem', marginTop: 2 }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Progress */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--color-muted)', fontWeight: 700, marginBottom: '0.4rem' }}>
            <span>MINT PROGRESS</span><span>{progress.toFixed(2)}% of 100,000</span>
          </div>
          <div className="progress-track"><div className="progress-fill" style={{ width: `${Math.min(progress, 100)}%` }} /></div>
        </div>
      </div>

      {/* Mint card */}
      <div className="card">
        <div style={{ fontWeight: 900, fontSize: '1.15rem', marginBottom: '1rem' }}>Mint Bears</div>

        {/* Quick qty buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.4rem', marginBottom: '0.75rem' }}>
          {qpct.map(n => (
            <button key={n} onClick={() => setQty(n)}
              style={{ padding: '0.55rem', borderRadius: 12, fontWeight: 800, fontSize: '0.85rem', border: `1.5px solid ${qty === n ? 'var(--color-brand)' : 'var(--color-line)'}`, background: qty === n ? 'rgba(49,255,154,0.1)' : '#0e0e0e', color: qty === n ? 'var(--color-brand)' : 'var(--color-copy)', cursor: 'pointer', transition: 'all 120ms' }}>
              {n}
            </button>
          ))}
        </div>

        {/* Stepper */}
        <div className="stepper" style={{ marginBottom: '0.75rem' }}>
          <button className="stepper-btn" onClick={() => setQty(q => Math.max(1, q - 1))}>−</button>
          <input className="stepper-val" type="number" min={1} max={100} value={qty} onChange={e => setQty(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))} />
          <button className="stepper-btn" onClick={() => setQty(q => Math.min(100, q + 1))}>+</button>
        </div>

        <div className="stat-tile" style={{ marginBottom: '0.75rem' }}>
          <div className="stat-label">Total cost</div>
          <div className="stat-value">{(qty * ethPrice).toFixed(4)} ETH</div>
        </div>

        {!address ? <div className="empty-state">Connect your wallet to mint</div>
          : nftRemaining !== undefined && nftRemaining === 0n ? <div className="badge badge-red" style={{ width: '100%', justifyContent: 'center', padding: '0.85rem' }}>Collection sold out</div>
          : <button className="btn btn-primary" style={{ width: '100%' }} onClick={mint} disabled={busy || !qty}>{busy ? 'Minting…' : `Mint ${qty} Bear${qty > 1 ? 's' : ''}`}</button>}
      </div>
    </div>
  )
}
