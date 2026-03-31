'use client'

import { useAccount } from 'wagmi'
import { Header } from '@/components/Header'
import { CONTRACTS } from '@/lib/contracts'
import { formatCompact } from '@/lib/utils'
import { useProtocol } from '@/lib/protocol-context'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowUpRight, Zap, Wallet, ExternalLink, Clock, Skull, Eye, Target } from 'lucide-react'
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
          <div className="max-w-2xl space-y-8">
            <h1 className="text-[2.25rem] sm:text-5xl lg:text-[3.25rem] font-semibold tracking-tight text-white leading-[1.08]">
              Zero inflation. Built for{' '}
              <span className="italic text-primary-light">passive income</span>.
            </h1>

            <p className="text-base sm:text-lg text-text-secondary leading-relaxed">
              BTB has a fixed billion supply — no minting, no emissions, no inflation. Revenue comes from a 1% transfer tax that flows directly to staked NFTs. Wrap, mint, stake — and earn passively from real volume.
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
        </section>

        {/* Metrics — dense terminal strip */}
        <section id="metrics" className="scroll-mt-28 mb-16 sm:mb-24">
          <div className="rounded-xl border border-white/[0.08] bg-black/40 backdrop-blur-md overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 border-b border-white/[0.06] bg-white/[0.02]">
              <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-text-secondary">
                <Zap className="h-3.5 w-3.5 text-primary-light" aria-hidden />
                Live on Ethereum
              </div>
              <span className="text-[10px] font-mono text-emerald-400/90">● mainnet</span>
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

        {/* ═══════════════════════════════════════════════════════════════
            CAT STRATEGY — COMING SOON
        ═══════════════════════════════════════════════════════════════ */}
        <section className="mb-16 sm:mb-24">
          <div className="rounded-xl border border-amber-500/20 bg-gradient-to-b from-amber-500/[0.06] to-transparent overflow-hidden">
            {/* Header bar */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 border-b border-amber-500/10 bg-amber-500/[0.04]">
              <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-amber-400/80">
                <Target className="h-3.5 w-3.5 text-amber-400" aria-hidden />
                Strategy 04 — Cat NFT
              </div>
              <span className="flex items-center gap-1.5 text-[10px] font-mono text-amber-400/70">
                <Clock className="h-3 w-3" aria-hidden />
                coming soon · not live yet
              </span>
            </div>

            {/* Main content */}
            <div className="p-6 sm:p-10 lg:p-12">
              <div className="grid lg:grid-cols-2 gap-10 lg:gap-14">
                {/* Left — overview */}
                <div className="space-y-6">
                  <h2 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight leading-snug">
                    Every Cat hunts{' '}
                    <span className="italic text-amber-400">dormant BTB</span>.
                  </h2>
                  <p className="text-sm sm:text-base text-text-secondary leading-relaxed">
                    Revenue from the Uniswap pool tax flows as BTB into the Cat contract. Bots arbitrage — buy Cat NFTs cheap on OpenSea, flip them to
                    the contract for a profit. The contract re-lists at cost + 10%. Every sale splits the full price across all active Cats.
                  </p>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    Each Cat NFT accumulates BTB on-chain. Claim whenever you want — but if you sleep for 100 days, anyone can call{' '}
                    <code className="text-amber-400 font-mono text-xs bg-amber-400/10 px-1.5 py-0.5 rounded">dead()</code> and take your entire balance.
                    Dead Cats stop earning until the owner wakes them up at zero.
                  </p>

                  {/* Three incentive layers */}
                  <div className="space-y-4 pt-2">
                    <h3 className="text-xs font-mono uppercase tracking-widest text-text-muted">Incentive layers</h3>
                    {[
                      {
                        icon: <Eye className="h-4 w-4 text-emerald-400" />,
                        title: 'Hold & Claim',
                        desc: 'Claim regularly or lose everything. Keeps the community engaged.',
                        accent: 'border-emerald-400/30 bg-emerald-400/[0.06]',
                      },
                      {
                        icon: <Skull className="h-4 w-4 text-amber-400" />,
                        title: 'Bounty Hunt',
                        desc: 'Scan the chain for dormant Cats. Call dead() and pocket all their BTB.',
                        accent: 'border-amber-400/30 bg-amber-400/[0.06]',
                      },
                      {
                        icon: <Target className="h-4 w-4 text-primary-light" />,
                        title: 'Ecosystem Concentration',
                        desc: 'Dead Cats get excluded from splits. Active holders earn a bigger share.',
                        accent: 'border-primary/30 bg-primary/[0.06]',
                      },
                    ].map((layer) => (
                      <div
                        key={layer.title}
                        className={`flex items-start gap-3 rounded-lg border ${layer.accent} px-4 py-3`}
                      >
                        <div className="mt-0.5 shrink-0">{layer.icon}</div>
                        <div>
                          <p className="text-sm font-semibold text-white">{layer.title}</p>
                          <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">{layer.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right — lifecycle diagram */}
                <div className="space-y-6">
                  <h3 className="text-xs font-mono uppercase tracking-widest text-text-muted">Cat lifecycle</h3>

                  {/* Flow diagram */}
                  <div className="relative rounded-xl border border-white/[0.08] bg-black/40 p-6 space-y-5">
                    {/* Phase 1 */}
                    <div>
                      <p className="text-[10px] font-mono uppercase tracking-wider text-amber-400/70 mb-2">Phase 1 · Funding</p>
                      <div className="flex items-center gap-2 text-sm text-text-secondary">
                        <span className="inline-flex items-center gap-1 rounded bg-white/[0.06] px-2 py-1 text-xs font-mono text-white">
                          Uniswap Tax
                        </span>
                        <ArrowUpRight className="h-3 w-3 text-amber-400/60 shrink-0" />
                        <span className="inline-flex items-center gap-1 rounded bg-amber-400/10 px-2 py-1 text-xs font-mono text-amber-400">
                          BTB → Contract
                        </span>
                      </div>
                    </div>

                    <div className="h-px bg-white/[0.06]" />

                    {/* Phase 2 */}
                    <div>
                      <p className="text-[10px] font-mono uppercase tracking-wider text-amber-400/70 mb-2">Phase 2 · Arbitrage</p>
                      <div className="flex items-center gap-2 flex-wrap text-sm text-text-secondary">
                        <span className="inline-flex items-center gap-1 rounded bg-white/[0.06] px-2 py-1 text-xs font-mono text-white">
                          Bot buys Cat
                        </span>
                        <span className="text-[10px] text-text-muted">80 BTB</span>
                        <ArrowUpRight className="h-3 w-3 text-amber-400/60 shrink-0" />
                        <span className="inline-flex items-center gap-1 rounded bg-white/[0.06] px-2 py-1 text-xs font-mono text-white">
                          Sells to Contract
                        </span>
                        <span className="text-[10px] text-text-muted">100 BTB</span>
                      </div>
                      <p className="text-[10px] text-text-muted mt-1.5">+20 BTB profit for bot · Contract now owns the Cat NFT</p>
                    </div>

                    <div className="h-px bg-white/[0.06]" />

                    {/* Phase 3 */}
                    <div>
                      <p className="text-[10px] font-mono uppercase tracking-wider text-amber-400/70 mb-2">Phase 3 · Re-list & Split</p>
                      <div className="flex items-center gap-2 flex-wrap text-sm text-text-secondary">
                        <span className="inline-flex items-center gap-1 rounded bg-white/[0.06] px-2 py-1 text-xs font-mono text-white">
                          Re-listed
                        </span>
                        <span className="text-[10px] text-text-muted">cost + 10% = 110 BTB</span>
                        <ArrowUpRight className="h-3 w-3 text-amber-400/60 shrink-0" />
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-400/10 px-2 py-1 text-xs font-mono text-emerald-400">
                          110 BTB Split
                        </span>
                      </div>
                      <p className="text-[10px] text-text-muted mt-1.5">Full sale price ÷ all active Cats = each Cat's BTB balance grows</p>
                    </div>

                    <div className="h-px bg-white/[0.06]" />

                    {/* Phase 4 — Dead/Wakeup */}
                    <div>
                      <p className="text-[10px] font-mono uppercase tracking-wider text-primary-light/70 mb-2">Phase 4 · Dead / Wakeup</p>
                      <div className="space-y-3">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 h-6 w-6 rounded-full border border-amber-400/40 flex items-center justify-center shrink-0">
                            <Clock className="h-3 w-3 text-amber-400" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-white">100 days pass, no claim</p>
                            <p className="text-[10px] text-text-muted">NFT is now eligible to be called dead</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 h-6 w-6 rounded-full border border-primary/40 flex items-center justify-center shrink-0">
                            <Skull className="h-3 w-3 text-primary-light" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-white">
                              <code className="text-primary-light font-mono bg-primary/10 px-1 rounded">dead()</code> — bounty hunter claims all BTB
                            </p>
                            <p className="text-[10px] text-text-muted">NFT excluded from future splits · stops earning</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 h-6 w-6 rounded-full border border-emerald-400/40 flex items-center justify-center shrink-0">
                            <Eye className="h-3 w-3 text-emerald-400" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-white">
                              <code className="text-emerald-400 font-mono bg-emerald-400/10 px-1 rounded">wakeup()</code> — owner reactivates
                            </p>
                            <p className="text-[10px] text-text-muted">NFT starts earning again, but at zero balance — they missed out</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Quick summary */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Max Supply', value: '10,000', sub: 'CAT NFTs' },
                      { label: 'Dead Timer', value: '100', sub: 'days' },
                      { label: 'Relist Fee', value: '+10%', sub: 'on cost' },
                    ].map((s) => (
                      <div key={s.label} className="rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2.5 text-center">
                        <p className="text-[10px] font-mono uppercase tracking-wider text-text-muted">{s.label}</p>
                        <p className="text-lg font-semibold text-white tabular-nums mt-0.5">{s.value}</p>
                        <p className="text-[10px] font-mono text-amber-400/70">{s.sub}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
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
