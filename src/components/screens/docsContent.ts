/**
 * The BTB manual. Plain data so the Docs screen, search and deep links all
 * read one source. Keep numbers here in sync with the code they describe:
 * check-in XP (convex/users.ts), Simulate XP (SIMULATE_XP), swap fee
 * (BTB_SWAP_FEE_BPS), supported chains and DEXes (protocols/lpChains.ts).
 */
export interface DocBlock { type: 'p' | 'steps' | 'list' | 'table' | 'note'; text?: string; items?: string[]; rows?: string[][]; head?: string[] }
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
          { type: 'p', text: 'The tools are free with no plan and no wallet limit. BTB earns a 1% fee on swaps routed through the app and pays that revenue back to the people who use it, every Friday, in BTB.' },
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
            ['Robinhood Chain', 'Uniswap V3, Uniswap V4, PancakeSwap V3, SushiSwap V3, Giga V3 (MasterChef staking), Ramses V3, UP (gauge staking)'],
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
            '30-day backtest on the pool\'s own price history: fees earned, impermanent loss, net versus holding.',
            'Liquidity depth: where other LPs sit. Drag the range lines directly on the chart.',
            'Fee, IL, PnL waterfall, comparison against holding, risk radar, sensitivity to a price move, scenarios and timeline.',
            'Deploy: the same range goes straight into the Add liquidity sheet.',
          ] },
          { type: 'p', text: 'Cross-chain research runs one pair across several chains at once and ranks the winners by volume, TVL or APR, with Add LP on any row the app can mint on.' },
          { type: 'note', text: 'Simulate pays XP: 100 for the first pool you check each day and 100 per chain in a cross-chain research run, once a day.' },
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
            'Tags: tap + tag on a card to label a position (Hedge, Farm, Test). Stored per wallet.',
            'Gas awareness: each card with fees shows the estimated gas to collect and warns when the fees are worth less than the gas.',
            'History: where no provider indexes the chain (Robinhood), deposits, withdrawals and fees claimed are read from the position manager\'s events, so Invested, PnL, versus HODL and age still show. Figures priced at today\'s rate say so.',
            'Closed LP history lists finished positions with what was deposited, withdrawn and earned.',
            'Merkl rewards: incentives third parties pay to LPs in campaign pools (Aerodrome stock pairs on Base, Robinhood equity pairs, Arc launch pools). Portfolio lists what your wallet can claim per chain with one Claim button; nothing to stake or register.',
          ] },
          { type: 'note', text: 'Every write is verified after confirmation by re-reading the chain (owner, liquidity, fees). If an RPC lags, the app tells you to retry instead of showing a stale state.' },
        ],
      },
      {
        id: 'alerts', title: 'Range alerts', summary: 'A push when a position leaves or re-enters its range. For wallets holding 10,000 BTB.',
        blocks: [
          { type: 'p', text: 'Tap Alert me on any LP card. Every five minutes BTB re-reads that position on-chain; when it crosses out of range, or comes back, you get a line under the bell in the app and a push notification on devices that support it.' },
          { type: 'list', items: [
            'Requires 10,000 BTB in the connected wallet, checked on-chain when you subscribe and again every hour. Each position is an RPC read every five minutes, so the gate keeps the service sustainable.',
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
          { type: 'list', items: [
            'Fee: 1% of the swap, shown before you confirm. This is BTB\'s only revenue and it funds the Friday payout.',
            'Slippage is set from the header and applies per swap.',
            'Bridge uses LI.FI. Source and destination chain pickers list the four LP chains first.',
          ] },
        ],
      },
      {
        id: 'rewards', title: 'Rewards: check-in, XP, Friday BTB', summary: 'Use the app, get paid.',
        blocks: [
          { type: 'p', text: 'Every action credits XP to the current week. Weeks run Friday 00:00 UTC to Friday 00:00 UTC. On Friday the week\'s revenue is split across everyone in proportion to the XP they earned that week and paid in BTB. Nothing to buy, nothing to stake.' },
          { type: 'table', head: ['Action', 'XP'], rows: [
            ['Daily check-in', '10 on day one, +2 per consecutive day, capped at 50. Every 7-day streak adds a bonus (+50, then +100, and so on).'],
            ['Simulate a pool', '100, first pool of the day'],
            ['Cross-chain research', '100 per chain, once a day'],
            ['Swap in the app', '100 per day'],
            ['Stake, supply or LP', '10 per day'],
            ['Mint a BTB Bear', '1000 per Bear'],
          ] },
          { type: 'p', text: 'Social and content quests (posts, threads, videos) pay more and are reviewed by hand. Lifetime XP is kept as a counter; only the current week\'s XP is used for the payout.' },
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
    ],
  },
];

export const FAQS: { q: string; a: string }[] = [
  { q: 'Why is there no Add LP button on a pool?', a: 'Either the chain is Simulate only (Arbitrum, Optimism and the rest), the DEX is not one the app can mint on, or the row could be a V2 pool. The four LP chains and the DEX list above are the rule.' },
  { q: 'My mint reverted with a slippage error.', a: 'The price moved between quote and confirmation. The sheet now re-reads the pool right before signing; if it still reverts, raise slippage in the deposit bar or narrow the range less aggressively.' },
  { q: 'My staked Aerodrome position does not show.', a: 'Staked positions come from the gauge, not your wallet, and load after the wallet scan. Give it a few seconds; if it stays missing, the RPC is behind and a refresh fixes it.' },
  { q: 'Is BTB free forever?', a: 'The LP tools are free and there is no plan to add a subscription. Revenue is the 1% swap fee, which is shared back with users every Friday.' },
  { q: 'Which wallet should I use?', a: 'Browser Wallet works with whatever extension you have (MetaMask, Rabby, Brave, OKX). WalletConnect and Coinbase Wallet work on mobile. Safe works as a Safe App.' },
  { q: 'Where does the price data come from?', a: 'Pool state (price, tick, liquidity, fees) is read from the chain through a pool of public RPCs with failover. Volume and TVL come from DeFiLlama, DexScreener, GeckoTerminal and DexPaprika. Token prices come from DexScreener and DeFiLlama.' },
];

export const LINKS: { icon: string; label: string; sub: string; href: string }[] = [
  { icon: 'discord', label: 'Discord',     sub: 'Help and announcements',   href: 'https://discord.gg/bqFEPA56Tc' },
  { icon: 'twitter', label: 'X / Twitter', sub: '@BTB_Finance',             href: 'https://x.com/BTB_Finance' },
  { icon: 'github',  label: 'GitHub',      sub: 'Open source app and contracts', href: 'https://github.com/btb-finance' },
  { icon: 'mail',    label: 'Support',     sub: 'hello@btb.finance',        href: 'mailto:hello@btb.finance' },
];
