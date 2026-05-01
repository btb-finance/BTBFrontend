'use client'

import { ConnectKitButton } from 'connectkit'
import Image from 'next/image'
import Link from 'next/link'
import { useAccount, useSwitchChain } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { AlertTriangle, ArrowUpRight } from 'lucide-react'

const links = [
  { href: '/wrap', label: 'Wrap' },
  { href: '/flip', label: 'FLIP' },
  { href: '/nft', label: 'NFT' },
  { href: '/stake', label: 'Stake' },
  { href: '/opos', label: 'OPOS' },
]

export function Header({ title }: { title?: string }) {
  const { isConnected, chainId } = useAccount()
  const { switchChain } = useSwitchChain()
  const wrongNetwork = isConnected && chainId !== mainnet.id

  return (
    <>
      <header className="sticky top-0 z-40 px-2 pt-2 md:px-4">
        <div className="nav-shell mx-auto flex max-w-[72rem] items-center justify-between gap-2 rounded-lg px-2 py-2 md:px-3">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <Image
              src="/images/btb-logo.png"
              alt="BTB Finance"
              width={38}
              height={38}
              className="rounded-md border border-[var(--color-line)]"
            />
            <div className="min-w-0">
              <div className="truncate text-xs font-black uppercase text-[var(--color-brand)]">
                {title || 'BTB Finance'}
              </div>
              <div className="hidden truncate text-sm font-semibold text-[var(--color-copy)] sm:block">
                Passive income / FLIP trading
              </div>
            </div>
          </Link>

          <div className="hidden items-center gap-2 lg:flex">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-md px-3 py-2 text-sm font-bold uppercase text-[var(--color-copy)] transition hover:bg-white/5 hover:text-[var(--color-ink)]"
              >
                {link.label}
              </Link>
            ))}
            <a
              href="https://x.com/btb_finance"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary text-sm"
            >
              Follow
              <ArrowUpRight className="h-4 w-4" />
            </a>
          </div>

          <ConnectKitButton.Custom>
            {({ isConnected, show, truncatedAddress, ensName }) => (
              <button
                onClick={show}
                className={isConnected ? 'btn-secondary text-sm' : 'btn-primary text-sm'}
              >
                {isConnected ? (ensName || truncatedAddress) : 'Connect wallet'}
              </button>
            )}
          </ConnectKitButton.Custom>
        </div>
      </header>

      {wrongNetwork && (
        <div className="sticky top-[5.75rem] z-30 px-4 pt-3 md:px-6">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 rounded-lg border border-[rgba(255,83,112,0.36)] bg-[#241018] px-4 py-3 text-sm text-[#ffd6de]">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="h-4 w-4" />
              <span>Wrong network. BTB Finance runs on Ethereum Mainnet.</span>
            </div>
            <button onClick={() => switchChain({ chainId: mainnet.id })} className="btn-primary text-xs">
              Switch network
            </button>
          </div>
        </div>
      )}
    </>
  )
}
