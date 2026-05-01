'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useAccount } from 'wagmi'
import { ArrowRight, BadgeDollarSign, CandlestickChart, Coins, Gem, Repeat2, Trophy } from 'lucide-react'
import { Header } from '@/components/Header'
import { formatCompact } from '@/lib/utils'
import { useProtocol } from '@/lib/protocol-context'

const actions = [
  {
    href: '/stake',
    icon: BadgeDollarSign,
    label: 'Passive income',
    title: 'Stake Bears',
    text: 'Bear NFTs earn BTBB from the 1% BTBB transfer tax. Stake, wait, claim.',
    accent: 'text-[var(--color-brand)]',
  },
  {
    href: '/flip',
    icon: CandlestickChart,
    label: 'Day trade',
    title: 'Trade FLIP',
    text: 'Watch FLIP on the DEX. Buy the drop, sell the move back up, repeat.',
    accent: 'text-[var(--color-plum)]',
  },
  {
    href: '/wrap',
    icon: Repeat2,
    label: 'Wrapper',
    title: 'BTB to BTBB',
    text: 'Mint BTBB 1:1 with BTB. BTBB transfers create the staking reward flow.',
    accent: 'text-[var(--color-gold)]',
  },
  {
    href: '/nft',
    icon: Gem,
    label: 'Access',
    title: 'Mint Bears',
    text: 'Bear NFTs cost 0.01 ETH each and are the entry ticket for passive rewards.',
    accent: 'text-[var(--color-berry)]',
  },
]

export default function Home() {
  const { address } = useAccount()
  const {
    btbSupply,
    btbbStats,
    nftTotalMinted,
    nftTotalStaked,
    btbBalance,
    btbbBalance,
    nftBalance,
    nftStakedCount,
    pendingRewards,
    stakingStats,
  } = useProtocol()

  const netRewards = pendingRewards ? pendingRewards[1] : 0n
  const dailyPerBear = stakingStats && stakingStats[0] > 0n ? stakingStats[3] / stakingStats[0] : 0n

  return (
    <div className="page-shell">
      <Header />

      <main className="page-frame">
        <section className="grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="surface-panel surface-panel-strong overflow-hidden">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="eyebrow">
                  <Trophy className="h-4 w-4" />
                  BTB mainnet app
                </div>
                <h1 className="display-title mt-4">
                  Earn passive. Trade active.
                </h1>
              </div>
              <Image
                src="/images/btb-logo.png"
                alt="BTB"
                width={58}
                height={58}
                className="rounded-lg border border-[var(--color-line)]"
                priority
              />
            </div>

            <p className="lead-copy mt-4">
              BTB has two clear user paths. Passive users mint and stake Bear NFTs for BTBB rewards. Active users watch
              FLIP on the DEX, buy price drops, and sell recoveries.
            </p>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <Link href="/stake" className="btn-primary">
                Stake
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/flip" className="btn-secondary">
                Trade FLIP
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="metric-tile">
              <div className="metric-label">BTB supply</div>
              <div className="metric-value">{btbSupply ? formatCompact(btbSupply) : '-'}</div>
            </div>
            <div className="metric-tile">
              <div className="metric-label">BTBB wrapped</div>
              <div className="metric-value">{btbbStats ? formatCompact(btbbStats[1]) : '-'}</div>
            </div>
            <div className="metric-tile">
              <div className="metric-label">Bears minted</div>
              <div className="metric-value">{nftTotalMinted !== undefined ? Number(nftTotalMinted).toLocaleString() : '-'}</div>
            </div>
            <div className="metric-tile">
              <div className="metric-label">Bears staked</div>
              <div className="metric-value">{nftTotalStaked !== undefined ? Number(nftTotalStaked).toLocaleString() : '-'}</div>
            </div>
          </div>
        </section>

        {address && (
          <section className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
            <div className="metric-tile">
              <div className="metric-label">Your BTB</div>
              <div className="metric-value">{btbBalance !== undefined ? formatCompact(btbBalance) : '-'}</div>
            </div>
            <div className="metric-tile">
              <div className="metric-label">Your BTBB</div>
              <div className="metric-value">{btbbBalance !== undefined ? formatCompact(btbbBalance) : '-'}</div>
            </div>
            <div className="metric-tile">
              <div className="metric-label">Bears held</div>
              <div className="metric-value">{nftBalance !== undefined ? nftBalance.toString() : '-'}</div>
            </div>
            <div className="metric-tile">
              <div className="metric-label">Pending net</div>
              <div className="metric-value">{formatCompact(netRewards)}</div>
            </div>
          </section>
        )}

        <section className="mt-3 grid gap-2 lg:grid-cols-4">
          {actions.map((action) => (
            <Link key={action.href} href={action.href} className="editorial-card">
              <div className="flex h-full flex-col justify-between gap-5">
                <div>
                  <div className={`mb-4 inline-flex rounded-md border border-[var(--color-line)] bg-[#090909] p-2 ${action.accent}`}>
                    <action.icon className="h-5 w-5" />
                  </div>
                  <div className="metric-label">{action.label}</div>
                  <h2 className="mt-1 text-2xl font-black uppercase leading-none">{action.title}</h2>
                  <p className="mt-3 text-sm leading-6 text-[var(--color-copy)]">{action.text}</p>
                </div>
                <div className="flex items-center justify-between border-t border-[var(--color-line)] pt-3 text-xs font-black uppercase text-[var(--color-brand)]">
                  Open
                  <ArrowRight className="h-4 w-4" />
                </div>
              </div>
            </Link>
          ))}
        </section>

        <section className="mt-3 grid gap-2 lg:grid-cols-3">
          <div className="surface-panel">
            <div className="eyebrow">
              <Coins className="h-4 w-4" />
              BTBB tax flow
            </div>
            <p className="mt-3 text-sm leading-6 text-[var(--color-copy)]">
              BTBB transfers take 1%. The staking contract pulls those fees and splits them across staked Bears.
            </p>
          </div>
          <div className="surface-panel">
            <div className="eyebrow">FLIP math</div>
            <p className="mt-3 text-sm leading-6 text-[var(--color-copy)]">
              FLIP mints and redeems against USDC with a 10% tax. Traders use the DEX price movement around that system.
            </p>
          </div>
          <div className="surface-panel">
            <div className="eyebrow">Yield signal</div>
            <p className="mt-3 text-sm leading-6 text-[var(--color-copy)]">
              Current estimated daily rewards per staked Bear: <span className="font-black text-[var(--color-ink)]">{formatCompact(dailyPerBear)} BTBB</span>.
            </p>
          </div>
        </section>
      </main>
    </div>
  )
}
