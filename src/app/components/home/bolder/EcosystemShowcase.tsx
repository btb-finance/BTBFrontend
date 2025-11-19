'use client';

import React, { useRef } from 'react';
import { motion, useScroll, useTransform, MotionValue } from 'framer-motion';
import Link from 'next/link';
import { ArrowRightIcon } from '@heroicons/react/24/outline';

const cards = [
    {
        title: "FINANCE",
        subtitle: "Yield & Bonding",
        description: "Advanced DeFi protocols designed for sustainable yield. Bond assets, provide liquidity, and earn rewards.",
        color: "bg-[#1a0505]/80",
        gradient: "from-red-900/50 to-transparent",
        href: "/btb-finance",
        image: "💰"
    },
    {
        title: "GAME",
        subtitle: "Play to Earn",
        description: "Immersive gaming experiences powered by BTB. Compete, win, and trade in-game assets.",
        color: "bg-[#050a1a]/80",
        gradient: "from-blue-900/50 to-transparent",
        href: "/game",
        image: "🎮"
    },
    {
        title: "LOTTERY",
        subtitle: "Megapot",
        description: "Daily jackpots with fair on-chain randomness. Life-changing wins are just a ticket away.",
        color: "bg-[#1a051a]/80",
        gradient: "from-purple-900/50 to-transparent",
        href: "/megapot",
        image: "🎰"
    },
    {
        title: "LARRY",
        subtitle: "Ecosystem",
        description: "The mascot, the legend, the ecosystem. Join the Larry community.",
        color: "bg-[#1a1a05]/80",
        gradient: "from-yellow-900/50 to-transparent",
        href: "/larryecosystem",
        image: "🦁"
    }
];

const Card = ({ card, index, progress, range, targetScale }: { card: any, index: number, progress: MotionValue<number>, range: number[], targetScale: number }) => {
    const container = useRef(null);
    const { scrollYProgress } = useScroll({
        target: container,
        offset: ['start end', 'start start']
    });

    const imageScale = useTransform(scrollYProgress, [0, 1], [2, 1]);
    const scale = useTransform(progress, range, [1, targetScale]);

    return (
        <div ref={container} className="h-screen flex items-center justify-center sticky top-0">
            <motion.div
                style={{ scale, top: `calc(-5vh + ${index * 25}px)` }}
                className={`relative flex flex-col w-[1000px] h-[500px] rounded-[3rem] p-12 origin-top border border-white/10 overflow-hidden ${card.color} backdrop-blur-xl`}
            >
                {/* Background Gradient */}
                <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-50`} />

                <div className="relative z-10 flex h-full justify-between gap-10">
                    <div className="flex flex-col justify-between w-[60%]">
                        <div>
                            <span className="inline-block px-4 py-2 rounded-full border border-white/10 bg-white/5 text-sm font-mono text-white/70 mb-6 backdrop-blur-md">
                                {card.subtitle}
                            </span>
                            <h2 className="text-6xl font-bold text-white mb-6 tracking-tight">{card.title}</h2>
                            <p className="text-xl text-gray-400 leading-relaxed">{card.description}</p>
                        </div>

                        <Link href={card.href} className="group inline-flex items-center text-lg font-medium text-white">
                            <span className="border-b border-white/30 pb-1 group-hover:border-white transition-colors">Explore Module</span>
                            <ArrowRightIcon className="w-5 h-5 ml-3 transform group-hover:translate-x-1 transition-transform" />
                        </Link>
                    </div>

                    <div className="relative w-[40%] h-full rounded-2xl overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center">
                        <motion.div style={{ scale: imageScale }} className="text-9xl">
                            {card.image}
                        </motion.div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default function EcosystemShowcase() {
    const container = useRef(null);
    const { scrollYProgress } = useScroll({
        target: container,
        offset: ['start start', 'end end']
    });

    return (
        <div ref={container} className="relative mt-[20vh] mb-[20vh]">
            <div className="sticky top-0 h-screen flex items-center justify-center pointer-events-none mb-[-100vh]">
                <h2 className="text-[15vw] font-bold text-white/5 select-none">ECOSYSTEM</h2>
            </div>

            {cards.map((card, i) => {
                const targetScale = 1 - ((cards.length - i) * 0.05);
                return (
                    <Card
                        key={i}
                        index={i}
                        card={card}
                        progress={scrollYProgress}
                        range={[i * 0.25, 1]}
                        targetScale={targetScale}
                    />
                );
            })}
        </div>
    );
}
