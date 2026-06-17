'use client';
import { CSSProperties, ReactNode } from 'react';
import { btb } from './design-tokens';

interface BadgeProps {
  children: ReactNode;
  /** Text color. Defaults to dim white. */
  color?: string;
  /** Background fill. Defaults to transparent. */
  bg?: string;
  /** Full border shorthand. Defaults to a faint white hairline. */
  border?: string;
  /** sm = tight tag (fee tiers, version chips); md = standalone pill ("Soon"). */
  size?: 'sm' | 'md';
  style?: CSSProperties;
}

/**
 * Rounded status pill / tag — the `borderRadius: 999` label repeated ~28 times
 * (Soon, Stable, fee tiers, version chips, "You hold …"). Pass color/bg/border
 * to recolor without re-declaring the shape.
 */
export function Badge({ children, color = btb.textDim, bg = 'transparent', border = '1px solid rgba(255,255,255,0.14)', size = 'md', style }: BadgeProps) {
  const dims = size === 'sm'
    ? { fontSize: 10, padding: '1px 6px' }
    : { fontSize: 11, padding: '3px 10px' };
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        flexShrink: 0,
        borderRadius: 999,
        fontWeight: 700,
        color,
        background: bg,
        border,
        ...dims,
        ...style,
      }}
    >
      {children}
    </span>
  );
}
