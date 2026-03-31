'use client'

import { ConnectKitButton } from 'connectkit'
import Image from 'next/image'
import Link from 'next/link'
import { useAccount, useSwitchChain } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { AlertTriangle } from 'lucide-react'

export function Header({ title }: { title?: string }) {
  const { isConnected, chainId } = useAccount()
  const { switchChain } = useSwitchChain()
  const wrongNetwork = isConnected && chainId !== mainnet.id

  return (
    <>
      <header className="sticky top-0 z-40 bg-bg/80 backdrop-blur-xl border-b border-border/50">
        <div className="flex items-center justify-between px-4 h-16 max-w-6xl mx-auto">
          <Link href="/" className="flex items-center gap-3">
            <div className="relative">
              <Image src="/images/btb-logo.png" alt="BTB" width={34} height={34} className="rounded-full shadow-md" />
              <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-bg ${wrongNetwork ? 'bg-red-500' : 'bg-success'}`} />
            </div>
            <div>
              <span className="font-semibold text-sm tracking-tight">{title || 'BTB Finance'}</span>
              <span className="block text-[10px] text-text-muted font-medium tracking-wider">ETHEREUM</span>
            </div>
          </Link>
          <ConnectKitButton.Custom>
            {({ isConnected, show, truncatedAddress, ensName }) => (
              <button
                onClick={show}
                className={`text-xs font-semibold px-4 py-2 rounded-full transition-all duration-200 active:scale-95 ${
                  isConnected
                    ? 'glass border border-border-light text-text'
                    : 'btn-primary'
                }`}
              >
                {isConnected ? (ensName || truncatedAddress) : 'Connect'}
              </button>
            )}
          </ConnectKitButton.Custom>
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-border-light to-transparent" />
      </header>

      {wrongNetwork && (
        <div className="sticky top-16 z-30 bg-red-500/90 backdrop-blur-md text-white text-center py-3 px-4 flex items-center justify-center gap-3">
          <AlertTriangle size={16} />
          <span className="text-sm font-bold">Wrong network detected. BTB Finance runs on Ethereum Mainnet.</span>
          <button
            onClick={() => switchChain({ chainId: mainnet.id })}
            className="text-sm font-black bg-white text-red-600 px-4 py-1 rounded-full hover:bg-white/90 transition-colors"
          >
            Switch to Ethereum
          </button>
        </div>
      )}
    </>
  )
}
