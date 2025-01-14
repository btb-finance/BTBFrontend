'use client';

import { motion, HTMLMotionProps } from 'framer-motion';
import { ReactNode } from 'react';

interface AnimatedSectionProps extends HTMLMotionProps<'div'> {
  children: ReactNode;
  delay?: number;
}

export function AnimatedSection({ 
  children, 
  delay = 0, 
  ...props 
}: AnimatedSectionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.5,
        delay,
        ease: [0.25, 0.1, 0.25, 1],
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function AnimatedFadeIn({ 
  children, 
  delay = 0,
  ...props 
}: AnimatedSectionProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{
        duration: 0.3,
        delay,
        ease: 'easeOut',
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function AnimatedScale({ 
  children, 
  delay = 0,
  ...props 
}: AnimatedSectionProps) {
  return (
    <motion.div
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{
        duration: 0.3,
        delay,
        ease: [0.25, 0.1, 0.25, 1],
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function AnimatedGradient({ 
  children, 
  delay = 0,
  ...props 
}: AnimatedSectionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        duration: 0.5,
        delay,
        ease: [0.25, 0.1, 0.25, 1],
      }}
      className="relative"
      {...props}
    >
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-[var(--primary)] to-[var(--primary-dark)] opacity-20 blur-xl rounded-lg"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 0.2, scale: 1 }}
        transition={{
          duration: 0.8,
          delay: delay + 0.1,
          ease: [0.25, 0.1, 0.25, 1],
        }}
      />
      {children}
    </motion.div>
  );
}
