'use client';
import { useEffect, useState } from 'react';
import { Glass } from '../Glass';
import { Icon } from '../Icon';
import { Screen } from '../Screen';
import { Badge } from '../Badge';
import { btb } from '../design-tokens';

/**
 * Agent Studio — a self playing film. Each strategy is drawn as a live money
 * flow graph: your account and the protocols sit on a ring, and animated dots
 * stream along the active route while a caption narrates each step with its
 * code call. Opens with a title, ends on Coming soon, loops forever. No clicks
 * required anywhere; clicking the frame quietly skips a scene. Pure UI demo.
 */

// ── Protocol catalog ─────────────────────────────────────────────────────────

type LegId = 'aave' | 'morpho' | 'aerodrome' | 'uniswap' | 'yearn' | 'velodrome' | 'curve' | 'convex';
type NodeId = LegId | 'account';

const CATALOG: Record<LegId, { name: string; icon: string; color: string }> = {
  aave:      { name: 'Aave',      icon: 'bank',    color: '#C77DFF' },
  morpho:    { name: 'Morpho',    icon: 'pie',     color: '#5792FF' },
  aerodrome: { name: 'Aerodrome', icon: 'swap',    color: '#4A7DFF' },
  uniswap:   { name: 'Uniswap',   icon: 'refresh', color: '#FF6BA9' },
  yearn:     { name: 'Yearn',     icon: 'layers',  color: '#3E7BFF' },
  velodrome: { name: 'Velodrome', icon: 'bolt',    color: '#FF6B5E' },
  curve:     { name: 'Curve',     icon: 'chart',   color: '#A5A4CE' },
  convex:    { name: 'Convex',    icon: 'fire',    color: '#FF9A3C' },
};

const NODE_META: Record<NodeId, { name: string; icon: string; color: string }> = {
  ...CATALOG,
  account: { name: 'Your account', icon: 'wallet', color: '#52E3A4' },
};

// ── The film ─────────────────────────────────────────────────────────────────

type Step = { leg: LegId; text: string; code: string };
type Strategy = { name: string; tagline: string; legs: LegId[]; steps: Step[] };

const STRATEGIES: Strategy[] = [
  {
    name: 'The Delta Loop',
    tagline: 'Your yield pays off your own loan while you sleep.',
    legs: ['aave', 'uniswap', 'yearn'],
    steps: [
      { leg: 'aave',    text: 'Deposit ETH and borrow dollars against it',      code: 'aave.supply(10 ETH); aave.borrow(20,400 USDC)' },
      { leg: 'uniswap', text: 'Swap half to WETH and open a tight LP',          code: 'swap(10,200 USDC to WETH); lp.mint(width: 10%)' },
      { leg: 'uniswap', text: 'Claim fees every week and buy YFI',              code: 'lp.collect(); swap(fees to YFI)' },
      { leg: 'yearn',   text: 'Stake the YFI so earnings stack on earnings',    code: 'yearn.stake(YFI); yearn.claim(yvUSDC-1)' },
      { leg: 'aave',    text: 'Every income stream repays the loan',            code: 'aave.repay(earnings)  // debt shrinks weekly' },
    ],
  },
  {
    name: 'Auto Range Master',
    tagline: 'A concentrated LP that follows the price so your fees never stop.',
    legs: ['uniswap'],
    steps: [
      { leg: 'uniswap', text: 'Open a tight position around the current price',   code: 'lp.mint(width: 10%)' },
      { leg: 'uniswap', text: 'Price drifts out of range, the agent notices',     code: 'watch(pool.tick)  // out of range' },
      { leg: 'uniswap', text: 'Withdraw, rebalance, remint around the new price', code: 'lp.burn(); swap(rebalance); lp.mint()' },
      { leg: 'uniswap', text: 'Fees compound straight back into the position',    code: 'lp.collect(); lp.increaseLiquidity(fees)' },
    ],
  },
  {
    name: 'Bribe Sniper',
    tagline: 'Votes in the final seconds of every epoch for the fattest bribes.',
    legs: ['aerodrome', 'uniswap'],
    steps: [
      { leg: 'aerodrome', text: 'Watch bribes build across every pool all week', code: 'watch(bribes)  // ranking pools by APR' },
      { leg: 'aerodrome', text: 'Vote at the last second for the best payout',   code: 'voter.vote(bestPool)  // epoch minus 30s' },
      { leg: 'aerodrome', text: 'Claim bribes and fees after the epoch flips',   code: 'voter.claimBribes(); voter.claimFees()' },
      { leg: 'uniswap',   text: 'Sell rewards and grow the voting power',        code: 'swap(bribes to AERO); ve.increaseLock()' },
    ],
  },
  {
    name: 'Debt Terminator',
    tagline: 'Points every earning you have at your loan until it hits zero.',
    legs: ['yearn', 'uniswap', 'aave'],
    steps: [
      { leg: 'yearn',   text: 'Claim vault and staking earnings weekly',        code: 'yearn.claim(all positions)' },
      { leg: 'uniswap', text: 'Sell everything to dollars at fair prices',      code: 'swap(earnings to USDC)  // TWAP checked' },
      { leg: 'aave',    text: 'Repay the loan, week after week',                code: 'aave.repay(USDC)' },
      { leg: 'aave',    text: 'Debt hits zero, collateral is fully yours',      code: 'assert(debt == 0)  // mission complete' },
    ],
  },
  {
    name: 'Leverage Looper',
    tagline: 'Loops collateral to a target leverage and guards it around the clock.',
    legs: ['aave', 'uniswap'],
    steps: [
      { leg: 'aave',    text: 'Supply ETH, borrow dollars',               code: 'aave.supply(ETH); aave.borrow(USDC)' },
      { leg: 'uniswap', text: 'Buy more ETH with the loan',               code: 'swap(USDC to ETH)' },
      { leg: 'aave',    text: 'Resupply and loop to the target leverage', code: 'aave.supply(ETH)  // loop until 2x' },
      { leg: 'aave',    text: 'Health factor guarded day and night',      code: 'if (health < floor) delever()' },
    ],
  },
  {
    name: 'Stable Stacker',
    tagline: 'Boring stablecoin yield, boosted and compounded forever.',
    legs: ['curve', 'convex', 'uniswap'],
    steps: [
      { leg: 'curve',   text: 'Provide stablecoin liquidity',     code: 'curve.addLiquidity(USDC, 3pool)' },
      { leg: 'convex',  text: 'Stake the LP for boosted rewards', code: 'convex.deposit(lpToken)' },
      { leg: 'uniswap', text: 'Sell CRV and CVX rewards weekly',  code: 'swap(CRV + CVX to USDC)' },
      { leg: 'curve',   text: 'Compound back into the pool',      code: 'curve.addLiquidity(proceeds)' },
    ],
  },
  {
    name: 'DCA Machine',
    tagline: 'Buys ETH every single day while idle cash keeps earning.',
    legs: ['morpho', 'uniswap'],
    steps: [
      { leg: 'morpho',  text: 'Park the budget in a vault so it earns', code: 'morpho.deposit(30,000 USDC)' },
      { leg: 'morpho',  text: 'Withdraw one slice per day',             code: 'morpho.withdraw(1,000 USDC)  // daily' },
      { leg: 'uniswap', text: 'Buy ETH only at fair checked prices',    code: 'swap(USDC to ETH)  // price bound enforced' },
      { leg: 'morpho',  text: 'Repeat for thirty days, hands free',     code: 'cooldown(1 day); repeat()' },
    ],
  },
  {
    name: 'Emission Recycler',
    tagline: 'Sells emissions every week and buys more LP, forever.',
    legs: ['velodrome', 'uniswap'],
    steps: [
      { leg: 'velodrome', text: 'LP and stake in the gauge',        code: 'velo.deposit(lp); gauge.stake()' },
      { leg: 'velodrome', text: 'Harvest the weekly emissions',     code: 'gauge.getReward()  // VELO' },
      { leg: 'uniswap',   text: 'Sell emissions before they dilute', code: 'swap(VELO to USDC)' },
      { leg: 'velodrome', text: 'Buy more LP with the proceeds',    code: 'velo.deposit(more lp)  // position grows' },
    ],
  },
  {
    name: 'Harvest to Wallet',
    tagline: 'Claims your earnings weekly, sells to dollars, and sends them home.',
    legs: ['yearn', 'uniswap'],
    steps: [
      { leg: 'yearn',   text: 'Claim vault earnings every week',              code: 'yearn.claim(yvUSDC-1)' },
      { leg: 'uniswap', text: 'Sell to USDC at a TWAP checked price',         code: 'swap(earnings to USDC)' },
      { leg: 'uniswap', text: 'Payout goes to exactly one address, yours',    code: 'payout(owner)  // hardcoded, always' },
    ],
  },
  {
    name: 'veVote Compounder',
    tagline: 'Locks, votes, claims, relocks. Governance yield on autopilot.',
    legs: ['velodrome', 'uniswap'],
    steps: [
      { leg: 'velodrome', text: 'Lock VELO for voting power',                 code: 've.createLock(VELO, 4 years)' },
      { leg: 'velodrome', text: 'Vote every epoch for the best returns',      code: 'voter.vote(topPools)' },
      { leg: 'velodrome', text: 'Claim rebases, bribes, and fees',            code: 've.claimRebase(); voter.claimAll()' },
      { leg: 'uniswap',   text: 'Compound everything into more voting power', code: 'swap(rewards to VELO); ve.increase()' },
    ],
  },
  {
    name: 'Morpho Sleeper',
    tagline: 'Idle cash never sleeps. Every dollar parked in the best vault.',
    legs: ['morpho'],
    steps: [
      { leg: 'morpho', text: 'Sweep idle balances into the best vault',  code: 'morpho.deposit(idle USDC)' },
      { leg: 'morpho', text: 'A better rate appears somewhere else',     code: 'watch(rates)  // better vault found' },
      { leg: 'morpho', text: 'Rotate to the higher yield automatically', code: 'morpho.withdraw(); morpho.deposit(best)' },
    ],
  },
  {
    name: 'The Everything Loop',
    tagline: 'Five protocols, one machine. The grand finale.',
    legs: ['aave', 'morpho', 'aerodrome', 'uniswap', 'yearn'],
    steps: [
      { leg: 'aave',      text: 'Lend ETH, borrow dollars',                  code: 'aave.supply(ETH); aave.borrow(USDC)' },
      { leg: 'morpho',    text: 'Idle dollars earn while they wait',         code: 'morpho.deposit(USDC)' },
      { leg: 'aerodrome', text: 'LP and stake for weekly emissions',         code: 'aero.deposit(lp); gauge.stake()' },
      { leg: 'uniswap',   text: 'Sell rewards, buy YFI',                     code: 'swap(AERO to USDC to YFI)' },
      { leg: 'yearn',     text: 'Stake YFI, earnings stack weekly',          code: 'yearn.stake(YFI)' },
      { leg: 'aave',      text: 'Every stream repays the loan on autopilot', code: 'aave.repay(all earnings)  // the loop closes' },
    ],
  },
];

const OPENING_MS = 3000;
const STORY_MS = 3600;
const SCENE_TITLE_MS = 2000;
const STEP_MS = 1600;
const SCENE_HOLD_MS = 1400;
const END_MS = 7000;

/** The narrative beats played before the strategies: the renting story. */
const STORY: { icon: string; title: string; body: string }[] = [
  {
    icon: 'bolt',
    title: 'Rent your manager',
    body: 'An AI agent, a human pro, or your own bot. Anyone can run your money for you. Nobody can ever hold it.',
  },
  {
    icon: 'gift',
    title: 'No fat fees',
    body: 'No 2 percent management fee eating your funds every year. Pay a small bounty per job, or nothing at all. Managers compete to work for you.',
  },
  {
    icon: 'shield',
    title: 'Your rules, forever',
    body: 'Set your limits once and change them any time. Whoever you hire works inside them and can never change a single one. Every payout goes to your wallet only.',
  },
  {
    icon: 'lock',
    title: 'Fire anyone, any time',
    body: 'One click pauses everything. Swap agents like you swap tokens. Your money never moves, only the labor does. Now watch what they can run.',
  },
];

// ── Stage geometry ───────────────────────────────────────────────────────────

const W = 560;
const H = 260;
const CX = W / 2;
const CY = H / 2 - 8;
const RX = 205;
const RY = 88;

/** Ring layout: the account sits on the left, protocols spread around it. */
function ringPositions(nodes: NodeId[]): Record<string, { x: number; y: number }> {
  const out: Record<string, { x: number; y: number }> = {};
  nodes.forEach((id, i) => {
    const a = Math.PI + (2 * Math.PI * i) / nodes.length;
    out[id] = { x: CX + RX * Math.cos(a), y: CY + RY * Math.sin(a) };
  });
  return out;
}

/** Curved path between two nodes, bowed away from the ring center. */
function edgePath(a: { x: number; y: number }, b: { x: number; y: number }): string {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = mx - CX;
  const dy = my - CY;
  const len = Math.max(Math.hypot(dx, dy), 1);
  const push = 30;
  return `M ${a.x} ${a.y} Q ${mx + (dx / len) * push} ${my + (dy / len) * push} ${b.x} ${b.y}`;
}

/** A small orbit around one node, used when a step stays on the same protocol. */
function orbitPath(p: { x: number; y: number }): string {
  return `M ${p.x} ${p.y - 30} a 30 30 0 1 1 -0.01 0`;
}

// ── Screen ───────────────────────────────────────────────────────────────────

export function AgentStudioFilm() {
  const [phase, setPhase] = useState<'opening' | 'story' | 'playing' | 'end'>('opening');
  const [sc, setSc]       = useState(0);
  const [si, setSi]       = useState(0);
  // step -1 is the scene title card; 0..n-1 animate the flow; n is the hold.
  const [step, setStep]   = useState(-1);

  const strat = STRATEGIES[si];

  useEffect(() => {
    let delay: number;
    if (phase === 'opening') delay = OPENING_MS;
    else if (phase === 'story') delay = STORY_MS;
    else if (phase === 'end') delay = END_MS;
    else if (step === -1) delay = SCENE_TITLE_MS;
    else if (step < strat.steps.length) delay = STEP_MS;
    else delay = SCENE_HOLD_MS;

    const t = setTimeout(() => {
      if (phase === 'opening') { setSc(0); setPhase('story'); }
      else if (phase === 'story') {
        if (sc < STORY.length - 1) setSc(sc + 1);
        else { setSi(0); setStep(-1); setPhase('playing'); }
      }
      else if (phase === 'end') setPhase('opening');
      else if (step < strat.steps.length) setStep(s => s + 1);
      else if (si < STRATEGIES.length - 1) { setSi(si + 1); setStep(-1); }
      else setPhase('end');
    }, delay);
    return () => clearTimeout(t);
  }, [phase, sc, si, step, strat.steps.length]);

  const skip = () => {
    if (phase === 'opening') { setSc(0); setPhase('story'); }
    else if (phase === 'story') {
      if (sc < STORY.length - 1) setSc(sc + 1);
      else { setSi(0); setStep(-1); setPhase('playing'); }
    }
    else if (phase === 'end') setPhase('opening');
    else if (si < STRATEGIES.length - 1) { setSi(si + 1); setStep(-1); }
    else setPhase('end');
  };

  const overall = phase === 'opening' || phase === 'story' ? 0
    : phase === 'end' ? 100
    : (si + Math.max(0, Math.min(step / strat.steps.length, 1))) / STRATEGIES.length * 100;

  // Stage data for the current scene
  const ringNodes: NodeId[] = ['account', ...strat.legs];
  const pos = ringPositions(ringNodes);
  const stepIdx = Math.min(Math.max(step, 0), strat.steps.length - 1);
  const cur = strat.steps[stepIdx];
  const fromId: NodeId = stepIdx === 0 ? 'account' : strat.steps[stepIdx - 1].leg;
  const toId: NodeId = cur.leg;
  const activePath = fromId === toId ? orbitPath(pos[toId]) : edgePath(pos[fromId], pos[toId]);
  const activeColor = NODE_META[toId].color;
  const visited = new Set<NodeId>(['account', ...strat.steps.slice(0, Math.max(step, 0) + 1).map(s => s.leg)]);
  const showStage = phase === 'playing' && step >= 0;
  const holding = step >= strat.steps.length;

  // All faint background edges for the scene, so the whole route is visible.
  const faintEdges: string[] = [];
  const seen = new Set<string>();
  strat.steps.forEach((s, i) => {
    const a: NodeId = i === 0 ? 'account' : strat.steps[i - 1].leg;
    const b: NodeId = s.leg;
    const key = `${a}-${b}`;
    if (a !== b && !seen.has(key)) { seen.add(key); faintEdges.push(edgePath(pos[a], pos[b])); }
  });

  return (
    <Screen gap={12} style={{ maxWidth: 660, margin: '0 auto', userSelect: 'none' }}>
      <style>{`
        @keyframes asFadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes asFade   { from { opacity: 0; } to { opacity: 1; } }
        @keyframes asGlow   { 0%, 100% { box-shadow: 0 12px 40px rgba(82,227,164,0.25); } 50% { box-shadow: 0 12px 60px rgba(82,227,164,0.55); } }
        @keyframes asPulse  { 0%, 100% { transform: translate(-50%, -50%) scale(1); } 50% { transform: translate(-50%, -50%) scale(1.12); } }
        @keyframes asDash   { to { stroke-dashoffset: -14; } }
      `}</style>

      {/* Player chrome */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: btb.green, boxShadow: `0 0 8px ${btb.green}` }}/>
          <span style={{ color: btb.textMuted, fontSize: 11.5, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase' }}>Agent Studio</span>
        </span>
        <div style={{ flex: 1 }}/>
        <Badge color="#FFB36B" bg="rgba(255,179,107,0.12)" border="1px solid rgba(255,179,107,0.35)">Preview</Badge>
      </div>

      {/* Film frame */}
      <div onClick={skip} style={{ cursor: 'pointer' }}>
        <Glass padding={0} radius={22} style={{ minHeight: 470, display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 22 }}>

            {phase === 'opening' && (
              <div key="opening" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 14, animation: 'asFade 0.8s ease both' }}>
                <div style={{ color: btb.textDim, fontSize: 12, fontWeight: 800, letterSpacing: 3, textTransform: 'uppercase', animation: 'asFadeUp 0.7s ease both' }}>
                  BTB Finance presents
                </div>
                <div style={{ color: btb.text, fontSize: 42, fontWeight: 800, letterSpacing: -1, lineHeight: 1.05, animation: 'asFadeUp 0.7s 0.25s ease both' }}>
                  Agent Life
                </div>
                <div style={{ color: btb.textMuted, fontSize: 14.5, lineHeight: 1.6, maxWidth: 400, animation: 'asFadeUp 0.7s 0.5s ease both' }}>
                  Rent an agent to manage everything for you. Your rules on chain, their labor around the clock.
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', animation: 'asFadeUp 0.7s 0.75s ease both' }}>
                  {(Object.keys(CATALOG) as LegId[]).map(id => (
                    <Badge key={id} size="sm" color={btb.textMuted}>{CATALOG[id].name}</Badge>
                  ))}
                </div>
              </div>
            )}

            {phase === 'story' && (
              <div key={`story-${sc}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 16 }}>
                <div style={{
                  width: 58, height: 58, borderRadius: 18, background: 'rgba(82,227,164,0.12)',
                  border: '1px solid rgba(82,227,164,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  animation: 'asFadeUp 0.6s ease both',
                }}>
                  <Icon name={STORY[sc].icon} size={26} color={btb.green}/>
                </div>
                <div style={{ color: btb.text, fontSize: 32, fontWeight: 800, letterSpacing: -0.6, lineHeight: 1.1, animation: 'asFadeUp 0.6s 0.15s ease both' }}>
                  {STORY[sc].title}
                </div>
                <div style={{ color: btb.textMuted, fontSize: 15, lineHeight: 1.65, maxWidth: 440, animation: 'asFadeUp 0.6s 0.3s ease both' }}>
                  {STORY[sc].body}
                </div>
                <div style={{ display: 'flex', gap: 6, animation: 'asFadeUp 0.6s 0.45s ease both' }}>
                  {STORY.map((_, i) => (
                    <span key={i} style={{
                      width: i === sc ? 18 : 6, height: 6, borderRadius: 999,
                      background: i === sc ? btb.green : 'rgba(255,255,255,0.15)',
                      transition: 'width 0.3s',
                    }}/>
                  ))}
                </div>
              </div>
            )}

            {phase === 'playing' && step === -1 && (
              <div key={`title-${si}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 14 }}>
                <div style={{ color: btb.textDim, fontSize: 12, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', animation: 'asFadeUp 0.6s ease both' }}>
                  Strategy {si + 1} of {STRATEGIES.length}
                </div>
                <div style={{ color: btb.text, fontSize: 34, fontWeight: 800, letterSpacing: -0.7, lineHeight: 1.1, animation: 'asFadeUp 0.6s 0.15s ease both' }}>
                  {strat.name}
                </div>
                <div style={{ color: btb.textMuted, fontSize: 15, lineHeight: 1.55, maxWidth: 420, animation: 'asFadeUp 0.6s 0.3s ease both' }}>
                  {strat.tagline}
                </div>
                <div style={{ display: 'flex', gap: 8, animation: 'asFadeUp 0.6s 0.45s ease both' }}>
                  {strat.legs.map(id => (
                    <span key={id} style={{
                      width: 34, height: 34, borderRadius: 11,
                      background: `${CATALOG[id].color}2E`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icon name={CATALOG[id].icon} size={17} color={CATALOG[id].color}/>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {showStage && (
              <div key={`scene-${si}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', animation: 'asFade 0.5s ease both' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ color: btb.text, fontSize: 18, fontWeight: 800, letterSpacing: -0.4 }}>{strat.name}</div>
                  <div style={{ color: btb.textDim, fontSize: 11.5, fontWeight: 700 }}>
                    {holding ? 'on autopilot' : `step ${stepIdx + 1} of ${strat.steps.length}`}
                  </div>
                </div>

                {/* The stage */}
                <div style={{ position: 'relative', width: '100%', maxWidth: W, margin: '0 auto', aspectRatio: `${W}/${H}` }}>
                  <svg viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>
                    {/* Route skeleton */}
                    {faintEdges.map((d, i) => (
                      <path key={i} d={d} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth={1.5}/>
                    ))}
                    {/* Active flow */}
                    {!holding && (
                      <g key={`flow-${si}-${stepIdx}`}>
                        <path d={activePath} fill="none" stroke={activeColor} strokeWidth={2}
                          strokeDasharray="4 10" strokeLinecap="round" opacity={0.9}
                          style={{ animation: 'asDash 0.5s linear infinite' }}/>
                        {[0, 1, 2].map(n => (
                          <circle key={n} r={4} fill={btb.green}>
                            <animateMotion dur="1.2s" begin={`${-n * 0.4}s`} repeatCount="indefinite" path={activePath}/>
                          </circle>
                        ))}
                      </g>
                    )}
                  </svg>

                  {/* Nodes */}
                  {ringNodes.map(id => {
                    const p = pos[id];
                    const meta = NODE_META[id];
                    const isActive = !holding && id === toId;
                    const lit = holding || visited.has(id);
                    return (
                      <div key={id} style={{
                        position: 'absolute', left: `${(p.x / W) * 100}%`, top: `${(p.y / H) * 100}%`,
                        transform: 'translate(-50%, -50%)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                        opacity: lit ? 1 : 0.3, transition: 'opacity 0.4s',
                        animation: isActive ? 'asPulse 0.9s ease-in-out infinite' : undefined,
                      }}>
                        <span style={{
                          width: 44, height: 44, borderRadius: 15,
                          background: `${meta.color}2E`,
                          border: `1.5px solid ${isActive ? meta.color : 'rgba(255,255,255,0.12)'}`,
                          boxShadow: isActive ? `0 0 22px ${meta.color}66` : undefined,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'border 0.3s, box-shadow 0.3s',
                        }}>
                          <Icon name={meta.icon} size={19} color={meta.color}/>
                        </span>
                        <span style={{ color: lit ? btb.textMuted : btb.textDim, fontSize: 10.5, fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {meta.name}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Caption */}
                <div style={{ minHeight: 62, textAlign: 'center', marginTop: 4 }}>
                  {holding ? (
                    <div key="hold" style={{ animation: 'asFadeUp 0.4s ease both' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: btb.green, fontSize: 14, fontWeight: 800 }}>
                        <Icon name="check" size={15} color={btb.green}/>
                        Running on autopilot inside your rules
                      </div>
                    </div>
                  ) : (
                    <div key={`cap-${si}-${stepIdx}`} style={{ animation: 'asFadeUp 0.4s ease both' }}>
                      <div style={{ color: btb.text, fontSize: 14.5, fontWeight: 700, lineHeight: 1.45 }}>{cur.text}</div>
                      <div style={{ color: btb.green, fontFamily: 'monospace', fontSize: 11.5, marginTop: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {cur.code}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {phase === 'end' && (
              <div key="end" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 16 }}>
                <div style={{
                  width: 64, height: 64, borderRadius: 20, background: btb.gradGreen,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  animation: 'asFadeUp 0.7s ease both, asGlow 2.4s ease-in-out infinite',
                }}>
                  <Icon name="rocket" size={30} color="#fff"/>
                </div>
                <div style={{ color: btb.text, fontSize: 40, fontWeight: 800, letterSpacing: -0.8, lineHeight: 1.05, animation: 'asFadeUp 0.7s 0.2s ease both' }}>
                  Coming soon
                </div>
                <div style={{ color: btb.textMuted, fontSize: 14.5, lineHeight: 1.65, maxWidth: 420, animation: 'asFadeUp 0.7s 0.4s ease both' }}>
                  Rent an agent, a pro, or your own bot to run all of it. No fat fees, no lockups,
                  rules only you can change. Agent life on BTB Finance.
                </div>
              </div>
            )}
          </div>

          {/* Timeline */}
          <div style={{ padding: '0 24px 18px' }}>
            <div style={{ height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${overall}%`, background: btb.gradGreen, transition: 'width 0.7s ease' }}/>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
              <span style={{ color: btb.textDim, fontSize: 11 }}>
                {phase === 'playing' ? `${si + 1} / ${STRATEGIES.length}` : phase === 'end' ? 'The end' : phase === 'story' ? 'Why it matters' : 'Now playing'}
              </span>
              <span style={{ color: btb.textDim, fontSize: 11 }}>
                Every action runs inside owner signed limits
              </span>
            </div>
          </div>
        </Glass>
      </div>
    </Screen>
  );
}
