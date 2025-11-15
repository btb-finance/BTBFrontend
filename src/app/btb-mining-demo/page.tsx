'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import {
  Coins,
  Timer,
  Trophy,
  Zap,
  Users,
  TrendingUp,
  Sparkles,
  RefreshCw,
  AlertCircle
} from 'lucide-react';

// Constants from contract
const NUM_SQUARES = 25;
const ROUND_DURATION = 60;
const MIN_DEPLOYMENT = 0.0000001;
const MAX_DEPLOYMENT = 10;
const BTB_PER_ROUND = 20000;
const ADMIN_FEE_BPS = 1000; // 10%
const CLAIM_FEE_BPS = 1000; // 10%

const MOTHERLODE_TIERS = [
  { name: 'Bronze Nugget', probability: 100, color: 'bg-orange-500', textColor: 'text-orange-700 dark:text-orange-300' },
  { name: 'Silver Nugget', probability: 200, color: 'bg-gray-400', textColor: 'text-gray-700 dark:text-gray-300' },
  { name: 'Gold Nugget', probability: 300, color: 'bg-yellow-500', textColor: 'text-yellow-700 dark:text-yellow-300' },
  { name: 'Platinum Nugget', probability: 400, color: 'bg-slate-500', textColor: 'text-slate-700 dark:text-slate-300' },
  { name: 'Diamond Nugget', probability: 500, color: 'bg-blue-500', textColor: 'text-blue-700 dark:text-blue-300' },
  { name: 'Emerald Vein', probability: 600, color: 'bg-green-500', textColor: 'text-green-700 dark:text-green-300' },
  { name: 'Ruby Vein', probability: 700, color: 'bg-red-500', textColor: 'text-red-700 dark:text-red-300' },
  { name: 'Sapphire Vein', probability: 800, color: 'bg-indigo-500', textColor: 'text-indigo-700 dark:text-indigo-300' },
  { name: 'Crystal Cache', probability: 900, color: 'bg-cyan-500', textColor: 'text-cyan-700 dark:text-cyan-300' },
  { name: 'MOTHERLODE', probability: 1000, color: 'bg-pink-600', textColor: 'text-pink-700 dark:text-pink-300' },
];

interface Square {
  totalDeployed: number;
  minerCount: number;
  miners: { address: string; amount: number }[];
}

interface Round {
  id: number;
  timeRemaining: number;
  squares: Square[];
  finalized: boolean;
  winningSquare: number | null;
  motherlodePots: number[];
  tiersHit: boolean[];
}

export default function BTBMiningDemo() {
  const [round, setRound] = useState<Round>({
    id: 1,
    timeRemaining: ROUND_DURATION,
    squares: Array(NUM_SQUARES).fill(null).map(() => ({
      totalDeployed: 0,
      minerCount: 0,
      miners: []
    })),
    finalized: false,
    winningSquare: null,
    motherlodePots: Array(10).fill(10000), // Start with 10k BTB each
    tiersHit: Array(10).fill(false)
  });

  const [selectedSquares, setSelectedSquares] = useState<number[]>([]);
  const [deployAmount, setDeployAmount] = useState<string>('0.001');
  const [userAddress] = useState('0x' + Math.random().toString(16).slice(2, 10));
  const [userBalance, setUserBalance] = useState(1.0);
  const [userBTB, setUserBTB] = useState(0);
  const [roundHistory, setRoundHistory] = useState<any[]>([]);
  const [autoPlay, setAutoPlay] = useState(false);
  const [notifications, setNotifications] = useState<string[]>([]);

  // Timer countdown
  useEffect(() => {
    if (round.finalized || autoPlay) return;

    const interval = setInterval(() => {
      setRound(prev => {
        if (prev.timeRemaining <= 0) {
          return prev;
        }
        return { ...prev, timeRemaining: prev.timeRemaining - 1 };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [round.finalized, autoPlay]);

  // Auto-finalize when time runs out
  useEffect(() => {
    if (round.timeRemaining === 0 && !round.finalized) {
      setTimeout(() => finalizeRound(), 1000);
    }
  }, [round.timeRemaining, round.finalized]);

  const addNotification = (message: string) => {
    setNotifications(prev => [message, ...prev].slice(0, 5));
  };

  const toggleSquare = (index: number) => {
    if (round.finalized) return;

    setSelectedSquares(prev =>
      prev.includes(index)
        ? prev.filter(s => s !== index)
        : [...prev, index]
    );
  };

  const deployToSquares = () => {
    if (selectedSquares.length === 0 || round.finalized) return;

    const amount = parseFloat(deployAmount);
    if (amount < MIN_DEPLOYMENT || amount > MAX_DEPLOYMENT) {
      addNotification(`❌ Amount must be between ${MIN_DEPLOYMENT} and ${MAX_DEPLOYMENT} ETH`);
      return;
    }

    const totalCost = amount * selectedSquares.length;
    if (totalCost > userBalance) {
      addNotification('❌ Insufficient ETH balance');
      return;
    }

    // Calculate fees
    const adminFee = totalCost * 0.1;
    const gamePotAmount = totalCost - adminFee;
    const amountPerSquare = gamePotAmount / selectedSquares.length;

    // Update squares
    const newSquares = [...round.squares];
    selectedSquares.forEach(idx => {
      const square = newSquares[idx];
      const existingMiner = square.miners.find(m => m.address === userAddress);

      if (existingMiner) {
        existingMiner.amount += amountPerSquare;
      } else {
        square.miners.push({ address: userAddress, amount: amountPerSquare });
        square.minerCount++;
      }
      square.totalDeployed += amountPerSquare;
    });

    setRound({ ...round, squares: newSquares });
    setUserBalance(prev => prev - totalCost);
    setSelectedSquares([]);

    addNotification(`✅ Deployed ${gamePotAmount.toFixed(4)} ETH to ${selectedSquares.length} square(s)`);
  };

  const finalizeRound = () => {
    // Simulate VRF randomness
    const randomness = Math.floor(Math.random() * 1000000);
    const winningSquare = randomness % NUM_SQUARES;

    // Check motherlode tiers
    const tiersHit = Array(10).fill(false);
    let totalMotherlodeReward = 0;

    MOTHERLODE_TIERS.forEach((tier, idx) => {
      const tierRandom = Math.floor(Math.random() * tier.probability);
      if (tierRandom === 0 && round.motherlodePots[idx] > 0) {
        tiersHit[idx] = true;
        totalMotherlodeReward += round.motherlodePots[idx];
        addNotification(`🎰 ${tier.name} HIT! +${round.motherlodePots[idx].toLocaleString()} BTB`);
      }
    });

    // Calculate rewards for user if they deployed to winning square
    const winningSquareData = round.squares[winningSquare];
    const userMiner = winningSquareData.miners.find(m => m.address === userAddress);

    if (userMiner && winningSquareData.totalDeployed > 0) {
      // Calculate ETH rewards
      let totalWinnings = 0;
      round.squares.forEach((sq, idx) => {
        if (idx !== winningSquare) {
          totalWinnings += sq.totalDeployed;
        }
      });

      const userShare = userMiner.amount / winningSquareData.totalDeployed;
      const ethReward = userMiner.amount + (totalWinnings * userShare);

      // Calculate BTB rewards
      const btbReward = BTB_PER_ROUND * userShare;
      const motherlodeBTB = totalMotherlodeReward * userShare;
      const totalBTB = btbReward + motherlodeBTB;

      setUserBalance(prev => prev + ethReward);
      setUserBTB(prev => prev + totalBTB);

      addNotification(`🏆 YOU WON! +${ethReward.toFixed(4)} ETH, +${totalBTB.toLocaleString()} BTB`);
    } else {
      const userLostSquares = round.squares.filter((sq, idx) =>
        idx !== winningSquare && sq.miners.some(m => m.address === userAddress)
      );

      if (userLostSquares.length > 0) {
        addNotification(`😢 Lost this round. Winning square was #${winningSquare}`);
      }
    }

    // Reset motherlode pots for hit tiers
    const newPots = [...round.motherlodePots];
    tiersHit.forEach((hit, idx) => {
      if (hit) newPots[idx] = 0;
    });

    setRound(prev => ({
      ...prev,
      finalized: true,
      winningSquare,
      tiersHit,
      motherlodePots: newPots
    }));

    // Store round history
    setRoundHistory(prev => [...prev, {
      id: round.id,
      winningSquare,
      tiersHit,
      totalDeployed: round.squares.reduce((sum, sq) => sum + sq.totalDeployed, 0)
    }]);
  };

  const startNewRound = () => {
    // Increase all motherlode pots by 1000 BTB
    const newPots = round.motherlodePots.map(pot => pot + 1000);

    setRound({
      id: round.id + 1,
      timeRemaining: ROUND_DURATION,
      squares: Array(NUM_SQUARES).fill(null).map(() => ({
        totalDeployed: 0,
        minerCount: 0,
        miners: []
      })),
      finalized: false,
      winningSquare: null,
      motherlodePots: newPots,
      tiersHit: Array(10).fill(false)
    });

    addNotification(`🔄 Round ${round.id + 1} started! Motherlode pots increased by 1,000 BTB each`);
  };

  const simulateAI = () => {
    // Simulate AI players
    const numAIPlayers = Math.floor(Math.random() * 5) + 3;
    const newSquares = [...round.squares];

    for (let i = 0; i < numAIPlayers; i++) {
      const aiAddress = '0xAI' + Math.random().toString(16).slice(2, 8);
      const aiSquares = Math.floor(Math.random() * 5) + 1;
      const aiAmount = (Math.random() * 0.05 + 0.001);

      for (let j = 0; j < aiSquares; j++) {
        const randomSquare = Math.floor(Math.random() * NUM_SQUARES);
        const square = newSquares[randomSquare];

        square.miners.push({ address: aiAddress, amount: aiAmount });
        square.totalDeployed += aiAmount;
        square.minerCount++;
      }
    }

    setRound({ ...round, squares: newSquares });
    addNotification(`🤖 ${numAIPlayers} AI players joined the round`);
  };

  const formatTime = (seconds: number) => {
    return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
  };

  const getSquareColor = (square: Square, index: number) => {
    if (round.finalized && round.winningSquare === index) {
      return 'bg-green-500 border-green-600 dark:bg-green-600 dark:border-green-700';
    }
    if (selectedSquares.includes(index)) {
      return 'bg-blue-500 border-blue-600 dark:bg-blue-600 dark:border-blue-700';
    }
    const hasUserDeployment = square.miners.some(m => m.address === userAddress);
    if (hasUserDeployment) {
      return 'bg-purple-500 border-purple-600 dark:bg-purple-600 dark:border-purple-700';
    }
    if (square.totalDeployed > 0) {
      return 'bg-orange-400 border-orange-500 dark:bg-orange-600 dark:border-orange-700';
    }
    return 'bg-gray-200 border-gray-300 dark:bg-gray-700 dark:border-gray-600';
  };

  return (
    <div className="container mx-auto px-4 py-8 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold mb-2 bg-gradient-to-r from-orange-600 via-yellow-600 to-orange-600 bg-clip-text text-transparent">
            BTB Mining Game Demo
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Interactive simulator based on the BTB Mining smart contract
          </p>
        </div>

        {/* Notifications */}
        {notifications.length > 0 && (
          <Card className="mb-6 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 border-2 border-blue-300 dark:border-blue-700">
            <CardContent className="p-4">
              <div className="space-y-1">
                {notifications.map((notif, idx) => (
                  <div key={idx} className="text-sm font-medium animate-fade-in">
                    {notif}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Stats & Controls */}
          <div className="space-y-6">
            {/* Round Info */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <Timer className="w-5 h-5" />
                    Round #{round.id}
                  </h3>
                  {round.finalized ? (
                    <span className="text-red-600 dark:text-red-400 font-bold">FINALIZED</span>
                  ) : (
                    <span className="text-green-600 dark:text-green-400 font-bold">ACTIVE</span>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
                    <div className="text-sm text-gray-600 dark:text-gray-400">Time Remaining</div>
                    <div className="text-2xl font-bold">{formatTime(round.timeRemaining)}</div>
                  </div>

                  <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
                    <div className="text-sm text-gray-600 dark:text-gray-400">Total Deployed</div>
                    <div className="text-xl font-bold">
                      {round.squares.reduce((sum, sq) => sum + sq.totalDeployed, 0).toFixed(4)} ETH
                    </div>
                  </div>

                  <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
                    <div className="text-sm text-gray-600 dark:text-gray-400">BTB Reward Pool</div>
                    <div className="text-xl font-bold">{BTB_PER_ROUND.toLocaleString()} BTB</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* User Wallet */}
            <Card>
              <CardContent className="p-6">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Coins className="w-5 h-5" />
                  Your Wallet
                </h3>

                <div className="space-y-3">
                  <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="text-sm text-blue-600 dark:text-blue-400">ETH Balance</div>
                    <div className="text-2xl font-bold">{userBalance.toFixed(4)} ETH</div>
                  </div>

                  <div className="bg-purple-50 dark:bg-purple-950/20 p-3 rounded-lg border border-purple-200 dark:border-purple-800">
                    <div className="text-sm text-purple-600 dark:text-purple-400">BTB Balance</div>
                    <div className="text-2xl font-bold">{userBTB.toLocaleString()} BTB</div>
                  </div>

                  <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                    {userAddress}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Deployment Controls */}
            <Card>
              <CardContent className="p-6">
                <h3 className="text-xl font-bold mb-4">Deploy ETH</h3>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Amount per Square (ETH)
                    </label>
                    <input
                      type="number"
                      step="0.0001"
                      min={MIN_DEPLOYMENT}
                      max={MAX_DEPLOYMENT}
                      value={deployAmount}
                      onChange={(e) => setDeployAmount(e.target.value)}
                      className="w-full p-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600"
                      disabled={round.finalized}
                    />
                    <div className="text-xs text-gray-500 mt-1">
                      Selected: {selectedSquares.length} square(s)
                    </div>
                  </div>

                  <Button
                    onClick={deployToSquares}
                    disabled={selectedSquares.length === 0 || round.finalized}
                    className="w-full"
                  >
                    <Zap className="w-4 h-4 mr-2" />
                    Deploy to Selected Squares
                  </Button>

                  <Button
                    onClick={simulateAI}
                    disabled={round.finalized}
                    variant="outline"
                    className="w-full"
                  >
                    <Users className="w-4 h-4 mr-2" />
                    Simulate AI Players
                  </Button>

                  {round.finalized && (
                    <Button
                      onClick={startNewRound}
                      className="w-full bg-green-600 hover:bg-green-700"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Start New Round
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Motherlode Pots */}
            <Card>
              <CardContent className="p-6">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  Motherlode Pots
                </h3>

                <div className="space-y-2">
                  {MOTHERLODE_TIERS.map((tier, idx) => (
                    <div
                      key={idx}
                      className={`p-2 rounded-lg border ${
                        round.tiersHit[idx]
                          ? 'bg-green-100 dark:bg-green-950/20 border-green-400 dark:border-green-700'
                          : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${tier.color}`} />
                          <span className="text-xs font-medium">{tier.name}</span>
                        </div>
                        <div className="text-sm font-bold">
                          {round.tiersHit[idx] ? (
                            <span className="text-green-600 dark:text-green-400">HIT!</span>
                          ) : (
                            <span>{round.motherlodePots[idx].toLocaleString()} BTB</span>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        1 in {tier.probability} chance
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Center Column - Game Board */}
          <div className="lg:col-span-2">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold">Game Board (5×5 Grid)</h3>
                  {round.finalized && round.winningSquare !== null && (
                    <div className="flex items-center gap-2 text-green-600 dark:text-green-400 font-bold">
                      <Trophy className="w-5 h-5" />
                      Winner: Square #{round.winningSquare}
                    </div>
                  )}
                </div>

                {/* Legend */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-gray-200 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded" />
                    <span>Empty</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-purple-500 border border-purple-600 rounded" />
                    <span>Your Deployment</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-blue-500 border border-blue-600 rounded" />
                    <span>Selected</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-orange-400 border border-orange-500 rounded" />
                    <span>Has Deployments</span>
                  </div>
                </div>

                {/* Game Grid */}
                <div className="grid grid-cols-5 gap-3">
                  {round.squares.map((square, index) => (
                    <button
                      key={index}
                      onClick={() => toggleSquare(index)}
                      disabled={round.finalized}
                      className={`aspect-square ${getSquareColor(square, index)} border-2 rounded-lg p-2 transition-all hover:scale-105 disabled:hover:scale-100 relative`}
                    >
                      <div className="text-white font-bold text-sm">{index}</div>
                      {square.totalDeployed > 0 && (
                        <div className="text-white text-xs mt-1">
                          <div>{square.totalDeployed.toFixed(4)} Ξ</div>
                          <div className="flex items-center gap-1 justify-center mt-1">
                            <Users className="w-3 h-3" />
                            {square.minerCount}
                          </div>
                        </div>
                      )}
                      {round.finalized && round.winningSquare === index && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Trophy className="w-8 h-8 text-yellow-400 animate-bounce" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>

                {/* Instructions */}
                <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                    <div className="text-sm text-blue-900 dark:text-blue-100">
                      <p className="font-semibold mb-1">How to Play:</p>
                      <ol className="list-decimal list-inside space-y-1 text-blue-800 dark:text-blue-200">
                        <li>Click squares to select them (blue highlight)</li>
                        <li>Enter your deployment amount (min 0.0000001 ETH, max 10 ETH)</li>
                        <li>Click &quot;Deploy to Selected Squares&quot; to commit your ETH</li>
                        <li>Wait for the round to end (60 seconds countdown)</li>
                        <li>If your square wins, you get your ETH back + share of losers&apos; ETH + BTB rewards!</li>
                        <li>Use &quot;Simulate AI Players&quot; to add competition</li>
                      </ol>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Round History */}
            {roundHistory.length > 0 && (
              <Card className="mt-6">
                <CardContent className="p-6">
                  <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Round History
                  </h3>

                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {roundHistory.slice().reverse().map((r, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-bold">Round #{r.id}</div>
                          <div className="text-sm">
                            Winner: Square #{r.winningSquare}
                          </div>
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          Total Deployed: {r.totalDeployed.toFixed(4)} ETH
                          {r.tiersHit.some((hit: boolean) => hit) && (
                            <span className="ml-2 text-pink-600 dark:text-pink-400">
                              • {r.tiersHit.filter((h: boolean) => h).length} Motherlode Hit(s)!
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
