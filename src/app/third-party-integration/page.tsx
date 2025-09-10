'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { 
  LightBulbIcon,
  PuzzlePieceIcon,
  GlobeAltIcon,
  CogIcon,
  HeartIcon,
  UsersIcon,
  GiftIcon,
  ArrowRightIcon,
  SparklesIcon,
  LinkIcon,
  RocketLaunchIcon
} from '@heroicons/react/24/outline';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardTitle, CardDescription } from '../components/ui/card';

export default function ThirdPartyIntegration() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* Hero Section */}
      <section className="relative py-20">
        <div className="absolute inset-0 bg-gradient-to-r from-teal-600/10 to-emerald-600/10" />
        <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            <div className="flex justify-center mb-6">
              <div className="p-4 rounded-full bg-teal-100 dark:bg-teal-900/30">
                <LightBulbIcon className="h-12 w-12 text-teal-600 dark:text-teal-400" />
              </div>
            </div>
            
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
              <span className="bg-gradient-to-r from-teal-600 via-emerald-600 to-green-600 bg-clip-text text-transparent">
                Third-Party Integration
              </span>
            </h1>
            
            <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-8 max-w-4xl mx-auto">
              Already have a project like Megapot? We integrate your existing games, tokens, or DApps into the BTB ecosystem with our unified interface and cross-protocol features.
            </p>

            <div className="flex items-center justify-center gap-3 mb-8">
              <GiftIcon className="h-8 w-8 text-green-500" />
              <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                100% FREE INTEGRATION
              </span>
              <GiftIcon className="h-8 w-8 text-green-500" />
            </div>

            <div className="flex items-center justify-center gap-3 mb-12">
              <HeartIcon className="h-6 w-6 text-red-500" />
              <span className="text-lg text-gray-700 dark:text-gray-300">
                We love working with teams and don't charge any money for integrations!
              </span>
              <HeartIcon className="h-6 w-6 text-red-500" />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Megapot Example */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Success Story: Megapot Integration
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              See how we integrated Megapot's $1M+ daily jackpots into our ecosystem
            </p>
          </motion.div>

          <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-2xl p-8 mb-12 border-2 border-green-200 dark:border-green-800">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="text-center"
            >
              <div className="text-6xl mb-4">🎰</div>
              <h3 className="text-2xl font-bold mb-4 text-green-700 dark:text-green-300">MEGAPOT Integration</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-2">$1M+</div>
                  <div className="text-gray-600 dark:text-gray-300">Daily Jackpots</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-2">10%</div>
                  <div className="text-gray-600 dark:text-gray-300">Instant Cashback</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-2">50%</div>
                  <div className="text-gray-600 dark:text-gray-300">Bonus Points via BTB</div>
                </div>
              </div>
              <p className="text-gray-700 dark:text-gray-300">
                Megapot maintains its unique identity while benefiting from BTB's unified dashboard, cross-protocol features, and multi-network support.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Integration Benefits */}
      <section className="py-16 bg-white/50 dark:bg-gray-800/50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              What Your Project Gains
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              Supercharge your existing project with BTB's ecosystem
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                title: "Unified Dashboard Access",
                description: "Your users get access to our all-in-one DeFi interface alongside your project",
                icon: GlobeAltIcon,
                color: "from-blue-500 to-cyan-500"
              },
              {
                title: "Cross-Protocol Compatibility", 
                description: "Seamless integration with Aave, Compound, and other major DeFi protocols",
                icon: LinkIcon,
                color: "from-purple-500 to-pink-500"
              },
              {
                title: "Multi-Network Support",
                description: "Deploy across any blockchain network with full BTB compatibility",
                icon: RocketLaunchIcon,
                color: "from-orange-500 to-red-500"
              },
              {
                title: "Leverage Systems Access",
                description: "Your token/game can tap into BTB's leverage and borrowing features",
                icon: SparklesIcon,
                color: "from-green-500 to-emerald-500"
              },
              {
                title: "Enhanced User Experience",
                description: "Better UX through our optimized interfaces and user-friendly design",
                icon: CogIcon,
                color: "from-indigo-500 to-purple-500"
              },
              {
                title: "Project Identity Maintained",
                description: "Keep your unique branding and features while gaining BTB benefits",
                icon: PuzzlePieceIcon,
                color: "from-teal-500 to-blue-500"
              }
            ].map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.3 + index * 0.1 }}
              >
                <Card className="h-full hover:shadow-xl transition-all duration-300 border-2 border-gray-200 dark:border-gray-700 hover:border-teal-300 dark:hover:border-teal-600">
                  <CardContent className="p-6">
                    <div className={`p-3 rounded-full bg-gradient-to-r ${feature.color} w-fit mb-4`}>
                      <feature.icon className="h-6 w-6 text-white" />
                    </div>
                    <CardTitle className="text-xl mb-3">{feature.title}</CardTitle>
                    <CardDescription className="text-gray-600 dark:text-gray-300">
                      {feature.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Project Types */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              What Projects We Integrate
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              Any blockchain project can benefit from BTB integration
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            {[
              {
                category: "🎮 Gaming Projects",
                examples: ["Play-to-Earn games", "NFT gaming platforms", "Lottery systems like Megapot", "Prediction markets"],
                description: "Games and gaming platforms that want to tap into DeFi features"
              },
              {
                category: "🪙 Token Projects", 
                examples: ["Meme coins", "Utility tokens", "Governance tokens", "Yield farming tokens"],
                description: "Existing tokens that want leverage, borrowing, and stability features"
              },
              {
                category: "🏦 DeFi Protocols",
                examples: ["Lending platforms", "DEX protocols", "Yield farms", "Liquidity protocols"],
                description: "DeFi projects wanting to integrate with our unified dashboard"
              },
              {
                category: "🔗 Infrastructure Projects",
                examples: ["Cross-chain bridges", "Oracle systems", "Wallet services", "Analytics platforms"],
                description: "Infrastructure that enhances the overall DeFi ecosystem"
              }
            ].map((type, index) => (
              <motion.div
                key={type.category}
                initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, delay: 0.2 + index * 0.1 }}
              >
                <Card className="h-full border-2 border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-900/20">
                  <CardContent className="p-6">
                    <CardTitle className="text-2xl mb-4 text-teal-700 dark:text-teal-300">
                      {type.category}
                    </CardTitle>
                    <CardDescription className="text-gray-600 dark:text-gray-300 mb-4">
                      {type.description}
                    </CardDescription>
                    <div className="space-y-2">
                      {type.examples.map((example, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-teal-500 rounded-full"></div>
                          <span className="text-sm text-gray-600 dark:text-gray-300">{example}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Integration Process */}
      <section className="py-16 bg-white/50 dark:bg-gray-800/50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Integration Process
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              Simple steps to integrate your project with BTB
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              {
                step: "1",
                title: "Contact Our Team",
                description: "Reach out via X, Telegram, or email with your project details"
              },
              {
                step: "2", 
                title: "Technical Assessment",
                description: "We analyze your project and plan the best integration approach"
              },
              {
                step: "3",
                title: "Integration Development",
                description: "We build the integration maintaining your project's unique identity"
              },
              {
                step: "4",
                title: "Launch & Support", 
                description: "Go live with BTB features and receive ongoing technical support"
              }
            ].map((step, index) => (
              <motion.div
                key={step.step}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 + index * 0.1 }}
                className="text-center"
              >
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 flex items-center justify-center text-white text-2xl font-bold">
                  {step.step}
                </div>
                <h3 className="text-xl font-semibold mb-3">{step.title}</h3>
                <p className="text-gray-600 dark:text-gray-300">{step.description}</p>
                {index < 3 && (
                  <ArrowRightIcon className="h-6 w-6 text-teal-400 mx-auto mt-4 hidden md:block" />
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-teal-600 to-emerald-600">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
              Ready to Integrate Your Project?
            </h2>
            <p className="text-xl text-teal-100 mb-8">
              Join the BTB ecosystem like Megapot and supercharge your project - completely free!
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
              {[
                { platform: "X (Twitter)", contact: "@btb_finance" },
                { platform: "Telegram", contact: "t.me/btbfinance" },
                { platform: "Email", contact: "hello@btb.finance" }
              ].map((method, index) => (
                <motion.div
                  key={method.platform}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, delay: 0.2 + index * 0.1 }}
                  className="bg-white/10 backdrop-blur-sm rounded-lg p-4 hover:bg-white/20 transition-all cursor-pointer"
                >
                  <div className="text-white font-semibold">{method.platform}</div>
                  <div className="text-teal-100 text-sm">{method.contact}</div>
                </motion.div>
              ))}
            </div>

            <div className="flex items-center justify-center gap-3">
              <HeartIcon className="h-8 w-8 text-red-300" />
              <span className="text-2xl font-bold text-white">
                We Love Working With Teams!
              </span>
              <HeartIcon className="h-8 w-8 text-red-300" />
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}