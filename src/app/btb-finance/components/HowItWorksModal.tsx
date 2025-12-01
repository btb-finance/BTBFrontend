'use client';

import { useState } from 'react';
import { Button } from '@/app/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/app/components/ui/dialog';
import { ScrollArea } from '@/app/components/ui/scroll-area';
import { HelpCircle, ChevronDown, ChevronUp, Info } from 'lucide-react';

export function HowItWorksModal() {
    const [expandedSection, setExpandedSection] = useState<string | null>('deployment');

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
                            <div className="mt-1">Referral Fee (1%) = Total × 0.01 (if referrer used)</div>
                            <div className="mt-1">Admin Fee (9%) = Total × 0.09 (if referrer used)</div>
                            <div className="mt-1 font-semibold">Game Pot (90%) = Total - Fees</div>
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
                                        btb = (20k × myDeployment) / totalWinningSquare<br />
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
                                rewardsDelta = currentRewardsFactor - lastRewardsFactor<br />
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
                                Example: Claiming 1,000 BTB<br />
                                Fee = 100 BTB → Goes to other unclaimed miners<br />
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
                                This increases the &quot;refinedBTB&quot; for everyone who HASN&apos;T claimed yet.<br />
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
                                tierRandom = keccak256(VRF_randomness, tierNumber)<br />
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
        },
        {
            id: 'btbt-tax',
            title: '6. BTBT Tax & Bonding Curve',
            color: 'bg-indigo-50 border-indigo-200 dark:bg-indigo-950/20 dark:border-indigo-800',
            headerColor: 'bg-indigo-600',
            content: (
                <div className="space-y-4">
                    <div className="bg-white dark:bg-gray-900 p-4 rounded border-l-4 border-indigo-500">
                        <div className="font-bold text-indigo-900 dark:text-indigo-300">BTBT (Ardeem) Token</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            A 1:1 wrapped version of BTB used for specific ecosystem interactions.
                        </div>
                    </div>

                    <div className="flex justify-center">↓</div>

                    <div className="bg-red-50 dark:bg-red-950/20 p-4 rounded border-l-4 border-red-500">
                        <div className="font-bold text-red-900 dark:text-red-300">1% Transfer Tax</div>
                        <div className="text-sm text-gray-700 dark:text-gray-300 mt-2">
                            <div>Every transfer of BTBT incurs a 1% tax.</div>
                            <div className="mt-1 font-semibold">100% of this tax goes to the Admin/Project.</div>
                            <div className="mt-2 text-xs bg-white dark:bg-gray-800 p-2 rounded">
                                Example: Sending 1,000 BTBT<br />
                                Tax = 10 BTBT<br />
                                Recipient gets = 990 BTBT
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-center">↓</div>

                    <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded border-l-4 border-blue-500">
                        <div className="font-bold text-blue-900 dark:text-blue-300">Bonding Curve Connection</div>
                        <div className="text-sm text-gray-700 dark:text-gray-300 mt-2">
                            <div>The 10% Admin Fee from Mining Deployments is sent to the Bonding Curve.</div>
                            <div className="mt-1">This provides constant buy pressure and liquidity for the BTB token.</div>
                        </div>
                    </div>
                </div>
            )
        }
    ];

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button
                    variant="outline"
                    className="bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white border-none shadow-lg hover:shadow-xl transition-all text-lg px-8 py-6 h-auto rounded-xl"
                >
                    <HelpCircle className="w-6 h-6 mr-2" />
                    How to Mine BTB
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0 bg-white dark:bg-gray-950 border-gray-200 dark:border-gray-800">
                <DialogHeader className="p-6 pb-2">
                    <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-orange-600 via-yellow-600 to-orange-600 bg-clip-text text-transparent">
                        BTB Mining Game Mechanics
                    </DialogTitle>
                    <DialogDescription>
                        Interactive guide to understanding the game flow, rewards, and tokenomics.
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="flex-1 p-6 pt-2">
                    <div className="space-y-8 pb-8">
                        {/* Quick Summary */}
                        <div className="bg-gradient-to-br from-slate-800 to-slate-900 dark:from-slate-900 dark:to-black p-6 rounded-lg border border-slate-700">
                            <div className="text-sm text-slate-300">
                                <div className="font-semibold text-white mb-3">Quick Summary:</div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-left">
                                    <div>🎯 25 squares (5×5 grid) • 24-hour rounds</div>
                                    <div>💰 Winners split losers&apos; ETH + 30,000 BTB + motherlode bonuses</div>
                                    <div>🎲 Chainlink VRF v2.5 ensures provably fair randomness</div>
                                    <div>💎 10 motherlode tiers: 1,000 BTB each/round (2,000 BTB in jackpot rounds)</div>
                                </div>
                            </div>
                        </div>

                        {/* Interactive Sections */}
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
                                        <div className="p-6 bg-white/50 dark:bg-black/20">
                                            {section.content}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Key Concepts */}
                        <div className="bg-gradient-to-br from-slate-800 to-slate-900 dark:from-slate-900 dark:to-black p-6 rounded-lg border border-slate-700">
                            <h3 className="text-xl font-bold text-white mb-4 flex items-center">
                                <Info className="w-5 h-5 mr-2 text-blue-400" />
                                Key Concepts
                            </h3>
                            <div className="space-y-3 text-sm text-slate-300">
                                <div>
                                    <span className="font-semibold text-white">Admin Fee:</span> 10% of all deployments sent to bonding curve (9% if referral used), 90% enters the game pot
                                </div>
                                <div>
                                    <span className="font-semibold text-white">Referral System:</span> 1% Referral Fee: Paid instantly in ETH to the referrer. 9% Admin Fee: When a referral is used.
                                </div>
                                <div>
                                    <span className="font-semibold text-white">Claim Fee:</span> 10% of claimed BTB redistributed to unclaimed miners (refinement)
                                </div>
                                <div>
                                    <span className="font-semibold text-white">Refinement:</span> HODLing unclaimed BTB earns you a share of others&apos; claim fees
                                </div>
                                <div>
                                    <span className="font-semibold text-white">Emission (Normal):</span> 30,000 BTB/round (20,000 base + 10,000 to motherlode pots)
                                </div>
                                <div>
                                    <span className="font-semibold text-white">Emission (Jackpot):</span> 50,000 BTB/round (10,000 base + 40,000 to motherlode pots)
                                </div>
                                <div>
                                    <span className="font-semibold text-white">Total Supply:</span> 88,888,888,888 BTB tokens
                                </div>
                                <div>
                                    <span className="font-semibold text-white">Duration:</span> 5-year mining period (~2.6M rounds @ 24h each)
                                </div>
                                <div>
                                    <span className="font-semibold text-white">Deployment Limits:</span> Min 0.0000001 ETH, Max 10 ETH per square per miner
                                </div>
                            </div>
                        </div>
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
