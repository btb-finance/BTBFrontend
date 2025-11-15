'use client';

import { useState } from 'react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Sparkles, Rocket, Lock, TrendingUp, ExternalLink, ArrowUpRight, Coins, ChevronDown, ChevronUp } from 'lucide-react';

export default function BTBFinanceComingSoon() {
  const [expandedSection, setExpandedSection] = useState<string | null>('deployment');

  const BTB_CONTRACT = '0x888e85C95c84CA41eEf3E4C8C89e8dcE03e41488';
  const TOTAL_SUPPLY = '88,888,888,888';
  const AERODROME_LINK = 'https://aerodrome.finance/swap?from=eth&to=0x888e85c95c84ca41eef3e4c8c89e8dce03e41488&chain0=8453&chain1=8453';
  const BASESCAN_LINK = 'https://basescan.org/token/0x888e85C95c84CA41eEf3E4C8C89e8dcE03e41488';

  const miningSections = [
    {
      id: 'deployment',
      title: '1. Deployment Flow',
      color: 'bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800',
      headerColor: 'bg-blue-600',
      content: (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-900 p-4 rounded border-l-4 border-blue-500">
            <div className="font-bold text-blue-900 dark:text-blue-300">START: Miner Deploys ETH</div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Miner calls deploy(squares[], amountPerSquare)</div>
          </div>

          <div className="flex justify-center">↓</div>

          <div className="bg-yellow-50 dark:bg-yellow-950/20 p-4 rounded border-l-4 border-yellow-500">
            <div className="font-bold text-yellow-900 dark:text-yellow-300">Validation Checks</div>
            <ul className="text-sm text-gray-700 dark:text-gray-300 mt-2 space-y-1">
              <li>✓ Mining period active (5 years)</li>
              <li>✓ Round is active (60 sec window)</li>
              <li>✓ Amount between MIN (0.0000001 ETH) and MAX (10 ETH)</li>
              <li>✓ Squares valid (0-24) and not duplicate</li>
              <li>✓ Not already deployed to these squares</li>
            </ul>
          </div>

          <div className="flex justify-center">↓</div>

          <div className="bg-purple-50 dark:bg-purple-950/20 p-4 rounded border-l-4 border-purple-500">
            <div className="font-bold text-purple-900 dark:text-purple-300">Fee Calculation</div>
            <div className="text-sm text-gray-700 dark:text-gray-300 mt-2">
              <div>Total Cost = amountPerSquare × validSquares</div>
              <div className="mt-1">Admin Fee (10%) = Total × 0.10</div>
              <div className="mt-1 font-semibold">Game Pot (90%) = Total - Admin Fee</div>
            </div>
          </div>

          <div className="flex justify-center">↓</div>

          <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded border-l-4 border-green-500">
            <div className="font-bold text-green-900 dark:text-green-300">Update State</div>
            <ul className="text-sm text-gray-700 dark:text-gray-300 mt-2 space-y-1">
              <li>→ Record miner&apos;s deployment per square</li>
              <li>→ Add to round&apos;s total per square</li>
              <li>→ Increment miner count per square</li>
              <li>→ Collect admin fee (10%)</li>
            </ul>
          </div>

          <div className="flex justify-center">↓</div>

          <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded border-l-4 border-blue-500">
            <div className="font-bold text-blue-900 dark:text-blue-300">END: Emit Deployed Event</div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Miner&apos;s ETH now in game (90% in pot)</div>
          </div>
        </div>
      )
    },
    {
      id: 'finalization',
      title: '2. Round Finalization Flow',
      color: 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800',
      headerColor: 'bg-red-600',
      content: (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-900 p-4 rounded border-l-4 border-red-500">
            <div className="font-bold text-red-900 dark:text-red-300">START: Round Timer Expires</div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">After 60 seconds, anyone can call finalizeRound()</div>
          </div>

          <div className="flex justify-center">↓</div>

          <div className="bg-orange-50 dark:bg-orange-950/20 p-4 rounded border-l-4 border-orange-500">
            <div className="font-bold text-orange-900 dark:text-orange-300">Request Chainlink VRF</div>
            <div className="text-sm text-gray-700 dark:text-gray-300 mt-2">
              <div>→ vrfCoordinator.requestRandomWords()</div>
              <div className="mt-1">→ Store requestId → roundId mapping</div>
              <div className="mt-1">→ Set pendingVRFRequest flag</div>
            </div>
          </div>

          <div className="flex justify-center">↓</div>

          <div className="bg-indigo-50 dark:bg-indigo-950/20 p-4 rounded border-l-4 border-indigo-500">
            <div className="font-bold text-indigo-900 dark:text-indigo-300">VRF Callback: rawFulfillRandomWords()</div>
            <div className="text-sm text-gray-700 dark:text-gray-300 mt-2">
              <div>Chainlink VRF returns provably fair random number</div>
            </div>
          </div>

          <div className="flex justify-center">↓</div>

          <div className="bg-purple-50 dark:bg-purple-950/20 p-4 rounded border-l-4 border-purple-500">
            <div className="font-bold text-purple-900 dark:text-purple-300">Select Winning Square</div>
            <div className="text-sm text-gray-700 dark:text-gray-300 mt-2">
              <div>winningSquare = randomness % 25</div>
              <div className="mt-2 text-xs bg-white dark:bg-gray-800 p-2 rounded">
                Example: Random = 12847 → 12847 % 25 = Square 22
              </div>
            </div>
          </div>

          <div className="flex justify-center">↓</div>

          <div className="bg-yellow-50 dark:bg-yellow-950/20 p-4 rounded border-l-4 border-yellow-500">
            <div className="font-bold text-yellow-900 dark:text-yellow-300">Calculate Pot Distribution</div>
            <div className="text-sm text-gray-700 dark:text-gray-300 mt-2">
              <div>Total Winnings = Sum of all LOSING squares</div>
              <div className="mt-1">BTB Reward = 20,000 BTB fixed per round</div>
            </div>
          </div>

          <div className="flex justify-center">↓</div>

          <div className="bg-pink-50 dark:bg-pink-950/20 p-4 rounded border-l-4 border-pink-500">
            <div className="font-bold text-pink-900 dark:text-pink-300">Check Motherlode Tiers (10 tiers)</div>
            <div className="text-sm text-gray-700 dark:text-gray-300 mt-2 space-y-1">
              <li>Tier 1: Bronze (1/100) - {'>'}10 rounds = 10k BTB</li>
              <li>Tier 2: Silver (1/200) - {'>'}20 rounds = 20k BTB</li>
              <li>Tier 3: Gold (1/300) - {'>'}30 rounds = 30k BTB</li>
              <li>...</li>
              <li>Tier 10: MOTHERLODE (1/1000) - {'>'}100 rounds = 100k BTB!</li>
              <div className="mt-2 text-xs bg-white dark:bg-gray-800 p-2 rounded">
                Each tier uses independent randomness: keccak256(randomness, tierNumber)
              </div>
            </div>
          </div>

          <div className="flex justify-center">↓</div>

          <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded border-l-4 border-green-500">
            <div className="font-bold text-green-900 dark:text-green-300">Finalize Round State</div>
            <ul className="text-sm text-gray-700 dark:text-gray-300 mt-2 space-y-1">
              <li>→ Mark round as finalized</li>
              <li>→ Set isCheckpointable = true</li>
              <li>→ Reset hit motherlode pots to 0</li>
              <li>→ Emit RoundFinalized event</li>
            </ul>
          </div>

          <div className="flex justify-center">↓</div>

          <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded border-l-4 border-blue-500">
            <div className="font-bold text-blue-900 dark:text-blue-300">Start New Round</div>
            <div className="text-sm text-gray-700 dark:text-gray-300 mt-2">
              <div>→ Increment roundId</div>
              <div>→ Add 1,000 BTB to each of 10 motherlode pots</div>
              <div className="font-semibold mt-1">→ Total: +10,000 BTB per round to pots</div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'checkpoint',
      title: '3. Checkpoint & Rewards Flow',
      color: 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800',
      headerColor: 'bg-green-600',
      content: (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-900 p-4 rounded border-l-4 border-green-500">
            <div className="font-bold text-green-900 dark:text-green-300">START: Miner Checkpoints</div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Miner calls checkpoint(roundId) after finalization</div>
          </div>

          <div className="flex justify-center">↓</div>

          <div className="bg-yellow-50 dark:bg-yellow-950/20 p-4 rounded border-l-4 border-yellow-500">
            <div className="font-bold text-yellow-900 dark:text-yellow-300">Check: Did Miner Win?</div>
            <div className="text-sm text-gray-700 dark:text-gray-300 mt-2">
              Did miner deploy to the winning square?
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="text-center font-bold text-green-700 dark:text-green-300">✓ WINNER</div>

              <div className="bg-green-50 dark:bg-green-950/20 p-3 rounded border border-green-300 dark:border-green-700">
                <div className="font-bold text-green-900 dark:text-green-300 text-sm">ETH Rewards</div>
                <div className="text-xs text-gray-700 dark:text-gray-300 mt-1">
                  <div>1. Get original deployment back</div>
                  <div className="mt-1">2. + Proportional share of losers&apos; ETH</div>
                  <div className="mt-2 bg-white dark:bg-gray-800 p-2 rounded">
                    share = (totalWinnings × myDeployment) / totalWinningSquare
                  </div>
                </div>
              </div>

              <div className="bg-green-50 dark:bg-green-950/20 p-3 rounded border border-green-300 dark:border-green-700">
                <div className="font-bold text-green-900 dark:text-green-300 text-sm">BTB Rewards</div>
                <div className="text-xs text-gray-700 dark:text-gray-300 mt-1">
                  <div>1. Base: 20,000 BTB split proportionally</div>
                  <div className="mt-1">2. + Motherlode bonuses (if hit)</div>
                  <div className="mt-2 bg-white dark:bg-gray-800 p-2 rounded">
                    btb = (20k × myDeployment) / totalWinningSquare<br/>
                    + motherlodeShare
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-center font-bold text-red-700 dark:text-red-300">✗ LOSER</div>

              <div className="bg-red-50 dark:bg-red-950/20 p-3 rounded border border-red-300 dark:border-red-700">
                <div className="font-bold text-red-900 dark:text-red-300 text-sm">No ETH Back</div>
                <div className="text-xs text-gray-700 dark:text-gray-300 mt-1">
                  Your ETH was distributed to winners
                </div>
              </div>

              <div className="bg-red-50 dark:bg-red-950/20 p-3 rounded border border-red-300 dark:border-red-700">
                <div className="font-bold text-red-900 dark:text-red-300 text-sm">No BTB Rewards</div>
                <div className="text-xs text-gray-700 dark:text-gray-300 mt-1">
                  Only winning square gets BTB
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-center">↓</div>

          <div className="bg-purple-50 dark:bg-purple-950/20 p-4 rounded border-l-4 border-purple-500">
            <div className="font-bold text-purple-900 dark:text-purple-300">Update Miner Stats</div>
            <ul className="text-sm text-gray-700 dark:text-gray-300 mt-2 space-y-1">
              <li>→ Mark hasCheckpointed = true</li>
              <li>→ Add BTB to unclaimedBTB (not transferred yet)</li>
              <li>→ Update totalUnclaimedBTB globally</li>
            </ul>
          </div>

          <div className="flex justify-center">↓</div>

          <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded border-l-4 border-green-500">
            <div className="font-bold text-green-900 dark:text-green-300">Transfer ETH Immediately</div>
            <div className="text-sm text-gray-700 dark:text-gray-300 mt-2">
              Winners receive their ETH instantly during checkpoint
            </div>
          </div>

          <div className="flex justify-center">↓</div>

          <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded border-l-4 border-blue-500">
            <div className="font-bold text-blue-900 dark:text-blue-300">END: Emit Checkpointed Event</div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">ETH sent, BTB accumulated (claim later)</div>
          </div>
        </div>
      )
    },
    {
      id: 'claiming',
      title: '4. BTB Claiming & Refinement Flow',
      color: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800',
      headerColor: 'bg-yellow-600',
      content: (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-900 p-4 rounded border-l-4 border-yellow-500">
            <div className="font-bold text-yellow-900 dark:text-yellow-300">START: Miner Claims BTB</div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Miner calls claimBTB() to withdraw accumulated BTB</div>
          </div>

          <div className="flex justify-center">↓</div>

          <div className="bg-purple-50 dark:bg-purple-950/20 p-4 rounded border-l-4 border-purple-500">
            <div className="font-bold text-purple-900 dark:text-purple-300">Update Refined BTB</div>
            <div className="text-sm text-gray-700 dark:text-gray-300 mt-2">
              <div>Calculate refined rewards from claim fees:</div>
              <div className="mt-2 bg-white dark:bg-gray-800 p-2 rounded text-xs">
                rewardsDelta = currentRewardsFactor - lastRewardsFactor<br/>
                refinedBTB += (unclaimedBTB × rewardsDelta) / 1e18
              </div>
            </div>
          </div>

          <div className="flex justify-center">↓</div>

          <div className="bg-orange-50 dark:bg-orange-950/20 p-4 rounded border-l-4 border-orange-500">
            <div className="font-bold text-orange-900 dark:text-orange-300">Calculate Claim Fee (10%)</div>
            <div className="text-sm text-gray-700 dark:text-gray-300 mt-2">
              <div>Fee = unclaimedBTB × 10%</div>
              <div className="mt-2 bg-white dark:bg-gray-800 p-2 rounded text-xs">
                Example: Claiming 1,000 BTB<br/>
                Fee = 100 BTB → Goes to other unclaimed miners<br/>
                You get = 900 BTB + refinedBTB
              </div>
            </div>
          </div>

          <div className="flex justify-center">↓</div>

          <div className="bg-pink-50 dark:bg-pink-950/20 p-4 rounded border-l-4 border-pink-500">
            <div className="font-bold text-pink-900 dark:text-pink-300">Distribute Fee to Unclaimed Miners</div>
            <div className="text-sm text-gray-700 dark:text-gray-300 mt-2">
              <div>rewardsPerToken = fee / totalUnclaimedBTB</div>
              <div>rewardsFactor += rewardsPerToken</div>
              <div className="mt-2 text-xs bg-white dark:bg-gray-800 p-2 rounded">
                This increases the &quot;refinedBTB&quot; for everyone who HASN&apos;T claimed yet.<br/>
                Incentivizes HODLing unclaimed BTB to earn from others&apos; claim fees!
              </div>
            </div>
          </div>

          <div className="flex justify-center">↓</div>

          <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded border-l-4 border-green-500">
            <div className="font-bold text-green-900 dark:text-green-300">Update Global State</div>
            <ul className="text-sm text-gray-700 dark:text-gray-300 mt-2 space-y-1">
              <li>→ Reset miner&apos;s unclaimedBTB = 0</li>
              <li>→ Reset miner&apos;s refinedBTB = 0</li>
              <li>→ Update miner&apos;s lastRewardsFactor</li>
              <li>→ Decrease totalUnclaimedBTB</li>
              <li>→ Decrease totalRefinedBTB</li>
            </ul>
          </div>

          <div className="flex justify-center">↓</div>

          <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded border-l-4 border-blue-500">
            <div className="font-bold text-blue-900 dark:text-blue-300">Transfer BTB Tokens</div>
            <div className="text-sm text-gray-700 dark:text-gray-300 mt-2">
              <div className="font-semibold">finalAmount = (unclaimedBTB - fee) + refinedBTB</div>
              <div className="mt-1">→ btbToken.transfer(miner, finalAmount)</div>
            </div>
          </div>

          <div className="flex justify-center">↓</div>

          <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded border-l-4 border-blue-500">
            <div className="font-bold text-blue-900 dark:text-blue-300">END: Emit RewardsClaimed Event</div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">BTB transferred to miner&apos;s wallet</div>
          </div>
        </div>
      )
    },
    {
      id: 'motherlode',
      title: '5. Motherlode System Flow',
      color: 'bg-purple-50 border-purple-200 dark:bg-purple-950/20 dark:border-purple-800',
      headerColor: 'bg-purple-600',
      content: (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-900 p-4 rounded border-l-4 border-purple-500">
            <div className="font-bold text-purple-900 dark:text-purple-300">10 Motherlode Tiers</div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Progressive jackpot system with increasing rarity</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="bg-orange-50 dark:bg-orange-950/20 p-3 rounded border border-orange-300 dark:border-orange-700">
              <div className="font-bold">Tier 1: Bronze Nugget</div>
              <div>1 in 100 chance • ~10k BTB avg</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded border border-gray-300 dark:border-gray-700">
              <div className="font-bold">Tier 2: Silver Nugget</div>
              <div>1 in 200 chance • ~20k BTB avg</div>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-950/20 p-3 rounded border border-yellow-300 dark:border-yellow-700">
              <div className="font-bold">Tier 3: Gold Nugget</div>
              <div>1 in 300 chance • ~30k BTB avg</div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded border border-slate-300 dark:border-slate-700">
              <div className="font-bold">Tier 4: Platinum Nugget</div>
              <div>1 in 400 chance • ~40k BTB avg</div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded border border-blue-300 dark:border-blue-700">
              <div className="font-bold">Tier 5: Diamond Nugget</div>
              <div>1 in 500 chance • ~50k BTB avg</div>
            </div>
            <div className="bg-green-50 dark:bg-green-950/20 p-3 rounded border border-green-300 dark:border-green-700">
              <div className="font-bold">Tier 6: Emerald Vein</div>
              <div>1 in 600 chance • ~60k BTB avg</div>
            </div>
            <div className="bg-red-50 dark:bg-red-950/20 p-3 rounded border border-red-300 dark:border-red-700">
              <div className="font-bold">Tier 7: Ruby Vein</div>
              <div>1 in 700 chance • ~70k BTB avg</div>
            </div>
            <div className="bg-indigo-50 dark:bg-indigo-950/20 p-3 rounded border border-indigo-300 dark:border-indigo-700">
              <div className="font-bold">Tier 8: Sapphire Vein</div>
              <div>1 in 800 chance • ~80k BTB avg</div>
            </div>
            <div className="bg-cyan-50 dark:bg-cyan-950/20 p-3 rounded border border-cyan-300 dark:border-cyan-700">
              <div className="font-bold">Tier 9: Crystal Cache</div>
              <div>1 in 900 chance • ~90k BTB avg</div>
            </div>
            <div className="bg-pink-50 dark:bg-pink-950/20 p-3 rounded border-2 border-pink-400 dark:border-pink-600">
              <div className="font-bold text-pink-700 dark:text-pink-300">Tier 10: MOTHERLODE</div>
              <div className="text-pink-600 dark:text-pink-400">1 in 1000 chance • ~100k+ BTB!</div>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded border-l-4 border-blue-500">
            <div className="font-bold text-blue-900 dark:text-blue-300">Each Round: Pot Growth</div>
            <div className="text-sm text-gray-700 dark:text-gray-300 mt-2">
              <div>→ +1,000 BTB added to EACH tier (10 tiers)</div>
              <div className="font-semibold mt-1">→ Total: +10,000 BTB per round</div>
              <div className="mt-2 text-xs bg-white dark:bg-gray-800 p-2 rounded">
                Combined with 20k base reward = 30k BTB emitted per round
              </div>
            </div>
          </div>

          <div className="bg-yellow-50 dark:bg-yellow-950/20 p-4 rounded border-l-4 border-yellow-500">
            <div className="font-bold text-yellow-900 dark:text-yellow-300">On Round Finalization</div>
            <div className="text-sm text-gray-700 dark:text-gray-300 mt-2">
              <div>For each tier (1-10):</div>
              <div className="mt-2 bg-white dark:bg-gray-800 p-2 rounded text-xs">
                tierRandom = keccak256(VRF_randomness, tierNumber)<br/>
                if (tierRandom % probability == 0) → HIT!
              </div>
              <div className="mt-2">→ If hit: Add pot to totalMotherlodeReward</div>
              <div>→ Reset that tier&apos;s pot to 0</div>
              <div>→ Winners split the bonus BTB proportionally</div>
            </div>
          </div>

          <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded border-l-4 border-green-500">
            <div className="font-bold text-green-900 dark:text-green-300">Distribution to Winners</div>
            <div className="text-sm text-gray-700 dark:text-gray-300 mt-2">
              <div>All hit tier pots → totalMotherlodeReward</div>
              <div className="mt-2 bg-white dark:bg-gray-800 p-2 rounded text-xs">
                yourShare = (totalMotherlodeReward × yourDeployment) / totalWinningSquare
              </div>
              <div className="mt-2 font-semibold">Added on top of 20k base BTB reward!</div>
            </div>
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="container mx-auto px-4 py-8 min-h-screen">
      <div className="max-w-6xl mx-auto w-full">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 mb-6 animate-pulse">
            <Sparkles className="w-10 h-10 text-white" />
          </div>

          <h1 className="text-4xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-purple-600 via-blue-600 to-cyan-600 bg-clip-text text-transparent">
            BTB Token
          </h1>

          <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-400 mb-6">
            Now Live on Base Network
          </p>

          <p className="text-lg text-gray-500 dark:text-gray-500 max-w-2xl mx-auto mb-8">
            Trade BTB on Aerodrome Finance and discover the future of DeFi
          </p>

          {/* Contract and Supply Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto mb-8">
            <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 border-2 border-blue-200 dark:border-blue-800/50">
              <CardContent className="p-6">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Coins className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <h3 className="text-sm font-semibold text-blue-600 dark:text-blue-400 uppercase">Total Supply</h3>
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{TOTAL_SUPPLY}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">BTB Tokens</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 border-2 border-purple-200 dark:border-purple-800/50">
              <CardContent className="p-6">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <ExternalLink className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  <h3 className="text-sm font-semibold text-purple-600 dark:text-purple-400 uppercase">Contract Address</h3>
                </div>
                <p className="text-sm font-mono font-bold text-gray-900 dark:text-gray-100 break-all">{BTB_CONTRACT}</p>
                <a
                  href={BASESCAN_LINK}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-purple-600 dark:text-purple-400 hover:underline mt-1 inline-flex items-center gap-1"
                >
                  View on Basescan <ArrowUpRight className="w-3 h-3" />
                </a>
              </CardContent>
            </Card>
          </div>

          {/* Trade Button */}
          <div className="mb-12">
            <a href={AERODROME_LINK} target="_blank" rel="noopener noreferrer">
              <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-6 text-lg font-bold rounded-xl shadow-lg hover:shadow-xl transition-all">
                <TrendingUp className="w-5 h-5 mr-2" />
                Trade BTB on Aerodrome
                <ExternalLink className="w-5 h-5 ml-2" />
              </Button>
            </a>
          </div>
        </div>

        {/* Feature Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <Card className="border-2 border-purple-200 dark:border-purple-900/50 hover:shadow-xl transition-all">
            <CardContent className="p-6 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 mb-4">
                <Rocket className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Live on Base</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                BTB token is now live and tradable on Base network via Aerodrome Finance
              </p>
            </CardContent>
          </Card>

          <Card className="border-2 border-blue-200 dark:border-blue-900/50 hover:shadow-xl transition-all">
            <CardContent className="p-6 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 mb-4">
                <Lock className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Verified Contract</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Fully verified and transparent smart contract on Basescan
              </p>
            </CardContent>
          </Card>

          <Card className="border-2 border-cyan-200 dark:border-cyan-900/50 hover:shadow-xl transition-all">
            <CardContent className="p-6 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-cyan-100 dark:bg-cyan-900/30 mb-4">
                <TrendingUp className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Growing Ecosystem</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                New use cases and features being developed for the BTB ecosystem
              </p>
            </CardContent>
          </Card>
        </div>

        {/* How to Mine BTB Section */}
        <div className="mb-12">
          <div className="text-center mb-8">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 bg-gradient-to-r from-orange-600 via-yellow-600 to-orange-600 bg-clip-text text-transparent">
              How to Mine BTB
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Interactive guide to the BTB Mining Game mechanics
            </p>
            <div className="mt-6 bg-gradient-to-br from-slate-800 to-slate-900 dark:from-slate-900 dark:to-black p-6 rounded-lg border border-slate-700">
              <div className="text-sm text-slate-300">
                <div className="font-semibold text-white mb-3">Quick Summary:</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-left">
                  <div>🎯 25 squares (5×5 grid) • 60-second rounds</div>
                  <div>💰 Winners split losers&apos; ETH + 20k BTB + motherlode bonuses</div>
                  <div>🎲 Chainlink VRF ensures provably fair randomness</div>
                  <div>💎 10 motherlode tiers accumulate 1k BTB each per round</div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {miningSections.map((section) => (
              <div key={section.id} className={`rounded-lg border-2 ${section.color} overflow-hidden`}>
                <button
                  onClick={() => setExpandedSection(expandedSection === section.id ? null : section.id)}
                  className={`w-full ${section.headerColor} text-white p-4 flex items-center justify-between hover:opacity-90 transition-opacity`}
                >
                  <span className="font-bold text-lg">{section.title}</span>
                  {expandedSection === section.id ? <ChevronUp /> : <ChevronDown />}
                </button>

                {expandedSection === section.id && (
                  <div className="p-6">
                    {section.content}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-8 bg-gradient-to-br from-slate-800 to-slate-900 dark:from-slate-900 dark:to-black p-6 rounded-lg border border-slate-700">
            <h3 className="text-xl font-bold text-white mb-4">Key Concepts</h3>
            <div className="space-y-3 text-sm text-slate-300">
              <div>
                <span className="font-semibold text-white">Admin Fee:</span> 10% of all deployments go to admin, 90% enters the game pot
              </div>
              <div>
                <span className="font-semibold text-white">Claim Fee:</span> 10% of claimed BTB is redistributed to unclaimed miners (refinement)
              </div>
              <div>
                <span className="font-semibold text-white">Refinement:</span> HODLing unclaimed BTB earns you a share of others&apos; claim fees
              </div>
              <div>
                <span className="font-semibold text-white">Emission:</span> 30,000 BTB per round (20k base + 10k to motherlode pots)
              </div>
              <div>
                <span className="font-semibold text-white">Duration:</span> 5-year mining period with ~2.6M rounds total
              </div>
            </div>
          </div>
        </div>

        {/* Status Banner */}
        <Card className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 border-2 border-purple-200 dark:border-purple-800/50">
          <CardContent className="p-8 text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="relative">
                <div className="w-3 h-3 bg-purple-500 rounded-full animate-ping absolute"></div>
                <div className="w-3 h-3 bg-purple-600 rounded-full"></div>
              </div>
              <p className="text-sm font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wide">
                More Use Cases Coming Soon
              </p>
            </div>

            <h2 className="text-2xl font-bold mb-3 text-gray-900 dark:text-gray-100">
              Expanding the BTB Ecosystem
            </h2>

            <p className="text-gray-600 dark:text-gray-400 max-w-xl mx-auto">
              We&apos;re building innovative DeFi features and use cases for BTB token.
              Stay tuned for exciting new utilities and opportunities to maximize your BTB holdings.
            </p>
          </CardContent>
        </Card>

        {/* Footer Note */}
        <div className="text-center mt-12">
          <p className="text-sm text-gray-500 dark:text-gray-600">
            Questions or feedback? Stay connected with our community for updates.
          </p>
        </div>
      </div>
    </div>
  );
}
