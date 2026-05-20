'use client';
import { Glass } from '../Glass';
import { Icon } from '../Icon';
import { btb } from '../design-tokens';

// ─── Mock data ────────────────────────────────────────────────────────────────

export type ProtocolCategory = 'lending' | 'dexs' | 'perps' | 'bridge' | 'vaults' | 'launchpad' | 'insurance' | 'liquid-staking' | 'liquid-restaking' | 'rwa' | 'cdp' | 'options';

export interface ProtocolInfo {
  id: string;
  name: string;
  category: ProtocolCategory;
  logo: string;          // emoji fallback until real logos added
  description: string;
  website: string;
  chains: string[];
  stats: { label: string; value: string }[];
  tags: string[];
}

const PROTOCOLS: ProtocolInfo[] = [
  // ── Lending ────────────────────────────────────────────────────────────────
  {
    id: 'aave', name: 'Aave', category: 'lending', logo: '👻',
    description: 'The leading decentralised non-custodial liquidity protocol where users can participate as suppliers or borrowers.',
    website: 'https://app.aave.com', chains: ['Ethereum', 'Arbitrum', 'Polygon', 'Base', 'Optimism'],
    stats: [{ label: 'TVL', value: '$12.4B' }, { label: 'Supply APY (USDC)', value: '4.2%' }, { label: 'Borrow APY (ETH)', value: '3.1%' }, { label: 'Markets', value: '14' }],
    tags: ['Lending', 'Live'],
  },
  {
    id: 'morpho', name: 'Morpho', category: 'lending', logo: '🦋',
    description: 'Morpho optimises lending rates by matching suppliers and borrowers peer-to-peer on top of Aave and Compound.',
    website: 'https://app.morpho.org', chains: ['Ethereum', 'Base'],
    stats: [{ label: 'TVL', value: '$3.1B' }, { label: 'Supply APY (USDC)', value: '5.8%' }, { label: 'Borrow APY (ETH)', value: '2.9%' }, { label: 'Markets', value: '6' }],
    tags: ['Lending', 'Live'],
  },
  {
    id: 'spark', name: 'Spark', category: 'lending', logo: '✨',
    description: 'Spark is MakerDAO\'s native lending product offering DAI and sDAI yield with tight Maker integration.',
    website: 'https://app.spark.fi', chains: ['Ethereum', 'Gnosis'],
    stats: [{ label: 'TVL', value: '$2.8B' }, { label: 'DAI Supply APY', value: '5.0%' }, { label: 'Borrow APY (ETH)', value: '3.5%' }, { label: 'Markets', value: '4' }],
    tags: ['Lending', 'Live'],
  },
  {
    id: 'euler', name: 'Euler', category: 'lending', logo: '🌀',
    description: 'Permissionless lending markets with reactive interest rates and advanced risk management.',
    website: 'https://app.euler.finance', chains: ['Ethereum', 'Arbitrum'],
    stats: [{ label: 'TVL', value: '$380M' }, { label: 'Supply APY (USDC)', value: '6.1%' }, { label: 'Borrow APY (ETH)', value: '4.2%' }, { label: 'Markets', value: '20+' }],
    tags: ['Lending', 'Live'],
  },
  {
    id: 'fluid', name: 'Fluid', category: 'lending', logo: '💧',
    description: 'Fluid by Instadapp unifies lending and DEX liquidity to minimise liquidation risk.',
    website: 'https://fluid.instadapp.io', chains: ['Ethereum', 'Arbitrum'],
    stats: [{ label: 'TVL', value: '$1.2B' }, { label: 'Supply APY (USDC)', value: '5.5%' }, { label: 'Borrow APY (ETH)', value: '3.8%' }, { label: 'Markets', value: '8' }],
    tags: ['Lending', 'Live'],
  },
  {
    id: 'compound', name: 'Compound', category: 'lending', logo: '🏦',
    description: 'Compound is an algorithmic, autonomous interest rate protocol for DeFi.',
    website: 'https://app.compound.finance', chains: ['Ethereum', 'Arbitrum', 'Base', 'Polygon'],
    stats: [{ label: 'TVL', value: '$2.2B' }, { label: 'Supply APY (USDC)', value: '3.9%' }, { label: 'Borrow APY (ETH)', value: '2.7%' }, { label: 'Markets', value: '10' }],
    tags: ['Lending', 'Live'],
  },

  // ── DEXs ───────────────────────────────────────────────────────────────────
  {
    id: 'uniswap', name: 'Uniswap', category: 'dexs', logo: '🦄',
    description: 'The largest decentralised exchange with concentrated liquidity and permissionless pool creation.',
    website: 'https://app.uniswap.org', chains: ['Ethereum', 'Arbitrum', 'Polygon', 'Base', 'Optimism', 'BNB'],
    stats: [{ label: 'TVL', value: '$6.8B' }, { label: '24h Volume', value: '$1.4B' }, { label: 'Fee Tier', value: '0.01–1%' }, { label: 'Pools', value: '100k+' }],
    tags: ['DEX', 'Live'],
  },
  {
    id: 'aerodrome', name: 'Aerodrome', category: 'dexs', logo: '✈️',
    description: 'Aerodrome is the central liquidity hub on Base, forked from Velodrome with ve(3,3) tokenomics.',
    website: 'https://aerodrome.finance', chains: ['Base'],
    stats: [{ label: 'TVL', value: '$1.1B' }, { label: '24h Volume', value: '$180M' }, { label: 'Fee', value: '0.01–0.3%' }, { label: 'Pools', value: '5,000+' }],
    tags: ['DEX', 'Live'],
  },
  {
    id: 'curve', name: 'Curve', category: 'dexs', logo: '〰️',
    description: 'Curve specialises in low-slippage stablecoin and pegged-asset swaps with deep liquidity.',
    website: 'https://curve.fi', chains: ['Ethereum', 'Arbitrum', 'Polygon', 'Optimism', 'Base'],
    stats: [{ label: 'TVL', value: '$2.3B' }, { label: '24h Volume', value: '$220M' }, { label: 'Fee', value: '0.04%' }, { label: 'Pools', value: '500+' }],
    tags: ['DEX', 'Stableswap', 'Live'],
  },
  {
    id: 'balancer', name: 'Balancer', category: 'dexs', logo: '⚖️',
    description: 'Balancer is an automated portfolio manager and trading platform with multi-token weighted pools.',
    website: 'https://balancer.fi', chains: ['Ethereum', 'Arbitrum', 'Polygon', 'Base'],
    stats: [{ label: 'TVL', value: '$900M' }, { label: '24h Volume', value: '$95M' }, { label: 'Fee', value: '0.01–10%' }, { label: 'Pools', value: '2,000+' }],
    tags: ['DEX', 'Live'],
  },
  {
    id: 'sushiswap', name: 'SushiSwap', category: 'dexs', logo: '🍣',
    description: 'SushiSwap is a community-owned DEX with cross-chain swaps, lending, and yield farming.',
    website: 'https://app.sushi.com', chains: ['Ethereum', 'Arbitrum', 'Polygon', 'BNB', 'Avalanche'],
    stats: [{ label: 'TVL', value: '$350M' }, { label: '24h Volume', value: '$60M' }, { label: 'Fee', value: '0.3%' }, { label: 'Pools', value: '1,200+' }],
    tags: ['DEX', 'Live'],
  },

  // ── Perps ──────────────────────────────────────────────────────────────────
  {
    id: 'gmx', name: 'GMX', category: 'perps', logo: '🔵',
    description: 'GMX is a decentralised spot and perpetual exchange with up to 100× leverage and zero-price-impact trades.',
    website: 'https://app.gmx.io', chains: ['Arbitrum', 'Avalanche'],
    stats: [{ label: 'TVL', value: '$680M' }, { label: 'Open Interest', value: '$420M' }, { label: 'Max Leverage', value: '100×' }, { label: '24h Volume', value: '$340M' }],
    tags: ['Perps', 'Live'],
  },
  {
    id: 'dydx', name: 'dYdX', category: 'perps', logo: '🔷',
    description: 'dYdX is the leading decentralised perpetuals exchange built on its own Cosmos-based chain.',
    website: 'https://dydx.exchange', chains: ['dYdX Chain'],
    stats: [{ label: 'TVL', value: '$510M' }, { label: 'Open Interest', value: '$650M' }, { label: 'Max Leverage', value: '20×' }, { label: '24h Volume', value: '$800M' }],
    tags: ['Perps', 'Live'],
  },
  {
    id: 'hyperliquid', name: 'Hyperliquid', category: 'perps', logo: '⚡',
    description: 'Hyperliquid is a high-performance L1 DEX with fully on-chain order books and sub-second finality.',
    website: 'https://app.hyperliquid.xyz', chains: ['Hyperliquid L1'],
    stats: [{ label: 'TVL', value: '$1.8B' }, { label: 'Open Interest', value: '$2.1B' }, { label: 'Max Leverage', value: '50×' }, { label: '24h Volume', value: '$3B' }],
    tags: ['Perps', 'Live'],
  },
  {
    id: 'synthetix', name: 'Synthetix', category: 'perps', logo: '💠',
    description: 'Synthetix provides liquidity infrastructure for decentralised derivatives on Optimism.',
    website: 'https://synthetix.io', chains: ['Optimism', 'Base'],
    stats: [{ label: 'TVL', value: '$290M' }, { label: 'Open Interest', value: '$180M' }, { label: 'Max Leverage', value: '25×' }, { label: '24h Volume', value: '$120M' }],
    tags: ['Perps', 'Live'],
  },
  {
    id: 'drift', name: 'Drift', category: 'perps', logo: '🌊',
    description: 'Drift is the largest perpetuals DEX on Solana with dynamic AMM and cross-margin.',
    website: 'https://drift.trade', chains: ['Solana'],
    stats: [{ label: 'TVL', value: '$310M' }, { label: 'Open Interest', value: '$220M' }, { label: 'Max Leverage', value: '20×' }, { label: '24h Volume', value: '$200M' }],
    tags: ['Perps', 'Live'],
  },
  {
    id: 'gains-network', name: 'Gains Network', category: 'perps', logo: '📈',
    description: 'gTrade by Gains Network offers synthetic leverage trading on crypto, forex, and stocks.',
    website: 'https://gains.trade', chains: ['Arbitrum', 'Polygon'],
    stats: [{ label: 'TVL', value: '$68M' }, { label: 'Open Interest', value: '$90M' }, { label: 'Max Leverage', value: '150×' }, { label: '24h Volume', value: '$80M' }],
    tags: ['Perps', 'Live'],
  },
  {
    id: 'vertex', name: 'Vertex', category: 'perps', logo: '🔺',
    description: 'Vertex is a cross-margined DEX on Arbitrum combining spot, perps, and money markets.',
    website: 'https://app.vertexprotocol.com', chains: ['Arbitrum', 'Blast', 'Mantle'],
    stats: [{ label: 'TVL', value: '$82M' }, { label: 'Open Interest', value: '$110M' }, { label: 'Max Leverage', value: '20×' }, { label: '24h Volume', value: '$150M' }],
    tags: ['Perps', 'Live'],
  },
  {
    id: 'perpetual-protocol', name: 'Perp Protocol', category: 'perps', logo: '♾️',
    description: 'Perpetual Protocol is a vAMM-based decentralised perpetuals exchange on Optimism.',
    website: 'https://app.perp.com', chains: ['Optimism'],
    stats: [{ label: 'TVL', value: '$18M' }, { label: 'Open Interest', value: '$22M' }, { label: 'Max Leverage', value: '10×' }, { label: '24h Volume', value: '$25M' }],
    tags: ['Perps', 'Live'],
  },

  // ── Bridge ─────────────────────────────────────────────────────────────────
  {
    id: 'stargate', name: 'Stargate', category: 'bridge', logo: '🌉',
    description: 'Stargate is a composable native asset bridge built on LayerZero with unified liquidity pools.',
    website: 'https://stargate.finance', chains: ['Ethereum', 'Arbitrum', 'Polygon', 'Base', 'Optimism', 'BNB', 'Avalanche'],
    stats: [{ label: 'TVL', value: '$420M' }, { label: '24h Volume', value: '$55M' }, { label: 'Supported Chains', value: '15' }, { label: 'Avg. Time', value: '< 20s' }],
    tags: ['Bridge', 'Live'],
  },
  {
    id: 'across', name: 'Across', category: 'bridge', logo: '🔀',
    description: 'Across uses an optimistic oracle and relayer network to offer the fastest and cheapest cross-chain bridge.',
    website: 'https://across.to', chains: ['Ethereum', 'Arbitrum', 'Optimism', 'Base', 'Polygon'],
    stats: [{ label: 'TVL', value: '$135M' }, { label: '24h Volume', value: '$40M' }, { label: 'Supported Chains', value: '10' }, { label: 'Avg. Time', value: '< 5s' }],
    tags: ['Bridge', 'Live'],
  },
  {
    id: 'hop', name: 'Hop', category: 'bridge', logo: '🐇',
    description: 'Hop enables fast and trustless token transfers across rollups using bonders and AMMs.',
    website: 'https://hop.exchange', chains: ['Ethereum', 'Arbitrum', 'Optimism', 'Polygon', 'Gnosis'],
    stats: [{ label: 'TVL', value: '$58M' }, { label: '24h Volume', value: '$12M' }, { label: 'Supported Chains', value: '6' }, { label: 'Avg. Time', value: '< 2min' }],
    tags: ['Bridge', 'Live'],
  },
  {
    id: 'connext', name: 'Connext', category: 'bridge', logo: '🔗',
    description: 'Connext is a modular interoperability protocol for passing data and assets between chains.',
    website: 'https://connext.network', chains: ['Ethereum', 'Arbitrum', 'Optimism', 'Polygon', 'BNB', 'Gnosis'],
    stats: [{ label: 'TVL', value: '$34M' }, { label: '24h Volume', value: '$8M' }, { label: 'Supported Chains', value: '12' }, { label: 'Avg. Time', value: '< 3min' }],
    tags: ['Bridge', 'Live'],
  },
  {
    id: 'synapse', name: 'Synapse', category: 'bridge', logo: '🧬',
    description: 'Synapse is a cross-chain messaging and bridging protocol with native stablecoin support.',
    website: 'https://bridge.synapseprotocol.com', chains: ['Ethereum', 'Arbitrum', 'Optimism', 'BNB', 'Avalanche', 'Polygon'],
    stats: [{ label: 'TVL', value: '$96M' }, { label: '24h Volume', value: '$18M' }, { label: 'Supported Chains', value: '16' }, { label: 'Avg. Time', value: '< 1min' }],
    tags: ['Bridge', 'Live'],
  },
  {
    id: 'wormhole', name: 'Wormhole', category: 'bridge', logo: '🕳️',
    description: 'Wormhole is a generic message-passing protocol connecting 20+ blockchains.',
    website: 'https://wormhole.com', chains: ['Ethereum', 'Solana', 'BNB', 'Polygon', 'Avalanche', 'Arbitrum'],
    stats: [{ label: 'TVL', value: '$1.2B' }, { label: '24h Volume', value: '$120M' }, { label: 'Supported Chains', value: '20+' }, { label: 'Messages', value: '1B+' }],
    tags: ['Bridge', 'Messaging', 'Live'],
  },
  {
    id: 'layerzero', name: 'LayerZero', category: 'bridge', logo: '🔮',
    description: 'LayerZero is an omnichain interoperability protocol powering 50+ applications.',
    website: 'https://layerzero.network', chains: ['Ethereum', 'Arbitrum', 'Optimism', 'Polygon', 'BNB', 'Avalanche', 'Base'],
    stats: [{ label: 'TVL', value: '$2.4B' }, { label: '24h Volume', value: '$310M' }, { label: 'Supported Chains', value: '50+' }, { label: 'Messages', value: '500M+' }],
    tags: ['Bridge', 'Messaging', 'Live'],
  },
  {
    id: 'socket', name: 'Socket', category: 'bridge', logo: '🔌',
    description: 'Socket aggregates bridge routes to find the best path for cross-chain transfers.',
    website: 'https://www.bungee.exchange', chains: ['Ethereum', 'Arbitrum', 'Optimism', 'Polygon', 'BNB', 'Base'],
    stats: [{ label: 'TVL', value: '$22M' }, { label: '24h Volume', value: '$30M' }, { label: 'Supported Chains', value: '12' }, { label: 'Routes', value: '100+' }],
    tags: ['Bridge', 'Aggregator', 'Live'],
  },

  // ── Vaults ─────────────────────────────────────────────────────────────────
  {
    id: 'yearn', name: 'Yearn', category: 'vaults', logo: '🏦',
    description: 'Yearn is the OG yield aggregator, auto-compounding the best strategies across DeFi.',
    website: 'https://yearn.fi', chains: ['Ethereum', 'Arbitrum', 'Optimism', 'Base', 'Polygon'],
    stats: [{ label: 'TVL', value: '$480M' }, { label: 'Best APY', value: '18.4%' }, { label: 'Vaults', value: '90+' }, { label: 'Earned (all time)', value: '$200M+' }],
    tags: ['Vaults', 'Live'],
  },
  {
    id: 'beefy', name: 'Beefy', category: 'vaults', logo: '🐮',
    description: 'Beefy is a multi-chain yield optimiser that auto-compounds LP rewards across 20+ chains.',
    website: 'https://app.beefy.com', chains: ['BNB', 'Polygon', 'Arbitrum', 'Avalanche', 'Base', 'Optimism'],
    stats: [{ label: 'TVL', value: '$290M' }, { label: 'Best APY', value: '34.2%' }, { label: 'Vaults', value: '1,000+' }, { label: 'Chains', value: '20+' }],
    tags: ['Vaults', 'Live'],
  },
  {
    id: 'pendle', name: 'Pendle', category: 'vaults', logo: '⏳',
    description: 'Pendle lets you trade and hedge future yield by splitting yield-bearing tokens into principal and yield components.',
    website: 'https://app.pendle.finance', chains: ['Ethereum', 'Arbitrum', 'BNB', 'Base', 'Optimism'],
    stats: [{ label: 'TVL', value: '$3.2B' }, { label: 'Best Fixed APY', value: '12.6%' }, { label: 'Markets', value: '50+' }, { label: 'Implied APY', value: 'Up to 40%' }],
    tags: ['Vaults', 'Yield Trading', 'Live'],
  },
  {
    id: 'convex', name: 'Convex', category: 'vaults', logo: '🎯',
    description: 'Convex boosts Curve LP rewards by pooling veCRV power without locking tokens yourself.',
    website: 'https://www.convexfinance.com', chains: ['Ethereum'],
    stats: [{ label: 'TVL', value: '$1.9B' }, { label: 'Best APY', value: '22.3%' }, { label: 'Pools', value: '100+' }, { label: 'veCRV held', value: '48%' }],
    tags: ['Vaults', 'Live'],
  },
  {
    id: 'harvest', name: 'Harvest', category: 'vaults', logo: '🌾',
    description: 'Harvest Finance auto-compounds DeFi yields and distributes profits to FARM stakers.',
    website: 'https://app.harvest.finance', chains: ['Ethereum', 'BNB', 'Polygon', 'Arbitrum'],
    stats: [{ label: 'TVL', value: '$82M' }, { label: 'Best APY', value: '28.1%' }, { label: 'Vaults', value: '200+' }, { label: 'Profit Share', value: '30%' }],
    tags: ['Vaults', 'Live'],
  },
  {
    id: 'idle', name: 'Idle', category: 'vaults', logo: '🎪',
    description: 'Idle automatically rebalances between lending protocols to maximise yields on stablecoins.',
    website: 'https://app.idle.finance', chains: ['Ethereum', 'Polygon'],
    stats: [{ label: 'TVL', value: '$55M' }, { label: 'Best APY', value: '9.8%' }, { label: 'Strategies', value: '20+' }, { label: 'Protocols used', value: '6' }],
    tags: ['Vaults', 'Live'],
  },
  {
    id: 'kamino', name: 'Kamino', category: 'vaults', logo: '🌀',
    description: 'Kamino auto-manages concentrated liquidity positions on Solana for optimised LP returns.',
    website: 'https://app.kamino.finance', chains: ['Solana'],
    stats: [{ label: 'TVL', value: '$1.4B' }, { label: 'Best APY', value: '45.2%' }, { label: 'Strategies', value: '80+' }, { label: 'Rebalances/day', value: '1,000+' }],
    tags: ['Vaults', 'Live'],
  },

  // ── Launchpad ──────────────────────────────────────────────────────────────
  {
    id: 'fjord-foundry', name: 'Fjord Foundry', category: 'launchpad', logo: '🏔️',
    description: 'Fjord Foundry (formerly Copper Launch) runs Liquidity Bootstrapping Pools for fair token launches.',
    website: 'https://app.fjordfoundry.com', chains: ['Ethereum', 'Arbitrum', 'Base'],
    stats: [{ label: 'Total Raised', value: '$800M+' }, { label: 'Projects Launched', value: '200+' }, { label: 'Avg. LBP Duration', value: '72h' }, { label: 'Fee', value: '2%' }],
    tags: ['Launchpad', 'LBP', 'Live'],
  },
  {
    id: 'bounce-finance', name: 'Bounce Finance', category: 'launchpad', logo: '🏀',
    description: 'Bounce Finance is a decentralised auction-based launchpad for tokens, NFTs, and real-world assets.',
    website: 'https://app.bounce.finance', chains: ['Ethereum', 'BNB', 'Arbitrum'],
    stats: [{ label: 'Total Raised', value: '$200M+' }, { label: 'Projects Launched', value: '500+' }, { label: 'Auction Types', value: '8' }, { label: 'Fee', value: '1%' }],
    tags: ['Launchpad', 'Auction', 'Live'],
  },
  {
    id: 'gempad', name: 'Gempad', category: 'launchpad', logo: '💎',
    description: 'Gempad is a multi-chain launchpad offering fair launches, presales, and private rounds.',
    website: 'https://gempad.app', chains: ['Ethereum', 'BNB', 'Arbitrum', 'Polygon'],
    stats: [{ label: 'Total Raised', value: '$45M+' }, { label: 'Projects Launched', value: '150+' }, { label: 'Success Rate', value: '91%' }, { label: 'Fee', value: '2%' }],
    tags: ['Launchpad', 'Live'],
  },
  {
    id: 'pinksale', name: 'Pinksale', category: 'launchpad', logo: '🎀',
    description: 'Pinksale is the most widely used launchpad platform on BNB Chain and EVM networks.',
    website: 'https://www.pinksale.finance', chains: ['BNB', 'Ethereum', 'Polygon', 'Arbitrum', 'Avalanche'],
    stats: [{ label: 'Total Raised', value: '$1.8B+' }, { label: 'Projects Launched', value: '10,000+' }, { label: 'Chains', value: '15+' }, { label: 'Fee', value: '2%' }],
    tags: ['Launchpad', 'Live'],
  },
  {
    id: 'dxsale', name: 'DXSale', category: 'launchpad', logo: '📦',
    description: 'DXSale provides token presales, fair launches, and liquidity lockers across multiple chains.',
    website: 'https://www.dx.app', chains: ['Ethereum', 'BNB', 'Polygon'],
    stats: [{ label: 'Total Raised', value: '$300M+' }, { label: 'Projects Launched', value: '2,000+' }, { label: 'Locks Active', value: '5,000+' }, { label: 'Fee', value: '2%' }],
    tags: ['Launchpad', 'Live'],
  },

  // ── Insurance ──────────────────────────────────────────────────────────────
  {
    id: 'nexus-mutual', name: 'Nexus Mutual', category: 'insurance', logo: '🛡️',
    description: 'Nexus Mutual is a decentralised insurance alternative covering smart contract bugs, protocol hacks, and exchange failures.',
    website: 'https://app.nexusmutual.io', chains: ['Ethereum'],
    stats: [{ label: 'TVL', value: '$280M' }, { label: 'Active Cover', value: '$180M' }, { label: 'Claims Paid', value: '$18M+' }, { label: 'Avg. Premium', value: '2.6%/yr' }],
    tags: ['Insurance', 'Live'],
  },
  {
    id: 'insurace', name: 'InsurAce', category: 'insurance', logo: '⚓',
    description: 'InsurAce is a multi-chain DeFi insurance protocol offering low-premium cover across 140+ protocols.',
    website: 'https://app.insurace.io', chains: ['Ethereum', 'BNB', 'Polygon', 'Avalanche'],
    stats: [{ label: 'TVL', value: '$22M' }, { label: 'Active Cover', value: '$45M' }, { label: 'Claims Paid', value: '$12M+' }, { label: 'Avg. Premium', value: '1.4%/yr' }],
    tags: ['Insurance', 'Live'],
  },
  {
    id: 'unslashed', name: 'Unslashed', category: 'insurance', logo: '⚡',
    description: 'Unslashed Finance provides capital-efficient coverage for staking slashing, exchange hacks, and oracle failures.',
    website: 'https://www.unslashed.finance', chains: ['Ethereum'],
    stats: [{ label: 'TVL', value: '$15M' }, { label: 'Active Cover', value: '$30M' }, { label: 'Claims Paid', value: '$2M+' }, { label: 'Avg. Premium', value: '1.8%/yr' }],
    tags: ['Insurance', 'Live'],
  },
  {
    id: 'risk-harbor', name: 'Risk Harbor', category: 'insurance', logo: '⚓',
    description: 'Risk Harbor uses an automated, algorithmic claims assessment to provide transparent and instant DeFi cover.',
    website: 'https://riskharbor.com', chains: ['Ethereum', 'Arbitrum', 'Avalanche'],
    stats: [{ label: 'TVL', value: '$8M' }, { label: 'Active Cover', value: '$18M' }, { label: 'Claims Paid', value: '$1.5M+' }, { label: 'Avg. Premium', value: '0.4%/yr' }],
    tags: ['Insurance', 'Beta'],
  },
  {
    id: 'ease', name: 'Ease', category: 'insurance', logo: '🟢',
    description: 'Ease (formerly Armor Finance) offers uninsurance — protection that costs nothing upfront, funded by protocol rewards.',
    website: 'https://ease.org', chains: ['Ethereum'],
    stats: [{ label: 'TVL', value: '$10M' }, { label: 'Active Cover', value: '$22M' }, { label: 'Claims Paid', value: '$3M+' }, { label: 'Avg. Premium', value: '0%/yr' }],
    tags: ['Insurance', 'Live'],
  },

  // ── Liquid Staking ─────────────────────────────────────────────────────────
  {
    id: 'lido', name: 'Lido', category: 'liquid-staking', logo: '🌊',
    description: 'Lido is the largest liquid staking protocol, letting you stake ETH and receive stETH that earns rewards while remaining usable in DeFi.',
    website: 'https://stake.lido.fi', chains: ['Ethereum', 'Polygon'],
    stats: [{ label: 'TVL', value: '$23.4B' }, { label: 'Staking APR', value: '3.8%' }, { label: 'stETH Supply', value: '9.4M ETH' }, { label: 'Validators', value: '280k+' }],
    tags: ['Liquid Staking', 'Live'],
  },
  {
    id: 'rocket-pool', name: 'Rocket Pool', category: 'liquid-staking', logo: '🚀',
    description: 'Rocket Pool is a decentralised ETH staking protocol where anyone can run a node with just 8 ETH and earn boosted rewards.',
    website: 'https://rocketpool.net', chains: ['Ethereum'],
    stats: [{ label: 'TVL', value: '$3.2B' }, { label: 'Staking APR', value: '3.6%' }, { label: 'rETH Supply', value: '1.1M ETH' }, { label: 'Node Operators', value: '3,400+' }],
    tags: ['Liquid Staking', 'Live'],
  },
  {
    id: 'frax-eth', name: 'Frax ETH', category: 'liquid-staking', logo: '🔵',
    description: 'Frax ETH offers frxETH (liquid staking token) and sfrxETH (yield-bearing) with among the highest ETH staking APRs.',
    website: 'https://app.frax.finance/frxeth/mint', chains: ['Ethereum'],
    stats: [{ label: 'TVL', value: '$820M' }, { label: 'Staking APR', value: '4.2%' }, { label: 'frxETH Supply', value: '330k ETH' }, { label: 'Validators', value: '10k+' }],
    tags: ['Liquid Staking', 'Live'],
  },
  {
    id: 'stakewise', name: 'StakeWise', category: 'liquid-staking', logo: '🌿',
    description: 'StakeWise V3 introduces isolated staking vaults with customisable fee structures for node operators and stakers.',
    website: 'https://app.stakewise.io', chains: ['Ethereum'],
    stats: [{ label: 'TVL', value: '$480M' }, { label: 'Staking APR', value: '3.9%' }, { label: 'osETH Supply', value: '180k ETH' }, { label: 'Vaults', value: '80+' }],
    tags: ['Liquid Staking', 'Live'],
  },
  {
    id: 'mantle-lsd', name: 'mETH Protocol', category: 'liquid-staking', logo: '🏔️',
    description: 'mETH Protocol by Mantle is a non-custodial ETH liquid staking solution with deep integration into Mantle ecosystem.',
    website: 'https://meth.mantle.xyz', chains: ['Ethereum'],
    stats: [{ label: 'TVL', value: '$1.1B' }, { label: 'Staking APR', value: '3.7%' }, { label: 'mETH Supply', value: '420k ETH' }, { label: 'Validators', value: '14k+' }],
    tags: ['Liquid Staking', 'Live'],
  },

  // ── Liquid Restaking ───────────────────────────────────────────────────────
  {
    id: 'eigenlayer', name: 'EigenLayer', category: 'liquid-restaking', logo: '🔷',
    description: 'EigenLayer is the foundational restaking protocol on Ethereum, securing Actively Validated Services (AVSs) with restaked ETH.',
    website: 'https://app.eigenlayer.xyz', chains: ['Ethereum'],
    stats: [{ label: 'TVL', value: '$11.2B' }, { label: 'Restaked ETH', value: '4.2M ETH' }, { label: 'AVSs', value: '30+' }, { label: 'Operators', value: '200+' }],
    tags: ['Restaking', 'Live'],
  },
  {
    id: 'etherfi', name: 'Ether.fi', category: 'liquid-restaking', logo: '🐋',
    description: 'Ether.fi is the largest liquid restaking protocol where stakers retain their key ownership while earning EigenLayer points.',
    website: 'https://app.ether.fi', chains: ['Ethereum'],
    stats: [{ label: 'TVL', value: '$6.4B' }, { label: 'eETH Supply', value: '2.5M ETH' }, { label: 'APR', value: '4.8%' }, { label: 'Operators', value: '50+' }],
    tags: ['Liquid Restaking', 'Live'],
  },
  {
    id: 'renzo', name: 'Renzo', category: 'liquid-restaking', logo: '🟣',
    description: 'Renzo is a liquid restaking protocol that abstracts EigenLayer complexity and optimises AVS allocation for maximum yield.',
    website: 'https://app.renzoprotocol.com', chains: ['Ethereum', 'Arbitrum', 'Base'],
    stats: [{ label: 'TVL', value: '$1.8B' }, { label: 'ezETH Supply', value: '680k ETH' }, { label: 'APR', value: '4.5%' }, { label: 'AVSs', value: '15+' }],
    tags: ['Liquid Restaking', 'Live'],
  },
  {
    id: 'kelp', name: 'Kelp DAO', category: 'liquid-restaking', logo: '🌱',
    description: 'Kelp DAO offers rsETH, a liquid restaked token that accrues EigenLayer and AVS rewards while staying composable in DeFi.',
    website: 'https://www.kelpdao.xyz/restake', chains: ['Ethereum', 'Arbitrum'],
    stats: [{ label: 'TVL', value: '$1.1B' }, { label: 'rsETH Supply', value: '420k ETH' }, { label: 'APR', value: '4.3%' }, { label: 'AVSs', value: '12+' }],
    tags: ['Liquid Restaking', 'Live'],
  },
  {
    id: 'puffer', name: 'Puffer Finance', category: 'liquid-restaking', logo: '🐡',
    description: 'Puffer Finance is a native liquid restaking protocol focused on reducing validator slashing risk via anti-slashing hardware.',
    website: 'https://app.puffer.fi', chains: ['Ethereum'],
    stats: [{ label: 'TVL', value: '$1.5B' }, { label: 'pufETH Supply', value: '560k ETH' }, { label: 'APR', value: '4.1%' }, { label: 'Validators', value: '1,800+' }],
    tags: ['Liquid Restaking', 'Live'],
  },

  // ── RWA ────────────────────────────────────────────────────────────────────
  {
    id: 'ondo', name: 'Ondo Finance', category: 'rwa', logo: '🏛️',
    description: 'Ondo Finance tokenises US Treasuries and money market funds, giving DeFi users access to institutional-grade fixed income.',
    website: 'https://app.ondo.finance', chains: ['Ethereum', 'Polygon', 'Solana'],
    stats: [{ label: 'TVL', value: '$620M' }, { label: 'OUSG APY', value: '5.1%' }, { label: 'USDY APY', value: '5.0%' }, { label: 'Assets', value: '3' }],
    tags: ['RWA', 'Treasuries', 'Live'],
  },
  {
    id: 'centrifuge', name: 'Centrifuge', category: 'rwa', logo: '⚙️',
    description: 'Centrifuge brings real-world assets like invoices, mortgages, and trade finance on-chain as collateral for DeFi lending.',
    website: 'https://app.centrifuge.io', chains: ['Ethereum', 'Centrifuge Chain'],
    stats: [{ label: 'TVL', value: '$280M' }, { label: 'Assets Financed', value: '$500M+' }, { label: 'Pools', value: '25+' }, { label: 'Avg. APY', value: '7.2%' }],
    tags: ['RWA', 'Credit', 'Live'],
  },
  {
    id: 'maple', name: 'Maple Finance', category: 'rwa', logo: '🍁',
    description: 'Maple Finance is an institutional capital marketplace offering undercollateralised loans to vetted crypto-native firms.',
    website: 'https://app.maple.finance', chains: ['Ethereum', 'Solana'],
    stats: [{ label: 'TVL', value: '$290M' }, { label: 'Total Lent', value: '$2.4B' }, { label: 'Avg. APY', value: '8.5%' }, { label: 'Pools', value: '10+' }],
    tags: ['RWA', 'Credit', 'Live'],
  },
  {
    id: 'goldfinch', name: 'Goldfinch', category: 'rwa', logo: '🐦',
    description: 'Goldfinch extends crypto credit to real-world businesses in emerging markets without requiring crypto collateral.',
    website: 'https://app.goldfinch.finance', chains: ['Ethereum'],
    stats: [{ label: 'TVL', value: '$78M' }, { label: 'Total Lent', value: '$100M+' }, { label: 'Avg. APY', value: '10.3%' }, { label: 'Borrowers', value: '30+' }],
    tags: ['RWA', 'Credit', 'Live'],
  },
  {
    id: 'backed', name: 'Backed Finance', category: 'rwa', logo: '📋',
    description: 'Backed issues permissionless tokenised securities tracking ETFs and stocks, redeemable 1:1 for the underlying asset.',
    website: 'https://app.backed.fi', chains: ['Ethereum', 'Gnosis', 'Base'],
    stats: [{ label: 'TVL', value: '$45M' }, { label: 'Products', value: '10+' }, { label: 'bIB01 APY', value: '5.2%' }, { label: 'Chains', value: '3' }],
    tags: ['RWA', 'Securities', 'Live'],
  },

  // ── CDP ────────────────────────────────────────────────────────────────────
  {
    id: 'makerdao', name: 'Sky (MakerDAO)', category: 'cdp', logo: '🔮',
    description: 'MakerDAO (now Sky) is the creator of DAI — the largest decentralised stablecoin, backed by crypto and RWA collateral.',
    website: 'https://app.sky.money', chains: ['Ethereum'],
    stats: [{ label: 'TVL', value: '$8.1B' }, { label: 'DAI Supply', value: '$4.8B' }, { label: 'USDS Supply', value: '$1.2B' }, { label: 'Stability Fee', value: '5.5%' }],
    tags: ['CDP', 'Stablecoin', 'Live'],
  },
  {
    id: 'liquity', name: 'Liquity', category: 'cdp', logo: '💧',
    description: 'Liquity lets you borrow LUSD at 0% interest against ETH with a minimum 110% collateral ratio and no governance.',
    website: 'https://app.liquity.org', chains: ['Ethereum'],
    stats: [{ label: 'TVL', value: '$290M' }, { label: 'LUSD Supply', value: '$85M' }, { label: 'Borrow Fee', value: '0%' }, { label: 'Min. CR', value: '110%' }],
    tags: ['CDP', 'Stablecoin', 'Live'],
  },
  {
    id: 'liquity-v2', name: 'Liquity V2', category: 'cdp', logo: '💦',
    description: 'Liquity V2 introduces user-set interest rates and multi-collateral support for a more flexible borrowing experience.',
    website: 'https://app.liquity.org', chains: ['Ethereum'],
    stats: [{ label: 'TVL', value: '$180M' }, { label: 'BOLD Supply', value: '$55M' }, { label: 'Min. Rate', value: '0.5%' }, { label: 'Collaterals', value: '3' }],
    tags: ['CDP', 'Stablecoin', 'Live'],
  },
  {
    id: 'prisma', name: 'Prisma Finance', category: 'cdp', logo: '🔺',
    description: 'Prisma Finance lets you mint the mkUSD stablecoin using liquid staking tokens as collateral, boosted by CRV and CVX rewards.',
    website: 'https://app.prismafinance.com', chains: ['Ethereum'],
    stats: [{ label: 'TVL', value: '$95M' }, { label: 'mkUSD Supply', value: '$40M' }, { label: 'Borrow APR', value: '2.1%' }, { label: 'Collaterals', value: '5' }],
    tags: ['CDP', 'Stablecoin', 'Live'],
  },
  {
    id: 'crvusd', name: 'crvUSD', category: 'cdp', logo: '〰️',
    description: 'crvUSD is Curve\'s native stablecoin using the LLAMMA mechanism for soft liquidations, protecting borrowers from sharp price drops.',
    website: 'https://crvusd.curve.fi', chains: ['Ethereum'],
    stats: [{ label: 'TVL', value: '$230M' }, { label: 'crvUSD Supply', value: '$180M' }, { label: 'Borrow APR', value: '7.5%' }, { label: 'Collaterals', value: '6' }],
    tags: ['CDP', 'Stablecoin', 'Live'],
  },

  // ── Options ────────────────────────────────────────────────────────────────
  {
    id: 'ribbon', name: 'Ribbon Finance', category: 'options', logo: '🎀',
    description: 'Ribbon Finance runs automated options strategies (covered calls & puts) packaged as structured product vaults.',
    website: 'https://app.ribbon.finance', chains: ['Ethereum', 'Arbitrum', 'Avalanche'],
    stats: [{ label: 'TVL', value: '$68M' }, { label: 'Total Notional', value: '$8B+' }, { label: 'Best Vault APY', value: '18.4%' }, { label: 'Vaults', value: '12' }],
    tags: ['Options', 'Vaults', 'Live'],
  },
  {
    id: 'lyra', name: 'Lyra Finance', category: 'options', logo: '🎵',
    description: 'Lyra is a fully on-chain options AMM for ETH, BTC, and other assets with dynamic delta hedging.',
    website: 'https://app.lyra.finance', chains: ['Arbitrum', 'Optimism', 'Base'],
    stats: [{ label: 'TVL', value: '$22M' }, { label: 'Total Volume', value: '$1.2B' }, { label: 'Open Interest', value: '$18M' }, { label: 'Markets', value: '5' }],
    tags: ['Options', 'Live'],
  },
  {
    id: 'dopex', name: 'Dopex', category: 'options', logo: '🎲',
    description: 'Dopex is a decentralised options protocol on Arbitrum offering Single Staking Option Vaults and Atlantic options.',
    website: 'https://app.dopex.io', chains: ['Arbitrum'],
    stats: [{ label: 'TVL', value: '$18M' }, { label: 'Total Volume', value: '$400M' }, { label: 'Open Interest', value: '$12M' }, { label: 'Vaults', value: '20+' }],
    tags: ['Options', 'Live'],
  },
  {
    id: 'premia', name: 'Premia Finance', category: 'options', logo: '💠',
    description: 'Premia Blue is a peer-to-pool options protocol with capital-efficient liquidity and orderbook-style pricing.',
    website: 'https://app.premia.blue', chains: ['Arbitrum', 'Ethereum', 'Optimism'],
    stats: [{ label: 'TVL', value: '$14M' }, { label: 'Total Volume', value: '$280M' }, { label: 'Open Interest', value: '$8M' }, { label: 'Markets', value: '15+' }],
    tags: ['Options', 'Live'],
  },
  {
    id: 'hegic', name: 'Hegic', category: 'options', logo: '🦅',
    description: 'Hegic is a peer-to-pool options trading protocol on Arbitrum with one-click ETH and BTC options in any size.',
    website: 'https://www.hegic.co', chains: ['Arbitrum'],
    stats: [{ label: 'TVL', value: '$10M' }, { label: 'Total Volume', value: '$350M' }, { label: 'Open Interest', value: '$6M' }, { label: 'Strategies', value: '8' }],
    tags: ['Options', 'Live'],
  },
];

export function getProtocol(id: string) {
  return PROTOCOLS.find(p => p.id === id);
}

export function getProtocolsByCategory(category: ProtocolCategory) {
  return PROTOCOLS.filter(p => p.category === category);
}

// ─── Category list screens ────────────────────────────────────────────────────

const CATEGORY_META: Record<ProtocolCategory, { label: string; color: string; icon: string }> = {
  lending:   { label: 'Lending',   color: '#52E3A4', icon: 'bank'   },
  dexs:      { label: 'DEXs',      color: '#60A5FA', icon: 'swap'   },
  perps:     { label: 'Perps',     color: '#FFFFFF', icon: 'chart'  },
  bridge:    { label: 'Bridge',    color: '#FFB36B', icon: 'bridge' },
  vaults:    { label: 'Vaults',    color: '#C084FC', icon: 'vault'  },
  launchpad: { label: 'Launchpad', color: '#F472B6', icon: 'launch' },
  insurance:          { label: 'Insurance',       color: '#52E3A4', icon: 'shield' },
  'liquid-staking':   { label: 'Liquid Staking',  color: '#38BDF8', icon: 'stake'  },
  'liquid-restaking': { label: 'Restaking',        color: '#818CF8', icon: 'stake'  },
  rwa:                { label: 'RWA',              color: '#FBBF24', icon: 'bank'   },
  cdp:                { label: 'CDP',              color: '#34D399', icon: 'vault'  },
  options:            { label: 'Options',          color: '#F87171', icon: 'chart'  },
};

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: '12px 14px', flex: 1, minWidth: 0 }}>
      <div style={{ color: btb.textMuted, fontSize: 11, marginBottom: 4 }}>{label}</div>
      <div style={{ color: btb.text, fontSize: 15, fontWeight: 800, letterSpacing: -0.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
    </div>
  );
}

// ─── Single protocol detail screen ───────────────────────────────────────────

export function ProtocolDetailScreen({ id, onBack }: { id: string; onBack: () => void }) {
  const p = getProtocol(id);
  if (!p) return null;
  const meta = CATEGORY_META[p.category];

  return (
    <div style={{ padding: 'env(safe-area-inset-top, 24px) 18px 100px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div onClick={onBack} style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,0.08)', border: btb.borderSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <Icon name="back" size={18}/>
        </div>
        <div style={{ fontSize: 28 }}>{p.logo}</div>
        <div>
          <div style={{ color: btb.text, fontSize: 20, fontWeight: 800, letterSpacing: -0.4 }}>{p.name}</div>
          <div style={{ color: meta.color, fontSize: 12, fontWeight: 600 }}>{meta.label}</div>
        </div>
        <div style={{ marginLeft: 'auto', background: 'rgba(82,227,164,0.15)', color: '#52E3A4', fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999 }}>Live</div>
      </div>

      {/* description */}
      <Glass padding={18} radius={20}>
        <div style={{ color: btb.textMuted, fontSize: 14, lineHeight: 1.6 }}>{p.description}</div>
      </Glass>

      {/* stats */}
      <div>
        <div style={{ color: btb.textDim, fontSize: 12, fontWeight: 600, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.8 }}>Stats (mock)</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {p.stats.map(s => <StatCard key={s.label} label={s.label} value={s.value}/>)}
        </div>
      </div>

      {/* chains */}
      <div>
        <div style={{ color: btb.textDim, fontSize: 12, fontWeight: 600, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.8 }}>Supported chains</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {p.chains.map(c => (
            <div key={c} style={{ background: 'rgba(255,255,255,0.07)', border: btb.borderSoft, borderRadius: 999, padding: '5px 12px', color: btb.text, fontSize: 12, fontWeight: 600 }}>{c}</div>
          ))}
        </div>
      </div>

      {/* tags */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {p.tags.map(t => (
          <div key={t} style={{ background: 'rgba(255,255,255,0.06)', border: btb.borderSoft, borderRadius: 999, padding: '4px 12px', color: btb.textDim, fontSize: 11, fontWeight: 600 }}>{t}</div>
        ))}
      </div>

      {/* CTA */}
      <button onClick={() => window.open(p.website, '_blank', 'noopener,noreferrer')} style={{
        width: '100%', height: 56, borderRadius: 18, border: 'none', cursor: 'pointer',
        background: `linear-gradient(135deg, ${meta.color}22, ${meta.color}11)`,
        outline: `1px solid ${meta.color}44`,
        color: meta.color, fontSize: 16, fontWeight: 700, fontFamily: 'inherit',
      }}>
        Open {p.name} ↗
      </button>
    </div>
  );
}

// ─── Category list screen ─────────────────────────────────────────────────────

export function ProtocolCategoryScreen({ category, onBack, onProtocol }: {
  category: ProtocolCategory;
  onBack: () => void;
  onProtocol: (id: string) => void;
}) {
  const protocols = getProtocolsByCategory(category);
  const meta = CATEGORY_META[category];

  return (
    <div style={{ padding: 'env(safe-area-inset-top, 24px) 18px 100px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div onClick={onBack} style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,0.08)', border: btb.borderSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <Icon name="back" size={18}/>
        </div>
        <div style={{ color: btb.text, fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>{meta.label}</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {protocols.map(p => (
          <Glass key={p.id} padding={16} radius={20} style={{ cursor: 'pointer' }} onClick={() => onProtocol(p.id)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ fontSize: 32, lineHeight: 1 }}>{p.logo}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: btb.text, fontSize: 16, fontWeight: 700 }}>{p.name}</div>
                <div style={{ color: btb.textMuted, fontSize: 12, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.description}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  {p.stats.slice(0, 2).map(s => (
                    <div key={s.label} style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 8, padding: '3px 8px' }}>
                      <span style={{ color: btb.textDim, fontSize: 10 }}>{s.label} </span>
                      <span style={{ color: meta.color, fontSize: 11, fontWeight: 700 }}>{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>
              <Icon name="right" size={16} color={btb.textDim}/>
            </div>
          </Glass>
        ))}
      </div>
    </div>
  );
}
