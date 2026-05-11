'use client'
import { useEffect, useState } from 'react'
import { useAccount, useReadContracts, useWaitForTransactionReceipt, useWriteContract } from 'wagmi'
import { ArrowDownUp, ShieldCheck, TrendingDown, TrendingUp } from 'lucide-react'
import { CONTRACTS, ERC20_ABI, FLIP_ABI } from '@/lib/contracts'
import { formatCompact, formatToken, formatTokenRaw, parseTokenInput } from '@/lib/utils'

const DEC = 6
const TAX = 1000n, BASIS = 10000n
type Dir = 'up' | 'down'
type PA = 'approve-then-up' | 'up' | 'down' | null

export default function FlipTab() {
  const { address } = useAccount()
  const [amount, setAmount] = useState('')
  const [dir, setDir] = useState<Dir>('up')
  const [pa, setPa] = useState<PA>(null)
  const [saved, setSaved] = useState(0n)

  const { data, refetch } = useReadContracts({ contracts: address ? [
    { address: CONTRACTS.USDC, abi: ERC20_ABI, functionName: 'balanceOf', args: [address] } as any,
    { address: CONTRACTS.FLIP, abi: ERC20_ABI, functionName: 'balanceOf', args: [address] } as any,
    { address: CONTRACTS.USDC, abi: ERC20_ABI, functionName: 'allowance', args: [address, CONTRACTS.FLIP] } as any,
    { address: CONTRACTS.FLIP, abi: ERC20_ABI, functionName: 'totalSupply' } as any,
    { address: CONTRACTS.FLIP, abi: FLIP_ABI, functionName: 'getUSDCBalance' } as any,
    { address: CONTRACTS.FLIP, abi: FLIP_ABI, functionName: 'isFullyBacked' } as any,
  ] : [
    { address: CONTRACTS.FLIP, abi: ERC20_ABI, functionName: 'totalSupply' } as any,
    { address: CONTRACTS.FLIP, abi: FLIP_ABI, functionName: 'getUSDCBalance' } as any,
    { address: CONTRACTS.FLIP, abi: FLIP_ABI, functionName: 'isFullyBacked' } as any,
  ], query: { refetchInterval: 15000 } })

  const usdcBal = address ? data?.[0]?.result as bigint | undefined : undefined
  const flipBal = address ? data?.[1]?.result as bigint | undefined : undefined
  const allowance = address ? data?.[2]?.result as bigint | undefined : undefined
  const flipSupply = address ? data?.[3]?.result as bigint | undefined : data?.[0]?.result as bigint | undefined
  const reserves = address ? data?.[4]?.result as bigint | undefined : data?.[1]?.result as bigint | undefined
  const backed = address ? data?.[5]?.result as boolean | undefined : data?.[2]?.result as boolean | undefined

  const { data: hash, writeContract, isPending, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  useEffect(() => {
    if (!isSuccess || !pa) return
    const run = async () => {
      await refetch()
      if (pa === 'approve-then-up') { reset(); setPa('up'); writeContract({ address: CONTRACTS.FLIP, abi: FLIP_ABI, functionName: 'flipUp', args: [saved] }); return }
      setPa(null); setAmount(''); reset()
    }
    run()
  }, [isSuccess, pa, refetch, reset, saved, writeContract])

  const parsed = amount && !isNaN(+amount) ? parseTokenInput(amount, DEC) : 0n
  const preview = parsed > 0n ? parsed - (parsed * TAX) / BASIS : 0n
  const bal = dir === 'up' ? usdcBal : flipBal
  const needsApproval = dir === 'up' && allowance !== undefined && allowance < parsed && parsed > 0n
  const busy = isPending || isConfirming
  const hasEnough = bal !== undefined && bal >= parsed
  const fromSym = dir === 'up' ? 'USDC' : 'FLIP'
  const toSym = dir === 'up' ? 'FLIP' : 'USDC'

  const act = () => {
    if (!amount || isNaN(+amount)) return
    if (dir === 'up') {
      if (needsApproval) { setSaved(parsed); setPa('approve-then-up'); writeContract({ address: CONTRACTS.USDC, abi: ERC20_ABI, functionName: 'approve', args: [CONTRACTS.FLIP, parsed] }); return }
      setPa('up'); writeContract({ address: CONTRACTS.FLIP, abi: FLIP_ABI, functionName: 'flipUp', args: [parsed] })
    } else { setPa('down'); writeContract({ address: CONTRACTS.FLIP, abi: FLIP_ABI, functionName: 'flipDown', args: [parsed] }) }
  }

  const btnLabel = busy ? (pa === 'approve-then-up' && !isSuccess ? 'Approving…' : dir === 'up' ? 'Flipping up…' : 'Redeeming…') : needsApproval ? 'Approve & Flip' : dir === 'up' ? 'Flip Up (USDC → FLIP)' : 'Flip Down (FLIP → USDC)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingTop: '0.5rem' }}>
      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.5rem' }}>
        {[['Floor', '$0.90', 'var(--color-brand)'],
          ['Ceiling', '$1.10', 'var(--color-ink)'],
          ['Reserves', reserves !== undefined ? formatCompact(reserves, DEC) : '—', backed ? 'var(--color-brand)' : 'var(--color-berry)']].map(([l,v,c]) => (
          <div className="stat-tile" key={l}>
            <div className="stat-label">{l}</div>
            <div className="stat-value" style={{ fontSize: '1.1rem', color: c }}>{v}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: '1.3rem' }}>{dir === 'up' ? 'Flip Up' : 'Flip Down'}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)', marginTop: 2 }}>10% protocol tax on contract use</div>
          </div>
          <button onClick={() => { setDir(d => d === 'up' ? 'down' : 'up'); setAmount('') }} className="btn btn-ghost btn-sm">
            <ArrowDownUp size={14} /> {dir === 'up' ? 'Redeem' : 'Mint'}
          </button>
        </div>

        <div className="swap-box" style={{ marginBottom: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.72rem', color: 'var(--color-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            <span>You send</span>
            <button style={{ color: 'var(--color-brand)', fontWeight: 800 }} onClick={() => bal && setAmount(formatTokenRaw(bal, DEC))}>
              Max: {bal !== undefined ? formatToken(bal, DEC) : '0'}
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <input className="amount-input" type="text" inputMode="decimal" placeholder="0.0" value={amount} onChange={e => setAmount(e.target.value)} />
            <span className="token-chip">{fromSym}</span>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', margin: '0.25rem 0' }}>
          <div className="swap-arrow" onClick={() => { setDir(d => d === 'up' ? 'down' : 'up'); setAmount('') }}>
            <ArrowDownUp size={16} />
          </div>
        </div>

        <div className="swap-box" style={{ marginBottom: '1rem', opacity: 0.7 }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>You receive (after 10% tax)</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className="amount-input" style={{ cursor: 'default' }}>{amount && preview > 0n ? formatToken(preview, DEC) : '0.0'}</div>
            <span className="token-chip">{toSym}</span>
          </div>
        </div>

        {!address ? <div className="empty-state">Connect your wallet to trade FLIP</div>
          : !hasEnough && amount ? <div className="badge badge-red" style={{ width: '100%', justifyContent: 'center', padding: '0.85rem' }}>Insufficient {fromSym}</div>
          : <button className="btn btn-primary" style={{ width: '100%' }} onClick={act} disabled={busy || !amount || !hasEnough}>{btnLabel}</button>}

        <div style={{ marginTop: '0.75rem', padding: '0.75rem', borderRadius: 12, background: 'rgba(49,255,154,0.05)', border: '1px solid rgba(49,255,154,0.12)', fontSize: '0.75rem', color: 'var(--color-muted)', lineHeight: 1.6 }}>
          <span style={{ color: 'var(--color-brand)', fontWeight: 800 }}>💡 Better for most users:</span> Buy FLIP on Uniswap DEX for no tax. Use Flip Down only as a guaranteed $0.90 stop-loss exit.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
        {[['FLIP Supply', flipSupply !== undefined ? formatCompact(flipSupply, DEC) : '—'],
          [address ? 'Your FLIP' : 'Backed', address && flipBal !== undefined ? formatToken(flipBal, DEC) : backed !== undefined ? (backed ? '✓ Yes' : '✗ Check') : '—']].map(([l,v]) => (
          <div className="stat-tile" key={l}>
            <div className="stat-label">{l}</div>
            <div className="stat-value" style={{ fontSize: '1.1rem' }}>{v}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
