'use client';
import { CSSProperties, ReactNode } from 'react';
import { btb } from './design-tokens';

interface SectionHeaderProps {
  title: ReactNode;
  /** Right-side slot. A string renders as the standard dim caption; a node renders as-is. */
  right?: ReactNode;
  style?: CSSProperties;
}

/**
 * The "section title on the left, caption/badge on the right" row repeated
 * across screens (e.g. "Liquidity Pools … 12 pools").
 */
export function SectionHeader({ title, right, style }: SectionHeaderProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px', ...style }}>
      <span style={{ color: btb.text, fontSize: 17, fontWeight: 800, letterSpacing: -0.3 }}>{title}</span>
      {right != null &&
        (typeof right === 'string'
          ? <span style={{ color: btb.textDim, fontSize: 12 }}>{right}</span>
          : right)}
    </div>
  );
}
