'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';

const partners = [
  {
    name: 'Uniswap',
    logo: '/images/partners/uniswap.svg',
    link: 'https://uniswap.org',
  },
  {
    name: 'Optimism',
    logo: '/images/partners/optimism.svg',
    link: 'https://optimism.io',
  },
  {
    name: 'Chainlink',
    logo: '/images/partners/chainlink.svg',
    link: 'https://chain.link',
  },
  {
    name: 'Arbitrum',
    logo: '/images/partners/arbitrum.svg',
    link: 'https://arbitrum.io',
  },
];

export function PartnersSection() {
  return (
    <section className="py-20 px-6 bg-[var(--background-light)]">
      <div className="container mx-auto max-w-6xl">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
          Trusted Partners
        </h2>
        <p className="text-[var(--text-secondary)] text-center mb-12 max-w-2xl mx-auto">
          We work with industry leaders to provide the best DeFi experience
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {partners.map((partner, index) => (
            <motion.a
              key={partner.name}
              href={partner.link}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              whileHover={{ scale: 1.05 }}
              className="flex items-center justify-center p-6 gradient-border bg-[var(--background-dark)] group hover:bg-[var(--background-light)] transition-all duration-300"
            >
              <div className="relative w-32 h-12">
                <Image
                  src={partner.logo}
                  alt={partner.name}
                  fill
                  className="object-contain filter grayscale group-hover:grayscale-0 transition-all duration-300"
                />
              </div>
            </motion.a>
          ))}
        </div>
      </div>
    </section>
  );
}
