'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { FaXTwitter, FaTelegram, FaDiscord, FaGithub } from 'react-icons/fa6';

const socials = [
    { name: 'Twitter', icon: FaXTwitter, href: 'https://x.com/BTB_Finance', color: 'hover:text-white' },
    { name: 'Telegram', icon: FaTelegram, href: 'https://t.me/BTBFinance', color: 'hover:text-blue-400' },
    { name: 'Discord', icon: FaDiscord, href: 'https://discord.gg/bqFEPA56Tc', color: 'hover:text-indigo-400' },
    { name: 'GitHub', icon: FaGithub, href: 'https://github.com/btb-finance', color: 'hover:text-gray-400' },
];

export default function CommunitySection() {
    return (
        <section className="relative py-32 bg-black overflow-hidden">
            {/* Marquee */}
            <div className="absolute top-0 left-0 w-full overflow-hidden whitespace-nowrap opacity-10 pointer-events-none">
                <motion.div
                    animate={{ x: [0, -1000] }}
                    transition={{ repeat: Infinity, duration: 20, ease: "linear" }}
                    className="inline-block"
                >
                    <span className="text-[10vw] font-black text-white mr-12">JOIN THE MOVEMENT</span>
                    <span className="text-[10vw] font-black text-white mr-12">JOIN THE MOVEMENT</span>
                    <span className="text-[10vw] font-black text-white mr-12">JOIN THE MOVEMENT</span>
                    <span className="text-[10vw] font-black text-white mr-12">JOIN THE MOVEMENT</span>
                </motion.div>
            </div>

            <div className="container mx-auto px-4 relative z-10 text-center">
                <motion.h2
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-4xl md:text-6xl font-bold text-white mb-8"
                >
                    Become Part of the <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-btb-primary to-red-500">Revolution</span>
                </motion.h2>

                <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-16">
                    Join our growing community of traders, gamers, and innovators.
                    Shape the future of BTB Finance.
                </p>

                <div className="flex justify-center gap-8 md:gap-16">
                    {socials.map((social, index) => (
                        <motion.a
                            key={social.name}
                            href={social.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: index * 0.1 }}
                            whileHover={{ scale: 1.2, rotate: 5 }}
                            className={`text-4xl md:text-6xl text-gray-600 transition-colors duration-300 ${social.color}`}
                        >
                            <social.icon />
                        </motion.a>
                    ))}
                </div>
            </div>
        </section>
    );
}
