'use client';

import React, { useRef, useState, useEffect } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';

const stages = [
    {
        title: "MINE",
        desc: "Deploy ETH. Pick your squares. Join the round.",
        color: "from-blue-600 to-blue-900"
    },
    {
        title: "WIN",
        desc: "Checkpoint rounds. Claim ETH & BTB rewards.",
        color: "from-green-600 to-green-900"
    },
    {
        title: "REFINE",
        desc: "HODL unclaimed BTB. Earn passive yield from others.",
        color: "from-purple-600 to-purple-900"
    }
];

export default function CoreNarrative() {
    const containerRef = useRef<HTMLDivElement>(null);
    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ["start start", "end end"]
    });

    const [activeStage, setActiveStage] = useState(0);

    useEffect(() => {
        const unsubscribe = scrollYProgress.on("change", (latest) => {
            if (latest < 0.33) setActiveStage(0);
            else if (latest < 0.66) setActiveStage(1);
            else setActiveStage(2);
        });
        return () => unsubscribe();
    }, [scrollYProgress]);

    const rotate = useTransform(scrollYProgress, [0, 1], [0, 360]);
    const scale = useTransform(scrollYProgress, [0, 0.5, 1], [1, 1.5, 1]);

    return (
        <section ref={containerRef} className="h-[300vh] bg-black relative">
            <div className="sticky top-0 h-screen flex items-center justify-center overflow-hidden">
                {/* Background Glow */}
                <motion.div
                    className={`absolute inset-0 bg-gradient-to-b opacity-20 transition-colors duration-1000 ${stages[activeStage].color}`}
                />

                {/* The Core */}
                <div className="relative z-10 w-[500px] h-[500px] flex items-center justify-center">
                    <motion.div
                        style={{ rotate, scale }}
                        className="absolute inset-0 border-[2px] border-white/20 rounded-full border-dashed"
                    />
                    <motion.div
                        style={{ rotate: useTransform(scrollYProgress, [0, 1], [360, 0]) }}
                        className="absolute inset-12 border-[1px] border-white/10 rounded-full"
                    />

                    {/* Central Orb */}
                    <motion.div
                        animate={{
                            boxShadow: `0 0 100px ${activeStage === 0 ? '#2563eb' : activeStage === 1 ? '#16a34a' : '#9333ea'}`,
                        }}
                        className="w-64 h-64 rounded-full bg-black border border-white/20 flex items-center justify-center backdrop-blur-xl relative overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />

                        <motion.div
                            key={activeStage}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.5 }}
                            className="text-center relative z-10"
                        >
                            <h3 className="text-4xl font-black text-white tracking-tighter mb-2">
                                {stages[activeStage].title}
                            </h3>
                            <p className="text-xs font-mono text-gray-400 uppercase tracking-widest">
                                Phase {activeStage + 1}
                            </p>
                        </motion.div>
                    </motion.div>
                </div>

                {/* Narrative Text */}
                <div className="absolute bottom-24 left-0 w-full text-center px-4">
                    <motion.p
                        key={activeStage}
                        initial={{ opacity: 0, filter: "blur(10px)" }}
                        animate={{ opacity: 1, filter: "blur(0px)" }}
                        transition={{ duration: 0.8 }}
                        className="text-2xl md:text-4xl font-light text-white/80 max-w-3xl mx-auto"
                    >
                        {stages[activeStage].desc}
                    </motion.p>
                </div>

                {/* Progress Bar */}
                <div className="absolute right-8 top-1/2 -translate-y-1/2 h-64 w-1 bg-white/10 rounded-full overflow-hidden hidden md:block">
                    <motion.div
                        style={{ height: useTransform(scrollYProgress, [0, 1], ["0%", "100%"]) }}
                        className="w-full bg-white"
                    />
                </div>
            </div>
        </section>
    );
}
