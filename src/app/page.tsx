'use client'

import { useAccount } from 'wagmi'
import { Header } from '@/components/Header'
import { CONTRACTS } from '@/lib/contracts'
import { formatToken, formatCompact } from '@/lib/utils'
import { useProtocol } from '@/lib/protocol-context'
import Link from 'next/link'
import Image from 'next/image'
import { Sparkles, Zap, ChevronRight, Wallet, Activity, ExternalLink, Shield, ArrowRightLeft, RefreshCw, Flame, Coins, LineChart } from 'lucide-react'

export default function Home() {
  const { address } = useAccount()
  const {
    btbSupply, btbbStats, nftTotalMinted, nftTotalStaked,
    btbBalance, btbbBalance, nftBalance, nftStakedCount,
  } = useProtocol()

  return (
    <div className="relative z-10 font-sans pb-24 overflow-x-hidden">
      <div className="fixed inset-0 z-[-1] pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-primary/20 blur-[120px] rounded-full mix-blend-screen opacity-70 animate-pulse" />
        <div className="absolute top-1/4 -right-40 w-[30rem] h-[30rem] bg-primary-dark/20 blur-[150px] rounded-full mix-blend-screen opacity-60" />
        <div className="absolute -bottom-40 left-1/4 w-[40rem] h-[30rem] bg-primary/10 blur-[130px] rounded-full mix-blend-screen opacity-80" />
      </div>

      <Header />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-20 pb-16 space-y-24">

        {/* Hero */}
        <section className="flex flex-col items-center text-center">
          <div className="relative mb-10 group">
            <div className="absolute inset-0 bg-primary/40 blur-[50px] rounded-full scale-110 group-hover:scale-150 transition-transform duration-700 ease-out" />
            <div className="absolute inset-0 bg-primary-light/20 blur-[20px] rounded-full animate-pulse" />
            <Image
              src="/images/btb-logo.png"
              alt="BTB Logo"
              width={140}
              height={140}
              className="relative rounded-full ring-[4px] ring-white/10 shadow-[0_0_50px_rgba(239,68,68,0.5)] transform hover:scale-105 transition-transform duration-500 bg-black/50"
            />
          </div>

          <h1 className="text-5xl sm:text-7xl font-black tracking-tighter mb-6 leading-tight">
            The Future of <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-light via-primary to-orange-400 drop-shadow-[0_0_30px_rgba(239,68,68,0.4)]">
              Ethereum DeFi
            </span>
          </h1>

          <p className="text-lg sm:text-2xl text-text-secondary max-w-2xl mx-auto leading-relaxed mb-12 font-medium">
            Mint a Bear NFT. Stake it. Earn 1% of every trade forever. No inflation, no lockups — just permanent passive income from real volume.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-5 w-full sm:w-auto px-4 sm:px-0">
            <Link href="/stake" className="w-full sm:w-auto btn-primary px-10 py-5 rounded-full text-base font-bold shadow-[0_0_40px_rgba(239,68,68,0.4)] hover:shadow-[0_0_60px_rgba(239,68,68,0.6)] transition-all transform hover:-translate-y-1 group flex items-center justify-center gap-2">
              Start Earning <Zap size={18} className="group-hover:scale-125 transition-transform" />
            </Link>
            <a href="#stats" className="w-full sm:w-auto glass px-10 py-5 rounded-full text-base font-bold hover:bg-white/10 transition-colors border border-white/10 flex items-center justify-center drop-shadow-xl backdrop-blur-3xl">
              View Protocol Stats
            </a>
          </div>
        </section>

        {/* Global Protocol Stats */}
        <section id="stats" className="scroll-mt-32">
          <div className="glass rounded-2xl sm:rounded-[2.5rem] p-5 sm:p-14 border border-primary/20 relative overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.5)] bg-card/40 backdrop-blur-2xl">
            <div className="absolute top-0 right-0 w-96 h-96 bg-primary-dark/20 blur-[100px] rounded-full translate-x-1/2 -translate-y-1/2 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary/10 blur-[100px] rounded-full -translate-x-1/2 translate-y-1/2 pointer-events-none" />

            <div className="relative z-10 flex items-center justify-between mb-8 sm:mb-12">
              <h2 className="text-xs sm:text-sm font-black text-white mix-blend-plus-lighter tracking-[0.2em] flex items-center gap-2 sm:gap-3 bg-primary/20 px-3 sm:px-5 py-2 sm:py-2.5 rounded-full border border-primary/30 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
                <Activity size={16} className="text-primary-light shrink-0" /> Live Protocol
              </h2>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-8 lg:gap-12 relative z-10 w-full">
              {[
                { label: 'BTB Supply', value: btbSupply ? formatCompact(btbSupply) : '---', suffix: 'BTB' },
                { label: 'BTBB Circulating', value: btbbStats ? formatCompact(btbbStats[1]) : '---', suffix: 'BTBB' },
                { label: 'NFTs Minted', value: nftTotalMinted !== undefined ? Number(nftTotalMinted).toLocaleString() : '---', suffix: '/ 100K' },
                { label: 'NFTs Staked', value: nftTotalStaked !== undefined ? Number(nftTotalStaked).toLocaleString() : '---', suffix: 'Bears' },
              ].map((stat, i) => (
                <div key={i} className="flex flex-col group border-l-2 border-primary/20 pl-4 sm:pl-6 hover:border-primary transition-colors min-w-0">
                  <span className="text-[10px] sm:text-sm text-text-muted font-bold mb-2 sm:mb-3 uppercase tracking-wider transition-colors truncate">{stat.label}</span>
                  <div className="flex flex-col sm:flex-row items-baseline gap-1 sm:gap-2">
                    <span className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tighter drop-shadow-md truncate max-w-full">{stat.value}</span>
                    <span className="text-primary-light text-[10px] sm:text-sm font-bold tracking-widest shrink-0">{stat.suffix}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Vertical Journey */}
        <section className="relative z-10">
          <div className="max-w-3xl mx-auto relative">
            {/* Connecting line */}
            <div className="absolute left-6 sm:left-8 top-0 bottom-0 w-px bg-gradient-to-b from-orange-500 via-primary to-yellow-500 opacity-30" />

            {[
              { href: '/wrap', title: 'Wrap BTB to BTBB', desc: 'BTBB is the yield-generating version of BTB with a hardcoded 1% tax on every transfer. This tax is what funds your rewards. Wrap at 1:1 — no fees, no slippage.', cta: 'Wrap Now', icon: <ArrowRightLeft size={22} className="text-white" />, color: 'from-orange-500 to-orange-600', glow: 'rgba(249,115,22,0.3)' },
              { href: '/nft', title: 'Mint a Bear NFT', desc: 'Your 0.01 ETH creates permanent, unremovable Uniswap liquidity. Arbitrage bots trade against this liquidity 24/7, generating constant volume. One Bear = your permanent seat at the revenue table.', cta: 'Mint for 0.01 ETH', icon: <Sparkles size={22} className="text-white" />, color: 'from-primary to-primary-dark', glow: 'rgba(239,68,68,0.3)' },
              { href: '/stake', title: 'Stake & Earn Forever', desc: 'Every trade triggers the 1% tax. Every tax payment flows to stakers. The liquidity is permanent so the volume never stops. No lockups, no emissions, no expiry — claim your BTBB rewards anytime.', cta: 'Start Earning', icon: <Zap size={22} className="text-white" />, color: 'from-yellow-500 to-orange-500', glow: 'rgba(234,179,8,0.3)' },
            ].map((item, i) => (
              <Link key={i} href={item.href} className="group relative flex gap-5 sm:gap-8 mb-6 last:mb-0">
                {/* Step dot */}
                <div className="relative z-10 shrink-0">
                  <div className={`w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br ${item.color} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300`} style={{ boxShadow: `0 8px 30px ${item.glow}` }}>
                    {item.icon}
                  </div>
                </div>
                {/* Content */}
                <div className="flex-1 glass p-6 sm:p-8 rounded-2xl sm:rounded-[2rem] border border-white/10 group-hover:border-primary/40 bg-surface/50 backdrop-blur-xl transition-all duration-300 group-hover:bg-white/[0.04] group-hover:shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">{item.title}</h3>
                    <span className="text-xs font-black text-white/10 tracking-widest">0{i + 1}</span>
                  </div>
                  <p className="text-sm sm:text-base text-text-secondary leading-relaxed font-medium mb-5">{item.desc}</p>
                  <span className="inline-flex items-center gap-1.5 text-primary-light text-sm font-bold tracking-wide opacity-70 group-hover:opacity-100 group-hover:translate-x-1 transition-all">
                    {item.cta} <ChevronRight size={16} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Infinite Flywheel Section */}
        <section className="relative z-10 my-32">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] bg-orange-500/10 blur-[150px] rounded-full pointer-events-none" />

          <div className="text-center mb-16 relative z-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-orange-500/30 bg-orange-500/10 text-orange-400 text-sm font-bold tracking-widest uppercase mb-6 shadow-[0_0_20px_rgba(249,115,22,0.2)]">
              <Zap size={16} /> The World&apos;s First
            </div>
            <h2 className="text-4xl sm:text-6xl font-black tracking-tight mb-6 text-white leading-tight">
              The <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-primary drop-shadow-[0_0_20px_rgba(239,68,68,0.3)]">Infinite BTB Flywheel</span><br/> That Pays You Forever
            </h2>
            <p className="text-lg sm:text-2xl text-text-secondary max-w-3xl mx-auto leading-relaxed font-medium">
              Burned liquidity creates permanent trading volume. A 1% tax on every trade flows directly to Bear NFT stakers. No emissions, no dilution — just real revenue from real volume, paid to you forever.
            </p>
          </div>

          <div className="flex flex-col lg:flex-row items-center gap-16 relative z-10 mb-20 bg-black/20 rounded-[3rem] p-8 sm:p-12 border border-white/5 shadow-2xl">

            {/* The Visual Wheel */}
            <div className="w-full lg:w-1/2 flex justify-center items-center py-10">
              <div className="relative w-[300px] h-[300px] sm:w-[400px] sm:h-[400px]">
                <div className="absolute inset-0 bg-gradient-to-tr from-orange-500/20 to-primary/20 rounded-full blur-[60px] animate-pulse" />
                <div className="absolute inset-4 rounded-full border border-dashed border-white/20 animate-[spin_20s_linear_infinite]" />
                <div className="absolute inset-4 rounded-full border-2 border-transparent border-t-orange-400 border-r-primary blur-[2px] animate-[spin_3s_linear_infinite]" />
                <div className="absolute inset-8 rounded-full border border-white/5 bg-black/40 backdrop-blur-md" />

                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20 hidden sm:flex">
                  <div className="w-full h-px bg-gradient-to-r from-transparent via-orange-500 to-transparent" />
                  <div className="absolute h-full w-px bg-gradient-to-b from-transparent via-primary-light to-transparent" />
                </div>

                <div className="absolute inset-0 flex items-center justify-center z-20">
                  <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full bg-gradient-to-br from-orange-500 to-primary flex flex-col items-center justify-center shadow-[0_0_50px_rgba(249,115,22,0.5)] border-4 border-black/50 relative group cursor-default">
                    <div className="absolute inset-0 rounded-full bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <RefreshCw size={36} className="text-white animate-[spin_10s_linear_infinite] drop-shadow-lg mb-2" />
                    <span className="text-[10px] sm:text-xs font-black tracking-widest text-white uppercase text-center px-2 leading-tight">1 Billion<br/>Supply</span>
                  </div>
                </div>

                <div className="absolute top-[22%] left-1/2 -translate-x-1/2 text-orange-400 font-bold text-[10px] tracking-[0.2em] uppercase hidden sm:block drop-shadow-md whitespace-nowrap">Mint & Burn</div>
                <div className="absolute bottom-[22%] left-1/2 -translate-x-1/2 text-primary-light font-bold text-[10px] tracking-[0.2em] uppercase hidden sm:block drop-shadow-md whitespace-nowrap">1% Global Tax</div>
                <div className="absolute top-1/2 left-[20%] -translate-y-1/2 text-yellow-400 font-bold text-[10px] tracking-[0.2em] uppercase hidden sm:block -rotate-90 origin-center drop-shadow-md whitespace-nowrap">Forever Yield</div>
                <div className="absolute top-1/2 right-[20%] -translate-y-1/2 text-white/70 font-bold text-[10px] tracking-[0.2em] uppercase hidden sm:block rotate-90 origin-center drop-shadow-md whitespace-nowrap">Arbitrage</div>

                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 group transition-transform hover:-translate-y-4">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-surface border-2 border-orange-500/50 flex items-center justify-center shadow-xl shadow-orange-500/20 mb-2 mx-auto relative overflow-hidden bg-black/50 backdrop-blur-md">
                    <div className="absolute inset-0 bg-orange-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <Flame size={28} className="text-orange-400" />
                  </div>
                </div>

                <div className="absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2 z-30 group transition-transform hover:translate-x-4">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-surface border-2 border-white/20 hover:border-white/50 flex items-center justify-center shadow-xl mb-2 mx-auto relative overflow-hidden bg-black/50 backdrop-blur-md">
                    <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <LineChart size={28} className="text-white" />
                  </div>
                </div>

                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 z-30 group transition-transform hover:translate-y-4">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-surface border-2 border-primary/50 flex items-center justify-center shadow-xl shadow-primary/20 mb-2 mx-auto relative overflow-hidden bg-black/50 backdrop-blur-md">
                    <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <Activity size={28} className="text-primary-light" />
                  </div>
                </div>

                <div className="absolute top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 z-30 group transition-transform hover:-translate-x-4">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-surface border-2 border-yellow-500/50 flex items-center justify-center shadow-xl shadow-yellow-500/20 mb-2 mx-auto relative overflow-hidden bg-black/50 backdrop-blur-md">
                    <div className="absolute inset-0 bg-yellow-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <Coins size={28} className="text-yellow-400" />
                  </div>
                </div>
              </div>
            </div>

            {/* Explanation Steps */}
            <div className="w-full lg:w-1/2 space-y-8 relative">
               <div className="absolute -left-4 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-white/10 to-transparent hidden lg:block" />
               {[
                 { step: '01', title: 'You Mint a Bear NFT', desc: 'Your 0.01 ETH goes directly into creating permanent Uniswap liquidity for the BTBB token. The LP tokens are burned forever — this liquidity can never be removed by anyone, ever. It sits on-chain generating trading fees indefinitely.', color: 'text-orange-400' },
                 { step: '02', title: 'Bots Trade Non-Stop', desc: 'Because BTBB has deep, permanent liquidity, arbitrage bots constantly trade between BTBB pairs 24/7 to capture price differences. This creates millions in daily volume — not from real users, but from automated bots that will never stop as long as the liquidity exists.', color: 'text-white' },
                 { step: '03', title: 'Every Trade Pays You', desc: 'A hardcoded, immutable 1% tax is built into every single BTBB transfer at the smart contract level. Nobody can change or remove it. Every bot trade, every swap, every transfer — 1% is automatically collected and sent to the staking pool for Bear NFT holders.', color: 'text-primary-light' },
                 { step: '04', title: 'Passive Income Forever', desc: 'Stake your Bear NFT and you receive your share of that 1% tax from every trade, automatically. The liquidity is permanent, so bots keep trading. Bots keep trading, so tax keeps flowing. Tax keeps flowing, so you keep earning. This loop never ends — there is no expiry, no emissions schedule, no unlock date. You earn for as long as you hold.', color: 'text-yellow-400' }
               ].map((item, i) => (
                 <div key={i} className="flex gap-4 group">
                   <div className={`text-xl font-black ${item.color} opacity-50 group-hover:opacity-100 transition-opacity mt-1`}>
                     {item.step}
                   </div>
                   <div>
                     <h4 className="text-xl sm:text-2xl font-black text-white mb-2">{item.title}</h4>
                     <p className="text-text-secondary font-medium leading-relaxed">{item.desc}</p>
                   </div>
                 </div>
               ))}
            </div>
          </div>

          <div className="glass p-8 sm:p-12 rounded-[2.5rem] border border-primary/20 backdrop-blur-2xl relative overflow-hidden bg-black/40">
             <div className="absolute right-0 top-0 w-64 h-full bg-gradient-to-l from-primary/10 to-transparent pointer-events-none" />
             <div className="grid md:grid-cols-3 gap-8 items-center relative z-10">
               <div className="md:col-span-2 space-y-6">
                 <h3 className="text-3xl font-black text-white">No Inflation. No Emissions. Just Real Revenue.</h3>
                 <p className="text-lg text-text-secondary leading-relaxed font-medium">
                   Most DeFi protocols pay yield by printing new tokens — diluting your holdings over time. BTB has a <strong className="text-white">fixed 1 Billion supply that can never increase</strong>. Zero inflation, ever.
                 </p>
                 <p className="text-lg text-text-secondary leading-relaxed font-medium">
                   Every token you earn comes from real trading volume — the 1% tax on actual transactions. As long as the burned liquidity exists (forever), bots trade. As long as bots trade, you earn. One Bear NFT = a permanent seat at the revenue table.
                 </p>
               </div>
               <div className="flex justify-center md:justify-end">
                 <Link href="/nft" className="btn-primary py-5 px-10 rounded-full text-lg font-black tracking-widest shadow-[0_0_40px_rgba(239,68,68,0.3)] hover:shadow-[0_0_60px_rgba(239,68,68,0.5)] transition-all uppercase whitespace-nowrap">
                   Mint a Bear Now
                 </Link>
               </div>
             </div>
          </div>
        </section>

        {/* User Portfolio */}
        {address && (
          <section className="relative z-10">
            <div className="relative glass p-5 sm:p-14 rounded-2xl sm:rounded-[2.5rem] border border-primary/30 backdrop-blur-3xl overflow-hidden bg-surface/60 shadow-[0_0_80px_rgba(0,0,0,0.6)]">
              <div className="absolute top-[-50%] left-[-10%] w-[80%] h-[150%] bg-primary/10 blur-[100px] pointer-events-none transform -rotate-12" />

              <h2 className="text-2xl sm:text-3xl font-black mb-6 sm:mb-10 flex items-center gap-4 tracking-tight text-white drop-shadow-md">
                <Wallet className="text-primary h-8 w-8" /> Portfolio Snapshot
              </h2>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-8 relative z-10">
                {[
                  { label: 'BTB', value: btbBalance !== undefined ? formatCompact(btbBalance) : '---' },
                  { label: 'BTBB', value: btbbBalance !== undefined ? formatCompact(btbbBalance) : '---' },
                  { label: 'NFTs Owned', value: nftBalance !== undefined ? nftBalance.toString() : '---' },
                  { label: 'NFTs Staked', value: nftStakedCount !== undefined ? nftStakedCount.toString() : '---', highlight: nftStakedCount !== undefined && nftStakedCount > 0n },
                ].map((item, i) => (
                  <div key={i} className="bg-black/60 rounded-2xl sm:rounded-[2rem] p-4 sm:p-8 border border-white/5 backdrop-blur-md hover:bg-black/80 transition-colors shadow-inner min-w-0">
                    <div className="text-[10px] sm:text-sm text-text-muted mb-2 sm:mb-3 font-bold uppercase tracking-wider sm:tracking-widest truncate">{item.label}</div>
                    <div className={`text-xl sm:text-4xl font-black tracking-tighter truncate ${item.highlight ? 'text-transparent bg-clip-text bg-gradient-to-r from-primary-light to-primary' : 'text-white'}`}>
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

      </main>

      {/* Footer */}
      <footer className="pt-10 pb-8 border-t border-white/10 mt-12 relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4 opacity-70 hover:opacity-100 transition-opacity cursor-default">
            <Image src="/images/btb-logo.png" alt="BTB Logo" width={36} height={36} className="rounded-full grayscale" />
            <div className="flex flex-col">
              <span className="text-sm font-black tracking-[0.2em] text-white">BTB FINANCE</span>
              <span className="text-[9px] text-primary-light font-bold tracking-[0.3em]">ETHEREUM MAINNET</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {[
              { href: 'https://t.me/BTBFinance', label: 'Telegram', icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg> },
              { href: 'https://discord.gg/bqFEPA56Tc', label: 'Discord', icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M20.317 4.3698a19.7913 19.7913 0 0 0-4.8851-1.5152.0741.0741 0 0 0-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 0 0-.0785-.037 19.7363 19.7363 0 0 0-4.8852 1.515.0699.0699 0 0 0-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 0 0 .0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 0 0 .0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 0 0-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 0 1-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 0 1 .0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 0 1 .0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 0 1-.0066.1276 12.2986 12.2986 0 0 1-1.873.8914.0766.0766 0 0 0-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 0 0 .0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 0 0 .0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 0 0-.0312-.0286z"/></svg> },
              { href: 'https://x.com/btb_finance', label: 'X', icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg> },
            ].map((s) => (
              <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-text-muted hover:text-white hover:border-primary/50 hover:bg-primary/10 transition-all" aria-label={s.label}>
                {s.icon}
              </a>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-x-8 gap-y-2">
          {[
            { name: 'BTB', address: CONTRACTS.BTB },
            { name: 'BTBB', address: CONTRACTS.BTBB },
            { name: 'NFT', address: CONTRACTS.BEAR_NFT },
            { name: 'Staking', address: CONTRACTS.BEAR_STAKING },
          ].map((c) => (
            <a key={c.address} href={`https://etherscan.io/address/${c.address}`} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-2 text-xs text-white/40 hover:text-white transition-colors">
              <span className="font-bold text-text-muted group-hover:text-primary-light">{c.name}</span>
              <span className="font-mono">{c.address.slice(0, 6)}...{c.address.slice(-4)}</span>
              <ExternalLink size={10} className="opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
            </a>
          ))}
        </div>
      </footer>
    </div>
  )
}
