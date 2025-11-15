import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

const BTBMiningFlowCharts = () => {
  const [expandedSection, setExpandedSection] = useState<string | null>('deployment');

  const sections = [
    {
      id: 'deployment',
      title: '1. Deployment Flow',
      color: 'bg-blue-50 border-blue-200',
      headerColor: 'bg-blue-600',
      content: (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded border-l-4 border-blue-500">
            <div className="font-bold text-blue-900">START: Miner Deploys ETH</div>
            <div className="text-sm text-gray-600 mt-1">Miner calls deploy(squares[], amountPerSquare)</div>
          </div>
          
          <div className="flex justify-center">↓</div>
          
          <div className="bg-yellow-50 p-4 rounded border-l-4 border-yellow-500">
            <div className="font-bold text-yellow-900">Validation Checks</div>
            <ul className="text-sm text-gray-700 mt-2 space-y-1">
              <li>✓ Mining period active (5 years)</li>
              <li>✓ Round is active (60 sec window)</li>
              <li>✓ Amount between MIN (0.0000001 ETH) and MAX (10 ETH)</li>
              <li>✓ Squares valid (0-24) and not duplicate</li>
              <li>✓ Not already deployed to these squares</li>
            </ul>
          </div>
          
          <div className="flex justify-center">↓</div>
          
          <div className="bg-purple-50 p-4 rounded border-l-4 border-purple-500">
            <div className="font-bold text-purple-900">Fee Calculation</div>
            <div className="text-sm text-gray-700 mt-2">
              <div>Total Cost = amountPerSquare × validSquares</div>
              <div className="mt-1">Admin Fee (10%) = Total × 0.10</div>
              <div className="mt-1 font-semibold">Game Pot (90%) = Total - Admin Fee</div>
            </div>
          </div>
          
          <div className="flex justify-center">↓</div>
          
          <div className="bg-green-50 p-4 rounded border-l-4 border-green-500">
            <div className="font-bold text-green-900">Update State</div>
            <ul className="text-sm text-gray-700 mt-2 space-y-1">
              <li>→ Record miner's deployment per square</li>
              <li>→ Add to round's total per square</li>
              <li>→ Increment miner count per square</li>
              <li>→ Collect admin fee (10%)</li>
            </ul>
          </div>
          
          <div className="flex justify-center">↓</div>
          
          <div className="bg-blue-50 p-4 rounded border-l-4 border-blue-500">
            <div className="font-bold text-blue-900">END: Emit Deployed Event</div>
            <div className="text-sm text-gray-600 mt-1">Miner's ETH now in game (90% in pot)</div>
          </div>
        </div>
      )
    },
    {
      id: 'finalization',
      title: '2. Round Finalization Flow',
      color: 'bg-red-50 border-red-200',
      headerColor: 'bg-red-600',
      content: (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded border-l-4 border-red-500">
            <div className="font-bold text-red-900">START: Round Timer Expires</div>
            <div className="text-sm text-gray-600 mt-1">After 60 seconds, anyone can call finalizeRound()</div>
          </div>
          
          <div className="flex justify-center">↓</div>
          
          <div className="bg-orange-50 p-4 rounded border-l-4 border-orange-500">
            <div className="font-bold text-orange-900">Request Chainlink VRF</div>
            <div className="text-sm text-gray-700 mt-2">
              <div>→ vrfCoordinator.requestRandomWords()</div>
              <div className="mt-1">→ Store requestId → roundId mapping</div>
              <div className="mt-1">→ Set pendingVRFRequest flag</div>
            </div>
          </div>
          
          <div className="flex justify-center">↓</div>
          
          <div className="bg-indigo-50 p-4 rounded border-l-4 border-indigo-500">
            <div className="font-bold text-indigo-900">VRF Callback: rawFulfillRandomWords()</div>
            <div className="text-sm text-gray-700 mt-2">
              <div>Chainlink VRF returns provably fair random number</div>
            </div>
          </div>
          
          <div className="flex justify-center">↓</div>
          
          <div className="bg-purple-50 p-4 rounded border-l-4 border-purple-500">
            <div className="font-bold text-purple-900">Select Winning Square</div>
            <div className="text-sm text-gray-700 mt-2">
              <div>winningSquare = randomness % 25</div>
              <div className="mt-2 text-xs bg-white p-2 rounded">
                Example: Random = 12847 → 12847 % 25 = Square 22
              </div>
            </div>
          </div>
          
          <div className="flex justify-center">↓</div>
          
          <div className="bg-yellow-50 p-4 rounded border-l-4 border-yellow-500">
            <div className="font-bold text-yellow-900">Calculate Pot Distribution</div>
            <div className="text-sm text-gray-700 mt-2">
              <div>Total Winnings = Sum of all LOSING squares</div>
              <div className="mt-1">BTB Reward = 20,000 BTB fixed per round</div>
            </div>
          </div>
          
          <div className="flex justify-center">↓</div>
          
          <div className="bg-pink-50 p-4 rounded border-l-4 border-pink-500">
            <div className="font-bold text-pink-900">Check Motherlode Tiers (10 tiers)</div>
            <div className="text-sm text-gray-700 mt-2 space-y-1">
              <li>Tier 1: Bronze (1/100) - {'>'}10 rounds = 10k BTB</li>
              <li>Tier 2: Silver (1/200) - {'>'}20 rounds = 20k BTB</li>
              <li>Tier 3: Gold (1/300) - {'>'}30 rounds = 30k BTB</li>
              <li>...</li>
              <li>Tier 10: MOTHERLODE (1/1000) - {'>'}100 rounds = 100k BTB!</li>
              <div className="mt-2 text-xs bg-white p-2 rounded">
                Each tier uses independent randomness: keccak256(randomness, tierNumber)
              </div>
            </div>
          </div>
          
          <div className="flex justify-center">↓</div>
          
          <div className="bg-green-50 p-4 rounded border-l-4 border-green-500">
            <div className="font-bold text-green-900">Finalize Round State</div>
            <ul className="text-sm text-gray-700 mt-2 space-y-1">
              <li>→ Mark round as finalized</li>
              <li>→ Set isCheckpointable = true</li>
              <li>→ Reset hit motherlode pots to 0</li>
              <li>→ Emit RoundFinalized event</li>
            </ul>
          </div>
          
          <div className="flex justify-center">↓</div>
          
          <div className="bg-blue-50 p-4 rounded border-l-4 border-blue-500">
            <div className="font-bold text-blue-900">Start New Round</div>
            <div className="text-sm text-gray-700 mt-2">
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
      color: 'bg-green-50 border-green-200',
      headerColor: 'bg-green-600',
      content: (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded border-l-4 border-green-500">
            <div className="font-bold text-green-900">START: Miner Checkpoints</div>
            <div className="text-sm text-gray-600 mt-1">Miner calls checkpoint(roundId) after finalization</div>
          </div>
          
          <div className="flex justify-center">↓</div>
          
          <div className="bg-yellow-50 p-4 rounded border-l-4 border-yellow-500">
            <div className="font-bold text-yellow-900">Check: Did Miner Win?</div>
            <div className="text-sm text-gray-700 mt-2">
              Did miner deploy to the winning square?
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="text-center font-bold text-green-700">✓ WINNER</div>
              
              <div className="bg-green-50 p-3 rounded border border-green-300">
                <div className="font-bold text-green-900 text-sm">ETH Rewards</div>
                <div className="text-xs text-gray-700 mt-1">
                  <div>1. Get original deployment back</div>
                  <div className="mt-1">2. + Proportional share of losers' ETH</div>
                  <div className="mt-2 bg-white p-2 rounded">
                    share = (totalWinnings × myDeployment) / totalWinningSquare
                  </div>
                </div>
              </div>
              
              <div className="bg-green-50 p-3 rounded border border-green-300">
                <div className="font-bold text-green-900 text-sm">BTB Rewards</div>
                <div className="text-xs text-gray-700 mt-1">
                  <div>1. Base: 20,000 BTB split proportionally</div>
                  <div className="mt-1">2. + Motherlode bonuses (if hit)</div>
                  <div className="mt-2 bg-white p-2 rounded">
                    btb = (20k × myDeployment) / totalWinningSquare<br/>
                    + motherlodeShare
                  </div>
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="text-center font-bold text-red-700">✗ LOSER</div>
              
              <div className="bg-red-50 p-3 rounded border border-red-300">
                <div className="font-bold text-red-900 text-sm">No ETH Back</div>
                <div className="text-xs text-gray-700 mt-1">
                  Your ETH was distributed to winners
                </div>
              </div>
              
              <div className="bg-red-50 p-3 rounded border border-red-300">
                <div className="font-bold text-red-900 text-sm">No BTB Rewards</div>
                <div className="text-xs text-gray-700 mt-1">
                  Only winning square gets BTB
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex justify-center">↓</div>
          
          <div className="bg-purple-50 p-4 rounded border-l-4 border-purple-500">
            <div className="font-bold text-purple-900">Update Miner Stats</div>
            <ul className="text-sm text-gray-700 mt-2 space-y-1">
              <li>→ Mark hasCheckpointed = true</li>
              <li>→ Add BTB to unclaimedBTB (not transferred yet)</li>
              <li>→ Update totalUnclaimedBTB globally</li>
            </ul>
          </div>
          
          <div className="flex justify-center">↓</div>
          
          <div className="bg-green-50 p-4 rounded border-l-4 border-green-500">
            <div className="font-bold text-green-900">Transfer ETH Immediately</div>
            <div className="text-sm text-gray-700 mt-2">
              Winners receive their ETH instantly during checkpoint
            </div>
          </div>
          
          <div className="flex justify-center">↓</div>
          
          <div className="bg-blue-50 p-4 rounded border-l-4 border-blue-500">
            <div className="font-bold text-blue-900">END: Emit Checkpointed Event</div>
            <div className="text-sm text-gray-600 mt-1">ETH sent, BTB accumulated (claim later)</div>
          </div>
        </div>
      )
    },
    {
      id: 'claiming',
      title: '4. BTB Claiming & Refinement Flow',
      color: 'bg-yellow-50 border-yellow-200',
      headerColor: 'bg-yellow-600',
      content: (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded border-l-4 border-yellow-500">
            <div className="font-bold text-yellow-900">START: Miner Claims BTB</div>
            <div className="text-sm text-gray-600 mt-1">Miner calls claimBTB() to withdraw accumulated BTB</div>
          </div>
          
          <div className="flex justify-center">↓</div>
          
          <div className="bg-purple-50 p-4 rounded border-l-4 border-purple-500">
            <div className="font-bold text-purple-900">Update Refined BTB</div>
            <div className="text-sm text-gray-700 mt-2">
              <div>Calculate refined rewards from claim fees:</div>
              <div className="mt-2 bg-white p-2 rounded text-xs">
                rewardsDelta = currentRewardsFactor - lastRewardsFactor<br/>
                refinedBTB += (unclaimedBTB × rewardsDelta) / 1e18
              </div>
            </div>
          </div>
          
          <div className="flex justify-center">↓</div>
          
          <div className="bg-orange-50 p-4 rounded border-l-4 border-orange-500">
            <div className="font-bold text-orange-900">Calculate Claim Fee (10%)</div>
            <div className="text-sm text-gray-700 mt-2">
              <div>Fee = unclaimedBTB × 10%</div>
              <div className="mt-2 bg-white p-2 rounded text-xs">
                Example: Claiming 1,000 BTB<br/>
                Fee = 100 BTB → Goes to other unclaimed miners<br/>
                You get = 900 BTB + refinedBTB
              </div>
            </div>
          </div>
          
          <div className="flex justify-center">↓</div>
          
          <div className="bg-pink-50 p-4 rounded border-l-4 border-pink-500">
            <div className="font-bold text-pink-900">Distribute Fee to Unclaimed Miners</div>
            <div className="text-sm text-gray-700 mt-2">
              <div>rewardsPerToken = fee / totalUnclaimedBTB</div>
              <div>rewardsFactor += rewardsPerToken</div>
              <div className="mt-2 text-xs bg-white p-2 rounded">
                This increases the "refinedBTB" for everyone who HASN'T claimed yet.<br/>
                Incentivizes HODLing unclaimed BTB to earn from others' claim fees!
              </div>
            </div>
          </div>
          
          <div className="flex justify-center">↓</div>
          
          <div className="bg-green-50 p-4 rounded border-l-4 border-green-500">
            <div className="font-bold text-green-900">Update Global State</div>
            <ul className="text-sm text-gray-700 mt-2 space-y-1">
              <li>→ Reset miner's unclaimedBTB = 0</li>
              <li>→ Reset miner's refinedBTB = 0</li>
              <li>→ Update miner's lastRewardsFactor</li>
              <li>→ Decrease totalUnclaimedBTB</li>
              <li>→ Decrease totalRefinedBTB</li>
            </ul>
          </div>
          
          <div className="flex justify-center">↓</div>
          
          <div className="bg-blue-50 p-4 rounded border-l-4 border-blue-500">
            <div className="font-bold text-blue-900">Transfer BTB Tokens</div>
            <div className="text-sm text-gray-700 mt-2">
              <div className="font-semibold">finalAmount = (unclaimedBTB - fee) + refinedBTB</div>
              <div className="mt-1">→ btbToken.transfer(miner, finalAmount)</div>
            </div>
          </div>
          
          <div className="flex justify-center">↓</div>
          
          <div className="bg-blue-50 p-4 rounded border-l-4 border-blue-500">
            <div className="font-bold text-blue-900">END: Emit RewardsClaimed Event</div>
            <div className="text-sm text-gray-600 mt-1">BTB transferred to miner's wallet</div>
          </div>
        </div>
      )
    },
    {
      id: 'motherlode',
      title: '5. Motherlode System Flow',
      color: 'bg-purple-50 border-purple-200',
      headerColor: 'bg-purple-600',
      content: (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded border-l-4 border-purple-500">
            <div className="font-bold text-purple-900">10 Motherlode Tiers</div>
            <div className="text-sm text-gray-600 mt-1">Progressive jackpot system with increasing rarity</div>
          </div>
          
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-orange-50 p-3 rounded border border-orange-300">
              <div className="font-bold">Tier 1: Bronze Nugget</div>
              <div>1 in 100 chance • ~10k BTB avg</div>
            </div>
            <div className="bg-gray-50 p-3 rounded border border-gray-300">
              <div className="font-bold">Tier 2: Silver Nugget</div>
              <div>1 in 200 chance • ~20k BTB avg</div>
            </div>
            <div className="bg-yellow-50 p-3 rounded border border-yellow-300">
              <div className="font-bold">Tier 3: Gold Nugget</div>
              <div>1 in 300 chance • ~30k BTB avg</div>
            </div>
            <div className="bg-slate-50 p-3 rounded border border-slate-300">
              <div className="font-bold">Tier 4: Platinum Nugget</div>
              <div>1 in 400 chance • ~40k BTB avg</div>
            </div>
            <div className="bg-blue-50 p-3 rounded border border-blue-300">
              <div className="font-bold">Tier 5: Diamond Nugget</div>
              <div>1 in 500 chance • ~50k BTB avg</div>
            </div>
            <div className="bg-green-50 p-3 rounded border border-green-300">
              <div className="font-bold">Tier 6: Emerald Vein</div>
              <div>1 in 600 chance • ~60k BTB avg</div>
            </div>
            <div className="bg-red-50 p-3 rounded border border-red-300">
              <div className="font-bold">Tier 7: Ruby Vein</div>
              <div>1 in 700 chance • ~70k BTB avg</div>
            </div>
            <div className="bg-indigo-50 p-3 rounded border border-indigo-300">
              <div className="font-bold">Tier 8: Sapphire Vein</div>
              <div>1 in 800 chance • ~80k BTB avg</div>
            </div>
            <div className="bg-cyan-50 p-3 rounded border border-cyan-300">
              <div className="font-bold">Tier 9: Crystal Cache</div>
              <div>1 in 900 chance • ~90k BTB avg</div>
            </div>
            <div className="bg-pink-50 p-3 rounded border border-pink-400 border-2">
              <div className="font-bold text-pink-700">Tier 10: MOTHERLODE</div>
              <div className="text-pink-600">1 in 1000 chance • ~100k+ BTB!</div>
            </div>
          </div>
          
          <div className="bg-blue-50 p-4 rounded border-l-4 border-blue-500">
            <div className="font-bold text-blue-900">Each Round: Pot Growth</div>
            <div className="text-sm text-gray-700 mt-2">
              <div>→ +1,000 BTB added to EACH tier (10 tiers)</div>
              <div className="font-semibold mt-1">→ Total: +10,000 BTB per round</div>
              <div className="mt-2 text-xs bg-white p-2 rounded">
                Combined with 20k base reward = 30k BTB emitted per round
              </div>
            </div>
          </div>
          
          <div className="bg-yellow-50 p-4 rounded border-l-4 border-yellow-500">
            <div className="font-bold text-yellow-900">On Round Finalization</div>
            <div className="text-sm text-gray-700 mt-2">
              <div>For each tier (1-10):</div>
              <div className="mt-2 bg-white p-2 rounded text-xs">
                tierRandom = keccak256(VRF_randomness, tierNumber)<br/>
                if (tierRandom % probability == 0) → HIT!
              </div>
              <div className="mt-2">→ If hit: Add pot to totalMotherlodeReward</div>
              <div>→ Reset that tier's pot to 0</div>
              <div>→ Winners split the bonus BTB proportionally</div>
            </div>
          </div>
          
          <div className="bg-green-50 p-4 rounded border-l-4 border-green-500">
            <div className="font-bold text-green-900">Distribution to Winners</div>
            <div className="text-sm text-gray-700 mt-2">
              <div>All hit tier pots → totalMotherlodeReward</div>
              <div className="mt-2 bg-white p-2 rounded text-xs">
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">BTB Mining Game</h1>
          <p className="text-slate-300">Interactive Flow Chart Documentation</p>
          <div className="mt-4 bg-slate-800 p-4 rounded-lg border border-slate-700">
            <div className="text-sm text-slate-300">
              <div className="font-semibold text-white mb-2">Quick Summary:</div>
              <div>🎯 25 squares (5×5 grid) • 60-second rounds</div>
              <div>💰 Winners split losers' ETH + 20k BTB + motherlode bonuses</div>
              <div>🎲 Chainlink VRF ensures provably fair randomness</div>
              <div>💎 10 motherlode tiers accumulate 1k BTB each per round</div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {sections.map((section) => (
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

        <div className="mt-8 bg-slate-800 p-6 rounded-lg border border-slate-700">
          <h2 className="text-xl font-bold text-white mb-4">Key Concepts</h2>
          <div className="space-y-3 text-sm text-slate-300">
            <div>
              <span className="font-semibold text-white">Admin Fee:</span> 10% of all deployments go to admin, 90% enters the game pot
            </div>
            <div>
              <span className="font-semibold text-white">Claim Fee:</span> 10% of claimed BTB is redistributed to unclaimed miners (refinement)
            </div>
            <div>
              <span className="font-semibold text-white">Refinement:</span> HODLing unclaimed BTB earns you a share of others' claim fees
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
    </div>
  );
};

export default BTBMiningFlowCharts;