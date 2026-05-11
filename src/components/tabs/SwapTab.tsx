'use client'
import { useEffect, useRef, useState } from 'react'
import { useAccount, useReadContracts, useWaitForTransactionReceipt, useWriteContract } from 'wagmi'
import { ArrowDownUp, CheckCircle2, ChevronDown, Zap } from 'lucide-react'
import { BTBB_ABI, CONTRACTS, ERC20_ABI, FLIP_ABI, OPOS_ABI } from '@/lib/contracts'
import { formatToken, formatTokenRaw, parseTokenInput } from '@/lib/utils'

// ── Tokens ────────────────────────────────────────────────────────
type Sym = 'BTB' | 'BTBB' | 'OPOS' | 'FLIP' | 'USDC'
const TOKENS: Record<Sym, { sym: Sym; decimals: number; addr: `0x${string}`; color: string; icon: string }> = {
  BTB:  { sym: 'BTB',  decimals: 18, addr: CONTRACTS.BTB,  color: '#31ff9a', icon: '🟢' },
  BTBB: { sym: 'BTBB', decimals: 18, addr: CONTRACTS.BTBB, color: '#60d5ff', icon: '🔵' },
  OPOS: { sym: 'OPOS', decimals: 18, addr: CONTRACTS.OPOS, color: '#ffd166', icon: '🟡' },
  FLIP: { sym: 'FLIP', decimals: 6,  addr: CONTRACTS.FLIP, color: '#ff4d6d', icon: '🔴' },
  USDC: { sym: 'USDC', decimals: 6,  addr: CONTRACTS.USDC, color: '#8b8bff', icon: '🟣' },
}
const ALL_SYMS: Sym[] = ['BTB', 'BTBB', 'OPOS', 'FLIP', 'USDC']

// Smart defaults: FROM → [best default TO, ...other valid TOs]
const VALID_TO: Record<Sym, Sym[]> = {
  BTB:  ['BTBB', 'OPOS'],
  BTBB: ['BTB'],
  OPOS: ['BTB'],
  USDC: ['FLIP'],
  FLIP: ['USDC'],
}

// ── Route engine ──────────────────────────────────────────────────
// Returns the best route for a given pair. For now all routes are protocol.
// When aggregators are integrated on the backend, swap out previewOut / routeLabel here.
type Route = {
  label: string          // shown to user: "BTB Protocol · 1:1"
  spender: `0x${string}` | null  // who needs the approval
  preview: (amt: bigint) => bigint
  exec: (amt: bigint, wc: Function) => void
  needsApproval: (allowance: bigint | undefined, amt: bigint) => boolean
}

function getRoute(from: Sym, to: Sym): Route | null {
  if (from === 'BTB' && to === 'BTBB') return {
    label: 'BTB Protocol · 1:1 wrap',
    spender: CONTRACTS.BTBB,
    preview: amt => amt,
    exec: (amt, wc) => wc({ address: CONTRACTS.BTBB, abi: BTBB_ABI, functionName: 'mint', args: [amt] }),
    needsApproval: (al, amt) => al !== undefined && al < amt && amt > 0n,
  }
  if (from === 'BTBB' && to === 'BTB') return {
    label: 'BTB Protocol · 1:1 unwrap',
    spender: null,
    preview: amt => amt,
    exec: (amt, wc) => wc({ address: CONTRACTS.BTBB, abi: BTBB_ABI, functionName: 'redeem', args: [amt] }),
    needsApproval: () => false,
  }
  if (from === 'BTB' && to === 'OPOS') return {
    label: 'BTB Protocol · 1 BTB = 1M OPOS',
    spender: CONTRACTS.OPOS,
    preview: amt => amt * 1_000_000n,
    exec: (amt, wc) => wc({ address: CONTRACTS.OPOS, abi: OPOS_ABI, functionName: 'mint', args: [amt] }),
    needsApproval: (al, amt) => al !== undefined && al < amt && amt > 0n,
  }
  if (from === 'OPOS' && to === 'BTB') return {
    label: 'BTB Protocol · 1M OPOS = 1 BTB',
    spender: null,
    preview: amt => amt / 1_000_000n,
    exec: (amt, wc) => wc({ address: CONTRACTS.OPOS, abi: OPOS_ABI, functionName: 'burn', args: [amt] }),
    needsApproval: () => false,
  }
  if (from === 'USDC' && to === 'FLIP') return {
    label: 'FLIP Protocol · 10% protocol tax',
    spender: CONTRACTS.FLIP,
    preview: amt => amt - (amt * 1000n) / 10000n,
    exec: (amt, wc) => wc({ address: CONTRACTS.FLIP, abi: FLIP_ABI, functionName: 'flipUp', args: [amt] }),
    needsApproval: (al, amt) => al !== undefined && al < amt && amt > 0n,
  }
  if (from === 'FLIP' && to === 'USDC') return {
    label: 'FLIP Protocol · $0.90 guaranteed floor',
    spender: null,
    preview: amt => amt - (amt * 1000n) / 10000n,
    exec: (amt, wc) => wc({ address: CONTRACTS.FLIP, abi: FLIP_ABI, functionName: 'flipDown', args: [amt] }),
    needsApproval: () => false,
  }
  return null // pair not yet supported
}

// ── Token picker ──────────────────────────────────────────────────
function TokenPicker({ value, options, onChange }: { value: Sym; options: Sym[]; onChange: (s: Sym) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const tok = TOKENS[value]

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.5rem 0.85rem', borderRadius: 14, border: `1.5px solid ${tok.color}55`, background: `${tok.color}14`, color: tok.color, fontWeight: 900, fontSize: '0.95rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
        {tok.icon} {tok.sym} <ChevronDown size={14} />
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 100, background: '#131313', border: '1.5px solid var(--color-line)', borderRadius: 14, overflow: 'hidden', minWidth: 150, boxShadow: '0 12px 32px rgba(0,0,0,0.6)' }}>
          {options.map((s, i) => {
            const t = TOKENS[s]
            return (
              <button key={s} onClick={() => { onChange(s); setOpen(false) }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.7rem 0.9rem', background: s === value ? `${t.color}18` : 'transparent', color: s === value ? t.color : 'var(--color-ink)', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer', borderBottom: i < options.length - 1 ? '1px solid var(--color-line)' : 'none' }}>
                {t.icon} {t.sym}
                {s === value && <CheckCircle2 size={13} style={{ marginLeft: 'auto', color: t.color }} />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────
type PA = 'approve' | 'tx' | null

export default function SwapTab() {
  const { address } = useAccount()
  const [from, setFrom] = useState<Sym>('BTB')
  const [to, setTo]     = useState<Sym>('BTBB')
  const [amount, setAmount] = useState('')      // display string
  const [rawAmount, setRawAmount] = useState(0n) // exact bigint — never loses precision
  const [pa, setPa]     = useState<PA>(null)
  const [saved, setSaved] = useState(0n)

  const fromTok = TOKENS[from]
  const toTok   = TOKENS[to]
  const route   = getRoute(from, to)

  const { data, refetch } = useReadContracts({
    contracts: address ? [
      { address: fromTok.addr, abi: ERC20_ABI, functionName: 'balanceOf', args: [address] } as any,
      { address: toTok.addr,   abi: ERC20_ABI, functionName: 'balanceOf', args: [address] } as any,
      ...(route?.spender ? [{ address: fromTok.addr, abi: ERC20_ABI, functionName: 'allowance', args: [address, route.spender] } as any] : []),
    ] : [],
    query: { refetchInterval: 15_000 },
  })

  const fromBal   = data?.[0]?.result as bigint | undefined
  const toBal     = data?.[1]?.result as bigint | undefined
  const allowance = route?.spender ? data?.[2]?.result as bigint | undefined : undefined

  const { data: hash, writeContract, isPending, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  // When tx succeeds: clear both display and raw
  useEffect(() => {
    if (!isSuccess || !pa || !route) return
    const run = async () => {
      await refetch()
      if (pa === 'approve') { reset(); setPa('tx'); route.exec(saved, writeContract); return }
      setPa(null); setAmount(''); setRawAmount(0n); reset()
    }
    run()
  }, [isSuccess]) // eslint-disable-line

  // rawAmount is the source of truth for tx; amount string is just display
  const parsed     = rawAmount
  const previewOut = route && parsed > 0n ? route.preview(parsed) : 0n
  const needsAppr  = route ? route.needsApproval(allowance, parsed) : false
  const hasEnough  = fromBal !== undefined && parsed > 0n && fromBal >= parsed
  const busy       = isPending || isConfirming

  const swapTokens = () => {
    const rev = getRoute(to, from)
    if (rev) { setFrom(to); setTo(from); setAmount(''); setRawAmount(0n) }
  }

  const setFromToken = (s: Sym) => {
    setFrom(s)
    const validTos = VALID_TO[s]
    if (!validTos.includes(to)) setTo(validTos[0])
    setAmount(''); setRawAmount(0n)
  }
  const setToToken = (s: Sym) => {
    setTo(s)
    setAmount(''); setRawAmount(0n)
  }

  // User types manually: parse string → rawAmount
  const handleInput = (val: string) => {
    setAmount(val)
    setRawAmount(val ? parseTokenInput(val, fromTok.decimals) : 0n)
  }

  // Max: set rawAmount directly from chain balance — zero string precision loss
  const handleMax = () => {
    if (!fromBal) return
    setAmount(formatTokenRaw(fromBal, fromTok.decimals))
    setRawAmount(fromBal) // exact bigint from chain
  }

  const act = () => {
    if (!route || !parsed || !hasEnough) return
    if (needsAppr && route.spender) {
      setSaved(parsed); setPa('approve')
      writeContract({ address: fromTok.addr, abi: ERC20_ABI, functionName: 'approve', args: [route.spender, parsed] })
      return
    }
    setPa('tx'); route.exec(parsed, writeContract)
  }

  const btnLabel = busy
    ? (pa === 'approve' ? 'Approving…' : 'Swapping…')
    : !route ? 'Pair not supported'
    : needsAppr ? `Approve ${from}`
    : `Swap ${from} → ${to}`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingTop: '0.5rem' }}>
      <div className="card">
        {/* ── From ── */}
        <div className="swap-box" style={{ marginBottom: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--color-muted)' }}>You send</span>
            <button style={{ color: fromTok.color, fontWeight: 800, fontSize: '0.72rem' }} onClick={handleMax}>
              Max: {fromBal !== undefined ? formatToken(fromBal, fromTok.decimals) : '—'}
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <input className="amount-input" type="text" inputMode="decimal" placeholder="0.0"
              value={amount} onChange={e => handleInput(e.target.value)} style={{ flex: 1, minWidth: 0 }} />
            <TokenPicker value={from} options={ALL_SYMS} onChange={setFromToken} />
          </div>
        </div>

        {/* ── Arrow ── */}
        <div style={{ display: 'flex', justifyContent: 'center', margin: '0.2rem 0' }}>
          <div className="swap-arrow" onClick={swapTokens}><ArrowDownUp size={16} /></div>
        </div>

        {/* ── To ── */}
        <div className="swap-box" style={{ marginBottom: '0.875rem', opacity: 0.85 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--color-muted)' }}>You receive</span>
            {toBal !== undefined && (
              <span style={{ color: toTok.color, fontWeight: 700, fontSize: '0.72rem' }}>
                Bal: {formatToken(toBal, toTok.decimals)}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className="amount-input" style={{ cursor: 'default', flex: 1, color: previewOut > 0n ? 'var(--color-ink)' : 'rgba(255,255,255,0.25)' }}>
              {previewOut > 0n ? formatToken(previewOut, toTok.decimals) : '0.0'}
            </div>
            <TokenPicker value={to} options={VALID_TO[from]} onChange={setToToken} />
          </div>
        </div>

        {/* ── Route badge ── */}
        {route ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.875rem', padding: '0.55rem 0.75rem', borderRadius: 12, background: 'rgba(49,255,154,0.05)', border: '1px solid rgba(49,255,154,0.12)' }}>
            <Zap size={13} style={{ color: 'var(--color-brand)', flexShrink: 0 }} />
            <span style={{ fontSize: '0.72rem', color: 'var(--color-muted)', lineHeight: 1.4 }}>
              <span style={{ color: 'var(--color-brand)', fontWeight: 800 }}>Best route: </span>
              {route.label}
            </span>
          </div>
        ) : (
          <div style={{ marginBottom: '0.875rem', padding: '0.55rem 0.75rem', borderRadius: 12, background: 'rgba(255,77,109,0.06)', border: '1px solid rgba(255,77,109,0.2)', fontSize: '0.72rem', color: 'var(--color-berry)' }}>
            No direct route for {from} → {to}. Try swapping via BTB or BTBB as an intermediate.
          </div>
        )}

        {/* ── Button ── */}
        {!address
          ? <div className="empty-state">Connect wallet to swap</div>
          : !hasEnough && amount && parsed > 0n
            ? <div style={{ padding: '0.85rem', borderRadius: 14, background: 'rgba(255,77,109,0.08)', border: '1px solid rgba(255,77,109,0.2)', color: 'var(--color-berry)', fontWeight: 700, fontSize: '0.85rem', textAlign: 'center' }}>
                Insufficient {from} balance
              </div>
            : <button className="btn btn-primary" style={{ width: '100%' }} onClick={act}
                disabled={busy || !route || !amount || !hasEnough}>
                {btnLabel}
              </button>
        }
      </div>
    </div>
  )
}
