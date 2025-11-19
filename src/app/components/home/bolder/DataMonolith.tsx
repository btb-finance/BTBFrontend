'use client';

import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';

const stats = [
    { label: "USERS", value: "8.2K", color: "text-gray-400" },
    { label: "APY", value: "450%", color: "text-btb-primary" },
];

export default function DataMonolith() {
    const containerRef = useRef<HTMLDivElement>(null);
    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ["start end", "end start"]
    });

    return (
        <section ref={containerRef} className="py-32 bg-black relative z-10 overflow-hidden">
            <div className="container mx-auto px-4">
                <div className="flex flex-col gap-32">
                    {stats.map((stat, index) => {
                        // Create a parallax effect for each block
                        const y = useTransform(scrollYProgress, [0, 1], [100 * (index + 1), -100 * (index + 1)]);

                        return (
                            <motion.div
                                key={index}
                                style={{ y }}
                                className="flex flex-col items-center md:items-start relative"
                            >
                                {/* Massive Background Label */}
                                <span className="absolute -top-12 left-0 text-[15vw] font-black text-white/[0.02] leading-none select-none pointer-events-none">
                                    {stat.label}
                                </span>

                                <div className="relative z-10">
                                    <motion.div
                                        initial={{ opacity: 0, x: -50 }}
                                        whileInView={{ opacity: 1, x: 0 }}
                                        viewport={{ once: true, margin: "-100px" }}
                                        transition={{ duration: 0.8, ease: "easeOut" }}
                                        className="flex items-baseline gap-4"
                                    >
                                        <span className="text-sm md:text-xl font-mono tracking-[0.5em] text-white/50 uppercase">
                                            {stat.label}
                                        </span>
                                        <div className="h-[1px] w-24 bg-white/20" />
                                    </motion.div>

                                    <motion.h2
                                        initial={{ opacity: 0, y: 50 }}
                                        whileInView={{ opacity: 1, y: 0 }}
                                        viewport={{ once: true, margin: "-100px" }}
                                        transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
                                        className={`text-[15vw] md:text-[12vw] font-black tracking-tighter leading-[0.8] ${stat.color}`}
                                    >
                                        {stat.value}
                                    </motion.h2>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
