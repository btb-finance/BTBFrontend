'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';

const menuItems = [
  { label: 'Home', href: '/' },
  { label: 'Product', href: '/product' },
  { label: 'Governance', href: '/governance' },
  { label: 'Docs', href: 'https://docs.btb.finance' },
];

export function MobileMenu() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 -mr-2 text-[var(--text-primary)]"
        aria-label="Toggle menu"
      >
        <motion.div
          animate={isOpen ? 'open' : 'closed'}
          className="w-6 h-6 flex flex-col justify-center items-center"
        >
          <motion.span
            variants={{
              closed: { rotate: 0, y: 0 },
              open: { rotate: 45, y: 2 },
            }}
            className="w-6 h-0.5 bg-current absolute"
          />
          <motion.span
            variants={{
              closed: { opacity: 1 },
              open: { opacity: 0 },
            }}
            className="w-6 h-0.5 bg-current absolute"
          />
          <motion.span
            variants={{
              closed: { rotate: 0, y: 0 },
              open: { rotate: -45, y: -2 },
            }}
            className="w-6 h-0.5 bg-current absolute"
          />
        </motion.div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full left-0 right-0 bg-[var(--background-dark)] border-t border-[var(--border-color)]"
          >
            <div className="container mx-auto px-6 py-4 space-y-4">
              {menuItems.map((item, index) => (
                <motion.div
                  key={item.href}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Link
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className="block py-2 text-lg hover:text-[var(--primary)] transition-colors"
                  >
                    {item.label}
                  </Link>
                </motion.div>
              ))}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: menuItems.length * 0.1 }}
                className="pt-4"
              >
                <Button className="w-full justify-center" asChild>
                  <Link href="/product">Launch App</Link>
                </Button>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
