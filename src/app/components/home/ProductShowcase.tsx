'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRightIcon } from '@heroicons/react/24/outline';
import { products } from '../../../data/home-data';

export default function ProductShowcase() {
    return (
        <section className="py-16 sm:py-20 bg-gray-50 dark:bg-gray-900" aria-label="BTB Finance ecosystem products">
            <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
                <header className="mx-auto max-w-xl text-center mb-6">
                    <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-2xl font-heading">
                        Explore the BTB Finance ecosystem
                    </h2>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                        Powerful tools for decentralized finance
                    </p>
                </header>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {products.map((product, index) => (
                        <motion.article
                            key={index}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: "-50px" }}
                            transition={{ duration: 0.5, delay: index * 0.1 }}
                            className={`group relative overflow-hidden bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 border ${product.highlight ? 'border-red-500 dark:border-red-500 ring-2 ring-red-500/50' : 'border-gray-100 dark:border-gray-700 hover:border-optimism-red dark:hover:border-optimism-red'}`}
                        >
                            {product.highlight && (
                                <div className="absolute right-0 top-0 bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded-bl-lg z-10">
                                    NEW
                                </div>
                            )}
                            <div className="absolute -right-10 -top-10 h-20 w-20 rounded-full bg-optimism-red opacity-10 group-hover:opacity-20 transition-opacity" />
                            <div className="p-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center">
                                        <div className={`flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-lg ${product.bgColor} ${product.iconColor} p-2 mr-3 ${product.highlight ? 'animate-pulse' : ''}`}>
                                            <product.icon className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <h3 className={`text-base font-bold font-heading ${product.highlight ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                                                {product.name}
                                                {product.isNew && !product.highlight && <span className="ml-2 text-xs font-medium px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-300">New</span>}
                                            </h3>
                                            <p className="text-gray-600 dark:text-gray-300 text-xs">
                                                {product.description}
                                            </p>
                                        </div>
                                    </div>
                                    <Link
                                        href={product.href}
                                        className={`flex-shrink-0 inline-flex items-center text-sm font-medium transition-colors ${product.highlight ? 'text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300' : 'text-optimism-red hover:text-optimism-red/80'}`}
                                    >
                                        <span className="hidden sm:inline">Learn more</span> <ArrowRightIcon className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                                    </Link>
                                </div>
                            </div>
                        </motion.article>
                    ))}
                </div>
            </div>
        </section>
    );
}
