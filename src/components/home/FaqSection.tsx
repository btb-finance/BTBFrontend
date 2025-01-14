'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icons } from '@/components/ui/Icons';

const faqs = [
  {
    question: 'What is Impermanent Loss Protection?',
    answer: 'Impermanent Loss (IL) Protection safeguards liquidity providers from value loss that occurs when token prices in a pool change. BTB Finance covers 100% of IL for supported pools through our innovative refund system.',
  },
  {
    question: 'How does BTB Finance protect liquidity providers?',
    answer: 'BTB Finance uses a portion of protocol fees to create an IL shield fund. When LPs experience impermanent loss, they can claim compensation from this fund, ensuring their capital is protected while still earning trading fees.',
  },
  {
    question: 'What are the benefits of staking BTB?',
    answer: "Staking BTB tokens gives you governance rights and a share of protocol fees. Stakers can vote on which pools receive IL protection and earn rewards from the protocol's fee distribution system.",
  },
  {
    question: 'How are protocol fees distributed?',
    answer: '80% of fees go to liquidity providers, 10% to BTB stakers who participate in governance, and 10% to the treasury for sustainable protocol development and IL protection.',
  },
  {
    question: 'Which networks does BTB Finance support?',
    answer: 'BTB Finance is currently live on Ethereum mainnet and Optimism. We plan to expand to additional L2 networks based on community governance decisions.',
  },
];

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="py-20 px-6">
      <div className="container mx-auto max-w-4xl">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
          Frequently Asked Questions
        </h2>
        <p className="text-[var(--text-secondary)] text-center mb-12 max-w-2xl mx-auto">
          Everything you need to know about BTB Finance
        </p>
        <div className="space-y-4">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <motion.div
                key={faq.question}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="gradient-border bg-[var(--background-light)]"
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="w-full px-6 py-4 flex items-center justify-between hover:text-[var(--primary)] transition-colors"
                >
                  <span className="text-lg font-medium text-left">
                    {faq.question}
                  </span>
                  <motion.div
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Icons.ChevronRight className="w-5 h-5 transform -rotate-90" />
                  </motion.div>
                </button>
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-6 pb-4 text-[var(--text-secondary)]">
                        {faq.answer}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
