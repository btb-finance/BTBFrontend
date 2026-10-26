/**
 * The BTB manual. Plain data so the Docs screen, search and deep links all
 * read one source. Keep numbers here in sync with the code they describe:
 * check-in XP (convex/users.ts), Simulate XP (SIMULATE_XP), swap fee
 * (BTB_SWAP_FEE_BPS), supported chains and DEXes (protocols/lpChains.ts).
 */
import { CONTRACTS } from '../../lib/contractAddresses';
import type { Asset } from '../docs/palette';
import { V6, V6_REGISTRY, REBALANCE_AGENT, CHECK_BTB, REBALANCE_USD, rebalanceBtb } from '../../../convex/autoRebalanceConfig';

/** One amount on a flow card: `out` leaves the place (red, minus), `in` arrives (green, plus); `asset` colours it (palette.ts). */
export interface FlowLine { amount?: string; tone?: 'out' | 'in'; text: string; asset?: Asset }
/** A box in a flow: where (YOUR WALLET), what happens there (Deposit), and the amounts. */
export interface FlowCard { where: string; action: string; lines: FlowLine[] }
/**
 * A transaction drawn as a flow, in the style of Arcadia's Txn flow: where tokens come from on the left, what BTB
 * builds for you to sign in the middle, where they end up on the right, with a Table view of the same steps and an
 * optional before and after. Amounts are an example, labelled as one.
 */
export interface DocFlow {
  title: string;
  from: FlowCard[];
  via: { where: string; steps: { action: string; text: string }[] };
  to: FlowCard[];
  /** Before and after, e.g. ['Debt', '0', '0.5']. */
  impact?: { title: string; rows: [string, string, string][] };
  note?: string;
}

/** `diagram`: a drawn map (src/components/docs); its `text` is what search reads, it is not shown. */
export interface DocBlock { type: 'p' | 'steps' | 'list' | 'table' | 'note' | 'flow' | 'diagram'; text?: string; items?: string[]; rows?: string[][]; head?: string[]; flow?: DocFlow; diagram?: 'value' }

/** Every word in a flow, for search. */
export function flowText(f: DocFlow): string[] {
  const card = (c: FlowCard) => [c.where, c.action, ...c.lines.map((l) => `${l.amount ?? ''} ${l.text}`)];
  return [f.title, ...f.from.flatMap(card), f.via.where, ...f.via.steps.flatMap((x) => [x.action, x.text]), ...f.to.flatMap(card), f.note ?? '', ...(f.impact?.rows.flat() ?? [])];
}
export interface DocSection { id: string; title: string; summary: string; blocks: DocBlock[] }
export interface DocGroup { title: string; sections: DocSection[] }

export const DOCS: DocGroup[] = [
  {
    title: 'Start here',
    sections: [
      {
        id: 'overview', title: 'What BTB Finance is', summary: 'One app for the whole LP loop: find a pool, simulate it, add the position, manage it, and get paid for using the app.',
        blocks: [
          { type: 'p', text: 'BTB Finance is a liquidity provider app. Everything an LP does in a week happens in one place: discover pools with real volume, simulate a range before committing, add the position with one confirmation, claim fees, stake into gauges, rebalance out of range, and remove when done.' },
          { type: 'p', text: 'The tools are free with no plan and no wallet limit. BTB shares 100% of its revenue, the token fees (the OPOS transfer tax), with the people who use it, every Friday, in BTB.' },
          { type: 'table', head: ['Tab', 'What it does'], rows: [
            ['Dashboard', 'Daily check-in, streak, XP and the weekly BTB payout.'],
            ['Discover', 'Pools ranked by APR, TVL and volume across supported chains, with your own holdings first.'],
            ['Simulate', 'Fee, impermanent loss and range analysis for any pair on any supported chain.'],
            ['Portfolio', 'Every token and LP position you hold, with claim, stake, rebalance and remove.'],
            ['Swap', 'Best price across DEXes on 17 chains, plus bridging between them.'],
          ] },
        ],
      },
      {
        id: 'value-flows', title: 'How value flows', summary: 'Where your tokens go, what you earn, and how the Friday payout is funded.',
        blocks: [
          { type: 'p', text: 'One map of the whole loop. Your liquidity always sits in the DEX pool or your own auto wallet; BTB builds the transactions and never holds your positions. What BTB earns, it pays back to the people using it every Friday.' },
          { type: 'diagram', diagram: 'value', text: 'You add liquidity into DEX pools and earn swap fees. Positions you move into your auto wallet are rebalanced by the BTB agent. Swaps and bridges route through KyberSwap and LI.FI with a 1% swap fee to the treasury. BTB token fees go to the treasury, are turned into BTB and split by your weekly points into the Friday pot. Your BTB balance pays for the agent, alerts and auto-rebalance.' },
          { type: 'note', text: 'Green lines carry LP positions, blue lines trading fees, gold lines BTB. A dashed line is a signal, not a transfer: your points set your share of the pot, and the agent acts on positions in your auto wallet without taking them.' },
        ],
      },
      {
        id: 'getting-started', title: 'Getting started', summary: 'Connect, or just paste an address to look around.',
        blocks: [
          { type: 'steps', items: [
            'Open Connect Wallet and pick Browser Wallet (MetaMask, Rabby, Brave, OKX), Coinbase Wallet, WalletConnect or Rainbow.',
            'No wallet handy? Paste any address in the Connect sheet to watch it read-only.',
            'Check in on the Dashboard once a day. That is your XP streak and it counts toward Friday.',
            'Go to Discover and tap Simulate or Add LP on any pool that shows the button.',
          ] },
          { type: 'note', text: 'BTB never asks for a signature or transaction to browse. The only signatures are the ones you approve for swaps, LP actions, staking and wallet linking.' },
        ],
      },
      {
        id: 'chains-dexes', title: 'Supported chains and DEXes', summary: 'Where you can add and manage positions from inside the app.',
        blocks: [
          { type: 'table', head: ['Chain', 'DEXes with full LP management'], rows: [
            ['Ethereum', 'Uniswap V3, Uniswap V4, PancakeSwap V3, SushiSwap V3'],
            ['Base', 'Uniswap V3, Uniswap V4, PancakeSwap V3, Aerodrome Slipstream (with gauge staking)'],
            ['BNB Chain', 'Uniswap V3, Uniswap V4, PancakeSwap V3'],
            ['Robinhood Chain', 'Uniswap V3, Uniswap V4, PancakeSwap V3, SushiSwap V3, Giga V3 (MasterChef staking), Ramses V3, UP (gauge staking), Alandale (Algebra, LUTE rewards without staking)'],
            ['Arc', 'Uniswap V3, Uniswap V4, Aerodrome Slipstream. Gas is USDC.'],
          ] },
          { type: 'p', text: 'Discover and Simulate cover more chains than that (Arbitrum, Optimism, Polygon, Avalanche, Linea, Unichain, Berachain, HyperEVM, Monad, MegaETH, Plasma, Ronin and others). On those, pools are Simulate only and the row says so.' },
          { type: 'p', text: 'Full-range V2 pools (Uniswap V2, Aerodrome AMM, Velodrome AMM) are not listed. BTB is a concentrated liquidity app.' },
        ],
      },
    ],
  },
  {
    title: 'Find and simulate',
    sections: [
      {
        id: 'discover', title: 'Discover', summary: 'Pools with real volume, ranked, filtered, and led by what you already hold.',
        blocks: [
          { type: 'p', text: 'Discover reads a snapshot refreshed every 30 minutes that merges DeFiLlama yields with DexScreener and GeckoTerminal registries, so new DEXes appear without a code change. Each chain carries its top venues by 24h volume.' },
          { type: 'list', items: [
            'For you: pools containing tokens in your wallet come first, per chain.',
            'Sort by APR, TVL or 24h volume. The headline APR is quoted for a 5% wide range, not full range, so it is comparable across pools.',
            'Filter by chain and by DEX. Uniswap V3 and V4 are separate chips because they are different products.',
            'Add LP appears on every row the app can mint on; Simulate appears on every row with token addresses.',
            'Rows with a live Merkl campaign show the extra reward APR in purple under the fee APR, with the reward token. Those rewards are claimed from Portfolio.',
            'Every chain and pair has a real URL (for example /discover/base), so pages can be bookmarked and shared.',
          ] },
        ],
      },
      {
        id: 'simulate', title: 'Simulate', summary: 'Know what a range earns before you deposit.',
        blocks: [
          { type: 'p', text: 'Pick two tokens on a chain (or arrive from Discover) and Simulate probes every supported DEX and fee tier on-chain, then ranks the pools it finds. Open one for the full simulator.' },
          { type: 'list', items: [
            'Position summary: deposit size, range as prices, share of in-range liquidity, estimated fees and APR.',
            'The verdict first: whether expected fees cover the expected impermanent loss over your horizon, time in range, chance of profit, fee APR against incentives, and whether the pool\'s volume looks real.',
            'Historical replay on the pool\'s own price history: days in range, fees earned, net versus holding.',
            'Liquidity depth: where other LPs sit. Drag the range lines directly on the chart.',
            'Fees, then What if the price moves (scenario bands, a price slider, where the result comes from, and the comparison with just holding), then price risk and time in range by period.',
            'Deploy: the same range goes straight into the Add liquidity sheet.',
          ] },
          { type: 'p', text: 'Cross-chain research runs one pair across several chains at once and ranks the winners by volume, TVL or APR, with Add LP on any row the app can mint on.' },
          { type: 'note', text: 'Simulate pays XP: 100 for the first pool you check each day and 100 per chain in a cross-chain research run, up to 500 XP a day in all.' },
        ],
      },
    ],
  },
  {
    title: 'Add and manage liquidity',
    sections: [
      {
        id: 'add-liquidity', title: 'Add liquidity', summary: 'Any range, one confirmation, with the simulator beside the form.',
        blocks: [
          { type: 'steps', items: [
            'Pick the fee tier. Tiers are read from the DEX; the deepest existing pool is preselected.',
            'Choose a range: presets around the live price, custom prices, or a smart fit that matches what your wallet holds.',
            'Enter one amount. The other side is computed from the live tick; if the range is entirely above or below price only one token is needed and the app says so.',
            'Optional: Split range mints two one-sided positions either side of the price; Swap and add balances your tokens first.',
            'Confirm. Approvals and the mint are batched when your wallet supports it; otherwise they run in order.',
          ] },
          { type: 'flow', flow: {
            title: 'Add liquidity with exact amounts',
            from: [{ where: 'Your wallet', action: 'Deposit', lines: [{ amount: '- 0.50', tone: 'out', text: 'WETH', asset: 'token' }, { amount: '- 1,250', tone: 'out', text: 'USDC', asset: 'token' }] }],
            via: { where: 'BTB builds, you sign', steps: [
              { action: 'Approve', text: 'Each token once. Skipped when the DEX already has your approval.' },
              { action: 'Mint', text: 'The DEX opens the position at your range, with slippage minimums (0.5% by default).' },
              { action: 'Stake (optional)', text: 'On Aerodrome, UP and Giga the new position can go straight into the gauge or MasterChef.' },
            ] },
            to: [{ where: 'Your wallet', action: 'Receive', lines: [{ amount: '+ 1', tone: 'in', text: 'WETH/USDC position NFT at your range', asset: 'lp' }, { text: 'Anything that did not fit the range stays in your wallet.' }] }],
            note: 'Example amounts on a WETH/USDC pool. Batched into one confirmation when your wallet supports it; otherwise the approvals run first, then the mint.',
          } },
          { type: 'flow', flow: {
            title: 'Swap to fit, or pay with another token',
            from: [{ where: 'Your wallet', action: 'Put in', lines: [{ amount: '- 1.00', tone: 'out', text: 'WETH, all of it', asset: 'token' }] }],
            via: { where: 'BTB builds, you sign', steps: [
              { action: 'Swap', text: 'KyberSwap sells part of it (here about 0.48 WETH for about 1,190 USDC) so both sides fit the range. 1% BTB fee on the swap.' },
              { action: 'Mint', text: 'What the swap returned and the rest of your WETH go into the position.' },
            ] },
            to: [{ where: 'Your wallet', action: 'Receive', lines: [{ amount: '+ 1', tone: 'in', text: 'WETH/USDC position NFT, nothing left over', asset: 'lp' }] }],
            note: 'Example amounts. Two confirmations: the swap, then the add. Paying with a third token (Pay with another token) swaps it into both pool tokens first.',
          } },
          { type: 'flow', flow: {
            title: 'Add liquidity on Metric',
            from: [{ where: 'Your wallet', action: 'Deposit', lines: [{ amount: '- 0.004', tone: 'out', text: 'WETH (or ETH)', asset: 'token' }, { amount: '- 10', tone: 'out', text: 'USDG', asset: 'token' }] }],
            via: { where: "Metric's liquidity adder", steps: [
              { action: 'Spread', text: 'Equal value across the bins of the range you picked, around the oracle price.' },
              { action: 'Guard', text: 'Will not go through if the pool price moves more than 0.5% before it lands. Unused ETH is refunded.' },
            ] },
            to: [{ where: 'Your Metric position', action: 'Hold', lines: [{ amount: '+ shares', tone: 'in', asset: 'lp', text: 'in each bin. The range follows the oracle price; earnings compound inside, nothing to claim.' }] }],
            note: 'Example amounts on a Metric WETH/USDG pool. Withdraw from Portfolio sends the tokens, earnings included, straight back to your wallet.',
          } },
          { type: 'p', text: 'The live tick matters. The sheet re-reads the pool price every 12 seconds while open and once more right before you sign, so the amounts and slippage minimums match the chain at that moment. Tick spacing is read from the pool itself, which is what makes minting on forks such as Aerodrome, Ramses and UP reliable.' },
          { type: 'p', text: 'On desktop the full simulator sits to the left of the form and follows your range and amount. Drag on its depth chart to move the range.' },
          { type: 'list', items: [
            'Slippage protection defaults to 0.5% (chain dependent) and is adjustable in the deposit bar.',
            'ETH or WETH: pay with either on V3 pools. Uniswap V4 takes native ETH and refunds anything unused.',
            'Stake toggle: on Aerodrome, UP and Giga pools the new position can go straight into the gauge or MasterChef in the same flow.',
          ] },
        ],
      },
      {
        id: 'manage', title: 'Manage positions', summary: 'Claim, stake, unstake, remove and rebalance from Portfolio.',
        blocks: [
          { type: 'p', text: 'Portfolio lists every position across supported chains, staked or not, using Krystal as the index and the chain as the source of truth for amounts, fees and range. Out-of-range positions are listed first under a Needs attention line with the value sitting idle. Each in-range card shows a live fee APR: the pool\'s 24h fees times your share of its in-range liquidity, annualised.' },
          { type: 'table', head: ['Action', 'What happens'], rows: [
            ['Claim', 'Collects uncollected swap fees to your wallet. On staked positions it claims the gauge or MasterChef rewards instead.'],
            ['Compound', 'Collects the fees, swaps only what the range needs, and adds them back to the same position. Two or three confirmations, no new NFT.'],
            ['Stake', 'Approves and deposits the position NFT into the DEX gauge (Aerodrome, UP) or MasterChef (Giga) to earn emissions.'],
            ['Unstake', 'Withdraws the NFT back to your wallet, paying out earned rewards.'],
            ['Remove', 'Burns liquidity and collects fees in one transaction, slippage protected.'],
            ['Rebalance', 'Shows what comes out and suggests a range of the same width that fits those tokens with no swap; unstakes if needed, withdraws, then opens the Add liquidity sheet on that range (or any other). Restake is a toggle.'],
          ] },
          { type: 'list', items: [
            'The range strip on each card shows the pool\'s liquidity depth behind your range (tall bars are where other LPs sit), the live price marker, and under it the last seven days as two-hour blocks, green while the range was earning, read from the pool\'s own swap events. "Earning 62% of 7d" is the share of the week the position actually collected fees.',
            'Tags: tap + tag on a card to label a position (Hedge, Farm, Test). Stored per wallet.',
            'Gas awareness: each card with fees shows the estimated gas to collect and warns when the fees are worth less than the gas.',
            'History: where no provider indexes the chain (Robinhood), deposits, withdrawals and fees claimed are read from the position manager\'s events, so Invested, PnL, versus HODL and age still show. Figures priced at today\'s rate say so.',
            'Closed LP history lists finished positions with what was deposited, withdrawn and earned.',
            'Merkl rewards: incentives third parties pay to LPs in campaign pools (Aerodrome stock pairs on Base, Robinhood equity pairs, Arc launch pools). Portfolio lists what your wallet can claim per chain with one Claim button; nothing to stake or register.',
          ] },
          { type: 'flow', flow: {
            title: 'Rebalance a position that left its range',
            from: [{ where: 'Your position', action: 'Out of range', lines: [{ amount: '- 0.60', tone: 'out', text: 'WETH', asset: 'lp' }, { amount: '- 900', tone: 'out', text: 'USDC, plus its unclaimed fees', asset: 'lp' }] }],
            via: { where: 'BTB builds, you sign', steps: [
              { action: 'Unstake', text: 'Only when it was staked in a gauge or MasterChef.' },
              { action: 'Remove', text: 'Takes the liquidity and the fees out to your wallet, slippage protected.' },
              { action: 'Add', text: 'Opens Add liquidity on a range of the same width that fits those tokens with no swap, or any range you choose.' },
            ] },
            to: [{ where: 'Your wallet', action: 'Receive', lines: [{ amount: '+ 1', tone: 'in', text: 'new position NFT, earning again', asset: 'lp' }, { text: 'The old NFT stays in your wallet, empty. Restake is a toggle.' }] }],
            note: 'Example amounts.',
          } },
          { type: 'note', text: 'Every write is verified after confirmation by re-reading the chain (owner, liquidity, fees). If an RPC lags, the app tells you to retry instead of showing a stale state.' },
        ],
      },
      {
        id: 'auto-rebalance', title: 'Auto-rebalance', summary: 'Your position moves back into range by itself, from your own wallet.',
        blocks: [
          { type: 'p', text: 'Turn on Auto-rebalance when adding liquidity, or on any position on Base or Robinhood Chain. The position moves into your auto wallet, a smart account only you own, and the BTB agent checks it on a schedule you pick. When the price leaves the range, the agent moves it back.' },
          { type: 'flow', flow: {
            title: 'What happens when the price leaves your range',
            from: [
              { where: 'Your auto wallet', action: 'Holds', lines: [{ amount: '1', text: 'position NFT, now out of range', asset: 'lp' }] },
              { where: 'Your BTB balance', action: 'Pays', lines: [{ amount: `- ${CHECK_BTB}`, tone: 'out', text: `BTB per check`, asset: 'btb' }, { amount: `- ${rebalanceBtb(8453).toLocaleString('en-US')}`, tone: 'out', text: `BTB per rebalance on Base ($${REBALANCE_USD[8453].toFixed(2)})`, asset: 'btb' }] },
            ],
            via: { where: 'The BTB agent', steps: [
              { action: 'Check', text: 'Reads the position every hour by default; you pick 5 minutes to 1 day.' },
              { action: 'Guard', text: "Compares the price with the pool's recent average first, so a pushed price cannot trigger a move." },
              { action: 'Rebalance', text: 'Unstakes if staked, takes the liquidity out, swaps only what the new range needs, and opens a new range around the current price, restaked.' },
            ] },
            to: [{ where: 'Your auto wallet', action: 'Holds', lines: [{ amount: '+ 1', tone: 'in', text: 'new position NFT, in range and earning', asset: 'lp' }, { amount: '+ 100', tone: 'in', text: 'XP for the week', asset: 'points' }] }],
            note: `A rebalance costs ${rebalanceBtb(8453).toLocaleString('en-US')} BTB on Base and ${rebalanceBtb(4663).toLocaleString('en-US')} BTB on Robinhood Chain, charged only when one happens. Take the position out at any time: it goes straight back to your wallet.`,
          } },
          { type: 'list', items: [
            'Only you control the auto wallet. The agent can rebalance and compound the positions in it, nothing else, and only through contracts on the BTB registry.',
            'Fees in range can be compounded the same way, only once they are worth five times what compounding costs.',
            'With nothing left in your BTB balance (or unclaimed weekly rewards) the position pauses until you top up. It stays where it is.',
          ] },
        ],
      },
      {
        id: 'alerts', title: 'Range alerts', summary: 'A push when a position leaves or re-enters its range. For wallets holding 10,000 BTB.',
        blocks: [
          { type: 'p', text: 'Tap Alert me on any LP card and sign in once with your wallet. Every hour (or every five minutes with fast checks) BTB re-reads that position on-chain; when it crosses out of range, or comes back, you get a line under the bell in the app and a push notification on devices that support it.' },
          { type: 'list', items: [
            'Requires 10,000 BTB in the connected wallet, checked on-chain when you subscribe and again every hour.',
            'Each check costs 1 BTB per position, from your BTB balance in the app and then your unclaimed weekly rewards. With nothing left to pay with, alerts pause until you top up.',
            'Only the wallet itself can turn its alerts on or off, add a device for push, or rename a position: each needs its signed sign-in.',
            'Push works in Safari, Chrome and Firefox on desktop and Android. On iPhone, add BTB to your home screen first (Share, then Add to Home Screen); iOS only delivers push to installed web apps.',
            'Wallet in-app browsers (Trust Wallet, SafePal, TokenPocket and similar) cannot receive push. Alerts still land under the bell, so open the app to see them.',
            'Alerts switch off by themselves when the position is closed or the wallet drops below the threshold.',
          ] },
        ],
      },
      {
        id: 'staking', title: 'Gauge and MasterChef staking', summary: 'Emissions on top of fees, managed in place.',
        blocks: [
          { type: 'list', items: [
            'Aerodrome (Base): ve(3,3) gauges paying AERO. Staked positions still show in Portfolio with earned AERO and full management.',
            'UP (Robinhood Chain): same gauge model paying UP.',
            'Giga (Robinhood Chain): MasterChef V3 paying GIGA. The NFT is transferred to the chef; harvest, withdraw and pending rewards are all in the app.',
            'Ramses V3 (Robinhood Chain): positions are supported; gauge staking is not wired yet.',
            'Alandale (Robinhood Chain): Algebra pools with a dynamic fee. There is no staking: an in-range position earns LUTE, claimed with a signature Alandale issues for the wallet holding it. On auto-rebalanced positions the agent claims it every few hours and sends it to you.',
          ] },
          { type: 'p', text: 'While staked you cannot collect swap fees separately on gauge DEXes; the gauge pays emissions instead. Unstake to rebalance or remove; Rebalance does that step for you.' },
        ],
      },
    ],
  },
  {
    title: 'Swap, earn, account',
    sections: [
      {
        id: 'swap', title: 'Swap and bridge', summary: 'Best price on 17 chains, one tap, and cross-chain transfers.',
        blocks: [
          { type: 'p', text: 'Swap routes through KyberSwap across every DEX on the chosen chain. Pick any token you hold on any chain and the app switches network for you. Rate, route, price impact and the BTB fee are folded into a details box.' },
          { type: 'flow', flow: {
            title: 'Swap',
            from: [{ where: 'Your wallet', action: 'Pay', lines: [{ amount: '- 1.00', tone: 'out', text: 'ETH', asset: 'token' }] }],
            via: { where: 'KyberSwap, built by BTB', steps: [
              { action: 'Route', text: 'Best price across every DEX on the network.' },
              { action: 'Fee', text: '1% of the token you receive goes to BTB, shown before you confirm.' },
              { action: 'Slippage', text: 'Auto by default: 0.5%, raised with the price impact up to 5%. Set your own under the gear.' },
            ] },
            to: [{ where: 'Your wallet', action: 'Receive', lines: [{ amount: '+ 2,450', tone: 'in', text: 'USDC, after the fee', asset: 'token' }] }],
            note: 'Example amounts. Picking a token you hold on another network moves the swap there.',
          } },
          { type: 'flow', flow: {
            title: 'Bridge',
            from: [{ where: 'Your wallet on Base', action: 'Pay', lines: [{ amount: '- 100', tone: 'out', text: 'USDC', asset: 'token' }] }],
            via: { where: 'LI.FI, built by BTB', steps: [
              { action: 'Route', text: 'Picks the fastest bridge between the two networks.' },
              { action: 'Fees', text: 'Route fees come out of the amount and are shown before you confirm.' },
            ] },
            to: [{ where: 'Your wallet on Arbitrum', action: 'Receive', lines: [{ amount: '+ 99.8', tone: 'in', text: 'USDC, in seconds to a few minutes', asset: 'token' }, { text: 'No gas needed on the destination.' }] }],
            note: 'Example amounts.',
          } },
          { type: 'list', items: [
            'Fee: 1% of the swap, shown before you confirm.',
            'Slippage: Auto, 0.5%, 1%, 3% or your own, under the gear on the swap card.',
            'Bridge uses LI.FI. Source and destination chain pickers list the four LP chains first.',
          ] },
        ],
      },
      {
        id: 'rewards', title: 'Rewards: check-in, XP, Friday BTB', summary: 'Use the app, get paid.',
        blocks: [
          { type: 'p', text: 'How you earn every week, in short: use BTB Finance, collect points, and every Friday you get a share of what the app earned that week, paid in BTB.' },
          { type: 'list', items: [
            'Use the app. Check in once a day, simulate a pool, swap, add liquidity, let auto-rebalance work, invite friends. Each of these gives you points (XP) for the current week.',
            'Points add up until Friday 00:00 UTC. The Dashboard shows a live countdown to the flip, your points so far and your estimated payout.',
            'At the flip, the week\'s pot is split by points. Your share is your points divided by everyone\'s points. With 2% of the week\'s points you get 2% of the pot.',
            'Claim it. Send it to your wallet with no gas (from 5,000 BTB), or add any amount to your BTB balance to pay for alerts, the agent and auto-rebalance. Do it before the next Friday: an untouched share goes back into the pot.',
          ] },
          { type: 'p', text: 'Where the pot comes from: BTB shares 100% of its revenue with the people who use it. That revenue is the token fees (the OPOS transfer tax), turned into BTB and paid out every Friday. Nothing to buy and nothing to stake: holding BTB only adds bonus points at check-in.' },
          { type: 'flow', flow: {
            title: 'How the Friday payout reaches you',
            from: [
              { where: 'BTB token fees', action: 'Collected all week', lines: [{ text: "The week's token fees: 100% of BTB's revenue.", asset: 'btb' }] },
              { where: 'You', action: 'Earn points', lines: [{ amount: '+ XP', tone: 'in', text: 'check-ins, swaps, simulations, LP, auto-rebalance, invites', asset: 'points' }] },
            ],
            via: { where: 'Friday 00:00 UTC', steps: [
              { action: 'Convert', text: 'The fees are turned into BTB: that is the pot.' },
              { action: 'Split', text: "By points: with 2% of the week's points you get 2% of the pot." },
            ] },
            to: [{ where: 'Your share', action: 'Claim', lines: [{ amount: '+ BTB', tone: 'in', text: 'to your wallet with no gas (from 5,000 BTB), or any amount to your BTB balance', asset: 'btb' }, { text: 'Untouched by the next Friday, it goes back into the pot.' }] }],
          } },
          { type: 'p', text: 'Every action credits XP to the current week. Weeks run Friday 00:00 UTC to Friday 00:00 UTC. On Friday the week\'s revenue is split across everyone in proportion to the XP they earned that week and paid in BTB.' },
          { type: 'p', text: 'Claim your share to your wallet with no gas from 5,000 BTB, or add any amount to your BTB balance in the app, where it pays for alerts, the agent and auto-rebalance. A share left untouched by the next Friday goes back into the pot.' },
          { type: 'table', head: ['Action', 'XP'], rows: [
            ['Daily check-in', '10 on day one, +2 per consecutive day, capped at 50. Every 7-day streak adds a bonus (+50, then +100, and so on, up to +700 on day 98; from day 100 on it stays at +700 every 7th day).'],
            ['Hold BTB', '1 extra XP per 100 BTB at each daily check-in, counting the lower of your balance then and at your previous check-in, up to 10,000 XP a day.'],
            ['Simulate a pool', '100, first pool of the day'],
            ['Cross-chain research', '100 per chain, once a day; Simulate XP tops out at 500 a day in all'],
            ['Swap in the app', '100 per day'],
            ['Stake, supply or LP', '10 per day'],
            ['Mint a BTB Bear', '1000 per Bear'],
            ['Auto-rebalance', '100 for every rebalance the BTB agent does on your position'],
            ['Invite a friend', '10% of every point they earn, on top (they lose nothing). Share your link from the dashboard; a new wallet that opens it is linked to you as soon as it connects.'],
          ] },
          { type: 'p', text: 'Social and content quests (posts, threads, videos) pay more and are reviewed by hand. Lifetime XP is kept as a counter; only the current week\'s XP is used for the payout.' },
        ],
      },
      {
        id: 'agent', title: 'The BTB Agent', summary: 'Ask in plain words; it reads Discover, your portfolio and the simulator.',
        blocks: [
          { type: 'p', text: 'The Agent tab is a chat that can search every pool the app indexes across all supported chains, read your balances and LP positions, and estimate earnings for a deposit and range. Ask things like "best ETH / stablecoin pools across all chains", "where should I put my USDC on Base", or "what would 2,000 USD earn in that pool with a 5% range for 30 days".' },
          { type: 'list', items: [
            'It understands token families: ETH covers WETH and staked ETH; stable covers USDC, USDT, USDG, mUSDC, USDe, DAI, USDS, GHO and similar; BTC covers WBTC, cbBTC, tBTC, LBTC, cirBTC.',
            'Every number comes from the same data Discover and Simulate use. It does not invent pools or APRs.',
            'Five free messages a day for everyone, then 1 BTB per message from your BTB balance. Unclaimed weekly rewards are used automatically when the balance runs out.',
            'It only talks about liquidity providing and the app.',
          ] },
        ],
      },
      {
        id: 'profiles', title: 'Wallets and profiles', summary: 'All your wallets under one login.',
        blocks: [
          { type: 'p', text: 'A profile is a set of wallets. Connect with any one of them and all of them appear as tabs on Portfolio and in the account menu. Tap one to view its balances and positions; the connected wallet keeps transactions.' },
          { type: 'list', items: [
            'Import by address: paste any address, add a label, sign once with the connected wallet. View only.',
            'Link by signing: sign with the new wallet and once more with the current one. That wallet then opens the profile too.',
            'Remove a wallet with one signature. Imported wallets never count as ownership, so they can still start their own profile.',
          ] },
        ],
      },
      {
        id: 'safe', title: 'Safe and smart accounts', summary: 'Use BTB from a Safe.',
        blocks: [
          { type: 'p', text: 'BTB is a Safe App. In Safe, open Apps, Add custom app, paste https://btb.finance, and the app connects to the Safe automatically. Batched approvals and mints use EIP-5792 when the wallet supports it.' },
        ],
      },
      {
        id: 'fees-security', title: 'Fees and security', summary: 'What you pay, what we hold.',
        blocks: [
          { type: 'list', items: [
            'LP tools (Discover, Simulate, Add, Manage): free.',
            'Swap: 1% fee to BTB. Bridging: LI.FI route fees only.',
            'Gas is always yours; slippage protection is on every LP write.',
            'BTB holds no funds and no keys. Positions stay in your wallet or the DEX gauge; the app only builds transactions you sign.',
            'The frontend and contracts are open source at github.com/btb-finance. No third-party audit of the frontend yet.',
          ] },
        ],
      },
      {
        // Read from the same constants the app uses, so this list can never drift from what the app calls.
        id: 'contracts', title: 'Contract addresses', summary: 'Every BTB contract and wallet, to verify on a block explorer.',
        blocks: [
          { type: 'p', text: 'Tokens and products on Ethereum mainnet.' },
          { type: 'table', head: ['Contract', 'Address'], rows: [
            ['BTB token', CONTRACTS.BTB],
            ['BTBB (BTB Bear)', CONTRACTS.BTBB],
            ['Bear NFT', CONTRACTS.BEAR_NFT],
            ['Bear NFT staking', CONTRACTS.BEAR_STAKING],
            ['OPOS', CONTRACTS.OPOS],
            ['Flip', CONTRACTS.FLIP],
          ] },
          { type: 'p', text: 'Auto-rebalance (V6). The same addresses on Base and Robinhood Chain.' },
          { type: 'table', head: ['Contract', 'Address'], rows: [
            ['Registry', V6_REGISTRY],
            ['Wallet factory', V6.factory],
            ['Wallet starter (used by the factory)', V6.walletStarter],
            ['Wallet factory (first, still holds earlier wallets)', V6.factoryV1],
            ['Wallet (current, v4)', V6.walletV4],
            ['Wallet (v3)', V6.walletV3],
            ['Wallet (v2)', V6.walletV2],
            ['Wallet (v1)', V6.walletV1],
            ['Uniswap V3 adapter', V6.uniswapV3Adapter],
            ['Aerodrome adapter', V6.aerodromeAdapter],
            ['MasterChef V3 farm adapter', V6.farmAdapter],
            ['Alandale (Algebra) adapter, Robinhood Chain only', V6.algebraAdapter],
            ['Swap adapter', V6.swapAdapter],
            ['Aerodrome gauge verifier', V6.gaugeVerifier],
            ['Agent batch (EIP-7702)', V6.agentBatch],
            ['Rebalance agent', REBALANCE_AGENT],
          ] },
          { type: 'p', text: 'Weekly rewards. The wallet that sends everyone their Friday BTB, on Ethereum.' },
          { type: 'table', head: ['Contract', 'Address'], rows: [
            ['Weekly rewards payout wallet', '0x1Ee9d27A62427a4a1c88518E34d04AAdD52a2C7a'],
          ] },
          { type: 'note', text: 'Only trust these addresses. BTB never asks you to approve or send to any other contract.' },
        ],
      },
    ],
  },
];

export const FAQS: { q: string; a: string }[] = [
  { q: 'Why is there no Add LP button on a pool?', a: 'Either the chain is Simulate only (Arbitrum, Optimism and the rest), the DEX is not one the app can mint on, or the row could be a V2 pool. The four LP chains and the DEX list above are the rule.' },
  { q: 'My mint reverted with a slippage error.', a: 'The price moved between quote and confirmation. The sheet now re-reads the pool right before signing; if it still reverts, raise slippage in the deposit bar or narrow the range less aggressively.' },
  { q: 'My staked Aerodrome position does not show.', a: 'Staked positions come from the gauge, not your wallet, and load after the wallet scan. Give it a few seconds; if it stays missing, the RPC is behind and a refresh fixes it.' },
  { q: 'Is BTB free forever?', a: 'The LP tools are free and there is no plan to add a subscription. Revenue is the token fees (the OPOS transfer tax), and 100% of it is shared back with users every Friday.' },
  { q: 'Which wallet should I use?', a: 'Browser Wallet works with whatever extension you have (MetaMask, Rabby, Brave, OKX). WalletConnect and Coinbase Wallet work on mobile. Safe works as a Safe App.' },
  { q: 'Where does the price data come from?', a: 'Pool state (price, tick, liquidity, fees) is read from the chain through a pool of public RPCs with failover. Volume and TVL come from DeFiLlama, DexScreener, GeckoTerminal and DexPaprika. Token prices come from DexScreener and DeFiLlama.' },
];

export const LINKS: { icon: string; label: string; sub: string; href: string }[] = [
  { icon: 'discord', label: 'Discord',     sub: 'Help and announcements',   href: 'https://discord.gg/bqFEPA56Tc' },
  { icon: 'twitter', label: 'X / Twitter', sub: '@BTB_Finance',             href: 'https://x.com/BTB_Finance' },
  { icon: 'github',  label: 'GitHub',      sub: 'Open source app and contracts', href: 'https://github.com/btb-finance' },
  { icon: 'mail',    label: 'Support',     sub: 'hello@btb.finance',        href: 'mailto:hello@btb.finance' },
];
