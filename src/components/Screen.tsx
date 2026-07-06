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
 * Standard vertical-stack content container, used inside the desktop content
 * area (which already provides its own outer padding).
 */
export function Screen({ children, gap = 16, style }: ScreenProps) {
  return (
    <div
      style={{
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
