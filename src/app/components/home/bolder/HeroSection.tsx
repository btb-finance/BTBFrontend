'use client';

import React, { useRef, useState, useEffect } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import Link from 'next/link';
import { ArrowRightIcon } from '@heroicons/react/24/solid';
import MagneticButton from '../../ui/MagneticButton';

export default function HeroSection() {
    const containerRef = useRef<HTMLDivElement>(null);
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ["start start", "end start"]
    });

    const y = useTransform(scrollYProgress, [0, 1], [0, 200]);
    const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            setMousePosition({
                x: e.clientX,
                y: e.clientY
            });
        };

        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    return (
        <div ref={containerRef} className="relative h-screen w-full overflow-hidden bg-black flex items-center justify-center selection:bg-btb-primary selection:text-white">
            {/* Spotlight Background */}
            <div
                className="absolute inset-0 z-0 transition-opacity duration-500"
                style={{
                    background: `radial-gradient(800px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(139, 0, 0, 0.12), transparent 40%)`
                }}
            />

            <motion.div
                className="absolute inset-0 z-0"
                style={{ scale: useTransform(scrollYProgress, [0, 1], [1, 1.1]) }}
            >
                <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-20 mix-blend-overlay" />
            </motion.div>

            {/* Content */}
            <motion.div
                style={{ y, opacity }}
                className="relative z-10 text-center px-4 max-w-[90vw] flex flex-col items-center"
            >
                <div className="relative mb-12 group cursor-default">
                    <motion.h1
                        initial={{ opacity: 0, y: 100 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
                        className="text-[13vw] leading-[0.8] font-black tracking-tighter flex flex-col items-center"
                    >
                        <span className="text-white drop-shadow-2xl">BTB</span>
                        <span className="text-transparent bg-clip-text bg-gradient-to-b from-gray-400 to-gray-800 opacity-50" style={{ WebkitTextStroke: '1px rgba(255,255,255,0.2)' }}>
                            FINANCE
                        </span>
                    </motion.h1>
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5, duration: 0.8 }}
                    className="flex flex-col items-center gap-10"
                >
                    <div className="px-6 py-3 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
                        <p className="text-lg md:text-xl text-gray-300 font-light tracking-wide">
                            The next evolution of <span className="text-white font-medium">DeFi</span>.
                            <span className="mx-3 text-white/20">|</span>
                            <span className="text-gray-400">Bolder. Faster. Stronger.</span>
                        </p>
                    </div>

                    <Link href="/btb-finance">
                        <MagneticButton>
                            <button className="group relative px-10 py-5 bg-white text-black rounded-full text-lg font-bold overflow-hidden transition-all hover:shadow-[0_0_40px_rgba(255,255,255,0.3)]">
                                <div className="absolute inset-0 bg-gradient-to-r from-gray-100 to-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                <span className="relative z-10 flex items-center gap-3">
                                    Enter App
                                    <ArrowRightIcon className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                                </span>
                            </button>
                        </MagneticButton>
                    </Link>
                </motion.div>
            </motion.div>

            {/* Scroll Indicator */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.5, duration: 1 }}
                className="absolute bottom-12 left-1/2 -translate-x-1/2 text-white/30 text-[10px] tracking-[0.5em] uppercase flex flex-col items-center gap-4"
            >
                <span>Scroll</span>
                <div className="w-[1px] h-16 bg-gradient-to-b from-white/50 to-transparent" />
            </motion.div>
        </div>
    );
}
