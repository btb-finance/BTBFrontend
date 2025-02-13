'use client';

import { useState } from 'react';
import { ChevronRightIcon } from '@heroicons/react/24/outline';

interface Article {
  id: string;
  category: string;
  title: string;
  description: string;
  content: string;
  readTime: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
}

const uniswapV4Articles: Article[] = [
  {
    id: 'uniswap-v4-revolution',
    category: 'uniswap',
    title: 'The Uniswap V4 Revolution: Transforming DeFi Trading',
    description: "Discover how Uniswap V4 is revolutionizing DeFi with groundbreaking features and unprecedented flexibility.",
    content: `
      Welcome to the Future of DeFi

      Uniswap V4 represents a paradigm shift in decentralized trading, introducing revolutionary features that will transform how we interact with DeFi protocols.

      Key Innovations

      1. Singleton Architecture
      ————————————————————————
      • All pools managed by a single contract
      • Dramatically reduced deployment costs
      • Simplified protocol integration
      • Enhanced capital efficiency

      2. Dynamic Fee Tiers
      ————————————————————————
      • Flexible fee structures
      • Market-responsive pricing
      • Optimized liquidity provider returns
      • Competitive trading costs

      3. Native ETH Support
      ————————————————————————
      • Direct ETH trading without wrapping
      • Improved user experience
      • Lower transaction costs
      • Seamless integration

      Why It Matters

      • Enhanced Capital Efficiency
      • Lower Trading Costs
      • Better User Experience
      • More Trading Opportunities
      • Increased Protocol Innovation

      Impact on DeFi
      
      Uniswap V4 sets new standards for:
      • Trading Efficiency
      • Protocol Flexibility
      • Market Making
      • Liquidity Provision
      • Cross-chain Integration
    `,
    readTime: '8 min',
    difficulty: 'Beginner'
  },
  {
    id: 'uniswap-v4-hooks-explained',
    category: 'uniswap',
    title: 'Mastering Uniswap V4 Hooks: The Power of Customization',
    description: "Explore how Uniswap V4 hooks enable unprecedented customization and unlock new possibilities in DeFi trading.",
    content: `
      Understanding Hooks in Uniswap V4

      Hooks are the secret sauce that makes Uniswap V4 incredibly powerful and flexible. Let's explore how they transform DeFi trading.

      Types of Hooks
      ————————————————————————

      1. Before Swap Hooks
      • Customize trade execution
      • Implement advanced order types
      • Add custom validation logic
      • Enable dynamic pricing

      2. After Swap Hooks
      • Track trading metrics
      • Implement rewards
      • Update external systems
      • Trigger follow-up actions

      3. Liquidity Management Hooks
      • Custom liquidity rules
      • Advanced position management
      • Automated rebalancing
      • Risk management

      Real-World Applications
      ————————————————————————

      1. Dynamic Market Making
      • Time-weighted average pricing
      • Volatility-based fees
      • Custom liquidity curves
      • Multi-token pools

      2. Advanced Trading Features
      • Limit orders
      • Stop-loss orders
      • Dollar-cost averaging
      • Portfolio rebalancing

      3. Risk Management
      • Price impact protection
      • Slippage controls
      • Position size limits
      • Market manipulation prevention

      Benefits for Users
      
      • More trading options
      • Better prices
      • Reduced risks
      • Custom strategies
      • Enhanced returns
    `,
    readTime: '12 min',
    difficulty: 'Advanced'
  },
  {
    id: 'uniswap-v4-flash',
    category: 'uniswap',
    title: 'Flash Accounting: The Future of DeFi Efficiency',
    description: "Learn how Uniswap V4's Flash Accounting system revolutionizes transaction efficiency and reduces costs.",
    content: `
      Flash Accounting Revolution

      Flash Accounting in Uniswap V4 represents a quantum leap in DeFi efficiency. Let's explore this game-changing feature.

      How It Works
      ————————————————————————

      1. Smart Token Management
      • Delayed settlements
      • Batch processing
      • Optimized transfers
      • Net position calculations

      2. Gas Optimization
      • Reduced token transfers
      • Efficient state updates
      • Optimized memory usage
      • Minimal storage operations

      Key Benefits
      ————————————————————————

      1. Cost Savings
      • Lower transaction fees
      • Reduced gas costs
      • Optimized operations
      • Better capital efficiency

      2. Enhanced Trading
      • Faster execution
      • Complex strategies
      • Multi-step operations
      • Arbitrage opportunities

      Real-World Impact
      ————————————————————————

      • Up to 50% gas savings
      • Instant settlement
      • Improved liquidity
      • Better price execution
      • Enhanced user experience

      Future Possibilities
      
      • Cross-chain integration
      • Layer 2 optimization
      • MEV protection
      • Advanced trading strategies
    `,
    readTime: '10 min',
    difficulty: 'Intermediate'
  },
  {
    id: 'uniswap-v4-strategies',
    category: 'uniswap',
    title: 'Advanced Trading Strategies in Uniswap V4',
    description: "Explore sophisticated trading strategies made possible by Uniswap V4's innovative features.",
    content: `
      Advanced Trading in Uniswap V4

      Discover how Uniswap V4's features enable sophisticated trading strategies previously impossible in DeFi.

      Strategy Types
      ————————————————————————

      1. Range Trading
      • Dynamic range selection
      • Automated rebalancing
      • Volatility harvesting
      • Risk management

      2. Yield Optimization
      • Fee tier selection
      • Liquidity concentration
      • Reward maximization
      • Risk-adjusted returns

      3. Arbitrage Strategies
      • Cross-pool arbitrage
      • MEV capture
      • Flash loan integration
      • Price inefficiency capture

      Advanced Features
      ————————————————————————

      1. Custom Orders
      • Limit orders
      • Stop-loss
      • Take-profit
      • Time-weighted orders

      2. Risk Management
      • Position sizing
      • Slippage protection
      • Impermanent loss mitigation
      • Portfolio hedging

      Optimization Techniques
      ————————————————————————

      • Fee optimization
      • Gas efficiency
      • Timing strategies
      • Position management
      • Market analysis

      Strategy Benefits
      
      • Higher returns
      • Lower risks
      • Better execution
      • More opportunities
      • Enhanced control
    `,
    readTime: '15 min',
    difficulty: 'Advanced'
  },
  {
    id: 'uniswap-v4-future',
    category: 'uniswap',
    title: 'The Future of DeFi: Uniswap V4 and Beyond',
    description: "Explore the future possibilities and potential impact of Uniswap V4 on the DeFi ecosystem.",
    content: `
      Vision for the Future

      Uniswap V4 is laying the groundwork for the next generation of DeFi innovation. Let's explore what the future holds.

      Ecosystem Impact
      ————————————————————————

      1. Market Evolution
      • New trading paradigms
      • Enhanced efficiency
      • Greater accessibility
      • Innovative products

      2. Protocol Integration
      • Cross-chain bridges
      • Layer 2 scaling
      • Protocol composability
      • Ecosystem expansion

      Emerging Opportunities
      ————————————————————————

      1. New Markets
      • Exotic pairs
      • Synthetic assets
      • Real-world assets
      • Complex derivatives

      2. Innovation Areas
      • AI integration
      • Automated strategies
      • Custom pool types
      • Advanced analytics

      Future Developments
      ————————————————————————

      • Cross-chain expansion
      • Institutional adoption
      • Regulatory compliance
      • Enhanced security
      • User experience improvements

      Long-term Vision
      
      • Global accessibility
      • Mainstream adoption
      • Financial inclusion
      • Ecosystem growth
      • Continuous innovation
    `,
    readTime: '10 min',
    difficulty: 'Intermediate'
  }
];

interface ArticleListProps {
  category: string;
  searchQuery: string;
}

export default function ArticleList({ category, searchQuery }: ArticleListProps) {
  const [expandedArticle, setExpandedArticle] = useState<string | null>(null);

  const filteredArticles = uniswapV4Articles.filter((article) => {
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
    <div className="space-y-6">
      {filteredArticles.map((article) => (
        <article
          key={article.id}
          className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden border border-gray-100 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 transition-all duration-300"
        >
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                getDifficultyColor(article.difficulty)
              }`}>
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
            <button
              onClick={() => setExpandedArticle(
                expandedArticle === article.id ? null : article.id
              )}
              className="inline-flex items-center px-4 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors duration-200"
            >
              {expandedArticle === article.id ? 'Show Less' : 'Read More'}
              <ChevronRightIcon className={`h-5 w-5 ml-1 transition-transform duration-200 ${
                expandedArticle === article.id ? 'rotate-90' : ''
              }`} />
            </button>
            {expandedArticle === article.id && (
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
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
              </div>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
