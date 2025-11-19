import {
    ArrowTrendingUpIcon,
    BanknotesIcon,
    BoltIcon,
    CurrencyDollarIcon,
    ChartBarIcon,
    ShieldCheckIcon,
    UserGroupIcon,
    ArrowRightIcon,
    BeakerIcon,
    LightBulbIcon,
    SparklesIcon,
    TrophyIcon,
    CubeTransparentIcon,
    GlobeAltIcon
} from '@heroicons/react/24/outline';
import React from 'react';

export const features = [
    {
        name: 'BTB Governance',
        description: 'BTB token holders vote on supported pools and influence how the 10% weekly rewards are distributed across the ecosystem.',
        icon: UserGroupIcon,
        href: '/governance',
        color: 'from-purple-500 to-pink-600'
    },
    {
        name: 'Ultimate Yield Farming',
        description: 'Experience the biggest yield farming opportunity in DeFi with risk-free returns and optimized strategies across multiple protocols.',
        icon: ChartBarIcon,
        href: '/yield-farming',
        color: 'from-indigo-500 to-indigo-600'
    }
];

export const products = [
    {
        name: 'BTB Game Ecosystem',
        description: 'Revolutionary Hunt-to-Earn ecosystem where BEAR scarcity, MiMo deflation, and LP rewards create continuous upward price pressure!',
        detailedDescription: "Our breakthrough BTB Game creates a perfect tokenomics storm: As users deposit BEAR NFTs, supply shrinks driving BTB prices up. MiMo hunting burns 25% of tokens permanently while 25% goes to LP providers. Bears require 1M+ MiMo (10% premium) to redeem, forcing demand. Every mechanism pushes prices higher!",
        features: ['Deflationary BEAR supply', 'Multi-token price synergy', 'LP provider rewards', 'Sustainable upward pressure'],
        icon: GlobeAltIcon,
        href: '/game',
        bgColor: 'bg-gradient-to-br from-red-600/10 to-orange-800/10',
        iconColor: 'text-red-600 dark:text-red-400',
        borderColor: 'border-red-200 dark:border-red-800',
        isNew: true,
        highlight: true
    },
    {
        name: 'Larry Ecosystem',
        description: 'Larry is a meme coin that is fully audited and battle tested. The rebase-less stability token lets you trade, leverage up to 100x, and borrow ETH against LARRY collateral. Always remember - it\'s a meme coin.',
        detailedDescription: 'Larry is a meme coin with a revolutionary stability mechanism where the price can only go up, never down. Larry is fully audited and battle tested, but always remember it\'s a meme coin. Trade LARRY/ETH pairs, open leveraged positions up to 100x, or use LARRY as collateral to borrow ETH.',
        features: ['Price only goes up, never down', '100x leverage trading', 'Borrow ETH against LARRY', 'No rebase mechanism'],
        icon: ShieldCheckIcon,
        href: '/larryecosystem',
        bgColor: 'bg-gradient-to-br from-emerald-600/10 to-green-800/10',
        iconColor: 'text-emerald-600 dark:text-emerald-400',
        borderColor: 'border-emerald-200 dark:border-emerald-800'
    },
    {
        name: 'All-in-One DeFi Dashboard',
        description: 'Access all your favorite DeFi protocols through a single intuitive interface - Aave, Compound, and more.',
        detailedDescription: "Our unified dashboard brings together the best DeFi protocols in one place. No more juggling between different websites and interfaces. Whether you're providing liquidity, lending on Aave, or yield farming elsewhere, manage everything through our streamlined, user-friendly interface.",
        features: ['Multi-protocol integration', 'Single-view portfolio tracking', 'Cross-protocol yield optimization', 'Simplified user experience'],
        icon: GlobeAltIcon,
        href: '/dashboard',
        bgColor: 'bg-gradient-to-br from-emerald-600/10 to-green-800/10',
        iconColor: 'text-emerald-600 dark:text-emerald-400',
        borderColor: 'border-emerald-200 dark:border-emerald-800'
    },
    {
        name: 'Aero Booster',
        description: 'Professional AERO voting service for projects. Tiered rates: 5% for 1k, 4% for 5k, 2% for 10k+ AERO weekly fees.',
        detailedDescription: "BTB owns significant locked AERO tokens and provides weekly voting support for projects' liquidity pools. Tiered pricing structure: 5% weekly fee for 1k AERO, 4% for 5k AERO, 2% for 10k+ AERO. Better rates as you scale up! Contact us via X, Telegram, or email.",
        features: ['Weekly voting power', 'Scalable pricing structure', 'Multiple contact methods', 'Guaranteed LP boost'],
        icon: ArrowTrendingUpIcon,
        href: '/aero-booster',
        bgColor: 'bg-gradient-to-br from-sky-600/10 to-cyan-800/10',
        iconColor: 'text-sky-600 dark:text-sky-400',
        borderColor: 'border-sky-200 dark:border-sky-800',
        isNew: true,
        highlight: true
    },
    {
        name: 'Custom Game Creation',
        description: 'Launch your own Hunt-to-Earn game ecosystem like BTB Game. We build complete tokenomics, deflationary mechanics, and LP reward systems tailored to your vision.',
        detailedDescription: 'Want to create the next BTB Game or something entirely unique? Our team builds custom gaming ecosystems with sophisticated tokenomics, NFT integration, and deflationary mechanics. From concept to deployment, we handle smart contracts, frontend development, and multi-token price pressure systems that ensure sustainable growth. 🎉 **100% FREE SERVICE** - Just contact us via X, Telegram, or email with your idea and we\'ll build it for you at no cost!',
        features: ['Custom tokenomics design', 'NFT integration systems', 'Deflationary mechanics', 'Multi-network deployment', '💯 Completely FREE service'],
        icon: BeakerIcon,
        href: '/custom-game-creation',
        bgColor: 'bg-gradient-to-br from-purple-600/10 to-indigo-800/10',
        iconColor: 'text-purple-600 dark:text-purple-400',
        borderColor: 'border-purple-200 dark:border-purple-800',
        isNew: true,
        highlight: true
    },
    {
        name: 'Custom Token Creation',
        description: 'Create your own token with Larry-style stability features. Price-only-up mechanics, leverage trading capabilities, and borrowing systems - all customized to your project.',
        detailedDescription: 'Launch your own meme coin or utility token with advanced stability mechanisms like Larry. We implement price-only-up systems, 100x leverage capabilities, collateral borrowing features, and custom tokenomics. From audited smart contracts to trading interfaces, we bring your token vision to reality. 🎉 **100% FREE SERVICE** - Just reach out to us via X, Telegram, or email and we\'ll create your custom token at no charge!',
        features: ['Price stability mechanisms', 'Leverage trading integration', 'Collateral borrowing systems', 'Full audit included', '💯 Completely FREE service'],
        icon: CubeTransparentIcon,
        href: '/custom-token-creation',
        bgColor: 'bg-gradient-to-br from-orange-600/10 to-red-800/10',
        iconColor: 'text-orange-600 dark:text-orange-400',
        borderColor: 'border-orange-200 dark:border-orange-800',
        isNew: true,
        highlight: true
    },
    {
        name: 'Third-Party Integration',
        description: 'Already have a project like Megapot? We integrate your existing games, tokens, or DApps into the BTB ecosystem with our unified interface and cross-protocol features.',
        detailedDescription: 'Got an existing project that you want to supercharge? We integrate third-party games, tokens, and DApps into our BTB ecosystem. Your users get access to our unified dashboard, cross-protocol features, leverage systems, and multi-network support while maintaining your project\'s unique identity. 🎉 **100% FREE SERVICE** - Contact us via X, Telegram, or email to integrate your project into BTB at absolutely no cost!',
        features: ['Existing project integration', 'Cross-protocol compatibility', 'Unified dashboard access', 'Multi-network support', '💯 Completely FREE service'],
        icon: LightBulbIcon,
        href: '/third-party-integration',
        bgColor: 'bg-gradient-to-br from-teal-600/10 to-emerald-800/10',
        iconColor: 'text-teal-600 dark:text-teal-400',
        borderColor: 'border-teal-200 dark:border-teal-800',
        isNew: true,
        highlight: true
    }
];

export const stats = [
    { label: 'Total Value Locked', value: '$42M+' },
    { label: 'IL Protection Paid', value: '$3.8M+' },
    { label: 'Integrated DeFi Protocols', value: '15+' },
    { label: 'Supported Networks', value: '5+' }
];

// BTB Liquidity Hub Flywheel steps
export const flywheelSteps = [
    { step: "ETH Movement", desc: "Price changes trigger BTB repricing" },
    { step: "Arbitrage Created", desc: "Price gaps appear on DEXs" },
    { step: "Exclusive Capture", desc: "Our bots mint BTB and capture spreads" },
    { step: "Profit Accumulation", desc: "Each trade adds to IL refund pool" },
    { step: "Automatic Refunds", desc: "LPs receive exact IL compensation" },
    { step: "Sustainable Cycle", desc: "Volatility creates profits, not losses" }
];

// Animation keyframes for the flywheel
export const spinAnimation = {
    rotate: [0, 360],
    transition: {
        duration: 30,
        repeat: Infinity,
        ease: "linear" as const
    }
};

export const spinReverseAnimation = {
    rotate: [360, 0],
    transition: {
        duration: 20,
        repeat: Infinity,
        ease: "linear" as const
    }
};

// Who wins in the BTB Liquidity Hub model
export const winnerGroups = [
    {
        title: "BTB Token Holders Win",
        benefits: [
            "Governance rights to vote on protected pools",
            "Influence distribution of weekly rewards",
            "Growing ecosystem value as more users join"
        ],
        icon: CurrencyDollarIcon,
        color: "bg-blue-50 dark:bg-blue-900/20"
    },
    {
        title: "Liquidity Providers Win",
        benefits: [
            "Full protection against impermanent loss",
            "Impermanent loss refunds from BTB treasury",
            "Risk-free yield farming across multiple protocols"
        ],
        icon: ShieldCheckIcon,
        color: "bg-purple-50 dark:bg-purple-900/20"
    },
    {
        title: "DeFi Users Win",
        benefits: [
            "Single interface for all DeFi activities",
            "Simplified management of positions across protocols",
            "Better rates through optimized liquidity routing",
            "Enhanced user experience with unified dashboard"
        ],
        icon: GlobeAltIcon,
        color: "bg-green-50 dark:bg-green-900/20"
    }
];

// Quick navigation links for the popup
export const quickNavLinks = [
    {
        name: 'BTB Game',
        description: 'Our next big thing - Hunt, feed and earn!',
        href: '/game',
        icon: ({ className }: { className?: string }) => (
            <span className= { className } style={{ fontSize: '1.2rem', lineHeight: 1 }}>🎮</span>
    ),
color: 'bg-red-100 dark:bg-red-900/30',
    textColor: 'text-red-600 dark:text-red-400',
        isNew: true,
            highlight: true
  },
{
    name: 'Larry',
        description: 'Trade & leverage the audited meme coin',
            href: '/larryecosystem',
                icon: ({ className }: { className?: string }) => (
                    <span className= { className } style = {{ fontSize: '1.2rem', lineHeight: 1 }
}>💚</span>
    ),
color: 'bg-emerald-100 dark:bg-emerald-900/30',
    textColor: 'text-emerald-600 dark:text-emerald-400'
  },
{
    name: 'Megapot',
        description: 'Win $1M+ daily USDC jackpots with 10% cashback',
            href: '/megapot',
                icon: ({ className }: { className?: string }) => (
                    <span className= { className } style = {{ fontSize: '1.2rem', lineHeight: 1 }
}>🎰</span>
    ),
color: 'bg-green-100 dark:bg-green-900/30',
    textColor: 'text-green-600 dark:text-green-400'
  },
{
    name: 'Aero Booster',
        description: 'Professional AERO voting service',
            href: '/aero-booster',
                icon: ({ className }: { className?: string }) => (
                    <span className= { className } style = {{ fontSize: '1.2rem', lineHeight: 1 }
}>🚀</span>
    ),
color: 'bg-sky-100 dark:bg-sky-900/30',
    textColor: 'text-sky-600 dark:text-sky-400',
        isNew: true
  }
];
