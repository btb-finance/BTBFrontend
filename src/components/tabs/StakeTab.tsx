'use client'
import { useEffect, useState } from 'react'
import { useAccount, useReadContracts, useWaitForTransactionReceipt, useWriteContract } from 'wagmi'
import { Zap } from 'lucide-react'
import { BEAR_NFT_ABI, BEAR_STAKING_ABI, BTBB_ABI, CONTRACTS } from '@/lib/contracts'
import { formatCompact } from '@/lib/utils'
import { useProtocol } from '@/lib/protocol-context'

const IMG = 'https://bafybeidlyvep6mqlaleervelrr2ev2bs2dxljsz3gs2wk4p5c6e23mvffu.ipfs.w3s.link'
type PA = 'approve-then-stake' | 'stake' | 'unstake' | 'claim' | 'claim-then-redeem' | 'redeem' | null

export default function StakeTab() {
  const { address } = useAccount()
  const { stakingStats, nftStakedCount: stakedCount, nftBalance: unstakedCount, nftApprovedForStaking: isApproved, pendingRewards, refetch: refetchGlobal } = useProtocol()
  const [selected, setSelected] = useState<bigint[]>([])
  const [unstakeQty, setUnstakeQty] = useState(1)
  const [pa, setPa] = useState<PA>(null)

  const unstakedNum = Number(unstakedCount || 0)
  const { data: tokenIdData } = useReadContracts({ contracts: address && unstakedNum > 0
    ? Array.from({ length: Math.min(unstakedNum, 30) }, (_, i) => ({ address: CONTRACTS.BEAR_NFT, abi: BEAR_NFT_ABI, functionName: 'tokenOfOwnerByIndex' as const, args: [address, BigInt(i)] as const }))
    : [], allowFailure: true })

  const tokens = Array.from({ length: Math.min(unstakedNum, 30) }, (_, i) => {
    const r = tokenIdData?.[i]?.result
    return r !== undefined ? r as bigint : null
  })
  const realTokens = tokens.filter((t): t is bigint => t !== null)

  const gross = pendingRewards ? pendingRewards[0] : 0n
  const net = pendingRewards ? pendingRewards[1] : 0n
  const dailyPerBear = stakingStats && stakingStats[0] > 0n ? stakingStats[3] / stakingStats[0] : 0n

  const { data: hash, writeContract, isPending, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })
  const busy = isPending || isConfirming

  useEffect(() => {
    if (!isSuccess || !pa) return
    const run = async () => {
      await refetchGlobal()
      if (pa === 'approve-then-stake') { reset(); setPa('stake'); writeContract({ address: CONTRACTS.BEAR_STAKING, abi: BEAR_STAKING_ABI, functionName: 'stake', args: [selected] }); return }
      if (pa === 'claim-then-redeem') { reset(); setPa('redeem'); writeContract({ address: CONTRACTS.BTBB, abi: BTBB_ABI, functionName: 'redeem', args: [net] }); return }
      setPa(null); setSelected([]); reset()
    }
    run()
  }, [isSuccess, net, pa, refetchGlobal, reset, selected, writeContract])

  const stake = () => {
    if (!selected.length) return
    if (!isApproved) { setPa('approve-then-stake'); writeContract({ address: CONTRACTS.BEAR_NFT, abi: BEAR_NFT_ABI, functionName: 'setApprovalForAll', args: [CONTRACTS.BEAR_STAKING, true] }); return }
    setPa('stake'); writeContract({ address: CONTRACTS.BEAR_STAKING, abi: BEAR_STAKING_ABI, functionName: 'stake', args: [selected] })
  }

  const toggle = (id: bigint) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingTop: '0.5rem' }}>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.5rem' }}>
        {[['Staked', stakingStats ? Number(stakingStats[0]).toLocaleString() : '—'],
          ['Per Bear/Day', formatCompact(dailyPerBear) + ' BTBB'],
          ['Your Pending', formatCompact(net)]].map(([l,v]) => (
          <div className="stat-tile" key={l}>
            <div className="stat-label">{l}</div>
            <div className="stat-value" style={{ fontSize: '0.95rem' }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Rewards */}
      {gross > 0n && (
        <div className="card">
          <div style={{ fontWeight: 900, fontSize: '1.1rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Zap size={16} style={{ color: 'var(--color-brand)' }} /> Pending Rewards
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
            {[['Gross BTBB', formatCompact(gross)], ['Net BTBB', formatCompact(net)]].map(([l,v]) => (
              <div className="stat-tile" key={l}><div className="stat-label">{l}</div><div className="stat-value" style={{ fontSize: '1.05rem', color: 'var(--color-brand)' }}>{v}</div></div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-primary" style={{ flex: 1, minHeight: '2.75rem' }} disabled={busy} onClick={() => { setPa('claim'); writeContract({ address: CONTRACTS.BEAR_STAKING, abi: BEAR_STAKING_ABI, functionName: 'claim' }) }}>
              {busy && pa === 'claim' ? 'Claiming…' : 'Claim BTBB'}
            </button>
            <button className="btn btn-ghost" style={{ flex: 1, minHeight: '2.75rem', fontSize: '0.8rem' }} disabled={busy} onClick={() => { setPa('claim-then-redeem'); writeContract({ address: CONTRACTS.BEAR_STAKING, abi: BEAR_STAKING_ABI, functionName: 'claim' }) }}>
              {busy && (pa === 'claim-then-redeem' || pa === 'redeem') ? 'Processing…' : 'Claim → BTB'}
            </button>
          </div>
        </div>
      )}

      {/* NFT Selector */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <div style={{ fontWeight: 900, fontSize: '1.1rem' }}>Your Unstaked Bears</div>
          {realTokens.length > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={() => setSelected(s => s.length === realTokens.length ? [] : [...realTokens])}>
              {selected.length === realTokens.length ? 'Clear' : 'All'}
            </button>
          )}
        </div>

        {!address ? <div className="empty-state">Connect wallet to see your Bears</div>
          : unstakedNum === 0 ? <div className="empty-state">No unstaked Bears in wallet</div>
          : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.5rem', marginBottom: '0.75rem' }}>
              {tokens.map((id, i) => id === null ? (
                <div key={`sk-${i}`} style={{ aspectRatio: '1', borderRadius: 14, background: '#151515', border: '1px solid var(--color-line)', animation: 'pulse 1.5s infinite' }} />
              ) : (
                <button key={id.toString()} onClick={() => toggle(id)}
                  className={`nft-card${selected.includes(id) ? ' selected' : ''}`}>
                  <img src={`${IMG}/${id}.png`} alt={`#${id}`} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 14 }} />
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0.4rem 0.5rem', background: 'linear-gradient(to top,rgba(0,0,0,0.8),transparent)', fontSize: '0.65rem', fontWeight: 800, color: '#fff' }}>
                    #{id.toString()} {selected.includes(id) && '✓'}
                  </div>
                </button>
              ))}
            </div>
          )}

        <button className="btn btn-primary" style={{ width: '100%' }} onClick={stake} disabled={busy || selected.length === 0}>
          {busy && (pa === 'approve-then-stake' || pa === 'stake') ? (pa === 'approve-then-stake' && !isSuccess ? 'Approving…' : 'Staking…') : selected.length === 0 ? 'Select Bears to stake' : !isApproved ? `Approve & Stake ${selected.length}` : `Stake ${selected.length} Bear${selected.length > 1 ? 's' : ''}`}
        </button>
      </div>

      {/* Unstake */}
      {address && stakedCount !== undefined && stakedCount > 0n && (
        <div className="card">
          <div style={{ fontWeight: 900, fontSize: '1.1rem', marginBottom: '0.75rem' }}>Unstake</div>
          <div className="stat-tile" style={{ marginBottom: '0.75rem' }}>
            <div className="stat-label">Currently staked</div>
            <div className="stat-value">{stakedCount.toString()} Bears</div>
          </div>
          <div className="stepper" style={{ marginBottom: '0.75rem' }}>
            <button className="stepper-btn" onClick={() => setUnstakeQty(q => Math.max(1, q - 1))}>−</button>
            <span className="stepper-val">{unstakeQty}</span>
            <button className="stepper-btn" onClick={() => setUnstakeQty(q => Math.min(Number(stakedCount), q + 1))}>+</button>
          </div>
          <button className="btn btn-ghost" style={{ width: '100%' }} disabled={busy} onClick={() => { setPa('unstake'); writeContract({ address: CONTRACTS.BEAR_STAKING, abi: BEAR_STAKING_ABI, functionName: 'unstake', args: [BigInt(unstakeQty)] }) }}>
            {busy && pa === 'unstake' ? 'Unstaking…' : `Unstake ${unstakeQty} Bear${unstakeQty > 1 ? 's' : ''}`}
          </button>
        </div>
      )}
    </div>
  )
}
