'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../components/ui/button';
import { Rocket, Lock, TrendingUp, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { BondingCurveInterface } from './components/BondingCurveInterface';
import { BTBMiningInterface } from './components/BTBMiningInterface';
import GrainOverlay from '../components/home/bolder/GrainOverlay';

export default function BTBFinancePage() {
  const [expandedSection, setExpandedSection] = useState<string | null>('deployment');

  const BTB_CONTRACT = '0x888e85C95c84CA41eEf3E4C8C89e8dcE03e41488';
  const TOTAL_SUPPLY = '88,888,888,888';
  const AERODROME_LINK = 'https://aerodrome.finance/swap?from=eth&to=0x888e85c95c84ca41eef3e4c8c89e8dce03e41488&chain0=8453&chain1=8453';
  const BASESCAN_LINK = 'https://basescan.org/token/0x888e85C95c84CA41eEf3E4C8C89e8dcE03e41488';

  const miningSections = [
    {
      id: 'deployment',
      title: '1. Deployment Flow',
      gradient: 'from-blue-500/20 to-cyan-500/20',
      border: 'border-blue-500/30',
      text: 'text-blue-400',
      content: (
        <div className="space-y-6">
          <div className="bg-black/40 p-6 rounded-xl border-l-2 border-blue-500 backdrop-blur-sm">
            <div className="font-bold text-blue-300 text-lg">START: Miner Deploys ETH</div>
            <div className="text-sm text-gray-400 mt-1 font-mono">Miner calls deploy(squares[], amountPerSquare)</div>
          </div>

          <div className="flex justify-center text-blue-500/50">↓</div>

          <div className="bg-yellow-900/10 p-6 rounded-xl border-l-2 border-yellow-500/50 backdrop-blur-sm">
            <div className="font-bold text-yellow-300">Validation Checks</div>
            <ul className="text-sm text-gray-400 mt-2 space-y-2">
              <li className="flex items-center gap-2"><span className="text-green-500">✓</span> Mining period active (5 years)</li>
              <li className="flex items-center gap-2"><span className="text-green-500">✓</span> Round is active (60 sec window)</li>
              <li className="flex items-center gap-2"><span className="text-green-500">✓</span> Amount between MIN (0.0000001 ETH) and MAX (10 ETH)</li>
              <li className="flex items-center gap-2"><span className="text-green-500">✓</span> Squares valid (0-24) and not duplicate</li>
            </ul>
          </div>

          <div className="flex justify-center text-blue-500/50">↓</div>

          <div className="bg-purple-900/10 p-6 rounded-xl border-l-2 border-purple-500/50 backdrop-blur-sm">
            <div className="font-bold text-purple-300">Fee Calculation</div>
            <div className="text-sm text-gray-400 mt-2 space-y-1 font-mono">
              <div>Total Cost = amountPerSquare × validSquares</div>
              <div className="text-purple-400">Admin Fee (10%) = Total × 0.10</div>
              <div className="text-green-400 font-bold">Game Pot (90%) = Total - Admin Fee</div>
            </div>
          </div>

          <div className="flex justify-center text-blue-500/50">↓</div>

          <div className="bg-blue-900/10 p-6 rounded-xl border-l-2 border-blue-500/50 backdrop-blur-sm">
            <div className="font-bold text-blue-300">END: Emit Deployed Event</div>
            <div className="text-sm text-gray-400 mt-1">Miner&apos;s ETH now in game (90% in pot)</div>
          </div>
        </div>
      )
    },
    {
      id: 'finalization',
      title: '2. Round Finalization Flow',
      gradient: 'from-red-500/20 to-rose-500/20',
      border: 'border-red-500/30',
      text: 'text-red-400',
      content: (
        <div className="space-y-6">
          <div className="bg-black/40 p-6 rounded-xl border-l-2 border-red-500 backdrop-blur-sm">
            <div className="font-bold text-red-300 text-lg">START: Round Timer Expires</div>
            <div className="text-sm text-gray-400 mt-1">After 60 seconds, anyone can call finalizeRound()</div>
          </div>

          <div className="flex justify-center text-red-500/50">↓</div>

          <div className="bg-orange-900/10 p-6 rounded-xl border-l-2 border-orange-500/50 backdrop-blur-sm">
            <div className="font-bold text-orange-300">Request Chainlink VRF</div>
            <div className="text-sm text-gray-400 mt-2 font-mono">
              <div>→ vrfCoordinator.requestRandomWords()</div>
              <div className="mt-1">→ Store requestId → roundId mapping</div>
            </div>
          </div>

          <div className="flex justify-center text-red-500/50">↓</div>

          <div className="bg-purple-900/10 p-6 rounded-xl border-l-2 border-purple-500/50 backdrop-blur-sm">
            <div className="font-bold text-purple-300">Select Winning Square</div>
            <div className="text-sm text-gray-400 mt-2">
              <div className="font-mono text-purple-200">winningSquare = randomness % 25</div>
              <div className="mt-2 text-xs bg-black/50 p-3 rounded border border-white/5">
                Example: Random = 12847 → 12847 % 25 = Square 22
              </div>
            </div>
          </div>

          <div className="flex justify-center text-red-500/50">↓</div>

          <div className="bg-pink-900/10 p-6 rounded-xl border-l-2 border-pink-500/50 backdrop-blur-sm">
            <div className="font-bold text-pink-300">Check Motherlode Tiers (10 tiers)</div>
            <div className="text-sm text-gray-400 mt-2 space-y-2">
              <div className="flex justify-between border-b border-white/5 pb-1"><span>Tier 1: Bronze (1/100)</span> <span className="text-pink-400">10k BTB</span></div>
              <div className="flex justify-between border-b border-white/5 pb-1"><span>Tier 5: Diamond (1/500)</span> <span className="text-pink-400">50k BTB</span></div>
              <div className="flex justify-between font-bold text-pink-300"><span>Tier 10: MOTHERLODE (1/1000)</span> <span>100k BTB!</span></div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'checkpoint',
      title: '3. Checkpoint & Rewards Flow',
      gradient: 'from-emerald-500/20 to-green-500/20',
      border: 'border-emerald-500/30',
      text: 'text-emerald-400',
      content: (
        <div className="space-y-6">
          <div className="bg-black/40 p-6 rounded-xl border-l-2 border-emerald-500 backdrop-blur-sm">
            <div className="font-bold text-emerald-300 text-lg">START: Miner Checkpoints</div>
            <div className="text-sm text-gray-400 mt-1">Miner calls checkpoint(roundId) after finalization</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <div className="space-y-4">
              <div className="text-center font-bold text-emerald-400 tracking-widest">✓ WINNER</div>

              <div className="bg-emerald-900/10 p-4 rounded-xl border border-emerald-500/30 backdrop-blur-sm">
                <div className="font-bold text-emerald-300 text-sm mb-2">ETH Rewards</div>
                <div className="text-xs text-gray-400 space-y-2">
                  <div>1. Get original deployment back</div>
                  <div>2. + Proportional share of losers&apos; ETH</div>
                </div>
              </div>

              <div className="bg-emerald-900/10 p-4 rounded-xl border border-emerald-500/30 backdrop-blur-sm">
                <div className="font-bold text-emerald-300 text-sm mb-2">BTB Rewards</div>
                <div className="text-xs text-gray-400 space-y-2">
                  <div>1. Base: 20,000 BTB split proportionally</div>
                  <div>2. + Motherlode bonuses (if hit)</div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="text-center font-bold text-red-400 tracking-widest">✗ LOSER</div>

              <div className="bg-red-900/10 p-4 rounded-xl border border-red-500/30 backdrop-blur-sm opacity-60">
                <div className="font-bold text-red-300 text-sm mb-2">No ETH Back</div>
                <div className="text-xs text-gray-400">
                  Your ETH was distributed to winners
                </div>
              </div>

              <div className="bg-red-900/10 p-4 rounded-xl border border-red-500/30 backdrop-blur-sm opacity-60">
                <div className="font-bold text-red-300 text-sm mb-2">No BTB Rewards</div>
                <div className="text-xs text-gray-400">
                  Only winning square gets BTB
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'claiming',
      title: '4. BTB Claiming & Refinement Flow',
      gradient: 'from-amber-500/20 to-yellow-500/20',
      border: 'border-amber-500/30',
      text: 'text-amber-400',
      content: (
        <div className="space-y-6">
          <div className="bg-black/40 p-6 rounded-xl border-l-2 border-amber-500 backdrop-blur-sm">
            <div className="font-bold text-amber-300 text-lg">START: Miner Claims BTB</div>
            <div className="text-sm text-gray-400 mt-1">Miner calls claimBTB() to withdraw accumulated BTB</div>
          </div>

          <div className="flex justify-center text-amber-500/50">↓</div>

          <div className="bg-orange-900/10 p-6 rounded-xl border-l-2 border-orange-500/50 backdrop-blur-sm">
            <div className="font-bold text-orange-300">Calculate Claim Fee (10%)</div>
            <div className="text-sm text-gray-400 mt-2">
              <div className="font-mono text-orange-200">Fee = unclaimedBTB × 10%</div>
              <div className="mt-2 text-xs bg-black/50 p-3 rounded border border-white/5">
                Example: Claiming 1,000 BTB<br />
                Fee = 100 BTB → Goes to other unclaimed miners<br />
                You get = 900 BTB + refinedBTB
              </div>
            </div>
          </div>

          <div className="flex justify-center text-amber-500/50">↓</div>

          <div className="bg-pink-900/10 p-6 rounded-xl border-l-2 border-pink-500/50 backdrop-blur-sm">
            <div className="font-bold text-pink-300">Distribute Fee to Unclaimed Miners</div>
            <div className="text-sm text-gray-400 mt-2">
              <div className="text-pink-200">This increases the &quot;refinedBTB&quot; for everyone who HASN&apos;T claimed yet.</div>
              <div className="mt-2 text-xs text-gray-500 italic">
                Incentivizes HODLing unclaimed BTB to earn from others&apos; claim fees!
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'motherlode',
      title: '5. Motherlode System Flow',
      gradient: 'from-purple-500/20 to-fuchsia-500/20',
      border: 'border-purple-500/30',
      text: 'text-purple-400',
      content: (
        <div className="space-y-6">
          <div className="bg-black/40 p-6 rounded-xl border-l-2 border-purple-500 backdrop-blur-sm">
            <div className="font-bold text-purple-300 text-lg">10 Motherlode Tiers</div>
            <div className="text-sm text-gray-400 mt-1">Progressive jackpot system with increasing rarity</div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-[10px] md:text-xs">
            {[
              { name: 'Bronze', chance: '1/100', reward: '10k' },
              { name: 'Silver', chance: '1/200', reward: '20k' },
              { name: 'Gold', chance: '1/300', reward: '30k' },
              { name: 'Platinum', chance: '1/400', reward: '40k' },
              { name: 'Diamond', chance: '1/500', reward: '50k' },
              { name: 'Emerald', chance: '1/600', reward: '60k' },
              { name: 'Ruby', chance: '1/700', reward: '70k' },
              { name: 'Sapphire', chance: '1/800', reward: '80k' },
              { name: 'Crystal', chance: '1/900', reward: '90k' },
              { name: 'MOTHERLODE', chance: '1/1000', reward: '100k+' },
            ].map((tier, i) => (
              <div key={i} className={`p-2 rounded border border-white/10 bg-white/5 ${i === 9 ? 'col-span-2 md:col-span-1 border-pink-500/50 bg-pink-500/10' : ''}`}>
                <div className="font-bold text-white/80">{tier.name}</div>
                <div className="text-white/40">{tier.chance}</div>
                <div className={`font-mono ${i === 9 ? 'text-pink-400 font-bold' : 'text-white/60'}`}>{tier.reward}</div>
              </div>
            ))}
          </div>

          <div className="bg-blue-900/10 p-6 rounded-xl border-l-2 border-blue-500/50 backdrop-blur-sm">
            <div className="font-bold text-blue-300">Each Round: Pot Growth</div>
            <div className="text-sm text-gray-400 mt-2">
              <div>→ +1,000 BTB added to EACH tier (10 tiers)</div>
              <div className="font-bold text-blue-200 mt-1">→ Total: +10,000 BTB per round</div>
            </div>
          </div>
        </div>
      )
    }
  ];

  return (
    <main className="min-h-screen bg-black text-white selection:bg-white selection:text-black overflow-hidden">
      <GrainOverlay />

      <div className="relative z-10 container mx-auto px-4 py-20">

        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-24"
        >
          <h1 className="text-6xl md:text-9xl font-bold tracking-tighter mb-6">
            <span className="text-transparent bg-clip-text bg-gradient-to-b from-white to-white/40" style={{ WebkitTextStroke: '1px rgba(255,255,255,0.1)' }}>
              BTB FINANCE
            </span>
          </h1>
          <p className="text-xl text-gray-400 font-light max-w-2xl mx-auto tracking-wide">
            The engine of the ecosystem. <span className="text-white font-medium">Mine. Win. Refine.</span>
          </p>
        </motion.div>

        {/* Interfaces Section - VERTICAL STACK */}
        <div className="flex flex-col gap-12 mb-24 max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative group"
          >
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
            <div className="relative bg-black/50 backdrop-blur-xl border border-white/10 rounded-2xl p-1 overflow-hidden">
              <BTBMiningInterface />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative group"
          >
            <div className="absolute -inset-1 bg-gradient-to-r from-orange-600 to-red-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
            <div className="relative bg-black/50 backdrop-blur-xl border border-white/10 rounded-2xl p-1 overflow-hidden">
              <BondingCurveInterface />
            </div>
          </motion.div>
        </div>

        {/* Trade CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-32"
        >
          <a href={AERODROME_LINK} target="_blank" rel="noopener noreferrer">
            <Button className="group relative px-10 py-8 bg-transparent overflow-hidden rounded-full">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 opacity-80 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative flex items-center gap-3 text-xl font-bold tracking-wide">
                <TrendingUp className="w-6 h-6" />
                TRADE ON AERODROME
                <ExternalLink className="w-5 h-5 opacity-50 group-hover:opacity-100 transition-opacity" />
              </div>
            </Button>
          </a>
        </motion.div>

        {/* Documentation Section */}
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-yellow-200 to-orange-400">
                Protocol Mechanics
              </span>
            </h2>
            <div className="h-1 w-24 bg-gradient-to-r from-transparent via-white/20 to-transparent mx-auto"></div>
          </motion.div>

          <div className="space-y-6">
            {miningSections.map((section, index) => (
              <motion.div
                key={section.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className={`group relative rounded-2xl border ${section.border} bg-black/20 backdrop-blur-md overflow-hidden transition-all duration-500 ${expandedSection === section.id ? 'bg-black/40 shadow-2xl ring-1 ring-white/10' : 'hover:bg-white/5'}`}
              >
                {/* Active Gradient Background */}
                <div className={`absolute inset-0 bg-gradient-to-br ${section.gradient} opacity-0 transition-opacity duration-500 ${expandedSection === section.id ? 'opacity-10' : 'group-hover:opacity-5'}`} />

                <button
                  onClick={() => setExpandedSection(expandedSection === section.id ? null : section.id)}
                  className="w-full p-6 flex items-center justify-between relative z-10"
                >
                  <span className={`font-bold text-xl tracking-wide transition-colors duration-300 ${expandedSection === section.id ? section.text : 'text-white/70 group-hover:text-white'}`}>
                    {section.title}
                  </span>
                  <div className={`p-2 rounded-full bg-white/5 transition-transform duration-300 ${expandedSection === section.id ? 'rotate-180 bg-white/10' : ''}`}>
                    <ChevronDown className="w-5 h-5 text-white/50" />
                  </div>
                </button>

                <AnimatePresence>
                  {expandedSection === section.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                    >
                      <div className="p-8 pt-0 relative z-10 border-t border-white/5">
                        {section.content}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-32 pb-20">
          <p className="text-white/20 text-sm uppercase tracking-[0.2em]">
            Decentralized • Immutable • Fair
          </p>
        </div>

      </div>
    </main>
  );
}
