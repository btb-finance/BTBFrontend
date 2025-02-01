'use client';

import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef } from 'react';
import { Icons } from '@/components/ui/Icons';

const TokenInfoCard = ({ title, value, icon: Icon }: { title: string; value: string; icon: any }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  return (
    <motion.div
      ref={ref}
      initial={{ y: 20, opacity: 0 }}
      animate={isInView ? { y: 0, opacity: 1 } : { y: 20, opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-[var(--background-light)] p-6 rounded-xl relative group hover:shadow-lg transition-shadow duration-300"
    >
      <div className="absolute top-4 right-4">
        <Icon className="w-6 h-6 text-[var(--primary)]" />
      </div>
      <h3 className="text-[var(--text-secondary)] text-sm mb-2">{title}</h3>
      <p className="text-xl font-semibold">{value}</p>
    </motion.div>
  );
};

const PriceOption = ({ title, price, description, icon: Icon }: { title: string; price: string; description: string; icon: any }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  return (
    <motion.div
      ref={ref}
      initial={{ scale: 0.95, opacity: 0 }}
      animate={isInView ? { scale: 1, opacity: 1 } : { scale: 0.95, opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-gradient-to-br from-[var(--background-light)] to-[var(--background-dark)] p-8 rounded-2xl relative group hover:shadow-xl transition-shadow duration-300"
    >
      <div className="absolute top-6 right-6">
        <Icon className="w-8 h-8 text-[var(--primary)]" />
      </div>
      <h3 className="text-xl font-bold mb-4">{title}</h3>
      <div className="text-3xl font-bold bg-gradient-to-r from-[var(--primary)] to-[var(--primary-dark)] bg-clip-text text-transparent mb-2">
        {price}
      </div>
      <p className="text-[var(--text-secondary)]">{description}</p>
    </motion.div>
  );
};

export function TokenDetails() {
  return (
    <section className="py-24 px-6 bg-gradient-to-b from-background-dark to-background-light">
      <div className="container mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
          viewport={{ once: true }}
          className="text-center mb-16 relative glass p-8 rounded-2xl"
        >
          <div className="text-center mb-8">
            <h2 className="text-4xl md:text-5xl font-bold">BTB Token Details</h2>
          </div>
          <p className="text-lg text-[var(--text-secondary)] max-w-2xl mx-auto">
            BTB Finance (BTB) is the governance token of the protocol, with a total supply of 1 billion tokens on Optimism
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          <TokenInfoCard
            title="Total Supply"
            value="1,000,000,000 BTB"
            icon={Icons.CurrencyDollar}
          />
          <TokenInfoCard
            title="Initial Supply Available"
            value="20% (200M BTB)"
            icon={Icons.ChartBar}
          />
          <TokenInfoCard
            title="Liquidity Pool"
            value="10% (100M BTB)"
            icon={Icons.Ethereum}
          />
          <TokenInfoCard
            title="Team & Development"
            value="70% (700M BTB)"
            icon={Icons.UserGroup}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
          <PriceOption
            title="Standard Purchase"
            price="$0.01 per BTB"
            description="Buy BTB tokens at the standard price with immediate access to your tokens."
            icon={Icons.ShieldCheck}
          />
          <PriceOption
            title="1-Year Vesting (50% Discount)"
            price="$0.005 per BTB"
            description="Get a 50% discount with 1-year linear vesting. Tokens unlock continuously over the vesting period."
            icon={Icons.ArrowTrend}
          />
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          viewport={{ once: true }}
          className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            viewport={{ once: true }}
            className="bg-gradient-to-br from-[var(--background-light)] to-[var(--background-dark)] p-6 rounded-2xl flex flex-col items-center text-center group hover:shadow-lg transition-shadow duration-300"
          >
            <div className="w-12 h-12 rounded-full bg-[var(--primary)] bg-opacity-20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
              <div className="w-8 h-8 rounded-full bg-[var(--primary)] flex items-center justify-center">
                <Icons.Lock className="w-4 h-4 text-white" />
              </div>
            </div>
            <h3 className="font-bold mb-2">Vesting Period</h3>
            <p className="text-[var(--text-secondary)]">Linear vesting over 12 months</p>
          </motion.div>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            viewport={{ once: true }}
            className="bg-gradient-to-br from-[var(--background-light)] to-[var(--background-dark)] p-6 rounded-2xl flex flex-col items-center text-center group hover:shadow-lg transition-shadow duration-300"
          >
            <div className="w-12 h-12 rounded-full bg-[var(--primary)] bg-opacity-20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
              <div className="w-8 h-8 rounded-full bg-[var(--primary)] flex items-center justify-center">
                <Icons.ArrowTrend className="w-4 h-4 text-white" />
              </div>
            </div>
            <h3 className="font-bold mb-2">Continuous Unlock</h3>
            <p className="text-[var(--text-secondary)]">Tokens unlock gradually each day</p>
          </motion.div>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            viewport={{ once: true }}
            className="bg-gradient-to-br from-[var(--background-light)] to-[var(--background-dark)] p-6 rounded-2xl flex flex-col items-center text-center group hover:shadow-lg transition-shadow duration-300"
          >
            <div className="w-12 h-12 rounded-full bg-[var(--primary)] bg-opacity-20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
              <div className="w-8 h-8 rounded-full bg-[var(--primary)] flex items-center justify-center">
                <Icons.Check className="w-4 h-4 text-white" />
              </div>
            </div>
            <h3 className="font-bold mb-2">Full Unlock</h3>
            <p className="text-[var(--text-secondary)]">100% unlocked after one year</p>
          </motion.div>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            viewport={{ once: true }}
            className="bg-gradient-to-br from-[var(--background-light)] to-[var(--background-dark)] p-6 rounded-2xl flex flex-col items-center text-center group hover:shadow-lg transition-shadow duration-300"
          >
            <div className="w-12 h-12 rounded-full bg-[var(--primary)] bg-opacity-20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
              <div className="w-8 h-8 rounded-full bg-[var(--primary)] flex items-center justify-center">
                <Icons.CurrencyDollar className="w-4 h-4 text-white" />
              </div>
            </div>
            <h3 className="font-bold mb-2">No Minimum</h3>
            <p className="text-[var(--text-secondary)]">Purchase any amount you want</p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
