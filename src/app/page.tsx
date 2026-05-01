'use client'

import Link from 'next/link'
import { useAccount } from 'wagmi'
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  CandlestickChart,
  Coins,
  Flame,
  ShieldCheck,
  Target,
  TriangleAlert,
} from 'lucide-react'
import { Header } from '@/components/Header'
import { CONTRACTS } from '@/lib/contracts'
import { formatCompact } from '@/lib/utils'
import { useProtocol } from '@/lib/protocol-context'

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
  const annualPerBear = dailyPerBear * 365n

  return (
    <div className="page-shell">
      <Header />

      <main className="page-frame">
        {/* HERO — single column, no duplicate logo */}
        <section className="hero-panel surface-panel-strong overflow-hidden">
          <div className="eyebrow">
            <TriangleAlert className="h-4 w-4" />
            Most DeFi loses you money
          </div>
          <h1 className="display-title mt-4">
            BTB pays you{' '}
            <span className="text-[var(--color-brand)]">forever</span>{' '}
            from real on-chain volume.
          </h1>
          <p className="lead-copy mt-4 max-w-3xl">
            Impermanent loss. Rug pulls. Token unlocks. Inflation. The reasons people get wrecked in DeFi are not a
            mystery — and BTB removes them, one by one.
          </p>

          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            <div className="metric-tile">
              <div className="metric-label">Liquidity</div>
              <div className="text-base font-black uppercase text-[var(--color-leaf)]">Burned</div>
              <p className="mt-2 text-xs leading-5 text-[var(--color-copy)]">
                LP tokens burned on-chain. No multisig drain, no migration switch.
              </p>
            </div>
            <div className="metric-tile">
              <div className="metric-label">Control</div>
              <div className="text-base font-black uppercase text-[var(--color-leaf)]">Nobody</div>
              <p className="mt-2 text-xs leading-5 text-[var(--color-copy)]">
                No admin, no mint function, no upgrade path. The contract is final.
              </p>
            </div>
            <div className="metric-tile">
              <div className="metric-label">Supply</div>
              <div className="text-base font-black uppercase text-[var(--color-leaf)]">1B fixed</div>
              <p className="mt-2 text-xs leading-5 text-[var(--color-copy)]">
                One mint at genesis. Zero inflation, zero unlocks, zero dilution.
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2 sm:max-w-md">
            <Link href="/stake" className="btn-primary">
              Start earning
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="#flow" className="btn-secondary">
              See the flow
            </a>
          </div>
        </section>

        {/* LIVE NUMBERS — proof it's running */}
        <section className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
          <div className="metric-tile">
            <div className="metric-label">BTB supply</div>
            <div className="metric-value">{btbSupply ? formatCompact(btbSupply) : '-'}</div>
            <div className="mt-2 text-[0.65rem] font-bold uppercase text-[var(--color-leaf)]">Capped, no inflation</div>
          </div>
          <div className="metric-tile">
            <div className="metric-label">BTBB wrapped</div>
            <div className="metric-value">{btbbStats ? formatCompact(btbbStats[1]) : '-'}</div>
            <div className="mt-2 text-[0.65rem] font-bold uppercase text-[var(--color-muted)]">Fee-bearing token</div>
          </div>
          <div className="metric-tile">
            <div className="metric-label">Bears staked</div>
            <div className="metric-value">{nftTotalStaked !== undefined ? Number(nftTotalStaked).toLocaleString() : '-'}</div>
            <div className="mt-2 text-[0.65rem] font-bold uppercase text-[var(--color-muted)]">Earning right now</div>
          </div>
          <div className="metric-tile">
            <div className="metric-label">Per bear / day</div>
            <div className="metric-value text-[var(--color-leaf)]">{formatCompact(dailyPerBear)}</div>
            <div className="mt-2 text-[0.65rem] font-bold uppercase text-[var(--color-muted)]">
              ~{formatCompact(annualPerBear)} BTBB / yr
            </div>
          </div>
        </section>

        {/* THE MONEY FLOW — text diagram */}
        <section id="flow" className="surface-panel mt-3 scroll-mt-24">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="eyebrow">
                <Flame className="h-4 w-4" />
                Where your income comes from
              </div>
              <h2 className="section-title mt-4">The money flow, in plain sight.</h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-[var(--color-copy)]">
              Every line below happens on-chain, in this exact order, every time anyone moves BTBB. The contract is the
              entire mechanism — there are no off-chain hands.
            </p>
          </div>

          <div className="mt-5 grid gap-2 lg:grid-cols-[1fr_auto_1fr_auto_1fr]">
            <div className="metric-tile">
              <div className="metric-label">Step 01 — Trader</div>
              <div className="mt-2 text-base font-black uppercase leading-tight text-[var(--color-ink)]">
                Anyone swaps BTBB on Uniswap
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--color-copy)]">
                Could be an arb bot, a holder rebalancing, a router routing — every transfer hits the contract.
              </p>
            </div>
            <div className="hidden items-center justify-center text-[var(--color-brand)] lg:flex">
              <ArrowRight className="h-5 w-5" />
            </div>
            <div className="flex items-center justify-center text-[var(--color-brand)] lg:hidden">
              <ArrowDown className="h-5 w-5" />
            </div>

            <div className="metric-tile">
              <div className="metric-label">Step 02 — Contract</div>
              <div className="mt-2 text-base font-black uppercase leading-tight text-[var(--color-ink)]">
                Skims 1% transfer tax
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--color-copy)]">
                The BTBB contract holds the tax in its own balance. No human signs anything, no off-chain processor.
              </p>
            </div>
            <div className="hidden items-center justify-center text-[var(--color-brand)] lg:flex">
              <ArrowRight className="h-5 w-5" />
            </div>
            <div className="flex items-center justify-center text-[var(--color-brand)] lg:hidden">
              <ArrowDown className="h-5 w-5" />
            </div>

            <div className="metric-tile">
              <div className="metric-label">Step 03 — You</div>
              <div className="mt-2 text-base font-black uppercase leading-tight text-[var(--color-leaf)]">
                Staking pool pulls it · split per Bear
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--color-copy)]">
                Every staked Bear receives an equal share of the new tax. Claim whenever — as BTBB or auto-unwrap to BTB.
              </p>
            </div>
          </div>
        </section>

        {/* CONCRETE EXAMPLES — passive vs active with real numbers */}
        <section className="mt-3 grid gap-2 lg:grid-cols-2">
          {/* Passive example */}
          <div className="editorial-card">
            <div className="eyebrow">
              <Target className="h-4 w-4" />
              Passive path · worked example
            </div>
            <h3 className="mt-4 text-2xl font-black uppercase leading-tight">
              Mint 1 Bear. Stake it. Walk away.
            </h3>

            <div className="mt-5 space-y-3 rounded-md border border-[var(--color-line)] bg-[#0d0d0d] p-4 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[var(--color-muted)]">Cost in</span>
                <span className="font-mono font-black text-[var(--color-ink)]">0.01 ETH (~one Bear)</span>
              </div>
              <div className="h-px bg-[var(--color-line)]" />
              <div className="flex items-center justify-between gap-3">
                <span className="text-[var(--color-muted)]">Pool right now</span>
                <span className="font-mono font-black text-[var(--color-ink)]">
                  {nftTotalStaked !== undefined ? Number(nftTotalStaked).toLocaleString() : '—'} bears
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[var(--color-muted)]">Your share / day</span>
                <span className="font-mono font-black text-[var(--color-leaf)]">
                  ~{formatCompact(dailyPerBear)} BTBB
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[var(--color-muted)]">Your share / year</span>
                <span className="font-mono font-black text-[var(--color-leaf)]">
                  ~{formatCompact(annualPerBear)} BTBB
                </span>
              </div>
              <div className="h-px bg-[var(--color-line)]" />
              <div className="flex items-center justify-between gap-3">
                <span className="text-[var(--color-muted)]">Lockup / penalty</span>
                <span className="font-mono font-black text-[var(--color-leaf)]">none · ever</span>
              </div>
            </div>

            <p className="mt-3 text-xs leading-5 text-[var(--color-muted)]">
              Numbers update from the live contract. Daily rate moves with protocol volume — when more people trade,
              your stake earns more.
            </p>

            <Link href="/stake" className="btn-primary mt-4 w-full">
              Open staking
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Active example */}
          <div className="editorial-card">
            <div className="eyebrow">
              <CandlestickChart className="h-4 w-4" />
              Active path · worked example
            </div>
            <h3 className="mt-4 text-2xl font-black uppercase leading-tight">
              Buy FLIP at $0.92. Sell at $1.05.
            </h3>

            <div className="mt-5 space-y-3 rounded-md border border-[var(--color-line)] bg-[#0d0d0d] p-4 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[var(--color-muted)]">Limit buy fills at</span>
                <span className="font-mono font-black text-[var(--color-ink)]">$0.92 (DEX)</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[var(--color-muted)]">Sell into the swing at</span>
                <span className="font-mono font-black text-[var(--color-ink)]">$1.05 (DEX)</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[var(--color-muted)]">Round-trip profit</span>
                <span className="font-mono font-black text-[var(--color-leaf)]">~+14%</span>
              </div>
              <div className="h-px bg-[var(--color-line)]" />
              <div className="flex items-center justify-between gap-3">
                <span className="text-[var(--color-muted)]">If price never recovers</span>
                <span className="font-mono font-black text-[var(--color-ink)]">redeem at $0.90 floor</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[var(--color-muted)]">Worst-case loss</span>
                <span className="font-mono font-black text-[var(--color-berry)]">~−2.2% (vs −90% on a normal alt)</span>
              </div>
            </div>

            <p className="mt-3 text-xs leading-5 text-[var(--color-muted)]">
              FLIP can't go to zero — the contract redeems for $0.90 USDC no matter what. Catch 5 swings a month and
              you're at 25–50% monthly compounded.
            </p>

            <Link href="/flip" className="btn-primary mt-4 w-full">
              Open FLIP trader
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        {/* THE 5 TOKENS — what each piece does */}
        <section className="surface-panel mt-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="eyebrow">
                <Coins className="h-4 w-4" />
                Five pieces, one engine
              </div>
              <h2 className="section-title mt-4">What each token actually does.</h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-[var(--color-copy)]">
              No marketing fluff. Each token has a job. Each job feeds the same staker pool.
            </p>
          </div>

          <div className="mt-5 grid gap-2 lg:grid-cols-5">
            {[
              {
                tag: 'BTB',
                role: 'The base asset',
                text: '1B fixed supply. No mint, no admin. Everything else is denominated against it.',
                href: '/wrap',
              },
              {
                tag: 'BTBB',
                role: 'The reward engine',
                text: 'Wrapped 1:1 with a 1% transfer tax. Every move pays the staking pool.',
                href: '/wrap',
                hot: true,
              },
              {
                tag: 'BEAR',
                role: 'The access ticket',
                text: 'NFT capped at 100k. One Bear = one share of the staking pool. Mint price feeds BTBB LP.',
                href: '/nft',
                hot: true,
              },
              {
                tag: 'OPOS',
                role: 'The expansion engine',
                text: '1 BTB → 1M OPOS. Its 1% tax funds new LP pairs against other coins. More pairs = more volume.',
                href: '/opos',
              },
              {
                tag: 'FLIP',
                role: 'The trader\'s edge',
                text: 'USDC-backed stablecoin. $0.90 redeem floor, $1.10 mint ceiling. Buy the swing, can\'t be rugged.',
                href: '/flip',
              },
            ].map((t) => (
              <Link key={t.tag} href={t.href} className="metric-tile flex flex-col gap-3 transition hover:border-[var(--color-brand)]">
                <span className="kicker-number !w-auto !px-2">{t.tag}</span>
                <h3 className={`text-base font-black uppercase leading-tight ${t.hot ? 'text-[var(--color-leaf)]' : 'text-[var(--color-ink)]'}`}>
                  {t.role}
                </h3>
                <p className="text-sm leading-6 text-[var(--color-copy)]">{t.text}</p>
                <div className="mt-auto flex items-center gap-1 text-xs font-black uppercase text-[var(--color-brand)]">
                  Open <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* CONNECTED WALLET STATS */}
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
              <div className="metric-label">Bears held / staked</div>
              <div className="metric-value">
                {nftBalance !== undefined ? nftBalance.toString() : '-'}
                <span className="text-[var(--color-muted)]"> / </span>
                <span className="text-[var(--color-brand)]">{nftStakedCount !== undefined ? nftStakedCount.toString() : '-'}</span>
              </div>
            </div>
            <div className="metric-tile">
              <div className="metric-label">Pending BTBB (net)</div>
              <div className="metric-value">{formatCompact(netRewards)}</div>
            </div>
          </section>
        )}

        {/* CONTRACTS — proof on-chain */}
        <section className="surface-panel mt-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="eyebrow">
                <ShieldCheck className="h-4 w-4" />
                Verify on-chain
              </div>
              <h2 className="section-title mt-4">Contracts beat marketing copy.</h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-[var(--color-copy)]">
              All addresses verified on Etherscan. Read the source. Confirm the rules. Then decide.
            </p>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { name: 'BTB', address: CONTRACTS.BTB },
              { name: 'BTBB', address: CONTRACTS.BTBB },
              { name: 'Bear NFT', address: CONTRACTS.BEAR_NFT },
              { name: 'Bear Staking', address: CONTRACTS.BEAR_STAKING },
              { name: 'OPOS', address: CONTRACTS.OPOS },
              { name: 'FLIP', address: CONTRACTS.FLIP },
            ].map((c) => (
              <a
                key={c.address}
                href={`https://etherscan.io/address/${c.address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="metric-tile flex items-center justify-between gap-3 transition hover:border-[var(--color-brand)]"
              >
                <div className="min-w-0">
                  <div className="metric-label">{c.name}</div>
                  <div className="mt-1 truncate font-mono text-sm text-[var(--color-copy)]">
                    {c.address.slice(0, 8)}…{c.address.slice(-6)}
                  </div>
                </div>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-[var(--color-muted)]" />
              </a>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
