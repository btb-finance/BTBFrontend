'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import { motion, useInView } from 'framer-motion';
import { Card } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { 
  ArrowRightIcon, 
  CubeTransparentIcon, 
  ShieldCheckIcon,
  CurrencyDollarIcon,
  ArrowPathIcon,
  GlobeAltIcon,
  ChartBarIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';

const PieChart = dynamic(
  () => import('react-minimal-pie-chart').then((mod) => mod.PieChart),
  { ssr: false }
);

export default function TokenPage() {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const overviewRef = useRef(null);
  const isOverviewInView = useInView(overviewRef, { once: true });
  
  // No specific percentage allocations - BTB is focused on solving impermanent loss
  const tokenFeatures = [
    { title: 'Impermanent Loss Protection', description: 'Our primary mission is to solve the impermanent loss problem for liquidity providers', icon: ShieldCheckIcon, color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-100 dark:bg-blue-900/20' },
    { title: 'Liquidity Hub', description: 'Creating a chain that will be a full liquidity hub with no impermanent loss risk', icon: CubeTransparentIcon, color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-100 dark:bg-emerald-900/20' },
    { title: 'Cross-Chain Support', description: 'LayerZero integration allows BTB to move across any EVM-compatible chain', icon: GlobeAltIcon, color: 'text-purple-600 dark:text-purple-400', bgColor: 'bg-purple-100 dark:bg-purple-900/20' },
    { title: 'Product Backing', description: 'BTB backs all ecosystem products, providing real value and utility', icon: CurrencyDollarIcon, color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-100 dark:bg-amber-900/20' },
  ];
  
  const ecosystemProducts = [
    {
      name: 'CHICKS',
      description: 'Our innovative product backed by BTB tokens',
      icon: SparklesIcon,
      color: 'bg-pink-100 text-pink-600 dark:bg-pink-900/20 dark:text-pink-400'
    },
    {
      name: 'BTB Bear NFT',
      description: '100,000 NFTs with instant liquidity through our BTB Bear NFT Swap',
      icon: CubeTransparentIcon,
      color: 'bg-amber-100 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400'
    },
    {
      name: 'Megapot Lottery',
      description: 'Daily USDC jackpots backed by BTB token',
      icon: CurrencyDollarIcon,
      color: 'bg-amber-100 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400'
    },
    {
      name: 'Impermanent Loss Protection',
      description: 'BTB token backs all IL protection across the ecosystem',
      icon: ShieldCheckIcon,
      color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400'
    }
  ];
  
  const contractAddress = '0xBBF88F780072F5141dE94E0A711bD2ad2c1f83BB';
  
  // Define the type for chain data
  type ChainData = {
    name: string;
    logo: string;
    primary?: boolean;
    explorer: string;
  };
  
  const supportedChains: ChainData[] = [
    { name: 'Base', logo: '/images/chains/base.svg', primary: true, explorer: `https://basescan.org/token/${contractAddress}` },
    { name: 'Arbitrum', logo: '/images/chains/arbitrum.svg', explorer: `https://arbiscan.io/token/${contractAddress}` },
    { name: 'Optimism', logo: '/images/chains/optimism.svg', explorer: `https://optimistic.etherscan.io/token/${contractAddress}` },
    { name: 'Polygon', logo: '/images/chains/polygon.svg', explorer: `https://polygonscan.com/token/${contractAddress}` },
    { name: 'BNB Chain', logo: '/images/chains/bnb.svg', explorer: `https://berascan.com/token/${contractAddress}` },
    { name: 'Avalanche', logo: '/images/chains/avalanche.svg', explorer: `https://snowtrace.io/token/${contractAddress}` },
  ];

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8 sm:py-12">
        <div className="max-w-7xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-8 sm:mb-12">
            <div className="inline-block px-3 py-1 mb-3 sm:px-4 sm:mb-4 rounded-full bg-btb-primary/10 border border-btb-primary/20">
              <p className="text-xs sm:text-sm font-medium text-btb-primary">The Backbone of BTB Finance</p>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3 sm:mb-4 bg-gradient-to-r from-btb-primary to-btb-primary-light bg-clip-text text-transparent">
              BTB Token
            </h1>
            <p className="text-base sm:text-lg mb-4 sm:mb-6 text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              The foundation of our entire ecosystem, backing every product we create with real value and utility
            </p>
            <p className="text-xs sm:text-md mb-4 sm:mb-6 text-gray-500 dark:text-gray-400 max-w-3xl mx-auto">
              Contract: <span className="font-mono text-xs sm:text-sm bg-gray-100 dark:bg-gray-800 p-1 rounded break-all">{contractAddress}</span>
            </p>
            <div className="flex flex-wrap justify-center gap-3 sm:gap-4 mt-4 sm:mt-8">
              <Button className="bg-btb-primary hover:bg-btb-primary-dark text-white text-sm sm:text-base py-2">
                Buy BTB Token
              </Button>
              <a href={supportedChains[0].explorer} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="border-btb-primary text-btb-primary hover:bg-btb-primary/10 text-sm sm:text-base py-2">
                  View on Explorer
                </Button>
              </a>
            </div>
          </div>
          
          {/* Tabs Navigation and Content */}
          <div className="mb-8 sm:mb-16">
            <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 mb-2 sm:mb-0">
                <TabsTrigger value="overview" className="text-xs sm:text-sm py-1.5 sm:py-2">Overview</TabsTrigger>
                <TabsTrigger value="ecosystem" className="text-xs sm:text-sm py-1.5 sm:py-2">Ecosystem</TabsTrigger>
                <TabsTrigger value="cross-chain" className="text-xs sm:text-sm py-1.5 sm:py-2">Cross-Chain</TabsTrigger>
                <TabsTrigger value="tokenomics" className="text-xs sm:text-sm py-1.5 sm:py-2">Tokenomics</TabsTrigger>
              </TabsList>
              
              {/* Overview Tab Content */}
              <TabsContent value="overview" className="mt-4 sm:mt-6">
              <div ref={overviewRef}>
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={isOverviewInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.5 }}
                  className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8 mb-8 sm:mb-12"
                >
                  {/* Token Details */}
                  <Card className="p-4 sm:p-6 border border-gray-200 dark:border-gray-700 shadow-md">
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-6">Token Details</h2>
                    <div className="space-y-3 sm:space-y-4">
                      <div className="border-b border-gray-200 dark:border-gray-700 pb-3 sm:pb-4">
                        <h3 className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Name</h3>
                        <p className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">BTB Finance</p>
                      </div>
                      <div className="border-b border-gray-200 dark:border-gray-700 pb-3 sm:pb-4">
                        <h3 className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Symbol</h3>
                        <p className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">BTB</p>
                      </div>
                      <div className="border-b border-gray-200 dark:border-gray-700 pb-3 sm:pb-4">
                        <h3 className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Primary Network</h3>
                        <p className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Base (with LayerZero cross-chain support)</p>
                      </div>
                      <div className="border-b border-gray-200 dark:border-gray-700 pb-3 sm:pb-4">
                        <h3 className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Total Supply</h3>
                        <p className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">1,000,000,000 BTB (Fixed, no minting or burning)</p>
                      </div>
                      <div className="pb-3 sm:pb-4">
                        <h3 className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Token Type</h3>
                        <p className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Utility & Ecosystem Backing</p>
                      </div>
                    </div>
                  </Card>

                  {/* BTB Core Features */}
                  <Card className="p-4 sm:p-6 border border-gray-200 dark:border-gray-700 shadow-md">
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-6">Core Features</h2>
                    <div className="space-y-3 sm:space-y-4">
                      {tokenFeatures.map((feature, index) => (
                        <div key={index} className="flex items-start space-x-3 sm:space-x-4 p-2 sm:p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                          <div className={`p-1.5 sm:p-2 rounded-lg ${feature.bgColor}`}>
                            <feature.icon className={`h-5 w-5 sm:h-6 sm:w-6 ${feature.color}`} />
                          </div>
                          <div>
                            <h3 className="font-medium text-gray-900 dark:text-white text-sm sm:text-base mb-0.5 sm:mb-1">{feature.title}</h3>
                            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">{feature.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                </motion.div>

                {/* BTB Token Mission */}
                <Card className="p-4 sm:p-8 mb-8 sm:mb-12 border border-gray-200 dark:border-gray-700 shadow-md bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-900">
                  <div className="flex flex-col md:flex-row items-center gap-6 sm:gap-8">
                    <div className="w-full md:w-1/3 flex justify-center">
                      <div className="relative w-32 h-32 sm:w-48 sm:h-48 rounded-full bg-btb-primary/10 flex items-center justify-center">
                        <motion.div 
                          className="absolute inset-0 rounded-full border-4 border-dashed border-btb-primary/30"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
                        />
                        <div className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-btb-primary to-btb-primary-light bg-clip-text text-transparent">
                          BTB
                        </div>
                      </div>
                    </div>
                    <div className="w-full md:w-2/3">
                      <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4 text-center md:text-left">The BTB Token Mission</h2>
                      <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300 mb-3 sm:mb-4">
                        BTB is the backbone of our entire ecosystem, designed to provide real value and utility across all our products. Unlike other tokens that rely on burning mechanisms, BTB focuses on community rewards and ecosystem backing.
                      </p>
                      <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300 mb-3 sm:mb-4">
                        <strong>Our core mission:</strong> To provide impermanent loss protection to liquidity providers, no matter what it takes or how long it takes to achieve this goal.
                      </p>
                      <div className="flex flex-wrap gap-2 sm:gap-3 mt-3 sm:mt-4 justify-center md:justify-start">
                        <span className="px-2 sm:px-3 py-1 bg-btb-primary/10 text-btb-primary rounded-full text-xs sm:text-sm font-medium">No Minting</span>
                        <span className="px-2 sm:px-3 py-1 bg-btb-primary/10 text-btb-primary rounded-full text-xs sm:text-sm font-medium">No Burning</span>
                        <span className="px-2 sm:px-3 py-1 bg-btb-primary/10 text-btb-primary rounded-full text-xs sm:text-sm font-medium">Community Rewards</span>
                        <span className="px-2 sm:px-3 py-1 bg-btb-primary/10 text-btb-primary rounded-full text-xs sm:text-sm font-medium">LP Protection</span>
                      </div>
                    </div>
                  </div>
                </Card>

                {/* BTB Mission Statement */}
                <Card className="p-4 sm:p-8 border border-gray-200 dark:border-gray-700 shadow-md bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 mb-6 sm:mb-8">
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4">Our Mission: Solving Impermanent Loss</h2>
                  <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300 mb-4 sm:mb-6">
                    BTB's core mission is to solve the impermanent loss problem that plagues liquidity providers across DeFi. By creating a full liquidity hub with no impermanent loss risk, we're revolutionizing how liquidity works in the blockchain space.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <div className="flex items-start space-x-3 sm:space-x-4">
                      <div className="p-1.5 sm:p-2 rounded-lg bg-blue-100 dark:bg-blue-900/20">
                        <ShieldCheckIcon className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-white text-sm sm:text-base mb-0.5 sm:mb-1">More Liquidity, Better DeFi</h3>
                        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">By eliminating impermanent loss, we create a safer environment for liquidity providers, resulting in deeper liquidity pools across the ecosystem.</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3 sm:space-x-4">
                      <div className="p-1.5 sm:p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/20">
                        <CubeTransparentIcon className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-white text-sm sm:text-base mb-0.5 sm:mb-1">Liquidity Hub</h3>
                        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Our vision is to create a chain that will be a full liquidity hub where providers can earn yields without worrying about impermanent loss.</p>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </TabsContent>
              
              {/* Ecosystem Backbone Tab */}
              <TabsContent value="ecosystem" className="mt-4 sm:mt-6">
              <div className="space-y-8 sm:space-y-12">
                {/* Ecosystem Backbone Intro */}
                <Card className="p-4 sm:p-8 border border-gray-200 dark:border-gray-700 shadow-md bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-900">
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-6">BTB: Creating a Liquidity Hub</h2>
                  <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300 mb-3 sm:mb-6">
                    Our primary mission is to solve the impermanent loss problem that has plagued DeFi since its inception. By creating a chain that will be a full liquidity hub with no impermanent loss risk, we're fundamentally changing how liquidity works in the blockchain space.
                  </p>
                  <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300 mb-4 sm:mb-6">
                    When impermanent loss is eliminated, more liquidity naturally flows into the ecosystem, benefiting all participants and creating a more robust DeFi environment for everyone.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <div className="flex items-start space-x-3 sm:space-x-4">
                      <div className="p-1.5 sm:p-2 rounded-lg bg-blue-100 dark:bg-blue-900/20">
                        <ShieldCheckIcon className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-white text-sm sm:text-base mb-0.5 sm:mb-1">Fixed Supply</h3>
                        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">BTB has a fixed supply of 1 billion tokens. No tokens will ever be minted or burned, ensuring long-term stability for our ecosystem.</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3 sm:space-x-4">
                      <div className="p-1.5 sm:p-2 rounded-lg bg-purple-100 dark:bg-purple-900/20">
                        <ArrowPathIcon className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-white text-sm sm:text-base mb-0.5 sm:mb-1">Liquidity Protection</h3>
                        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Instead of burning tokens, we focus on protecting liquidity providers from impermanent loss, creating a safer environment for all participants.</p>
                      </div>
                    </div>
                  </div>
                </Card>
                
                {/* Products Backed by BTB */}
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-6">Products Backed by BTB</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    {ecosystemProducts.map((product, index) => (
                      <Card key={index} className="p-4 sm:p-6 border border-gray-200 dark:border-gray-700 shadow-md hover:shadow-lg transition-shadow">
                        <div className="flex items-start space-x-3 sm:space-x-4">
                          <div className={`p-2 sm:p-3 rounded-lg ${product.color}`}>
                            <product.icon className="h-5 w-5 sm:h-6 sm:w-6" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-base sm:text-lg text-gray-900 dark:text-white mb-1 sm:mb-2">{product.name}</h3>
                            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">{product.description}</p>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
                
                {/* BTB Bear NFT Feature */}
                <Card className="p-4 sm:p-8 border border-gray-200 dark:border-gray-700 shadow-md bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20">
                  <div className="flex flex-col md:flex-row items-center gap-6 sm:gap-8">
                    <div className="w-full md:w-1/3 flex justify-center">
                      <div className="relative w-48 h-48 sm:w-64 sm:h-64 rounded-lg bg-gradient-to-br from-amber-200 to-orange-200 dark:from-amber-800/30 dark:to-orange-800/30 flex items-center justify-center overflow-hidden">
                        <div className="absolute inset-0 bg-white/10 dark:bg-black/10 backdrop-blur-sm"></div>
                        <div className="z-10 text-xl sm:text-2xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent px-4 text-center">
                          BTB Bear NFT Collection
                        </div>
                      </div>
                    </div>
                    <div className="w-full md:w-2/3 mt-4 md:mt-0">
                      <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4 text-center md:text-left">BTB Bear NFT: Instant Liquidity</h2>
                      <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300 mb-3 sm:mb-4">
                        Our collection of 100,000 BTB Bear NFTs features instant liquidity through our innovative BTB Bear NFT Swap. This unique system creates a revolutionary tokenomics model where the price always increases, regardless of whether you're buying or selling.
                      </p>
                      <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300 mb-3 sm:mb-4">
                        Swap your BTB tokens for unique Bear NFTs or convert your NFTs back to BTB tokens with instant liquidity, all while benefiting from our ever-increasing price floor mechanism.
                      </p>
                      <div className="text-center md:text-left">
                        <Button className="mt-2 sm:mt-4 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white text-sm sm:text-base py-2">
                          <Link href="/nftswap" className="text-white no-underline">Try BTB Bear NFT Swap</Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
                
                {/* CHICKS Backing Feature */}
                <Card className="p-4 sm:p-8 border border-gray-200 dark:border-gray-700 shadow-md bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-900/20 dark:to-rose-900/20">
                  <div className="flex flex-col md:flex-row items-center gap-6 sm:gap-8">
                    <div className="w-full md:w-2/3">
                      <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4 text-center md:text-left">CHICKS: Backed by USDC</h2>
                      <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300 mb-3 sm:mb-4">
                        CHICKS is backed by USDC, providing a strong stable foundation and giving users confidence in the long-term viability of the platform.
                      </p>
                      <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300 mb-3 sm:mb-4">
                        With USDC backing, CHICKS offers stability and security while still being part of the BTB ecosystem. This creates a balanced approach where users can benefit from both stability and growth opportunities.
                      </p>
                      <div className="text-center md:text-left">
                        <Button className="mt-2 sm:mt-4 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white text-sm sm:text-base py-2">
                          <Link href="/chicks" className="text-white no-underline">Explore CHICKS</Link>
                        </Button>
                      </div>
                    </div>
                    <div className="w-full md:w-1/3 flex justify-center mt-4 md:mt-0 order-first md:order-last">
                      <div className="relative w-48 h-48 sm:w-64 sm:h-64 rounded-lg bg-gradient-to-br from-pink-200 to-rose-200 dark:from-pink-800/30 dark:to-rose-800/30 flex items-center justify-center overflow-hidden">
                        <div className="absolute inset-0 bg-white/10 dark:bg-black/10 backdrop-blur-sm"></div>
                        <div className="z-10 text-xl sm:text-2xl font-bold bg-gradient-to-r from-pink-600 to-rose-600 bg-clip-text text-transparent">
                          $10M TVL
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </TabsContent>
              
              {/* Cross-Chain Tab */}
              <TabsContent value="cross-chain" className="mt-4 sm:mt-6">
              <div className="space-y-8 sm:space-y-12">
                {/* Cross-Chain Intro */}
                <Card className="p-4 sm:p-8 border border-gray-200 dark:border-gray-700 shadow-md bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-900">
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-6">BTB: A True Cross-Chain Token</h2>
                  <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300 mb-4 sm:mb-6">
                    BTB is a LayerZero-enabled token that can be moved across any EVM-compatible blockchain. This allows users to access BTB on their preferred networks, create liquidity pools on their favorite DEXs, and participate in the BTB ecosystem regardless of which chain they prefer.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <div className="flex items-start space-x-3 sm:space-x-4">
                      <div className="p-1.5 sm:p-2 rounded-lg bg-blue-100 dark:bg-blue-900/20">
                        <GlobeAltIcon className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-white text-sm sm:text-base mb-0.5 sm:mb-1">Chain Flexibility</h3>
                        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Move your BTB tokens to any supported chain and participate in liquidity pools across the multi-chain ecosystem.</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3 sm:space-x-4">
                      <div className="p-1.5 sm:p-2 rounded-lg bg-purple-100 dark:bg-purple-900/20">
                        <CubeTransparentIcon className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-white text-sm sm:text-base mb-0.5 sm:mb-1">Base-Focused Products</h3>
                        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">While BTB is multi-chain, our products are primarily built on Base for optimal performance and user experience.</p>
                      </div>
                    </div>
                  </div>
                </Card>
                
                {/* Supported Chains */}
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-6">Supported Chains</h2>
                  <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 mb-3 sm:mb-4">BTB contract address on all chains: <span className="font-mono text-xs bg-gray-100 dark:bg-gray-800 p-1 rounded break-all">{contractAddress}</span></p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-6">
                    {supportedChains.map((chain, index) => (
                      <a 
                        key={index} 
                        href={chain.explorer} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="no-underline"
                      >
                        <Card className={`p-3 sm:p-6 border ${chain.primary ? 'border-btb-primary/30 dark:border-btb-primary/50' : 'border-gray-200 dark:border-gray-700'} shadow-md hover:shadow-lg transition-shadow`}>
                          <div className="flex flex-col items-center justify-center space-y-2 sm:space-y-4">
                            <div className="w-10 h-10 sm:w-16 sm:h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                              {/* Chain logo */}
                              <div className="relative w-8 h-8 sm:w-12 sm:h-12">
                                <Image 
                                  src={chain.logo} 
                                  alt={`${chain.name} logo`}
                                  fill
                                  className="object-contain"
                                />
                              </div>
                            </div>
                            <div className="text-center">
                              <h3 className="font-semibold text-sm sm:text-lg text-gray-900 dark:text-white">{chain.name}</h3>
                              {chain.primary && (
                                <span className="inline-block mt-1 px-2 py-0.5 bg-btb-primary/10 text-btb-primary rounded-full text-[10px] sm:text-xs font-medium">Primary Network</span>
                              )}
                              <div className="mt-1 sm:mt-2 text-xs sm:text-sm text-blue-600 dark:text-blue-400 hover:underline">View on Explorer</div>
                            </div>
                          </div>
                        </Card>
                      </a>
                    ))}
                  </div>
                </div>
                
                {/* LayerZero Integration */}
                <Card className="p-4 sm:p-8 border border-gray-200 dark:border-gray-700 shadow-md bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
                  <div className="flex flex-col md:flex-row items-center gap-6 sm:gap-8">
                    <div className="w-full md:w-1/3 flex justify-center">
                      <div className="relative w-48 h-48 sm:w-64 sm:h-64 rounded-lg bg-gradient-to-br from-blue-200 to-indigo-200 dark:from-blue-800/30 dark:to-indigo-800/30 flex items-center justify-center overflow-hidden">
                        <div className="absolute inset-0 bg-white/10 dark:bg-black/10 backdrop-blur-sm"></div>
                        <div className="z-10 text-xl sm:text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent px-4 text-center">
                          LayerZero Enabled
                        </div>
                      </div>
                    </div>
                    <div className="w-full md:w-2/3 mt-4 md:mt-0">
                      <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4 text-center md:text-left">Seamless Cross-Chain Experience</h2>
                      <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300 mb-3 sm:mb-4">
                        BTB leverages LayerZero technology to provide a seamless cross-chain experience. Users can move their tokens between chains with minimal friction, allowing them to participate in the BTB ecosystem regardless of their preferred blockchain.
                      </p>
                      <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300 mb-3 sm:mb-4">
                        This cross-chain flexibility ensures that BTB can adapt to the evolving blockchain landscape and remain accessible to users across the multi-chain ecosystem.
                      </p>
                      <div className="text-center md:text-left">
                        <Button className="mt-2 sm:mt-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm sm:text-base py-2">
                          Learn About LayerZero
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </TabsContent>
              
              {/* Tokenomics Tab */}
              <TabsContent value="tokenomics" className="mt-4 sm:mt-6">
              <div className="space-y-8 sm:space-y-12">
                {/* Tokenomics Intro */}
                <Card className="p-4 sm:p-8 border border-gray-200 dark:border-gray-700 shadow-md bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-900">
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-6">BTB Tokenomics: Built for Sustainability</h2>
                  <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300 mb-4 sm:mb-6">
                    BTB's tokenomics are designed with long-term sustainability in mind. With a fixed supply of 1 billion tokens and no minting or burning mechanisms, BTB provides a stable foundation for our ecosystem while rewarding community members through buybacks and liquidity provider incentives.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                    <div className="flex flex-col items-center p-3 sm:p-4 rounded-lg bg-gray-100 dark:bg-gray-800/50">
                      <h3 className="font-medium text-gray-900 dark:text-white text-sm sm:text-base mb-1 sm:mb-2">Total Supply</h3>
                      <p className="text-xl sm:text-2xl font-bold text-btb-primary">1,000,000,000</p>
                      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 text-center mt-1 sm:mt-2">Fixed supply, never to be increased or decreased</p>
                    </div>
                    <div className="flex flex-col items-center p-3 sm:p-4 rounded-lg bg-gray-100 dark:bg-gray-800/50">
                      <h3 className="font-medium text-gray-900 dark:text-white text-sm sm:text-base mb-1 sm:mb-2">Token Model</h3>
                      <p className="text-xl sm:text-2xl font-bold text-btb-primary">Utility + Backing</p>
                      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 text-center mt-1 sm:mt-2">Provides utility and backs all ecosystem products</p>
                    </div>
                    <div className="flex flex-col items-center p-3 sm:p-4 rounded-lg bg-gray-100 dark:bg-gray-800/50">
                      <h3 className="font-medium text-gray-900 dark:text-white text-sm sm:text-base mb-1 sm:mb-2">Rewards Strategy</h3>
                      <p className="text-xl sm:text-2xl font-bold text-btb-primary">Buyback & Reward</p>
                      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 text-center mt-1 sm:mt-2">Instead of burning, we buyback and reward the community</p>
                    </div>
                  </div>
                </Card>
                
                {/* No Burning Policy */}
                <Card className="p-4 sm:p-8 border border-gray-200 dark:border-gray-700 shadow-md bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20">
                  <div className="flex flex-col md:flex-row items-center gap-6 sm:gap-8">
                    <div className="w-full md:w-2/3">
                      <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4 text-center md:text-left">Why We Don't Burn Tokens</h2>
                      <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300 mb-3 sm:mb-4">
                        Unlike many projects that rely on token burning to create artificial scarcity, BTB takes a different approach. We believe that burning tokens primarily benefits short-term holders while doing little for the long-term health of the ecosystem.
                      </p>
                      <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300 mb-3 sm:mb-4">
                        Instead, we use token buybacks to reward our community members, particularly liquidity providers who contribute to the ecosystem's stability and growth. This approach ensures that the value generated by the ecosystem flows back to those who support it.
                      </p>
                      <div className="flex flex-wrap gap-2 sm:gap-3 mt-2 sm:mt-4 justify-center md:justify-start">
                        <span className="px-2 sm:px-3 py-1 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-full text-xs sm:text-sm font-medium">Community-First</span>
                        <span className="px-2 sm:px-3 py-1 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-full text-xs sm:text-sm font-medium">Sustainable Growth</span>
                        <span className="px-2 sm:px-3 py-1 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-full text-xs sm:text-sm font-medium">LP Rewards</span>
                      </div>
                    </div>
                    <div className="w-full md:w-1/3 flex justify-center">
                      <div className="relative w-48 h-48 sm:w-64 sm:h-64 rounded-lg bg-gradient-to-br from-amber-200 to-orange-200 dark:from-amber-800/30 dark:to-orange-800/30 flex items-center justify-center overflow-hidden">
                        <div className="absolute inset-0 bg-white/10 dark:bg-black/10 backdrop-blur-sm"></div>
                        <div className="z-10 text-center">
                          <div className="text-4xl sm:text-5xl font-bold text-amber-600 dark:text-amber-400 mb-1 sm:mb-2">0</div>
                          <div className="text-lg sm:text-xl font-semibold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                            Tokens Burned
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
                
                {/* Impermanent Loss Protection */}
                <Card className="p-4 sm:p-8 border border-gray-200 dark:border-gray-700 shadow-md bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20">
                  <div className="flex flex-col md:flex-row items-center gap-6 sm:gap-8">
                    <div className="w-full md:w-1/3 flex justify-center">
                      <div className="relative w-48 h-48 sm:w-64 sm:h-64 rounded-lg bg-gradient-to-br from-emerald-200 to-green-200 dark:from-emerald-800/30 dark:to-green-800/30 flex items-center justify-center overflow-hidden">
                        <div className="absolute inset-0 bg-white/10 dark:bg-black/10 backdrop-blur-sm"></div>
                        <div className="z-10 text-center">
                          <ShieldCheckIcon className="h-16 w-16 sm:h-20 sm:w-20 text-emerald-600 dark:text-emerald-400 mx-auto mb-1 sm:mb-2" />
                          <div className="text-lg sm:text-xl font-semibold bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">
                            IL Protection
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="w-full md:w-2/3 mt-4 md:mt-0">
                      <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4 text-center md:text-left">Our Core Mission: Impermanent Loss Protection</h2>
                      <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300 mb-3 sm:mb-4">
                        The core mission of BTB is to provide impermanent loss protection to liquidity providers. We are committed to achieving this goal, no matter how long it takes or what challenges we face along the way.
                      </p>
                      <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300 mb-3 sm:mb-4">
                        Impermanent loss is one of the biggest challenges facing liquidity providers in DeFi. By addressing this issue, BTB aims to create a more sustainable and equitable DeFi ecosystem where liquidity providers can participate without fear of losing value due to market volatility.
                      </p>
                      <div className="text-center md:text-left">
                        <Button className="mt-2 sm:mt-4 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white text-sm sm:text-base py-2">
                          Learn About IL Protection
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
