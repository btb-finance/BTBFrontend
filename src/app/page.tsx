'use client'
import { useState } from 'react'
import { useAccount } from 'wagmi'
import { ConnectKitButton } from 'connectkit'
import Image from 'next/image'
import { ArrowLeftRight, TrendingUp, Images, Zap } from 'lucide-react'
import SwapTab from '@/components/tabs/SwapTab'
import FlipTab from '@/components/tabs/FlipTab'
import NFTTab from '@/components/tabs/NFTTab'
import StakeTab from '@/components/tabs/StakeTab'

type Tab = 'swap' | 'flip' | 'nft' | 'stake'
const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'swap',  label: 'Swap',  icon: <ArrowLeftRight size={16}/> },
  { id: 'flip',  label: 'FLIP',  icon: <TrendingUp size={16}/> },
  { id: 'nft',   label: 'Bears', icon: <Images size={16}/> },
  { id: 'stake', label: 'Stake', icon: <Zap size={16}/> },
]

export default function App() {
  const [tab, setTab] = useState<Tab>('swap')
  const { isConnected } = useAccount()

  return (
    <div style={{ minHeight: '100dvh', background: '#090909' }}>
      {/* Header */}
      <header className="app-header">
        <div style={{ maxWidth: 480, margin: '0 auto', padding: '0.65rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Image src="/images/btb-logo.png" alt="BTB" width={28} height={28} style={{ borderRadius: 10 }} />
            <span style={{ fontWeight: 900, fontSize: '0.85rem', color: 'var(--color-brand)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>BTB Finance</span>
          </div>
          <ConnectKitButton.Custom>
            {({ show, isConnected, truncatedAddress, ensName }) => (
              <button onClick={show} className={`btn btn-sm ${isConnected ? 'btn-ghost' : 'btn-primary'}`}>
                {isConnected ? (ensName || truncatedAddress) : 'Connect'}
              </button>
            )}
          </ConnectKitButton.Custom>
        </div>
      </header>

      {/* Content */}
      <main className="app-content">
        {tab === 'swap'  && <SwapTab />}
        {tab === 'flip'  && <FlipTab />}
        {tab === 'nft'   && <NFTTab />}
        {tab === 'stake' && <StakeTab />}
      </main>

      {/* Bottom Tab Bar */}
      <nav className="bottom-tab-bar">
        <div style={{ maxWidth: 480, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.25rem' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`section-tab${tab === t.id ? ' active' : ''}`}
              style={{ flexDirection: 'column', gap: '0.2rem', justifyContent: 'center', padding: '0.5rem 0.25rem', borderRadius: 14 }}>
              {t.icon}
              <span style={{ fontSize: '0.65rem', fontWeight: 700 }}>{t.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
