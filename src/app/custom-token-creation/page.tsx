'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { 
  CubeTransparentIcon,
  ShieldCheckIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  HeartIcon,
  UsersIcon,
  GiftIcon,
  ArrowRightIcon,
  SparklesIcon,
  BoltIcon
} from '@heroicons/react/24/outline';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardTitle, CardDescription } from '../components/ui/card';

export default function CustomTokenCreation() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* Hero Section */}
      <section className="relative py-20">
        <div className="absolute inset-0 bg-gradient-to-r from-orange-600/10 to-red-600/10" />
        <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            <div className="flex justify-center mb-6">
              <div className="p-4 rounded-full bg-orange-100 dark:bg-orange-900/30">
                <CubeTransparentIcon className="h-12 w-12 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
            
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
              <span className="bg-gradient-to-r from-orange-600 via-red-600 to-pink-600 bg-clip-text text-transparent">
                Custom Token Creation
              </span>
            </h1>
            
            <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-8 max-w-4xl mx-auto">
              Create your own token with Larry-style stability features. Price-only-up mechanics, leverage trading capabilities, and borrowing systems - all customized to your project.
            </p>

            <div className="flex items-center justify-center gap-3 mb-8">
              <GiftIcon className="h-8 w-8 text-green-500" />
              <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                100% FREE SERVICE
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

      {/* Features Section */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Larry-Style Token Features
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              Advanced stability mechanisms and trading capabilities
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                title: "Price Stability Mechanisms",
                description: "Price-only-up systems where your token value can only increase, never decrease",
                icon: ChartBarIcon,
                color: "from-green-500 to-emerald-500"
              },
              {
                title: "Leverage Trading Integration", 
                description: "Built-in 100x leverage capabilities for advanced trading strategies",
                icon: BoltIcon,
                color: "from-blue-500 to-cyan-500"
              },
              {
                title: "Collateral Borrowing Systems",
                description: "Use your token as collateral to borrow ETH and other assets",
                icon: CurrencyDollarIcon,
                color: "from-yellow-500 to-orange-500"
              },
              {
                title: "Full Smart Contract Audit",
                description: "Complete security audit included - battle tested and fully verified",
                icon: ShieldCheckIcon,
                color: "from-purple-500 to-indigo-500"
              },
              {
                title: "Custom Tokenomics Design",
                description: "Tailored economic models that fit your project's unique requirements",
                icon: SparklesIcon,
                color: "from-pink-500 to-rose-500"
              },
              {
                title: "Trading Interface Development",
                description: "Professional trading interfaces optimized for your token",
                icon: CubeTransparentIcon,
                color: "from-teal-500 to-blue-500"
              }
            ].map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.3 + index * 0.1 }}
              >
                <Card className="h-full hover:shadow-xl transition-all duration-300 border-2 border-gray-200 dark:border-gray-700 hover:border-orange-300 dark:hover:border-orange-600">
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

      {/* Larry Example Section */}
      <section className="py-16 bg-white/50 dark:bg-gray-800/50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Inspired by Larry's Success
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Larry proved that meme coins can have serious utility. We'll create your token with the same proven mechanisms that make prices only go up, never down.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            {[
              {
                title: "💚 Larry's Success",
                feature: "Price Only Goes Up",
                description: "Revolutionary stability where the price can only increase, creating sustainable value for holders"
              },
              {
                title: "⚡ Trading Power",
                feature: "100x Leverage Available", 
                description: "Advanced leverage trading capabilities that let users maximize their positions safely"
              },
              {
                title: "🏦 Collateral Utility",
                feature: "Borrow Against Holdings",
                description: "Use tokens as collateral to access liquidity without selling your position"
              }
            ].map((item, index) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.2 + index * 0.1 }}
              >
                <Card className="text-center h-full border-2 border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20">
                  <CardContent className="p-6">
                    <div className="text-3xl mb-3">{item.title}</div>
                    <CardTitle className="text-xl mb-3 text-emerald-600 dark:text-emerald-400">
                      {item.feature}
                    </CardTitle>
                    <CardDescription className="text-gray-600 dark:text-gray-300">
                      {item.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Process Section */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Your Token Creation Journey
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              From idea to launch - we handle everything for free!
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              {
                step: "1",
                title: "Share Your Vision",
                description: "Tell us about your token concept and what you want to achieve"
              },
              {
                step: "2", 
                title: "Design Tokenomics",
                description: "We create custom economics with Larry-style stability features"
              },
              {
                step: "3",
                title: "Build & Audit",
                description: "Smart contracts developed, tested, and fully audited for security"
              },
              {
                step: "4",
                title: "Launch & Trade", 
                description: "Deploy your token with trading interface and ongoing support"
              }
            ].map((step, index) => (
              <motion.div
                key={step.step}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 + index * 0.1 }}
                className="text-center"
              >
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center text-white text-2xl font-bold">
                  {step.step}
                </div>
                <h3 className="text-xl font-semibold mb-3">{step.title}</h3>
                <p className="text-gray-600 dark:text-gray-300">{step.description}</p>
                {index < 3 && (
                  <ArrowRightIcon className="h-6 w-6 text-orange-400 mx-auto mt-4 hidden md:block" />
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-orange-600 to-red-600">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
              Ready to Launch Your Token?
            </h2>
            <p className="text-xl text-orange-100 mb-8">
              Create the next Larry-style success story with our team - completely free!
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
                  <div className="text-orange-100 text-sm">{method.contact}</div>
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