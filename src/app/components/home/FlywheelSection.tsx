'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheckIcon } from '@heroicons/react/24/outline';
import {
    flywheelSteps,
    spinAnimation,
    spinReverseAnimation,
    winnerGroups
} from '../../../data/home-data';

export default function FlywheelSection() {
    return (
        <div className="py-16 bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
            <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
                <div className="mx-auto max-w-2xl text-center mb-10">
                    <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl font-heading">
                        The BTB Liquidity Hub Flywheel
                    </h2>
                    <p className="mt-3 text-base text-gray-600 dark:text-gray-300">
                        Our revolutionary liquidity hub creates a self-reinforcing ecosystem where impermanent loss is eliminated and everyone wins
                    </p>
                </div>

                <div className="relative">
                    {/* Flywheel Diagram */}
                    <div className="mb-10 relative max-w-3xl mx-auto">
                        <div className="absolute inset-0 bg-gradient-to-r from-btb-primary/5 to-btb-primary-light/5 rounded-lg transform -rotate-1"></div>
                        <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-100 dark:border-gray-700">
                            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                                <div className="w-full md:w-1/2">
                                    <h3 className="text-lg font-bold text-btb-primary mb-2">How The Liquidity Hub Works</h3>
                                    <p className="text-gray-600 dark:text-gray-300 text-sm mb-3">Our mechanism turns volatility into profit through exclusive minting and first-mover arbitrage:</p>

                                    <ol className="space-y-2">
                                        {[
                                            { step: "ETH Price Movement", desc: "Triggers BTB repricing" },
                                            { step: "Instant Arbitrage", desc: "Price difference between our protocol and DEXs" },
                                            { step: "Exclusive Capture", desc: "Only we can mint BTB to arbitrage" },
                                            { step: "Profit Accumulation", desc: "Each movement adds to IL refund pool" },
                                            { step: "Automatic Refunds", desc: "LPs receive exact IL compensation" },
                                            { step: "Sustainable Model", desc: "Volatility creates profits, not losses" }
                                        ].map((item, i) => (
                                            <li key={i} className="flex items-start">
                                                <span className="flex-shrink-0 flex items-center justify-center h-5 w-5 rounded-full bg-btb-primary text-white text-xs font-medium mr-2">{i + 1}</span>
                                                <div className="text-sm">
                                                    <span className="font-semibold text-gray-900 dark:text-white">{item.step}</span>
                                                    <span className="text-gray-600 dark:text-gray-300"> → {item.desc}</span>
                                                </div>
                                            </li>
                                        ))}
                                    </ol>
                                </div>

                                <div className="w-full md:w-1/2 flex justify-center">
                                    <div className="relative w-64 h-64">
                                        {/* Circular flywheel visualization */}
                                        <motion.div
                                            className="absolute inset-0 rounded-full border-4 border-dashed border-btb-primary/30"
                                            animate={spinAnimation}
                                        />
                                        <motion.div
                                            className="absolute inset-4 rounded-full border-2 border-btb-primary/50"
                                            animate={spinReverseAnimation}
                                        />

                                        {/* Flywheel steps */}
                                        {flywheelSteps.map((step, index) => {
                                            const angle = (index / flywheelSteps.length) * Math.PI * 2;
                                            const x = Math.cos(angle) * 100;
                                            const y = Math.sin(angle) * 100;

                                            return (
                                                <motion.div
                                                    key={index}
                                                    className="absolute w-8 h-8 rounded-full bg-white dark:bg-gray-700 shadow-md flex items-center justify-center text-xs font-medium text-btb-primary border border-btb-primary/20"
                                                    style={{
                                                        left: "50%",
                                                        top: "50%",
                                                        transform: `translate(${x}px, ${y}px) translate(-50%, -50%)`
                                                    }}
                                                    whileHover={{ scale: 1.2, zIndex: 10 }}
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    transition={{ delay: index * 0.1 }}
                                                >
                                                    {index + 1}
                                                </motion.div>
                                            );
                                        })}

                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <motion.span
                                                className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-btb-primary-light via-white to-btb-primary-light bg-clip-text text-transparent"
                                                animate={{ scale: [1, 1.05, 1] }}
                                                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" as const }}
                                            >
                                                BTB
                                            </motion.span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Who Wins Section */}
                    <div className="mb-10">
                        <h3 className="text-xl font-bold text-center text-gray-900 dark:text-white mb-6">Who Wins in This Model?</h3>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {winnerGroups.map((group, index) => (
                                <motion.div
                                    key={index}
                                    className={`p-4 rounded-lg shadow-md ${group.color}`}
                                    initial={{ opacity: 0, y: 20 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.1 }}
                                    viewport={{ once: true }}
                                >
                                    <div className="flex items-center mb-2">
                                        <div className="p-1.5 rounded-full bg-white/50 dark:bg-gray-800/50 mr-2">
                                            <group.icon className="h-4 w-4 text-btb-primary" />
                                        </div>
                                        <h4 className="text-base font-bold text-gray-900 dark:text-white">{group.title}</h4>
                                    </div>

                                    <ul className="space-y-1">
                                        {group.benefits.map((benefit, i) => (
                                            <li key={i} className="flex items-start">
                                                <span className="text-btb-primary mr-1.5">•</span>
                                                <span className="text-gray-700 dark:text-gray-300 text-xs">{benefit}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </motion.div>
                            ))}
                        </div>
                    </div>

                    {/* Technical Arbitrage Example */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-5 border border-gray-100 dark:border-gray-700">
                        <h3 className="text-lg font-bold text-btb-primary mb-3">Technical Arbitrage Example</h3>

                        <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 text-sm">
                            <p className="mb-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border-l-4 border-btb-primary">
                                <span className="font-semibold text-btb-primary">Real Example:</span> When ETH drops 5%, BTB reprices on our protocol but USDC/BTB pools on Uniswap and Aerodrome lag behind. Our bots mint fresh BTB at the new rate and sell into the old pool prices, capturing the 5% spread. If an LP in USDC/BTB would lose $100 to IL, we've already captured $500+ in arbitrage profits to eliminate their losses completely.
                            </p>

                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                                    <h4 className="font-semibold text-red-800 dark:text-red-300 mb-2">Traditional USDC/BTB LP</h4>
                                    <ul className="text-xs space-y-1">
                                        <li>• LP would lose $100 to IL</li>
                                        <li>• Random arbitrageurs profit</li>
                                        <li>• LP bears the full loss</li>
                                        <li>• Unsustainable for LPs</li>
                                    </ul>
                                </div>

                                <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                                    <h4 className="font-semibold text-green-800 dark:text-green-300 mb-2">BTB Protected USDC/BTB LP</h4>
                                    <ul className="text-xs space-y-1">
                                        <li>• BTB captures $500+ arbitrage first</li>
                                        <li>• LP would lose $100 to IL</li>
                                        <li>• LP receives $100 refund = 0 IL</li>
                                        <li>• $400+ profit for treasury</li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* The IL Refund Guarantee Section */}
                    <div className="mt-8 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-6 border border-green-200 dark:border-green-700">
                        <h3 className="text-lg font-bold text-green-800 dark:text-green-300 mb-4 flex items-center">
                            <ShieldCheckIcon className="h-5 w-5 mr-2" />
                            The IL Refund Guarantee
                        </h3>

                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="space-y-3">
                                <div className="flex items-start space-x-3">
                                    <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                                    <p className="text-sm text-gray-700 dark:text-gray-300"><span className="font-semibold">We profit from the SAME price movements</span> that cause IL</p>
                                </div>
                                <div className="flex items-start space-x-3">
                                    <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                                    <p className="text-sm text-gray-700 dark:text-gray-300"><span className="font-semibold">Every oscillation within LP ranges</span> creates arbitrage</p>
                                </div>
                                <div className="flex items-start space-x-3">
                                    <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                                    <p className="text-sm text-gray-700 dark:text-gray-300"><span className="font-semibold">100+ daily price movements</span> = 100+ profit opportunities</p>
                                </div>
                            </div>
                            <div className="space-y-3">
                                <div className="flex items-start space-x-3">
                                    <div className="w-2 h-2 bg-emerald-500 rounded-full mt-2 flex-shrink-0"></div>
                                    <p className="text-sm text-gray-700 dark:text-gray-300"><span className="font-semibold">We're not protecting against IL</span> - we're harvesting it</p>
                                </div>
                                <div className="flex items-start space-x-3">
                                    <div className="w-2 h-2 bg-emerald-500 rounded-full mt-2 flex-shrink-0"></div>
                                    <p className="text-sm text-gray-700 dark:text-gray-300"><span className="font-semibold">USDC/BTB LPs provide exit liquidity</span> to OUR bots, not random arbitrageurs</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
