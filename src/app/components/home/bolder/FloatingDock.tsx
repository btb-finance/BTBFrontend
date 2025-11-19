'use client';

import React, { useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform, MotionValue } from 'framer-motion';
import Link from 'next/link';
import {
    HomeIcon,
    CurrencyDollarIcon,
    GlobeAltIcon,
    TicketIcon,
    Squares2X2Icon
} from '@heroicons/react/24/outline';

const items = [
    { name: 'Home', icon: HomeIcon, href: '/' },
    { name: 'Finance', icon: CurrencyDollarIcon, href: '/btb-finance' },
    { name: 'Game', icon: GlobeAltIcon, href: '/game' },
    { name: 'Lottery', icon: TicketIcon, href: '/megapot' },
    { name: 'Dashboard', icon: Squares2X2Icon, href: '/dashboard' },
];

function DockIcon({ mouseX, item }: { mouseX: MotionValue, item: any }) {
    const ref = useRef<HTMLDivElement>(null);

    const distance = useTransform(mouseX, (val) => {
        const bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };
        return val - bounds.x - bounds.width / 2;
    });

    const widthSync = useTransform(distance, [-150, 0, 150], [40, 80, 40]);
    const width = useSpring(widthSync, { mass: 0.1, stiffness: 150, damping: 12 });

    return (
        <Link href={item.href}>
            <motion.div
                ref={ref}
                style={{ width }}
                className="aspect-square rounded-full bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center relative group backdrop-blur-md transition-colors"
            >
                <item.icon className="w-1/2 h-1/2 text-white" />

                {/* Tooltip */}
                <span className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/80 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap backdrop-blur-sm border border-white/10">
                    {item.name}
                </span>
            </motion.div>
        </Link>
    );
}

export default function FloatingDock() {
    const mouseX = useMotionValue(Infinity);

    return (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
            <motion.div
                onMouseMove={(e) => mouseX.set(e.pageX)}
                onMouseLeave={() => mouseX.set(Infinity)}
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 1, duration: 0.8, type: "spring" }}
                className="flex items-end gap-4 px-4 py-3 bg-black/20 backdrop-blur-xl border border-white/10 rounded-full shadow-2xl h-20"
            >
                {items.map((item) => (
                    <DockIcon key={item.name} mouseX={mouseX} item={item} />
                ))}
            </motion.div>
        </div>
    );
}
