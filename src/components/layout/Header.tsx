'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { MobileMenu } from './MobileMenu';

export function Header() {
  const [mounted, setMounted] = useState(false);
  const { scrollY } = useScroll();
  const backgroundColor = useTransform(
    scrollY,
    [0, 100],
    ['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0.8)']
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <motion.header
      style={{ backgroundColor }}
      className="fixed top-0 left-0 right-0 z-50 backdrop-blur-sm border-b border-[var(--border-color)] border-opacity-50"
    >
      <div className="container mx-auto px-6 h-20 flex items-center justify-between">
        <Link href="/" className="text-2xl font-bold">
          BTB Finance
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-8">
          <Link
            href="/product"
            className="text-[var(--text-secondary)] hover:text-white transition-colors"
          >
            Product
          </Link>
          <Link
            href="/governance"
            className="text-[var(--text-secondary)] hover:text-white transition-colors"
          >
            Governance
          </Link>
          <a
            href="https://docs.btb.finance"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--text-secondary)] hover:text-white transition-colors"
          >
            Docs
          </a>
          <Button asChild>
            <Link href="/product">Launch App</Link>
          </Button>
        </nav>

        {/* Mobile Menu */}
        <MobileMenu />
      </div>
    </motion.header>
  );
}
