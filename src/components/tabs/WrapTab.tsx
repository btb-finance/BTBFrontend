'use client'
import { useEffect, useState } from 'react'
import { useAccount, useReadContracts, useWaitForTransactionReceipt, useWriteContract } from 'wagmi'
import { ArrowDownUp } from 'lucide-react'
import { BTBB_ABI, CONTRACTS, ERC20_ABI } from '@/lib/contracts'
import { formatToken, formatTokenRaw, parseTokenInput } from '@/lib/utils'

type Dir = 'wrap' | 'unwrap'
type PA = 'approve-then-wrap' | 'wrap' | 'unwrap' | null

export default function WrapTab() {
  const { address } = useAccount()
  const [amount, setAmount] = useState('')
  const [dir, setDir] = useState<Dir>('wrap')
  const [pa, setPa] = useState<PA>(null)
  const [saved, setSaved] = useState(0n)

  const { data, refetch } = useReadContracts({ contracts: address ? [
    { address: CONTRACTS.BTB, abi: ERC20_ABI, functionName: 'balanceOf', args: [address] } as any,
    { address: CONTRACTS.BTBB, abi: ERC20_ABI, functionName: 'balanceOf', args: [address] } as any,
    { address: CONTRACTS.BTB, abi: ERC20_ABI, functionName: 'allowance', args: [address, CONTRACTS.BTBB] } as any,
  ] : [], query: { refetchInterval: 15000 } })

  const btbBal = data?.[0]?.result as bigint | undefined
  const btbbBal = data?.[1]?.result as bigint | undefined
  const allowance = data?.[2]?.result as bigint | undefined

  const { data: hash, writeContract, isPending, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  useEffect(() => {
    if (!isSuccess || !pa) return
    const run = async () => {
      await refetch()
      if (pa === 'approve-then-wrap') { reset(); setPa('wrap'); writeContract({ address: CONTRACTS.BTBB, abi: BTBB_ABI, functionName: 'mint', args: [saved] }); return }
      setPa(null); setAmount(''); reset()
    }
    run()
  }, [isSuccess, pa, refetch, reset, saved, writeContract])

  const parsed = amount && !isNaN(+amount) ? parseTokenInput(amount, 18) : 0n
  const bal = dir === 'wrap' ? btbBal : btbbBal
  const needsApproval = dir === 'wrap' && allowance !== undefined && allowance < parsed && parsed > 0n
  const busy = isPending || isConfirming
  const hasEnough = bal !== undefined && bal >= parsed

  const act = () => {
    if (!amount || isNaN(+amount)) return
    if (dir === 'wrap') {
      if (needsApproval) { setSaved(parsed); setPa('approve-then-wrap'); writeContract({ address: CONTRACTS.BTB, abi: ERC20_ABI, functionName: 'approve', args: [CONTRACTS.BTBB, parsed] }); return }
      setPa('wrap'); writeContract({ address: CONTRACTS.BTBB, abi: BTBB_ABI, functionName: 'mint', args: [parsed] })
    } else { setPa('unwrap'); writeContract({ address: CONTRACTS.BTBB, abi: BTBB_ABI, functionName: 'redeem', args: [parsed] }) }
  }

  const fromSym = dir === 'wrap' ? 'BTB' : 'BTBB'
  const toSym = dir === 'wrap' ? 'BTBB' : 'BTB'
  const btnLabel = busy ? (pa === 'approve-then-wrap' && !isSuccess ? 'Approving…' : dir === 'wrap' ? 'Wrapping…' : 'Unwrapping…') : needsApproval ? 'Approve & Wrap' : dir === 'wrap' ? 'Wrap BTB → BTBB' : 'Unwrap BTBB → BTB'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingTop: '0.5rem' }}>
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: '1.3rem' }}>{dir === 'wrap' ? 'Wrap BTB' : 'Unwrap BTBB'}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)', marginTop: 2 }}>1:1 · no fee on conversion</div>
          </div>
          <button onClick={() => { setDir(d => d === 'wrap' ? 'unwrap' : 'wrap'); setAmount('') }} className="btn btn-ghost btn-sm">
            <ArrowDownUp size={14} /> Reverse
          </button>
        </div>

        <div className="swap-box" style={{ marginBottom: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.72rem', color: 'var(--color-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            <span>You send</span>
            <button style={{ color: 'var(--color-brand)', fontWeight: 800 }} onClick={() => bal && setAmount(formatTokenRaw(bal, 18))}>
              Max: {bal !== undefined ? formatToken(bal) : '0'}
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <input className="amount-input" type="text" inputMode="decimal" placeholder="0.0" value={amount} onChange={e => setAmount(e.target.value)} />
            <span className="token-chip">{fromSym}</span>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', margin: '0.25rem 0' }}>
          <div className="swap-arrow" onClick={() => { setDir(d => d === 'wrap' ? 'unwrap' : 'wrap'); setAmount('') }}>
            <ArrowDownUp size={16} />
          </div>
        </div>

        <div className="swap-box" style={{ marginBottom: '1rem', opacity: 0.7 }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>You receive</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className="amount-input" style={{ cursor: 'default' }}>{amount && parsed > 0n ? formatToken(parsed) : '0.0'}</div>
            <span className="token-chip">{toSym}</span>
          </div>
        </div>

        {!address ? <div className="empty-state">Connect your wallet to wrap / unwrap</div>
          : !hasEnough && amount ? <div className="badge badge-red" style={{ width: '100%', justifyContent: 'center', padding: '0.85rem' }}>Insufficient {fromSym} balance</div>
          : <button className="btn btn-primary" style={{ width: '100%' }} onClick={act} disabled={busy || !amount || !hasEnough}>{btnLabel}</button>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
        {[['Your BTB', btbBal !== undefined ? formatToken(btbBal) : '—'],
          ['Your BTBB', btbbBal !== undefined ? formatToken(btbbBal) : '—']].map(([l, v]) => (
          <div className="stat-tile" key={l}>
            <div className="stat-label">{l}</div>
            <div className="stat-value" style={{ fontSize: '1.1rem' }}>{v}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
