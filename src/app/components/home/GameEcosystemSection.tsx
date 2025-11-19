'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRightIcon, SparklesIcon } from '@heroicons/react/24/outline';

export default function GameEcosystemSection() {
    return (
        <div className="py-16 bg-gradient-to-br from-red-50 to-orange-50 dark:from-gray-950 dark:to-gray-900 relative overflow-hidden">
            {/* Abstract geometric background */}
            <div className="absolute inset-0 overflow-hidden opacity-10 pointer-events-none">
                <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-r from-red-400 to-orange-500 skew-y-6 transform -translate-y-24"></div>
                <div className="absolute bottom-0 right-0 w-full h-64 bg-gradient-to-l from-red-400 to-orange-500 skew-y-6 transform translate-y-24"></div>
                <div className="grid grid-cols-6 grid-rows-6 gap-4 absolute inset-0">
                    {[...Array(12)].map((_, i) => (
                        <div key={i} className="bg-red-500/5 dark:bg-red-500/10 rounded-lg transform rotate-45"></div>
                    ))}
                </div>
            </div>

            <div className="container mx-auto px-4 relative z-10">
                <div className="max-w-7xl mx-auto">
                    <div className="flex flex-col md:flex-row items-center justify-between mb-16 gap-8">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5 }}
                            className="md:w-1/2 text-left"
                        >
                            <div className="inline-flex items-center px-4 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm font-medium mb-4">
                                <SparklesIcon className="h-4 w-4 mr-2" />
                                <span>Revolutionary Tokenomics</span>
                            </div>
                            <h2 className="text-3xl md:text-5xl font-bold mb-6 inline-flex items-center">
                                <span className="bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">
                                    Revolutionary Tokenomics Engine
                                </span>
                            </h2>
                            <p className="text-lg text-gray-600 dark:text-gray-300 max-w-xl mb-8">
                                Experience the most sophisticated multi-token price pressure system in DeFi. Every action creates upward momentum across our ecosystem.
                            </p>

                            <div className="space-y-6 mt-6">
                                <div className="flex items-start">
                                    <div className="flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-full bg-gradient-to-r from-red-500 to-red-600 text-white mr-4">
                                        <span className="text-lg font-bold">🐻</span>
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">BEAR Supply Shock</h3>
                                        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                                            <strong>100,000 total Bears</strong> → Users deposit them → Supply shrinks exponentially → BTB swap rate increases with AMM formula: <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-sm">price = btbBalance / (totalSupply - nftsInContract)</code>
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-start">
                                    <div className="flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 text-white mr-4">
                                        <span className="text-lg font-bold">🔥</span>
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">MiMo Deflation Engine</h3>
                                        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                                            Every hunt <strong>burns 25% of MiMo permanently</strong> → 25% to LP providers → 50% to hunters → Supply decreases relentlessly → Price rises with scarcity
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-start">
                                    <div className="flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 text-white mr-4">
                                        <span className="text-lg font-bold">💰</span>
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Redemption Premium Tax</h3>
                                        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                                            Want your Bears back? Pay <strong>1M+ MiMo + 10% fee</strong> → Forces massive MiMo buying pressure → Creates sustainable demand loop → Prices must go up
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-start">
                                    <div className="flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-white mr-4">
                                        <span className="text-lg font-bold">🏆</span>
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">LP Provider Paradise</h3>
                                        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                                            <strong>25% of ALL hunt rewards</strong> go to BTB/MiMo LP providers → Guaranteed yield from ecosystem activity → Deep liquidity protection → Win-win for everyone
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-4 mt-8">
                                <Link
                                    href="/game"
                                    className="inline-flex items-center px-6 py-3 rounded-md font-medium text-white bg-gradient-to-r from-red-600 to-orange-600 hover:shadow-lg transition-all duration-300"
                                >
                                    Play Now <ArrowRightIcon className="ml-2 h-4 w-4" />
                                </Link>
                                <Link
                                    href="/game#learn"
                                    className="inline-flex items-center px-6 py-3 rounded-md font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 transition-all duration-300"
                                >
                                    Learn More
                                </Link>
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5 }}
                            className="md:w-1/2 relative"
                        >
                            <div className="relative bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 rounded-2xl p-8 border border-red-100 dark:border-red-800/30 shadow-lg">
                                <div className="absolute -top-4 -right-4 bg-gradient-to-r from-red-600 to-orange-500 text-white text-sm font-bold px-4 py-1 rounded-full animate-pulse">PRICE MACHINE!</div>

                                <div className="text-center mb-8">
                                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">The Perfect Storm</h3>
                                    <p className="text-gray-600 dark:text-gray-400">Multi-layer price pressure system</p>
                                </div>

                                <div className="space-y-4 mb-6">
                                    <div className="flex items-center p-4 bg-gradient-to-r from-red-100 to-red-50 dark:from-red-900/30 dark:to-red-800/20 rounded-lg border border-red-200 dark:border-red-700">
                                        <div className="text-2xl mr-3">🔄</div>
                                        <div>
                                            <h4 className="font-bold text-gray-900 dark:text-white text-sm">Loop #1: Bear Scarcity</h4>
                                            <p className="text-xs text-gray-600 dark:text-gray-400">Users join → Bears deposited → Supply shrinks → BTB prices ↗️</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center p-4 bg-gradient-to-r from-orange-100 to-orange-50 dark:from-orange-900/30 dark:to-orange-800/20 rounded-lg border border-orange-200 dark:border-orange-700">
                                        <div className="text-2xl mr-3">🔥</div>
                                        <div>
                                            <h4 className="font-bold text-gray-900 dark:text-white text-sm">Loop #2: MiMo Burns</h4>
                                            <p className="text-xs text-gray-600 dark:text-gray-400">Hunting burns supply → Scarcity increases → MiMo prices ↗️</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center p-4 bg-gradient-to-r from-amber-100 to-amber-50 dark:from-amber-900/30 dark:to-amber-800/20 rounded-lg border border-amber-200 dark:border-amber-700">
                                        <div className="text-2xl mr-3">💎</div>
                                        <div>
                                            <h4 className="font-bold text-gray-900 dark:text-white text-sm">Loop #3: Redemption Tax</h4>
                                            <p className="text-xs text-gray-600 dark:text-gray-400">10% premium forces buying → Demand spikes → All prices ↗️</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center p-4 bg-gradient-to-r from-emerald-100 to-emerald-50 dark:from-emerald-900/30 dark:to-emerald-800/20 rounded-lg border border-emerald-200 dark:border-emerald-700">
                                        <div className="text-2xl mr-3">🏆</div>
                                        <div>
                                            <h4 className="font-bold text-gray-900 dark:text-white text-sm">Loop #4: LP Incentives</h4>
                                            <p className="text-xs text-gray-600 dark:text-gray-400">25% to LPs → Deep liquidity → Stable trading → Growth ↗️</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-gradient-to-r from-red-600 to-orange-600 text-white p-4 rounded-lg text-center">
                                    <div className="font-bold text-lg mb-1">🚀 Result: Exponential Growth</div>
                                    <p className="text-sm opacity-90">Every action pushes ALL prices higher!</p>
                                </div>
                            </div>
                        </motion.div>
                    </div>

                    {/* Tokenomics Power Stats */}
                    <div className="mt-16">
                        <h3 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-8">Why Every Mechanism Matters</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.3, delay: 0.1 }}
                                className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 rounded-xl p-6 text-center border border-red-200 dark:border-red-800"
                            >
                                <div className="text-4xl mb-3">🐻</div>
                                <p className="text-2xl font-bold text-red-600 dark:text-red-400 mb-1">100K</p>
                                <p className="text-gray-700 dark:text-gray-300 text-sm">Total BEAR Supply</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Finite → Scarcity → Price ↗️</p>
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.3, delay: 0.2 }}
                                className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-xl p-6 text-center border border-orange-200 dark:border-orange-800"
                            >
                                <div className="text-4xl mb-3">🔥</div>
                                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400 mb-1">25%</p>
                                <p className="text-gray-700 dark:text-gray-300 text-sm">Burned Every Hunt</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Permanent deflation</p>
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.3, delay: 0.3 }}
                                className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 rounded-xl p-6 text-center border border-amber-200 dark:border-amber-800"
                            >
                                <div className="text-4xl mb-3">💎</div>
                                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mb-1">10%</p>
                                <p className="text-gray-700 dark:text-gray-300 text-sm">Redemption Premium</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Forces buying pressure</p>
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.3, delay: 0.4 }}
                                className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 rounded-xl p-6 text-center border border-emerald-200 dark:border-emerald-800"
                            >
                                <div className="text-4xl mb-3">🏆</div>
                                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mb-1">25%</p>
                                <p className="text-gray-700 dark:text-gray-300 text-sm">To LP Providers</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Guaranteed yield</p>
                            </motion.div>
                        </div>

                        {/* Why It All Works */}
                        <div className="mt-12 bg-gradient-to-r from-red-600 to-orange-600 rounded-2xl p-8 text-white text-center">
                            <h4 className="text-2xl font-bold mb-4">🎯 The Perfect Formula</h4>
                            <p className="text-lg mb-6 max-w-4xl mx-auto">
                                Each token NEEDS the others → BEAR scarcity drives BTB demand → MiMo deflation creates scarcity → Redemption costs force buying → LP rewards ensure liquidity → Price discovery accelerates upward
                            </p>
                            <div className="flex flex-wrap justify-center gap-4 text-sm">
                                <span className="bg-white/20 px-4 py-2 rounded-full">Multi-Token Synergy</span>
                                <span className="bg-white/20 px-4 py-2 rounded-full">Deflationary Mechanics</span>
                                <span className="bg-white/20 px-4 py-2 rounded-full">Sustainable Rewards</span>
                                <span className="bg-white/20 px-4 py-2 rounded-full">Price Pressure Engine</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
