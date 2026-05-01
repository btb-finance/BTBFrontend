'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowLeftRight, Home, Images, RefreshCw, TrendingUp, Zap } from 'lucide-react'

const iconClass = 'h-[18px] w-[18px]'

const tabs = [
  { href: '/', label: 'Home', icon: <Home className={iconClass} strokeWidth={2} aria-hidden /> },
  { href: '/wrap', label: 'Wrap', icon: <ArrowLeftRight className={iconClass} strokeWidth={2} aria-hidden /> },
  { href: '/flip', label: 'FLIP', icon: <TrendingUp className={iconClass} strokeWidth={2} aria-hidden /> },
  { href: '/nft', label: 'NFT', icon: <Images className={iconClass} strokeWidth={2} aria-hidden /> },
  { href: '/stake', label: 'Stake', icon: <Zap className={iconClass} strokeWidth={2} aria-hidden /> },
  { href: '/opos', label: 'OPOS', icon: <RefreshCw className={iconClass} strokeWidth={2} aria-hidden /> },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="safe-bottom fixed bottom-0 left-0 right-0 z-50 px-2 pb-2 md:px-4">
      <div className="bottom-nav-shell mx-auto max-w-[30rem] rounded-lg px-1.5 py-1.5 lg:max-w-[72rem]">
        <div className="grid grid-cols-6 gap-1">
          {tabs.map((tab) => {
            const active = pathname === tab.href

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex min-w-0 flex-col items-center gap-1 rounded-md px-1 py-2 text-[9px] font-bold uppercase transition sm:text-[10px] ${
                  active
                    ? 'bg-[var(--color-brand)] text-[#03100b]'
                    : 'text-[var(--color-muted)] hover:bg-white/5 hover:text-[var(--color-ink)]'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
