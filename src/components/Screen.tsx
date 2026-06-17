'use client';
import { CSSProperties, ReactNode } from 'react';

interface ScreenProps {
  children: ReactNode;
  /** Vertical gap between top-level children. */
  gap?: number;
  /** Horizontal padding. */
  px?: number;
  style?: CSSProperties;
}

/**
 * Standard screen scroll container — the safe-area-aware padding + vertical
 * stack that every screen used to re-declare inline.
 */
export function Screen({ children, gap = 16, px = 18, style }: ScreenProps) {
  return (
    <div
      style={{
        padding: `env(safe-area-inset-top, 24px) ${px}px 100px`,
        display: 'flex',
        flexDirection: 'column',
        gap,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
