'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import { Icons } from '@/components/ui/Icons';

interface Stat {
  label: string;
  value: number;
  prefix?: string;
  icon: keyof typeof Icons;
  color: string;
}

export function StatsSection() {
  const containerRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  });

  const y = useTransform(scrollYProgress, [0, 0.5, 1], [50, 0, -50]);
  const tvlValue = useTransform(scrollYProgress, [0, 1], [0, 10000000]);
  const positionsValue = useTransform(scrollYProgress, [0, 1], [0, 1000]);
  const protectionValue = useTransform(scrollYProgress, [0, 1], [0, 500000]);

  const stats: Stat[] = [
    {
      label: 'Total Value Locked',
      value: 10000000,
      prefix: '$',
      icon: 'CurrencyDollar',
      color: 'from-emerald-500 to-teal-500',
    },
    {
      label: 'Protected Positions',
      value: 1000,
      icon: 'ShieldCheck',
      color: 'from-blue-500 to-indigo-500',
    },
    {
      label: 'IL Protection Paid',
      value: 500000,
      prefix: '$',
      icon: 'ArrowTrend',
      color: 'from-purple-500 to-pink-500',
    },
  ];

  const values = [tvlValue, positionsValue, protectionValue];

  return (
    <section className="py-20 px-6" ref={containerRef}>
      <div className="container mx-auto max-w-6xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {stats.map((stat, i) => {
            const IconComponent = Icons[stat.icon];

            return (
              <motion.div
                key={stat.label}
                style={{ y }}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                className="bg-[var(--background-light)] p-6 rounded-2xl"
              >
                <div className="flex items-center justify-between mb-4">
                  <motion.div
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    className={`w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br ${stat.color}`}
                  >
                    <IconComponent className="w-6 h-6 text-white" />
                  </motion.div>
                  <motion.span className="text-2xl font-bold">
                    {stat.prefix}
                    <motion.span>
                      {Math.round(values[i].get()).toLocaleString()}
                    </motion.span>
                  </motion.span>
                </div>
                <p className="text-[var(--text-secondary)]">{stat.label}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
