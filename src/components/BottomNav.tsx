'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, ArrowLeftRight, Images, Zap } from 'lucide-react'

const iconClass = 'h-[22px] w-[22px]'

const tabs = [
  { href: '/', label: 'Home', icon: <Home className={iconClass} strokeWidth={1.75} aria-hidden /> },
  { href: '/wrap', label: 'Wrap', icon: <ArrowLeftRight className={iconClass} strokeWidth={1.75} aria-hidden /> },
  { href: '/nft', label: 'NFT', icon: <Images className={iconClass} strokeWidth={1.75} aria-hidden /> },
  { href: '/stake', label: 'Stake', icon: <Zap className={iconClass} strokeWidth={1.75} aria-hidden /> },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 safe-bottom">
      <div className="bg-surface/95 backdrop-blur-xl border-t border-border">
        <div className="flex justify-around max-w-6xl mx-auto px-4">
          {tabs.map((tab) => {
            const active = pathname === tab.href
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex flex-col items-center gap-0.5 py-2.5 px-5 relative transition-all duration-200 ${
                  active ? 'text-primary' : 'text-text-muted'
                }`}
              >
                {active && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-primary" />
                )}
                <span className={active ? 'drop-shadow-[0_0_6px_rgba(239,68,68,0.4)]' : ''}>
                  {tab.icon}
                </span>
                <span className="text-[10px] font-medium tracking-wide">{tab.label}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
