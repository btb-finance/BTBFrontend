'use client'

import { useAccount } from 'wagmi'
import { Header } from '@/components/Header'
import { CONTRACTS } from '@/lib/contracts'
import { formatCompact } from '@/lib/utils'
import { useProtocol } from '@/lib/protocol-context'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowUpRight, Zap, Activity, Wallet, ExternalLink } from 'lucide-react'
import { IconDiscord, IconTelegram, IconX } from '@/components/BrandIcons'

const SOCIALS = [
  {
    href: 'https://t.me/BTBFinance',
    label: 'Telegram',
    icon: IconTelegram,
    hover:
      'hover:border-[#229ED9]/40 hover:bg-[#229ED9]/12 hover:text-[#229ED9] focus-visible:ring-[#229ED9]/40',
  },
  {
    href: 'https://discord.gg/bqFEPA56Tc',
    label: 'Discord',
    icon: IconDiscord,
    hover:
      'hover:border-[#5865F2]/40 hover:bg-[#5865F2]/12 hover:text-[#a5b4fc] focus-visible:ring-[#5865F2]/40',
  },
  {
    href: 'https://x.com/btb_finance',
    label: 'X',
    icon: IconX,
    hover: 'hover:border-white/25 hover:bg-white/10 hover:text-white focus-visible:ring-white/30',
  },
] as const

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
  } = useProtocol()

  const metrics = [
    { k: 'BTB supply', v: btbSupply ? formatCompact(btbSupply) : '—', u: 'BTB' },
    { k: 'BTBB circulating', v: btbbStats ? formatCompact(btbbStats[1]) : '—', u: 'BTBB' },
    { k: 'Bears minted', v: nftTotalMinted !== undefined ? Number(nftTotalMinted).toLocaleString() : '—', u: '/ 100K' },
    { k: 'Bears staked', v: nftTotalStaked !== undefined ? Number(nftTotalStaked).toLocaleString() : '—', u: 'NFTs' },
  ]

  const routes = [
    {
      href: '/wrap',
      tag: '01',
      title: 'Wrap',
      line: 'BTB in, BTBB out. 1:1.',
      detail: 'The wrapped token carries the transfer tax that feeds stakers.',
    },
    {
      href: '/nft',
      tag: '02',
      title: 'Mint',
      line: '0.01 ETH Bear.',
      detail: 'Liquidity is seeded and LP is burned so depth stays on-chain.',
    },
    {
      href: '/stake',
      tag: '03',
      title: 'Stake',
      line: 'Lock the Bear, take the tax.',
      detail: 'Claim BTBB from the global pot. No forced unlock clock.',
    },
  ] as const

  return (
    <div className="relative z-10 min-h-dvh font-sans pb-28 overflow-x-hidden text-text">
      {/* New background stack: base + perspective grid + washes + scan hint */}
      <div className="fixed inset-0 -z-30 bg-[#030308]" aria-hidden />
      <div
        className="fixed inset-0 -z-20 opacity-[0.4] [mask-image:linear-gradient(to_bottom,black_40%,transparent)]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
        }}
        aria-hidden
      />
      <div
        className="fixed inset-0 -z-20 opacity-30"
        style={{
          backgroundImage:
            'linear-gradient(115deg, transparent 40%, rgba(239,68,68,0.07) 50%, transparent 60%)',
        }}
        aria-hidden
      />
      <div
        className="fixed -top-1/3 left-1/2 -translate-x-1/2 w-[140%] max-w-[1100px] aspect-square rounded-full -z-20 pointer-events-none opacity-90"
        style={{
          background: 'radial-gradient(circle at 50% 40%, rgba(239,68,68,0.14) 0%, transparent 55%)',
        }}
        aria-hidden
      />
      <div
        className="fixed bottom-0 right-0 w-[80vw] h-[50vh] -z-20 pointer-events-none opacity-70"
        style={{
          background: 'radial-gradient(ellipse at 100% 100%, rgba(251,191,36,0.08) 0%, transparent 60%)',
        }}
        aria-hidden
      />
      <div className="fixed inset-x-0 top-0 h-px z-0 bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" aria-hidden />

      <Header />

      <main className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 pb-16">
        {/* Hero — split panel, not centered glow orb */}
        <section className="relative mb-16 sm:mb-24">
          <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-12 lg:gap-8 items-center">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] font-mono uppercase tracking-[0.2em] text-text-secondary">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
                Mainnet · BTBB tax route
              </div>

              <h1 className="text-[2.25rem] sm:text-5xl lg:text-[3.25rem] font-semibold tracking-tight text-white leading-[1.08]">
                Revenue that traces{' '}
                <span className="italic text-primary-light">real transfers</span>, not new mints.
              </h1>

              <p className="max-w-xl text-base sm:text-lg text-text-secondary leading-relaxed">
                Bears gate a share of a fixed 1% BTBB transfer tax. Wrap, mint, stake — three screens, one loop. Supply stays capped; the pitch is
                volume, not inflation.
              </p>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/stake"
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-white shadow-[0_0_0_1px_rgba(0,0,0,0.2)] hover:bg-primary-dark transition-colors"
                >
                  Start staking
                  <Zap className="h-4 w-4 opacity-90" aria-hidden />
                </Link>
                <a
                  href="#metrics"
                  className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-white hover:bg-white/[0.06] transition-colors"
                >
                  View metrics
                  <ArrowUpRight className="h-4 w-4 opacity-80" aria-hidden />
                </a>
              </div>
            </div>

            <div className="relative flex justify-center lg:justify-end">
              <div className="relative w-full max-w-[320px] aspect-square">
                <div className="absolute inset-8 rounded-full border border-dashed border-white/15 animate-[spin_48s_linear_infinite]" aria-hidden />
                <div className="absolute inset-14 rounded-full border border-white/10" aria-hidden />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative h-36 w-36 sm:h-44 sm:w-44">
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/25 to-amber-500/10 blur-2xl" aria-hidden />
                    <Image
                      src="/images/btb-logo.png"
                      alt="BTB"
                      width={176}
                      height={176}
                      className="relative h-full w-full rounded-2xl object-cover ring-1 ring-white/10"
                    />
                  </div>
                </div>
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md border border-white/10 bg-black/60 px-3 py-1.5 text-[10px] font-mono uppercase tracking-widest text-text-secondary backdrop-blur-md">
                  1% · transfer · tax
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Metrics — dense terminal strip */}
        <section id="metrics" className="scroll-mt-28 mb-16 sm:mb-24">
          <div className="rounded-xl border border-white/[0.08] bg-black/40 backdrop-blur-md overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 border-b border-white/[0.06] bg-white/[0.02]">
              <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-text-secondary">
                <Activity className="h-3.5 w-3.5 text-primary-light" aria-hidden />
                Chain snapshot
              </div>
              <span className="text-[10px] font-mono text-emerald-400/90">● live</span>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 divide-y divide-white/[0.06] lg:divide-y-0 lg:divide-x">
              {metrics.map((m) => (
                <div key={m.k} className="p-4 sm:p-5 hover:bg-white/[0.02] transition-colors">
                  <p className="text-[10px] font-mono uppercase tracking-wider text-text-muted mb-2">{m.k}</p>
                  <p className="text-2xl sm:text-3xl font-semibold text-white tabular-nums tracking-tight">{m.v}</p>
                  <p className="text-[11px] font-mono text-primary-light/80 mt-1">{m.u}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pipeline — horizontal cards, new idea vs vertical timeline / flywheel */}
        <section className="mb-16 sm:mb-24">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
            <div>
              <h2 className="text-sm font-mono uppercase tracking-[0.25em] text-text-muted">Route</h2>
              <p className="mt-2 text-2xl sm:text-3xl font-semibold text-white tracking-tight">Pick a station</p>
            </div>
            <p className="max-w-md text-sm text-text-secondary leading-relaxed">
              Same story as always, stripped to three doors. Each card jumps to the tool you need next.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {routes.map((r) => (
              <Link
                key={r.href}
                href={r.href}
                className="group relative flex flex-col rounded-xl border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-transparent p-5 sm:p-6 hover:border-primary/35 hover:from-primary/10 transition-all duration-300"
              >
                <span className="font-mono text-[10px] text-text-muted mb-4">{r.tag}</span>
                <span className="text-lg font-semibold text-white mb-1">{r.title}</span>
                <span className="text-sm font-medium text-primary-light/90 mb-3">{r.line}</span>
                <p className="text-sm text-text-secondary leading-relaxed flex-1">{r.detail}</p>
                <span className="mt-6 inline-flex items-center gap-1 text-xs font-semibold text-white opacity-80 group-hover:opacity-100">
                  Open
                  <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* Principle block — replaces flywheel diagram */}
        <section className="mb-16 sm:mb-24 rounded-xl border border-white/[0.08] overflow-hidden">
          <div className="grid lg:grid-cols-2">
            <div className="p-6 sm:p-10 lg:p-12 border-b lg:border-b-0 lg:border-r border-white/[0.08] bg-[#07070f]/80">
              <h2 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight leading-snug">
                Liquidity stays. Tax ticks. You stake.
              </h2>
              <p className="mt-4 text-sm sm:text-base text-text-secondary leading-relaxed">
                Mint fees deepen BTBB pools; burned LP is the commitment that depth does not get yoinked by a multisig exit. Bots and routers keep
                moving size; every qualifying transfer pays into the same pot your Bear accesses when staked.
              </p>
              <p className="mt-4 text-sm text-text-muted leading-relaxed">
                Not financial advice. Contracts on Etherscan win any argument with marketing copy.
              </p>
            </div>
            <div className="p-6 sm:p-10 lg:p-12 flex flex-col justify-center gap-6 bg-black/30">
              {[
                { t: 'Capped BTB', d: 'Fixed billion supply — emissions are not the paycheck.' },
                { t: 'On-chain tax', d: '1% is enforced by BTBB logic, not a front-end fee toggle.' },
                { t: 'Bear = slot', d: 'Stake to route your share of the tax stream.' },
              ].map((x) => (
                <div key={x.t} className="flex gap-4">
                  <div className="mt-1 h-8 w-px shrink-0 bg-gradient-to-b from-primary to-amber-400 opacity-80" aria-hidden />
                  <div>
                    <p className="text-sm font-semibold text-white">{x.t}</p>
                    <p className="text-sm text-text-secondary mt-1 leading-relaxed">{x.d}</p>
                  </div>
                </div>
              ))}
              <Link
                href="/nft"
                className="mt-2 inline-flex w-fit items-center gap-2 rounded-md bg-white text-black px-4 py-2.5 text-sm font-semibold hover:bg-white/90 transition-colors"
              >
                Mint a Bear
                <ArrowUpRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </div>
        </section>

        {address && (
          <section className="mb-16">
            <div className="rounded-xl border border-primary/30 bg-primary/[0.06] p-5 sm:p-8">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-white mb-1">
                <Wallet className="h-5 w-5 text-primary-light" aria-hidden />
                Connected wallet
              </h2>
              <p className="text-sm text-text-secondary mb-6">Balances for the active address in this session.</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'BTB', value: btbBalance !== undefined ? formatCompact(btbBalance) : '—', hot: false },
                  { label: 'BTBB', value: btbbBalance !== undefined ? formatCompact(btbbBalance) : '—', hot: false },
                  { label: 'Bears', value: nftBalance !== undefined ? nftBalance.toString() : '—', hot: false },
                  {
                    label: 'Staked',
                    value: nftStakedCount !== undefined ? nftStakedCount.toString() : '—',
                    hot: nftStakedCount !== undefined && nftStakedCount > 0n,
                  },
                ].map((row) => (
                  <div key={row.label} className="rounded-lg border border-white/10 bg-black/40 px-4 py-3">
                    <p className="text-[10px] font-mono uppercase tracking-wider text-text-muted">{row.label}</p>
                    <p
                      className={`text-xl font-semibold tabular-nums mt-1 truncate ${
                        row.hot ? 'text-primary-light' : 'text-white'
                      }`}
                    >
                      {row.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      <footer className="relative z-10 border-t border-white/[0.08] bg-black/40 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col gap-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div className="flex items-center gap-3">
              <Image src="/images/btb-logo.png" alt="BTB" width={36} height={36} className="rounded-lg ring-1 ring-white/10" />
              <div>
                <p className="text-sm font-semibold text-white">BTB Finance</p>
                <p className="text-[11px] font-mono text-text-muted mt-0.5">ETH MAINNET</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {SOCIALS.map((s) => {
                const Icon = s.icon
                return (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-text-muted transition-all duration-200 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0 ${s.hover}`}
                    aria-label={s.label}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                  </a>
                )
              })}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-2 text-xs font-mono">
            {[
              { name: 'BTB', address: CONTRACTS.BTB },
              { name: 'BTBB', address: CONTRACTS.BTBB },
              { name: 'NFT', address: CONTRACTS.BEAR_NFT },
              { name: 'Staking', address: CONTRACTS.BEAR_STAKING },
            ].map((c) => (
              <a
                key={c.address}
                href={`https://etherscan.io/address/${c.address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-transparent px-2 py-2 hover:border-white/10 hover:bg-white/[0.03] text-text-secondary hover:text-white transition-colors"
              >
                <span className="text-primary-light font-semibold">{c.name}</span>
                <span className="truncate">
                  {c.address.slice(0, 8)}…{c.address.slice(-6)}
                </span>
                <ExternalLink className="h-3 w-3 opacity-50 group-hover:opacity-100 shrink-0" aria-hidden />
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  )
}
