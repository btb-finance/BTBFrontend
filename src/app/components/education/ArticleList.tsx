'use client';

import { useState } from 'react';
import { ChevronRightIcon, BookOpenIcon, AcademicCapIcon, BeakerIcon } from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';

interface Article {
  id: string;
  category: string;
  title: string;
  description: string;
  content: string;
  readTime: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
}

const btbArticles: Article[] = [
  {
    id: 'btb-ecosystem-overview',
    category: 'btb',
    title: 'BTB Finance: Comprehensive DeFi Ecosystem',
    description: "Discover how BTB Finance is building a comprehensive DeFi toolkit with advanced analytics and yield optimization.",
    content: `
      Welcome to BTB Finance

      BTB Finance represents a comprehensive approach to DeFi, offering a complete toolkit for traders, liquidity providers, and DeFi enthusiasts.

      Core Components

      1. Larry Ecosystem
      ————————————————————————
      • Stability-focused lending protocol
      • Automated risk management
      • Leverage trading capabilities
      • Yield optimization

      2. CHICKS Protocol
      ————————————————————————
      • NFT-based gaming system
      • Reward mechanisms
      • Community engagement
      • Yield generation

      3. Megapot Lottery
      ————————————————————————
      • Decentralized lottery system
      • Fair ticket distribution
      • Community rewards
      • Transparent operations

      Why BTB Finance Matters

      • Comprehensive DeFi Solutions
      • User-Friendly Interface
      • Community-Driven Development
      • Innovative Features
      • Cross-Chain Compatibility

      Impact on DeFi
      
      BTB Finance sets new standards for:
      • User Experience
      • Protocol Integration
      • Community Engagement
      • Yield Generation
      • Risk Management
    `,
    readTime: '8 min',
    difficulty: 'Beginner'
  },
  {
    id: 'larry-ecosystem-guide',
    category: 'btb',
    title: 'Larry Ecosystem: Stability-Focused DeFi',
    description: "Explore the Larry Ecosystem's approach to stable lending, leverage trading, and automated risk management.",
    content: `
      Understanding Larry Ecosystem

      The Larry Ecosystem is designed to provide stable, reliable DeFi services with a focus on risk management and user protection.

      Key Features
      ————————————————————————

      1. Lending Protocol
      • Stable interest rates
      • Collateral management
      • Liquidation protection
      • Automated rebalancing

      2. Leverage Trading
      • Risk-controlled leverage
      • Position monitoring
      • Automated stop-losses
      • Portfolio management

      3. Yield Optimization
      • Strategy automation
      • Risk assessment
      • Reward maximization
      • Capital efficiency

      Benefits for Users
      ————————————————————————

      1. Stability Focus
      • Predictable returns
      • Risk mitigation
      • Capital protection
      • Consistent performance

      2. User Experience
      • Simple interface
      • Clear information
      • Easy navigation
      • Comprehensive tools

      Real-World Applications
      
      • Safe lending and borrowing
      • Controlled leverage trading
      • Yield farming optimization
      • Risk management tools
      • Portfolio diversification
    `,
    readTime: '12 min',
    difficulty: 'Intermediate'
  },
  {
    id: 'chicks-gaming-protocol',
    category: 'btb',
    title: 'CHICKS Protocol: Gaming Meets DeFi',
    description: "Learn how CHICKS Protocol combines NFT gaming with yield generation for an engaging DeFi experience.",
    content: `
      CHICKS Protocol Innovation

      CHICKS Protocol represents the intersection of gaming and DeFi, creating an engaging platform that rewards participation and skill.

      Gaming Elements
      ————————————————————————

      1. NFT Characters
      • Unique character traits
      • Skill development
      • Trading capabilities
      • Reward multipliers

      2. Game Mechanics
      • Strategic gameplay
      • Competitive elements
      • Skill-based rewards
      • Community interaction

      DeFi Integration
      ————————————————————————

      1. Yield Generation
      • Gaming rewards
      • Staking benefits
      • Trading income
      • Performance bonuses

      2. Token Economics
      • Fair distribution
      • Utility tokens
      • Governance rights
      • Economic incentives

      Benefits
      ————————————————————————

      • Engaging user experience
      • Multiple revenue streams
      • Community building
      • Skill development
      • Financial rewards

      Future Development
      
      • Enhanced gameplay
      • New character types
      • Advanced strategies
      • Cross-platform integration
      • Competitive tournaments
    `,
    readTime: '10 min',
    difficulty: 'Beginner'
  }
];

interface ArticleListProps {
  category: string;
  searchQuery: string;
}

export default function ArticleList({ category, searchQuery }: ArticleListProps) {
  const [expandedArticle, setExpandedArticle] = useState<string | null>(null);
  
  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };
  
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  const filteredArticles = btbArticles.filter((article) => {
    const matchesCategory = category === 'all' || article.category === category;
    const matchesSearch = searchQuery === '' || 
      article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Beginner':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'Intermediate':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'Advanced':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  return (
    <motion.div 
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {filteredArticles.map((article, index) => (
        <motion.article
          key={article.id}
          className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden border border-gray-100 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 transition-all duration-300 relative group"
          variants={itemVariants}
          whileHover={{ y: -5, boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)" }}
        >
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-blue-500/5 opacity-0 group-hover:opacity-100"
            initial={{ opacity: 0 }}
            whileHover={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          />
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getDifficultyColor(article.difficulty)}`}>
                {article.difficulty}
              </span>
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {article.readTime} read
                </span>
              </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3 leading-tight">
              {article.title}
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-4 text-lg">
              {article.description}
            </p>
            <motion.button
              onClick={() => setExpandedArticle(expandedArticle === article.id ? null : article.id)}
              className="inline-flex items-center px-4 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors duration-200 relative overflow-hidden group"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-blue-500/10"
                initial={{ x: "-100%" }}
                whileHover={{ x: "100%" }}
                transition={{ duration: 0.5 }}
              />
              <span className="relative z-10">{expandedArticle === article.id ? 'Show Less' : 'Read More'}</span>
              <ChevronRightIcon className={`h-5 w-5 ml-1 transition-transform duration-200 relative z-10 ${expandedArticle === article.id ? 'rotate-90' : ''}`} />
            </motion.button>
            <AnimatePresence mode="wait">
              {expandedArticle === article.id && (
                <motion.div 
                  className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="prose dark:prose-invert max-w-none">
                    {article.content.split('\n').map((paragraph, index) => {
                      if (paragraph.trim().endsWith('————————————————————————')) {
                        return (
                          <h3 key={index} className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">
                            {paragraph.replace('————————————————————————', '')}
                          </h3>
                        );
                      }
                      if (paragraph.trim().startsWith('•')) {
                        return (
                          <div key={index} className="flex items-start space-x-2 mb-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2"></div>
                            <p className="text-gray-700 dark:text-gray-300 flex-1">
                              {paragraph.replace('•', '').trim()}
                            </p>
                          </div>
                        );
                      }
                      if (paragraph.trim()) {
                        return (
                          <p key={index} className="text-gray-700 dark:text-gray-300 mb-4 text-lg leading-relaxed">
                            {paragraph}
                          </p>
                        );
                      }
                      return null;
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.article>
      ))}
    </motion.div>
  );
}
